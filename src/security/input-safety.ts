import fs from 'fs';
import path from 'path';

export const DEFAULT_MAX_SVG_INPUT_SIZE_BYTES = 10 * 1024 * 1024;

export type UnsafeInputPolicy = 'reject' | 'strip';

export interface SVGInputSafetyOptions {
  maxInputSizeBytes?: number;
  source?: string;
  unsafeInputPolicy?: UnsafeInputPolicy;
  warn?: (message: string) => void;
}

export interface UnsafeSVGFinding {
  kind: 'event-handler' | 'javascript-uri' | 'script-element';
  sample: string;
}

export class SVGContainmentError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(`${code}: ${message}`);
    this.name = 'SVGContainmentError';
    this.code = code;
    this.details = details;
  }
}

const SCRIPT_ELEMENT_PATTERN = /<\s*script\b[^>]*>/gi;
const SCRIPT_BLOCK_PATTERN = /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const SCRIPT_TAG_PATTERN = /<\s*\/?\s*script\b[^>]*\/?\s*>/gi;
const EVENT_HANDLER_PATTERN =
  /\s+on[a-z][\w:.-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URI_PATTERN =
  /=\s*(?:"\s*javascript\s*:[^"]*"|'\s*javascript\s*:[^']*'|javascript\s*:[^\s>]+)/gi;
const JAVASCRIPT_URI_ATTRIBUTE_PATTERN =
  /\s+[a-z_:][\w:.-]*\s*=\s*(?:"\s*javascript\s*:[^"]*"|'\s*javascript\s*:[^']*'|javascript\s*:[^\s>]+)/gi;

function firstMatch(pattern: RegExp, content: string): string | undefined {
  pattern.lastIndex = 0;
  const match = pattern.exec(content);
  pattern.lastIndex = 0;
  return match?.[0].slice(0, 160);
}

export function detectUnsafeSVGContent(content: string): UnsafeSVGFinding[] {
  const findings: UnsafeSVGFinding[] = [];
  const scriptSample = firstMatch(SCRIPT_ELEMENT_PATTERN, content);
  if (scriptSample) {
    findings.push({ kind: 'script-element', sample: scriptSample });
  }

  const eventHandlerSample = firstMatch(EVENT_HANDLER_PATTERN, content);
  if (eventHandlerSample) {
    findings.push({ kind: 'event-handler', sample: eventHandlerSample.trim() });
  }

  const javascriptURISample = firstMatch(JAVASCRIPT_URI_PATTERN, content);
  if (javascriptURISample) {
    findings.push({ kind: 'javascript-uri', sample: javascriptURISample });
  }

  return findings;
}

function stripUnsafeSVGContent(content: string): string {
  return content
    .replace(SCRIPT_BLOCK_PATTERN, '')
    .replace(SCRIPT_TAG_PATTERN, '')
    .replace(EVENT_HANDLER_PATTERN, '')
    .replace(JAVASCRIPT_URI_ATTRIBUTE_PATTERN, '');
}

export function applySVGInputSafety(
  content: string,
  options: SVGInputSafetyOptions = {}
): string {
  const maxInputSizeBytes =
    options.maxInputSizeBytes ?? DEFAULT_MAX_SVG_INPUT_SIZE_BYTES;
  if (!Number.isSafeInteger(maxInputSizeBytes) || maxInputSizeBytes <= 0) {
    throw new SVGContainmentError(
      'E_INVALID_INPUT_SIZE_LIMIT',
      'maxInputSizeBytes must be a positive safe integer.',
      { maxInputSizeBytes }
    );
  }

  const actualSizeBytes = Buffer.byteLength(content, 'utf8');
  if (actualSizeBytes > maxInputSizeBytes) {
    throw new SVGContainmentError(
      'E_SVG_INPUT_TOO_LARGE',
      `SVG input exceeds the ${maxInputSizeBytes}-byte limit.`,
      {
        actualSizeBytes,
        maxInputSizeBytes,
        source: options.source,
      }
    );
  }

  const findings = detectUnsafeSVGContent(content);
  if (findings.length === 0) {
    return content;
  }

  const policy = options.unsafeInputPolicy ?? 'reject';
  if (policy !== 'reject' && policy !== 'strip') {
    throw new SVGContainmentError(
      'E_INVALID_UNSAFE_INPUT_POLICY',
      `Unsupported unsafe input policy "${String(policy)}".`,
      { policy }
    );
  }

  if (policy === 'reject') {
    throw new SVGContainmentError(
      'E_UNSAFE_SVG_CONTENT',
      `Unsafe raw SVG content was rejected${options.source ? ` in ${options.source}` : ''}.`,
      { findings, source: options.source }
    );
  }

  const warning =
    '[SVGER SECURITY WARNING] Unsafe SVG content was stripped by explicit request. ' +
    'The Phase 0 sanitizer is a temporary, incomplete containment measure.';
  (options.warn ?? (message => process.stderr.write(`${message}\n`)))(warning);

  const strippedContent = stripUnsafeSVGContent(content);
  const remainingFindings = detectUnsafeSVGContent(strippedContent);
  if (remainingFindings.length > 0) {
    throw new SVGContainmentError(
      'E_UNSAFE_SVG_CONTENT',
      'Unsafe SVG content remained after the temporary strip policy.',
      { findings: remainingFindings, source: options.source }
    );
  }

  return strippedContent;
}

function isOutsideRoot(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  );
}

export function resolveOutputArtifactPath(
  outputRoot: string,
  ...artifactSegments: string[]
): string {
  const resolvedRoot = path.resolve(outputRoot);
  const resolvedArtifact = path.resolve(resolvedRoot, ...artifactSegments);

  if (
    resolvedArtifact === resolvedRoot ||
    isOutsideRoot(resolvedRoot, resolvedArtifact)
  ) {
    throw new SVGContainmentError(
      'E_OUTPUT_PATH_ESCAPE',
      'Resolved artifact path escapes the designated output root.',
      { outputRoot: resolvedRoot, resolvedArtifact }
    );
  }

  if (
    fs.existsSync(resolvedArtifact) &&
    fs.lstatSync(resolvedArtifact).isSymbolicLink()
  ) {
    throw new SVGContainmentError(
      'E_OUTPUT_PATH_ESCAPE',
      'Refusing to write an artifact through a symbolic link.',
      { outputRoot: resolvedRoot, resolvedArtifact }
    );
  }

  if (fs.existsSync(resolvedRoot)) {
    const physicalRoot = fs.realpathSync(resolvedRoot);
    const artifactParent = path.dirname(resolvedArtifact);
    if (fs.existsSync(artifactParent)) {
      const physicalParent = fs.realpathSync(artifactParent);
      if (isOutsideRoot(physicalRoot, physicalParent)) {
        throw new SVGContainmentError(
          'E_OUTPUT_PATH_ESCAPE',
          'Resolved artifact parent escapes the physical output root.',
          { outputRoot: physicalRoot, resolvedArtifact: physicalParent }
        );
      }
    }
  }

  return resolvedArtifact;
}
