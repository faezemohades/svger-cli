import {
  IRValidationError,
  SVG_NAMESPACE,
  XML_NAMESPACE,
  XMLNS_NAMESPACE,
  XLINK_NAMESPACE,
  validateAndFreezeIR,
  type ElementNode,
  type IRDocument,
  type IRNode,
} from './ir-v1.js';

const ELEMENTS = new Set([
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
const IDREFS = new Set([
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'aria-activedescendant',
  'aria-flowto',
]);
const LIMIT_BYTES = 16 * 1024 * 1024;

export class SvelteIRCompileError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SvelteIRCompileError';
    this.code = code;
  }
}
function fail(code: string, message: string): never {
  throw new SvelteIRCompileError(code, message);
}
function xmlCharacters(value: string, label: string): void {
  for (const char of value) {
    const cp = char.codePointAt(0)!;
    if (
      !(
        cp === 9 ||
        cp === 10 ||
        cp === 13 ||
        (cp >= 0x20 && cp <= 0xd7ff) ||
        (cp >= 0xe000 && cp <= 0xfffd) ||
        (cp >= 0x10000 && cp <= 0x10ffff)
      )
    )
      fail(
        'E_SVELTE_IR_UNSUPPORTED',
        `${label} contains an invalid XML character`
      );
  }
}
function escapeMarkup(value: string, attribute = false): string {
  xmlCharacters(value, attribute ? 'Attribute' : 'Text');
  return value.replace(/[&<>{}"]/gu, char =>
    char === '&'
      ? '&amp;'
      : char === '<'
        ? '&lt;'
        : char === '>'
          ? '&gt;'
          : char === '{'
            ? '&#123;'
            : char === '}'
              ? '&#125;'
              : attribute
                ? '&quot;'
                : char
  );
}
function quoteJS(value: string): string {
  return JSON.stringify(value)
    .replace(/</gu, '\\u003c')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}
function dimension(value: string | undefined): string {
  if (value === undefined) return '24';
  const normalized = value.replace(/px$/u, '');
  if (
    /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(normalized) &&
    Number.isFinite(Number(normalized))
  )
    return String(Number(normalized));
  return quoteJS(value);
}
function attr(element: ElementNode, key: string): string | undefined {
  return element.attributes.find(
    a => a.name.namespaceUri === null && a.name.localName === key
  )?.value;
}

function validate(document: IRDocument): boolean {
  const ids = new Set<string>();
  const refs: string[] = [];
  let hasXlink = false;
  const visit = (element: ElementNode, spaces: Map<string, string>): void => {
    if (
      element.interpretation !== 'known-svg' ||
      element.name.namespaceUri !== SVG_NAMESPACE ||
      !ELEMENTS.has(element.name.localName)
    )
      fail(
        'E_SVELTE_IR_UNSUPPORTED',
        'SVG element is outside the supported static subset'
      );
    if (element.xmlSpace.state !== 'resolved')
      fail('E_SVELTE_IR_UNSUPPORTED', 'Effective xml:space must be resolved');
    const bindings = new Map(spaces);
    for (const a of element.attributes)
      if (a.name.namespaceUri === XMLNS_NAMESPACE) {
        const declared =
          a.name.qualifiedName === 'xmlns'
            ? ''
            : a.name.prefix === 'xmlns'
              ? a.name.localName
              : undefined;
        if (
          declared === undefined ||
          declared === 'xmlns' ||
          a.value === XMLNS_NAMESPACE ||
          (declared === 'xml' && a.value !== XML_NAMESPACE) ||
          (declared !== 'xml' && a.value === XML_NAMESPACE)
        )
          fail(
            'E_SVELTE_IR_UNSUPPORTED',
            'Namespace declaration is outside the supported subset'
          );
        if (declared === '' && a.value !== SVG_NAMESPACE)
          fail(
            'E_SVELTE_IR_UNSUPPORTED',
            'Only the SVG default namespace is supported'
          );
        if (declared && !['xml', 'xlink'].includes(declared))
          fail(
            'E_SVELTE_IR_UNSUPPORTED',
            'Foreign namespace declarations are unsupported'
          );
        if (declared === 'xml' && a.value === XML_NAMESPACE) continue;
        if (a.value === '') bindings.delete(declared);
        else bindings.set(declared, a.value);
      }
    if (bindings.get(element.name.prefix ?? '') !== element.name.namespaceUri)
      fail(
        'E_SVELTE_IR_INVALID',
        'Element QName and namespace binding disagree'
      );
    const seen = new Set<string>();
    for (const a of element.attributes) {
      xmlCharacters(a.value, 'Attribute');
      const key = `${a.name.namespaceUri ?? ''}\0${a.name.localName}`;
      if (seen.has(key))
        fail('E_SVELTE_IR_INVALID', 'Duplicate expanded attribute name');
      seen.add(key);
      if (a.name.namespaceUri === XMLNS_NAMESPACE) continue;
      if (
        a.name.prefix !== null &&
        bindings.get(a.name.prefix) !== a.name.namespaceUri
      )
        fail(
          'E_SVELTE_IR_INVALID',
          'Attribute QName and namespace binding disagree'
        );
      if (a.name.prefix === null && a.name.namespaceUri !== null)
        fail(
          'E_SVELTE_IR_INVALID',
          'Unprefixed attributes cannot have a namespace'
        );
      if (a.name.namespaceUri === XML_NAMESPACE) {
        if (
          a.name.qualifiedName !== 'xml:space' ||
          !['default', 'preserve'].includes(a.value)
        )
          fail('E_SVELTE_IR_UNSUPPORTED', 'Only valid xml:space is supported');
      } else if (a.name.namespaceUri === XLINK_NAMESPACE) {
        if (a.name.localName !== 'href')
          fail('E_SVELTE_IR_UNSUPPORTED', 'Only xlink:href is supported');
        hasXlink = true;
      } else if (a.name.namespaceUri !== null)
        fail(
          'E_SVELTE_IR_UNSUPPORTED',
          'Namespaced attributes are unsupported'
        );
      if (
        /^(?:on[a-z]|bind:|class:|use:|transition:|in:|out:|animate:|let:)/iu.test(
          a.name.qualifiedName
        )
      )
        fail(
          'E_SVELTE_IR_UNSUPPORTED',
          'Directive-like attributes are unsupported'
        );
      if (/url\s*\(/iu.test(a.value))
        fail('E_SVELTE_IR_UNSUPPORTED', 'CSS URL references are unsupported');
      if (
        a.name.namespaceUri === null &&
        a.name.localName === 'id' &&
        a.value
      ) {
        if (ids.has(a.value))
          fail('E_SVELTE_IR_REFERENCE', 'Duplicate SVG IDs are unsupported');
        ids.add(a.value);
      }
      if (
        (a.name.namespaceUri === null ||
          a.name.namespaceUri === XLINK_NAMESPACE) &&
        a.name.localName === 'href'
      ) {
        if (!a.value.startsWith('#') || a.value.length < 2)
          fail(
            'E_SVELTE_IR_REFERENCE',
            'Only non-empty local fragment references are supported'
          );
        refs.push(a.value.slice(1));
      }
      if (a.name.namespaceUri === null && IDREFS.has(a.name.localName))
        refs.push(...a.value.trim().split(/\s+/u).filter(Boolean));
    }
    for (const child of element.children) {
      if (child.kind === 'element') visit(child, bindings);
      else if (child.kind === 'generated')
        fail('E_SVELTE_IR_UNSUPPORTED', 'Generated IR nodes are unsupported');
      else if (child.kind === 'comment') {
        if (child.value.includes('--') || child.value.endsWith('-'))
          fail('E_SVELTE_IR_INVALID', 'Comment content is invalid');
      } else xmlCharacters(child.value, 'Text');
    }
  };
  visit(
    document.root,
    new Map([
      ['', SVG_NAMESPACE],
      ['xml', XML_NAMESPACE],
    ])
  );
  for (const ref of refs)
    if (!ids.has(ref))
      fail('E_SVELTE_IR_REFERENCE', 'Unresolved local reference');
  return hasXlink;
}

interface Render {
  chunks: string[];
  bytes: number;
  maxBytes: number;
}
function append(state: Render, value: string): void {
  state.bytes += Buffer.byteLength(value, 'utf8');
  if (state.bytes > state.maxBytes)
    fail('E_SVELTE_IR_LIMIT', 'Generated component exceeds output byte limit');
  state.chunks.push(value);
}
function renderNode(
  node: IRNode,
  state: Render,
  isRoot: boolean,
  hasXlink: boolean
): void {
  if (node.kind === 'text' || node.kind === 'cdata') {
    append(state, escapeMarkup(node.value));
    return;
  }
  if (node.kind === 'comment') {
    append(state, `<!--${node.value}-->`);
    return;
  }
  if (node.kind !== 'element')
    fail('E_SVELTE_IR_UNSUPPORTED', 'Generated nodes are unsupported');
  append(state, `<${node.name.localName}`);
  if (isRoot) {
    append(state, ` xmlns="${SVG_NAMESPACE}"`);
    if (hasXlink) append(state, ` xmlns:xlink="${XLINK_NAMESPACE}"`);
    append(
      state,
      ' class={className} style={style} width={width} height={height} fill={fill} stroke={stroke} viewBox="'
    );
    append(state, escapeMarkup(attr(node, 'viewBox') || '0 0 24 24', true));
    append(state, '" {...$$restProps}');
  }
  for (const a of node.attributes) {
    if (a.name.namespaceUri === XMLNS_NAMESPACE) continue;
    if (
      isRoot &&
      a.name.namespaceUri === null &&
      [
        'class',
        'style',
        'width',
        'height',
        'fill',
        'stroke',
        'viewBox',
      ].includes(a.name.localName)
    )
      continue;
    const qname =
      a.name.namespaceUri === XLINK_NAMESPACE
        ? `xlink:${a.name.localName}`
        : a.name.namespaceUri === XML_NAMESPACE
          ? `xml:${a.name.localName}`
          : a.name.localName;
    append(state, ` ${qname}="${escapeMarkup(a.value, true)}"`);
  }
  append(state, '>');
  for (const child of node.children) renderNode(child, state, false, hasXlink);
  append(state, `</${node.name.localName}>`);
}

export function emitSvelteIRComponent(
  input: unknown,
  componentName: string,
  typescript: boolean
): string {
  let document: IRDocument;
  try {
    document = validateAndFreezeIR(input);
  } catch (error) {
    fail(
      'E_SVELTE_IR_INVALID',
      `IR validation failed: ${error instanceof IRValidationError ? error.message : 'invalid IR'}`
    );
  }
  if (document.source.utf8ByteLength > 10 * 1024 * 1024)
    fail('E_SVELTE_IR_LIMIT', 'IR source exceeds input byte limit');
  if (document.prolog.length || document.epilog.length)
    fail(
      'E_SVELTE_IR_UNSUPPORTED',
      'Document-level comments are outside the Svelte component subset'
    );
  if (!/^[A-Za-z_$][\w$]*$/u.test(componentName))
    fail('E_SVELTE_IR_INVALID', 'Component name is invalid');
  const hasXlink = validate(document);
  const state: Render = { chunks: [], bytes: 0, maxBytes: LIMIT_BYTES };
  const width = attr(document.root, 'width');
  const height = attr(document.root, 'height');
  const fill = attr(document.root, 'fill');
  const scriptAttr = typescript ? ' lang="ts"' : '';
  const stringType = typescript ? ': string' : '';
  const dimensionType = typescript ? ': string | number' : '';
  append(
    state,
    `<script${scriptAttr}>\n  export let className${stringType} = '';\n  export let style${stringType} = '';\n  export let width${dimensionType} = ${dimension(width)};\n  export let height${dimensionType} = ${dimension(height)};\n  export let fill${stringType} = ${JSON.stringify(fill || 'currentColor')};\n  export let stroke${stringType} = '';\n</script>\n`
  );
  renderNode(document.root, state, true, hasXlink);
  return state.chunks.join('');
}
