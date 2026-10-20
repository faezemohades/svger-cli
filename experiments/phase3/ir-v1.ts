/**
 * Experimental, parser-independent SVG IR v1. This module is intentionally
 * outside src/ and is not exported by the package.
 */

export const IR_VERSION = 'svger-ir-v1' as const;
export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
export const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';

export interface SourceSpan {
  readonly startUtf16: number;
  readonly endUtf16Exclusive: number;
  readonly unit: 'utf16-code-unit';
  /** Exact slice captured by the controlled fixture adapter. */
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
  | { readonly state: 'resolved'; readonly target: string }
  | { readonly state: 'unresolved'; readonly target: string }
  | {
      readonly state: 'ambiguous';
      readonly target: string;
      readonly candidates: readonly string[];
    }
  | { readonly state: 'blocked-external'; readonly target: string }
  | { readonly state: 'opaque-reference'; readonly reason: string };

export interface CssDeclaration {
  readonly property: string;
  readonly value: string;
  readonly important: boolean;
  readonly order: number;
  readonly provenance: Provenance;
  readonly interpretation: ValueState<string>;
}

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
    readonly declarations: readonly CssDeclaration[];
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

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new IRValidationError(`${label} must be an object`);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new IRValidationError(`${label} must be a plain object`);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key === 'symbol' || !descriptor || !('value' in descriptor)) {
      throw new IRValidationError(`${label} must contain only data properties`);
    }
  }
  return value as Record<string, unknown>;
}

function assertDenseArray(value: readonly unknown[], label: string): void {
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) {
      throw new IRValidationError(`${label} must not contain sparse entries`);
    }
  }
}

function string(
  value: unknown,
  label: string,
  allowEmpty = true
): asserts value is string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new IRValidationError(
      `${label} must be ${allowEmpty ? 'a string' : 'a non-empty string'}`
    );
  }
}

function span(value: unknown, source: string, label: string): void {
  const item = record(value, label);
  if (
    item.unit !== 'utf16-code-unit' ||
    !Number.isSafeInteger(item.startUtf16) ||
    !Number.isSafeInteger(item.endUtf16Exclusive)
  ) {
    throw new IRValidationError(`${label} has an invalid UTF-16 span`);
  }
  const start = item.startUtf16 as number;
  const end = item.endUtf16Exclusive as number;
  if (
    start < 0 ||
    end < start ||
    end > source.length ||
    typeof item.sourceSlice !== 'string' ||
    source.slice(start, end) !== item.sourceSlice
  ) {
    throw new IRValidationError(
      `${label} does not identify its exact source slice`
    );
  }
}

function provenance(value: unknown, source: string, label: string): void {
  const item = record(value, label);
  if (item.kind === 'source') span(item.span, source, `${label}.span`);
  else if (item.kind === 'generated') {
    string(item.passId, `${label}.passId`, false);
    if (item.anchor !== undefined) span(item.anchor, source, `${label}.anchor`);
  } else if (item.kind !== 'unknown')
    throw new IRValidationError(`${label} has an invalid kind`);
}

function expandedName(value: unknown, label: string): void {
  const item = record(value, label);
  string(item.localName, `${label}.localName`, false);
  string(item.qualifiedName, `${label}.qualifiedName`, false);
  if (item.namespaceUri !== null)
    string(item.namespaceUri, `${label}.namespaceUri`);
  if (item.prefix !== null) string(item.prefix, `${label}.prefix`, false);
  const expected =
    item.prefix === null ? item.localName : `${item.prefix}:${item.localName}`;
  if (item.qualifiedName !== expected)
    throw new IRValidationError(`${label} QName does not match its parts`);
}

function semanticValue(value: unknown, label: string): void {
  const item = record(value, label);
  if (
    item.evidence !== undefined &&
    !['authored', 'inferred', 'not-established'].includes(String(item.evidence))
  ) {
    throw new IRValidationError(
      `${label} has an invalid evidence classification`
    );
  }
  if (item.state === 'resolved') {
    string(item.interpreter, `${label}.interpreter`, false);
    if (!('value' in item))
      throw new IRValidationError(`${label} resolved value is missing`);
  } else if (item.state === 'unresolved')
    string(item.reason, `${label}.reason`, false);
  else if (item.state === 'opaque') {
    string(item.reason, `${label}.reason`, false);
    string(item.original, `${label}.original`);
  } else if (item.state === 'invalid') {
    string(item.code, `${label}.code`, false);
    string(item.original, `${label}.original`);
  } else throw new IRValidationError(`${label} has an invalid semantic state`);
}

/** Validate, defensively clone, and deeply freeze an experimental IR publication. */
export function validateAndFreezeIR(
  input: unknown,
  options: { readonly ownership?: 'copy' | 'freeze-owned' } = {}
): IRDocument {
  const ownership = options.ownership ?? 'copy';
  if (ownership !== 'copy' && ownership !== 'freeze-owned') {
    throw new IRValidationError('unsupported publication ownership mode');
  }
  const seen = new WeakSet<object>();
  let objectCount = 0;
  const cloneFrozen = (
    value: unknown,
    depth = 0,
    active = new WeakSet<object>()
  ): unknown => {
    if (depth > 300)
      throw new IRValidationError('IR exceeds maximum nesting depth');
    if (value === null || typeof value !== 'object') return value;
    if (active.has(value)) throw new IRValidationError('IR contains a cycle');
    active.add(value);
    let result: unknown;
    if (Array.isArray(value)) {
      result = Object.freeze(
        value.map(item => cloneFrozen(item, depth + 1, active))
      );
    } else {
      const item = record(value, 'IR value');
      const copy: Record<string, unknown> = Object.create(null);
      for (const key of Object.keys(item))
        copy[key] = cloneFrozen(item[key], depth + 1, active);
      result = Object.freeze(copy);
    }
    active.delete(value);
    return result;
  };
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
    if (seen.has(value)) {
      if (isDeepFrozen(value)) return cloneFrozen(value, depth);
      throw new IRValidationError(
        'IR contains a cycle or shared mutable object'
      );
    }
    seen.add(value);
    if (++objectCount > 300_000)
      throw new IRValidationError('IR exceeds maximum object count');
    if (Array.isArray(value)) {
      assertDenseArray(value, 'IR array');
      return Object.freeze(value.map(item => clone(item, depth + 1)));
    }
    const item = record(value, 'IR value');
    const copy: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(item))
      copy[key] = clone(item[key], depth + 1);
    return Object.freeze(copy);
  };

  const freezeOwned = (value: unknown, depth = 0): unknown => {
    if (depth > 300)
      throw new IRValidationError('IR exceeds maximum nesting depth');
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) {
      if (isDeepFrozen(value)) return value;
      throw new IRValidationError(
        'IR contains a cycle or shared mutable object'
      );
    }
    seen.add(value);
    if (++objectCount > 300_000)
      throw new IRValidationError('IR exceeds maximum object count');
    if (Array.isArray(value)) {
      assertDenseArray(value, 'IR array');
      for (const item of value) freezeOwned(item, depth + 1);
    } else {
      const item = record(value, 'IR value');
      for (const key of Object.keys(item)) freezeOwned(item[key], depth + 1);
    }
    return Object.freeze(value);
  };
  const copied = (
    ownership === 'copy' ? clone(input) : freezeOwned(input)
  ) as unknown;
  const doc = record(copied, 'document');
  if (doc.version !== IR_VERSION)
    throw new IRValidationError('unsupported IR version');
  const source = record(doc.source, 'source');
  string(source.id, 'source.id', false);
  string(source.text, 'source.text');
  if (
    source.admissionPolicy !== 'svg-input-safety-v1' ||
    source.utf8ByteLength !== new TextEncoder().encode(source.text).length
  ) {
    throw new IRValidationError('source admission metadata is inconsistent');
  }

  let elements = 0;
  const walk = (nodeValue: unknown, depth: number, label: string): void => {
    if (depth > 256)
      throw new IRValidationError('IR exceeds maximum element depth');
    const node = record(nodeValue, label);
    provenance(node.provenance, source.text as string, `${label}.provenance`);
    if (node.kind === 'element') {
      if (++elements > 100_000)
        throw new IRValidationError('IR exceeds maximum element count');
      expandedName(node.name, `${label}.name`);
      if (
        !['known-svg', 'unknown-svg', 'foreign-opaque'].includes(
          String(node.interpretation)
        )
      ) {
        throw new IRValidationError(`${label} has an invalid interpretation`);
      }
      semanticValue(node.xmlSpace, `${label}.xmlSpace`);
      if (!Array.isArray(node.attributes) || !Array.isArray(node.children)) {
        throw new IRValidationError(
          `${label} attributes and children must be ordered arrays`
        );
      }
      if (node.attributes.length > 256)
        throw new IRValidationError(`${label} exceeds attribute limit`);
      assertDenseArray(node.attributes, `${label}.attributes`);
      assertDenseArray(node.children, `${label}.children`);
      for (const [index, attrValue] of node.attributes.entries()) {
        const attr = record(attrValue, `${label}.attributes[${index}]`);
        expandedName(attr.name, `${label}.attributes[${index}].name`);
        string(attr.value, `${label}.attributes[${index}].value`);
        provenance(
          attr.provenance,
          source.text as string,
          `${label}.attributes[${index}].provenance`
        );
        if (
          attr.interpretation !== 'known-property' &&
          attr.interpretation !== 'opaque-property'
        ) {
          throw new IRValidationError(
            `${label}.attributes[${index}] has invalid interpretation`
          );
        }
      }
      node.children.forEach((child, index) =>
        walk(child, depth + 1, `${label}.children[${index}]`)
      );
    } else if (node.kind === 'generated') {
      if (record(node.provenance, `${label}.provenance`).kind !== 'generated') {
        throw new IRValidationError(
          `${label} generated node must have generated provenance`
        );
      }
      string(node.value, `${label}.value`);
    } else if (
      node.kind === 'text' ||
      node.kind === 'cdata' ||
      node.kind === 'comment'
    ) {
      string(node.value, `${label}.value`);
    } else throw new IRValidationError(`${label} has an invalid node kind`);
  };
  if (!Array.isArray(doc.prolog) || !Array.isArray(doc.epilog)) {
    throw new IRValidationError(
      'document prolog and epilog must be ordered arrays'
    );
  }
  assertDenseArray(doc.prolog, 'document prolog');
  assertDenseArray(doc.epilog, 'document epilog');
  doc.prolog.forEach((node, index) => {
    if (record(node, `prolog[${index}]`).kind !== 'comment') {
      throw new IRValidationError('document prolog may contain comments only');
    }
    walk(node, 0, `prolog[${index}]`);
  });
  doc.epilog.forEach((node, index) => {
    if (record(node, `epilog[${index}]`).kind !== 'comment') {
      throw new IRValidationError('document epilog may contain comments only');
    }
    walk(node, 0, `epilog[${index}]`);
  });
  walk(doc.root, 0, 'root');
  const root = record(doc.root, 'root');
  const rootName = record(root.name, 'root.name');
  if (
    root.kind !== 'element' ||
    rootName.localName !== 'svg' ||
    rootName.namespaceUri !== SVG_NAMESPACE
  ) {
    throw new IRValidationError('root must be an SVG-namespace svg element');
  }

  const analysis = record(doc.analysis, 'analysis');
  const geometry = record(analysis.rootGeometry, 'analysis.rootGeometry');
  semanticValue(geometry.width, 'analysis.rootGeometry.width');
  semanticValue(geometry.height, 'analysis.rootGeometry.height');
  semanticValue(geometry.viewBox, 'analysis.rootGeometry.viewBox');
  for (const key of ['ids', 'references'] as const) {
    const section = record(analysis[key], `analysis.${key}`);
    if (
      !['complete', 'partial', 'not-built'].includes(String(section.coverage))
    ) {
      throw new IRValidationError(`analysis.${key} has invalid coverage`);
    }
    const entries = key === 'ids' ? section.definitions : section.occurrences;
    if (!Array.isArray(entries)) {
      throw new IRValidationError(
        `analysis.${key} entries must be an ordered array`
      );
    }
    if (key === 'ids') {
      entries.forEach((entry, index) => {
        const definition = record(entry, `analysis.ids.definitions[${index}]`);
        string(definition.id, 'ID definition id', false);
        string(definition.nodePath, 'ID definition nodePath', false);
      });
    } else {
      entries.forEach((entry, index) => {
        const reference = record(
          entry,
          `analysis.references.occurrences[${index}]`
        );
        if (
          reference.state === 'resolved' ||
          reference.state === 'unresolved' ||
          reference.state === 'blocked-external'
        ) {
          string(reference.target, 'reference target', false);
        } else if (reference.state === 'ambiguous') {
          string(reference.target, 'reference target', false);
          if (
            !Array.isArray(reference.candidates) ||
            !reference.candidates.every(
              candidate => typeof candidate === 'string'
            )
          ) {
            throw new IRValidationError(
              'ambiguous reference candidates are invalid'
            );
          }
        } else if (reference.state === 'opaque-reference')
          string(reference.reason, 'opaque reference reason', false);
        else
          throw new IRValidationError(
            'reference has an invalid resolution state'
          );
      });
    }
  }
  const css = record(analysis.css, 'analysis.css');
  if (
    ![
      'lexically-retained',
      'declarations-parsed',
      'cascade-resolved',
      'partial',
      'opaque',
    ].includes(String(css.coverage)) ||
    !Array.isArray(css.declarations)
  ) {
    throw new IRValidationError(
      'analysis.css coverage/declarations are invalid'
    );
  }
  css.declarations.forEach((entry, index) => {
    const declaration = record(entry, `analysis.css.declarations[${index}]`);
    string(declaration.property, 'CSS property', false);
    string(declaration.value, 'CSS value');
    if (
      typeof declaration.important !== 'boolean' ||
      declaration.order !== index
    ) {
      throw new IRValidationError('CSS declaration order/priority is invalid');
    }
    semanticValue(declaration.interpretation, 'CSS declaration interpretation');
    provenance(
      declaration.provenance,
      source.text as string,
      'CSS declaration provenance'
    );
  });
  const accessibility = record(
    analysis.accessibility,
    'analysis.accessibility'
  );
  if (
    !Array.isArray(accessibility.titles) ||
    !accessibility.titles.every(v => typeof v === 'string') ||
    !Array.isArray(accessibility.descriptions) ||
    !accessibility.descriptions.every(v => typeof v === 'string') ||
    !['preserved', 'partial', 'not-built'].includes(
      String(accessibility.coverage)
    )
  ) {
    throw new IRValidationError('accessibility analysis is invalid');
  }
  return copied as IRDocument;
}

function isDeepFrozen(value: object, visited = new WeakSet<object>()): boolean {
  if (visited.has(value)) return true;
  visited.add(value);
  if (!Object.isFrozen(value)) return false;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) return false;
    if (
      descriptor.value !== null &&
      (typeof descriptor.value === 'object' ||
        typeof descriptor.value === 'function') &&
      !isDeepFrozen(descriptor.value, visited)
    ) {
      return false;
    }
  }
  return true;
}
