import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { compareShadowResults } from '../../experiments/phase3/shadow-comparison-harness.mjs';

const moduleSource = await fs.readFile(
  new URL(
    '../../experiments/phase3/shadow-comparison-harness.mjs',
    import.meta.url
  ),
  'utf8'
);

// The harness has no filesystem, writer, cache, or production imports.
assert.deepEqual(
  [...moduleSource.matchAll(/from ['"]([^'"]+)['"]/gu)].map(match => match[1]),
  ['node:buffer', 'node:crypto', './shadow-comparison-contract-v1.mjs']
);

const makeRun = (overrides = {}) => ({
  outcome: 'complete',
  security: { decision: 'accepted' },
  artifacts: [{ path: 'icons/Icon.js', content: 'export default "icon";' }],
  semantics: {
    text: 'accessible label',
    namespaces: [{ uri: 'http://www.w3.org/2000/svg', localName: 'svg' }],
    references: [{ from: 'paint', to: 'gradient' }],
    accessibility: { title: 'accessible label', role: 'img' },
  },
  frameworkValidity: 'valid',
  diagnostics: [],
  ...overrides,
});

const fixture = (
  fixtureId,
  left = makeRun(),
  right = makeRun(),
  extra = {}
) => ({
  fixtureId,
  context: {
    framework: 'react',
    language: 'javascript',
    options: { minify: false },
  },
  legacy: { runs: [left, structuredClone(left)] },
  candidate: { runs: [right, structuredClone(right)] },
  ...extra,
});

function codes(report, fixtureId) {
  return report.fixtures
    .find(item => item.fixtureId === fixtureId)
    .mismatches.map(item => item.code);
}

// Ordering is canonical across fixture order, artifact order, and object key order.
{
  const first = fixture('z-last');
  const second = fixture('a-first');
  const left = compareShadowResults([first, second]);
  const right = compareShadowResults([second, first]);
  assert.equal(JSON.stringify(left), JSON.stringify(right));
  assert.deepEqual(
    left.fixtures.map(item => item.fixtureId),
    ['a-first', 'z-last']
  );
  assert.equal(left.schemaVersion, 'svger-shadow-comparison-v1');
  assert.equal(left.blockingMismatchCount, 0);
  assert.ok(Object.isFrozen(left.fixtures[0].mismatches));
}

// Byte-only changes are visible but non-blocking; a missing named artifact blocks.
{
  const changedBytes = makeRun({
    artifacts: [
      { path: 'icons/Icon.js', content: 'export default "changed";' },
    ],
  });
  const report = compareShadowResults([
    fixture('bytes', makeRun(), changedBytes),
  ]);
  assert.deepEqual(codes(report, 'bytes'), ['artifact-bytes-change']);
  assert.equal(report.blockingMismatchCount, 0);

  const missingArtifact = makeRun({ artifacts: [] });
  const missing = compareShadowResults([
    fixture('missing-artifact', makeRun(), missingArtifact),
  ]);
  assert.deepEqual(codes(missing, 'missing-artifact'), ['missing-output']);
  assert.equal(missing.blockingMismatchCount, 1);
}

// Semantic projections distinguish text, namespace, reference, and accessibility loss.
{
  const candidate = makeRun({
    semantics: {
      text: 'lost text',
      namespaces: [{ uri: 'urn:changed', localName: 'svg' }],
      references: [],
      accessibility: { role: 'presentation' },
    },
  });
  const report = compareShadowResults([
    fixture('semantics', makeRun(), candidate),
  ]);
  assert.deepEqual(codes(report, 'semantics'), [
    'accessibility-change',
    'namespace-change',
    'reference-change',
    'text-content-change',
  ]);
  assert.equal(report.blockingMismatchCount, 4);
}

// Security outcome mismatch and any artifact emitted on rejection are blocking.
{
  const rejected = makeRun({
    security: { decision: 'rejected', code: 'E_UNSAFE_SVG_CONTENT' },
    artifacts: [],
    frameworkValidity: 'not-checked',
  });
  const report = compareShadowResults([
    fixture('security', makeRun(), rejected),
    fixture(
      'reject-emits-output',
      rejected,
      makeRun({
        security: { decision: 'rejected', code: 'E_UNSAFE_SVG_CONTENT' },
      })
    ),
  ]);
  assert.ok(codes(report, 'security').includes('security-decision-mismatch'));
  assert.ok(
    codes(report, 'reject-emits-output').includes(
      'artifact-on-security-rejection'
    )
  );
  assert.equal(report.blockingMismatchCount, 2);
}

// Missing runs, malformed results, timeouts, runner failures, and one-shot samples
// are all surfaced rather than silently treated as equivalent.
{
  const emptySide = fixture('missing-side');
  delete emptySide.candidate;
  const invalid = fixture('invalid', makeRun({ artifacts: 'not-an-array' }));
  const timeout = makeRun({ outcome: 'timeout' });
  const failed = makeRun({ outcome: 'failed' });
  const single = fixture('single-sample');
  single.candidate.runs = [single.candidate.runs[0]];
  const report = compareShadowResults([
    emptySide,
    invalid,
    fixture('timeout', timeout),
    fixture('failed', failed),
    single,
  ]);
  assert.ok(codes(report, 'missing-side').includes('missing-candidate-run'));
  assert.ok(codes(report, 'invalid').includes('invalid-result'));
  assert.ok(codes(report, 'timeout').includes('runner-timeout'));
  assert.ok(codes(report, 'failed').includes('runner-failure'));
  assert.ok(
    codes(report, 'single-sample').includes('insufficient-determinism-samples')
  );

  const unstableRun = makeRun({
    artifacts: [{ path: 'icons/Icon.js', content: 'unstable bytes' }],
  });
  const unstable = fixture('unstable');
  unstable.candidate.runs[1] = unstableRun;
  const unstableReport = compareShadowResults([unstable]);
  assert.ok(
    codes(unstableReport, 'unstable').includes('non-deterministic-output')
  );
}

// Framework validity is explicit and fail-closed when invalid or not checked.
{
  const invalid = makeRun({ frameworkValidity: 'invalid' });
  const report = compareShadowResults([
    fixture('framework-invalid', makeRun(), invalid),
    fixture(
      'framework-unverified',
      makeRun({ frameworkValidity: 'not-checked' }),
      makeRun({ frameworkValidity: 'not-checked' })
    ),
  ]);
  assert.ok(
    codes(report, 'framework-invalid').includes('framework-output-invalid')
  );
  assert.ok(
    codes(report, 'framework-invalid').includes('framework-validity-mismatch')
  );
  assert.ok(
    codes(report, 'framework-unverified').includes(
      'framework-validity-unverified'
    )
  );
}

// Report JSON includes only hashes, lengths, and sanitized diagnostic codes.
{
  const secret = 'ghp_FAKEsecretvalue12345678901234567890';
  const source = '<svg data-token="' + secret + '">private source text</svg>';
  const diagnostic = 'parser failed near ' + source;
  const sensitive = makeRun({
    artifacts: [{ path: 'icons/Icon.js', content: secret }],
    semantics: {
      text: source,
      namespaces: { source },
      references: { source },
      accessibility: { source },
    },
    diagnostics: [{ code: 'E_UNSAFE_SVG_CONTENT', message: diagnostic }],
  });
  let writerCalls = 0;
  let cacheCalls = 0;
  const writer = {
    write() {
      writerCalls++;
    },
  };
  const cache = {
    set() {
      cacheCalls++;
    },
  };
  const input = fixture('redaction', sensitive, structuredClone(sensitive), {
    context: { source, options: { secret } },
    writer,
    cache,
  });
  const before = structuredClone({
    context: input.context,
    legacy: input.legacy,
    candidate: input.candidate,
  });
  const report = compareShadowResults([input]);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes(source), false);
  assert.equal(serialized.includes(diagnostic), false);
  assert.equal(serialized.includes('private source text'), false);
  assert.equal(serialized.includes('icons/Icon.js'), false);
  assert.equal(writerCalls, 0);
  assert.equal(cacheCalls, 0);
  assert.deepEqual(
    {
      context: input.context,
      legacy: input.legacy,
      candidate: input.candidate,
    },
    before
  );
  assert.deepEqual(report.fixtures[0].legacy.diagnosticCodes, [
    'E_UNSAFE_SVG_CONTENT',
  ]);
}

assert.throws(
  () => compareShadowResults([{ fixtureId: '../escape' }]),
  /manifest/u
);
assert.throws(
  () => compareShadowResults([fixture('duplicate'), fixture('duplicate')]),
  /unique/u
);

console.log('Phase 03.3A shadow comparison harness regressions passed.');
