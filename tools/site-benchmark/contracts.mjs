export const ALLOWED_COUNTS = Object.freeze([50, 100, 170]);
export const MAX_REQUEST_BYTES = 1024;

export const ALLOWED_ORIGINS = new Set([
  'https://faezemohades.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);

export function isAllowedOrigin(origin) {
  return typeof origin === 'string' && ALLOWED_ORIGINS.has(origin);
}

export function parseBenchmarkRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'count') return null;
  return ALLOWED_COUNTS.includes(value.count) ? { count: value.count } : null;
}

export function validateWorkerResult(value, expectedCount) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (
    value.schemaVersion === 1 &&
    Number.isInteger(value.fileCount) &&
    value.fileCount === expectedCount &&
    Number.isInteger(value.succeeded) &&
    Number.isInteger(value.failed) &&
    value.succeeded >= 0 &&
    value.failed >= 0 &&
    value.succeeded + value.failed === expectedCount &&
    Number.isFinite(value.wallTimeMs) && value.wallTimeMs >= 0 &&
    Number.isFinite(value.cpuTimeMs) && value.cpuTimeMs >= 0 &&
    Number.isFinite(value.cpuCoreEquivalent) && value.cpuCoreEquivalent >= 0 &&
    Number.isFinite(value.peakRssBytes) && value.peakRssBytes > 0 &&
    Number.isInteger(value.outputBytes) && value.outputBytes >= 0 &&
    typeof value.engineVersion === 'string' && value.engineVersion.length > 0 &&
    /^[a-f0-9]{64}$/u.test(value.fixtureSha256) &&
    /^[a-f0-9]{64}$/u.test(value.outputSha256)
  );
}
