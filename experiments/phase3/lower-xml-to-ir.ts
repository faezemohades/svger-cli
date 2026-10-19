/**
 * Parser-contract-based structural lowering experiment. No parser implementation
 * is imported; callers must provide an already-admitted source/document pair.
 */
import type {
  ExpandedXmlName,
  SourceDocument,
  XmlAttribute,
  XmlChild,
  XmlComment,
  XmlDocument,
} from '../phase2/parser-contract-v1.js';
import { PARSER_RESOURCE_CEILINGS } from '../phase2/parser-contract-v1.js';
import {
  IR_VERSION,
  SVG_NAMESPACE,
  XML_NAMESPACE,
  validateAndFreezeIR,
  type Analysis,
  type ElementNode,
  type ExpandedName,
  type IRDocument,
  type IRNode,
  type Provenance,
  type SourceSpan,
  type ValueState,
} from './ir-v1.js';

const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';
const SVG_KNOWN_ELEMENTS = new Set([
  'a',
  'animate',
  'animateMotion',
  'animateTransform',
  'circle',
  'clipPath',
  'defs',
  'desc',
  'ellipse',
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
  'filter',
  'g',
  'image',
  'line',
  'linearGradient',
  'mask',
  'metadata',
  'path',
  'pattern',
  'polygon',
  'polyline',
  'radialGradient',
  'rect',
  'stop',
  'style',
  'svg',
  'switch',
  'symbol',
  'text',
  'textPath',
  'title',
  'tspan',
  'use',
]);
const SVG_KNOWN_ATTRIBUTES = new Set([
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'class',
  'clip-path',
  'cx',
  'cy',
  'd',
  'fill',
  'fill-rule',
  'height',
  'href',
  'id',
  'opacity',
  'preserveAspectRatio',
  'r',
  'role',
  'rx',
  'ry',
  'stroke',
  'stroke-width',
  'style',
  'transform',
  'viewBox',
  'width',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
]);

export interface XmlToIrOptions {
  readonly sourceId: string;
  readonly ownership?: 'copy' | 'share-verified-immutable';
}

export interface LoweredXmlStructure {
  readonly source: IRDocument['source'];
  readonly prolog: IRDocument['prolog'];
  readonly epilog: IRDocument['epilog'];
  readonly root: ElementNode;
}

export class XmlLoweringError extends Error {
  readonly code = 'E_EXPERIMENTAL_XML_LOWERING';
  constructor(message: string) {
    super(message);
    this.name = 'XmlLoweringError';
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      typeof key === 'string' &&
      descriptor !== undefined &&
      'value' in descriptor
    );
  });
}

function assertDense(value: readonly unknown[], label: string): void {
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) {
      throw new XmlLoweringError(`${label} must not contain sparse entries`);
    }
  }
}

function deeplyFrozen(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !('value' in descriptor) ||
      !deeplyFrozen(descriptor.value, seen)
    )
      return false;
  }
  return true;
}

function assertSpan(
  source: string,
  value: unknown,
  label: string
): SourceSpan | undefined {
  if (value === undefined) return undefined;
  if (
    !isPlainRecord(value) ||
    value.unit !== 'utf16-code-unit' ||
    !Number.isSafeInteger(value.start) ||
    !Number.isSafeInteger(value.end)
  ) {
    throw new XmlLoweringError(
      `${label} is not a qualified UTF-16 source span`
    );
  }
  const start = value.start as number;
  const end = value.end as number;
  if (start < 0 || end < start || end > source.length) {
    throw new XmlLoweringError(`${label} is outside the retained source`);
  }
  const sourceSlice = source.slice(start, end);
  return {
    startUtf16: start,
    endUtf16Exclusive: end,
    unit: 'utf16-code-unit',
    sourceSlice,
  };
}

function validateExpandedName(
  value: unknown,
  label: string
): asserts value is ExpandedXmlName {
  if (
    !isPlainRecord(value) ||
    typeof value.qualifiedName !== 'string' ||
    typeof value.localName !== 'string' ||
    value.localName.length === 0 ||
    !(
      value.prefix === null ||
      (typeof value.prefix === 'string' && value.prefix.length > 0)
    ) ||
    !(value.namespaceUri === null || typeof value.namespaceUri === 'string')
  ) {
    throw new XmlLoweringError(`${label} is not an expanded XML name`);
  }
  const expected =
    value.prefix === null
      ? value.localName
      : `${value.prefix}:${value.localName}`;
  if (value.qualifiedName !== expected)
    throw new XmlLoweringError(
      `${label} QName does not match prefix/local name`
    );
}

function assertNamespaceBinding(
  name: ExpandedXmlName,
  bindings: ReadonlyMap<string, string | null>,
  label: string,
  attribute = false
): void {
  if (
    attribute &&
    (name.qualifiedName === 'xmlns' || name.prefix === 'xmlns')
  ) {
    if (name.namespaceUri !== XMLNS_NAMESPACE) {
      throw new XmlLoweringError(
        `${label} has an invalid namespace-declaration URI`
      );
    }
    return;
  }
  if (attribute && name.prefix === null) {
    if (name.namespaceUri !== null) {
      throw new XmlLoweringError(
        `${label} unprefixed attribute must have no namespace`
      );
    }
    return;
  }
  const expected =
    name.prefix === null
      ? (bindings.get('') ?? null)
      : bindings.get(name.prefix);
  if (expected === undefined || expected !== name.namespaceUri) {
    throw new XmlLoweringError(
      `${label} namespace URI does not match its in-scope QName binding`
    );
  }
}

function nameForIR(name: ExpandedXmlName, share: boolean): ExpandedName {
  return share
    ? name
    : {
        namespaceUri: name.namespaceUri,
        localName: name.localName,
        qualifiedName: name.qualifiedName,
        prefix: name.prefix,
      };
}

function isXmlComment(value: unknown): value is XmlComment {
  return (
    isPlainRecord(value) &&
    value.kind === 'comment' &&
    typeof value.value === 'string'
  );
}

function provenanceFor(source: string, spanValue: unknown): Provenance {
  const verified = assertSpan(source, spanValue, 'source provenance');
  return verified ? { kind: 'source', span: verified } : { kind: 'unknown' };
}

function tagMatches(
  span: SourceSpan | undefined,
  name: ExpandedXmlName,
  endTag: boolean
): boolean {
  if (!span) return true;
  const raw = span.sourceSlice;
  if (endTag) return raw === `</${name.qualifiedName}>`;
  const prefix = `<${name.qualifiedName}`;
  if (!raw.startsWith(prefix) || !raw.endsWith('>')) return false;
  const boundary = raw[prefix.length];
  return boundary === '>' || boundary === '/' || /\s/u.test(boundary ?? '');
}

function validateComment(
  source: string,
  comment: XmlComment,
  label: string
): void {
  const span = assertSpan(source, comment.sourceSpan, `${label}.sourceSpan`);
  if (
    span &&
    (!span.sourceSlice.startsWith('<!--') || !span.sourceSlice.endsWith('-->'))
  ) {
    throw new XmlLoweringError(
      `${label} source span is not a complete XML comment`
    );
  }
}

/**
 * Lower a Phase 02 contract document. The function does not perform security
 * admission or parse XML; the isolated caller must establish both preconditions.
 */
export function lowerXmlStructure(
  source: SourceDocument,
  document: XmlDocument,
  options: XmlToIrOptions
): LoweredXmlStructure {
  if (
    !options ||
    typeof options.sourceId !== 'string' ||
    options.sourceId.length === 0
  ) {
    throw new XmlLoweringError('sourceId must be a non-empty string');
  }
  const ownership = options.ownership ?? 'copy';
  if (ownership !== 'copy' && ownership !== 'share-verified-immutable') {
    throw new XmlLoweringError('unsupported ownership experiment mode');
  }
  const share = ownership === 'share-verified-immutable';
  if (share && (!deeplyFrozen(source) || !deeplyFrozen(document))) {
    throw new XmlLoweringError(
      'sharing requires deeply frozen source and XML document input'
    );
  }
  if (
    !isPlainRecord(source) ||
    source.encoding !== 'utf-8' ||
    source.offsetUnit !== 'utf16-code-unit' ||
    typeof source.text !== 'string' ||
    source.utf8ByteLength !== new TextEncoder().encode(source.text).length
  ) {
    throw new XmlLoweringError('source document metadata is inconsistent');
  }
  if (source.utf8ByteLength > PARSER_RESOURCE_CEILINGS.maxInputBytes) {
    throw new XmlLoweringError('source exceeds the Phase 02 input ceiling');
  }
  if (
    !isPlainRecord(document) ||
    document.kind !== 'document' ||
    !Array.isArray(document.prolog) ||
    !Array.isArray(document.epilog) ||
    !Array.isArray(document.root?.attributes) ||
    !Array.isArray(document.root?.children)
  ) {
    throw new XmlLoweringError(
      'input does not satisfy the Phase 02 XML document contract'
    );
  }
  assertDense(document.prolog, 'document prolog');
  assertDense(document.epilog, 'document epilog');
  assertDense(document.root.attributes, 'root attributes');
  assertDense(document.root.children, 'root children');

  const text = source.text;
  let elements = 0;
  let totalAttributes = 0;
  let textBytes = 0;

  const lowerComment = (node: XmlComment, label: string) => {
    validateComment(text, node, label);
    return {
      kind: 'comment' as const,
      value: node.value,
      provenance: provenanceFor(text, node.sourceSpan),
    };
  };
  const lowerAttribute = (attribute: XmlAttribute, label: string) => {
    if (
      !isPlainRecord(attribute) ||
      attribute.kind !== 'attribute' ||
      typeof attribute.value !== 'string'
    ) {
      throw new XmlLoweringError(`${label} is not an XML attribute`);
    }
    validateExpandedName(attribute.name, `${label}.name`);
    const sourceSpan = assertSpan(
      text,
      attribute.sourceSpan,
      `${label}.sourceSpan`
    );
    if (
      sourceSpan &&
      !new RegExp(
        `^${attribute.name.qualifiedName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*=`,
        'u'
      ).test(sourceSpan.sourceSlice)
    ) {
      throw new XmlLoweringError(
        `${label} span does not begin with its QName and equals sign`
      );
    }
    const known =
      attribute.name.namespaceUri === XML_NAMESPACE ||
      attribute.name.namespaceUri === XMLNS_NAMESPACE ||
      attribute.name.namespaceUri === XLINK_NAMESPACE ||
      (attribute.name.namespaceUri === null &&
        (SVG_KNOWN_ATTRIBUTES.has(attribute.name.localName) ||
          attribute.name.localName.startsWith('aria-') ||
          attribute.name.localName.startsWith('data-')));
    return {
      name: nameForIR(attribute.name, share),
      value: attribute.value,
      provenance: provenanceFor(text, attribute.sourceSpan),
      interpretation: known
        ? ('known-property' as const)
        : ('opaque-property' as const),
    };
  };

  const lowerNode = (
    node: XmlChild,
    parentSpace: ValueState<'default' | 'preserve'>,
    parentBindings: ReadonlyMap<string, string | null>,
    nodePath: string,
    depth: number
  ): IRNode => {
    if (depth > 256)
      throw new XmlLoweringError('XML document exceeds lowering depth ceiling');
    if (!isPlainRecord(node))
      throw new XmlLoweringError(`node ${nodePath} is malformed`);
    if (node.kind === 'comment') return lowerComment(node, nodePath);
    if (node.kind === 'text' || node.kind === 'cdata') {
      if (typeof node.value !== 'string')
        throw new XmlLoweringError(`text node ${nodePath} has no value`);
      const rawSpan = assertSpan(
        text,
        node.sourceSpan,
        `${nodePath}.sourceSpan`
      );
      if (
        node.kind === 'cdata' &&
        rawSpan &&
        (!rawSpan.sourceSlice.startsWith('<![CDATA[') ||
          !rawSpan.sourceSlice.endsWith(']]>'))
      ) {
        throw new XmlLoweringError(
          `${nodePath} CDATA span must include delimiters`
        );
      }
      if (node.kind === 'cdata' && node.contentSpan) {
        const contentSpan = assertSpan(
          text,
          node.contentSpan,
          `${nodePath}.contentSpan`
        );
        if (contentSpan?.sourceSlice !== node.value)
          throw new XmlLoweringError(
            `${nodePath} CDATA content span differs from node value`
          );
      }
      textBytes += new TextEncoder().encode(node.value).length;
      if (textBytes > 10 * 1024 * 1024)
        throw new XmlLoweringError('XML text volume exceeds lowering ceiling');
      return {
        kind: node.kind,
        value: node.value,
        provenance: provenanceFor(text, node.sourceSpan),
      };
    }
    if (node.kind !== 'element')
      throw new XmlLoweringError(`node ${nodePath} has unsupported kind`);
    elements++;
    if (elements > 100_000)
      throw new XmlLoweringError('XML element count exceeds lowering ceiling');
    validateExpandedName(node.name, `${nodePath}.name`);
    if (!Array.isArray(node.attributes) || !Array.isArray(node.children))
      throw new XmlLoweringError(`element ${nodePath} arrays are invalid`);
    assertDense(node.attributes, `${nodePath}.attributes`);
    assertDense(node.children, `${nodePath}.children`);
    if (node.attributes.length > 256)
      throw new XmlLoweringError(
        `element ${nodePath} exceeds attribute ceiling`
      );
    totalAttributes += node.attributes.length;
    if (totalAttributes > PARSER_RESOURCE_CEILINGS.maxTotalAttributes)
      throw new XmlLoweringError(
        'XML total attribute count exceeds lowering ceiling'
      );

    const bindings = new Map(parentBindings);
    for (const attribute of node.attributes) {
      validateExpandedName(attribute.name, `${nodePath}.attribute QName`);
      if (attribute.name.qualifiedName === 'xmlns') {
        bindings.set('', attribute.value === '' ? null : attribute.value);
      } else if (attribute.name.prefix === 'xmlns') {
        bindings.set(
          attribute.name.localName,
          attribute.value === '' ? null : attribute.value
        );
      }
    }
    assertNamespaceBinding(node.name, bindings, `${nodePath}.name`);

    const startTag = assertSpan(
      text,
      node.startTagSpan,
      `${nodePath}.startTagSpan`
    );
    const endTag = assertSpan(text, node.endTagSpan, `${nodePath}.endTagSpan`);
    if (
      !tagMatches(startTag, node.name, false) ||
      !tagMatches(endTag, node.name, true)
    ) {
      throw new XmlLoweringError(
        `element ${nodePath} span does not match its qualified name`
      );
    }
    const attrs = node.attributes.map((attribute, index) =>
      lowerAttribute(attribute, `${nodePath}.attributes[${index}]`)
    );
    node.attributes.forEach((attribute, index) =>
      assertNamespaceBinding(
        attribute.name,
        bindings,
        `${nodePath}.attributes[${index}]`,
        true
      )
    );
    const duplicateNames = new Set<string>();
    for (const attribute of attrs) {
      const key = `${attribute.name.namespaceUri ?? ''}\u0000${attribute.name.localName}`;
      if (duplicateNames.has(key))
        throw new XmlLoweringError(
          `element ${nodePath} has duplicate expanded attribute names`
        );
      duplicateNames.add(key);
    }
    const xmlSpaceAttribute = node.attributes.find(
      attribute =>
        attribute.name.namespaceUri === XML_NAMESPACE &&
        attribute.name.localName === 'space'
    );
    let xmlSpace: ValueState<'default' | 'preserve'>;
    if (xmlSpaceAttribute) {
      if (
        xmlSpaceAttribute.value === 'default' ||
        xmlSpaceAttribute.value === 'preserve'
      ) {
        xmlSpace = {
          state: 'resolved',
          value: xmlSpaceAttribute.value,
          interpreter: 'xml-space-v1',
          evidence: 'authored',
        };
      } else {
        xmlSpace = {
          state: 'invalid',
          code: 'E_INVALID_XML_SPACE',
          original: xmlSpaceAttribute.value,
          evidence: 'authored',
        };
      }
    } else if (parentSpace.state === 'resolved') {
      xmlSpace = {
        state: 'resolved',
        value: parentSpace.value,
        interpreter: 'xml-space-v1',
        evidence: 'inferred',
      };
    } else {
      xmlSpace = {
        state: 'unresolved',
        reason: 'effective xml:space depends on an unresolved ancestor',
        evidence: 'not-established',
      };
    }

    const localCounts = new Map<string, number>();
    const children = node.children.map(child => {
      const childName =
        child.kind === 'element' ? child.name.localName : child.kind;
      const count = (localCounts.get(childName) ?? 0) + 1;
      localCounts.set(childName, count);
      const childPath = `${nodePath}/${childName}[${count}]`;
      return lowerNode(child, xmlSpace, bindings, childPath, depth + 1);
    });
    const element: ElementNode = {
      kind: 'element',
      name: nameForIR(node.name, share),
      interpretation:
        node.name.namespaceUri !== SVG_NAMESPACE
          ? 'foreign-opaque'
          : SVG_KNOWN_ELEMENTS.has(node.name.localName)
            ? 'known-svg'
            : 'unknown-svg',
      provenance: provenanceFor(text, node.startTagSpan),
      attributes: attrs,
      children,
      xmlSpace,
    };
    return element;
  };

  const documentRootName = document.root.name;
  validateExpandedName(documentRootName, 'document.root.name');
  if (
    documentRootName.namespaceUri !== SVG_NAMESPACE ||
    documentRootName.localName !== 'svg'
  ) {
    throw new XmlLoweringError(
      'XML document root is not the SVG namespace svg element'
    );
  }
  const rootSpace: ValueState<'default' | 'preserve'> = {
    state: 'resolved',
    value: 'default',
    interpreter: 'xml-space-v1',
    evidence: 'inferred',
  };
  const initialBindings = new Map<string, string | null>([
    ['xml', XML_NAMESPACE],
  ]);
  const root = lowerNode(
    document.root,
    rootSpace,
    initialBindings,
    '/svg[1]',
    0
  ) as ElementNode;
  const prolog = document.prolog.map((node, index) => {
    if (!isXmlComment(node))
      throw new XmlLoweringError(`prolog[${index}] is not a comment`);
    return lowerComment(node, `prolog[${index}]`);
  });
  const epilog = document.epilog.map((node, index) => {
    if (!isXmlComment(node))
      throw new XmlLoweringError(`epilog[${index}] is not a comment`);
    return lowerComment(node, `epilog[${index}]`);
  });
  return {
    source: {
      id: options.sourceId,
      text: source.text,
      utf8ByteLength: source.utf8ByteLength,
      admissionPolicy: 'svg-input-safety-v1',
    },
    prolog,
    epilog,
    root,
  };
}

/** Build explicitly partial semantic sidecars from the lowered structure. */
export function buildSemanticSidecars(root: ElementNode): Analysis {
  const ids: Array<{ id: string; nodePath: string }> = [];
  const hrefs: Array<{ value: string; target: string }> = [];
  const titles: string[] = [];
  const descriptions: string[] = [];
  const readText = (element: ElementNode): string =>
    element.children
      .map(child =>
        child.kind === 'element'
          ? readText(child)
          : child.kind === 'comment' || child.kind === 'generated'
            ? ''
            : child.value
      )
      .join('');
  const visit = (element: ElementNode, nodePath: string): void => {
    for (const attribute of element.attributes) {
      if (
        attribute.name.namespaceUri === null &&
        attribute.name.localName === 'id' &&
        attribute.value !== ''
      ) {
        ids.push({ id: attribute.value, nodePath });
      }
      if (
        attribute.name.localName === 'href' &&
        (attribute.name.namespaceUri === null ||
          attribute.name.namespaceUri === XLINK_NAMESPACE)
      ) {
        hrefs.push({
          value: attribute.value,
          target: attribute.value.startsWith('#')
            ? attribute.value.slice(1)
            : attribute.value,
        });
      }
    }
    if (
      element.name.namespaceUri === SVG_NAMESPACE &&
      element.name.localName === 'title'
    )
      titles.push(readText(element));
    if (
      element.name.namespaceUri === SVG_NAMESPACE &&
      element.name.localName === 'desc'
    )
      descriptions.push(readText(element));
    const localCounts = new Map<string, number>();
    for (const child of element.children) {
      if (child.kind !== 'element') continue;
      const count = (localCounts.get(child.name.localName) ?? 0) + 1;
      localCounts.set(child.name.localName, count);
      visit(child, `${nodePath}/${child.name.localName}[${count}]`);
    }
  };
  visit(root, '/svg[1]');
  const idIndex = new Map<string, string[]>();
  for (const definition of ids)
    idIndex.set(definition.id, [
      ...(idIndex.get(definition.id) ?? []),
      definition.nodePath,
    ]);
  const referenceOutcomes = hrefs.map(({ value, target }) => {
    if (!value.startsWith('#') || target.length === 0)
      return { state: 'blocked-external' as const, target: value };
    const candidates = idIndex.get(target) ?? [];
    if (candidates.length === 0)
      return { state: 'unresolved' as const, target };
    if (candidates.length > 1)
      return { state: 'ambiguous' as const, target, candidates };
    return { state: 'resolved' as const, target };
  });
  const geometry = (localName: 'width' | 'height' | 'viewBox') => {
    const attribute = root.attributes.find(
      candidate =>
        candidate.name.namespaceUri === null &&
        candidate.name.localName === localName
    );
    return attribute
      ? {
          state: 'opaque' as const,
          reason:
            'geometry grammar is not interpreted by this lowering prototype',
          original: attribute.value,
          evidence: 'authored' as const,
        }
      : {
          state: 'unresolved' as const,
          reason: `root ${localName} is absent; no rendering default is inferred`,
          evidence: 'not-established' as const,
        };
  };
  return {
    rootGeometry: {
      width: geometry('width'),
      height: geometry('height'),
      viewBox: geometry('viewBox'),
    },
    ids: { coverage: 'partial', definitions: ids },
    references: { coverage: 'partial', occurrences: referenceOutcomes },
    css: { coverage: 'lexically-retained', declarations: [] },
    accessibility: { titles, descriptions, coverage: 'partial' },
  };
}

export function lowerXmlDocumentToIR(
  source: SourceDocument,
  document: XmlDocument,
  options: XmlToIrOptions
): IRDocument {
  const ownership =
    options.ownership === 'share-verified-immutable' ? 'freeze-owned' : 'copy';
  const structure = lowerXmlStructure(source, document, options);
  const result: IRDocument = {
    version: IR_VERSION,
    ...structure,
    analysis: buildSemanticSidecars(structure.root),
  };
  return validateAndFreezeIR(result, { ownership });
}
