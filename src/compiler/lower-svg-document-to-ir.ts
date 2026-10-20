import type {
  AdmittedSVGDocument as SVGXMLDocument,
  AdmittedSVGElement as SVGXMLElement,
  AdmittedSVGTextNode as SVGXMLTextNode,
  AdmittedSVGSourceSpan as SVGXMLSourceSpan,
} from '../security/input-safety.js';
import {
  IR_VERSION,
  SVG_NAMESPACE,
  XML_NAMESPACE,
  XMLNS_NAMESPACE,
  XLINK_NAMESPACE,
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

const KNOWN_ELEMENTS = new Set([
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
const KNOWN_ATTRIBUTES = new Set([
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

function spanFor(
  source: string,
  span: SVGXMLSourceSpan | undefined
): SourceSpan | undefined {
  if (!span) return undefined;
  if (
    span.unit !== 'utf16-code-unit' ||
    !Number.isSafeInteger(span.start) ||
    !Number.isSafeInteger(span.end) ||
    span.start < 0 ||
    span.end < span.start ||
    span.end > source.length
  )
    throw new Error('XML source span is invalid');
  return {
    startUtf16: span.start,
    endUtf16Exclusive: span.end,
    unit: 'utf16-code-unit',
    sourceSlice: source.slice(span.start, span.end),
  };
}
function provenance(
  source: string,
  span: SVGXMLSourceSpan | undefined
): Provenance {
  const checked = spanFor(source, span);
  return checked ? { kind: 'source', span: checked } : { kind: 'unknown' };
}
function name(value: SVGXMLElement['name']): ExpandedName {
  return {
    namespaceUri: value.namespaceUri,
    localName: value.localName,
    qualifiedName: value.qualifiedName,
    prefix: value.prefix,
  };
}
function resolvedSpace(
  value: 'default' | 'preserve',
  evidence: 'authored' | 'inferred'
): ValueState<'default' | 'preserve'> {
  return { state: 'resolved', value, interpreter: 'xml-space-v1', evidence };
}
function mapText(source: string, node: SVGXMLTextNode): IRNode {
  return {
    kind: node.kind,
    value: node.value,
    provenance: provenance(source, node.sourceSpan),
  };
}

function analyze(root: ElementNode): Analysis {
  const definitions: Array<{ id: string; nodePath: string }> = [];
  const occurrences: Analysis['references']['occurrences'][number][] = [];
  const idCounts = new Map<string, number>();
  const hrefs: string[] = [];
  const walk = (element: ElementNode, path: string): void => {
    for (const attr of element.attributes) {
      if (
        attr.name.namespaceUri === null &&
        attr.name.localName === 'id' &&
        attr.value
      ) {
        definitions.push({ id: attr.value, nodePath: path });
        idCounts.set(attr.value, (idCounts.get(attr.value) ?? 0) + 1);
      }
      if (
        (attr.name.namespaceUri === null ||
          attr.name.namespaceUri === XLINK_NAMESPACE) &&
        attr.name.localName === 'href' &&
        attr.value.startsWith('#')
      )
        hrefs.push(attr.value.slice(1));
    }
    for (const [index, child] of element.children.entries())
      if (child.kind === 'element')
        walk(child, `${path}/${child.name.localName}[${index + 1}]`);
  };
  walk(root, '/svg[1]');
  for (const target of hrefs)
    occurrences.push(
      idCounts.has(target)
        ? { state: 'resolved', target }
        : { state: 'unresolved', target }
    );
  const stringAttr = (key: string) =>
    root.attributes.find(
      attr => attr.name.namespaceUri === null && attr.name.localName === key
    )?.value;
  const dimension = (
    lexical: string | undefined
  ): ValueState<{ lexical: string; unit: string | null }> =>
    lexical === undefined
      ? {
          state: 'unresolved',
          reason: 'attribute not authored',
          evidence: 'not-established',
        }
      : {
          state: 'resolved',
          value: { lexical, unit: /[a-z%]+$/iu.exec(lexical)?.[0] ?? null },
          interpreter: 'svg-root-dimension-v1',
          evidence: 'authored',
        };
  const viewBox = stringAttr('viewBox');
  const nums = viewBox
    ?.trim()
    .split(/[\s,]+/u)
    .map(Number);
  const parsedViewBox =
    nums?.length === 4 && nums.every(Number.isFinite)
      ? (nums as [number, number, number, number])
      : undefined;
  const text = (element: ElementNode): string =>
    element.children
      .map(child =>
        child.kind === 'text' || child.kind === 'cdata'
          ? child.value
          : child.kind === 'element'
            ? text(child)
            : ''
      )
      .join('');
  const collectNamedText = (localName: string): string[] => {
    const values: string[] = [];
    const visit = (element: ElementNode): void => {
      if (element.name.localName === localName) values.push(text(element));
      for (const child of element.children)
        if (child.kind === 'element') visit(child);
    };
    visit(root);
    return values;
  };
  return {
    rootGeometry: {
      width: dimension(stringAttr('width')),
      height: dimension(stringAttr('height')),
      viewBox: parsedViewBox
        ? {
            state: 'resolved',
            value: parsedViewBox,
            interpreter: 'svg-viewbox-v1',
            evidence: 'authored',
          }
        : viewBox === undefined
          ? {
              state: 'unresolved',
              reason: 'attribute not authored',
              evidence: 'not-established',
            }
          : {
              state: 'invalid',
              code: 'E_INVALID_VIEWBOX',
              original: viewBox,
              evidence: 'authored',
            },
    },
    ids: { coverage: 'complete', definitions },
    references: { coverage: 'partial', occurrences },
    css: { coverage: 'opaque', declarations: [] },
    accessibility: {
      titles: collectNamedText('title'),
      descriptions: collectNamedText('desc'),
      coverage: 'preserved',
    },
  };
}

/** Lower a scanner-collected, already-admitted XML document into validated IR v1. */
export function lowerAdmittedSVGToIR(
  source: string,
  document: SVGXMLDocument,
  sourceId: string
): IRDocument {
  if (typeof sourceId !== 'string' || !sourceId)
    throw new Error('sourceId must be a non-empty string');
  const byteLength = Buffer.byteLength(source, 'utf8');
  let aggregateTextBytes = 0;
  let elementCount = 0;
  let totalAttributes = 0;
  const lowerElement = (
    element: SVGXMLElement,
    inheritedSpace: 'default' | 'preserve',
    depth: number
  ): ElementNode => {
    if (depth > 256) throw new Error('XML lowering exceeds maximum depth');
    if (++elementCount > 100_000)
      throw new Error('XML lowering exceeds element limit');
    totalAttributes += element.attributes.length;
    if (element.attributes.length > 256 || totalAttributes > 250_000)
      throw new Error('XML lowering exceeds attribute limit');
    const xmlSpaceAttr = element.attributes.find(
      attr =>
        attr.name.namespaceUri === XML_NAMESPACE &&
        attr.name.localName === 'space'
    );
    const space: ValueState<'default' | 'preserve'> = xmlSpaceAttr
      ? xmlSpaceAttr.value === 'default' || xmlSpaceAttr.value === 'preserve'
        ? resolvedSpace(xmlSpaceAttr.value, 'authored')
        : {
            state: 'invalid',
            code: 'E_INVALID_XML_SPACE',
            original: xmlSpaceAttr.value,
            evidence: 'authored',
          }
      : resolvedSpace(inheritedSpace, 'inferred');
    const children: IRNode[] = element.children.map(child => {
      if (child.kind === 'element')
        return lowerElement(
          child,
          space.state === 'resolved' ? space.value : inheritedSpace,
          depth + 1
        );
      aggregateTextBytes += Buffer.byteLength(child.value, 'utf8');
      if (aggregateTextBytes > 10 * 1024 * 1024)
        throw new Error('XML lowering exceeds decoded text limit');
      return mapText(source, child);
    });
    return {
      kind: 'element',
      name: name(element.name),
      interpretation:
        element.name.namespaceUri !== SVG_NAMESPACE
          ? 'foreign-opaque'
          : KNOWN_ELEMENTS.has(element.name.localName)
            ? 'known-svg'
            : 'unknown-svg',
      provenance: provenance(source, element.startTagSpan),
      attributes: element.attributes.map(attr => ({
        name: {
          namespaceUri: attr.name.namespaceUri,
          localName: attr.name.localName,
          qualifiedName: attr.name.qualifiedName,
          prefix: attr.name.prefix,
        },
        value: attr.value,
        provenance: provenance(source, attr.sourceSpan),
        interpretation:
          attr.name.namespaceUri === XML_NAMESPACE ||
          attr.name.namespaceUri === XMLNS_NAMESPACE ||
          attr.name.namespaceUri === XLINK_NAMESPACE ||
          (attr.name.namespaceUri === null &&
            (KNOWN_ATTRIBUTES.has(attr.name.localName) ||
              attr.name.localName.startsWith('aria-') ||
              attr.name.localName.startsWith('data-')))
            ? 'known-property'
            : 'opaque-property',
      })),
      children,
      xmlSpace: space,
    };
  };
  if (
    document.kind !== 'document' ||
    document.root.name.localName !== 'svg' ||
    document.root.name.namespaceUri !== SVG_NAMESPACE
  )
    throw new Error('Document root is not an SVG-namespace svg element');
  const root = lowerElement(document.root, 'default', 0);
  const prolog = document.prolog.map(node => mapText(source, node));
  const epilog = document.epilog.map(node => mapText(source, node));
  return validateAndFreezeIR({
    version: IR_VERSION,
    source: {
      id: sourceId,
      text: source,
      utf8ByteLength: byteLength,
      admissionPolicy: 'svg-input-safety-v1',
    },
    prolog,
    epilog,
    root,
    analysis: analyze(root),
  });
}
