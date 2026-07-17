import path from 'path';
import { promises as fs } from 'fs';
import { NullLogger } from '../core/logger.js';
import { configService } from '../services/config.js';
import { SVGProcessor } from '../processors/svg-processor.js';
import { isLocked } from '../lock.js';
import type { Logger, SVGConfig } from '../types/index.js';
import type { ConfigurationLayer } from '../configuration/resolver.js';
import {
  explainConfiguration,
  resolveConfiguration,
} from '../configuration/resolver.js';
import {
  SVGCompilerApplicationService,
  type BuildRequest,
} from '../application/svg-compiler-application-service.js';
import type { BuildReport } from '../contracts/reporting.js';
import { ContentAddressableCache } from '../cache/content-addressable-cache.js';
import { PerformanceEngine } from '../core/performance-engine.js';
import { FrameworkTemplateEngine } from '../core/framework-templates.js';
import { EnhancedPluginManager } from '../core/enhanced-plugin-manager.js';

export interface CreateSVGCompilerOptions {
  cwd?: string;
  config?: Partial<SVGConfig>;
  logger?: Logger;
  cacheDirectory?: string;
}

export interface SVGCompiler {
  build(request: BuildRequest): Promise<BuildReport>;
  config: {
    explain(request?: Partial<BuildRequest>): readonly {
      path: string;
      origin: string;
      value: unknown;
    }[];
  };
}

async function readConfigurationLayer(
  cwd: string
): Promise<ConfigurationLayer | undefined> {
  const configPath = path.join(cwd, '.svgconfig.json');
  try {
    const value = JSON.parse(
      await fs.readFile(configPath, 'utf8')
    ) as Partial<SVGConfig>;
    return { origin: 'configuration-file', value };
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Create an isolated compiler context with no mutable configuration globals. */
export async function createSVGCompiler(
  options: CreateSVGCompilerOptions = {}
): Promise<SVGCompiler> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const defaultConfig = configService.getDefaultConfig();
  const fileLayer = await readConfigurationLayer(cwd);
  const layers: ConfigurationLayer[] = [
    ...(fileLayer === undefined ? [] : [fileLayer]),
    ...(options.config === undefined
      ? []
      : [{ origin: 'compiler' as const, value: options.config }]),
  ];
  const scopedLogger = options.logger ?? new NullLogger();
  const service = new SVGCompilerApplicationService({
    cwd,
    defaultConfig,
    configurationLayers: Object.freeze(layers),
    processor: new SVGProcessor({
      logger: scopedLogger,
      performanceEngine: new PerformanceEngine(),
      frameworkTemplateEngine: new FrameworkTemplateEngine(),
      pluginManager: new EnhancedPluginManager(),
    }),
    logger: scopedLogger,
    cache: new ContentAddressableCache(
      path.resolve(cwd, options.cacheDirectory ?? '.svger-cache')
    ),
    isLocked,
  });

  return Object.freeze({
    build: (request: BuildRequest) => service.build(request),
    config: Object.freeze({
      explain: (request: Partial<BuildRequest> = {}) => {
        const requestLayer: ConfigurationLayer = {
          origin: 'request',
          value: request.config ?? {},
        };
        return explainConfiguration(
          resolveConfiguration(defaultConfig, [...layers, requestLayer])
        );
      },
    }),
  });
}
