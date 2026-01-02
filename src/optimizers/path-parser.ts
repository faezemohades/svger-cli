/**
 * Phase 4: SVG Path Parser
 *
 * Responsibilities:
 * 1. Tokenize SVG path `d` attribute into commands
 * 2. Parse all path commands: M/L/C/Q/S/A/H/V/Z (absolute/relative)
 * 3. Handle coordinate pairs with proper precision
 * 4. Convert between absolute/relative representations
 * 5. Serialize path back to string
 *
 * Foundation for path optimization stages.
 */

/**
 * Path command types (uppercase = absolute, lowercase = relative)
 */
export type PathCommandType =
  | 'M'
  | 'm' // moveto
  | 'L'
  | 'l' // lineto
  | 'H'
  | 'h' // horizontal lineto
  | 'V'
  | 'v' // vertical lineto
  | 'C'
  | 'c' // cubic Bézier
  | 'S'
  | 's' // smooth cubic Bézier
  | 'Q'
  | 'q' // quadratic Bézier
  | 'T'
  | 't' // smooth quadratic Bézier
  | 'A'
  | 'a' // elliptical arc
  | 'Z'
  | 'z'; // closepath

/**
 * Parsed path command
 */
export interface PathCommand {
  /** Command type (e.g., 'M', 'L', 'C') */
  type: PathCommandType;

  /** Coordinate values (varies by command type) */
  values: number[];

  /** Absolute position after this command (for conversion) */
  absolutePosition?: { x: number; y: number };
}

/**
 * Complete parsed path structure
 */
export interface ParsedPath {
  /** Array of path commands */
  commands: PathCommand[];

  /** Original path string (for comparison) */
  original: string;
}

/**
 * Number of coordinate values per command type
 * Note: Some commands (L, C, etc.) can have multiple coordinate sets
 */
const COMMAND_PARAMS: Record<string, number> = {
  M: 2,
  m: 2, // x y
  L: 2,
  l: 2, // x y
  H: 1,
  h: 1, // x
  V: 1,
  v: 1, // y
  C: 6,
  c: 6, // x1 y1 x2 y2 x y
  S: 4,
  s: 4, // x2 y2 x y
  Q: 4,
  q: 4, // x1 y1 x y
  T: 2,
  t: 2, // x y
  A: 7,
  a: 7, // rx ry rotation large-arc sweep x y
  Z: 0,
  z: 0, // no params
};

/**
 * Check if character is a path command letter
 */
function isCommandLetter(char: string): boolean {
  return /[MmLlHhVvCcSsQqTtAaZz]/.test(char);
}

/**
 * Check if character is numeric (digit, decimal, sign, exponent)
 */
function isNumericChar(char: string): boolean {
  return /[\d.eE+-]/.test(char);
}

/**
 * Tokenize path string into array of tokens (commands and numbers)
 */
function tokenizePath(pathData: string): string[] {
  const tokens: string[] = [];
  let currentToken = '';
  let i = 0;

  while (i < pathData.length) {
    const char = pathData[i];

    // Skip whitespace and commas
    if (/[\s,]/.test(char)) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
      i++;
      continue;
    }

    // Command letter
    if (isCommandLetter(char)) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
      tokens.push(char);
      i++;
      continue;
    }

    // Numeric value
    if (isNumericChar(char) || char === '-' || char === '+') {
      // Handle sign in the middle of a number (e.g., "1.5e-3")
      if (
        (char === '-' || char === '+') &&
        currentToken &&
        /[eE]$/.test(currentToken)
      ) {
        currentToken += char;
        i++;
        continue;
      }

      // Start new token if we have a sign and already have content
      if (
        (char === '-' || char === '+') &&
        currentToken &&
        !/[eE]$/.test(currentToken)
      ) {
        tokens.push(currentToken);
        currentToken = char;
        i++;
        continue;
      }

      currentToken += char;
      i++;
      continue;
    }

    // Unknown character - skip
    i++;
  }

  // Push remaining token
  if (currentToken) {
    tokens.push(currentToken);
  }

  return tokens;
}

/**
 * Parse tokens into path commands
 */
export function parsePath(pathData: string): ParsedPath {
  const tokens = tokenizePath(pathData);
  const commands: PathCommand[] = [];
  let i = 0;

  // Track current position for relative commands
  let currentX = 0;
  let currentY = 0;
  let currentCommand: PathCommandType | null = null;

  while (i < tokens.length) {
    const token = tokens[i];

    // Command letter
    if (isCommandLetter(token)) {
      currentCommand = token as PathCommandType;
      i++;
      continue;
    }

    // Must have a command
    if (!currentCommand) {
      i++;
      continue;
    }

    // Parse command parameters
    const paramCount = COMMAND_PARAMS[currentCommand];

    // Z/z has no parameters
    if (paramCount === 0) {
      commands.push({
        type: currentCommand,
        values: [],
        absolutePosition: { x: currentX, y: currentY },
      });
      // After Z, implicitly return to start (will be handled by optimizer)
      continue;
    }

    // Collect parameter values
    const values: number[] = [];
    for (let j = 0; j < paramCount && i < tokens.length; j++) {
      const value = parseFloat(tokens[i]);
      if (isNaN(value)) break;
      values.push(value);
      i++;
    }

    // Must have all required parameters
    if (values.length < paramCount) {
      // Skip incomplete command
      continue;
    }

    // Update current position
    const isUpperCase = currentCommand === currentCommand.toUpperCase();

    if (isUpperCase) {
      // Absolute commands
      switch (currentCommand) {
        case 'M':
        case 'L':
        case 'T':
          currentX = values[values.length - 2];
          currentY = values[values.length - 1];
          break;
        case 'H':
          currentX = values[values.length - 1];
          break;
        case 'V':
          currentY = values[values.length - 1];
          break;
        case 'C':
          currentX = values[values.length - 2];
          currentY = values[values.length - 1];
          break;
        case 'S':
        case 'Q':
          currentX = values[values.length - 2];
          currentY = values[values.length - 1];
          break;
        case 'A':
          currentX = values[values.length - 2];
          currentY = values[values.length - 1];
          break;
      }
    } else {
      // Relative commands
      switch (currentCommand) {
        case 'm':
        case 'l':
        case 't':
          currentX += values[values.length - 2];
          currentY += values[values.length - 1];
          break;
        case 'h':
          currentX += values[values.length - 1];
          break;
        case 'v':
          currentY += values[values.length - 1];
          break;
        case 'c':
          currentX += values[values.length - 2];
          currentY += values[values.length - 1];
          break;
        case 's':
        case 'q':
          currentX += values[values.length - 2];
          currentY += values[values.length - 1];
          break;
        case 'a':
          currentX += values[values.length - 2];
          currentY += values[values.length - 1];
          break;
      }
    }

    // Store command with absolute position
    commands.push({
      type: currentCommand,
      values,
      absolutePosition: { x: currentX, y: currentY },
    });

    // After M/m, implicit L/l commands can follow
    if (currentCommand === 'M') {
      currentCommand = 'L';
    } else if (currentCommand === 'm') {
      currentCommand = 'l';
    }
  }

  return {
    commands,
    original: pathData,
  };
}

/**
 * Convert command to absolute
 */
export function toAbsolute(
  cmd: PathCommand,
  prevX: number = 0,
  prevY: number = 0
): PathCommand {
  const type = cmd.type;

  // Already absolute
  if (type === type.toUpperCase()) {
    return cmd;
  }

  // Convert relative to absolute
  const absoluteType = type.toUpperCase() as PathCommandType;
  const values = [...cmd.values];

  switch (type) {
    case 'm':
    case 'l':
    case 't':
      // x y → x+prevX y+prevY
      for (let i = 0; i < values.length; i += 2) {
        values[i] += prevX;
        values[i + 1] += prevY;
      }
      break;

    case 'h':
      // x → x+prevX
      for (let i = 0; i < values.length; i++) {
        values[i] += prevX;
      }
      break;

    case 'v':
      // y → y+prevY
      for (let i = 0; i < values.length; i++) {
        values[i] += prevY;
      }
      break;

    case 'c':
      // x1 y1 x2 y2 x y → all +prev
      for (let i = 0; i < values.length; i += 6) {
        values[i] += prevX;
        values[i + 1] += prevY;
        values[i + 2] += prevX;
        values[i + 3] += prevY;
        values[i + 4] += prevX;
        values[i + 5] += prevY;
      }
      break;

    case 's':
    case 'q':
      // x1 y1 x y → all +prev
      for (let i = 0; i < values.length; i += 4) {
        values[i] += prevX;
        values[i + 1] += prevY;
        values[i + 2] += prevX;
        values[i + 3] += prevY;
      }
      break;

    case 'a':
      // rx ry rotation large-arc sweep x y → only x,y +prev
      for (let i = 0; i < values.length; i += 7) {
        values[i + 5] += prevX;
        values[i + 6] += prevY;
      }
      break;

    case 'z':
      // No conversion needed
      break;
  }

  return {
    type: absoluteType,
    values,
    absolutePosition: cmd.absolutePosition,
  };
}

/**
 * Convert command to relative
 */
export function toRelative(
  cmd: PathCommand,
  prevX: number = 0,
  prevY: number = 0
): PathCommand {
  const type = cmd.type;

  // Already relative
  if (type === type.toLowerCase()) {
    return cmd;
  }

  // Convert absolute to relative
  const relativeType = type.toLowerCase() as PathCommandType;
  const values = [...cmd.values];

  switch (type) {
    case 'M':
    case 'L':
    case 'T':
      // x y → x-prevX y-prevY
      for (let i = 0; i < values.length; i += 2) {
        values[i] -= prevX;
        values[i + 1] -= prevY;
      }
      break;

    case 'H':
      // x → x-prevX
      for (let i = 0; i < values.length; i++) {
        values[i] -= prevX;
      }
      break;

    case 'V':
      // y → y-prevY
      for (let i = 0; i < values.length; i++) {
        values[i] -= prevY;
      }
      break;

    case 'C':
      // x1 y1 x2 y2 x y → all -prev
      for (let i = 0; i < values.length; i += 6) {
        values[i] -= prevX;
        values[i + 1] -= prevY;
        values[i + 2] -= prevX;
        values[i + 3] -= prevY;
        values[i + 4] -= prevX;
        values[i + 5] -= prevY;
      }
      break;

    case 'S':
    case 'Q':
      // x1 y1 x y → all -prev
      for (let i = 0; i < values.length; i += 4) {
        values[i] -= prevX;
        values[i + 1] -= prevY;
        values[i + 2] -= prevX;
        values[i + 3] -= prevY;
      }
      break;

    case 'A':
      // rx ry rotation large-arc sweep x y → only x,y -prev
      for (let i = 0; i < values.length; i += 7) {
        values[i + 5] -= prevX;
        values[i + 6] -= prevY;
      }
      break;

    case 'Z':
      // No conversion needed
      break;
  }

  return {
    type: relativeType,
    values,
    absolutePosition: cmd.absolutePosition,
  };
}

/**
 * Serialize path commands back to string
 */
export function serializePath(
  commands: PathCommand[],
  precision: number = 3
): string {
  const parts: string[] = [];

  for (const cmd of commands) {
    // Command letter
    parts.push(cmd.type);

    // Round values
    const roundedValues = cmd.values.map(v => {
      const rounded = Number(v.toFixed(precision));
      // Remove trailing zeros and unnecessary decimal point
      return rounded.toString().replace(/\.?0+$/, '');
    });

    // Join values intelligently (avoid space before negative numbers if possible)
    if (roundedValues.length > 0) {
      let valueStr = roundedValues[0];
      for (let i = 1; i < roundedValues.length; i++) {
        const val = roundedValues[i];
        // Add space unless value starts with - or previous ends with comma
        if (val.startsWith('-')) {
          valueStr += val;
        } else {
          valueStr += ' ' + val;
        }
      }
      parts.push(valueStr);
    }
  }

  return parts.join('');
}

/**
 * Calculate byte size difference between absolute and relative
 * Returns: negative if relative is smaller, positive if absolute is smaller
 */
export function compareAbsoluteRelativeSize(
  cmd: PathCommand,
  prevX: number = 0,
  prevY: number = 0,
  precision: number = 3
): number {
  const absoluteCmd = toAbsolute(cmd, prevX, prevY);
  const relativeCmd = toRelative(cmd, prevX, prevY);

  const absoluteStr = serializePath([absoluteCmd], precision);
  const relativeStr = serializePath([relativeCmd], precision);

  return absoluteStr.length - relativeStr.length;
}
