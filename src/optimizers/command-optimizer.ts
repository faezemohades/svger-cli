/**
 * Path Command Optimizer (Phase 4.3)
 *
 * Goal: Achieve 50-70% reduction on complex paths with smart curve transformation
 *
 * Main features:
 * 1. Curve shortening (C→S, C→Q, Q→T)
 * 2. Smart command substitution (C/Q→L when straight)
 * 3. Relative/Absolute re-evaluation after changes
 * 4. Configurable tolerance based on optimization level
 *
 * Expected improvement: 10-25% additional reduction on complex icons
 */

import type { PathCommand, PathCommandType } from './path-parser.js';
import {
  toAbsolute,
  toRelative,
  compareAbsoluteRelativeSize,
} from './path-parser.js';

/**
 * Distance between two points
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if three points are approximately collinear
 * Returns true if the middle point is very close to the line connecting the first and third points
 */
function isCollinear(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  tolerance: number = 0.1
): boolean {
  // Calculate the distance from point 2 to the line formed by points 1 and 3
  // Using the formula: distance = |ax + by + c| / sqrt(a² + b²)
  // Where line is: (y3-y1)x - (x3-x1)y + (x3-x1)y1 - (y3-y1)x1 = 0

  const a = y3 - y1;
  const b = -(x3 - x1);
  const c = (x3 - x1) * y1 - (y3 - y1) * x1;

  const denominator = Math.sqrt(a * a + b * b);
  if (denominator < 1e-10) {
    // Points 1 and 3 are the same, check if point 2 is also the same
    return distance(x1, y1, x2, y2) < tolerance;
  }

  const dist = Math.abs(a * x2 + b * y2 + c) / denominator;
  return dist < tolerance;
}

/**
 * Check if a cubic bezier curve is approximately a quadratic bezier
 * Returns the quadratic control point if true, null otherwise
 */
function cubicToQuadratic(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  tolerance: number = 1.0
): { qx: number; qy: number } | null {
  // A cubic bezier C(x0,y0, x1,y1, x2,y2, x3,y3) can be approximated by
  // quadratic Q(x0,y0, qx,qy, x3,y3) if the cubic control points are positioned correctly.
  //
  // For a perfect conversion: qx = (3*x1 - x0)/2, qy = (3*y1 - y0)/2 (from first control point)
  // and also: qx = (3*x2 - x3)/2, qy = (3*y2 - y3)/2 (from second control point)
  //
  // These should give the same result for a true quadratic.

  const qx1 = (3 * x1 - x0) / 2;
  const qy1 = (3 * y1 - y0) / 2;

  const qx2 = (3 * x2 - x3) / 2;
  const qy2 = (3 * y2 - y3) / 2;

  // Check if both calculations give approximately the same control point
  const dist = distance(qx1, qy1, qx2, qy2);

  if (dist < tolerance) {
    // Use the average for better accuracy
    return {
      qx: (qx1 + qx2) / 2,
      qy: (qy1 + qy2) / 2,
    };
  }

  return null;
}

/**
 * Check if a curve segment is approximately a straight line
 */
function isCurveApproximatelyStraight(
  x0: number,
  y0: number,
  controlPoints: number[],
  xEnd: number,
  yEnd: number,
  tolerance: number = 1.0
): boolean {
  // Check if all control points are close to the line from start to end
  for (let i = 0; i < controlPoints.length; i += 2) {
    const cx = controlPoints[i];
    const cy = controlPoints[i + 1];

    if (!isCollinear(x0, y0, cx, cy, xEnd, yEnd, tolerance)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if Q command can be converted to T (smooth quadratic)
 * Q can become T if the current control point is the reflection of the previous one
 */
function canConvertQtoT(
  prevCmd: PathCommand | null,
  currentX: number,
  currentY: number,
  qx: number,
  qy: number,
  tolerance: number = 0.1
): boolean {
  if (
    !prevCmd ||
    (prevCmd.type !== 'Q' &&
      prevCmd.type !== 'q' &&
      prevCmd.type !== 'T' &&
      prevCmd.type !== 't')
  ) {
    return false;
  }

  // Get the previous control point
  let prevQx: number, prevQy: number;

  if (prevCmd.type === 'Q' || prevCmd.type === 'q') {
    if (prevCmd.type === 'Q') {
      prevQx = prevCmd.values[0];
      prevQy = prevCmd.values[1];
    } else {
      // Convert relative to absolute
      const absX = prevCmd.absolutePosition?.x || 0;
      const absY = prevCmd.absolutePosition?.y || 0;
      prevQx = absX + prevCmd.values[0];
      prevQy = absY + prevCmd.values[1];
    }
  } else {
    // T/t command - the control point is reflected from previous
    return false; // Can't check, assume no
  }

  // Calculate expected reflected control point
  const reflectedQx = 2 * currentX - prevQx;
  const reflectedQy = 2 * currentY - prevQy;

  // Check if current control point matches the reflection
  const dist = distance(qx, qy, reflectedQx, reflectedQy);
  return dist < tolerance;
}

/**
 * Check if C command can be converted to S (smooth cubic)
 * C can become S if the first control point is the reflection of the previous second control point
 */
function canConvertCtoS(
  prevCmd: PathCommand | null,
  currentX: number,
  currentY: number,
  x1: number,
  y1: number,
  tolerance: number = 0.1
): boolean {
  if (
    !prevCmd ||
    (prevCmd.type !== 'C' &&
      prevCmd.type !== 'c' &&
      prevCmd.type !== 'S' &&
      prevCmd.type !== 's')
  ) {
    return false;
  }

  // Get the previous second control point
  let prevX2: number, prevY2: number;

  if (prevCmd.type === 'C' || prevCmd.type === 'c') {
    if (prevCmd.type === 'C') {
      prevX2 = prevCmd.values[2];
      prevY2 = prevCmd.values[3];
    } else {
      // Convert relative to absolute
      const absX = prevCmd.absolutePosition?.x || 0;
      const absY = prevCmd.absolutePosition?.y || 0;
      prevX2 = absX + prevCmd.values[2];
      prevY2 = absY + prevCmd.values[3];
    }
  } else if (prevCmd.type === 'S' || prevCmd.type === 's') {
    if (prevCmd.type === 'S') {
      prevX2 = prevCmd.values[0];
      prevY2 = prevCmd.values[1];
    } else {
      const absX = prevCmd.absolutePosition?.x || 0;
      const absY = prevCmd.absolutePosition?.y || 0;
      prevX2 = absX + prevCmd.values[0];
      prevY2 = absY + prevCmd.values[1];
    }
  } else {
    return false;
  }

  // Calculate expected reflected control point
  const reflectedX1 = 2 * currentX - prevX2;
  const reflectedY1 = 2 * currentY - prevY2;

  // Check if current first control point matches the reflection
  const dist = distance(x1, y1, reflectedX1, reflectedY1);
  return dist < tolerance;
}

/**
 * Optimize path commands by transforming curves to simpler forms
 *
 * Priority:
 * 1. C → S (smooth cubic)
 * 2. C → Q (cubic to quadratic)
 * 3. Q → T (smooth quadratic)
 * 4. C/Q → L (curve to line when straight)
 * 5. Re-evaluate absolute/relative after changes
 */
export function optimizeCommands(
  commands: PathCommand[],
  tolerance: number = 1.0,
  precision: number = 3
): {
  commands: PathCommand[];
  stats: {
    convertedCtoS: number;
    convertedCtoQ: number;
    convertedQtoT: number;
    convertedCurveToLine: number;
    reoptimizedAbsRel: number;
  };
} {
  const stats = {
    convertedCtoS: 0,
    convertedCtoQ: 0,
    convertedQtoT: 0,
    convertedCurveToLine: 0,
    reoptimizedAbsRel: 0,
  };

  const optimized: PathCommand[] = [];
  let currentX = 0;
  let currentY = 0;
  let prevCmd: PathCommand | null = null;

  for (let i = 0; i < commands.length; i++) {
    let cmd = commands[i];
    let modified = false;

    // Update current position for absolute commands
    if (cmd.absolutePosition) {
      currentX = cmd.absolutePosition.x;
      currentY = cmd.absolutePosition.y;
    }

    // Get absolute coordinates for analysis
    const absCmd =
      cmd.type === cmd.type.toLowerCase()
        ? toAbsolute(cmd, currentX, currentY)
        : cmd;

    // 1. Try C → S (smooth cubic bezier)
    if (absCmd.type === 'C') {
      const [x1, y1, x2, y2, x, y] = absCmd.values;

      if (canConvertCtoS(prevCmd, currentX, currentY, x1, y1, tolerance)) {
        // Convert to S command (only need second control point and end point)
        cmd = {
          type: 'S' as PathCommandType,
          values: [x2, y2, x, y],
          absolutePosition: { x, y },
        };
        stats.convertedCtoS++;
        modified = true;
      }
    }

    // 2. Try C → Q (cubic to quadratic)
    if (!modified && absCmd.type === 'C') {
      const [x1, y1, x2, y2, x, y] = absCmd.values;

      const quadratic = cubicToQuadratic(
        currentX,
        currentY,
        x1,
        y1,
        x2,
        y2,
        x,
        y,
        tolerance
      );

      if (quadratic) {
        // Convert to Q command
        cmd = {
          type: 'Q' as PathCommandType,
          values: [quadratic.qx, quadratic.qy, x, y],
          absolutePosition: { x, y },
        };
        stats.convertedCtoQ++;
        modified = true;
      }
    }

    // 3. Try Q → T (smooth quadratic)
    if (!modified && absCmd.type === 'Q') {
      const [qx, qy, x, y] = absCmd.values;

      if (canConvertQtoT(prevCmd, currentX, currentY, qx, qy, tolerance)) {
        // Convert to T command (only need end point)
        cmd = {
          type: 'T' as PathCommandType,
          values: [x, y],
          absolutePosition: { x, y },
        };
        stats.convertedQtoT++;
        modified = true;
      }
    }

    // 4. Try C/Q → L (curve to line when approximately straight)
    if (!modified && (absCmd.type === 'C' || absCmd.type === 'Q')) {
      const values = absCmd.values;
      const endX = values[values.length - 2];
      const endY = values[values.length - 1];
      const controlPoints = values.slice(0, -2);

      if (
        isCurveApproximatelyStraight(
          currentX,
          currentY,
          controlPoints,
          endX,
          endY,
          tolerance
        )
      ) {
        // Convert to L command
        cmd = {
          type: 'L' as PathCommandType,
          values: [endX, endY],
          absolutePosition: { x: endX, y: endY },
        };
        stats.convertedCurveToLine++;
        modified = true;
      }
    }

    // 5. Re-evaluate absolute/relative after modifications
    if (modified) {
      // Try both absolute and relative, keep whichever is shorter
      const absCmd =
        cmd.type === cmd.type.toLowerCase()
          ? toAbsolute(cmd, currentX, currentY)
          : cmd;
      const relCmd = toRelative(absCmd, currentX, currentY);

      const sizeDiff = compareAbsoluteRelativeSize(
        absCmd,
        currentX,
        currentY,
        precision
      );

      if (sizeDiff > 0) {
        // Relative is shorter
        cmd = relCmd;
        stats.reoptimizedAbsRel++;
      } else if (sizeDiff < 0) {
        // Absolute is shorter
        cmd = absCmd;
        stats.reoptimizedAbsRel++;
      }
    }

    optimized.push(cmd);

    // Update position and previous command
    if (cmd.absolutePosition) {
      currentX = cmd.absolutePosition.x;
      currentY = cmd.absolutePosition.y;
    }
    prevCmd = cmd;
  }

  return { commands: optimized, stats };
}

/**
 * Command optimization stage for pipeline integration
 * Applies curve shortening, smart substitution, and re-optimization
 */
export function commandOptimizationStage(
  commands: PathCommand[],
  tolerance: number = 1.0,
  precision: number = 3
): {
  commands: PathCommand[];
  stats: {
    convertedCtoS: number;
    convertedCtoQ: number;
    convertedQtoT: number;
    convertedCurveToLine: number;
    reoptimizedAbsRel: number;
  };
} {
  return optimizeCommands(commands, tolerance, precision);
}
