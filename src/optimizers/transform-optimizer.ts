/**
 * Phase 3: Transform Optimizer
 *
 * Responsibilities:
 * 1. Parse transform attribute lists (translate, rotate, scale, skew, matrix)
 * 2. Consolidate multiple transforms into single matrix
 * 3. Decompose matrix back to simpler transforms only if shorter
 * 4. Round matrix/transform values to configured precision
 */

import type { SVGNode } from './svg-tree-parser.js';
import type { OptConfig } from './types.js';

/**
 * 2D transformation matrix [a, b, c, d, e, f]
 * Represents: | a c e |
 *             | b d f |
 *             | 0 0 1 |
 */
type Matrix = [number, number, number, number, number, number];

/**
 * Identity matrix
 */
const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

/**
 * Transform command types
 */
interface Transform {
  type: 'translate' | 'rotate' | 'scale' | 'skewX' | 'skewY' | 'matrix';
  values: number[];
}

/**
 * Parse a single transform command
 */
function parseTransformCommand(command: string): Transform | null {
  const match = command.match(/^(\w+)\s*\(([^)]+)\)/);
  if (!match) return null;

  const type = match[1] as Transform['type'];
  const valueStr = match[2].trim();
  const values = valueStr
    .split(/[\s,]+/)
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));

  if (values.length === 0) return null;

  return { type, values };
}

/**
 * Parse transform attribute into list of commands
 */
export function parseTransformList(transformStr: string): Transform[] {
  const transforms: Transform[] = [];
  const regex = /(\w+)\s*\([^)]+\)/g;
  let match;

  while ((match = regex.exec(transformStr)) !== null) {
    // Prevent infinite loop if regex doesn't advance
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    const cmd = parseTransformCommand(match[0]);
    if (cmd) {
      transforms.push(cmd);
    }
  }

  return transforms;
}

/**
 * Multiply two matrices: result = m1 × m2
 */
function multiplyMatrices(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;

  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

/**
 * Convert transform command to matrix
 */
function transformToMatrix(transform: Transform): Matrix {
  const { type, values } = transform;

  switch (type) {
    case 'matrix':
      if (values.length === 6) {
        return values as Matrix;
      }
      return IDENTITY_MATRIX;

    case 'translate': {
      const tx = values[0] || 0;
      const ty = values[1] || 0;
      return [1, 0, 0, 1, tx, ty];
    }

    case 'scale': {
      const sx = values[0] || 1;
      const sy = values[1] !== undefined ? values[1] : sx;
      return [sx, 0, 0, sy, 0, 0];
    }

    case 'rotate': {
      const angle = values[0] || 0;
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Rotate around point (cx, cy) if provided
      if (values.length === 3) {
        const cx = values[1];
        const cy = values[2];
        // translate(-cx, -cy) × rotate(angle) × translate(cx, cy)
        return [
          cos,
          sin,
          -sin,
          cos,
          -cx * cos + cy * sin + cx,
          -cx * sin - cy * cos + cy,
        ];
      }

      return [cos, sin, -sin, cos, 0, 0];
    }

    case 'skewX': {
      const angle = values[0] || 0;
      const rad = (angle * Math.PI) / 180;
      const tan = Math.tan(rad);
      return [1, 0, tan, 1, 0, 0];
    }

    case 'skewY': {
      const angle = values[0] || 0;
      const rad = (angle * Math.PI) / 180;
      const tan = Math.tan(rad);
      return [1, tan, 0, 1, 0, 0];
    }

    default:
      return IDENTITY_MATRIX;
  }
}

/**
 * Consolidate transform list into single matrix
 */
export function consolidateTransforms(transforms: Transform[]): Matrix {
  let result: Matrix = IDENTITY_MATRIX;

  for (const transform of transforms) {
    const matrix = transformToMatrix(transform);
    result = multiplyMatrices(result, matrix);
  }

  return result;
}

/**
 * Round number with precision
 */
function roundNum(value: number, precision: number): number {
  if (Math.abs(value) < 1e-10) return 0;
  const multiplier = Math.pow(10, precision);
  const rounded = Math.round(value * multiplier) / multiplier;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Check if matrix is identity
 */
export function isIdentityMatrix(m: Matrix): boolean {
  const [a, b, c, d, e, f] = m;
  return (
    Math.abs(a - 1) < 1e-10 &&
    Math.abs(b) < 1e-10 &&
    Math.abs(c) < 1e-10 &&
    Math.abs(d - 1) < 1e-10 &&
    Math.abs(e) < 1e-10 &&
    Math.abs(f) < 1e-10
  );
}

/**
 * Decompose matrix to simpler transforms if possible
 * Returns shortest representation between:
 * - matrix(a, b, c, d, e, f)
 * - translate(tx, ty)
 * - scale(sx, sy)
 * - rotate(angle)
 * - combinations
 */
export function decomposeMatrix(m: Matrix, precision: number = 3): string {
  const [a, b, c, d, e, f] = m.map(v => roundNum(v, precision));

  // Identity: remove transform entirely
  if (isIdentityMatrix([a, b, c, d, e, f])) {
    return '';
  }

  // Pure translate: translate(tx, ty) or translate(tx)
  if (
    Math.abs(a - 1) < 1e-10 &&
    Math.abs(b) < 1e-10 &&
    Math.abs(c) < 1e-10 &&
    Math.abs(d - 1) < 1e-10
  ) {
    if (Math.abs(f) < 1e-10) {
      return `translate(${e})`;
    }
    return `translate(${e} ${f})`;
  }

  // Pure scale: scale(sx, sy) or scale(sx)
  if (
    Math.abs(b) < 1e-10 &&
    Math.abs(c) < 1e-10 &&
    Math.abs(e) < 1e-10 &&
    Math.abs(f) < 1e-10 &&
    Math.abs(a - d) < 1e-10
  ) {
    return `scale(${a})`;
  }

  if (
    Math.abs(b) < 1e-10 &&
    Math.abs(c) < 1e-10 &&
    Math.abs(e) < 1e-10 &&
    Math.abs(f) < 1e-10
  ) {
    return `scale(${a} ${d})`;
  }

  // Pure rotate (no translation): rotate(angle)
  if (
    Math.abs(e) < 1e-10 &&
    Math.abs(f) < 1e-10 &&
    Math.abs(Math.sqrt(a * a + b * b) - 1) < 1e-10 &&
    Math.abs(a - d) < 1e-10 &&
    Math.abs(b + c) < 1e-10
  ) {
    const angle = roundNum((Math.atan2(b, a) * 180) / Math.PI, precision);
    return `rotate(${angle})`;
  }

  // Matrix form as fallback
  const matrixStr = `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;

  // Try to decompose into translate + rotate/scale if shorter
  // translate(tx, ty) + rotate(angle)
  if (
    Math.abs(Math.sqrt(a * a + b * b) - 1) < 1e-10 &&
    Math.abs(a - d) < 1e-10 &&
    Math.abs(b + c) < 1e-10
  ) {
    const angle = roundNum((Math.atan2(b, a) * 180) / Math.PI, precision);
    const translateStr =
      Math.abs(f) < 1e-10 ? `translate(${e})` : `translate(${e} ${f})`;
    const combined = `${translateStr} rotate(${angle})`;
    if (combined.length < matrixStr.length) {
      return combined;
    }
  }

  return matrixStr;
}

/**
 * Optimize transform attribute on a node
 */
function optimizeTransform(node: SVGNode, precision: number): boolean {
  const transformAttr = node.attrs.get('transform');
  if (!transformAttr) return false;

  const transforms = parseTransformList(transformAttr);
  if (transforms.length === 0) {
    node.attrs.delete('transform');
    return true;
  }

  // If only one transform, check for identity and round values
  if (transforms.length === 1) {
    const t = transforms[0];
    const roundedValues = t.values.map(v => roundNum(v, precision));

    // Convert to matrix to check for identity
    const matrix = transformToMatrix({ type: t.type, values: roundedValues });

    // Check if identity
    if (isIdentityMatrix(matrix)) {
      node.attrs.delete('transform');
      return true;
    }

    // For matrix type, try to decompose to simpler form
    if (t.type === 'matrix') {
      const optimized = decomposeMatrix(matrix, precision);
      if (optimized === '') {
        node.attrs.delete('transform');
        return true;
      }
      if (optimized.length < transformAttr.length) {
        node.attrs.set('transform', optimized);
        return true;
      }
      return false;
    }

    // Reconstruct single transform with rounded values
    const valueStr = roundedValues.join(' ');
    const newTransform = `${t.type}(${valueStr})`;

    if (newTransform !== transformAttr) {
      node.attrs.set('transform', newTransform);
      return true;
    }

    return false;
  }

  // Multiple transforms: consolidate
  const matrix = consolidateTransforms(transforms);
  const optimized = decomposeMatrix(matrix, precision);

  if (optimized === '') {
    // Identity matrix - remove transform
    node.attrs.delete('transform');
    return true;
  }

  // Use optimized if shorter
  if (optimized.length < transformAttr.length) {
    node.attrs.set('transform', optimized);
    return true;
  }

  return false;
}

/**
 * Optimize transforms in the tree
 */
export function optimizeTransforms(
  root: SVGNode,
  config: OptConfig
): {
  optimizedTransforms: number;
  removedIdentity: number;
} {
  let optimizedTransforms = 0;
  let removedIdentity = 0;

  const precision = config.floatPrecision || 3;

  const traverse = (node: SVGNode) => {
    if (!node) return;

    if (node.type === 'element' && node.attrs.has('transform')) {
      const hadTransform = node.attrs.has('transform');
      const wasOptimized = optimizeTransform(node, precision);

      if (wasOptimized) {
        if (!node.attrs.has('transform') && hadTransform) {
          removedIdentity++;
        } else {
          optimizedTransforms++;
        }
      }
    }

    // Recurse
    for (const child of node.children) {
      if (child.type === 'element') {
        traverse(child);
      }
    }
  };

  traverse(root);

  return {
    optimizedTransforms,
    removedIdentity,
  };
}

/**
 * Transform optimization stage for pipeline
 */
export function transformOptimizationStage(
  root: SVGNode,
  config: OptConfig
): {
  modified: boolean;
  stats: {
    optimizedTransforms: number;
    removedIdentity: number;
  };
} {
  const stats = optimizeTransforms(root, config);

  return {
    modified: stats.optimizedTransforms > 0 || stats.removedIdentity > 0,
    stats,
  };
}
