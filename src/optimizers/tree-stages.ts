/**
 * Tree-Based Optimization Stages
 * Wrapper for tree-based optimizations in the optimizer pipeline
 * Handles parse → optimize → serialize cycle
 */

import type { OptConfig } from './types.js';
import { parseSVG } from './svg-tree-parser.js';
import { serializeSVGMinified } from './tree-serializer.js';
import { removeUnusedDefsStage } from './remove-unused-defs.js';
import { collapseUselessGroupsStage } from './collapse-useless-groups.js';
import { moveAttributesToParentStage } from './move-attrs-to-parent.js';
import { removeHiddenAndEmptyElementsStage } from './remove-hidden-empty.js';

/**
 * Tree-based optimization stage: Remove unused defs
 */
export async function treeRemoveUnusedDefsStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  // Skip if not enabled for this level
  if (config.level === 'none' || config.level === 'basic') {
    return svg;
  }

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    const result = removeUnusedDefsStage(tree);

    if (result.modified) {
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Tree optimization (remove-unused-defs) failed:', error);
    return svg;
  }
}

/**
 * Tree-based optimization stage: Collapse useless groups
 */
export async function treeCollapseGroupsStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  // Only enabled for aggressive and maximum
  if (!config.collapseGroups) {
    return svg;
  }

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    const result = collapseUselessGroupsStage(tree);

    if (result.modified) {
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Tree optimization (collapse-groups) failed:', error);
    return svg;
  }
}

/**
 * Tree-based optimization stage: Move attributes to parent
 */
export async function treeMoveAttributesToParentStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  // Only enabled for aggressive and maximum
  if (config.level === 'none' || config.level === 'basic') {
    return svg;
  }

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    const result = moveAttributesToParentStage(tree);

    if (result.modified) {
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Tree optimization (move-attrs-to-parent) failed:', error);
    return svg;
  }
}

/**
 * Tree-based optimization stage: Remove hidden and empty elements
 */
export async function treeRemoveHiddenEmptyStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  // Enabled for balanced and above
  if (!config.removeHiddenElements) {
    return svg;
  }

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    const result = removeHiddenAndEmptyElementsStage(tree);

    if (result.modified) {
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Tree optimization (remove-hidden-empty) failed:', error);
    return svg;
  }
}

/**
 * Combined tree-based optimization stage
 * Applies all tree optimizations in one pass for efficiency
 */
export async function treeOptimizationStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  // Skip tree optimizations for none and basic levels
  if (config.level === 'none' || config.level === 'basic') {
    return svg;
  }

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    let modified = false;

    // Apply all tree-based optimizations
    const stages = [
      removeUnusedDefsStage,
      removeHiddenAndEmptyElementsStage,
      moveAttributesToParentStage,
      collapseUselessGroupsStage,
    ];

    for (const stage of stages) {
      const result = stage(tree);
      if (result.modified) {
        modified = true;
      }
    }

    // Serialize only if modified
    if (modified) {
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Tree optimization failed:', error);
    return svg;
  }
}
