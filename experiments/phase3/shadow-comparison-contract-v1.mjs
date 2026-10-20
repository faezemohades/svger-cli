/** Versioned, experimental report vocabulary for isolated shadow comparisons. */
export const SHADOW_COMPARISON_SCHEMA = 'svger-shadow-comparison-v1';

export const SHADOW_MISMATCH_CODES = Object.freeze([
  'missing-legacy-run',
  'missing-candidate-run',
  'invalid-result',
  'runner-timeout',
  'runner-failure',
  'insufficient-determinism-samples',
  'non-deterministic-output',
  'security-decision-mismatch',
  'artifact-on-security-rejection',
  'missing-output',
  'artifact-bytes-change',
  'text-content-change',
  'namespace-change',
  'reference-change',
  'accessibility-change',
  'framework-validity-mismatch',
  'framework-output-invalid',
  'framework-validity-unverified',
]);

export const SHADOW_MINIMUM_RUNS = 2;
