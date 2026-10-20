/** Isolated child worker. Protocol is one JSON request in, one JSON record out. */
import { readFileSync } from 'node:fs';
import { SVGProcessor } from '../../dist/processors/svg-processor.js';
import { NullLogger } from '../../dist/core/logger.js';
import { PerformanceEngine } from '../../dist/core/performance-engine.js';
import { FrameworkTemplateEngine } from '../../dist/core/framework-templates.js';
import { compile, VERSION } from 'svelte/compiler';
import { analyzeSvelteArtifact } from './svelte-artifact-oracle.mjs';

const request = JSON.parse(readFileSync(0, 'utf8'));

if (request.kind === 'generate-legacy') {
  const processor = new SVGProcessor({
    logger: new NullLogger(),
    performanceEngine: new PerformanceEngine(),
    frameworkTemplateEngine: new FrameworkTemplateEngine(),
    pluginManager: { activePluginCount: 0 },
  });
  const content = await processor.generateComponent(
    request.componentName,
    request.source,
    {
      framework: request.options.framework,
      typescript: request.options.typescript,
      optimizationLevel: request.options.optimizationLevel,
      unsafeInputPolicy: 'reject',
    }
  );
  process.stdout.write(JSON.stringify({ content }));
} else if (request.kind === 'validate-svelte') {
  let validation;
  try {
    const result = compile(request.content, {
      filename: request.filename,
      generate: 'dom',
    });
    validation = {
      status: 'valid',
      compiler: { name: 'svelte', version: VERSION },
      diagnosticCodes: result.warnings.map(warning => warning.code).sort(),
    };
  } catch {
    validation = {
      status: 'invalid',
      compiler: { name: 'svelte', version: VERSION },
      diagnosticCodes: ['E_FRAMEWORK_COMPILE'],
    };
  }
  const artifactAnalysis = analyzeSvelteArtifact({
    path: request.filename,
    content: request.content,
  });
  process.stdout.write(JSON.stringify({ ...validation, artifactAnalysis }));
} else {
  process.stderr.write('unsupported worker request');
  process.exitCode = 2;
}
