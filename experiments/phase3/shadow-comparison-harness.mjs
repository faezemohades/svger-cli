/**
 * Pure, in-memory comparison of captured legacy/candidate results.
 *
 * This module intentionally accepts data, not generator callbacks, paths,
 * writers, caches, or filesystem handles. It does not persist or apply a
 * comparison report and never returns raw artifact or semantic values.
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  SHADOW_COMPARISON_SCHEMA,
  SHADOW_MINIMUM_RUNS,
  SHADOW_MISMATCH_CODES,
} from './shadow-comparison-contract-v1.mjs';

const OUTCOMES = new Set(['complete', 'timeout', 'failed']);
const SECURITY_DECISIONS = new Set(['accepted', 'rejected']);
const FRAMEWORK_STATES = new Set(['valid', 'invalid', 'not-checked']);
const SEMANTIC_FIELDS = [
  ['text', 'text-content-change'],
  ['namespaces', 'namespace-change'],
  ['references', 'reference-change'],
  ['accessibility', 'accessibility-change'],
];
const DIAGNOSTIC_CODE = /^E_[A-Z0-9_]{1,62}$/u;
const FIXTURE_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const ARTIFACT_PATH = /^[A-Za-z0-9._/-]{1,160}$/u;

function plainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      typeof key === 'string' &&
      descriptor !== undefined &&
      'value' in descriptor
    );
  });
}

function canonicalJson(value, active = new WeakSet(), depth = 0) {
  if (depth > 100) throw new TypeError('value exceeds canonical depth');
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value))
    return JSON.stringify(value);
  if (typeof value !== 'object') throw new TypeError('value is not JSON data');
  if (active.has(value)) throw new TypeError('cyclic data is not supported');
  active.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        if (!Object.hasOwn(value, index)) throw new TypeError('sparse array');
      }
      return `[${value.map(item => canonicalJson(item, active, depth + 1)).join(',')}]`;
    }
    if (!plainRecord(value)) throw new TypeError('value is not a plain record');
    const keys = Object.keys(value).sort();
    return `{${keys
      .map(
        key =>
          `${JSON.stringify(key)}:${canonicalJson(value[key], active, depth + 1)}`
      )
      .join(',')}}`;
  } finally {
    active.delete(value);
  }
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function dataDigest(value) {
  return digest(canonicalJson(value));
}

function safeDiagnosticCode(value) {
  return typeof value === 'string' && DIAGNOSTIC_CODE.test(value)
    ? value
    : 'E_REDACTED';
}

function diagnosticCodes(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.map(item =>
        plainRecord(item) ? safeDiagnosticCode(item.code) : 'E_REDACTED'
      )
    ),
  ].sort();
}

function safeArtifactPath(value) {
  return (
    typeof value === 'string' &&
    ARTIFACT_PATH.test(value) &&
    !value.startsWith('/') &&
    !value.split('/').includes('..') &&
    !value.split('/').includes('')
  );
}

function normalizeArtifacts(value) {
  if (!Array.isArray(value)) throw new TypeError('artifacts must be an array');
  const records = value.map(artifact => {
    if (!plainRecord(artifact) || !safeArtifactPath(artifact.path))
      throw new TypeError('artifact record is invalid');
    let bytes;
    if (typeof artifact.content === 'string') {
      bytes = Buffer.from(artifact.content, 'utf8');
    } else if (artifact.content instanceof Uint8Array) {
      bytes = Buffer.from(artifact.content);
    } else {
      throw new TypeError('artifact content is invalid');
    }
    return {
      path: artifact.path,
      byteLength: bytes.length,
      sha256: digest(bytes),
    };
  });
  records.sort((left, right) => left.path.localeCompare(right.path, 'en'));
  for (let index = 1; index < records.length; index++) {
    if (records[index - 1].path === records[index].path)
      throw new TypeError('artifact paths are duplicated');
  }
  return records;
}

function normalizeRun(input) {
  try {
    if (!plainRecord(input) || !OUTCOMES.has(input.outcome))
      throw new TypeError('run envelope is invalid');
    const codes = diagnosticCodes(input.diagnostics);
    if (input.outcome !== 'complete') {
      const summary = {
        outcome: input.outcome,
        diagnostics: codes,
      };
      return {
        valid: true,
        summary,
        fingerprint: dataDigest(summary),
      };
    }

    if (
      !plainRecord(input.security) ||
      !SECURITY_DECISIONS.has(input.security.decision) ||
      !plainRecord(input.semantics) ||
      !FRAMEWORK_STATES.has(input.frameworkValidity)
    ) {
      throw new TypeError('completed run fields are invalid');
    }
    for (const [field] of SEMANTIC_FIELDS) {
      if (!Object.hasOwn(input.semantics, field))
        throw new TypeError('semantic projection is incomplete');
    }
    const artifacts = normalizeArtifacts(input.artifacts);
    const semantics = Object.fromEntries(
      SEMANTIC_FIELDS.map(([field]) => [
        field,
        dataDigest(input.semantics[field]),
      ])
    );
    const securityCode =
      input.security.code === undefined
        ? null
        : safeDiagnosticCode(input.security.code);
    const summary = {
      outcome: 'complete',
      security: { decision: input.security.decision, code: securityCode },
      artifacts,
      semantics,
      frameworkValidity: input.frameworkValidity,
      diagnostics: codes,
    };
    return {
      valid: true,
      summary,
      fingerprint: dataDigest(summary),
    };
  } catch {
    return {
      valid: false,
      summary: {
        outcome: 'invalid',
        diagnostics: ['E_REDACTED'],
      },
      fingerprint: null,
    };
  }
}

function sideSummary(runs) {
  const normalized = runs.map(normalizeRun);
  const allValid = normalized.every(run => run.valid);
  const distinctFingerprints = new Set(
    normalized.map(run => run.fingerprint).filter(Boolean)
  );
  const deterministic =
    normalized.length >= SHADOW_MINIMUM_RUNS &&
    allValid &&
    distinctFingerprints.size === 1;
  const first = normalized[0]?.summary;
  return {
    runCount: runs.length,
    outcomes: normalized.map(run => run.summary.outcome),
    determinism:
      normalized.length < SHADOW_MINIMUM_RUNS
        ? 'not-sampled'
        : !allValid
          ? 'invalid'
          : deterministic
            ? 'stable'
            : 'unstable',
    securityDecision: first?.security?.decision ?? 'unavailable',
    securityCode: first?.security?.code ?? null,
    frameworkValidity: first?.frameworkValidity ?? 'unavailable',
    artifacts: (first?.artifacts ?? []).map(item => ({
      pathSha256: digest(item.path),
      byteLength: item.byteLength,
      sha256: item.sha256,
    })),
    semantics: first?.semantics ?? null,
    diagnosticCodes: [
      ...new Set(normalized.flatMap(run => run.summary.diagnostics)),
    ].sort(),
  };
}

function addMismatch(
  list,
  code,
  blocking,
  legacyDigest = null,
  candidateDigest = null
) {
  list.push({ code, blocking, legacyDigest, candidateDigest });
}

function compareArtifacts(legacy, candidate, mismatches) {
  const legacyByPath = new Map(legacy.artifacts.map(item => [item.path, item]));
  const candidateByPath = new Map(
    candidate.artifacts.map(item => [item.path, item])
  );
  const paths = [
    ...new Set([...legacyByPath.keys(), ...candidateByPath.keys()]),
  ].sort((left, right) => left.localeCompare(right, 'en'));
  for (const path of paths) {
    const left = legacyByPath.get(path);
    const right = candidateByPath.get(path);
    if (!left || !right) {
      addMismatch(mismatches, 'missing-output', true);
      continue;
    }
    if (left.sha256 !== right.sha256 || left.byteLength !== right.byteLength) {
      addMismatch(
        mismatches,
        'artifact-bytes-change',
        false,
        left?.sha256 ?? null,
        right?.sha256 ?? null
      );
    }
  }
}

function compareFixture(fixture) {
  const mismatches = [];
  const capturedRuns = side => {
    if (side === undefined) return [];
    if (!plainRecord(side) || !Array.isArray(side.runs)) return [null];
    return side.runs;
  };
  const legacyRuns = capturedRuns(fixture.legacy);
  const candidateRuns = capturedRuns(fixture.candidate);
  const legacy = sideSummary(legacyRuns);
  const candidate = sideSummary(candidateRuns);

  if (legacyRuns.length === 0)
    addMismatch(mismatches, 'missing-legacy-run', true);
  if (candidateRuns.length === 0)
    addMismatch(mismatches, 'missing-candidate-run', true);
  for (const [runs, side] of [
    [legacyRuns, legacy],
    [candidateRuns, candidate],
  ]) {
    if (runs.length > 0 && runs.some(run => !normalizeRun(run).valid))
      addMismatch(mismatches, 'invalid-result', true);
    if (runs.some(run => plainRecord(run) && run.outcome === 'timeout'))
      addMismatch(mismatches, 'runner-timeout', true);
    if (runs.some(run => plainRecord(run) && run.outcome === 'failed'))
      addMismatch(mismatches, 'runner-failure', true);
    if (runs.length > 0 && side.determinism === 'not-sampled')
      addMismatch(mismatches, 'insufficient-determinism-samples', true);
    else if (side.determinism === 'unstable')
      addMismatch(mismatches, 'non-deterministic-output', true);
  }

  const legacyFirst = legacyRuns.length ? normalizeRun(legacyRuns[0]) : null;
  const candidateFirst = candidateRuns.length
    ? normalizeRun(candidateRuns[0])
    : null;
  const left = legacyFirst?.valid ? legacyFirst.summary : null;
  const right = candidateFirst?.valid ? candidateFirst.summary : null;
  if (left?.outcome === 'complete' && right?.outcome === 'complete') {
    const sameSecurity =
      left.security.decision === right.security.decision &&
      left.security.code === right.security.code;
    if (!sameSecurity) {
      addMismatch(
        mismatches,
        'security-decision-mismatch',
        true,
        dataDigest(left.security),
        dataDigest(right.security)
      );
    }
    if (left.security.decision === 'rejected' && left.artifacts.length > 0)
      addMismatch(mismatches, 'artifact-on-security-rejection', true);
    if (right.security.decision === 'rejected' && right.artifacts.length > 0)
      addMismatch(mismatches, 'artifact-on-security-rejection', true);

    if (
      left.security.decision === 'accepted' &&
      right.security.decision === 'accepted'
    ) {
      if (left.artifacts.length === 0)
        addMismatch(mismatches, 'missing-output', true);
      if (right.artifacts.length === 0)
        addMismatch(mismatches, 'missing-output', true);
      compareArtifacts(left, right, mismatches);
      for (const [field, code] of SEMANTIC_FIELDS) {
        if (left.semantics[field] !== right.semantics[field])
          addMismatch(
            mismatches,
            code,
            true,
            left.semantics[field],
            right.semantics[field]
          );
      }
      if (left.frameworkValidity !== right.frameworkValidity)
        addMismatch(
          mismatches,
          'framework-validity-mismatch',
          true,
          dataDigest(left.frameworkValidity),
          dataDigest(right.frameworkValidity)
        );
      if (
        left.frameworkValidity === 'invalid' ||
        right.frameworkValidity === 'invalid'
      )
        addMismatch(mismatches, 'framework-output-invalid', true);
      if (
        left.frameworkValidity === 'not-checked' ||
        right.frameworkValidity === 'not-checked'
      )
        addMismatch(mismatches, 'framework-validity-unverified', true);
    }
  }

  const unique = new Map();
  for (const mismatch of mismatches) {
    const key = `${mismatch.code}:${mismatch.legacyDigest}:${mismatch.candidateDigest}`;
    unique.set(key, mismatch);
  }
  const orderedMismatches = [...unique.values()].sort(
    (a, b) =>
      a.code.localeCompare(b.code, 'en') ||
      String(a.legacyDigest).localeCompare(String(b.legacyDigest), 'en') ||
      String(a.candidateDigest).localeCompare(String(b.candidateDigest), 'en')
  );
  return {
    fixtureId: fixture.fixtureId,
    contextSha256: dataDigest(fixture.context ?? {}),
    legacy,
    candidate,
    mismatches: orderedMismatches,
  };
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) freezeDeep(item);
    Object.freeze(value);
  }
  return value;
}

/** Compare captured in-memory outputs; no generation, writing, or cache access occurs. */
export function compareShadowResults(fixtures) {
  if (!Array.isArray(fixtures))
    throw new TypeError('shadow fixtures must be an array');
  const seen = new Set();
  for (const fixture of fixtures) {
    if (!plainRecord(fixture) || !FIXTURE_ID.test(fixture.fixtureId))
      throw new TypeError('shadow fixture manifest is invalid');
    if (seen.has(fixture.fixtureId))
      throw new TypeError('shadow fixture identifiers must be unique');
    seen.add(fixture.fixtureId);
    canonicalJson(fixture.context ?? {});
  }
  const records = fixtures
    .slice()
    .sort((left, right) => left.fixtureId.localeCompare(right.fixtureId, 'en'))
    .map(compareFixture);
  const blockingMismatchCount = records.reduce(
    (total, record) =>
      total + record.mismatches.filter(mismatch => mismatch.blocking).length,
    0
  );
  return freezeDeep({
    schemaVersion: SHADOW_COMPARISON_SCHEMA,
    fixtureCount: records.length,
    blockingMismatchCount,
    mismatchCodes: SHADOW_MISMATCH_CODES,
    fixtures: records,
  });
}
