import path from 'path';
import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';
import type { Diagnostic } from '../contracts/diagnostics.js';
import type { DiscoveredSource } from './source-discovery.js';
import type { FrameworkType } from '../types/index.js';
import type { ComponentExportStyle } from './artifact-contract.js';

export type CollisionPolicy = 'error' | 'first' | 'last';

export interface BuildPlanItem extends DiscoveredSource {
  componentName: string;
  outputFileName: string;
  outputPath: string;
  exportStyle?: ComponentExportStyle;
  exportedName?: string;
  moduleSpecifier?: string;
}

export interface PlannedArtifact {
  role: 'component' | 'barrel';
  fileName: string;
  outputPath: string;
  framework?: FrameworkType;
  typescript?: boolean;
  componentName?: string;
  exportStyle?: ComponentExportStyle;
  exportedName?: string;
  moduleSpecifier?: string;
}

export interface BuildPlan {
  items: readonly BuildPlanItem[];
  artifacts: readonly PlannedArtifact[];
  diagnostics: readonly Diagnostic[];
}

export interface BuildPlannerAdapter {
  componentName(fileName: string): string;
  outputFileName(componentName: string): string;
  exportStyle?(componentName: string): ComponentExportStyle;
  exportedName?(componentName: string): string;
  moduleSpecifier?(componentName: string, outputFileName: string): string;
}

export interface BuildPlannerOptions {
  framework?: FrameworkType;
  typescript?: boolean;
  barrelFileName?: string;
}

export function createBuildPlan(
  sources: readonly DiscoveredSource[],
  outputDir: string,
  adapter: BuildPlannerAdapter,
  collisionPolicy: CollisionPolicy = 'error',
  options: BuildPlannerOptions = {}
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
      ...(adapter.exportStyle && {
        exportStyle: adapter.exportStyle(componentName),
      }),
      ...(adapter.exportedName && {
        exportedName: adapter.exportedName(componentName),
      }),
      ...(adapter.moduleSpecifier && {
        moduleSpecifier: adapter.moduleSpecifier(componentName, outputFileName),
      }),
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
        group
          .map(item => `${item.relativePath} -> ${item.outputFileName}`)
          .join(', '),
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

  const selectedItems = candidates.filter(candidate => selected.has(candidate));
  const artifacts: PlannedArtifact[] = selectedItems.map(item => ({
    role: 'component',
    fileName: item.outputFileName,
    outputPath: item.outputPath,
    ...(options.framework === undefined
      ? {}
      : { framework: options.framework }),
    ...(options.typescript === undefined
      ? {}
      : { typescript: options.typescript }),
    componentName: item.componentName,
    ...(item.exportStyle === undefined
      ? {}
      : { exportStyle: item.exportStyle }),
    ...(item.exportedName === undefined
      ? {}
      : { exportedName: item.exportedName }),
    ...(item.moduleSpecifier === undefined
      ? {}
      : { moduleSpecifier: item.moduleSpecifier }),
  }));
  if (options.barrelFileName) {
    artifacts.push({
      role: 'barrel',
      fileName: options.barrelFileName,
      outputPath: path.join(outputDir, options.barrelFileName),
      ...(options.framework === undefined
        ? {}
        : { framework: options.framework }),
      ...(options.typescript === undefined
        ? {}
        : { typescript: options.typescript }),
    });
  }

  const artifactConflicts = findArtifactConflicts(artifacts);
  if (artifactConflicts.length > 0) {
    const metadata = Object.fromEntries(
      artifactConflicts.map((conflict, index) => [
        `collision${index + 1}`,
        conflict.map(artifact => artifact.fileName).join(', '),
      ])
    );
    throw new DiagnosticError(
      'E_ARTIFACT_COLLISION',
      `${artifactConflicts.length} generated artifact collision${artifactConflicts.length === 1 ? '' : 's'} detected.`,
      {
        exitCode: ExitCode.NameCollision,
        hint: 'Rename the affected SVG source or change its output naming convention.',
        metadata,
      }
    );
  }

  return Object.freeze({
    items: Object.freeze(selectedItems),
    artifacts: Object.freeze(
      artifacts.map(artifact => Object.freeze(artifact))
    ),
    diagnostics: Object.freeze(diagnostics),
  });
}

function findArtifactConflicts(
  artifacts: readonly PlannedArtifact[]
): PlannedArtifact[][] {
  const conflicts: PlannedArtifact[][] = [];
  for (let left = 0; left < artifacts.length; left++) {
    for (let right = left + 1; right < artifacts.length; right++) {
      const first = artifacts[left];
      const second = artifacts[right];
      const firstParts = normalizedPathParts(first.fileName);
      const secondParts = normalizedPathParts(second.fileName);
      const shorter = Math.min(firstParts.length, secondParts.length);
      const pathPrefixConflict =
        firstParts.slice(0, shorter).join('/') ===
        secondParts.slice(0, shorter).join('/');
      const sameStem =
        normalizedStem(first.fileName) === normalizedStem(second.fileName);
      const barrelStemConflict =
        sameStem && (first.role === 'barrel' || second.role === 'barrel');
      if (pathPrefixConflict || barrelStemConflict) {
        conflicts.push([first, second]);
      }
    }
  }
  return conflicts;
}

function normalizedPathParts(fileName: string): string[] {
  return fileName
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(part => part.normalize('NFC').toLocaleLowerCase('en'));
}

function normalizedStem(fileName: string): string {
  return path.parse(fileName).name.normalize('NFC').toLocaleLowerCase('en');
}
