/**
 * Phase 4.2: Path Shortener
 *
 * Responsibilities:
 * 1. Merge consecutive same commands (e.g., L10 20 L30 40 → L10 20 30 40)
 * 2. Convert relative ↔ absolute if shorter (smart size comparison)
 * 3. Replace L with H/V where possible (horizontal/vertical lines)
 * 4. Optimize command sequence for minimal byte size
 */

import type { PathCommand } from './path-parser.js';
import {
  serializePath,
  toAbsolute,
  toRelative,
  compareAbsoluteRelativeSize,
} from './path-parser.js';

/**
 * Check if two commands can be merged (same type and both absolute or both relative)
 */
function canMergeCommands(cmd1: PathCommand, cmd2: PathCommand): boolean {
  // Must be same type
  if (cmd1.type !== cmd2.type) {
    return false;
  }

  // Can't merge Z
  if (cmd1.type === 'Z' || cmd1.type === 'z') {
    return false;
  }

  // Only merge commands that support multiple coordinate sets
  const mergeable = ['L', 'l', 'C', 'c', 'S', 's', 'Q', 'q', 'T', 't'];
  return mergeable.includes(cmd1.type);
}

/**
 * Merge consecutive commands of the same type
 */
export function mergeConsecutiveCommands(
  commands: PathCommand[]
): PathCommand[] {
  if (commands.length === 0) return commands;

  const merged: PathCommand[] = [];
  let currentCmd: PathCommand | null = null;

  for (const cmd of commands) {
    if (!currentCmd) {
      currentCmd = { ...cmd, values: [...cmd.values] };
      continue;
    }

    // Try to merge with current
    if (canMergeCommands(currentCmd, cmd)) {
      // Merge values
      currentCmd.values.push(...cmd.values);
      currentCmd.absolutePosition = cmd.absolutePosition;
    } else {
      // Push current and start new
      merged.push(currentCmd);
      currentCmd = { ...cmd, values: [...cmd.values] };
    }
  }

  if (currentCmd) {
    merged.push(currentCmd);
  }

  return merged;
}

/**
 * Convert L commands to H/V where beneficial
 * L10 20 → H10 V20 (if horizontal or vertical movement)
 */
export function convertLtoHV(
  commands: PathCommand[],
  precision: number = 3
): PathCommand[] {
  const optimized: PathCommand[] = [];
  let prevX = 0;
  let prevY = 0;

  for (const cmd of commands) {
    // Only optimize single-coordinate L/l commands
    if ((cmd.type === 'L' || cmd.type === 'l') && cmd.values.length === 2) {
      const [x, y] = cmd.values;

      if (cmd.type === 'L') {
        // Absolute
        const isHorizontal = Math.abs(y - prevY) < 1e-6;
        const isVertical = Math.abs(x - prevX) < 1e-6;

        if (isHorizontal) {
          // Convert to H
          const hCmd: PathCommand = {
            type: 'H',
            values: [x],
            absolutePosition: cmd.absolutePosition,
          };
          const lSize = serializePath([cmd], precision).length;
          const hSize = serializePath([hCmd], precision).length;

          if (hSize < lSize) {
            optimized.push(hCmd);
            prevX = x;
            prevY = y;
            continue;
          }
        } else if (isVertical) {
          // Convert to V
          const vCmd: PathCommand = {
            type: 'V',
            values: [y],
            absolutePosition: cmd.absolutePosition,
          };
          const lSize = serializePath([cmd], precision).length;
          const vSize = serializePath([vCmd], precision).length;

          if (vSize < lSize) {
            optimized.push(vCmd);
            prevX = x;
            prevY = y;
            continue;
          }
        }
      } else {
        // Relative l
        const isHorizontal = Math.abs(y) < 1e-6;
        const isVertical = Math.abs(x) < 1e-6;

        if (isHorizontal && x !== 0) {
          // Convert to h
          const hCmd: PathCommand = {
            type: 'h',
            values: [x],
            absolutePosition: cmd.absolutePosition,
          };
          const lSize = serializePath([cmd], precision).length;
          const hSize = serializePath([hCmd], precision).length;

          if (hSize < lSize) {
            optimized.push(hCmd);
            prevX = cmd.absolutePosition!.x;
            prevY = cmd.absolutePosition!.y;
            continue;
          }
        } else if (isVertical && y !== 0) {
          // Convert to v
          const vCmd: PathCommand = {
            type: 'v',
            values: [y],
            absolutePosition: cmd.absolutePosition,
          };
          const lSize = serializePath([cmd], precision).length;
          const vSize = serializePath([vCmd], precision).length;

          if (vSize < lSize) {
            optimized.push(vCmd);
            prevX = cmd.absolutePosition!.x;
            prevY = cmd.absolutePosition!.y;
            continue;
          }
        }
      }
    }

    // Keep original command
    optimized.push(cmd);
    if (cmd.absolutePosition) {
      prevX = cmd.absolutePosition.x;
      prevY = cmd.absolutePosition.y;
    }
  }

  return optimized;
}

/**
 * Convert commands to absolute or relative based on size
 */
export function optimizeAbsoluteRelative(
  commands: PathCommand[],
  precision: number = 3
): PathCommand[] {
  const optimized: PathCommand[] = [];
  let prevX = 0;
  let prevY = 0;

  for (const cmd of commands) {
    // M command: first should be absolute, rest can be optimized as L
    if (cmd.type === 'M' || cmd.type === 'm') {
      // First M should typically be absolute
      if (optimized.length === 0) {
        const absCmd = toAbsolute(cmd, prevX, prevY);
        optimized.push(absCmd);
        prevX = absCmd.absolutePosition!.x;
        prevY = absCmd.absolutePosition!.y;
        continue;
      }
    }

    // Compare sizes
    const diff = compareAbsoluteRelativeSize(cmd, prevX, prevY, precision);

    if (diff > 0) {
      // Relative is shorter
      const relCmd = toRelative(cmd, prevX, prevY);
      optimized.push(relCmd);
    } else if (diff < 0) {
      // Absolute is shorter
      const absCmd = toAbsolute(cmd, prevX, prevY);
      optimized.push(absCmd);
    } else {
      // Same size, keep original
      optimized.push(cmd);
    }

    // Update position
    if (cmd.absolutePosition) {
      prevX = cmd.absolutePosition.x;
      prevY = cmd.absolutePosition.y;
    }
  }

  return optimized;
}

/**
 * Remove redundant commands
 * - Remove M commands that move to current position
 * - Remove L commands with distance 0
 */
export function removeRedundantCommands(
  commands: PathCommand[]
): PathCommand[] {
  const filtered: PathCommand[] = [];
  let prevX = 0;
  let prevY = 0;

  for (const cmd of commands) {
    let isRedundant = false;

    // Check for redundant M/m (move to same position)
    if (cmd.type === 'M' && cmd.values.length === 2) {
      const [x, y] = cmd.values;
      if (Math.abs(x - prevX) < 1e-6 && Math.abs(y - prevY) < 1e-6) {
        isRedundant = true;
      }
    } else if (cmd.type === 'm' && cmd.values.length === 2) {
      const [dx, dy] = cmd.values;
      if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
        isRedundant = true;
      }
    }

    // Check for redundant L/l (zero-length line)
    if (cmd.type === 'L' && cmd.values.length === 2) {
      const [x, y] = cmd.values;
      if (Math.abs(x - prevX) < 1e-6 && Math.abs(y - prevY) < 1e-6) {
        isRedundant = true;
      }
    } else if (cmd.type === 'l' && cmd.values.length === 2) {
      const [dx, dy] = cmd.values;
      if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
        isRedundant = true;
      }
    }

    if (!isRedundant) {
      filtered.push(cmd);
      if (cmd.absolutePosition) {
        prevX = cmd.absolutePosition.x;
        prevY = cmd.absolutePosition.y;
      }
    }
  }

  return filtered;
}

/**
 * Comprehensive path shortening pipeline
 */
export function shortenPath(
  commands: PathCommand[],
  precision: number = 3
): {
  commands: PathCommand[];
  stats: {
    mergedCommands: number;
    convertedToHV: number;
    convertedAbsRel: number;
    removedRedundant: number;
  };
} {
  const originalCount = commands.length;

  // Step 1: Remove redundant commands
  let optimized = removeRedundantCommands(commands);
  const removedRedundant = originalCount - optimized.length;

  // Step 2: Merge consecutive same commands
  const beforeMerge = optimized.length;
  optimized = mergeConsecutiveCommands(optimized);
  const mergedCommands = beforeMerge - optimized.length;

  // Step 3: Convert L to H/V where beneficial
  const beforeHV = serializePath(optimized, precision).length;
  optimized = convertLtoHV(optimized, precision);
  const afterHV = serializePath(optimized, precision).length;
  const convertedToHV = beforeHV - afterHV;

  // Step 4: Optimize absolute/relative
  const beforeAbsRel = serializePath(optimized, precision).length;
  optimized = optimizeAbsoluteRelative(optimized, precision);
  const afterAbsRel = serializePath(optimized, precision).length;
  const convertedAbsRel = beforeAbsRel - afterAbsRel;

  return {
    commands: optimized,
    stats: {
      mergedCommands,
      convertedToHV,
      convertedAbsRel,
      removedRedundant,
    },
  };
}
