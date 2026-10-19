import fs from 'fs';
import path from 'path';
import { scanSVGSecurityBoundary } from './svg-xml-safety.js';

export const DEFAULT_MAX_SVG_INPUT_SIZE_BYTES = 10 * 1024 * 1024;

export type UnsafeInputPolicy = 'reject' | 'strip';

export interface SVGInputSafetyOptions {
  maxInputSizeBytes?: number;
  source?: string;
  unsafeInputPolicy?: UnsafeInputPolicy;
  warn?: (message: string) => void;
}

export interface UnsafeSVGFinding {
  kind:
    'event-handler' | 'active-element' | 'external-reference' | 'unsafe-css';
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

export async function readSVGInputFile(
  filePath: string,
  maxInputSizeBytes = DEFAULT_MAX_SVG_INPUT_SIZE_BYTES,
  source = filePath
): Promise<string> {
  if (!Number.isSafeInteger(maxInputSizeBytes) || maxInputSizeBytes <= 0) {
    throw new SVGContainmentError(
      'E_INVALID_INPUT_SIZE_LIMIT',
      'maxInputSizeBytes must be a positive safe integer.',
      { maxInputSizeBytes }
    );
  }
  const handle = await fs.promises.open(filePath, 'r');
  let bytes: Buffer;
  try {
    const metadata = await handle.stat();
    if (metadata.size > maxInputSizeBytes) {
      throw new SVGContainmentError(
        'E_SVG_INPUT_TOO_LARGE',
        `SVG input exceeds the ${maxInputSizeBytes}-byte limit.`,
        { actualSizeBytes: metadata.size, maxInputSizeBytes, source }
      );
    }
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    while (totalBytes <= maxInputSizeBytes) {
      const remaining = Math.min(64 * 1024, maxInputSizeBytes + 1 - totalBytes);
      const chunk = Buffer.allocUnsafe(remaining);
      const { bytesRead } = await handle.read(chunk, 0, remaining, null);
      if (bytesRead === 0) break;
      totalBytes += bytesRead;
      if (totalBytes > maxInputSizeBytes) {
        throw new SVGContainmentError(
          'E_SVG_INPUT_TOO_LARGE',
          `SVG input exceeds the ${maxInputSizeBytes}-byte limit.`,
          { actualSizeBytes: totalBytes, maxInputSizeBytes, source }
        );
      }
      chunks.push(chunk.subarray(0, bytesRead));
    }
    bytes = Buffer.concat(chunks, totalBytes);
  } finally {
    await handle.close();
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new SVGContainmentError(
      'E_UNSUPPORTED_SVG_ENCODING',
      'SVG input must be valid UTF-8.',
      { source }
    );
  }
}

export function detectUnsafeSVGContent(content: string): UnsafeSVGFinding[] {
  return scanSVGSecurityBoundary(content).findings;
}

function stripUnsafeSVGContent(
  content: string,
  edits: Array<{ start: number; end: number }>
): string {
  let output = '';
  let cursor = 0;
  for (const edit of edits.sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (edit.start < cursor) continue;
    output += content.slice(cursor, edit.start);
    cursor = edit.end;
  }
  return output + content.slice(cursor);
}

export function applySVGInputSafety(
  content: string,
  options: SVGInputSafetyOptions = {}
): string {
  const policy = options.unsafeInputPolicy ?? 'reject';
  if (policy !== 'reject' && policy !== 'strip') {
    throw new SVGContainmentError(
      'E_INVALID_UNSAFE_INPUT_POLICY',
      `Unsupported unsafe input policy "${String(policy)}".`,
      { policy }
    );
  }
  if (options.source !== undefined && typeof options.source !== 'string') {
    throw new SVGContainmentError(
      'E_INVALID_INPUT_SAFETY_OPTIONS',
      'source must be a string when provided.'
    );
  }
  if (options.warn !== undefined && typeof options.warn !== 'function') {
    throw new SVGContainmentError(
      'E_INVALID_INPUT_SAFETY_OPTIONS',
      'warn must be a function when provided.'
    );
  }
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

  const scan = scanSVGSecurityBoundary(content);
  const findings = scan.findings;
  if (findings.length === 0) {
    return content;
  }

  if (policy === 'reject') {
    throw new SVGContainmentError(
      'E_UNSAFE_SVG_CONTENT',
      `Unsafe SVG content was rejected${options.source ? ` in ${options.source}` : ''}.`,
      { findings, source: options.source }
    );
  }

  const warning =
    '[SVGER SECURITY WARNING] Unsafe SVG constructs were removed by explicit request. ' +
    'External references are not allowed; review source semantics before using strip mode.';
  (options.warn ?? (message => process.stderr.write(`${message}\n`)))(warning);

  const strippedContent = stripUnsafeSVGContent(content, scan.edits);
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
