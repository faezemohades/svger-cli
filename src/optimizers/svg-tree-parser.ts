/**
 * Lightweight SVG Tree Parser
 * Pure string → custom node tree parser (zero dependencies)
 * Inspired by nano-parser patterns, optimized for SVG
 */

/**
 * SVG Tree Node structure
 */
export interface SVGNode {
  /** Element tag name (e.g., 'svg', 'path', 'g') */
  tag: string;

  /** Element attributes as Map for O(1) access */
  attrs: Map<string, string>;

  /** Child nodes */
  children: SVGNode[];

  /** Text content (for text nodes, style content, etc.) */
  content?: string;

  /** Node type: element, text, or comment */
  type: 'element' | 'text' | 'comment';

  /** Parent node reference (for tree traversal) */
  parent?: SVGNode;
}

/**
 * Supported SVG element types
 */
const SUPPORTED_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'use',
  'defs',
  'symbol',
  'style',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern',
  'image',
  'text',
  'tspan',
  'textPath',
  'a',
  'title',
  'desc',
  'metadata',
]);

/**
 * Self-closing elements (no children)
 */
const SELF_CLOSING_ELEMENTS = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'use',
  'stop',
  'image',
]);

/**
 * Parse attributes from tag string
 * Example: 'fill="red" stroke-width="2"' → Map { fill: 'red', strokeWidth: '2' }
 */
function parseAttributes(attrString: string): Map<string, string> {
  const attrs = new Map<string, string>();

  // Match attribute="value" or attribute='value'
  const attrRegex = /([a-zA-Z][a-zA-Z0-9-:]*)=["']([^"']*)["']/g;
  let match;

  while ((match = attrRegex.exec(attrString)) !== null) {
    const [, name, value] = match;
    attrs.set(name, value);
  }

  return attrs;
}

/**
 * Find matching closing tag index
 * Handles nested tags of same type
 */
function findClosingTag(
  html: string,
  tagName: string,
  startIndex: number
): number {
  let depth = 1;
  let pos = startIndex;

  const openPattern = new RegExp(`<${tagName}(?:\\s|>)`, 'g');
  const closePattern = new RegExp(`</${tagName}>`, 'g');

  while (depth > 0 && pos < html.length) {
    openPattern.lastIndex = pos;
    closePattern.lastIndex = pos;

    const nextOpen = openPattern.exec(html);
    const nextClose = closePattern.exec(html);

    if (!nextClose) {
      // No closing tag found
      return -1;
    }

    if (nextOpen && nextOpen.index < nextClose.index) {
      // Found nested opening tag
      depth++;
      pos = openPattern.lastIndex;
    } else {
      // Found closing tag
      depth--;
      if (depth === 0) {
        return nextClose.index;
      }
      pos = closePattern.lastIndex;
    }
  }

  return -1;
}

/**
 * Parse SVG string into tree structure
 * Recursive descent parser
 */
export function parseSVG(svgString: string): SVGNode | null {
  const trimmed = svgString.trim();

  if (!trimmed) {
    return null;
  }

  // Create root container
  const root: SVGNode = {
    tag: 'root',
    attrs: new Map(),
    children: [],
    type: 'element',
  };

  // Parse recursively
  parseChildren(trimmed, root, 0);

  // Return first child if root only has one child (the <svg> element)
  if (root.children.length === 1) {
    return root.children[0];
  }

  return root;
}

/**
 * Recursively parse child nodes
 */
function parseChildren(
  html: string,
  parent: SVGNode,
  startPos: number
): number {
  let pos = startPos;

  while (pos < html.length) {
    // Find next tag
    const tagStart = html.indexOf('<', pos);

    if (tagStart === -1) {
      // No more tags, check for text content
      const remaining = html.substring(pos).trim();
      if (remaining && parent.tag !== 'root') {
        parent.content = (parent.content || '') + remaining;
      }
      break;
    }

    // Check for text content before tag
    if (tagStart > pos) {
      const textContent = html.substring(pos, tagStart).trim();
      if (textContent && parent.tag !== 'root') {
        parent.content = (parent.content || '') + textContent;
      }
    }

    // Check for comment
    if (html.substring(tagStart, tagStart + 4) === '<!--') {
      const commentEnd = html.indexOf('-->', tagStart);
      if (commentEnd !== -1) {
        const commentText = html.substring(tagStart + 4, commentEnd).trim();
        const commentNode: SVGNode = {
          tag: 'comment',
          attrs: new Map(),
          children: [],
          content: commentText,
          type: 'comment',
          parent,
        };
        parent.children.push(commentNode);
        pos = commentEnd + 3;
        continue;
      }
    }

    // Check for closing tag
    if (html[tagStart + 1] === '/') {
      // This is a closing tag, return control to parent
      const tagEnd = html.indexOf('>', tagStart);
      return tagEnd + 1;
    }

    // Parse opening tag
    const tagEnd = html.indexOf('>', tagStart);
    if (tagEnd === -1) {
      // Malformed tag
      break;
    }

    const tagContent = html.substring(tagStart + 1, tagEnd);

    // Check for self-closing tag
    const isSelfClosing = tagContent.endsWith('/');
    const tagContentClean = isSelfClosing
      ? tagContent.substring(0, tagContent.length - 1).trim()
      : tagContent.trim();

    // Extract tag name and attributes
    const spaceIndex = tagContentClean.search(/\s/);
    const tagName =
      spaceIndex === -1
        ? tagContentClean
        : tagContentClean.substring(0, spaceIndex);
    const attrString =
      spaceIndex === -1 ? '' : tagContentClean.substring(spaceIndex + 1);

    // Only parse supported elements - skip unsupported ones entirely
    if (!SUPPORTED_ELEMENTS.has(tagName)) {
      // If self-closing, just skip it
      if (isSelfClosing) {
        pos = tagEnd + 1;
        continue;
      }

      // Find and skip to PAST the closing tag
      const closingTagIndex = findClosingTag(html, tagName, tagEnd + 1);
      if (closingTagIndex !== -1) {
        // Move past </tagName>
        pos = closingTagIndex + tagName.length + 3; // </ + tagName + >
        continue;
      } else {
        // No closing tag found, just skip past opening tag
        pos = tagEnd + 1;
        continue;
      }
    }

    // Create node
    const node: SVGNode = {
      tag: tagName,
      attrs: parseAttributes(attrString),
      children: [],
      type: 'element',
      parent,
    };

    parent.children.push(node);

    // Handle self-closing or void elements
    if (isSelfClosing || SELF_CLOSING_ELEMENTS.has(tagName)) {
      pos = tagEnd + 1;
      continue;
    }

    // Parse children for non-self-closing tags
    const childStart = tagEnd + 1;

    // Special handling for style and script tags (preserve content as-is)
    if (tagName === 'style' || tagName === 'script') {
      const closingTag = `</${tagName}>`;
      const closingIndex = html.indexOf(closingTag, childStart);
      if (closingIndex !== -1) {
        node.content = html.substring(childStart, closingIndex);
        pos = closingIndex + closingTag.length;
        continue;
      }
    }

    // Find and parse children
    const closingTagIndex = findClosingTag(html, tagName, childStart);
    if (closingTagIndex === -1) {
      // No closing tag found, treat as self-closing
      pos = tagEnd + 1;
      continue;
    }

    // Parse children recursively
    const childContent = html.substring(childStart, closingTagIndex);
    parseChildren(childContent, node, 0);

    // Move past closing tag
    pos = closingTagIndex + tagName.length + 3; // </ + tagName + >
  }

  return pos;
}

/**
 * Traverse tree depth-first
 */
export function traverseTree(
  node: SVGNode,
  callback: (node: SVGNode, depth: number) => void | boolean,
  depth = 0
): void {
  // Call callback, if it returns false, stop traversal
  const shouldContinue = callback(node, depth);
  if (shouldContinue === false) {
    return;
  }

  // Traverse children
  for (const child of node.children) {
    traverseTree(child, callback, depth + 1);
  }
}

/**
 * Find nodes by tag name
 */
export function findNodesByTag(root: SVGNode, tagName: string): SVGNode[] {
  const results: SVGNode[] = [];

  traverseTree(root, node => {
    if (node.tag === tagName) {
      results.push(node);
    }
  });

  return results;
}

/**
 * Find node by ID
 */
export function findNodeById(root: SVGNode, id: string): SVGNode | null {
  let result: SVGNode | null = null;

  traverseTree(root, node => {
    if (node.attrs.get('id') === id) {
      result = node;
      return false; // Stop traversal
    }
  });

  return result;
}

/**
 * Get all IDs in tree
 */
export function getAllIds(root: SVGNode): Set<string> {
  const ids = new Set<string>();

  traverseTree(root, node => {
    const id = node.attrs.get('id');
    if (id) {
      ids.add(id);
    }
  });

  return ids;
}

/**
 * Remove node from parent
 */
export function removeNode(node: SVGNode): boolean {
  if (!node.parent) {
    return false;
  }

  const index = node.parent.children.indexOf(node);
  if (index !== -1) {
    node.parent.children.splice(index, 1);
    return true;
  }

  return false;
}

/**
 * Replace node with another node
 */
export function replaceNode(oldNode: SVGNode, newNode: SVGNode): boolean {
  if (!oldNode.parent) {
    return false;
  }

  const index = oldNode.parent.children.indexOf(oldNode);
  if (index !== -1) {
    oldNode.parent.children[index] = newNode;
    newNode.parent = oldNode.parent;
    return true;
  }

  return false;
}

/**
 * Clone node (deep copy)
 */
export function cloneNode(node: SVGNode, includeParent = false): SVGNode {
  const cloned: SVGNode = {
    tag: node.tag,
    attrs: new Map(node.attrs),
    children: node.children.map(child => cloneNode(child, false)),
    type: node.type,
    content: node.content,
  };

  if (includeParent && node.parent) {
    cloned.parent = node.parent;
  }

  // Update parent references for children
  for (const child of cloned.children) {
    child.parent = cloned;
  }

  return cloned;
}
