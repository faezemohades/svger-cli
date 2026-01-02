/**
 * Advanced Optimization Stages
 * Wrappers for Phase 3-5 optimizers in the pipeline
 */

import type { OptConfig } from './types.js';
import { parseSVG } from './svg-tree-parser.js';
import { serializeSVGMinified } from './tree-serializer.js';
import { numericOptimizationStage } from './numeric-optimizer.js';
import { styleOptimizationStage } from './style-optimizer.js';
import { transformOptimizationStage } from './transform-optimizer.js';
import { transformCollapsingStage } from './transform-collapsing.js';
import { shortenPath } from './path-shortener.js';
import { parsePath, serializePath } from './path-parser.js';
import { simplifyPath } from './path-simplifier.js';
import { OptLevel } from './types.js';

/**
 * Numeric optimization stage wrapper
 * Phase 3.1: Coordinate precision, number formatting, etc.
 */
export async function numericStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  if (!config.enableNumericOptimization) {
    return svg;
  }

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    const result = numericOptimizationStage(tree, config);

    if (result.modified) {
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Numeric optimization failed:', error);
    return svg;
  }
}

/**
 * Style optimization stage wrapper
 * Phase 3.2: Color shortening, unit removal, style consolidation
 */
export async function styleStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  if (!config.enableStyleOptimization) {
    return svg;
  }

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    const result = styleOptimizationStage(tree, config);

    if (result.modified) {
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Style optimization failed:', error);
    return svg;
  }
}

/**
 * Transform optimization stage wrapper
 * Phase 3.3: Matrix simplification, transform shortening
 */
export async function transformStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  if (!config.enableTransformOptimization) {
    return svg;
  }

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    const result = transformOptimizationStage(tree, config);

    if (result.modified) {
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Transform optimization failed:', error);
    return svg;
  }
}

/**
 * Transform collapsing stage wrapper
 * Phase 5.1: Propagate transforms, bake into coordinates, collapse groups
 */
export async function transformCollapseStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  if (!config.enableTransformCollapsing) {
    return svg;
  }

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    const result = transformCollapsingStage(tree, config);

    if (result.modified) {
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Transform collapsing failed:', error);
    return svg;
  }
}

/**
 * Path optimization stage wrapper
 * Phase 4.1-4.2: Path parsing, command merging, H/V conversion, abs/rel optimization
 */
export async function pathOptimizationStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  if (!config.enablePathOptimization) {
    return svg;
  }

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    let modified = false;

    // Traverse tree and optimize all path elements
    const optimizePaths = (node: any) => {
      if (node.tag === 'path' && node.attrs.has('d')) {
        const pathData = node.attrs.get('d');
        if (!pathData) return;

        try {
          // Parse path
          const parsed = parsePath(pathData);

          // Shorten path
          const shortened = shortenPath(parsed.commands, config.floatPrecision);

          // Serialize back
          const newPathData = serializePath(
            shortened.commands,
            config.floatPrecision
          );

          // Update if shorter
          if (newPathData.length < pathData.length) {
            node.attrs.set('d', newPathData);
            modified = true;
          }
        } catch (error) {
          // Skip this path if optimization fails
          console.warn('Failed to optimize path:', error);
        }
      }

      // Recurse to children
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'element') {
            optimizePaths(child);
          }
        }
      }
    };

    optimizePaths(tree);

    if (modified) {
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Path optimization failed:', error);
    return svg;
  }
}

/**
 * Path simplification stage wrapper
 * Phase 4.4: Douglas-Peucker and Visvalingam-Whyatt algorithms
 */
export async function pathSimplificationStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  if (!config.enablePathSimplification) {
    return svg;
  }

  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    let modified = false;
    let totalPointsRemoved = 0;

    // Traverse tree and simplify all path elements
    const simplifyPaths = (node: any) => {
      if (node.tag === 'path' && node.attrs.has('d')) {
        const pathData = node.attrs.get('d');
        if (!pathData) return;

        try {
          // Choose algorithm based on optimization level
          const algorithm =
            config.optimizationLevel === OptLevel.MAXIMUM
              ? ('visvalingam' as const)
              : ('douglas-peucker' as const);

          const { simplified, pointsRemoved } = simplifyPath(
            pathData,
            config,
            algorithm
          );

          // Update if points were removed
          if (pointsRemoved > 0 && simplified.length < pathData.length) {
            node.attrs.set('d', simplified);
            totalPointsRemoved += pointsRemoved;
            modified = true;
          }
        } catch (error) {
          // Skip this path if simplification fails
          console.warn('Failed to simplify path:', error);
        }
      }

      // Recurse to children
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'element') {
            simplifyPaths(child);
          }
        }
      }
    };

    simplifyPaths(tree);

    if (modified) {
      console.log(`[path-simplification] Removed ${totalPointsRemoved} points`);
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Path simplification failed:', error);
    return svg;
  }
}

/**
 * Combined advanced optimization stage
 * Applies all Phase 3-5 optimizations in optimal order
 */
export async function advancedOptimizationStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  try {
    const tree = parseSVG(svg);
    if (!tree) return svg;

    let modified = false;

    // Apply optimizations in order:
    // 1. Numeric optimization (coordinate precision)
    if (config.enableNumericOptimization) {
      const result = numericOptimizationStage(tree, config);
      if (result.modified) modified = true;
    }

    // 2. Style optimization (colors, units)
    if (config.enableStyleOptimization) {
      const result = styleOptimizationStage(tree, config);
      if (result.modified) modified = true;
    }

    // 3. Transform optimization (matrix simplification)
    if (config.enableTransformOptimization) {
      const result = transformOptimizationStage(tree, config);
      if (result.modified) modified = true;
    }

    // 4. Transform collapsing (propagate and bake)
    if (config.enableTransformCollapsing) {
      const result = transformCollapsingStage(tree, config);
      if (result.modified) modified = true;
    }

    // 5. Path optimization (command merging, H/V conversion)
    if (config.enablePathOptimization) {
      const optimizePaths = (node: any) => {
        if (node.tag === 'path' && node.attrs.has('d')) {
          const pathData = node.attrs.get('d');
          if (!pathData) return;

          try {
            const parsed = parsePath(pathData);
            const shortened = shortenPath(
              parsed.commands,
              config.floatPrecision
            );
            const newPathData = serializePath(
              shortened.commands,
              config.floatPrecision
            );

            if (newPathData.length < pathData.length) {
              node.attrs.set('d', newPathData);
              modified = true;
            }
          } catch (error) {
            // Skip this path if optimization fails
          }
        }

        if (node.children) {
          for (const child of node.children) {
            if (child.type === 'element') {
              optimizePaths(child);
            }
          }
        }
      };

      optimizePaths(tree);
    }

    if (modified) {
      return serializeSVGMinified(tree);
    }

    return svg;
  } catch (error) {
    console.warn('Advanced optimization failed:', error);
    return svg;
  }
}
