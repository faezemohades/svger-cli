import type { SVGConfig } from '../types/index.js';

export type ConfigurationOrigin =
  | 'default'
  | 'configuration-file'
  | 'compiler'
  | 'request';

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
  if (!isRecord(value)) {
    if (prefix) origins[prefix] = origin;
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (isRecord(child)) {
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

  return {
    config: deepFreeze(result as unknown as SVGConfig),
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
        return Object.freeze({ path, origin, value });
      })
  );
}
