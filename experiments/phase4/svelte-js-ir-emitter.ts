/**
 * Experimental deterministic Svelte-JS emitter for a conservative SVG IR v1
 * subset. This module is intentionally outside src/ and is not package-exported.
 */
import {
  IRValidationError,
  SVG_NAMESPACE,
  XML_NAMESPACE,
  validateAndFreezeIR,
  type ElementNode,
  type IRDocument,
  type IRNode,
} from '../phase3/ir-v1.js';

const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
const SVG_ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textPath',
  'title',
  'desc',
  'use',
  'symbol',
  'a',
  'clipPath',
  'mask',
  'pattern',
  'linearGradient',
  'radialGradient',
  'stop',
  'filter',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feMerge',
  'feMergeNode',
  'feOffset',
  'image',
  'metadata',
]);
const IDREF_ATTRIBUTES = new Set([
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'aria-activedescendant',
  'aria-flowto',
]);
const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_IR_SOURCE_BYTES = 10 * 1024 * 1024;

export type SvelteEmitterErrorCode =
  | 'E_SVELTE_IR_INVALID'
  | 'E_SVELTE_IR_UNSUPPORTED'
  | 'E_SVELTE_IR_REFERENCE'
  | 'E_SVELTE_IR_LIMIT';

export class SvelteIrEmitterError extends Error {
  readonly code: SvelteEmitterErrorCode;

  constructor(code: SvelteEmitterErrorCode, message: string) {
    super(message);
    this.name = 'SvelteIrEmitterError';
    this.code = code;
  }
}

export interface SvelteJsEmitterResult {
  readonly schemaVersion:
    | 'svger-svelte-js-emitter-v1'
    | 'svger-svelte-ts-ir-emitter-v1';
  readonly outcome: 'complete';
  readonly content: string;
  readonly outputBytes: number;
  readonly supportedSubset: 'static-svg-ir-v1';
}

function fail(code: SvelteEmitterErrorCode, message: string): never {
  throw new SvelteIrEmitterError(code, message);
}

function isXmlCharacter(codePoint: number): boolean {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
}

function assertXmlCharacters(value: string, label: string): void {
  for (const character of value) {
    if (!isXmlCharacter(character.codePointAt(0)!))
      fail(
        'E_SVELTE_IR_UNSUPPORTED',
        `${label} contains an invalid XML character`
      );
  }
}

function utf8Length(value: string): number {
  let length = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    length +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
  }
  return length;
}

function assertXmlName(localName: string, label: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/u.test(localName))
    fail(
      'E_SVELTE_IR_UNSUPPORTED',
      `${label} is outside the supported XML name subset`
    );
}

function declarationPrefix(
  qualifiedName: string,
  localName: string,
  prefix: string | null
): string | undefined {
  if (qualifiedName === 'xmlns' && prefix === null) return '';
  if (prefix === 'xmlns') return localName;
  return undefined;
}

function validateNamespaceDeclaration(
  qualifiedName: string,
  localName: string,
  prefix: string | null,
  value: string,
  bindings: Map<string, string>
): void {
  const declaredPrefix = declarationPrefix(qualifiedName, localName, prefix);
  if (declaredPrefix === undefined)
    fail('E_SVELTE_IR_UNSUPPORTED', 'Malformed namespace declaration');
  const reservedXmlns = 'http://www.w3.org/2000/xmlns/';
  if (
    declaredPrefix === 'xmlns' ||
    value === reservedXmlns ||
    (declaredPrefix === 'xml' && value !== XML_NAMESPACE) ||
    (declaredPrefix !== 'xml' && value === XML_NAMESPACE)
  ) {
    fail('E_SVELTE_IR_UNSUPPORTED', 'Reserved namespace binding is invalid');
  }
  if (declaredPrefix === '' && value !== SVG_NAMESPACE)
    fail(
      'E_SVELTE_IR_UNSUPPORTED',
      'Only the SVG default namespace is supported'
    );
  if (
    declaredPrefix !== '' &&
    value !== SVG_NAMESPACE &&
    value !== XLINK_NAMESPACE &&
    value !== XML_NAMESPACE
  )
    fail(
      'E_SVELTE_IR_UNSUPPORTED',
      'Foreign namespace declarations are unsupported'
    );
  if (declaredPrefix === 'xml' && value === XML_NAMESPACE) return;
  if (value === '') bindings.delete(declaredPrefix);
  else bindings.set(declaredPrefix, value);
}

interface CollectedSemantics {
  readonly ids: Map<string, number>;
  readonly references: Array<{
    readonly kind: string;
    readonly target: string;
  }>;
  hasXlink: boolean;
}

function collectAndValidateSemantics(root: ElementNode): CollectedSemantics {
  const ids = new Map<string, number>();
  const references: Array<{ kind: string; target: string }> = [];
  let hasXlink = false;

  const visit = (
    element: ElementNode,
    inherited: Map<string, string>
  ): void => {
    if (element.interpretation !== 'known-svg')
      fail(
        'E_SVELTE_IR_UNSUPPORTED',
        'Unknown or foreign SVG elements are unsupported'
      );
    if (element.name.namespaceUri !== SVG_NAMESPACE)
      fail(
        'E_SVELTE_IR_UNSUPPORTED',
        'Every emitted element must be in the SVG namespace'
      );
    assertXmlName(element.name.localName, 'Element name');
    if (!SVG_ELEMENTS.has(element.name.localName))
      fail(
        'E_SVELTE_IR_UNSUPPORTED',
        'SVG element is outside the supported static subset'
      );
    if (element.xmlSpace.state !== 'resolved')
      fail('E_SVELTE_IR_UNSUPPORTED', 'Effective xml:space must be resolved');

    const bindings = new Map(inherited);
    for (const attribute of element.attributes) {
      if (attribute.name.namespaceUri === XMLNS_NAMESPACE) {
        validateNamespaceDeclaration(
          attribute.name.qualifiedName,
          attribute.name.localName,
          attribute.name.prefix,
          attribute.value,
          bindings
        );
      }
    }
    const elementPrefix = element.name.prefix ?? '';
    if (bindings.get(elementPrefix) !== element.name.namespaceUri)
      fail(
        'E_SVELTE_IR_INVALID',
        'Element QName and namespace binding disagree'
      );

    const attributeNames = new Set<string>();
    for (const attribute of element.attributes) {
      assertXmlCharacters(attribute.value, 'Attribute value');
      const { namespaceUri, localName, prefix, qualifiedName } = attribute.name;
      const key = `${namespaceUri ?? ''}\u0000${localName}`;
      if (attributeNames.has(key))
        fail('E_SVELTE_IR_INVALID', 'Duplicate expanded attribute name');
      attributeNames.add(key);

      if (namespaceUri === XMLNS_NAMESPACE) continue;
      assertXmlName(localName, 'Attribute name');
      if (prefix !== null && bindings.get(prefix) !== namespaceUri)
        fail(
          'E_SVELTE_IR_INVALID',
          'Attribute QName and namespace binding disagree'
        );
      if (prefix === null && namespaceUri !== null)
        fail(
          'E_SVELTE_IR_INVALID',
          'Unprefixed attributes cannot have a namespace'
        );
      if (namespaceUri === XML_NAMESPACE) {
        if (qualifiedName !== 'xml:space' || localName !== 'space')
          fail('E_SVELTE_IR_UNSUPPORTED', 'Only xml:space is supported');
        if (attribute.value !== 'default' && attribute.value !== 'preserve')
          fail('E_SVELTE_IR_INVALID', 'xml:space must be default or preserve');
      } else if (namespaceUri === XLINK_NAMESPACE) {
        if (localName !== 'href')
          fail('E_SVELTE_IR_UNSUPPORTED', 'Only xlink:href is supported');
        hasXlink = true;
      } else if (namespaceUri !== null) {
        fail('E_SVELTE_IR_UNSUPPORTED', 'Namespaced attribute is unsupported');
      }

      if (
        /^(?:on[a-z]|bind:|class:|use:|transition:|in:|out:|animate:|let:)/iu.test(
          qualifiedName
        )
      ) {
        fail(
          'E_SVELTE_IR_UNSUPPORTED',
          'Svelte directive-like attributes are unsupported'
        );
      }
      if (/^on[a-z]/iu.test(localName))
        fail(
          'E_SVELTE_IR_UNSUPPORTED',
          'Event-handler attributes are unsupported'
        );
      if (/url\s*\(/iu.test(attribute.value))
        fail(
          'E_SVELTE_IR_UNSUPPORTED',
          'CSS URL references are outside the supported subset'
        );

      if (namespaceUri === null && localName === 'id' && attribute.value !== '')
        ids.set(attribute.value, (ids.get(attribute.value) ?? 0) + 1);
      if (
        (namespaceUri === null || namespaceUri === XLINK_NAMESPACE) &&
        localName === 'href'
      ) {
        if (!attribute.value.startsWith('#') || attribute.value.length === 1)
          fail(
            'E_SVELTE_IR_REFERENCE',
            'Only non-empty local fragment references are supported'
          );
        references.push({ kind: 'href', target: attribute.value.slice(1) });
      }
      if (namespaceUri === null && IDREF_ATTRIBUTES.has(localName)) {
        for (const target of attribute.value
          .trim()
          .split(/\s+/u)
          .filter(Boolean))
          references.push({ kind: localName, target });
      }
    }

    for (const child of element.children) {
      if (child.kind === 'element') visit(child, bindings);
      else if (child.kind === 'generated')
        fail('E_SVELTE_IR_UNSUPPORTED', 'Generated IR nodes are unsupported');
      else if (child.kind === 'comment') {
        if (child.value.includes('--') || child.value.endsWith('-'))
          fail('E_SVELTE_IR_INVALID', 'Comment content is not valid XML');
      } else assertXmlCharacters(child.value, 'Text');
    }
  };

  visit(root, new Map([['xml', XML_NAMESPACE]]));
  for (const count of ids.values()) {
    if (count > 1)
      fail('E_SVELTE_IR_REFERENCE', 'Duplicate SVG IDs are unsupported');
  }
  for (const reference of references) {
    if (!ids.has(reference.target))
      fail('E_SVELTE_IR_REFERENCE', `Unresolved ${reference.kind} target`);
  }
  return { ids, references, hasXlink };
}

interface RenderState {
  readonly chunks: string[];
  readonly maxBytes: number;
  bytes: number;
}

export interface PreparedStaticSvgIR {
  readonly document: IRDocument;
  readonly hasXlink: boolean;
}

/** Validate the bounded common static-SVG contract without generating output. */
export function validateStaticSvgIRV1(input: unknown): PreparedStaticSvgIR {
  let document: IRDocument;
  try {
    document = validateAndFreezeIR(input);
  } catch (error) {
    const detail =
      error instanceof IRValidationError ? error.message : 'invalid IR';
    fail('E_SVELTE_IR_INVALID', `IR validation failed: ${detail}`);
  }
  if (document.source.utf8ByteLength > MAX_IR_SOURCE_BYTES)
    fail('E_SVELTE_IR_LIMIT', 'IR source exceeds the maximum input byte limit');
  if (document.prolog.length || document.epilog.length)
    fail(
      'E_SVELTE_IR_UNSUPPORTED',
      'Document-level comments are not supported in this component subset'
    );
  const { hasXlink } = collectAndValidateSemantics(document.root);
  return Object.freeze({ document, hasXlink });
}

function append(state: RenderState, value: string): void {
  state.bytes += utf8Length(value);
  if (state.bytes > state.maxBytes)
    fail(
      'E_SVELTE_IR_LIMIT',
      'Generated Svelte artifact exceeds the byte limit'
    );
  state.chunks.push(value);
}

function appendEscaped(
  value: string,
  state: RenderState,
  attribute = false
): void {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (!isXmlCharacter(codePoint))
      fail(
        'E_SVELTE_IR_UNSUPPORTED',
        'Text or attribute contains an invalid XML character'
      );
    const escaped =
      character === '&'
        ? '&amp;'
        : character === '<'
          ? '&lt;'
          : character === '>'
            ? '&gt;'
            : character === '{'
              ? '&#123;'
              : character === '}'
                ? '&#125;'
                : attribute && character === '"'
                  ? '&quot;'
                  : character;
    append(state, escaped);
  }
}

function jsStringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/</gu, '\\u003c')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}

function dimensionLiteral(value: string | undefined): string {
  if (value === undefined) return '24';
  const decoded = value.replace(/px$/u, '');
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(decoded)) {
    const numeric = Number(decoded);
    if (Number.isFinite(numeric)) return String(numeric);
  }
  return jsStringLiteral(value);
}

function rootAttribute(root: ElementNode, name: string): string | undefined {
  return root.attributes.find(
    attribute =>
      attribute.name.namespaceUri === null && attribute.name.localName === name
  )?.value;
}

function renderNode(
  node: IRNode,
  state: RenderState,
  root = false,
  hasXlink = false
): void {
  if (node.kind === 'text' || node.kind === 'cdata') {
    appendEscaped(node.value, state);
    return;
  }
  if (node.kind === 'comment') {
    append(state, `<!--${node.value}-->`);
    return;
  }
  if (node.kind === 'generated')
    fail('E_SVELTE_IR_UNSUPPORTED', 'Generated IR nodes are unsupported');
  if (node.kind !== 'element')
    fail('E_SVELTE_IR_INVALID', 'Unsupported IR node kind');

  const name = node.name.localName;
  append(state, `<${name}`);
  if (root) {
    append(state, ` xmlns="${SVG_NAMESPACE}"`);
    if (hasXlink) append(state, ` xmlns:xlink="${XLINK_NAMESPACE}"`);
    append(state, ' class={className} style={style}');
    append(state, ' width={width} height={height}');
    append(state, ' fill={fill} stroke={stroke}');
    append(state, ' viewBox="');
    appendEscaped(rootAttribute(node, 'viewBox') || '0 0 24 24', state, true);
    append(state, '" {...$$restProps}');
  }
  for (const attribute of node.attributes) {
    if (attribute.name.namespaceUri === XMLNS_NAMESPACE) continue;
    if (
      root &&
      attribute.name.namespaceUri === null &&
      [
        'class',
        'style',
        'width',
        'height',
        'fill',
        'stroke',
        'viewBox',
      ].includes(attribute.name.localName)
    )
      continue;
    const qualifiedName =
      attribute.name.namespaceUri === XLINK_NAMESPACE
        ? `xlink:${attribute.name.localName}`
        : attribute.name.namespaceUri === XML_NAMESPACE
          ? `xml:${attribute.name.localName}`
          : attribute.name.localName;
    append(state, ` ${qualifiedName}="`);
    appendEscaped(attribute.value, state, true);
    append(state, '"');
  }
  append(state, '>');
  for (const child of node.children) renderNode(child, state, false, hasXlink);
  append(state, `</${name}>`);
}

/** Emit deterministic static Svelte markup from a validated and frozen IR v1. */
function emitSvelteFromIR(
  input: unknown,
  options: { readonly maxOutputBytes?: number },
  typescript: boolean
): SvelteJsEmitterResult {
  const prepared = validateStaticSvgIRV1(input);
  const { document, hasXlink } = prepared;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  if (
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes <= 0 ||
    maxOutputBytes > DEFAULT_MAX_OUTPUT_BYTES
  ) {
    fail(
      'E_SVELTE_IR_LIMIT',
      'Output byte limit is outside the supported range'
    );
  }
  const state: RenderState = { chunks: [], maxBytes: maxOutputBytes, bytes: 0 };
  const width = rootAttribute(document.root, 'width');
  const height = rootAttribute(document.root, 'height');
  const fill = rootAttribute(document.root, 'fill');
  const scriptAttribute = typescript ? ' lang="ts"' : '';
  const stringType = typescript ? ': string' : '';
  const dimensionType = typescript ? ': string | number' : '';
  append(
    state,
    `<script${scriptAttribute}>\n  export let className${stringType} = '';\n  export let style${stringType} = '';\n  export let width${dimensionType} = ${dimensionLiteral(width)};\n  export let height${dimensionType} = ${dimensionLiteral(height)};\n  export let fill${stringType} = ${jsStringLiteral(fill || 'currentColor')};\n  export let stroke${stringType} = '';\n</script>\n`
  );
  renderNode(document.root, state, true, hasXlink);
  const content = state.chunks.join('');
  return Object.freeze({
    schemaVersion: typescript
      ? 'svger-svelte-ts-ir-emitter-v1'
      : 'svger-svelte-js-emitter-v1',
    outcome: 'complete',
    content,
    outputBytes: state.bytes,
    supportedSubset: 'static-svg-ir-v1',
  });
}

/** Emit the Svelte-JavaScript component contract from validated IR v1. */
export function emitSvelteJsFromIR(
  input: unknown,
  options: { readonly maxOutputBytes?: number } = {}
): SvelteJsEmitterResult {
  return emitSvelteFromIR(input, options, false);
}

/** Emit the Svelte-TypeScript component contract from validated IR v1. */
export function emitSvelteTsFromIR(
  input: unknown,
  options: { readonly maxOutputBytes?: number } = {}
): SvelteJsEmitterResult {
  return emitSvelteFromIR(input, options, true);
}
