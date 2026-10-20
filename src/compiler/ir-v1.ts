/** Runtime-validated internal Compiler IR v1. This module is not package-exported. */
export const IR_VERSION = 'svger-ir-v1' as const;
export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
export const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
export const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
export const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

export interface SourceSpan {
  readonly startUtf16: number;
  readonly endUtf16Exclusive: number;
  readonly unit: 'utf16-code-unit';
  readonly sourceSlice: string;
}
export type Provenance =
  | { readonly kind: 'source'; readonly span: SourceSpan }
  | {
      readonly kind: 'generated';
      readonly passId: string;
      readonly anchor?: SourceSpan;
    }
  | { readonly kind: 'unknown' };
export interface ExpandedName {
  readonly namespaceUri: string | null;
  readonly localName: string;
  readonly qualifiedName: string;
  readonly prefix: string | null;
}
export type Interpretation = 'known-svg' | 'unknown-svg' | 'foreign-opaque';
export type ValueState<T> =
  | {
      readonly state: 'resolved';
      readonly value: T;
      readonly interpreter: string;
      readonly evidence?: 'authored' | 'inferred' | 'not-established';
    }
  | {
      readonly state: 'unresolved';
      readonly reason: string;
      readonly evidence?: 'authored' | 'inferred' | 'not-established';
    }
  | {
      readonly state: 'opaque';
      readonly reason: string;
      readonly original: string;
      readonly evidence?: 'authored' | 'inferred' | 'not-established';
    }
  | {
      readonly state: 'invalid';
      readonly code: string;
      readonly original: string;
      readonly evidence?: 'authored' | 'inferred' | 'not-established';
    };
export interface Attribute {
  readonly name: ExpandedName;
  readonly value: string;
  readonly provenance: Provenance;
  readonly interpretation: 'known-property' | 'opaque-property';
}
export interface ElementNode {
  readonly kind: 'element';
  readonly name: ExpandedName;
  readonly interpretation: Interpretation;
  readonly provenance: Provenance;
  readonly attributes: readonly Attribute[];
  readonly children: readonly IRNode[];
  readonly xmlSpace: ValueState<'default' | 'preserve'>;
}
export interface TextNode {
  readonly kind: 'text' | 'cdata' | 'comment';
  readonly value: string;
  readonly provenance: Provenance;
}
export interface GeneratedNode {
  readonly kind: 'generated';
  readonly value: string;
  readonly provenance: {
    readonly kind: 'generated';
    readonly passId: string;
    readonly anchor?: SourceSpan;
  };
}
export type IRNode = ElementNode | TextNode | GeneratedNode;
export type ReferenceResolution =
  | {
      readonly state: 'resolved' | 'unresolved' | 'blocked-external';
      readonly target: string;
    }
  | {
      readonly state: 'ambiguous';
      readonly target: string;
      readonly candidates: readonly string[];
    }
  | { readonly state: 'opaque-reference'; readonly reason: string };
export interface Analysis {
  readonly rootGeometry: {
    readonly width: ValueState<{
      readonly lexical: string;
      readonly unit: string | null;
    }>;
    readonly height: ValueState<{
      readonly lexical: string;
      readonly unit: string | null;
    }>;
    readonly viewBox: ValueState<readonly [number, number, number, number]>;
  };
  readonly ids: {
    readonly coverage: 'complete' | 'partial' | 'not-built';
    readonly definitions: readonly {
      readonly id: string;
      readonly nodePath: string;
    }[];
  };
  readonly references: {
    readonly coverage: 'complete' | 'partial' | 'not-built';
    readonly occurrences: readonly ReferenceResolution[];
  };
  readonly css: {
    readonly coverage:
      | 'lexically-retained'
      | 'declarations-parsed'
      | 'cascade-resolved'
      | 'partial'
      | 'opaque';
    readonly declarations: readonly unknown[];
  };
  readonly accessibility: {
    readonly titles: readonly string[];
    readonly descriptions: readonly string[];
    readonly coverage: 'preserved' | 'partial' | 'not-built';
  };
}
export interface IRDocument {
  readonly version: typeof IR_VERSION;
  readonly source: {
    readonly id: string;
    readonly text: string;
    readonly utf8ByteLength: number;
    readonly admissionPolicy: 'svg-input-safety-v1';
  };
  readonly prolog: readonly TextNode[];
  readonly epilog: readonly TextNode[];
  readonly root: ElementNode;
  readonly analysis: Analysis;
}

export class IRValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IRValidationError';
  }
}

// Values in this set have already passed the complete recursive validator and
// are deeply frozen. Keeping the trust marker weak avoids retaining completed
// documents while allowing the emitter to reuse the lowerer's validated value.
const validatedDocuments = new WeakSet<object>();

function plain(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new IRValidationError(`${label} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new IRValidationError(`${label} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor))
      throw new IRValidationError(`${label} must contain data properties only`);
  }
  return value as Record<string, unknown>;
}
function checkSpan(value: unknown, source: string, label: string): void {
  const span = plain(value, label);
  if (
    span.unit !== 'utf16-code-unit' ||
    !Number.isSafeInteger(span.startUtf16) ||
    !Number.isSafeInteger(span.endUtf16Exclusive)
  )
    throw new IRValidationError(`${label} is not a UTF-16 source span`);
  const start = span.startUtf16 as number;
  const end = span.endUtf16Exclusive as number;
  if (
    start < 0 ||
    end < start ||
    end > source.length ||
    span.sourceSlice !== source.slice(start, end)
  )
    throw new IRValidationError(`${label} does not match retained source`);
}
function checkProvenance(value: unknown, source: string, label: string): void {
  const provenance = plain(value, label);
  if (provenance.kind === 'source')
    checkSpan(provenance.span, source, `${label}.span`);
  else if (provenance.kind === 'generated') {
    if (typeof provenance.passId !== 'string' || !provenance.passId)
      throw new IRValidationError(`${label}.passId is invalid`);
    if (provenance.anchor !== undefined)
      checkSpan(provenance.anchor, source, `${label}.anchor`);
  } else if (provenance.kind !== 'unknown')
    throw new IRValidationError(`${label}.kind is invalid`);
}
function checkName(value: unknown, label: string): ExpandedName {
  const name = plain(value, label);
  if (
    typeof name.localName !== 'string' ||
    !name.localName ||
    typeof name.qualifiedName !== 'string' ||
    !name.qualifiedName ||
    !(name.namespaceUri === null || typeof name.namespaceUri === 'string') ||
    !(name.prefix === null || typeof name.prefix === 'string')
  )
    throw new IRValidationError(`${label} is invalid`);
  const qname =
    name.prefix === null ? name.localName : `${name.prefix}:${name.localName}`;
  if (name.qualifiedName !== qname)
    throw new IRValidationError(`${label} QName is inconsistent`);
  return name as unknown as ExpandedName;
}

/** Validate and defensively copy/freeze all IR data before publication. */
export function validateAndFreezeIR(input: unknown): IRDocument {
  if (
    input !== null &&
    typeof input === 'object' &&
    validatedDocuments.has(input)
  )
    return input as IRDocument;

  const active = new WeakSet<object>();
  let objects = 0;
  const clone = (value: unknown, depth = 0): unknown => {
    if (depth > 300)
      throw new IRValidationError('IR exceeds maximum nesting depth');
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    )
      return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value))
        throw new IRValidationError('IR contains a non-finite number');
      return value;
    }
    if (typeof value !== 'object')
      throw new IRValidationError('IR contains a non-data value');
    if (active.has(value)) throw new IRValidationError('IR contains a cycle');
    if (++objects > 300_000)
      throw new IRValidationError('IR exceeds maximum object count');
    active.add(value);
    let result: unknown;
    if (Array.isArray(value)) {
      const copy: unknown[] = [];
      for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(value, i))
          throw new IRValidationError('IR arrays must be dense');
        copy.push(clone(value[i], depth + 1));
      }
      result = Object.freeze(copy);
    } else {
      const record = plain(value, 'IR value');
      const copy: Record<string, unknown> = Object.create(null);
      for (const key of Object.keys(record))
        copy[key] = clone(record[key], depth + 1);
      result = Object.freeze(copy);
    }
    active.delete(value);
    return result;
  };
  const doc = plain(clone(input), 'document');
  if (doc.version !== IR_VERSION)
    throw new IRValidationError('unsupported IR version');
  const source = plain(doc.source, 'source');
  if (
    typeof source.id !== 'string' ||
    !source.id ||
    typeof source.text !== 'string' ||
    source.admissionPolicy !== 'svg-input-safety-v1' ||
    source.utf8ByteLength !== Buffer.byteLength(source.text, 'utf8')
  )
    throw new IRValidationError('source admission metadata is inconsistent');
  const sourceText = source.text;
  let elements = 0;
  let totalAttributes = 0;
  let textBytes = 0;
  const walk = (nodeValue: unknown, depth: number, label: string): void => {
    if (depth > 256)
      throw new IRValidationError('IR exceeds maximum element depth');
    const node = plain(nodeValue, label);
    checkProvenance(node.provenance, sourceText, `${label}.provenance`);
    if (node.kind === 'element') {
      if (++elements > 100_000)
        throw new IRValidationError('IR exceeds maximum element count');
      const name = checkName(node.name, `${label}.name`);
      if (
        !['known-svg', 'unknown-svg', 'foreign-opaque'].includes(
          String(node.interpretation)
        )
      )
        throw new IRValidationError(`${label} interpretation is invalid`);
      if (
        !Array.isArray(node.attributes) ||
        !Array.isArray(node.children) ||
        node.attributes.length > 256
      )
        throw new IRValidationError(`${label} ordered arrays are invalid`);
      totalAttributes += node.attributes.length;
      if (totalAttributes > 250_000)
        throw new IRValidationError('IR exceeds aggregate attribute count');
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = plain(node.attributes[i], `${label}.attributes[${i}]`);
        checkName(attr.name, `${label}.attributes[${i}].name`);
        if (
          typeof attr.value !== 'string' ||
          !['known-property', 'opaque-property'].includes(
            String(attr.interpretation)
          )
        )
          throw new IRValidationError(`${label} attribute is invalid`);
        checkProvenance(
          attr.provenance,
          sourceText,
          `${label}.attributes[${i}].provenance`
        );
      }
      const space = plain(node.xmlSpace, `${label}.xmlSpace`);
      if (
        !['resolved', 'unresolved', 'opaque', 'invalid'].includes(
          String(space.state)
        )
      )
        throw new IRValidationError(`${label}.xmlSpace is invalid`);
      if (
        space.state === 'resolved' &&
        !['default', 'preserve'].includes(String(space.value))
      )
        throw new IRValidationError(`${label}.xmlSpace value is invalid`);
      for (let i = 0; i < node.children.length; i++)
        walk(node.children[i], depth + 1, `${label}.children[${i}]`);
      if (
        depth === 0 &&
        (name.localName !== 'svg' || name.namespaceUri !== SVG_NAMESPACE)
      )
        throw new IRValidationError(
          'root must be an SVG-namespace svg element'
        );
    } else if (
      node.kind === 'text' ||
      node.kind === 'cdata' ||
      node.kind === 'comment'
    ) {
      if (typeof node.value !== 'string')
        throw new IRValidationError(`${label}.value is invalid`);
      textBytes += Buffer.byteLength(node.value, 'utf8');
      if (textBytes > 10 * 1024 * 1024)
        throw new IRValidationError('IR decoded text exceeds limit');
    } else if (node.kind === 'generated') {
      if (typeof node.value !== 'string')
        throw new IRValidationError(`${label}.value is invalid`);
    } else throw new IRValidationError(`${label} kind is invalid`);
  };
  for (const [label, values] of [
    ['prolog', doc.prolog],
    ['epilog', doc.epilog],
  ] as const) {
    if (!Array.isArray(values))
      throw new IRValidationError(`document ${label} must be an array`);
    for (const node of values) {
      if (plain(node, label).kind !== 'comment')
        throw new IRValidationError(`${label} may contain comments only`);
      walk(node, 0, label);
    }
  }
  walk(doc.root, 0, 'root');
  const analysis = plain(doc.analysis, 'analysis');
  const state = (value: unknown, label: string): void => {
    const item = plain(value, label);
    if (item.state === 'resolved') {
      if (
        typeof item.interpreter !== 'string' ||
        !item.interpreter ||
        !Object.hasOwn(item, 'value')
      )
        throw new IRValidationError(`${label} resolved value is invalid`);
    } else if (item.state === 'unresolved') {
      if (typeof item.reason !== 'string' || !item.reason)
        throw new IRValidationError(`${label} unresolved reason is invalid`);
    } else if (item.state === 'opaque') {
      if (
        typeof item.reason !== 'string' ||
        !item.reason ||
        typeof item.original !== 'string'
      )
        throw new IRValidationError(`${label} opaque value is invalid`);
    } else if (item.state === 'invalid') {
      if (
        typeof item.code !== 'string' ||
        !item.code ||
        typeof item.original !== 'string'
      )
        throw new IRValidationError(`${label} invalid value is malformed`);
    } else throw new IRValidationError(`${label} state is invalid`);
  };
  const geometry = plain(analysis.rootGeometry, 'analysis.rootGeometry');
  state(geometry.width, 'analysis.rootGeometry.width');
  state(geometry.height, 'analysis.rootGeometry.height');
  state(geometry.viewBox, 'analysis.rootGeometry.viewBox');
  for (const key of ['ids', 'references'] as const) {
    const section = plain(analysis[key], `analysis.${key}`);
    if (
      !['complete', 'partial', 'not-built'].includes(String(section.coverage))
    )
      throw new IRValidationError(`analysis.${key} coverage is invalid`);
    const entries = key === 'ids' ? section.definitions : section.occurrences;
    if (!Array.isArray(entries))
      throw new IRValidationError(`analysis.${key} entries must be an array`);
    for (const [index, entryValue] of entries.entries()) {
      const entry = plain(entryValue, `analysis.${key}[${index}]`);
      if (key === 'ids') {
        if (
          typeof entry.id !== 'string' ||
          !entry.id ||
          typeof entry.nodePath !== 'string' ||
          !entry.nodePath
        )
          throw new IRValidationError('ID analysis entry is invalid');
      } else if (
        entry.state === 'resolved' ||
        entry.state === 'unresolved' ||
        entry.state === 'blocked-external'
      ) {
        if (typeof entry.target !== 'string' || !entry.target)
          throw new IRValidationError('reference target is invalid');
      } else if (entry.state === 'ambiguous') {
        if (
          typeof entry.target !== 'string' ||
          !entry.target ||
          !Array.isArray(entry.candidates) ||
          !entry.candidates.every(candidate => typeof candidate === 'string')
        )
          throw new IRValidationError('ambiguous reference is invalid');
      } else if (entry.state === 'opaque-reference') {
        if (typeof entry.reason !== 'string' || !entry.reason)
          throw new IRValidationError('opaque reference is invalid');
      } else throw new IRValidationError('reference state is invalid');
    }
  }
  const css = plain(analysis.css, 'analysis.css');
  if (
    ![
      'lexically-retained',
      'declarations-parsed',
      'cascade-resolved',
      'partial',
      'opaque',
    ].includes(String(css.coverage)) ||
    !Array.isArray(css.declarations)
  )
    throw new IRValidationError('CSS analysis is invalid');
  const accessibility = plain(analysis.accessibility, 'analysis.accessibility');
  if (
    !Array.isArray(accessibility.titles) ||
    !accessibility.titles.every(value => typeof value === 'string') ||
    !Array.isArray(accessibility.descriptions) ||
    !accessibility.descriptions.every(value => typeof value === 'string') ||
    !['preserved', 'partial', 'not-built'].includes(
      String(accessibility.coverage)
    )
  )
    throw new IRValidationError('accessibility analysis is invalid');
  const validated = doc as unknown as IRDocument;
  validatedDocuments.add(validated);
  return validated;
}
