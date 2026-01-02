/**
 * Phase 4.5: Path Merging + <use> Extraction
 *
 * The ultimate optimization for icon libraries and sprite sheets with repeated shapes.
 * Detects identical shapes and extracts them to <defs> with <use> references.
 *
 * Target: 70-80% reduction on icon sets with duplicates (Material Icons, Font Awesome, etc.)
 *
 * Features:
 * 1. Identical shape detection using path hash + style signature
 * 2. Extract repeated shapes to <defs> and replace with <use>
 * 3. Merge adjacent paths with identical styling
 * 4. Transform-aware deduplication
 * 5. Minimum occurrence threshold (only extract if used 2+ times)
 *
 * This is the crowning achievement that makes svger-cli unbeatable.
 */

import type { OptConfig } from './types.js';
import { parseSVG, SVGNode } from './svg-tree-parser.js';
import { serializeSVGMinified, serializeNode } from './tree-serializer.js';
import { OptLevel } from './types.js';

/** Shape signature for deduplication */
interface ShapeSignature {
  /** Path data (normalized) */
  path: string;
  /** Style attributes hash */
  styleHash: string;
  /** Fill color */
  fill?: string;
  /** Stroke color */
  stroke?: string;
  /** Stroke width */
  strokeWidth?: string;
  /** Other relevant attributes */
  attrs: Map<string, string>;
}

/** Duplicate shape occurrence */
interface ShapeOccurrence {
  /** The node containing the shape */
  node: SVGNode;
  /** Parent node (for replacement) */
  parent: SVGNode | null;
  /** Transform applied to this occurrence */
  transform?: string;
  /** Position in parent's children */
  childIndex: number;
}

/** Deduplicated shape definition */
interface DeduplicatedShape {
  /** Unique ID for this shape */
  id: string;
  /** Shape signature */
  signature: ShapeSignature;
  /** All occurrences of this shape */
  occurrences: ShapeOccurrence[];
  /** Original node (to be moved to <defs>) */
  originalNode: SVGNode;
}

/**
 * Create a hash from style attributes
 */
function hashStyleAttributes(node: SVGNode): string {
  const styleAttrs = [
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
  ];

  const parts: string[] = [];
  for (const attr of styleAttrs) {
    const value = node.attrs.get(attr);
    if (value) {
      parts.push(`${attr}:${value}`);
    }
  }

  return parts.sort().join(';');
}

/**
 * Normalize path data for comparison (remove whitespace, normalize numbers)
 */
function normalizePath(pathData: string): string {
  return pathData
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/([a-z])\s+/gi, '$1')
    .toLowerCase();
}

/**
 * Extract shape signature from a node
 */
function extractShapeSignature(node: SVGNode): ShapeSignature | null {
  // Only handle path, rect, circle, ellipse, polygon, polyline
  const shapeTypes = [
    'path',
    'rect',
    'circle',
    'ellipse',
    'polygon',
    'polyline',
  ];
  if (!shapeTypes.includes(node.tag || '')) {
    return null;
  }

  let path = '';

  if (node.tag === 'path') {
    path = node.attrs.get('d') || '';
  } else if (node.tag === 'rect') {
    const x = node.attrs.get('x') || '0';
    const y = node.attrs.get('y') || '0';
    const w = node.attrs.get('width') || '0';
    const h = node.attrs.get('height') || '0';
    path = `rect:${x},${y},${w},${h}`;
  } else if (node.tag === 'circle') {
    const cx = node.attrs.get('cx') || '0';
    const cy = node.attrs.get('cy') || '0';
    const r = node.attrs.get('r') || '0';
    path = `circle:${cx},${cy},${r}`;
  } else if (node.tag === 'ellipse') {
    const cx = node.attrs.get('cx') || '0';
    const cy = node.attrs.get('cy') || '0';
    const rx = node.attrs.get('rx') || '0';
    const ry = node.attrs.get('ry') || '0';
    path = `ellipse:${cx},${cy},${rx},${ry}`;
  } else if (node.tag === 'polygon' || node.tag === 'polyline') {
    const points = node.attrs.get('points') || '';
    path = `${node.tag}:${points}`;
  }

  if (!path) return null;

  return {
    path: normalizePath(path),
    styleHash: hashStyleAttributes(node),
    fill: node.attrs.get('fill'),
    stroke: node.attrs.get('stroke'),
    strokeWidth: node.attrs.get('stroke-width'),
    attrs: new Map(node.attrs),
  };
}

/**
 * Create a unique signature key for deduplication
 */
function createSignatureKey(sig: ShapeSignature): string {
  return `${sig.path}|${sig.styleHash}`;
}

/**
 * Find all shapes in the SVG tree
 */
function findAllShapes(
  node: SVGNode,
  parent: SVGNode | null = null,
  shapes: Map<string, DeduplicatedShape> = new Map()
): Map<string, DeduplicatedShape> {
  const signature = extractShapeSignature(node);

  if (signature) {
    const key = createSignatureKey(signature);

    if (!shapes.has(key)) {
      // First occurrence - create new entry
      shapes.set(key, {
        id: `shape-${shapes.size + 1}`,
        signature,
        occurrences: [],
        originalNode: node,
      });
    }

    const shape = shapes.get(key)!;
    const childIndex = parent?.children?.findIndex(c => c === node) ?? -1;

    shape.occurrences.push({
      node,
      parent,
      transform: node.attrs.get('transform'),
      childIndex,
    });
  }

  // Recurse to children
  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'element') {
        findAllShapes(child as SVGNode, node, shapes);
      }
    }
  }

  return shapes;
}

/**
 * Check if a shape should be deduplicated
 */
function shouldDeduplicate(
  shape: DeduplicatedShape,
  minOccurrences: number
): boolean {
  // Must appear at least minOccurrences times
  if (shape.occurrences.length < minOccurrences) {
    return false;
  }

  // Calculate savings: original size * occurrences - (def + uses)
  const pathLength = shape.signature.path.length;
  const styleLength = shape.signature.styleHash.length;
  const shapeSize = pathLength + styleLength;

  // Realistic estimate:
  // - Shape in <defs> with id: shapeSize + 15 bytes (id="shape-X")
  // - Each <use>: ~30 bytes (<use xlink:href="#shape-X"/>)
  // - <defs> wrapper overhead: ~20 bytes total
  const currentSize = shapeSize * shape.occurrences.length;
  const deduplicatedSize = shapeSize + 15 + shape.occurrences.length * 30 + 20;

  const shouldExtract = deduplicatedSize < currentSize;

  return shouldExtract;
}

/**
 * Create a <defs> node if it doesn't exist
 */
function getOrCreateDefs(root: SVGNode): SVGNode {
  // Check if <defs> already exists
  if (root.children) {
    const existingDefs = root.children.find(
      c => c.type === 'element' && (c as SVGNode).tag === 'defs'
    );
    if (existingDefs) {
      return existingDefs as SVGNode;
    }
  }

  // Create new <defs>
  const defs: SVGNode = {
    type: 'element',
    tag: 'defs',
    attrs: new Map(),
    children: [],
  };

  // Add to beginning of root's children
  if (!root.children) {
    root.children = [];
  }
  root.children.unshift(defs);

  return defs;
}

/**
 * Extract repeated shapes to <defs> and replace with <use>
 */
export function extractRepeatedShapes(
  svgContent: string,
  config: OptConfig
): { result: string; shapesExtracted: number; bytesReduced: number } {
  try {
    const tree = parseSVG(svgContent);
    if (!tree) {
      return { result: svgContent, shapesExtracted: 0, bytesReduced: 0 };
    }

    // Find all shapes
    const shapes = findAllShapes(tree);

    // Filter shapes that should be deduplicated
    const minOccurrences =
      config.optimizationLevel === OptLevel.MAXIMUM ? 2 : 3;
    const shapesToExtract = Array.from(shapes.values()).filter(s =>
      shouldDeduplicate(s, minOccurrences)
    );

    if (shapesToExtract.length === 0) {
      return { result: svgContent, shapesExtracted: 0, bytesReduced: 0 };
    }

    // Get or create <defs>
    const defs = getOrCreateDefs(tree);

    let totalBytesReduced = 0;

    // Process each shape
    for (const shape of shapesToExtract) {
      // Clone the original node for <defs>
      const defNode: SVGNode = {
        type: 'element',
        tag: shape.originalNode.tag,
        attrs: new Map(shape.originalNode.attrs),
        children: shape.originalNode.children
          ? [...shape.originalNode.children]
          : [],
      };

      // Add ID to definition
      defNode.attrs.set('id', shape.id);

      // Remove transform from definition (will be on <use>)
      defNode.attrs.delete('transform');

      // Add to <defs>
      if (!defs.children) {
        defs.children = [];
      }
      defs.children.push(defNode);

      // Replace all occurrences with <use>
      for (const occurrence of shape.occurrences) {
        if (!occurrence.parent || occurrence.childIndex === -1) continue;

        // Create <use> node
        const useNode: SVGNode = {
          type: 'element',
          tag: 'use',
          attrs: new Map(),
          children: [],
        };

        // Set href to definition
        useNode.attrs.set('href', `#${shape.id}`);
        useNode.attrs.set('xlink:href', `#${shape.id}`); // For older browsers

        // Preserve transform if present
        if (occurrence.transform) {
          useNode.attrs.set('transform', occurrence.transform);
        }

        // Calculate bytes reduced
        const originalSize = serializeNode(occurrence.node, {
          minify: true,
        }).length;
        const useSize = serializeNode(useNode, { minify: true }).length;
        totalBytesReduced += originalSize - useSize;

        // Replace in parent
        if (occurrence.parent.children) {
          occurrence.parent.children[occurrence.childIndex] = useNode;
        }
      }
    }

    const result = serializeSVGMinified(tree);

    return {
      result,
      shapesExtracted: shapesToExtract.length,
      bytesReduced: totalBytesReduced,
    };
  } catch (error) {
    console.warn('Shape extraction failed:', error);
    return { result: svgContent, shapesExtracted: 0, bytesReduced: 0 };
  }
}

/**
 * Merge adjacent paths with identical styling
 */
export function mergeAdjacentPaths(svgContent: string): {
  result: string;
  pathsMerged: number;
} {
  try {
    const tree = parseSVG(svgContent);
    if (!tree) {
      return { result: svgContent, pathsMerged: 0 };
    }

    let totalMerged = 0;

    // Traverse tree and merge paths in each container
    const mergePaths = (node: SVGNode) => {
      if (!node.children || node.children.length < 2) {
        // Recurse to children first
        if (node.children) {
          for (const child of node.children) {
            if (child.type === 'element') {
              mergePaths(child as SVGNode);
            }
          }
        }
        return;
      }

      // Find adjacent path elements with same style
      const newChildren: typeof node.children = [];
      let i = 0;

      while (i < node.children.length) {
        const child = node.children[i];

        if (child.type !== 'element' || (child as SVGNode).tag !== 'path') {
          newChildren.push(child);
          i++;
          continue;
        }

        const pathNode = child as SVGNode;
        const pathData = pathNode.attrs.get('d');
        if (!pathData) {
          newChildren.push(child);
          i++;
          continue;
        }

        const styleHash = hashStyleAttributes(pathNode);
        const mergedPaths: string[] = [pathData];

        // Look ahead for adjacent paths with same style
        let j = i + 1;
        while (j < node.children.length) {
          const nextChild = node.children[j];
          if (nextChild.type !== 'element') {
            break;
          }

          const nextNode = nextChild as SVGNode;
          if (nextNode.tag !== 'path') {
            break;
          }

          const nextPathData = nextNode.attrs.get('d');
          const nextStyleHash = hashStyleAttributes(nextNode);

          if (nextStyleHash !== styleHash || !nextPathData) {
            break;
          }

          // Same style - merge
          mergedPaths.push(nextPathData);
          j++;
          totalMerged++;
        }

        // Create merged path
        if (mergedPaths.length > 1) {
          const mergedNode: SVGNode = {
            type: 'element',
            tag: 'path',
            attrs: new Map(pathNode.attrs),
            children: [],
          };

          // Combine path data with space separator
          mergedNode.attrs.set('d', mergedPaths.join(' '));
          newChildren.push(mergedNode);
        } else {
          newChildren.push(pathNode);
        }

        i = j;
      }

      node.children = newChildren;

      // Recurse to children
      for (const child of node.children) {
        if (child.type === 'element') {
          mergePaths(child as SVGNode);
        }
      }
    };

    mergePaths(tree);

    if (totalMerged > 0) {
      const result = serializeSVGMinified(tree);
      return { result, pathsMerged: totalMerged };
    }

    return { result: svgContent, pathsMerged: 0 };
  } catch (error) {
    console.warn('Path merging failed:', error);
    return { result: svgContent, pathsMerged: 0 };
  }
}

/**
 * Combined path merging and <use> extraction stage
 */
export async function pathDeduplicationStage(
  svg: string,
  config: OptConfig
): Promise<string> {
  if (!config.mergePaths) {
    return svg;
  }

  try {
    let result = svg;

    // Step 1: Merge adjacent paths with same style
    const merged = mergeAdjacentPaths(result);
    if (merged.pathsMerged > 0) {
      console.log(
        `[path-deduplication] Merged ${merged.pathsMerged} adjacent paths`
      );
      result = merged.result;
    }

    // Step 2: Extract repeated shapes to <defs>
    const extracted = extractRepeatedShapes(result, config);
    if (extracted.shapesExtracted > 0) {
      console.log(
        `[path-deduplication] Extracted ${extracted.shapesExtracted} repeated shapes to <defs>`
      );
      result = extracted.result;
    }

    return result;
  } catch (error) {
    console.warn('Path deduplication failed:', error);
    return svg;
  }
}
