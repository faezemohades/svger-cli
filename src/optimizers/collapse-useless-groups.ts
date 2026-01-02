/**
 * Collapse Useless Groups
 * Remove <g> with no attrs and single child
 * Merge attrs upward if safe (no conflicts)
 */

import type { SVGNode } from './svg-tree-parser.js';
import { traverseTree, replaceNode } from './svg-tree-parser.js';

/**
 * Check if a group is useless (no attributes and single child)
 */
function isUselessGroup(node: SVGNode): boolean {
  return (
    node.tag === 'g' &&
    node.attrs.size === 0 &&
    node.children.length === 1 &&
    !node.content
  );
}

/**
 * Check if attributes can be safely merged from child to parent
 * Returns true if no conflicts exist
 */
function canMergeAttributes(parent: SVGNode, child: SVGNode): boolean {
  // Check for attribute conflicts
  for (const [key] of child.attrs.entries()) {
    if (parent.attrs.has(key)) {
      // Conflict: both have the same attribute
      return false;
    }
  }

  return true;
}

/**
 * Merge child attributes to parent
 */
function mergeAttributesToParent(parent: SVGNode, child: SVGNode): void {
  for (const [key, value] of child.attrs.entries()) {
    if (!parent.attrs.has(key)) {
      parent.attrs.set(key, value);
    }
  }
}

/**
 * Collapse useless groups in the tree
 * A group is useless if:
 * 1. It has no attributes and exactly one child
 * 2. It has attributes that don't conflict with its single child
 */
export function collapseUselessGroups(root: SVGNode): {
  collapsedCount: number;
  collapsedNodes: string[];
} {
  let collapsedCount = 0;
  const collapsedNodes: string[] = [];

  // We need to collect nodes to collapse first
  // to avoid modifying tree during traversal
  const nodesToCollapse: SVGNode[] = [];

  traverseTree(root, node => {
    if (node.tag === 'g') {
      // Case 1: Group with no attributes and single child
      if (isUselessGroup(node)) {
        nodesToCollapse.push(node);
      }
      // Case 2: Group with single child and no attribute conflicts
      else if (node.children.length === 1 && !node.content) {
        const child = node.children[0];
        if (canMergeAttributes(child, node)) {
          nodesToCollapse.push(node);
        }
      }
    }
  });

  // Collapse collected nodes
  for (const node of nodesToCollapse) {
    if (!node.parent) continue;

    const child = node.children[0];

    // For groups with no attrs, just replace group with child
    if (node.attrs.size === 0) {
      if (replaceNode(node, child)) {
        const id = node.attrs.get('id') || 'anonymous';
        collapsedNodes.push(id);
        collapsedCount++;
      }
    }
    // For groups with attrs, merge them to child first
    else if (canMergeAttributes(child, node)) {
      mergeAttributesToParent(child, node);
      if (replaceNode(node, child)) {
        const id = node.attrs.get('id') || 'anonymous';
        collapsedNodes.push(id);
        collapsedCount++;
      }
    }
  }

  return {
    collapsedCount,
    collapsedNodes,
  };
}

/**
 * Collapse useless groups stage
 */
export function collapseUselessGroupsStage(root: SVGNode): {
  modified: boolean;
  stats: {
    collapsedCount: number;
    collapsedNodes: string[];
  };
} {
  const result = collapseUselessGroups(root);

  return {
    modified: result.collapsedCount > 0,
    stats: result,
  };
}
