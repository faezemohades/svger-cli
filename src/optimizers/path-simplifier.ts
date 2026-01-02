/**
 * Phase 4.4: Path Simplification
 *
 * Implements Douglas-Peucker and Visvalingam-Whyatt algorithms for intelligent
 * polyline and polygon simplification. Reduces point count while preserving
 * visual fidelity.
 *
 * Target: 5-15% additional reduction on complex/hand-drawn paths
 *
 * Features:
 * - Douglas-Peucker: Recursive subdivision algorithm (great for angular paths)
 * - Visvalingam-Whyatt: Area-based triangulation (great for smooth curves)
 * - Tolerance-based: Configurable precision vs size tradeoff
 * - Curve-aware: Only simplifies L/H/V commands, preserves C/Q/S/T/A
 */

import { parsePath, PathCommand, serializePath } from './path-parser.js';
import type { OptConfig } from './types.js';
import { OptLevel } from './types.js';

/** Point in 2D space */
interface Point {
  x: number;
  y: number;
  /** Original command index (for preserving M commands) */
  cmdIndex?: number;
}

/** Triangle for Visvalingam-Whyatt algorithm */
interface Triangle {
  /** Index of the middle point */
  index: number;
  /** Area of the triangle */
  area: number;
  /** Previous triangle in the list */
  prev: Triangle | null;
  /** Next triangle in the list */
  next: Triangle | null;
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Magnitude
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    );
  }

  // Perpendicular distance
  const u =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);

  if (u < 0) {
    // Closest to start
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    );
  } else if (u > 1) {
    // Closest to end
    return Math.sqrt(
      Math.pow(point.x - lineEnd.x, 2) + Math.pow(point.y - lineEnd.y, 2)
    );
  }

  // Perpendicular point
  const px = lineStart.x + u * dx;
  const py = lineStart.y + u * dy;

  return Math.sqrt(Math.pow(point.x - px, 2) + Math.pow(point.y - py, 2));
}

/**
 * Douglas-Peucker algorithm for polyline simplification
 *
 * Recursive subdivision algorithm that finds the point with maximum distance
 * from the line segment and splits there if it exceeds tolerance.
 *
 * Best for: Angular paths, architectural drawings, logos
 * Time: O(n log n) average, O(n²) worst
 */
function douglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  // Find point with maximum distance
  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIndex), tolerance);

    // Combine results (remove duplicate middle point)
    return [...left.slice(0, -1), ...right];
  }

  // All points between start and end can be removed
  return [start, end];
}

/**
 * Calculate area of triangle formed by three points
 */
function triangleArea(p1: Point, p2: Point, p3: Point): number {
  return Math.abs(
    (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2
  );
}

/**
 * Visvalingam-Whyatt algorithm for polyline simplification
 *
 * Progressive removal of points with smallest triangular area. More
 * consistent results than Douglas-Peucker for smooth curves.
 *
 * Best for: Hand-drawn paths, organic shapes, smooth curves
 * Time: O(n log n) with heap, O(n²) with simple implementation
 */
function visvalingamWhyatt(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  // Build initial triangle list
  const triangles: (Triangle | null)[] = new Array(points.length).fill(null);

  // Calculate areas for all triangles
  for (let i = 1; i < points.length - 1; i++) {
    triangles[i] = {
      index: i,
      area: triangleArea(points[i - 1], points[i], points[i + 1]),
      prev: triangles[i - 1],
      next: null,
    };
    if (triangles[i - 1]) {
      triangles[i - 1]!.next = triangles[i];
    }
  }

  // Convert tolerance to minimum area threshold
  // Higher tolerance = larger minimum area = more aggressive simplification
  const minArea = tolerance * tolerance;

  // Remove points with smallest area below threshold
  let removed = true;
  while (removed) {
    removed = false;
    let minTriangle: Triangle | null = null;
    let minIdx = -1;

    // Find triangle with smallest area
    for (let i = 1; i < points.length - 1; i++) {
      if (triangles[i] && triangles[i]!.area < minArea) {
        if (!minTriangle || triangles[i]!.area < minTriangle.area) {
          minTriangle = triangles[i];
          minIdx = i;
        }
      }
    }

    if (minTriangle) {
      // Remove the point
      triangles[minIdx] = null;
      removed = true;

      // Update adjacent triangles
      const prevIdx = minIdx - 1;
      const nextIdx = minIdx + 1;

      // Find previous and next non-null triangles
      let prevNonNull = prevIdx;
      while (prevNonNull >= 0 && !triangles[prevNonNull]) {
        prevNonNull--;
      }

      let nextNonNull = nextIdx;
      while (nextNonNull < triangles.length && !triangles[nextNonNull]) {
        nextNonNull++;
      }

      // Update previous triangle
      if (prevNonNull >= 1 && nextNonNull < points.length) {
        let prevPrevIdx = prevNonNull - 1;
        while (prevPrevIdx >= 0 && !triangles[prevPrevIdx]) {
          prevPrevIdx--;
        }
        if (prevPrevIdx >= 0) {
          triangles[prevNonNull]!.area = triangleArea(
            points[prevPrevIdx],
            points[prevNonNull],
            points[nextNonNull]
          );
        }
      }

      // Update next triangle
      if (nextNonNull < points.length - 1) {
        let nextNextIdx = nextNonNull + 1;
        while (nextNextIdx < points.length && !triangles[nextNextIdx]) {
          nextNextIdx++;
        }
        if (nextNextIdx < points.length) {
          triangles[nextNonNull]!.area = triangleArea(
            points[prevNonNull],
            points[nextNonNull],
            points[nextNextIdx]
          );
        }
      }
    }
  }

  // Collect remaining points
  return points.filter(
    (_, i) => i === 0 || i === points.length - 1 || triangles[i] !== null
  );
}

/**
 * Convert path commands to point array (only L/H/V commands)
 */
function extractLinearPoints(
  commands: PathCommand[],
  startX: number,
  startY: number
): { points: Point[]; indices: number[] } {
  const points: Point[] = [{ x: startX, y: startY, cmdIndex: 0 }];
  const indices: number[] = [0];
  let currentX = startX;
  let currentY = startY;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const isRelative = cmd.type === cmd.type.toLowerCase();

    switch (cmd.type.toUpperCase()) {
      case 'L': {
        const x = isRelative ? currentX + cmd.values[0] : cmd.values[0];
        const y = isRelative ? currentY + cmd.values[1] : cmd.values[1];
        points.push({ x, y, cmdIndex: i + 1 });
        indices.push(i + 1);
        currentX = x;
        currentY = y;
        break;
      }
      case 'H': {
        const x = isRelative ? currentX + cmd.values[0] : cmd.values[0];
        points.push({ x, y: currentY, cmdIndex: i + 1 });
        indices.push(i + 1);
        currentX = x;
        break;
      }
      case 'V': {
        const y = isRelative ? currentY + cmd.values[0] : cmd.values[0];
        points.push({ x: currentX, y, cmdIndex: i + 1 });
        indices.push(i + 1);
        currentY = y;
        break;
      }
      default:
        // Update position for other commands but don't add to points
        if (cmd.type.toUpperCase() === 'M') {
          currentX = isRelative ? currentX + cmd.values[0] : cmd.values[0];
          currentY = isRelative ? currentY + cmd.values[1] : cmd.values[1];
        } else if (cmd.type.toUpperCase() === 'C') {
          currentX = isRelative ? currentX + cmd.values[4] : cmd.values[4];
          currentY = isRelative ? currentY + cmd.values[5] : cmd.values[5];
        } else if (cmd.type.toUpperCase() === 'Q') {
          currentX = isRelative ? currentX + cmd.values[2] : cmd.values[2];
          currentY = isRelative ? currentY + cmd.values[3] : cmd.values[3];
        }
        break;
    }
  }

  return { points, indices };
}

/**
 * Simplify a path by reducing the number of linear points
 */
export function simplifyPath(
  pathData: string,
  config: OptConfig,
  algorithm: 'douglas-peucker' | 'visvalingam' = 'douglas-peucker'
): { simplified: string; pointsRemoved: number } {
  const parsed = parsePath(pathData);
  const commands = parsed.commands;
  if (commands.length === 0) {
    return { simplified: pathData, pointsRemoved: 0 };
  }

  // Get tolerance from config
  const tolerance = config.pathTolerance || 0.5;

  let totalPointsRemoved = 0;
  const result: PathCommand[] = [];
  let i = 0;

  while (i < commands.length) {
    const cmd = commands[i];

    // Always keep M commands
    if (cmd.type.toUpperCase() === 'M') {
      result.push(cmd);
      i++;

      // Find the next M or end of path
      const segmentStart = i;
      let segmentEnd = i;
      while (
        segmentEnd < commands.length &&
        commands[segmentEnd].type.toUpperCase() !== 'M'
      ) {
        segmentEnd++;
      }

      // Extract linear segment
      const segment = commands.slice(segmentStart, segmentEnd);
      const { points } = extractLinearPoints(
        segment,
        cmd.values[0],
        cmd.values[1]
      );

      // Only simplify if we have enough points
      if (points.length > 2) {
        // Choose algorithm
        const simplified =
          algorithm === 'visvalingam'
            ? visvalingamWhyatt(points, tolerance)
            : douglasPeucker(points, tolerance);

        totalPointsRemoved += points.length - simplified.length;

        // Convert back to commands (skip first point, it's the M)
        for (let j = 1; j < simplified.length; j++) {
          result.push({
            type: 'L',
            values: [simplified[j].x, simplified[j].y],
          });
        }

        // Add any non-linear commands that were in the segment
        for (let j = 0; j < segment.length; j++) {
          const c = segment[j];
          if (
            c.type.toUpperCase() !== 'L' &&
            c.type.toUpperCase() !== 'H' &&
            c.type.toUpperCase() !== 'V'
          ) {
            result.push(c);
          }
        }
      } else {
        // Too few points, keep as-is
        result.push(...segment);
      }

      i = segmentEnd;
    } else {
      result.push(cmd);
      i++;
    }
  }

  return {
    simplified: serializePath(result, 2),
    pointsRemoved: totalPointsRemoved,
  };
}

/**
 * Optimization stage for path simplification
 */
export function pathSimplificationStage(config: OptConfig) {
  return {
    name: 'path-simplification',
    async transform(svgContent: string): Promise<string> {
      if (!config.enablePathSimplification) {
        return svgContent;
      }

      let modified = false;
      let totalPointsRemoved = 0;

      // Choose algorithm based on optimization level
      const algorithm =
        config.optimizationLevel === OptLevel.MAXIMUM
          ? 'visvalingam'
          : 'douglas-peucker';

      const result = svgContent.replace(
        /<path[^>]*\sd="([^"]+)"[^>]*>/g,
        (match, pathData) => {
          const { simplified, pointsRemoved } = simplifyPath(
            pathData,
            config,
            algorithm
          );

          if (pointsRemoved > 0) {
            modified = true;
            totalPointsRemoved += pointsRemoved;
            return match.replace(`d="${pathData}"`, `d="${simplified}"`);
          }

          return match;
        }
      );

      if (modified) {
        console.log(
          `[path-simplification] Removed ${totalPointsRemoved} points using ${algorithm}`
        );
      }

      return result;
    },
  };
}
