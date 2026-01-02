/**
 * Remove Hidden and Empty Elements
 * Drop empty <text>, invisible elements (display:none, visibility:hidden, opacity=0)
 * Recursively check children before removing
 */

import type { SVGNode } from './svg-tree-parser.js';
import { traverseTree, removeNode } from './svg-tree-parser.js';

/**
 * Check if element is hidden
 */
function isHiddenElement(node: SVGNode): boolean {
  // Check display: none
  const style = node.attrs.get('style');
  if (style && /display\s*:\s*none/.test(style)) {
    return true;
  }

  if (node.attrs.get('display') === 'none') {
    return true;
  }

  // Check visibility: hidden
  if (style && /visibility\s*:\s*hidden/.test(style)) {
    return true;
  }

  if (node.attrs.get('visibility') === 'hidden') {
    return true;
  }

  // Check opacity: 0
  if (node.attrs.get('opacity') === '0') {
    return true;
  }

  if (style && /opacity\s*:\s*0(?:\.0+)?(?!\d)/.test(style)) {
    return true;
  }

  return false;
}

/**
 * Check if element is empty (no children and no content)
 */
function isEmptyElement(node: SVGNode): boolean {
  return node.children.length === 0 && !node.content;
}

/**
 * Check if text element is empty or has only whitespace
 */
function isEmptyTextElement(node: SVGNode): boolean {
  if (node.tag !== 'text' && node.tag !== 'tspan') {
    return false;
  }

  // Check if has no children and no content
  if (isEmptyElement(node)) {
    return true;
  }

  // Check if content is only whitespace
  if (node.content && node.content.trim() === '') {
    return true;
  }

  // Check if all children are empty
  if (node.children.length > 0) {
    return node.children.every(child => {
      if (child.type === 'text') {
        return !child.content || child.content.trim() === '';
      }
      if (child.type === 'element') {
        return isEmptyTextElement(child);
      }
      return true;
    });
  }

  return false;
}

/**
 * Check if container element is empty (no visible children)
 */
function isEmptyContainer(node: SVGNode): boolean {
  const containerTags = new Set(['g', 'defs', 'symbol', 'clipPath', 'mask']);

  if (!containerTags.has(node.tag)) {
    return false;
  }

  return node.children.length === 0;
}

/**
 * Remove hidden and empty elements from tree
 */
export function removeHiddenAndEmptyElements(root: SVGNode): {
  removedCount: number;
  removedNodes: Array<{ tag: string; reason: string }>;
} {
  let removedCount = 0;
  const removedNodes: Array<{ tag: string; reason: string }> = [];

  // Collect nodes to remove (avoid modifying during traversal)
  const nodesToRemove: Array<{ node: SVGNode; reason: string }> = [];

  traverseTree(root, node => {
    // Skip root
    if (node.tag === 'root' || node.tag === 'svg') {
      return;
    }

    // Check if hidden
    if (isHiddenElement(node)) {
      nodesToRemove.push({ node, reason: 'hidden' });
      return false; // Stop traversing children
    }

    // Check if empty text element
    if (isEmptyTextElement(node)) {
      nodesToRemove.push({ node, reason: 'empty-text' });
      return false;
    }

    // Check if empty container
    if (isEmptyContainer(node)) {
      nodesToRemove.push({ node, reason: 'empty-container' });
      return false;
    }
  });

  // Remove collected nodes
  for (const { node, reason } of nodesToRemove) {
    if (removeNode(node)) {
      removedNodes.push({ tag: node.tag, reason });
      removedCount++;
    }
  }

  return {
    removedCount,
    removedNodes,
  };
}

/**
 * Remove hidden and empty elements stage
 */
export function removeHiddenAndEmptyElementsStage(root: SVGNode): {
  modified: boolean;
  stats: {
    removedCount: number;
    removedNodes: Array<{ tag: string; reason: string }>;
  };
} {
  const result = removeHiddenAndEmptyElements(root);

  return {
    modified: result.removedCount > 0,
    stats: result,
  };
}
