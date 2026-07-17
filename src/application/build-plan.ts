import path from 'path';
import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';
import type { Diagnostic } from '../contracts/diagnostics.js';
import type { DiscoveredSource } from './source-discovery.js';

export type CollisionPolicy = 'error' | 'first' | 'last';

export interface BuildPlanItem extends DiscoveredSource {
  componentName: string;
  outputFileName: string;
  outputPath: string;
}

export interface BuildPlan {
  items: readonly BuildPlanItem[];
  diagnostics: readonly Diagnostic[];
}

export interface BuildPlannerAdapter {
  componentName(fileName: string): string;
  outputFileName(componentName: string): string;
}

export function createBuildPlan(
  sources: readonly DiscoveredSource[],
  outputDir: string,
  adapter: BuildPlannerAdapter,
  collisionPolicy: CollisionPolicy = 'error'
): BuildPlan {
  const candidates = sources.map(source => {
    const componentName = adapter.componentName(
      path.basename(source.relativePath)
    );
    const outputFileName = adapter.outputFileName(componentName);
    return Object.freeze({
      ...source,
      componentName,
      outputFileName,
      outputPath: path.join(outputDir, outputFileName),
    });
  });
  const byOutput = new Map<string, BuildPlanItem[]>();
  for (const item of candidates) {
    const key = item.outputFileName.normalize('NFC').toLocaleLowerCase('en');
    const group = byOutput.get(key) ?? [];
    group.push(item);
    byOutput.set(key, group);
  }

  const collisions = [...byOutput.values()].filter(group => group.length > 1);
  if (collisions.length > 0 && collisionPolicy === 'error') {
    const metadata = Object.fromEntries(
      collisions.map((group, index) => [
        `collision${index + 1}`,
        group.map(item => item.relativePath).join(', '),
      ])
    );
    throw new DiagnosticError(
      'E_NAME_COLLISION',
      `${collisions.length} generated output name collision${collisions.length === 1 ? '' : 's'} detected.`,
      {
        exitCode: ExitCode.NameCollision,
        hint: 'Rename a source or set collision policy to first or last.',
        metadata,
      }
    );
  }

  const selected = new Set<BuildPlanItem>();
  const diagnostics: Diagnostic[] = [];
  for (const group of byOutput.values()) {
    const chosen =
      collisionPolicy === 'last' ? group[group.length - 1] : group[0];
    selected.add(chosen);
    if (group.length > 1) {
      diagnostics.push({
        code: 'W_NAME_COLLISION_RESOLVED',
        severity: 'warning',
        message: `Selected ${chosen.relativePath} for ${chosen.outputFileName} using the ${collisionPolicy} policy.`,
        file: chosen.relativePath,
      });
    }
  }

  return Object.freeze({
    items: Object.freeze(
      candidates.filter(candidate => selected.has(candidate))
    ),
    diagnostics: Object.freeze(diagnostics),
  });
}
