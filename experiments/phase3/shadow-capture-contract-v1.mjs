/** Versioned, experimental provenance contract for 03.3B-1 captures. */
export const SHADOW_CAPTURE_SCHEMA = 'svger-shadow-capture-v5';
export const SHADOW_CAPTURE_QUALIFICATION_SCHEMA =
  'svger-shadow-capture-qualification-v5';

export const CAPTURE_FAILURE_CODES = Object.freeze([
  'capture-timeout',
  'capture-failed',
  'fixture-identity-mismatch',
  'toolchain-mismatch',
  'capture-provenance-invalid',
  'oracle-schema-incompatible',
  'oracle-evidence-invalid',
  'semantic-evidence-unverified',
  'semantic-validity-not-valid',
  'framework-validation-unverified',
  'framework-validation-failed',
  'framework-validation-timeout',
  'unauthorized-write',
  'capture-workspace-mutated',
  'duplicate-capture-id',
  'insufficient-capture-samples',
  'artifact-analysis-unavailable',
  'artifact-analysis-invalid',
  'artifact-analysis-provenance-invalid',
  'artifact-analysis-schema-incompatible',
  'artifact-semantic-mismatch',
  'artifact-semantic-coverage-incomplete',
  'artifact-semantic-validity-not-valid',
  'artifact-analysis-nondeterministic',
  'promotion-not-authorized',
]);

export const SEMANTIC_PROJECTION_METHOD =
  'phase2-saxes-to-phase3-ir-v1-static-svg-source-oracle-v3';

export const MAX_CAPTURE_INPUT_BYTES = 4 * 1024 * 1024;
export const MAX_CAPTURE_ARTIFACT_BYTES = 4 * 1024 * 1024;
export const MAX_CAPTURE_OUTPUT_BYTES = 8 * 1024 * 1024;
export const DEFAULT_CAPTURE_TIMEOUT_MS = 10_000;
