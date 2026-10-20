/** Experimental capture of legacy output or caller-supplied candidate fixtures. */
import { Buffer } from 'node:buffer';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySVGInputSafety } from '../../dist/security/input-safety.js';
import { parseSourceToXmlDocument } from './saxes-xml-document-adapter.mjs';
import { lowerXmlDocumentToIR } from './.build/phase3/lower-xml-to-ir.js';
import {
  analyzeStaticSvgSource,
  digestStaticProjection,
  STATIC_SVG_GRAMMAR,
  STATIC_SVG_SOURCE_ORACLE_SCHEMA,
} from './static-svg-source-oracle.mjs';
import {
  CAPTURE_FAILURE_CODES,
  DEFAULT_CAPTURE_TIMEOUT_MS,
  MAX_CAPTURE_ARTIFACT_BYTES,
  MAX_CAPTURE_INPUT_BYTES,
  MAX_CAPTURE_OUTPUT_BYTES,
  SEMANTIC_PROJECTION_METHOD,
  SHADOW_CAPTURE_QUALIFICATION_SCHEMA,
  SHADOW_CAPTURE_SCHEMA,
} from './shadow-capture-contract-v1.mjs';
import {
  SVELTE_ARTIFACT_ORACLE_SCHEMA,
  SVELTE_ARTIFACT_ORACLE_VERSION,
} from './svelte-artifact-oracle.mjs';
import { compareShadowResults } from './shadow-comparison-harness.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const WORKER = fileURLToPath(
  new URL('./shadow-capture-worker.mjs', import.meta.url)
);
const CAPTURED_RECORDS = new WeakSet();
const FRAMEWORKS = new Set([
  'react',
  'preact',
  'solid',
  'vue',
  'svelte',
  'angular',
  'lit',
  'vanilla',
  'react-native',
]);
const OPTIMIZATION_LEVELS = new Set(['none', 'basic', 'balanced']);
const SECURITY_REJECTIONS = new Set([
  'E_UNSAFE_SVG_CONTENT',
  'E_INVALID_SVG_XML',
  'E_SVG_INPUT_TOO_LARGE',
  'E_UNSUPPORTED_SVG_ENCODING',
  'E_SVG_XML_LIMIT',
]);

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function safeCode(error) {
  return typeof error?.code === 'string' &&
    /^E_[A-Z0-9_]{1,62}$/u.test(error.code)
    ? error.code
    : 'E_CAPTURE_FAILED';
}

const ORACLE_DIMENSIONS = Object.freeze([
  'text',
  'namespaces',
  'attributes',
  'references',
  'accessibility',
  'geometry',
]);
const COVERAGE_STATES = new Set(['complete', 'partial', 'unresolved']);
const VALIDITY_STATES = new Set(['valid', 'invalid', 'unresolved']);

function expectedCoverageStatus(coverage) {
  const states = ORACLE_DIMENSIONS.map(dimension => coverage[dimension]);
  if (states.every(state => state === 'complete')) return 'complete';
  if (states.every(state => state === 'unresolved')) return 'unresolved';
  return 'partial';
}

function validProjection(projection) {
  return (
    projection !== null &&
    typeof projection === 'object' &&
    !Array.isArray(projection) &&
    Object.keys(projection).sort().join(',') ===
      [
        'accessibility',
        'attributes',
        'geometry',
        'namespaces',
        'references',
        'text',
      ]
        .sort()
        .join(',') &&
    Array.isArray(projection.text) &&
    Array.isArray(projection.namespaces) &&
    Array.isArray(projection.attributes) &&
    projection.references !== null &&
    typeof projection.references === 'object' &&
    Array.isArray(projection.references.ids) &&
    Array.isArray(projection.references.occurrences) &&
    projection.accessibility !== null &&
    typeof projection.accessibility === 'object' &&
    Array.isArray(projection.accessibility.attributes) &&
    Array.isArray(projection.accessibility.titles) &&
    Array.isArray(projection.accessibility.descriptions) &&
    Array.isArray(projection.accessibility.idrefs) &&
    projection.geometry !== null &&
    typeof projection.geometry === 'object' &&
    !Array.isArray(projection.geometry) &&
    ['viewBox', 'width', 'height'].every(
      key =>
        projection.geometry[key] === null ||
        typeof projection.geometry[key] === 'string'
    )
  );
}

/** Validate state-machine and projection invariants before trusting oracle output. */
export function validateOracleAnalysis(evidence, expectedSchema = null) {
  if (
    !evidence ||
    typeof evidence !== 'object' ||
    (expectedSchema !== null && evidence.schemaVersion !== expectedSchema) ||
    !evidence.coverage ||
    typeof evidence.coverage !== 'object' ||
    Object.keys(evidence.coverage).length !== ORACLE_DIMENSIONS.length ||
    !ORACLE_DIMENSIONS.every(dimension =>
      COVERAGE_STATES.has(evidence.coverage[dimension])
    ) ||
    !VALIDITY_STATES.has(evidence.validity?.status) ||
    !Array.isArray(evidence.validity?.issues) ||
    !['complete', 'partial', 'invalid'].includes(evidence.analysisStatus) ||
    evidence.status !== evidence.analysisStatus ||
    !['complete', 'partial', 'unresolved'].includes(evidence.coverageStatus)
  ) {
    return {
      valid: false,
      code:
        expectedSchema !== null && evidence?.schemaVersion !== expectedSchema
          ? 'analysis-schema-incompatible'
          : 'analysis-state-invalid',
    };
  }
  const coverageStatus = expectedCoverageStatus(evidence.coverage);
  if (evidence.coverageStatus !== coverageStatus) {
    return { valid: false, code: 'analysis-coverage-contradictory' };
  }
  if (
    evidence.analysisStatus === 'invalid' ||
    (evidence.projection === null && evidence.coverageStatus === 'unresolved')
  ) {
    const invalidIssues = evidence.validity.issues.every(
      issue =>
        issue &&
        typeof issue === 'object' &&
        typeof issue.code === 'string' &&
        /^E_[A-Z0-9_]{1,62}$/u.test(issue.code) &&
        ['invalid', 'unresolved'].includes(issue.state)
    );
    const sortedIssueCodes = invalidIssues
      ? evidence.validity.issues
          .map(issue => issue.code)
          .sort((left, right) => left.localeCompare(right, 'en'))
      : [];
    const allUnresolved = ORACLE_DIMENSIONS.every(
      dimension => evidence.coverage[dimension] === 'unresolved'
    );
    if (
      !invalidIssues ||
      new Set(sortedIssueCodes).size !== sortedIssueCodes.length ||
      sortedIssueCodes.some(
        (code, index) => code !== evidence.validity.issues[index]?.code
      ) ||
      !allUnresolved ||
      evidence.coverageStatus !== 'unresolved' ||
      evidence.projection !== null ||
      evidence.validity.status !== 'unresolved' ||
      evidence.projectionSha256 !== null
    ) {
      return { valid: false, code: 'analysis-invalid-state-contradictory' };
    }
    return { valid: true, code: null };
  }
  if (!validProjection(evidence.projection)) {
    return { valid: false, code: 'analysis-projection-invalid' };
  }
  let projectionDigest;
  try {
    projectionDigest = digestStaticProjection(evidence.projection);
  } catch {
    return { valid: false, code: 'analysis-projection-invalid' };
  }
  if (
    typeof evidence.projectionSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(evidence.projectionSha256) ||
    evidence.projectionSha256 !== projectionDigest
  ) {
    return { valid: false, code: 'analysis-projection-digest-invalid' };
  }
  const issuesValid = evidence.validity.issues.every(
    issue =>
      issue &&
      typeof issue === 'object' &&
      typeof issue.code === 'string' &&
      /^E_[A-Z0-9_]{1,62}$/u.test(issue.code) &&
      ['invalid', 'unresolved'].includes(issue.state)
  );
  if (!issuesValid)
    return { valid: false, code: 'analysis-validity-issues-invalid' };
  const sortedIssueCodes = evidence.validity.issues
    .map(issue => issue.code)
    .slice()
    .sort((left, right) => left.localeCompare(right, 'en'));
  if (
    new Set(sortedIssueCodes).size !== sortedIssueCodes.length ||
    sortedIssueCodes.some(
      (code, index) => code !== evidence.validity.issues[index]?.code
    )
  ) {
    return { valid: false, code: 'analysis-validity-issues-invalid' };
  }
  const hasInvalidIssue = evidence.validity.issues.some(
    issue => issue.state === 'invalid'
  );
  const hasUnresolvedIssue = evidence.validity.issues.some(
    issue => issue.state === 'unresolved'
  );
  if (
    (evidence.validity.status === 'valid' &&
      (evidence.coverageStatus !== 'complete' ||
        evidence.validity.issues.length > 0)) ||
    (evidence.validity.status === 'invalid' && !hasInvalidIssue) ||
    (evidence.validity.status === 'unresolved' &&
      !hasUnresolvedIssue &&
      evidence.coverageStatus === 'complete')
  ) {
    return { valid: false, code: 'analysis-validity-contradictory' };
  }
  return { valid: true, code: null };
}

function validateFixture({ fixtureId, componentName, source, options }) {
  if (
    typeof fixtureId !== 'string' ||
    !/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(fixtureId) ||
    typeof componentName !== 'string' ||
    !/^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/u.test(componentName) ||
    typeof source !== 'string' ||
    Buffer.byteLength(source, 'utf8') > MAX_CAPTURE_INPUT_BYTES ||
    !options ||
    !FRAMEWORKS.has(options.framework) ||
    typeof options.typescript !== 'boolean' ||
    !OPTIMIZATION_LEVELS.has(options.optimizationLevel ?? 'none')
  )
    throw new TypeError('capture fixture is invalid or exceeds its bound');
}

function deriveSemanticEvidence(source, sourceSha256) {
  try {
    const { source: contractSource, document } =
      parseSourceToXmlDocument(source);
    const ir = lowerXmlDocumentToIR(contractSource, document, {
      sourceId: sourceSha256,
      ownership: 'copy',
    });
    const sourceAnalysis = analyzeStaticSvgSource(ir);
    return {
      status: 'derived',
      method: SEMANTIC_PROJECTION_METHOD,
      sourceSha256,
      oracleSchema: STATIC_SVG_SOURCE_ORACLE_SCHEMA,
      grammar: STATIC_SVG_GRAMMAR,
      analysisStatus: sourceAnalysis.status,
      coverageStatus: sourceAnalysis.coverageStatus,
      coverage: sourceAnalysis.coverage,
      validity: sourceAnalysis.validity,
      projectionSha256: sourceAnalysis.projectionSha256,
      projection: sourceAnalysis.projection,
      diagnosticCodes: sourceAnalysis.diagnosticCodes,
    };
  } catch {
    return {
      status: 'unverified',
      method: SEMANTIC_PROJECTION_METHOD,
      sourceSha256,
      coverage: {
        text: 'unverified',
        namespaces: 'unverified',
        attributes: 'unverified',
        references: 'unverified',
        accessibility: 'unverified',
        geometry: 'unverified',
      },
      coverageStatus: 'unresolved',
      validity: {
        status: 'unresolved',
        issues: [{ code: 'E_SOURCE_ANALYSIS_FAILED', state: 'unresolved' }],
      },
      projectionSha256: null,
      projection: null,
    };
  }
}

async function javascriptFiles(directory, prefix = '') {
  const files = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) =>
    a.name.localeCompare(b.name, 'en')
  )) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory())
      files.push(...(await javascriptFiles(absolute, relative)));
    else if (entry.isFile() && entry.name.endsWith('.js'))
      files.push({ relative, absolute });
  }
  return files;
}

async function compilerIdentity() {
  const hash = createHash('sha256');
  for (const file of await javascriptFiles(path.join(ROOT, 'dist'))) {
    hash
      .update(file.relative)
      .update('\0')
      .update(await fs.readFile(file.absolute))
      .update('\0');
  }
  let sourceRevision = 'unavailable';
  try {
    sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    /* exact compiled-tree digest remains available */
  }
  const pkg = JSON.parse(
    await fs.readFile(path.join(ROOT, 'package.json'), 'utf8')
  );
  return {
    name: 'svger-cli-legacy-generator',
    packageVersion: pkg.version,
    sourceRevision,
    implementationSha256: hash.digest('hex'),
  };
}

async function snapshotRoot(root) {
  const records = [];
  let totalBytes = 0;
  const visit = async (absolute, relative) => {
    if (records.length >= 10_000) throw new Error('guard entry limit');
    const stat = await fs.lstat(absolute);
    const base = {
      relative,
      mode: stat.mode,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      dev: stat.dev,
      ino: stat.ino,
    };
    if (stat.isSymbolicLink()) {
      records.push({ ...base, target: await fs.readlink(absolute) });
      return;
    }
    if (stat.isDirectory()) {
      records.push({ ...base, type: 'directory' });
      for (const child of (await fs.readdir(absolute)).sort((a, b) =>
        a.localeCompare(b, 'en')
      )) {
        await visit(
          path.join(absolute, child),
          path.posix.join(relative, child)
        );
      }
      return;
    }
    if (!stat.isFile()) {
      records.push({ ...base, type: 'other' });
      return;
    }
    totalBytes += stat.size;
    if (totalBytes > 256 * 1024 * 1024) throw new Error('guard byte limit');
    records.push({
      ...base,
      type: 'file',
      sha256: digest(await fs.readFile(absolute)),
    });
  };
  try {
    await visit(root, '.');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    records.push({ relative: '.', type: 'missing' });
  }
  return records;
}

async function snapshotGuards(guardPaths) {
  if (
    !Array.isArray(guardPaths) ||
    guardPaths.length > 8 ||
    guardPaths.some(root => typeof root !== 'string' || !path.isAbsolute(root))
  ) {
    throw new TypeError('guard paths must be a bounded list of absolute paths');
  }
  const roots = [...new Set(guardPaths)].sort((a, b) =>
    a.localeCompare(b, 'en')
  );
  const snapshots = [];
  for (const root of roots)
    snapshots.push({
      rootSha256: digest(root),
      entries: await snapshotRoot(root),
    });
  return digest(JSON.stringify(snapshots));
}

function runWorker(request, { timeoutMs, workspace }) {
  return new Promise(resolve => {
    let settled = false;
    let overflow = false;
    let timedOut = false;
    let stdout = '';
    let stderrBytes = 0;
    const child = spawn(
      process.execPath,
      ['--max-old-space-size=192', WORKER],
      {
        cwd: workspace,
        env: {
          PATH: process.env.PATH ?? '',
          NODE_NO_WARNINGS: '1',
          HOME: workspace,
          TMPDIR: workspace,
          TEMP: workspace,
          TMP: workspace,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (Buffer.byteLength(stdout, 'utf8') > MAX_CAPTURE_OUTPUT_BYTES) {
        overflow = true;
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', chunk => {
      stderrBytes += Buffer.byteLength(chunk);
      if (stderrBytes > 64 * 1024) child.kill('SIGKILL');
    });
    child.stdin.on('error', () => undefined);
    child.on('error', () =>
      finish({ outcome: 'failed', code: 'E_CAPTURE_WORKER' })
    );
    child.on('close', code => {
      if (timedOut)
        return finish({ outcome: 'timeout', code: 'E_CAPTURE_TIMEOUT' });
      if (overflow)
        return finish({ outcome: 'failed', code: 'E_CAPTURE_OUTPUT_LIMIT' });
      if (code !== 0)
        return finish({ outcome: 'failed', code: 'E_CAPTURE_WORKER' });
      try {
        finish({ outcome: 'complete', payload: JSON.parse(stdout) });
      } catch {
        finish({ outcome: 'failed', code: 'E_CAPTURE_PROTOCOL' });
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

async function executeWorker(request, { timeoutMs, guardPaths }) {
  if (
    Buffer.byteLength(JSON.stringify(request), 'utf8') >
    MAX_CAPTURE_INPUT_BYTES + MAX_CAPTURE_ARTIFACT_BYTES + 4096
  ) {
    return {
      outcome: 'failed',
      code: 'E_CAPTURE_INPUT_LIMIT',
      guardStatus: 'unavailable',
      workspaceStatus: 'unavailable',
    };
  }
  const before = await snapshotGuards(guardPaths);
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'svger-shadow-capture-')
  );
  try {
    const result = await runWorker(request, { timeoutMs, workspace });
    const clean = (await fs.readdir(workspace)).length === 0;
    const after = await snapshotGuards(guardPaths);
    return {
      ...result,
      timeoutEnforced: true,
      guardStatus: before === after ? 'unchanged' : 'mutated',
      workspaceStatus: clean ? 'clean' : 'mutated',
      guardSha256: after,
    };
  } catch {
    const after = await snapshotGuards(guardPaths).catch(() => null);
    return {
      outcome: 'failed',
      code: 'E_CAPTURE_GUARD',
      guardStatus: before === after ? 'unchanged' : 'unavailable',
      workspaceStatus: 'unavailable',
      guardSha256: after,
    };
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

function extensionFor(framework, typescript) {
  if (framework === 'vue') return 'vue';
  if (framework === 'svelte') return 'svelte';
  if (framework === 'angular') return 'ts';
  if (framework === 'lit' || framework === 'vanilla')
    return typescript ? 'ts' : 'js';
  return typescript ? 'tsx' : 'jsx';
}

async function validateNativeOutput(
  framework,
  artifact,
  guardPaths = [],
  typescript = false
) {
  if (framework !== 'svelte')
    return {
      status: 'not-checked',
      compiler: null,
      origin: 'no-qualified-native-compiler-runner',
      diagnosticCodes: [],
    };
  if (typescript)
    return {
      status: 'not-checked',
      compiler: null,
      origin: 'svelte-typescript-preprocessor-not-qualified',
      diagnosticCodes: [],
    };
  const result = await executeWorker(
    {
      kind: 'validate-svelte',
      filename: artifact.path,
      content: artifact.content,
    },
    {
      timeoutMs: DEFAULT_CAPTURE_TIMEOUT_MS,
      guardPaths,
    }
  );
  if (result.outcome !== 'complete')
    return {
      status: result.outcome === 'timeout' ? 'not-checked' : 'invalid',
      compiler: { name: 'svelte', version: 'unavailable' },
      origin: 'bounded-native-compiler-subprocess',
      diagnosticCodes: [result.code],
      timeoutEnforced: true,
      workerWorkspaceStatus: result.workspaceStatus,
      workerGuardStatus: result.guardStatus,
    };
  return {
    ...result.payload,
    origin: 'bounded-native-compiler-subprocess',
    timeoutEnforced: true,
    workerWorkspaceStatus: result.workspaceStatus,
    workerGuardStatus: result.guardStatus,
  };
}

function makeRecord({
  fixture,
  role,
  origin,
  compiler,
  semanticEvidence,
  result,
  artifacts,
  frameworkValidation,
}) {
  const record = {
    schemaVersion: SHADOW_CAPTURE_SCHEMA,
    captureId: randomUUID(),
    fixture: {
      id: fixture.fixtureId,
      sourceSha256: digest(Buffer.from(fixture.source, 'utf8')),
      sourceUtf8Bytes: Buffer.byteLength(fixture.source, 'utf8'),
    },
    role,
    origin,
    compiler,
    captureEnvironment: {
      runtime: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    generationRuntime: role === 'legacy' ? process.version : null,
    effectiveOptions: {
      framework: fixture.options.framework,
      typescript: fixture.options.typescript,
      optimizationLevel: fixture.options.optimizationLevel ?? 'none',
    },
    outcome: result.outcome,
    outcomeCode: result.code ?? null,
    security: result.security ?? { decision: 'accepted', code: null },
    artifacts,
    semanticEvidence,
    artifactSemanticEvidence: frameworkValidation.artifactAnalysis ?? null,
    frameworkValidation,
    outputEvidence: {
      origin,
      generated: origin === 'legacy-in-memory-generator',
      supplied: origin === 'supplied-captured-fixture',
      compiled:
        frameworkValidation.origin === 'bounded-native-compiler-subprocess' &&
        ['valid', 'invalid'].includes(frameworkValidation.status),
      executed: false,
    },
    isolation: {
      generationProcess:
        role === 'legacy' &&
        result.processMode !== 'not-started-security-rejection'
          ? 'bounded-node-child-process'
          : 'not-run',
      nativeValidationProcess:
        frameworkValidation.origin === 'bounded-native-compiler-subprocess'
          ? 'bounded-node-child-process'
          : 'not-run',
      timeoutEnforced: result.timeoutEnforced ?? false,
      heapCeilingMiB: 192,
      workspace: result.workspaceStatus ?? 'not-used',
      guardStatus: result.guardStatus ?? 'not-used',
      filesystemSandbox: false,
      guardSha256: result.guardSha256 ?? null,
    },
  };
  CAPTURED_RECORDS.add(record);
  return freezeDeep(record);
}

async function admission(fixture) {
  const sourceSha256 = digest(Buffer.from(fixture.source, 'utf8'));
  try {
    applySVGInputSafety(fixture.source, { unsafeInputPolicy: 'reject' });
    return {
      sourceSha256,
      security: { decision: 'accepted', code: null },
      semanticEvidence: deriveSemanticEvidence(fixture.source, sourceSha256),
    };
  } catch (error) {
    const code = safeCode(error);
    if (!SECURITY_REJECTIONS.has(code)) throw error;
    return {
      sourceSha256,
      security: { decision: 'rejected', code },
      semanticEvidence: deriveSemanticEvidence('', sourceSha256),
    };
  }
}

/** Capture one real legacy generation run using the in-memory processor API. */
export async function captureLegacyRun(
  fixture,
  { timeoutMs = DEFAULT_CAPTURE_TIMEOUT_MS, guardPaths = [] } = {}
) {
  validateFixture(fixture);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000)
    throw new TypeError('capture timeout must be between 1 and 120000 ms');
  const admitted = await admission(fixture);
  const compiler = await compilerIdentity();
  if (admitted.security.decision === 'rejected') {
    return makeRecord({
      fixture,
      role: 'legacy',
      origin: 'legacy-in-memory-generator',
      compiler,
      semanticEvidence: admitted.semanticEvidence,
      result: {
        outcome: 'complete',
        security: admitted.security,
        processMode: 'not-started-security-rejection',
      },
      artifacts: [],
      frameworkValidation: {
        status: 'not-checked',
        compiler: null,
        origin: 'not-run',
        diagnosticCodes: [],
      },
    });
  }
  const guardBefore = await snapshotGuards(guardPaths);
  const result = await executeWorker(
    {
      kind: 'generate-legacy',
      componentName: fixture.componentName,
      source: fixture.source,
      options: {
        framework: fixture.options.framework,
        typescript: fixture.options.typescript,
        optimizationLevel: fixture.options.optimizationLevel ?? 'none',
      },
    },
    { timeoutMs, guardPaths }
  );
  let artifacts = [];
  let frameworkValidation = {
    status: 'not-checked',
    compiler: null,
    origin: 'no-qualified-native-compiler-runner',
    diagnosticCodes: [],
  };
  if (
    result.outcome === 'complete' &&
    typeof result.payload?.content === 'string'
  ) {
    const artifact = {
      path: `${fixture.componentName}.${extensionFor(fixture.options.framework, fixture.options.typescript)}`,
      content: result.payload.content,
    };
    if (
      Buffer.byteLength(artifact.content, 'utf8') > MAX_CAPTURE_ARTIFACT_BYTES
    ) {
      result.outcome = 'failed';
      result.code = 'E_CAPTURE_ARTIFACT_LIMIT';
    } else {
      artifacts = [artifact];
      frameworkValidation = await validateNativeOutput(
        fixture.options.framework,
        artifact,
        guardPaths,
        fixture.options.typescript
      );
      if (frameworkValidation.workerWorkspaceStatus === 'mutated') {
        result.workspaceStatus = 'mutated';
      }
      if (frameworkValidation.workerGuardStatus === 'mutated') {
        result.guardStatus = 'mutated';
      }
    }
  }
  const guardAfter = await snapshotGuards(guardPaths);
  if (guardBefore !== guardAfter) result.guardStatus = 'mutated';
  else if (result.guardStatus === undefined) result.guardStatus = 'unchanged';
  return makeRecord({
    fixture,
    role: 'legacy',
    origin: 'legacy-in-memory-generator',
    compiler,
    semanticEvidence: admitted.semanticEvidence,
    result: { ...result, security: admitted.security },
    artifacts,
    frameworkValidation,
  });
}

/** Capture a candidate artifact supplied by a fixture; it is never generated here. */
export async function captureCandidateFixture(
  fixture,
  candidateArtifact,
  { guardPaths = [] } = {}
) {
  validateFixture(fixture);
  if (candidateArtifact === null) {
    const admitted = await admission(fixture);
    const guardSha256 = await snapshotGuards(guardPaths);
    return makeRecord({
      fixture,
      role: 'candidate',
      origin: 'supplied-captured-fixture',
      compiler: {
        name: 'not-asserted-supplied-candidate-fixture',
        packageVersion: null,
        sourceRevision: null,
        implementationSha256: null,
      },
      semanticEvidence: admitted.semanticEvidence,
      result: {
        outcome: 'complete',
        security: admitted.security,
        processMode: 'no-candidate-output-captured',
        guardStatus: 'unchanged',
        guardSha256,
        workspaceStatus: 'not-used',
      },
      artifacts: [],
      frameworkValidation: {
        status: 'not-checked',
        compiler: null,
        origin: 'candidate-output-missing',
        diagnosticCodes: ['E_MISSING_OUTPUT'],
      },
    });
  }
  if (
    !candidateArtifact ||
    typeof candidateArtifact.path !== 'string' ||
    !/^[A-Za-z0-9._/-]{1,160}$/u.test(candidateArtifact.path) ||
    candidateArtifact.path.startsWith('/') ||
    candidateArtifact.path.split('/').includes('..') ||
    candidateArtifact.path.split('/').includes('') ||
    typeof candidateArtifact.content !== 'string' ||
    Buffer.byteLength(candidateArtifact.content, 'utf8') >
      MAX_CAPTURE_ARTIFACT_BYTES
  ) {
    throw new TypeError(
      'candidate artifact fixture is invalid or exceeds its bound'
    );
  }
  const admitted = await admission(fixture);
  const compiler = {
    name: 'not-asserted-supplied-candidate-fixture',
    packageVersion: null,
    sourceRevision: null,
    implementationSha256: null,
  };
  const artifact = {
    path: candidateArtifact.path,
    content: candidateArtifact.content,
  };
  const before = await snapshotGuards(guardPaths);
  const frameworkValidation = await validateNativeOutput(
    fixture.options.framework,
    artifact,
    guardPaths,
    fixture.options.typescript
  );
  const after = await snapshotGuards(guardPaths);
  return makeRecord({
    fixture,
    role: 'candidate',
    origin: 'supplied-captured-fixture',
    compiler,
    semanticEvidence: admitted.semanticEvidence,
    result: {
      outcome: 'complete',
      security: admitted.security,
      guardStatus: before === after ? 'unchanged' : 'mutated',
      workspaceStatus: frameworkValidation.workerWorkspaceStatus ?? 'not-used',
      timeoutEnforced: frameworkValidation.timeoutEnforced ?? false,
    },
    artifacts: [artifact],
    frameworkValidation,
  });
}

function evidenceFailures(record, fixture) {
  const issues = [];
  if (
    !record ||
    !CAPTURED_RECORDS.has(record) ||
    record.schemaVersion !== SHADOW_CAPTURE_SCHEMA
  )
    return ['capture-provenance-invalid'];
  if (
    record.fixture.id !== fixture.fixtureId ||
    record.fixture.sourceSha256 !== digest(Buffer.from(fixture.source, 'utf8'))
  )
    issues.push('fixture-identity-mismatch');
  if (
    JSON.stringify(record.effectiveOptions) !==
    JSON.stringify({
      framework: fixture.options.framework,
      typescript: fixture.options.typescript,
      optimizationLevel: fixture.options.optimizationLevel ?? 'none',
    })
  )
    issues.push('fixture-identity-mismatch');
  if (record.outcome === 'timeout') issues.push('capture-timeout');
  if (record.outcome !== 'complete') issues.push('capture-failed');
  if (
    record.isolation.guardStatus === 'mutated' ||
    record.isolation.guardStatus === 'unavailable'
  )
    issues.push('unauthorized-write');
  if (record.isolation.workspace === 'mutated')
    issues.push('capture-workspace-mutated');
  if (
    record.frameworkValidation.status === 'not-checked' &&
    record.frameworkValidation.diagnosticCodes?.includes('E_CAPTURE_TIMEOUT')
  ) {
    issues.push('framework-validation-timeout');
  }
  const evidence = record.semanticEvidence;
  if (
    evidence.status !== 'derived' ||
    evidence.sourceSha256 !== record.fixture.sourceSha256 ||
    evidence.method !== SEMANTIC_PROJECTION_METHOD ||
    !evidence.projection ||
    Object.values(evidence.coverage).some(value => value !== 'complete')
  )
    issues.push('semantic-evidence-unverified');
  const sourceIntegrity = validateOracleAnalysis(
    {
      ...evidence,
      schemaVersion: evidence.oracleSchema,
      status: evidence.analysisStatus,
    },
    STATIC_SVG_SOURCE_ORACLE_SCHEMA
  );
  if (!sourceIntegrity.valid) {
    issues.push(
      sourceIntegrity.code === 'analysis-schema-incompatible'
        ? 'oracle-schema-incompatible'
        : 'oracle-evidence-invalid'
    );
  }
  if (evidence.validity?.status !== 'valid')
    issues.push('semantic-validity-not-valid');
  if (
    record.frameworkValidation.status === 'not-checked' ||
    record.frameworkValidation.origin !==
      'bounded-native-compiler-subprocess' ||
    typeof record.frameworkValidation.compiler?.name !== 'string' ||
    typeof record.frameworkValidation.compiler?.version !== 'string'
  ) {
    issues.push('framework-validation-unverified');
  } else if (record.frameworkValidation.status === 'invalid')
    issues.push('framework-validation-failed');
  return issues;
}

const ARTIFACT_ORACLE_DIMENSIONS = [
  'text',
  'namespaces',
  'attributes',
  'references',
  'accessibility',
  'geometry',
];
const ARTIFACT_MISMATCH_CODES = {
  text: 'text-content-change',
  namespaces: 'namespace-change',
  attributes: 'attribute-change',
  references: 'reference-change',
  accessibility: 'accessibility-change',
  geometry: 'geometry-change',
};

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function artifactEvidenceFailures(record) {
  const evidence = record?.artifactSemanticEvidence;
  const artifact = record?.artifacts?.[0];
  if (!evidence || !artifact) return ['artifact-analysis-unavailable'];
  if (
    !Array.isArray(record.artifacts) ||
    record.artifacts.length !== 1 ||
    typeof artifact.path !== 'string' ||
    typeof artifact.content !== 'string'
  )
    return ['artifact-analysis-provenance-invalid'];
  if (evidence.schemaVersion !== SVELTE_ARTIFACT_ORACLE_SCHEMA)
    return ['artifact-analysis-schema-incompatible'];
  const analysisIntegrity = validateOracleAnalysis(
    evidence,
    SVELTE_ARTIFACT_ORACLE_SCHEMA
  );
  if (!analysisIntegrity.valid) return ['oracle-evidence-invalid'];
  if (
    record.effectiveOptions?.framework !== 'svelte' ||
    record.effectiveOptions?.typescript !== false ||
    evidence.artifactSha256 !== digest(Buffer.from(artifact.content, 'utf8')) ||
    evidence.artifactPathSha256 !== digest(artifact.path) ||
    evidence.analyzer?.name !== 'svelte-static-svg-artifact-oracle' ||
    evidence.analyzer?.version !== SVELTE_ARTIFACT_ORACLE_VERSION ||
    evidence.analyzer?.parser !== 'svelte/compiler' ||
    typeof evidence.analyzer?.parserVersion !== 'string' ||
    evidence.analyzer.parserVersion !==
      record.frameworkValidation?.compiler?.version ||
    evidence.scope?.kind !== 'static-svg-markup-projection' ||
    evidence.scope?.grammarSchema !== STATIC_SVG_SOURCE_ORACLE_SCHEMA ||
    evidence.scope?.runtimeEquivalence !== false ||
    evidence.scope?.accessibleNameComputation !== false ||
    evidence.scope?.browserResourceResolution !== false
  ) {
    return ['artifact-analysis-provenance-invalid'];
  }
  if (evidence.status === 'invalid' || !evidence.projection)
    return ['artifact-analysis-invalid'];
  return [];
}

function compareOracleDimension(
  fromProjection,
  fromCoverage,
  toProjection,
  toCoverage,
  dimension
) {
  const left = fromProjection?.[dimension];
  const right = toProjection?.[dimension];
  const leftCoverage = fromCoverage?.[dimension] ?? 'unresolved';
  const rightCoverage = toCoverage?.[dimension] ?? 'unresolved';
  const coverageComplete =
    left !== undefined &&
    right !== undefined &&
    leftCoverage === 'complete' &&
    rightCoverage === 'complete';
  const leftSha256 = left === undefined ? null : digest(stableJson(left));
  const rightSha256 = right === undefined ? null : digest(stableJson(right));
  const changed =
    leftSha256 !== null && rightSha256 !== null && leftSha256 !== rightSha256;
  return {
    status: changed ? 'mismatch' : coverageComplete ? 'match' : 'partial',
    fromCoverage: leftCoverage,
    toCoverage: rightCoverage,
    fromSha256: leftSha256,
    toSha256: rightSha256,
    blocking: changed || !coverageComplete,
    mismatchCode: changed
      ? ARTIFACT_MISMATCH_CODES[dimension]
      : coverageComplete
        ? null
        : 'artifact-semantic-coverage-incomplete',
  };
}

function compareOracleEdge(from, to) {
  const dimensions = Object.fromEntries(
    ARTIFACT_ORACLE_DIMENSIONS.map(dimension => [
      dimension,
      compareOracleDimension(
        from?.projection,
        from?.coverage,
        to?.projection,
        to?.coverage,
        dimension
      ),
    ])
  );
  const mismatchCodes = [
    ...new Set(
      Object.values(dimensions)
        .map(dimension => dimension.mismatchCode)
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, 'en'));
  const fromValidity = from?.validity?.status ?? 'unresolved';
  const toValidity = to?.validity?.status ?? 'unresolved';
  const validityStatus =
    fromValidity === 'invalid' || toValidity === 'invalid'
      ? 'invalid'
      : fromValidity === 'unresolved' || toValidity === 'unresolved'
        ? 'unresolved'
        : 'valid';
  const dimensionsMatch = Object.values(dimensions).every(
    dimension => dimension.status === 'match'
  );
  const dimensionMismatch = Object.values(dimensions).some(
    dimension => dimension.status === 'mismatch'
  );
  const outcome =
    dimensionMismatch || validityStatus === 'invalid'
      ? 'mismatch'
      : dimensionsMatch && validityStatus === 'valid'
        ? 'match'
        : 'inconclusive';
  if (validityStatus !== 'valid')
    mismatchCodes.push(`semantic-validity-${validityStatus}`);
  return {
    dimensions,
    validity: {
      from: fromValidity,
      to: toValidity,
      status: validityStatus,
      blocking: validityStatus !== 'valid',
    },
    outcome,
    mismatchCodes: [...new Set(mismatchCodes)].sort((a, b) =>
      a.localeCompare(b, 'en')
    ),
    blockingMismatchCount: Object.values(dimensions).filter(
      dimension => dimension.blocking
    ).length,
    blockingValidityCount: validityStatus === 'valid' ? 0 : 1,
  };
}

function compareSvelteArtifactOracle(legacyRuns, candidateRuns) {
  const records = [...legacyRuns, ...candidateRuns];
  const failures = new Set(['promotion-not-authorized']);
  for (const record of records) {
    for (const code of artifactEvidenceFailures(record)) failures.add(code);
  }
  const artifactAnalyses = records
    .map(record => record?.artifactSemanticEvidence)
    .filter(evidence => evidence?.projection);
  for (const samples of [legacyRuns, candidateRuns]) {
    const fingerprints = new Set(
      samples
        .map(record => record?.artifactSemanticEvidence)
        .filter(evidence => evidence?.projection)
        .map(evidence =>
          digest(
            stableJson({
              artifactSha256: evidence.artifactSha256,
              coverage: evidence.coverage,
              validity: evidence.validity,
              projection: evidence.projection,
            })
          )
        )
    );
    if (fingerprints.size > 1)
      failures.add('artifact-analysis-nondeterministic');
  }

  const sourceEvidence = records[0]?.semanticEvidence;
  const source =
    sourceEvidence?.status === 'derived' &&
    sourceEvidence?.oracleSchema === STATIC_SVG_SOURCE_ORACLE_SCHEMA &&
    sourceEvidence?.grammar?.schemaVersion === STATIC_SVG_SOURCE_ORACLE_SCHEMA
      ? {
          projection: sourceEvidence.projection,
          coverage: sourceEvidence.coverage,
          validity: sourceEvidence.validity,
        }
      : null;
  if (source === null) failures.add('semantic-evidence-unverified');
  const legacy = legacyRuns[0]?.artifactSemanticEvidence ?? null;
  const candidate = candidateRuns[0]?.artifactSemanticEvidence ?? null;
  const sourceToLegacy = compareOracleEdge(source, legacy);
  const sourceToCandidate = compareOracleEdge(source, candidate);
  const legacyToCandidate = compareOracleEdge(legacy, candidate);
  const edges = { sourceToLegacy, sourceToCandidate, legacyToCandidate };
  if (
    [source, legacy, candidate].some(
      evidence => evidence?.validity?.status !== 'valid'
    )
  ) {
    failures.add('artifact-semantic-validity-not-valid');
  }
  const mismatchCodes = [
    ...new Set([
      ...Object.values(edges).flatMap(edge => edge.mismatchCodes),
      ...failures,
    ]),
  ].sort((a, b) => a.localeCompare(b, 'en'));
  const blockingMismatchCount = Object.values(edges).reduce(
    (total, edge) => total + edge.blockingMismatchCount,
    0
  );
  const blockingValidityCount = Object.values(edges).reduce(
    (total, edge) => total + edge.blockingValidityCount,
    0
  );
  if (blockingMismatchCount > 0)
    failures.add('artifact-semantic-coverage-incomplete');
  if (
    Object.values(edges).some(edge =>
      Object.values(edge.dimensions).some(
        dimension => dimension.status === 'mismatch'
      )
    )
  ) {
    failures.add('artifact-semantic-mismatch');
  }
  return {
    schemaVersion: 'svger-three-way-artifact-oracle-v4',
    outcome: Object.values(edges).some(edge => edge.outcome === 'mismatch')
      ? 'mismatch'
      : Object.values(edges).every(edge => edge.outcome === 'match')
        ? 'match'
        : 'inconclusive',
    validity: {
      source: source?.validity ?? null,
      legacy: legacy?.validity ?? null,
      candidate: candidate?.validity ?? null,
    },
    sourceOracle: {
      schemaVersion: STATIC_SVG_SOURCE_ORACLE_SCHEMA,
      grammar: STATIC_SVG_GRAMMAR,
    },
    artifactOracleScope: artifactAnalyses[0]?.scope ?? {
      kind: 'static-svg-markup-projection',
      grammarSchema: STATIC_SVG_SOURCE_ORACLE_SCHEMA,
      runtimeEquivalence: false,
      accessibleNameComputation: false,
      browserResourceResolution: false,
    },
    analyzer: artifactAnalyses[0]?.analyzer ?? null,
    artifactDigests: {
      source: sourceEvidence?.sourceSha256 ?? null,
      legacy: legacy?.artifactSha256 ?? null,
      candidate: candidate?.artifactSha256 ?? null,
    },
    artifactPathDigests: {
      legacy: legacy?.artifactPathSha256 ?? null,
      candidate: candidate?.artifactPathSha256 ?? null,
    },
    edges,
    blockingMismatchCount,
    blockingValidityCount,
    mismatchCodes: [...new Set([...mismatchCodes, ...failures])].sort((a, b) =>
      a.localeCompare(b, 'en')
    ),
    qualificationFailures: [...failures].sort((a, b) =>
      a.localeCompare(b, 'en')
    ),
  };
}

/** Compare only records created by these capture APIs in this process. */
export function compareQualifiedCaptures({
  fixture,
  legacyRuns,
  candidateRuns,
}) {
  validateFixture(fixture);
  if (!Array.isArray(legacyRuns) || !Array.isArray(candidateRuns))
    throw new TypeError('capture groups must be arrays');
  const invalidRecord = role => ({
    role,
    outcome: 'failed',
    outcomeCode: 'E_CAPTURE_PROVENANCE',
    security: { decision: 'accepted', code: null },
    artifacts: [],
    semanticEvidence: { status: 'unverified', projection: null },
    artifactSemanticEvidence: null,
    frameworkValidation: { status: 'not-checked', compiler: null },
    effectiveOptions: null,
    captureEnvironment: null,
    generationRuntime: null,
    isolation: { guardStatus: 'unavailable', workspace: 'unavailable' },
  });
  const trustedOrFailure = (record, role) =>
    CAPTURED_RECORDS.has(record) &&
    record.schemaVersion === SHADOW_CAPTURE_SCHEMA
      ? record
      : invalidRecord(role);
  const trustedLegacyRuns = legacyRuns.map(record =>
    trustedOrFailure(record, 'legacy')
  );
  const trustedCandidateRuns = candidateRuns.map(record =>
    trustedOrFailure(record, 'candidate')
  );
  const suppliedRecords = [...legacyRuns, ...candidateRuns];
  const issues = suppliedRecords.some(
    record =>
      record &&
      typeof record === 'object' &&
      typeof record.schemaVersion === 'string' &&
      /^svger-shadow-capture-v[0-9]+$/u.test(record.schemaVersion) &&
      record.schemaVersion !== SHADOW_CAPTURE_SCHEMA
  )
    ? ['oracle-schema-incompatible']
    : [];
  const ids = new Set();
  for (const [role, records] of [
    ['legacy', trustedLegacyRuns],
    ['candidate', trustedCandidateRuns],
  ]) {
    if (records.length < 2) issues.push('insufficient-capture-samples');
    for (const record of records) {
      if (record?.role !== role) issues.push('capture-provenance-invalid');
      if (record?.captureId && ids.has(record.captureId))
        issues.push('duplicate-capture-id');
      if (record?.captureId) ids.add(record.captureId);
      issues.push(...evidenceFailures(record, fixture));
    }
    const sideToolchains = new Set(
      records.filter(Boolean).map(record =>
        JSON.stringify({
          captureEnvironment: record.captureEnvironment,
          generationRuntime: record.generationRuntime,
          compiler: record.compiler,
          frameworkCompiler: record.frameworkValidation?.compiler,
          options: record.effectiveOptions,
        })
      )
    );
    if (sideToolchains.size > 1) issues.push('toolchain-mismatch');
  }
  const environments = new Set(
    [...trustedLegacyRuns, ...trustedCandidateRuns]
      .filter(Boolean)
      .map(record => JSON.stringify(record.captureEnvironment))
  );
  if (environments.size > 1) issues.push('toolchain-mismatch');
  const toRun = record => ({
    outcome: record?.outcome ?? 'failed',
    security: record?.security ?? { decision: 'accepted', code: null },
    artifacts: Array.isArray(record?.artifacts) ? record.artifacts : [],
    semantics: record?.semanticEvidence?.projection ?? {
      text: null,
      namespaces: null,
      references: null,
      accessibility: null,
    },
    frameworkValidity: record?.frameworkValidation?.status ?? 'not-checked',
    diagnostics: record?.outcomeCode ? [{ code: record.outcomeCode }] : [],
  });
  const comparison = compareShadowResults([
    {
      fixtureId: fixture.fixtureId,
      context: {
        framework: fixture.options.framework,
        typescript: fixture.options.typescript,
        optimizationLevel: fixture.options.optimizationLevel ?? 'none',
        captureEnvironment: {
          legacy: trustedLegacyRuns.map(record => record.captureEnvironment),
          candidate: trustedCandidateRuns.map(
            record => record.captureEnvironment
          ),
        },
        compilerDigests: {
          legacy: trustedLegacyRuns.map(
            record => record.compiler?.implementationSha256 ?? null
          ),
          candidate: trustedCandidateRuns.map(
            record => record.compiler?.implementationSha256 ?? null
          ),
          framework: [...trustedLegacyRuns, ...trustedCandidateRuns].map(
            record => record.frameworkValidation?.compiler ?? null
          ),
        },
      },
      legacy: { runs: trustedLegacyRuns.map(toRun) },
      candidate: { runs: trustedCandidateRuns.map(toRun) },
    },
  ]);
  const artifactOracle = compareSvelteArtifactOracle(
    trustedLegacyRuns,
    trustedCandidateRuns
  );
  issues.push(...artifactOracle.qualificationFailures);
  const qualificationFailures = [...new Set(issues)].sort((a, b) =>
    a.localeCompare(b, 'en')
  );
  return freezeDeep({
    schemaVersion: SHADOW_CAPTURE_QUALIFICATION_SCHEMA,
    fixtureId: fixture.fixtureId,
    qualificationFailures,
    promotionEligible:
      qualificationFailures.length === 0 &&
      comparison.blockingMismatchCount === 0 &&
      artifactOracle.blockingMismatchCount === 0,
    comparison,
    artifactOracle,
    qualificationCodes: CAPTURE_FAILURE_CODES,
  });
}
