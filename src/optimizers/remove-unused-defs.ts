/**
 * Remove Unused Defs
 * Traverse tree, mark referenced IDs, prune unreferenced <defs> elements
 * This is a tree-based optimization that can't be done with regex
 */

import type { SVGNode } from './svg-tree-parser.js';
import { traverseTree, findNodesByTag, removeNode } from './svg-tree-parser.js';

/**
 * Patterns that reference IDs
 * - url(#id)
 * - #id (xlink:href, href)
 */
const URL_REFERENCE_REGEX = /url\(#([^)]+)\)/g;
const HREF_REFERENCE_REGEX = /#([^\s"']+)/g;

/**
 * Attributes that can reference IDs
 */
const REFERENCE_ATTRIBUTES = new Set([
  'fill',
  'stroke',
  'filter',
  'clip-path',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
  'href',
  'xlink:href',
]);

/**
 * Find all referenced IDs in the tree
 */
function findReferencedIds(root: SVGNode): Set<string> {
  const referencedIds = new Set<string>();

  traverseTree(root, node => {
    // Check all attributes for ID references
    for (const [attrName, attrValue] of node.attrs.entries()) {
      if (REFERENCE_ATTRIBUTES.has(attrName)) {
        // Check for url(#id) pattern
        let match;
        URL_REFERENCE_REGEX.lastIndex = 0;
        while ((match = URL_REFERENCE_REGEX.exec(attrValue)) !== null) {
          // Prevent infinite loop if regex doesn't advance
          if (match.index === URL_REFERENCE_REGEX.lastIndex) {
            URL_REFERENCE_REGEX.lastIndex++;
          }
          referencedIds.add(match[1]);
        }

        // Check for #id pattern (href, xlink:href)
        if (attrName === 'href' || attrName === 'xlink:href') {
          HREF_REFERENCE_REGEX.lastIndex = 0;
          while ((match = HREF_REFERENCE_REGEX.exec(attrValue)) !== null) {
            // Prevent infinite loop if regex doesn't advance
            if (match.index === HREF_REFERENCE_REGEX.lastIndex) {
              HREF_REFERENCE_REGEX.lastIndex++;
            }
            referencedIds.add(match[1]);
          }
        }
      }
    }

    // Check style attribute for url(#id)
    const style = node.attrs.get('style');
    if (style) {
      let match;
      URL_REFERENCE_REGEX.lastIndex = 0;
      while ((match = URL_REFERENCE_REGEX.exec(style)) !== null) {
        // Prevent infinite loop if regex doesn't advance
        if (match.index === URL_REFERENCE_REGEX.lastIndex) {
          URL_REFERENCE_REGEX.lastIndex++;
        }
        referencedIds.add(match[1]);
      }
    }

    // Check content for CSS (style elements)
    if (node.tag === 'style' && node.content) {
      let match;
      URL_REFERENCE_REGEX.lastIndex = 0;
      while ((match = URL_REFERENCE_REGEX.exec(node.content)) !== null) {
        // Prevent infinite loop if regex doesn't advance
        if (match.index === URL_REFERENCE_REGEX.lastIndex) {
          URL_REFERENCE_REGEX.lastIndex++;
        }
        referencedIds.add(match[1]);
      }
    }
  });

  return referencedIds;
}

/**
 * Find all defined IDs in <defs> and their parent defs node
 */
function findDefinedIds(
  root: SVGNode
): Map<string, { node: SVGNode; parent: SVGNode }> {
  const definedIds = new Map<string, { node: SVGNode; parent: SVGNode }>();

  // Find all <defs> elements
  const defsNodes = findNodesByTag(root, 'defs');

  for (const defsNode of defsNodes) {
    // Check all children of <defs>
    traverseTree(defsNode, node => {
      if (node === defsNode) return; // Skip the defs node itself

      const id = node.attrs.get('id');
      if (id && node.parent) {
        definedIds.set(id, { node, parent: node.parent });
      }
    });
  }

  return definedIds;
}

/**
 * Remove unreferenced definitions from <defs>
 * This includes gradients, patterns, filters, symbols, etc.
 */
export function removeUnusedDefs(root: SVGNode): {
  removedCount: number;
  removedIds: string[];
} {
  const referencedIds = findReferencedIds(root);
  const definedIds = findDefinedIds(root);

  const removedIds: string[] = [];
  let removedCount = 0;

  // Remove unreferenced definitions
  for (const [id, { node }] of definedIds.entries()) {
    if (!referencedIds.has(id)) {
      if (removeNode(node)) {
        removedIds.push(id);
        removedCount++;
      }
    }
  }

  // Remove empty <defs> elements
  const defsNodes = findNodesByTag(root, 'defs');
  for (const defsNode of defsNodes) {
    if (defsNode.children.length === 0) {
      removeNode(defsNode);
    }
  }

  return {
    removedCount,
    removedIds,
  };
}

/**
 * Remove unused definitions and return statistics
 */
export function removeUnusedDefsStage(root: SVGNode): {
  modified: boolean;
  stats: {
    removedCount: number;
    removedIds: string[];
  };
} {
  const result = removeUnusedDefs(root);

  return {
    modified: result.removedCount > 0,
    stats: result,
  };
}
