import assert from 'node:assert/strict';
import { watch } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  captureCandidateFixture,
  captureLegacyRun,
  compareQualifiedCaptures,
  validateOracleAnalysis,
} from '../../experiments/phase3/shadow-capture.mjs';
import { analyzeSvelteArtifact } from '../../experiments/phase3/svelte-artifact-oracle.mjs';

const fixtureRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), 'svger-shadow-019-')
);
const workerSource = await fs.readFile(
  new URL(
    '../../experiments/phase3/shadow-capture-worker.mjs',
    import.meta.url
  ),
  'utf8'
);
const oracleSource = await fs.readFile(
  new URL(
    '../../experiments/phase3/svelte-artifact-oracle.mjs',
    import.meta.url
  ),
  'utf8'
);
assert.match(workerSource, /processor\.generateComponent\(/u);
assert.doesNotMatch(
  workerSource,
  /processSVGFile|commitOutputTransaction|writeOutputFileAtomic|ContentAddressableCache/u
);
assert.doesNotMatch(
  oracleSource,
  /node:fs|node:child_process|writeFile|fetch\s*\(|\beval\s*\(|new Function/u
);
const source =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" role="img" aria-label="capture"><title>Capture</title><path d="M0 0h8v8z"/></svg>';
const fixture = {
  fixtureId: 'capture-svelte',
  componentName: 'CaptureIcon',
  source,
  options: {
    framework: 'svelte',
    typescript: false,
    optimizationLevel: 'none',
  },
};
const sourcePath = path.join(fixtureRoot, 'icon.svg');
const outputDirectory = path.join(fixtureRoot, 'configured-output');
const cacheDirectory = path.join(fixtureRoot, 'cache');
await fs.mkdir(outputDirectory);
await fs.mkdir(cacheDirectory);
await fs.writeFile(sourcePath, source);
await fs.writeFile(
  path.join(outputDirectory, 'existing.svelte'),
  'preserve output'
);
await fs.writeFile(path.join(cacheDirectory, 'entry'), 'preserve cache');

const guards = [sourcePath, outputDirectory, cacheDirectory];
const [legacyFirst, legacySecond] = await Promise.all([
  captureLegacyRun(fixture, { timeoutMs: 15_000, guardPaths: guards }),
  captureLegacyRun(fixture, { timeoutMs: 15_000, guardPaths: guards }),
]);
assert.equal(legacyFirst.outcome, 'complete');
assert.equal(legacyFirst.schemaVersion, 'svger-shadow-capture-v5');
assert.equal(legacySecond.outcome, 'complete');
assert.equal(legacyFirst.role, 'legacy');
assert.equal(legacyFirst.origin, 'legacy-in-memory-generator');
assert.equal(
  legacyFirst.fixture.sourceSha256,
  legacySecond.fixture.sourceSha256
);
assert.equal(
  legacyFirst.compiler.implementationSha256,
  legacySecond.compiler.implementationSha256
);
assert.equal(legacyFirst.captureEnvironment.runtime, process.version);
assert.deepEqual(legacyFirst.artifacts, legacySecond.artifacts);
assert.equal(legacyFirst.artifacts[0].path, 'CaptureIcon.svelte');
assert.equal(legacyFirst.frameworkValidation.status, 'valid');
assert.equal(legacyFirst.frameworkValidation.compiler.name, 'svelte');
assert.equal(typeof legacyFirst.frameworkValidation.compiler.version, 'string');
assert.equal(legacyFirst.frameworkValidation.timeoutEnforced, true);
assert.deepEqual(legacyFirst.outputEvidence, {
  origin: 'legacy-in-memory-generator',
  generated: true,
  supplied: false,
  compiled: true,
  executed: false,
});
assert.equal(legacyFirst.isolation.timeoutEnforced, true);
assert.equal(legacyFirst.isolation.filesystemSandbox, false);
assert.equal(legacyFirst.isolation.guardStatus, 'unchanged');
assert.equal(legacyFirst.isolation.workspace, 'clean');
assert.equal(legacyFirst.semanticEvidence.status, 'derived');
assert.equal(
  legacyFirst.semanticEvidence.method,
  'phase2-saxes-to-phase3-ir-v1-static-svg-source-oracle-v3'
);
assert.equal(legacyFirst.semanticEvidence.coverage.text, 'complete');
assert.equal(legacyFirst.semanticEvidence.validity.status, 'valid');
assert.equal(legacyFirst.semanticEvidence.coverage.references, 'complete');
assert.equal(legacyFirst.semanticEvidence.coverage.accessibility, 'complete');
assert.equal(
  legacyFirst.semanticEvidence.grammar.schemaVersion,
  'svger-static-svg-source-oracle-v3'
);
assert.equal(
  legacyFirst.semanticEvidence.grammar.referenceScope,
  'literal-id-and-href-syntax; no-browser-resource-resolution'
);
assert.equal(
  legacyFirst.artifactSemanticEvidence.analyzer.name,
  'svelte-static-svg-artifact-oracle'
);
assert.equal(legacyFirst.artifactSemanticEvidence.status, 'partial');
assert.equal(
  legacyFirst.artifactSemanticEvidence.schemaVersion,
  'svger-svelte-artifact-analysis-v4'
);
assert.equal(legacyFirst.artifactSemanticEvidence.analyzer.version, '4.0.0');
assert.equal(
  validateOracleAnalysis(legacyFirst.artifactSemanticEvidence).valid,
  true
);
const validSourceAnalysis = {
  ...legacyFirst.semanticEvidence,
  schemaVersion: legacyFirst.semanticEvidence.oracleSchema,
  status: legacyFirst.semanticEvidence.analysisStatus,
};
assert.equal(validateOracleAnalysis(validSourceAnalysis).valid, true);
const contradictoryCoverage = structuredClone(
  legacyFirst.artifactSemanticEvidence
);
for (const dimension of Object.keys(contradictoryCoverage.coverage))
  contradictoryCoverage.coverage[dimension] = 'complete';
assert.equal(
  validateOracleAnalysis(contradictoryCoverage).code,
  'analysis-coverage-contradictory'
);
const contradictoryValidity = structuredClone(
  legacyFirst.artifactSemanticEvidence
);
contradictoryValidity.validity = {
  status: 'unresolved',
  issues: [{ code: 'E_UNRESOLVED_REFERENCE', state: 'unresolved' }],
};
assert.equal(
  validateOracleAnalysis(contradictoryValidity).valid,
  true,
  'complete extraction may legitimately have unresolved references'
);
contradictoryValidity.validity = { status: 'valid', issues: [] };
contradictoryValidity.coverage.attributes = 'partial';
contradictoryValidity.analysisStatus = 'partial';
contradictoryValidity.status = 'partial';
assert.equal(
  validateOracleAnalysis(contradictoryValidity).code,
  'analysis-validity-contradictory'
);
const corruptProjectionDigest = structuredClone(
  legacyFirst.artifactSemanticEvidence
);
corruptProjectionDigest.projectionSha256 = '0'.repeat(64);
assert.equal(
  validateOracleAnalysis(corruptProjectionDigest).code,
  'analysis-projection-digest-invalid'
);
const incompatibleOracleSchema = structuredClone(
  legacyFirst.artifactSemanticEvidence
);
incompatibleOracleSchema.schemaVersion = 'svger-svelte-artifact-analysis-v2';
assert.equal(
  validateOracleAnalysis(
    incompatibleOracleSchema,
    'svger-svelte-artifact-analysis-v4'
  ).code,
  'analysis-schema-incompatible'
);
assert.equal(Object.isFrozen(legacyFirst), true);

const staticSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 8 8" width="8" height="8" role="img" aria-label="Icon" xml:space="preserve"><title>Icon</title><path id="shape" d="M0 0h8v8z"/><use xlink:href="#shape"/></svg>';
const staticAnalysis = analyzeSvelteArtifact({
  path: 'StaticIcon.svelte',
  content: staticSvg,
});
assert.equal(staticAnalysis.status, 'complete');
assert.equal(staticAnalysis.scope.runtimeEquivalence, false);
assert.ok(Object.values(staticAnalysis.coverage).every(x => x === 'complete'));
assert.deepEqual(staticAnalysis.projection.geometry, {
  viewBox: '0 0 8 8',
  width: '8',
  height: '8',
});
assert.deepEqual(staticAnalysis.projection.references, {
  ids: ['shape'],
  occurrences: [{ state: 'resolved', target: 'shape' }],
});
assert.deepEqual(staticAnalysis.projection.accessibility, {
  attributes: [
    { name: 'role', value: 'img' },
    { name: 'aria-label', value: 'Icon' },
  ],
  titles: ['Icon'],
  descriptions: [],
  idrefs: [],
});
assert.deepEqual(staticAnalysis.projection.text, [
  { path: [0], value: 'Icon', xmlSpace: 'preserve' },
]);
const namespaceRebinding = analyzeSvelteArtifact({
  path: 'NamespaceRebinding.svelte',
  content: '<svg xmlns="urn:unexpected"><path/></svg>',
});
assert.equal(namespaceRebinding.coverage.namespaces, 'partial');
assert.equal(namespaceRebinding.coverageStatus, 'partial');
assert.equal(namespaceRebinding.validity.status, 'unresolved');
assert.ok(
  namespaceRebinding.diagnosticCodes.includes('E_ARTIFACT_NAMESPACE_UNRESOLVED')
);
const classStyledMarkup = analyzeSvelteArtifact({
  path: 'ClassStyled.svelte',
  content: '<svg><path class="painted"/></svg>',
});
assert.equal(classStyledMarkup.coverage.geometry, 'partial');
assert.equal(classStyledMarkup.coverage.accessibility, 'partial');
const staticFixture = {
  fixtureId: 'capture-svelte-static',
  componentName: 'StaticIcon',
  source: staticSvg,
  options: {
    framework: 'svelte',
    typescript: false,
    optimizationLevel: 'none',
  },
};
const unchangedStaticCandidate = await captureCandidateFixture(staticFixture, {
  path: 'StaticIcon.svelte',
  content: staticSvg,
});
const unchangedStaticCandidateSecond = await captureCandidateFixture(
  staticFixture,
  { path: 'StaticIcon.svelte', content: staticSvg }
);
const staticLegacy = await captureLegacyRun(staticFixture, {
  timeoutMs: 15_000,
});
assert.equal(unchangedStaticCandidate.frameworkValidation.status, 'valid');
assert.equal(
  unchangedStaticCandidate.artifactSemanticEvidence.status,
  'complete'
);
assert.deepEqual(
  unchangedStaticCandidate.artifactSemanticEvidence.projection,
  staticAnalysis.projection
);
const unchangedStaticReport = compareQualifiedCaptures({
  fixture: staticFixture,
  legacyRuns: [staticLegacy],
  candidateRuns: [unchangedStaticCandidate, unchangedStaticCandidateSecond],
});
assert.equal(
  unchangedStaticReport.artifactOracle.schemaVersion,
  'svger-three-way-artifact-oracle-v4'
);
assert.equal(
  unchangedStaticReport.qualificationFailures.includes(
    'artifact-analysis-provenance-invalid'
  ),
  false,
  'the active analyzer version is accepted by the capture gate'
);
assert.deepEqual(
  Object.keys(unchangedStaticReport.artifactOracle.edges).sort(),
  ['legacyToCandidate', 'sourceToCandidate', 'sourceToLegacy'].sort()
);
for (const dimension of [
  'text',
  'namespaces',
  'attributes',
  'references',
  'accessibility',
  'geometry',
]) {
  const edge =
    unchangedStaticReport.artifactOracle.edges.sourceToCandidate.dimensions[
      dimension
    ];
  assert.equal(
    edge.fromSha256,
    edge.toSha256,
    `unchanged static output matches source ${dimension} observations`
  );
}

// Independently parsed source and artifact projections normalize XML lexical
// variation without losing attribute, text, or IDREF semantics.
const paritySource =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 8 8" width="8" height="8" role="img" aria-labelledby="label\tlabel-two"><title id="label">A&amp;B\r\nC</title><desc id="label-two">Notes</desc><path id="shape" d="M0 0h8v8z"/><use xlink:href="#shape"/></svg>';
const parityArtifact =
  '<svg role="img" height="8" aria-labelledby="label label-two" width="8" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg"><title id="label">A&#38;B\nC</title><desc id="label-two">Notes</desc><path d="M0 0h8v8z" id="shape"/><use xlink:href="#shape"/></svg>';
const parityFixture = {
  fixtureId: 'static-projection-parity',
  componentName: 'ParityIcon',
  source: paritySource,
  options: {
    framework: 'svelte',
    typescript: false,
    optimizationLevel: 'none',
  },
};
const parityLegacyRuns = await Promise.all([
  captureLegacyRun(parityFixture, { timeoutMs: 15_000 }),
  captureLegacyRun(parityFixture, { timeoutMs: 15_000 }),
]);
const parityCandidateRuns = await Promise.all([
  captureCandidateFixture(parityFixture, {
    path: 'ParityIcon.svelte',
    content: parityArtifact,
  }),
  captureCandidateFixture(parityFixture, {
    path: 'ParityIcon.svelte',
    content: parityArtifact,
  }),
]);
const parityReport = compareQualifiedCaptures({
  fixture: parityFixture,
  legacyRuns: parityLegacyRuns,
  candidateRuns: parityCandidateRuns,
});
assert.equal(parityLegacyRuns[0].semanticEvidence.analysisStatus, 'complete');
assert.equal(parityLegacyRuns[0].semanticEvidence.coverageStatus, 'complete');
assert.equal(parityLegacyRuns[0].semanticEvidence.validity.status, 'valid');
assert.equal(
  parityCandidateRuns[0].artifactSemanticEvidence.status,
  'complete'
);
for (const edgeName of [
  'sourceToLegacy',
  'sourceToCandidate',
  'legacyToCandidate',
]) {
  const edge = parityReport.artifactOracle.edges[edgeName];
  for (const dimension of ['text', 'namespaces', 'references']) {
    assert.equal(
      edge.dimensions[dimension].fromSha256,
      edge.dimensions[dimension].toSha256,
      `${edgeName} canonicalizes equivalent ${dimension} observations`
    );
  }
}
assert.equal(parityReport.promotionEligible, false);
assert.ok(
  parityReport.qualificationFailures.includes('promotion-not-authorized')
);
const aliasedNamespaceArtifact = parityArtifact
  .replace(
    '<svg role="img"',
    '<svg xmlns:xl="http://www.w3.org/1999/xlink" role="img"'
  )
  .replace('xlink:href=', 'xl:href=');
const aliasedCandidateRuns = await Promise.all([
  captureCandidateFixture(parityFixture, {
    path: 'ParityIcon.svelte',
    content: aliasedNamespaceArtifact,
  }),
  captureCandidateFixture(parityFixture, {
    path: 'ParityIcon.svelte',
    content: aliasedNamespaceArtifact,
  }),
]);
const aliasReport = compareQualifiedCaptures({
  fixture: parityFixture,
  legacyRuns: parityLegacyRuns,
  candidateRuns: aliasedCandidateRuns,
});
for (const dimension of [
  'text',
  'namespaces',
  'attributes',
  'references',
  'accessibility',
  'geometry',
]) {
  assert.equal(
    aliasReport.artifactOracle.edges.sourceToCandidate.dimensions[dimension]
      .status,
    'match',
    `namespace-prefix/attribute-order variation preserves ${dimension}`
  );
}

const duplicateReferenceSource =
  '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="dup missing"><title id="dup">First</title><desc id="dup">Second</desc><use href="#dup"/></svg>';
const duplicateReferenceFixture = {
  ...parityFixture,
  fixtureId: 'duplicate-reference-static',
  componentName: 'DuplicateReference',
  source: duplicateReferenceSource,
};
const duplicateReferenceRecord = await captureCandidateFixture(
  duplicateReferenceFixture,
  {
    path: 'DuplicateReference.svelte',
    content: duplicateReferenceSource,
  }
);
assert.equal(
  duplicateReferenceRecord.semanticEvidence.coverage.references,
  'complete'
);
assert.equal(
  duplicateReferenceRecord.semanticEvidence.coverage.accessibility,
  'complete'
);
assert.equal(
  duplicateReferenceRecord.semanticEvidence.coverageStatus,
  'complete'
);
assert.equal(
  duplicateReferenceRecord.semanticEvidence.validity.status,
  'invalid'
);
assert.ok(
  duplicateReferenceRecord.semanticEvidence.validity.issues.some(
    issue => issue.code === 'E_DUPLICATE_ID'
  )
);
assert.equal(
  duplicateReferenceRecord.artifactSemanticEvidence.coverageStatus,
  'complete'
);
assert.equal(
  duplicateReferenceRecord.artifactSemanticEvidence.validity.status,
  'invalid'
);
assert.deepEqual(
  duplicateReferenceRecord.semanticEvidence.projection.references.occurrences,
  [{ state: 'ambiguous', target: 'dup' }]
);
assert.deepEqual(
  duplicateReferenceRecord.semanticEvidence.projection.accessibility.idrefs[0]
    .targets,
  [
    { target: 'dup', state: 'ambiguous' },
    { target: 'missing', state: 'unresolved' },
  ]
);
assert.deepEqual(
  duplicateReferenceRecord.artifactSemanticEvidence.projection,
  duplicateReferenceRecord.semanticEvidence.projection
);
const [duplicateLegacyA, duplicateLegacyB, duplicateCandidateB] =
  await Promise.all([
    captureLegacyRun(duplicateReferenceFixture, { timeoutMs: 15_000 }),
    captureLegacyRun(duplicateReferenceFixture, { timeoutMs: 15_000 }),
    captureCandidateFixture(duplicateReferenceFixture, {
      path: 'DuplicateReference.svelte',
      content: duplicateReferenceSource,
    }),
  ]);
const invalidButCompletelyObserved = compareQualifiedCaptures({
  fixture: duplicateReferenceFixture,
  legacyRuns: [duplicateLegacyA, duplicateLegacyB],
  candidateRuns: [duplicateReferenceRecord, duplicateCandidateB],
});
assert.equal(
  invalidButCompletelyObserved.artifactOracle.edges.sourceToCandidate.outcome,
  'mismatch'
);
assert.equal(
  invalidButCompletelyObserved.artifactOracle.edges.sourceToCandidate.validity
    .status,
  'invalid'
);
assert.ok(
  invalidButCompletelyObserved.qualificationFailures.includes(
    'artifact-semantic-validity-not-valid'
  )
);
assert.equal(invalidButCompletelyObserved.promotionEligible, false);

const unresolvedArtifact = analyzeSvelteArtifact({
  path: 'DanglingReference.svelte',
  content: '<svg><use href="#missing"/></svg>',
});
assert.equal(unresolvedArtifact.coverageStatus, 'complete');
assert.equal(unresolvedArtifact.validity.status, 'unresolved');
assert.ok(
  unresolvedArtifact.validity.issues.some(
    issue => issue.code === 'E_UNRESOLVED_REFERENCE'
  )
);
const danglingSource =
  '<svg xmlns="http://www.w3.org/2000/svg"><use href="#missing"/></svg>';
const danglingFixture = {
  ...parityFixture,
  fixtureId: 'dangling-reference-static',
  componentName: 'DanglingReference',
  source: danglingSource,
};
const [
  danglingLegacyA,
  danglingLegacyB,
  danglingCandidateA,
  danglingCandidateB,
] = await Promise.all([
  captureLegacyRun(danglingFixture, { timeoutMs: 15_000 }),
  captureLegacyRun(danglingFixture, { timeoutMs: 15_000 }),
  captureCandidateFixture(danglingFixture, {
    path: 'DanglingReference.svelte',
    content: danglingSource,
  }),
  captureCandidateFixture(danglingFixture, {
    path: 'DanglingReference.svelte',
    content: danglingSource,
  }),
]);
assert.equal(danglingCandidateA.semanticEvidence.coverageStatus, 'complete');
assert.equal(danglingCandidateA.semanticEvidence.validity.status, 'unresolved');
const unresolvedButObserved = compareQualifiedCaptures({
  fixture: danglingFixture,
  legacyRuns: [danglingLegacyA, danglingLegacyB],
  candidateRuns: [danglingCandidateA, danglingCandidateB],
});
assert.equal(
  unresolvedButObserved.artifactOracle.edges.sourceToCandidate.outcome,
  'inconclusive'
);
assert.equal(
  unresolvedButObserved.artifactOracle.edges.sourceToCandidate.validity.status,
  'unresolved'
);
assert.equal(unresolvedButObserved.promotionEligible, false);

// Character-reference spelling and CDATA delimiters do not change static
// character data, while element boundaries, order, significant whitespace,
// and the effective xml:space mode remain observable.
const textBase = analyzeSvelteArtifact({
  path: 'Text.svelte',
  content: '<svg><text>A&amp;B</text><text>C</text></svg>',
});
const textEquivalent = analyzeSvelteArtifact({
  path: 'Text.svelte',
  content: '<svg><text>A&#38;B</text><text>C</text></svg>',
});
assert.deepEqual(textBase.projection.text, textEquivalent.projection.text);
const cdataSource =
  '<svg xmlns="http://www.w3.org/2000/svg"><text><![CDATA[A&B]]></text></svg>';
const cdataFixture = {
  ...parityFixture,
  fixtureId: 'cdata-character-data-equivalence',
  componentName: 'CdataCharacterData',
  source: cdataSource,
};
const cdataProjectionRecord = await captureCandidateFixture(cdataFixture, {
  path: 'CdataCharacterData.svelte',
  content: '<svg xmlns="http://www.w3.org/2000/svg"><text>A&amp;B</text></svg>',
});
assert.equal(cdataProjectionRecord.semanticEvidence.validity.status, 'valid');
assert.deepEqual(
  cdataProjectionRecord.semanticEvidence.projection.text,
  cdataProjectionRecord.artifactSemanticEvidence.projection.text
);
const artifactCdataUnsupported = analyzeSvelteArtifact({
  path: 'Text.svelte',
  content: '<svg><text><![CDATA[C]]></text></svg>',
});
assert.equal(artifactCdataUnsupported.coverageStatus, 'unresolved');
assert.equal(artifactCdataUnsupported.projection, null);
const textBoundaryChanged = analyzeSvelteArtifact({
  path: 'Text.svelte',
  content: '<svg><text>AC<tspan>B</tspan></text></svg>',
});
const textBoundaryOriginal = analyzeSvelteArtifact({
  path: 'Text.svelte',
  content: '<svg><text>A<tspan>B</tspan>C</text></svg>',
});
assert.notDeepEqual(
  textBoundaryChanged.projection.text,
  textBoundaryOriginal.projection.text
);
const significantSpace = analyzeSvelteArtifact({
  path: 'Space.svelte',
  content: '<svg xml:space="preserve"><text> A </text></svg>',
});
const trimmedSpace = analyzeSvelteArtifact({
  path: 'Space.svelte',
  content: '<svg xml:space="preserve"><text>A</text></svg>',
});
assert.notDeepEqual(
  significantSpace.projection.text,
  trimmedSpace.projection.text
);
assert.equal(significantSpace.validity.status, 'valid');
const cssReferenceSource =
  '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="paint"/></defs><path fill="url(#paint)" d="M0 0h1v1z"/></svg>';
const cssReferenceFixture = {
  ...parityFixture,
  fixtureId: 'css-reference-static',
  componentName: 'CssReference',
  source: cssReferenceSource,
};
const cssReferenceRecord = await captureCandidateFixture(cssReferenceFixture, {
  path: 'CssReference.svelte',
  content: cssReferenceSource,
});
assert.equal(
  cssReferenceRecord.semanticEvidence.coverage.references,
  'partial'
);
assert.equal(
  cssReferenceRecord.artifactSemanticEvidence.coverage.references,
  'partial'
);
assert.equal(cssReferenceRecord.semanticEvidence.coverage.geometry, 'partial');
assert.equal(cssReferenceRecord.semanticEvidence.validity.status, 'unresolved');
assert.equal(
  cssReferenceRecord.artifactSemanticEvidence.validity.status,
  'unresolved'
);
const unknownAttributeSource =
  '<svg xmlns="http://www.w3.org/2000/svg"><path data-custom="opaque" d="M0 0h1v1z"/></svg>';
const unknownAttributeFixture = {
  ...parityFixture,
  fixtureId: 'unknown-attribute-static',
  componentName: 'UnknownAttribute',
  source: unknownAttributeSource,
};
const unknownAttributeRecord = await captureCandidateFixture(
  unknownAttributeFixture,
  {
    path: 'UnknownAttribute.svelte',
    content: unknownAttributeSource,
  }
);
assert.equal(
  unknownAttributeRecord.semanticEvidence.coverage.attributes,
  'partial'
);
assert.equal(
  unknownAttributeRecord.artifactSemanticEvidence.coverage.attributes,
  'partial'
);
assert.equal(
  unknownAttributeRecord.semanticEvidence.validity.status,
  'unresolved'
);
assert.equal(
  unknownAttributeRecord.artifactSemanticEvidence.validity.status,
  'unresolved'
);
const unsupportedCoverageUpgrade = structuredClone(
  unknownAttributeRecord.artifactSemanticEvidence
);
for (const dimension of Object.keys(unsupportedCoverageUpgrade.coverage))
  unsupportedCoverageUpgrade.coverage[dimension] = 'complete';
unsupportedCoverageUpgrade.analysisStatus = 'complete';
unsupportedCoverageUpgrade.status = 'complete';
unsupportedCoverageUpgrade.coverageStatus = 'complete';
assert.equal(
  validateOracleAnalysis(unsupportedCoverageUpgrade).code,
  'analysis-validity-contradictory',
  'unsupported syntax cannot be upgraded to complete with unresolved validity'
);
const [unknownLegacyA, unknownLegacyB, unknownCandidateA, unknownCandidateB] =
  await Promise.all([
    captureLegacyRun(unknownAttributeFixture, { timeoutMs: 15_000 }),
    captureLegacyRun(unknownAttributeFixture, { timeoutMs: 15_000 }),
    captureCandidateFixture(unknownAttributeFixture, {
      path: 'UnknownAttribute.svelte',
      content: unknownAttributeSource,
    }),
    captureCandidateFixture(unknownAttributeFixture, {
      path: 'UnknownAttribute.svelte',
      content: unknownAttributeSource,
    }),
  ]);
const unsupportedButObserved = compareQualifiedCaptures({
  fixture: unknownAttributeFixture,
  legacyRuns: [unknownLegacyA, unknownLegacyB],
  candidateRuns: [unknownCandidateA, unknownCandidateB],
});
assert.equal(
  unsupportedButObserved.artifactOracle.edges.sourceToCandidate.outcome,
  'inconclusive'
);
assert.equal(unsupportedButObserved.promotionEligible, false);

const parityMutations = [
  {
    id: 'id-mutation',
    dimension: 'references',
    content: parityArtifact.replace('id="shape"', 'id="renamed"'),
  },
  {
    id: 'reference-target-mutation',
    dimension: 'references',
    content: parityArtifact.replace('href="#shape"', 'href="#missing"'),
  },
  {
    id: 'namespace-mutation',
    dimension: 'namespaces',
    content: parityArtifact.replace(
      'xmlns="http://www.w3.org/2000/svg"',
      'xmlns="urn:unexpected"'
    ),
  },
  {
    id: 'text-order-mutation',
    dimension: 'text',
    content: parityArtifact.replace(
      '<title id="label">A&#38;B\nC</title><desc id="label-two">Notes</desc>',
      '<desc id="label-two">Notes</desc><title id="label">A&#38;B\nC</title>'
    ),
  },
  {
    id: 'geometry-mutation',
    dimension: 'geometry',
    content: parityArtifact.replace('viewBox="0 0 8 8"', 'viewBox="0 0 7 8"'),
  },
  {
    id: 'accessibility-mutation',
    dimension: 'accessibility',
    content: parityArtifact.replace('role="img"', 'role="presentation"'),
  },
  {
    id: 'xml-space-mutation',
    dimension: 'text',
    content: parityArtifact.replace(
      '<svg role=',
      '<svg xml:space="preserve" role='
    ),
  },
];
for (const mutation of parityMutations) {
  const fixtureForMutation = { ...parityFixture, fixtureId: mutation.id };
  const [legacyRuns, candidateRuns] = await Promise.all([
    Promise.all([
      captureLegacyRun(fixtureForMutation, { timeoutMs: 15_000 }),
      captureLegacyRun(fixtureForMutation, { timeoutMs: 15_000 }),
    ]),
    Promise.all([
      captureCandidateFixture(fixtureForMutation, {
        path: 'ParityIcon.svelte',
        content: mutation.content,
      }),
      captureCandidateFixture(fixtureForMutation, {
        path: 'ParityIcon.svelte',
        content: mutation.content,
      }),
    ]),
  ]);
  const report = compareQualifiedCaptures({
    fixture: fixtureForMutation,
    legacyRuns,
    candidateRuns,
  });
  assert.equal(
    candidateRuns[0].frameworkValidation.status,
    'valid',
    mutation.id
  );
  assert.equal(
    report.artifactOracle.edges.sourceToCandidate.dimensions[mutation.dimension]
      .status,
    'mismatch',
    `${mutation.id} blocks on ${mutation.dimension}`
  );
  assert.equal(report.promotionEligible, false);
}

const textBoundaryFixture = {
  ...parityFixture,
  fixtureId: 'text-boundary-mutation',
  componentName: 'TextBoundary',
  source:
    '<svg xmlns="http://www.w3.org/2000/svg"><text>A<tspan>B</tspan>C</text></svg>',
};
const textBoundaryCandidate =
  '<svg xmlns="http://www.w3.org/2000/svg"><text>AC<tspan>B</tspan></text></svg>';
const [
  boundaryLegacyA,
  boundaryLegacyB,
  boundaryCandidateA,
  boundaryCandidateB,
] = await Promise.all([
  captureLegacyRun(textBoundaryFixture, { timeoutMs: 15_000 }),
  captureLegacyRun(textBoundaryFixture, { timeoutMs: 15_000 }),
  captureCandidateFixture(textBoundaryFixture, {
    path: 'TextBoundary.svelte',
    content: textBoundaryCandidate,
  }),
  captureCandidateFixture(textBoundaryFixture, {
    path: 'TextBoundary.svelte',
    content: textBoundaryCandidate,
  }),
]);
const textBoundaryReport = compareQualifiedCaptures({
  fixture: textBoundaryFixture,
  legacyRuns: [boundaryLegacyA, boundaryLegacyB],
  candidateRuns: [boundaryCandidateA, boundaryCandidateB],
});
assert.equal(
  textBoundaryReport.artifactOracle.edges.sourceToCandidate.dimensions.text
    .status,
  'mismatch'
);

const unresolvedReference = analyzeSvelteArtifact({
  path: 'Unresolved.svelte',
  content: '<svg><use href="#missing"/></svg>',
});
assert.deepEqual(unresolvedReference.projection.references.occurrences, [
  { state: 'unresolved', target: 'missing' },
]);
const dynamicMarkupAnalysis = analyzeSvelteArtifact({
  path: 'Dynamic.svelte',
  content: '<svg><text>{label}</text><use href={target}/></svg>',
});
assert.equal(dynamicMarkupAnalysis.status, 'partial');
assert.equal(dynamicMarkupAnalysis.coverage.text, 'partial');
assert.equal(dynamicMarkupAnalysis.coverage.references, 'partial');
const ambiguousRoots = analyzeSvelteArtifact({
  path: 'Ambiguous.svelte',
  content: '<svg/><svg/>',
});
assert.equal(ambiguousRoots.status, 'partial');
assert.equal(validateOracleAnalysis(ambiguousRoots).valid, true);
assert.ok(
  ambiguousRoots.diagnosticCodes.includes('E_ARTIFACT_AMBIGUOUS_SVG_ROOT')
);

const dynamicCandidate = await captureCandidateFixture(fixture, {
  path: 'CaptureIcon.svelte',
  content:
    '<script>export let label = "dynamic";</script><svg><text>{label}</text></svg>',
});
assert.equal(dynamicCandidate.frameworkValidation.status, 'valid');
assert.equal(dynamicCandidate.artifactSemanticEvidence.status, 'partial');
assert.equal(
  dynamicCandidate.artifactSemanticEvidence.coverage.text,
  'partial'
);
const dynamicReport = compareQualifiedCaptures({
  fixture,
  legacyRuns: [legacyFirst, legacySecond],
  candidateRuns: [dynamicCandidate],
});
assert.equal(dynamicReport.promotionEligible, false);
assert.ok(
  dynamicReport.qualificationFailures.includes(
    'artifact-semantic-coverage-incomplete'
  )
);

const validCandidate = await captureCandidateFixture(
  fixture,
  legacyFirst.artifacts[0],
  { guardPaths: guards }
);
assert.equal(validCandidate.frameworkValidation.status, 'valid');
assert.equal(validCandidate.frameworkValidation.compiler.name, 'svelte');

// A deliberately malformed supplied candidate proves the runner records native
// compiler failure. It is not treated as an equivalent or promotable candidate.
const candidate = await captureCandidateFixture(
  fixture,
  { path: 'CaptureIcon.svelte', content: '<script>const = ;</script><svg/>' },
  { guardPaths: guards }
);
assert.equal(candidate.role, 'candidate');
assert.equal(candidate.origin, 'supplied-captured-fixture');
assert.equal(candidate.outputEvidence.generated, false);
assert.equal(candidate.outputEvidence.supplied, true);
assert.equal(candidate.frameworkValidation.status, 'invalid');
assert.equal(candidate.artifactSemanticEvidence.status, 'invalid');
assert.equal(candidate.frameworkValidation.compiler.name, 'svelte');
assert.equal(
  candidate.frameworkValidation.diagnosticCodes.includes('E_FRAMEWORK_COMPILE'),
  true
);

const qualification = compareQualifiedCaptures({
  fixture,
  legacyRuns: [legacyFirst, legacySecond],
  candidateRuns: [candidate],
});
assert.equal(
  qualification.schemaVersion,
  'svger-shadow-capture-qualification-v5'
);
assert.equal(qualification.promotionEligible, false);
assert.ok(
  qualification.qualificationFailures.includes('insufficient-capture-samples')
);
assert.ok(
  qualification.qualificationFailures.includes('promotion-not-authorized')
);
assert.ok(
  qualification.qualificationFailures.includes('framework-validation-failed')
);
assert.ok(
  qualification.comparison.fixtures[0].mismatches.some(
    mismatch =>
      mismatch.code === 'framework-output-invalid' && mismatch.blocking
  )
);
assert.equal(qualification.comparison.fixtures[0].legacy.determinism, 'stable');
assert.equal(
  qualification.comparison.fixtures[0].candidate.determinism,
  'not-sampled'
);
assert.equal(
  JSON.stringify(qualification),
  JSON.stringify(
    compareQualifiedCaptures({
      fixture,
      legacyRuns: [legacyFirst, legacySecond],
      candidateRuns: [candidate],
    })
  )
);
assert.equal(JSON.stringify(qualification).includes(source), false);
assert.equal(
  JSON.stringify(qualification).includes(legacyFirst.artifacts[0].content),
  false
);

// A native-valid candidate can still change SVG meaning. This fixture changes
// geometry, shape, and accessible text while retaining valid Svelte syntax.
// The current capture oracle intentionally reuses source-derived projections,
// so it must remain non-promotable until candidate-output analysis exists.
const alteredSvelte = `<svg viewBox="0 0 1 1" role="img" aria-label="Altered"><title>Altered</title><circle cx="0.5" cy="0.5" r="0.5"/></svg>`;
const [alteredCandidate, alteredCandidateSecond] = await Promise.all([
  captureCandidateFixture(
    fixture,
    { path: 'CaptureIcon.svelte', content: alteredSvelte },
    { guardPaths: guards }
  ),
  captureCandidateFixture(
    fixture,
    { path: 'CaptureIcon.svelte', content: alteredSvelte },
    { guardPaths: guards }
  ),
]);
assert.equal(alteredCandidate.frameworkValidation.status, 'valid');
assert.equal(alteredCandidateSecond.frameworkValidation.status, 'valid');
assert.equal(alteredCandidate.frameworkValidation.compiler.name, 'svelte');
assert.equal(alteredCandidate.artifactSemanticEvidence.status, 'complete');
assert.notEqual(
  alteredCandidate.artifacts[0].content,
  legacyFirst.artifacts[0].content
);
const alteredReport = compareQualifiedCaptures({
  fixture,
  legacyRuns: [legacyFirst, legacySecond],
  candidateRuns: [alteredCandidate, alteredCandidateSecond],
});
assert.equal(alteredReport.promotionEligible, false);
assert.ok(
  alteredReport.qualificationFailures.includes('promotion-not-authorized')
);
assert.ok(
  alteredReport.comparison.fixtures[0].mismatches.some(
    mismatch => mismatch.code === 'artifact-bytes-change'
  )
);
for (const dimension of [
  'text',
  'namespaces',
  'attributes',
  'accessibility',
  'geometry',
]) {
  assert.equal(
    alteredReport.artifactOracle.edges.sourceToCandidate.dimensions[dimension]
      .status,
    'mismatch',
    `independent artifact analysis detects altered ${dimension}`
  );
  assert.ok(
    alteredReport.artifactOracle.edges.legacyToCandidate.dimensions[dimension],
    `legacy-to-candidate comparison includes ${dimension}`
  );
}
assert.ok(
  alteredReport.qualificationFailures.includes('artifact-semantic-mismatch')
);
assert.ok(
  alteredReport.qualificationFailures.includes(
    'artifact-semantic-coverage-incomplete'
  )
);
const alteredReportText = JSON.stringify(alteredReport);
assert.equal(alteredReportText.includes(source), false);
assert.equal(alteredReportText.includes(alteredSvelte), false);

const missingCandidate = await captureCandidateFixture(fixture, null, {
  guardPaths: guards,
});
const missingOutputReport = compareQualifiedCaptures({
  fixture,
  legacyRuns: [legacyFirst, legacySecond],
  candidateRuns: [missingCandidate],
});
assert.ok(
  missingOutputReport.comparison.fixtures[0].mismatches.some(
    mismatch => mismatch.code === 'missing-output' && mismatch.blocking
  )
);

const hostileFixture = {
  ...fixture,
  fixtureId: 'capture-hostile',
  source: '<svg><path onload="alert(1)"/></svg>',
};
const rejectedLegacy = await captureLegacyRun(hostileFixture, {
  timeoutMs: 15_000,
  guardPaths: guards,
});
const rejectedCandidate = await captureCandidateFixture(
  hostileFixture,
  { path: 'CaptureIcon.svelte', content: '<svg/>' },
  { guardPaths: guards }
);
assert.equal(rejectedLegacy.security.decision, 'rejected');
assert.equal(rejectedLegacy.artifacts.length, 0);
assert.equal(rejectedCandidate.security.decision, 'rejected');
const hostileComparison = compareQualifiedCaptures({
  fixture: hostileFixture,
  legacyRuns: [rejectedLegacy],
  candidateRuns: [rejectedCandidate],
});
assert.ok(
  hostileComparison.comparison.fixtures[0].mismatches.some(
    mismatch =>
      mismatch.code === 'artifact-on-security-rejection' && mismatch.blocking
  )
);

// Caller-authored/deserialized records are not accepted as trusted captures.
const copied = structuredClone(legacyFirst);
const protectedCaptureSnapshot = JSON.stringify([
  legacyFirst,
  legacySecond,
  candidate,
  candidate,
]);
const forged = compareQualifiedCaptures({
  fixture,
  legacyRuns: [copied, legacySecond],
  candidateRuns: [candidate, candidate],
});
assert.ok(forged.qualificationFailures.includes('capture-provenance-invalid'));
assert.ok(forged.qualificationFailures.includes('duplicate-capture-id'));
assert.equal(forged.promotionEligible, false);
assert.equal(
  forged.qualificationFailures.includes('artifact-semantic-mismatch'),
  false,
  'untrusted evidence is not misreported as an actual semantic mismatch'
);
assert.deepEqual(
  forged.qualificationFailures,
  [...forged.qualificationFailures].sort((a, b) => a.localeCompare(b, 'en'))
);
assert.deepEqual(
  forged,
  compareQualifiedCaptures({
    fixture,
    legacyRuns: [copied, legacySecond],
    candidateRuns: [candidate, candidate],
  })
);
assert.equal(JSON.stringify(forged).includes(source), false);
assert.equal(
  JSON.stringify(forged).includes(legacyFirst.artifacts[0].content),
  false
);
assert.equal(
  JSON.stringify([legacyFirst, legacySecond, candidate, candidate]),
  protectedCaptureSnapshot,
  'comparison failures do not mutate captured evidence'
);
const incompatibleCapture = structuredClone(legacyFirst);
incompatibleCapture.schemaVersion = 'svger-shadow-capture-v4';
const incompatibleReport = compareQualifiedCaptures({
  fixture,
  legacyRuns: [incompatibleCapture, legacySecond],
  candidateRuns: [candidate, candidate],
});
assert.ok(
  incompatibleReport.qualificationFailures.includes(
    'oracle-schema-incompatible'
  )
);
assert.equal(incompatibleReport.promotionEligible, false);
const malformedReport = compareQualifiedCaptures({
  fixture,
  legacyRuns: [null, { schemaVersion: 'broken' }],
  candidateRuns: [candidate, candidate],
});
assert.ok(
  malformedReport.qualificationFailures.includes('capture-provenance-invalid')
);
assert.equal(malformedReport.promotionEligible, false);

// Enforced timeout is distinct from a caller-supplied timeout label.
const timedOut = await captureLegacyRun(fixture, {
  timeoutMs: 1,
  guardPaths: guards,
});
assert.equal(timedOut.outcome, 'timeout');
assert.equal(timedOut.isolation.timeoutEnforced, true);
const candidateSecond = await captureCandidateFixture(
  fixture,
  { path: 'CaptureIcon.svelte', content: '<script>const = ;</script><svg/>' },
  { guardPaths: guards }
);
const mutationTarget = path.join(fixtureRoot, 'guarded-sentinel');
await fs.writeFile(mutationTarget, 'before');
const existingCaptureWorkspaces = new Set(
  (await fs.readdir(os.tmpdir())).filter(name =>
    name.startsWith('svger-shadow-capture-')
  )
);
let resolveInjectedMutation;
const injectedMutation = new Promise(resolve => {
  resolveInjectedMutation = resolve;
});
const watcher = watch(os.tmpdir(), (_event, fileName) => {
  const name = String(fileName ?? '');
  if (
    name.startsWith('svger-shadow-capture-') &&
    !existingCaptureWorkspaces.has(name)
  ) {
    void fs
      .writeFile(mutationTarget, 'injected concurrent mutation')
      .then(resolveInjectedMutation);
  }
});
let guardedCapture;
try {
  guardedCapture = await captureLegacyRun(fixture, {
    timeoutMs: 15_000,
    guardPaths: [...guards, mutationTarget],
  });
  await Promise.race([
    injectedMutation,
    new Promise(resolve => setTimeout(resolve, 1_000)),
  ]);
} finally {
  watcher.close();
  await fs.writeFile(mutationTarget, 'before');
}
assert.equal(guardedCapture.isolation.guardStatus, 'mutated');
const guardReport = compareQualifiedCaptures({
  fixture,
  legacyRuns: [guardedCapture, legacySecond],
  candidateRuns: [candidate, candidateSecond],
});
assert.ok(guardReport.qualificationFailures.includes('unauthorized-write'));

// Deterministically inject an unauthorized write after the guard snapshot and
// before the child starts. The watcher case above remains as OS-level coverage.
await fs.writeFile(mutationTarget, 'before');
const originalMkdtemp = fs.mkdtemp;
fs.mkdtemp = async (...args) => {
  const workspace = await originalMkdtemp.call(fs, ...args);
  if (String(args[0]).includes('svger-shadow-capture-')) {
    await fs.writeFile(mutationTarget, 'deterministic injected mutation');
  }
  return workspace;
};
let deterministicGuardCapture;
try {
  deterministicGuardCapture = await captureLegacyRun(fixture, {
    timeoutMs: 15_000,
    guardPaths: [...guards, mutationTarget],
  });
} finally {
  fs.mkdtemp = originalMkdtemp;
  await fs.writeFile(mutationTarget, 'before');
}
assert.equal(deterministicGuardCapture.isolation.guardStatus, 'mutated');
const deterministicGuardReport = compareQualifiedCaptures({
  fixture,
  legacyRuns: [deterministicGuardCapture, legacySecond],
  candidateRuns: [candidate, candidateSecond],
});
assert.ok(
  deterministicGuardReport.qualificationFailures.includes('unauthorized-write')
);

const timeoutReport = compareQualifiedCaptures({
  fixture,
  legacyRuns: [timedOut, legacySecond],
  candidateRuns: [candidate, candidateSecond],
});
assert.ok(timeoutReport.qualificationFailures.includes('capture-timeout'));

// A worker exception is captured as a runner failure; it is not confused with
// a successful but different artifact.
const unsupportedLegacyFixture = {
  ...fixture,
  fixtureId: 'capture-unsupported-legacy',
  options: { ...fixture.options, framework: 'angular', typescript: false },
};
const crashed = await captureLegacyRun(unsupportedLegacyFixture, {
  timeoutMs: 15_000,
  guardPaths: guards,
});
assert.equal(crashed.outcome, 'failed');
assert.equal(crashed.outcomeCode, 'E_CAPTURE_WORKER');
const unsupportedCandidateA = await captureCandidateFixture(
  unsupportedLegacyFixture,
  { path: 'CaptureIcon.ts', content: 'export default 1;' },
  { guardPaths: guards }
);
const unsupportedCandidateB = await captureCandidateFixture(
  unsupportedLegacyFixture,
  { path: 'CaptureIcon.ts', content: 'export default 1;' },
  { guardPaths: guards }
);
const crashReport = compareQualifiedCaptures({
  fixture: unsupportedLegacyFixture,
  legacyRuns: [
    crashed,
    await captureLegacyRun(unsupportedLegacyFixture, {
      timeoutMs: 15_000,
      guardPaths: guards,
    }),
  ],
  candidateRuns: [unsupportedCandidateA, unsupportedCandidateB],
});
assert.ok(
  crashReport.comparison.fixtures[0].mismatches.some(
    mismatch => mismatch.code === 'runner-failure' && mismatch.blocking
  )
);

// Unsupported framework validation is explicitly unverified, never promoted.
const unsupported = await captureCandidateFixture(
  {
    ...fixture,
    fixtureId: 'capture-react',
    options: { ...fixture.options, framework: 'react' },
  },
  {
    path: 'CaptureIcon.tsx',
    content: 'export default function CaptureIcon() { return null; }',
  }
);
assert.equal(unsupported.frameworkValidation.status, 'not-checked');
assert.equal(
  unsupported.frameworkValidation.origin,
  'no-qualified-native-compiler-runner'
);

assert.equal(await fs.readFile(sourcePath, 'utf8'), source);
assert.equal(
  await fs.readFile(path.join(outputDirectory, 'existing.svelte'), 'utf8'),
  'preserve output'
);
assert.equal(
  await fs.readFile(path.join(cacheDirectory, 'entry'), 'utf8'),
  'preserve cache'
);
assert.deepEqual(await fs.readdir(outputDirectory), ['existing.svelte']);
assert.deepEqual(await fs.readdir(cacheDirectory), ['entry']);

await fs.rm(fixtureRoot, { recursive: true, force: true });
console.log('Phase 03.3B-6 oracle robustness qualification passed.');
