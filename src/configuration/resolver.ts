import type { SVGConfig } from '../types/index.js';
import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';

export type ConfigurationOrigin =
  'default' | 'configuration-file' | 'compiler' | 'request';

export type ConfigurationOrigins = Readonly<
  Record<string, ConfigurationOrigin>
>;

export interface ConfigurationLayer {
  origin: ConfigurationOrigin;
  value: Partial<SVGConfig>;
}

export interface ResolvedConfiguration {
  config: Readonly<SVGConfig>;
  origins: ConfigurationOrigins;
}

const sensitivePath = /token|secret|password|credential|api[-_]?key/i;

function configurationErrors(
  config: SVGConfig,
  allowedKeys: ReadonlySet<string>
): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(config)) {
    if (!allowedKeys.has(key)) errors.push(`unknown setting "${key}"`);
  }

  const record = config as unknown as Record<string, unknown>;
  const frameworks = [
    'react',
    'react-native',
    'vue',
    'svelte',
    'angular',
    'solid',
    'preact',
    'lit',
    'vanilla',
  ];
  if (!frameworks.includes(String(record.framework))) {
    errors.push('framework must name a supported framework');
  }
  for (const key of ['source', 'output']) {
    if (typeof record[key] !== 'string' || record[key].length === 0) {
      errors.push(`${key} must be a non-empty string`);
    }
  }
  if (typeof record.typescript !== 'boolean') {
    errors.push('typescript must be a boolean');
  }
  for (const key of ['watch', 'parallel', 'cache']) {
    if (typeof record[key] !== 'boolean') {
      errors.push(`${key} must be a boolean`);
    }
  }
  for (const key of [
    'batchSize',
    'maxConcurrency',
    'defaultWidth',
    'defaultHeight',
  ]) {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      errors.push(`${key} must be a positive finite number`);
    }
  }
  if (
    record.maxInputSizeBytes !== undefined &&
    (!Number.isSafeInteger(record.maxInputSizeBytes) ||
      (record.maxInputSizeBytes as number) <= 0)
  ) {
    errors.push('maxInputSizeBytes must be a positive safe integer');
  }
  if (
    record.unsafeInputPolicy !== undefined &&
    record.unsafeInputPolicy !== 'reject' &&
    record.unsafeInputPolicy !== 'strip'
  ) {
    errors.push('unsafeInputPolicy must be "reject" or "strip"');
  }
  if (
    record.outputConfig &&
    isRecord(record.outputConfig) &&
    record.outputConfig.naming !== undefined &&
    !['kebab', 'pascal', 'camel'].includes(String(record.outputConfig.naming))
  ) {
    errors.push('outputConfig.naming must be "kebab", "pascal", or "camel"');
  }
  if (record.frameworkOptions !== undefined) {
    const frameworkOptions = record.frameworkOptions;
    const supportedOptions: Record<string, readonly string[]> = {
      scriptSetup: ['vue'],
      standalone: ['angular'],
    };
    if (!isRecord(frameworkOptions)) {
      errors.push('frameworkOptions must be an object');
    } else {
      for (const [key, value] of Object.entries(frameworkOptions)) {
        const supportedFrameworks = supportedOptions[key];
        if (!supportedFrameworks) {
          errors.push(`frameworkOptions contains unsupported option "${key}"`);
        } else if (typeof value !== 'boolean') {
          errors.push(`frameworkOptions.${key} must be a boolean`);
        } else if (!supportedFrameworks.includes(String(record.framework))) {
          errors.push(
            `frameworkOptions.${key} is not supported for ${String(record.framework)}`
          );
        }
      }
    }
  }
  if (
    isRecord(record.performance) &&
    record.performance.optimization !== undefined &&
    !['fast', 'balanced', 'maximum'].includes(
      String(record.performance.optimization)
    )
  ) {
    errors.push(
      'performance.optimization must be "fast", "balanced", or "maximum"'
    );
  }
  if (
    isRecord(record.errorHandling) &&
    record.errorHandling.strategy !== undefined &&
    !['continue', 'stop', 'retry'].includes(
      String(record.errorHandling.strategy)
    )
  ) {
    errors.push(
      'errorHandling.strategy must be "continue", "stop", or "retry"'
    );
  }
  if (
    isRecord(record.errorHandling) &&
    (!Number.isSafeInteger(record.errorHandling.maxRetries) ||
      (record.errorHandling.maxRetries as number) < 0 ||
      !Number.isFinite(record.errorHandling.timeout) ||
      (record.errorHandling.timeout as number) < 0)
  ) {
    errors.push(
      'errorHandling.maxRetries and timeout must be non-negative numbers'
    );
  }
  if (
    !Array.isArray(record.include) ||
    !record.include.every(item => typeof item === 'string')
  ) {
    errors.push('include must be an array of strings');
  }
  if (
    !Array.isArray(record.exclude) ||
    !record.exclude.every(item => typeof item === 'string')
  ) {
    errors.push('exclude must be an array of strings');
  }
  if (
    record.styleRules === null ||
    !isRecord(record.styleRules) ||
    Object.values(record.styleRules).some(value => typeof value !== 'string')
  ) {
    errors.push('styleRules must be a string-valued object');
  }
  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item)) as T;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneValue(child)])
    ) as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach(item => deepFreeze(item));
    return Object.freeze(value);
  }
  if (isRecord(value)) {
    Object.values(value).forEach(child => deepFreeze(child));
    return Object.freeze(value) as T;
  }
  return value;
}

function recordOrigins(
  value: unknown,
  origin: ConfigurationOrigin,
  origins: Record<string, ConfigurationOrigin>,
  prefix = ''
): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      recordOrigins(child, origin, origins, `${prefix}.${index}`)
    );
    if (value.length === 0 && prefix) origins[prefix] = origin;
    return;
  }
  if (!isRecord(value)) {
    if (prefix) origins[prefix] = origin;
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (isRecord(child) || Array.isArray(child)) {
      recordOrigins(child, origin, origins, path);
    } else {
      origins[path] = origin;
    }
  }
}

function mergeRecord(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): void {
  for (const [key, sourceValue] of Object.entries(source)) {
    if (sourceValue === undefined) continue;
    const targetValue = target[key];
    if (isRecord(sourceValue) && isRecord(targetValue)) {
      mergeRecord(targetValue, sourceValue);
    } else {
      target[key] = cloneValue(sourceValue);
    }
  }
}

/** Schema-preserving merge: objects merge recursively and arrays replace. */
export function resolveConfiguration(
  defaultConfig: SVGConfig,
  layers: readonly ConfigurationLayer[]
): ResolvedConfiguration {
  const result = cloneValue(defaultConfig) as unknown as Record<
    string,
    unknown
  >;
  const origins: Record<string, ConfigurationOrigin> = {};
  recordOrigins(defaultConfig, 'default', origins);

  for (const layer of layers) {
    mergeRecord(result, layer.value as unknown as Record<string, unknown>);
    recordOrigins(layer.value, layer.origin, origins);
  }

  const config = result as unknown as SVGConfig;
  const errors = configurationErrors(
    config,
    new Set([...Object.keys(defaultConfig), 'frameworkOptions'])
  );
  if (errors.length > 0) {
    throw new DiagnosticError(
      'E_INVALID_CONFIGURATION',
      `Invalid configuration: ${errors.join('; ')}.`,
      { exitCode: ExitCode.InvalidConfiguration }
    );
  }

  return {
    config: deepFreeze(config),
    origins: Object.freeze({ ...origins }),
  };
}

export function explainConfiguration(
  resolved: ResolvedConfiguration
): readonly { path: string; origin: ConfigurationOrigin; value: unknown }[] {
  return Object.freeze(
    Object.entries(resolved.origins)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([path, origin]) => {
        const value = path
          .split('.')
          .reduce<unknown>(
            (current, key) =>
              isRecord(current) || Array.isArray(current)
                ? (current as Record<string, unknown>)[key]
                : undefined,
            resolved.config
          );
        return Object.freeze({
          path,
          origin,
          value: sensitivePath.test(path) ? '[REDACTED]' : value,
        });
      })
  );
}
