/**
 * Bounded XML scanner for the SVG trust boundary. This intentionally builds no
 * DOM, resolves no entities, and performs no filesystem or network access.
 */
export interface SVGXMLFinding {
  kind:
    | 'event-handler'
    | 'active-element'
    | 'external-reference'
    | 'unsafe-css';
  sample: string;
}

export interface SVGXMLScan {
  findings: SVGXMLFinding[];
  edits: Array<{ start: number; end: number }>;
  document?: SVGXMLDocument;
}

export interface SVGXMLSourceSpan {
  start: number;
  end: number;
  unit: 'utf16-code-unit';
}

export interface SVGXMLName {
  namespaceUri: string | null;
  localName: string;
  qualifiedName: string;
  prefix: string | null;
}

export interface SVGXMLAttribute {
  kind: 'attribute';
  name: SVGXMLName;
  value: string;
  sourceSpan: SVGXMLSourceSpan;
}

export interface SVGXMLTextNode {
  kind: 'text' | 'cdata' | 'comment';
  value: string;
  sourceSpan: SVGXMLSourceSpan;
  contentSpan?: SVGXMLSourceSpan;
}

export interface SVGXMLElement {
  kind: 'element';
  name: SVGXMLName;
  attributes: SVGXMLAttribute[];
  children: Array<SVGXMLElement | SVGXMLTextNode>;
  startTagSpan: SVGXMLSourceSpan;
  endTagSpan?: SVGXMLSourceSpan;
}

export interface SVGXMLDocument {
  kind: 'document';
  prolog: SVGXMLTextNode[];
  epilog: SVGXMLTextNode[];
  root: SVGXMLElement;
}

export class SVGXMLSecurityError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(`${code}: ${message}`);
    this.name = 'SVGXMLSecurityError';
    this.code = code;
    this.details = details;
  }
}

const MAX_DEPTH = 256;
const MAX_ELEMENTS = 100_000;
const MAX_ATTRIBUTES = 256;
const MAX_TOTAL_ATTRIBUTES = 250_000;
const MAX_DECODED_TEXT_BYTES = 10 * 1024 * 1024;
const MAX_ATTRIBUTE_VALUE_BYTES = 10 * 1024 * 1024;
const MAX_FINDINGS = 256;
const MAX_EDITS = 10_000;
const MAX_STYLE_SIZE_BYTES = 1024 * 1024;
const MAX_STYLE_CHUNKS = 10_000;
const MAX_DIAGNOSTIC_SAMPLE = 160;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const ACTIVE = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'source',
  'link',
  'animate',
  'animatemotion',
  'animatetransform',
  'set',
]);
const NAME = /^[A-Za-z_:][A-Za-z0-9_.:-]*$/;
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

interface Attr {
  name: string;
  value: string;
  normalizedValue: string;
  start: number;
  end: number;
}
interface Frame {
  name: string;
  lower: string;
  namespaces: Map<string, string>;
  unsafeStart?: number;
  node?: SVGXMLElement;
}

function invalid(message: string, offset: number): never {
  throw new SVGXMLSecurityError('E_INVALID_SVG_XML', message, { offset });
}

function decodeEntities(value: string, offset: number): string {
  if (!value.includes('&')) return value;
  let result = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== '&') {
      result += value[i];
      continue;
    }
    const end = value.indexOf(';', i + 1);
    if (end < 0) invalid('Unterminated XML entity reference.', offset + i);
    const entity = value.slice(i + 1, end);
    if (Object.hasOwn(ENTITIES, entity)) result += ENTITIES[entity];
    else if (/^#(?:x[\da-f]+|\d+)$/i.test(entity)) {
      const hex = /^#x/i.test(entity);
      const point = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (
        !Number.isInteger(point) ||
        point === 0 ||
        point > 0x10ffff ||
        (point >= 0xd800 && point <= 0xdfff) ||
        (point < 0x20 && point !== 0x09 && point !== 0x0a && point !== 0x0d) ||
        point === 0xfffe ||
        point === 0xffff
      ) {
        invalid('Invalid XML character reference.', offset + i);
      }
      result += String.fromCodePoint(point);
    } else
      invalid('Unknown XML entity references are not supported.', offset + i);
    i = end;
  }
  return result;
}

function normalizeXmlText(value: string): string {
  return value.replace(/\r\n?/gu, '\n');
}

function normalizeXmlAttribute(value: string): string {
  return value.replace(/\r\n?|\n|\t/gu, ' ');
}

function expandedName(
  qualifiedName: string,
  namespaces: ReadonlyMap<string, string>,
  attribute = false,
  offset = 0
): SVGXMLName {
  const colon = qualifiedName.indexOf(':');
  if (colon !== qualifiedName.lastIndexOf(':'))
    invalid('Malformed qualified XML name.', offset);
  const prefix = colon < 0 ? null : qualifiedName.slice(0, colon);
  const localName = colon < 0 ? qualifiedName : qualifiedName.slice(colon + 1);
  if (!localName) invalid('Malformed qualified XML name.', offset);
  const namespaceUri =
    qualifiedName === 'xmlns' || prefix === 'xmlns'
      ? 'http://www.w3.org/2000/xmlns/'
      : attribute && prefix === null
        ? null
        : prefix === null
          ? (namespaces.get('') ?? null)
          : (namespaces.get(prefix) ?? null);
  return { namespaceUri, localName, qualifiedName, prefix };
}

function sourceSpan(start: number, end: number): SVGXMLSourceSpan {
  return { start, end, unit: 'utf16-code-unit' };
}

function cssUnescape(css: string): string {
  if (/\\(?:\r\n?|\n|\f)/.test(css))
    throw new SVGXMLSecurityError(
      'E_UNSUPPORTED_SVG_CSS',
      'Escaped CSS newlines are not supported.'
    );
  if (css.endsWith('\\'))
    throw new SVGXMLSecurityError(
      'E_UNSUPPORTED_SVG_CSS',
      'Trailing CSS escape is not supported.'
    );
  let withoutComments = '';
  let quote = '';
  for (let i = 0; i < css.length; i++) {
    const character = css[i];
    if (quote) {
      withoutComments += character;
      if (character === '\\' && i + 1 < css.length) withoutComments += css[++i];
      else if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      quote = character;
      withoutComments += character;
    } else if (character === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end < 0)
        throw new SVGXMLSecurityError(
          'E_UNSUPPORTED_SVG_CSS',
          'Unterminated CSS comment is not supported.'
        );
      i = end + 1;
    } else withoutComments += character;
  }
  return withoutComments.replace(
    /\\([\da-f]{1,6})\s?|\\([^\r\n])/gi,
    (_match, hex: string | undefined, escaped: string | undefined) => {
      if (!hex)
        return escaped === '"' || escaped === "'"
          ? `\\${escaped}`
          : (escaped ?? '');
      const codePoint = Number.parseInt(hex, 16);
      return codePoint === 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? '\uFFFD'
        : String.fromCodePoint(codePoint);
    }
  );
}

function hasUnsafeCSS(css: string): boolean {
  const normalized = cssUnescape(css);
  let outsideStrings = '';
  let quote = '';
  let escaped = false;
  for (const character of normalized) {
    if (quote) {
      outsideStrings += ' ';
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      quote = character;
      outsideStrings += ' ';
    } else outsideStrings += character;
  }
  if (quote)
    throw new SVGXMLSecurityError(
      'E_UNSUPPORTED_SVG_CSS',
      'Unterminated CSS string is not supported.'
    );
  if (/@\s*import\b|expression\s*\(/i.test(outsideStrings)) return true;
  const urls = /url\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = urls.exec(outsideStrings)) !== null) {
    const target = match[1].trim().replace(/^(["'])([\s\S]*)\1$/, '$2');
    if (!target.startsWith('#')) return true;
  }
  return (
    /url\s*\(/i.test(outsideStrings) && !/url\s*\([^)]*\)/i.test(outsideStrings)
  );
}

function add(
  scan: SVGXMLScan,
  findingKeys: Set<string>,
  kind: SVGXMLFinding['kind'],
  sample: string,
  start: number,
  end: number
): void {
  const boundedSample = sample.slice(0, MAX_DIAGNOSTIC_SAMPLE);
  const key = `${kind}\0${boundedSample}`;
  if (!findingKeys.has(key)) {
    if (scan.findings.length >= MAX_FINDINGS)
      throw new SVGXMLSecurityError(
        'E_SVG_XML_LIMIT',
        'SVG unsafe-finding count exceeds the diagnostic limit.',
        { limit: MAX_FINDINGS }
      );
    findingKeys.add(key);
    scan.findings.push({ kind, sample: boundedSample });
  }
  if (scan.edits.length >= MAX_EDITS)
    throw new SVGXMLSecurityError(
      'E_SVG_XML_LIMIT',
      'SVG sanitization edit count exceeds the safety limit.',
      { limit: MAX_EDITS }
    );
  scan.edits.push({ start, end });
}

export function scanSVGSecurityBoundary(
  input: string,
  options: { collectDocument?: boolean } = {}
): SVGXMLScan {
  const hasBOM = input.startsWith('\uFEFF');
  const text = input;
  if (text.includes('\u0000') || text.includes('\uFFFD')) {
    throw new SVGXMLSecurityError(
      'E_UNSUPPORTED_SVG_ENCODING',
      'SVG input must be valid UTF-8 XML without replacement or NUL characters.'
    );
  }
  let characterOffset = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      (codePoint < 0x20 &&
        codePoint !== 0x09 &&
        codePoint !== 0x0a &&
        codePoint !== 0x0d) ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
      codePoint === 0xfffe ||
      codePoint === 0xffff
    )
      invalid(
        'Input contains a character that is not legal in XML 1.0.',
        characterOffset
      );
    characterOffset += character.length;
  }
  const scan: SVGXMLScan = { findings: [], edits: [] };
  const findingKeys = new Set<string>();
  const stack: Frame[] = [];
  let pos = hasBOM ? 1 : 0;
  let roots = 0;
  let elements = 0;
  let styleChunks: string[] = [];
  let styleSizeBytes = 0;
  let styleStart = 0;
  let totalAttributes = 0;
  let decodedTextBytes = 0;
  let attributeValueBytes = 0;
  const document: SVGXMLDocument | undefined = options.collectDocument
    ? { kind: 'document', prolog: [], epilog: [], root: undefined as never }
    : undefined;
  let rootNode: SVGXMLElement | undefined;

  const appendTextNode = (value: string, start: number, end: number): void => {
    const parent = stack.at(-1)?.node;
    if (document && parent && value.length > 0) {
      parent.children.push({
        kind: 'text',
        value,
        sourceSpan: sourceSpan(start, end),
      });
    }
  };
  const appendStyleText = (chunk: string): void => {
    styleSizeBytes += Buffer.byteLength(chunk, 'utf8');
    if (
      styleSizeBytes > MAX_STYLE_SIZE_BYTES ||
      styleChunks.length >= MAX_STYLE_CHUNKS
    )
      throw new SVGXMLSecurityError(
        'E_SVG_XML_LIMIT',
        'SVG style content exceeds its bounded scanner limit.',
        {
          maxStyleSizeBytes: MAX_STYLE_SIZE_BYTES,
          maxStyleChunks: MAX_STYLE_CHUNKS,
        }
      );
    styleChunks.push(chunk);
  };

  const startTag = (
    start: number
  ): { name: string; attrs: Attr[]; end: number; self: boolean } => {
    let i = start + 1;
    if (/\s/.test(text[i] ?? ''))
      invalid('Whitespace is not allowed after an XML start delimiter.', i);
    const nameStart = i;
    while (/[\w.:-]/.test(text[i] ?? '')) i++;
    const name = text.slice(nameStart, i);
    if (!NAME.test(name)) invalid('Malformed XML element name.', start);
    const attrs: Attr[] = [];
    const seen = new Set<string>();
    while (i < text.length) {
      const separatorStart = i;
      while (/\s/.test(text[i] ?? '')) i++;
      if (text.startsWith('/>', i))
        return { name, attrs, end: i + 2, self: true };
      if (text[i] === '>') return { name, attrs, end: i + 1, self: false };
      if (i === separatorStart)
        invalid('XML attributes must be separated by whitespace.', i);
      const attrStart = i;
      while (/[\w.:-]/.test(text[i] ?? '')) i++;
      const attrName = text.slice(attrStart, i);
      if (!NAME.test(attrName) || i === attrStart)
        invalid('Malformed XML attribute.', i);
      if (seen.has(attrName.toLowerCase()))
        invalid('Duplicate XML attributes are not supported.', attrStart);
      seen.add(attrName.toLowerCase());
      while (/\s/.test(text[i] ?? '')) i++;
      if (text[i++] !== '=') invalid('XML attributes must have values.', i - 1);
      while (/\s/.test(text[i] ?? '')) i++;
      const quote = text[i++];
      if (quote !== '"' && quote !== "'")
        invalid('XML attribute values must be quoted.', i - 1);
      const valueStart = i;
      const valueEnd = text.indexOf(quote, i);
      if (valueEnd < 0)
        invalid('Unterminated XML attribute value.', valueStart);
      const raw = text.slice(valueStart, valueEnd);
      if (/[<>]/.test(raw))
        invalid('Invalid character in XML attribute value.', valueStart);
      const decodedValue = decodeEntities(raw, valueStart);
      const normalizedValue = decodeEntities(
        normalizeXmlAttribute(raw),
        valueStart
      );
      attributeValueBytes += Buffer.byteLength(normalizedValue, 'utf8');
      if (attributeValueBytes > MAX_ATTRIBUTE_VALUE_BYTES)
        throw new SVGXMLSecurityError(
          'E_SVG_XML_LIMIT',
          'SVG aggregate attribute values exceed the scanner limit.',
          { limit: MAX_ATTRIBUTE_VALUE_BYTES, offset: attrStart }
        );
      attrs.push({
        name: attrName,
        value: decodedValue,
        normalizedValue,
        start: attrStart,
        end: valueEnd + 1,
      });
      i = valueEnd + 1;
      if (attrs.length > MAX_ATTRIBUTES)
        throw new SVGXMLSecurityError(
          'E_SVG_XML_LIMIT',
          'SVG element exceeds the attribute limit.',
          { limit: MAX_ATTRIBUTES, offset: attrStart }
        );
    }
    invalid('Unterminated XML start tag.', start);
  };

  while (pos < text.length) {
    const open = text.indexOf('<', pos);
    const textEnd = open < 0 ? text.length : open;
    const chars = text.slice(pos, textEnd);
    if (!stack.length && chars.trim())
      invalid('Text is not allowed outside the SVG root element.', pos);
    if (chars.includes(']]>'))
      invalid(
        'The sequence ]]> is not allowed in XML text.',
        pos + chars.indexOf(']]>')
      );
    const normalizedText = decodeEntities(normalizeXmlText(chars), pos);
    decodedTextBytes += Buffer.byteLength(normalizedText, 'utf8');
    if (decodedTextBytes > MAX_DECODED_TEXT_BYTES)
      throw new SVGXMLSecurityError(
        'E_SVG_XML_LIMIT',
        'SVG decoded text exceeds the scanner limit.',
        { limit: MAX_DECODED_TEXT_BYTES, offset: pos }
      );
    if (stack.at(-1)?.lower === 'style')
      appendStyleText(decodeEntities(chars, pos));
    else decodeEntities(chars, pos);
    appendTextNode(normalizedText, pos, textEnd);
    if (open < 0) {
      pos = text.length;
      break;
    }
    if (text.startsWith('<!--', open)) {
      if (stack.at(-1)?.lower === 'style')
        invalid('XML markup is not allowed inside SVG style text.', open);
      const end = text.indexOf('-->', open + 4);
      if (end < 0 || text.slice(open + 4, end).includes('--'))
        invalid('Malformed XML comment.', open);
      if (document) {
        const comment: SVGXMLTextNode = {
          kind: 'comment',
          value: normalizeXmlText(text.slice(open + 4, end)),
          sourceSpan: sourceSpan(open, end + 3),
        };
        const parent = stack.at(-1)?.node;
        if (parent) parent.children.push(comment);
        else if (!rootNode) document.prolog.push(comment);
        else document.epilog.push(comment);
      }
      pos = end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', open)) {
      if (!stack.length)
        invalid('CDATA is only valid inside the SVG root.', open);
      const end = text.indexOf(']]>', open + 9);
      if (end < 0) invalid('Unterminated CDATA section.', open);
      const cdataValue = normalizeXmlText(text.slice(open + 9, end));
      decodedTextBytes += Buffer.byteLength(cdataValue, 'utf8');
      if (decodedTextBytes > MAX_DECODED_TEXT_BYTES)
        throw new SVGXMLSecurityError(
          'E_SVG_XML_LIMIT',
          'SVG decoded text exceeds the scanner limit.',
          { limit: MAX_DECODED_TEXT_BYTES, offset: open }
        );
      if (stack.at(-1)?.lower === 'style')
        appendStyleText(text.slice(open + 9, end));
      if (document) {
        const parent = stack.at(-1)?.node;
        if (parent)
          parent.children.push({
            kind: 'cdata',
            value: cdataValue,
            sourceSpan: sourceSpan(open, end + 3),
            contentSpan: sourceSpan(open + 9, end),
          });
      }
      pos = end + 3;
      continue;
    }
    if (
      /^<!DOCTYPE\b/i.test(text.slice(open, open + 12)) ||
      text.startsWith('<!ENTITY', open)
    ) {
      throw new SVGXMLSecurityError(
        'E_UNSAFE_SVG_CONTENT',
        'DOCTYPE and entity declarations are not allowed.',
        { offset: open }
      );
    }
    if (text.startsWith('<?', open)) {
      if (stack.at(-1)?.lower === 'style')
        invalid(
          'Processing instructions are not allowed inside SVG style text.',
          open
        );
      const end = text.indexOf('?>', open + 2);
      if (end < 0) invalid('Unterminated XML processing instruction.', open);
      const declaration = text.slice(open + 2, end);
      if (
        open !== (hasBOM ? 1 : 0) ||
        !/^xml\s+version\s*=\s*(["'])1\.0\1(?:\s+encoding\s*=\s*(["'])UTF-8\2)?(?:\s+standalone\s*=\s*(["'])(?:yes|no)\3)?\s*$/.test(
          declaration
        )
      ) {
        throw new SVGXMLSecurityError(
          'E_UNSUPPORTED_SVG_ENCODING',
          'Only an optional UTF-8 XML declaration is supported.',
          { offset: open }
        );
      }
      pos = end + 2;
      continue;
    }
    if (text.startsWith('</', open)) {
      let i = open + 2;
      if (/\s/.test(text[i] ?? ''))
        invalid('Whitespace is not allowed after an XML end delimiter.', i);
      const nameStart = i;
      while (/[\w.:-]/.test(text[i] ?? '')) i++;
      const name = text.slice(nameStart, i);
      while (/\s/.test(text[i] ?? '')) i++;
      if (!NAME.test(name) || text[i] !== '>')
        invalid('Malformed XML end tag.', open);
      const frame = stack.pop();
      if (!frame || frame.name !== name)
        invalid('Mismatched XML end tag.', open);
      if (frame.lower === 'style') {
        if (hasUnsafeCSS(styleChunks.join('')))
          add(scan, findingKeys, 'unsafe-css', '<style>', styleStart, i + 1);
        styleChunks = [];
        styleSizeBytes = 0;
      }
      if (frame.unsafeStart !== undefined)
        scan.edits.push({ start: frame.unsafeStart, end: i + 1 });
      if (frame.node) frame.node.endTagSpan = sourceSpan(open, i + 1);
      pos = i + 1;
      continue;
    }
    if (text.startsWith('<!', open))
      invalid('Unsupported XML declaration.', open);

    if (stack.at(-1)?.lower === 'style')
      invalid('SVG style elements may contain only text or CDATA.', open);

    const tag = startTag(open);
    const lower = tag.name.toLowerCase();
    if (!stack.length && (++roots !== 1 || lower !== 'svg'))
      invalid('SVG input must have exactly one <svg> root element.', open);
    if (++elements > MAX_ELEMENTS)
      throw new SVGXMLSecurityError(
        'E_SVG_XML_LIMIT',
        'SVG element count exceeds the safety limit.',
        { limit: MAX_ELEMENTS }
      );
    totalAttributes += tag.attrs.length;
    if (totalAttributes > MAX_TOTAL_ATTRIBUTES)
      throw new SVGXMLSecurityError(
        'E_SVG_XML_LIMIT',
        'SVG aggregate attribute count exceeds the scanner limit.',
        { limit: MAX_TOTAL_ATTRIBUTES, offset: open }
      );
    if (stack.length + 1 > MAX_DEPTH)
      throw new SVGXMLSecurityError(
        'E_SVG_XML_LIMIT',
        'SVG nesting depth exceeds the safety limit.',
        { limit: MAX_DEPTH }
      );

    const namespaces = new Map<string, string>(
      stack.at(-1)?.namespaces ?? [
        ['', SVG_NS],
        ['xml', 'http://www.w3.org/XML/1998/namespace'],
      ]
    );
    for (const attr of tag.attrs) {
      if (attr.name === 'xmlns') namespaces.set('', attr.value);
      else if (attr.name.startsWith('xmlns:'))
        namespaces.set(attr.name.slice(6), attr.value);
    }
    for (const [prefix, namespace] of namespaces) {
      if (
        (prefix === 'xlink' && namespace !== XLINK_NS) ||
        (prefix === 'xml' &&
          namespace !== 'http://www.w3.org/XML/1998/namespace') ||
        (prefix !== 'xlink' && prefix !== '' && prefix !== 'xml')
      ) {
        invalid(
          'Unknown or ambiguous XML namespace declarations are not supported.',
          open
        );
      }
    }
    if (tag.name.includes(':') || namespaces.get('') !== SVG_NS)
      invalid('Namespaced or non-SVG elements are not supported.', open);

    const active = ACTIVE.has(lower);
    const unsafeStart = active ? open : undefined;
    if (active)
      add(scan, findingKeys, 'active-element', `<${tag.name}>`, open, tag.end);
    for (const attr of tag.attrs) {
      const name = attr.name.toLowerCase();
      const prefix = name.includes(':') ? name.split(':')[0] : '';
      if (
        prefix &&
        prefix !== 'xmlns' &&
        prefix !== 'xml' &&
        namespaces.get(prefix) !== XLINK_NS
      )
        invalid('Unknown or ambiguous XML attribute namespace.', attr.start);
      const localName = name.split(':').at(-1) ?? name;
      if (/^on[a-z]/.test(localName))
        add(
          scan,
          findingKeys,
          'event-handler',
          attr.name,
          attr.start,
          attr.end
        );
      if (
        localName === 'href' ||
        ['src', 'poster', 'data'].includes(localName) ||
        name === 'xml:base'
      ) {
        const value = attr.value.trim();
        if (value && !value.startsWith('#'))
          add(
            scan,
            findingKeys,
            'external-reference',
            `${attr.name}=${value}`,
            attr.start,
            attr.end
          );
      }
      if (
        (name === 'style' || /url\s*\(/i.test(attr.value)) &&
        hasUnsafeCSS(attr.value)
      ) {
        add(
          scan,
          findingKeys,
          name === 'style' ? 'unsafe-css' : 'external-reference',
          `${attr.name}=${attr.value}`,
          attr.start,
          attr.end
        );
      }
    }
    let elementNode: SVGXMLElement | undefined;
    if (document) {
      elementNode = {
        kind: 'element',
        name: expandedName(tag.name, namespaces, false, open),
        attributes: tag.attrs.map(attr => ({
          kind: 'attribute' as const,
          name: expandedName(attr.name, namespaces, true, attr.start),
          value: attr.normalizedValue,
          sourceSpan: sourceSpan(attr.start, attr.end),
        })),
        children: [],
        startTagSpan: sourceSpan(open, tag.end),
      };
      const parent = stack.at(-1)?.node;
      if (parent) parent.children.push(elementNode);
      else rootNode = elementNode;
      if (tag.self) elementNode.endTagSpan = sourceSpan(open, tag.end);
    }
    if (lower === 'style') {
      styleStart = open;
      styleChunks = [];
      styleSizeBytes = 0;
    }
    pos = tag.end;
    if (!tag.self)
      stack.push({
        name: tag.name,
        lower,
        namespaces,
        ...(unsafeStart === undefined ? {} : { unsafeStart }),
        ...(elementNode === undefined ? {} : { node: elementNode }),
      });
    else if (unsafeStart !== undefined)
      scan.edits[scan.edits.length - 1] = { start: open, end: tag.end };
  }
  if (stack.length) invalid('Unclosed XML element.', text.length);
  if (roots !== 1)
    invalid('SVG input must contain exactly one <svg> root element.', 0);
  if (document && rootNode) {
    document.root = rootNode;
    scan.document = document;
  }
  return scan;
}
