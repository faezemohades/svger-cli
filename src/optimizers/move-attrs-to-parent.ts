/**
 * Move Attributes to Parent
 * Hoist inheritable attrs (fill, stroke, opacity) to ancestors if all children share them
 * Reduces duplication and file size
 */

import type { SVGNode } from './svg-tree-parser.js';
import { traverseTree } from './svg-tree-parser.js';

/**
 * Inheritable SVG attributes that can be moved to parent
 */
const INHERITABLE_ATTRIBUTES = new Set([
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'color',
  'visibility',
]);

/**
 * Check if all children have the same value for an attribute
 */
function allChildrenHaveSameAttribute(
  parent: SVGNode,
  attrName: string
): string | null {
  if (parent.children.length === 0) {
    return null;
  }

  let commonValue: string | null = null;

  for (const child of parent.children) {
    // Skip non-element nodes
    if (child.type !== 'element') {
      continue;
    }

    const childValue = child.attrs.get(attrName);

    if (!childValue) {
      // Child doesn't have this attribute
      return null;
    }

    if (commonValue === null) {
      commonValue = childValue;
    } else if (commonValue !== childValue) {
      // Values don't match
      return null;
    }
  }

  return commonValue;
}

/**
 * Move common attributes from children to parent
 */
export function moveAttributesToParent(root: SVGNode): {
  movedCount: number;
  movedAttributes: Array<{ parent: string; attr: string; value: string }>;
} {
  let movedCount = 0;
  const movedAttributes: Array<{
    parent: string;
    attr: string;
    value: string;
  }> = [];

  // Collect nodes to process (avoid modifying during traversal)
  const nodesToProcess: SVGNode[] = [];

  traverseTree(root, node => {
    // Only process groups and svg elements with multiple children
    if ((node.tag === 'g' || node.tag === 'svg') && node.children.length > 1) {
      nodesToProcess.push(node);
    }
  });

  // Process each node
  for (const node of nodesToProcess) {
    // Check each inheritable attribute
    for (const attrName of INHERITABLE_ATTRIBUTES) {
      // Skip if parent already has this attribute
      if (node.attrs.has(attrName)) {
        continue;
      }

      // Check if all children have the same value
      const commonValue = allChildrenHaveSameAttribute(node, attrName);

      if (commonValue !== null) {
        // Move attribute to parent
        node.attrs.set(attrName, commonValue);

        // Remove attribute from all children
        for (const child of node.children) {
          if (child.type === 'element') {
            child.attrs.delete(attrName);
          }
        }

        const parentId = node.attrs.get('id') || node.tag;
        movedAttributes.push({
          parent: parentId,
          attr: attrName,
          value: commonValue,
        });
        movedCount++;
      }
    }
  }

  return {
    movedCount,
    movedAttributes,
  };
}

/**
 * Move attributes to parent stage
 */
export function moveAttributesToParentStage(root: SVGNode): {
  modified: boolean;
  stats: {
    movedCount: number;
    movedAttributes: Array<{ parent: string; attr: string; value: string }>;
  };
} {
  const result = moveAttributesToParent(root);

  return {
    modified: result.movedCount > 0,
    stats: result,
  };
}
