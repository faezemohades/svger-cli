/**
 * Experimental Saxes-to-Phase-02 contract adapter. This remains outside src/
 * and is never exported. The existing admission scanner runs inside the Saxes
 * qualification adapter before Saxes construction; lexical token indexing is
 * used only after that parse has succeeded.
 */
import { Buffer } from 'node:buffer';
import { parseSVGForQualification } from '../phase2/saxes-qualification-adapter.mjs';
import { indexXMLSourceSpans } from '../phase2/xml-source-spans.mjs';

function span(token, start = token.start, end = token.end) {
  return { start, end, unit: 'utf16-code-unit' };
}

function decodeXmlText(raw) {
  return raw
    .replace(/\r\n?/gu, '\n')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/giu, (_match, body) => {
      if (body === 'amp') return '&';
      if (body === 'lt') return '<';
      if (body === 'gt') return '>';
      if (body === 'quot') return '"';
      if (body === 'apos') return "'";
      const codePoint =
        body[1].toLowerCase() === 'x'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isInteger(codePoint) &&
        codePoint >= 0 &&
        codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : _match;
    });
}

function decodeXmlAttribute(raw) {
  // XML first normalizes literal line endings and literal attribute whitespace.
  // Character references are decoded afterwards, so &#x9;/&#xA; remain the
  // referenced characters while literal tabs/newlines become spaces.
  const normalizedLiteral = raw
    .replace(/\r\n?/gu, '\n')
    .replace(/[\t\n]/gu, ' ');
  return decodeXmlText(normalizedLiteral);
}

function attributeTokenMatches(source, token, lexical, parsed) {
  if (
    !token ||
    !lexical ||
    lexical.name !== parsed.name ||
    (lexical.quote !== '"' && lexical.quote !== "'") ||
    lexical.start < token.start ||
    lexical.end > token.end ||
    lexical.nameEnd !== lexical.start + lexical.name.length ||
    lexical.valueStart <= lexical.nameEnd ||
    lexical.valueEnd < lexical.valueStart ||
    lexical.end !== lexical.valueEnd + 1
  ) {
    return false;
  }
  const betweenNameAndValue = source.slice(
    lexical.nameEnd,
    lexical.valueStart - 1
  );
  return (
    source.slice(lexical.start, lexical.nameEnd) === parsed.name &&
    /^\s*=\s*$/u.test(betweenNameAndValue) &&
    source[lexical.valueStart - 1] === lexical.quote &&
    source[lexical.valueEnd] === lexical.quote &&
    decodeXmlAttribute(source.slice(lexical.valueStart, lexical.valueEnd)) ===
      parsed.value
  );
}

function expandedName(node) {
  return {
    qualifiedName: node.name,
    prefix: node.prefix || null,
    localName: node.localName,
    namespaceUri: node.namespaceURI || null,
  };
}

/**
 * Adapt one parser result. The optional token list is an experiment-only seam
 * for forcing misalignment tests; production-facing code does not exist here.
 */
export function adaptParsedSaxesDocument(
  source,
  parsed,
  tokens = indexXMLSourceSpans(source)
) {
  let cursor = 0;

  const next = (expectedType, predicate = () => true) => {
    while (cursor < tokens.length) {
      const token = tokens[cursor];
      // The lexical index includes entity references as overlapping tokens;
      // XML declaration spelling is also intentionally not a contract node.
      if (
        token.type === 'entity-reference' ||
        token.type === 'processing-instruction'
      ) {
        cursor++;
        continue;
      }
      // Only document-level whitespace is omitted from the contract's misc
      // node lists. Never skip a non-matching semantic token to find a later
      // lookalike: that could attach valid provenance to the wrong node.
      if (
        (expectedType === 'start-tag' || expectedType === 'comment') &&
        token.type === 'text' &&
        /^\s*$/u.test(token.raw)
      ) {
        cursor++;
        continue;
      }
      if (token.type !== expectedType) return undefined;
      if (!predicate(token)) return undefined;
      cursor++;
      return token;
    }
    return undefined;
  };

  const lowerComment = node => {
    const token = next('comment');
    return {
      kind: 'comment',
      value: node.value,
      ...(token && token.raw === `<!--${node.value}-->`
        ? { sourceSpan: span(token) }
        : {}),
    };
  };

  const lowerNode = node => {
    if (node.type === 'text') {
      const token = next(
        'text',
        candidate => decodeXmlText(candidate.raw) === node.value
      );
      return {
        kind: 'text',
        value: node.value,
        ...(token ? { sourceSpan: span(token) } : {}),
      };
    }
    if (node.type === 'cdata') {
      const token = next(
        'cdata',
        candidate =>
          source.slice(candidate.contentStart, candidate.contentEnd) ===
          node.value
      );
      return {
        kind: 'cdata',
        value: node.value,
        ...(token
          ? {
              sourceSpan: span(token),
              contentSpan: span(token, token.contentStart, token.contentEnd),
            }
          : {}),
      };
    }
    if (node.type === 'comment') return lowerComment(node);
    if (node.type !== 'element') {
      throw Object.assign(new Error('Unsupported Saxes node in XML adapter.'), {
        code: 'E_XML_ADAPTER_NODE',
      });
    }

    const token = next(
      'start-tag',
      candidate =>
        candidate.name === node.name &&
        candidate.selfClosing === Boolean(node.isSelfClosing)
    );
    const attributes = node.attributes.map((attribute, index) => {
      const lexical = token?.attributes[index];
      const exact = attributeTokenMatches(source, token, lexical, attribute);
      return {
        kind: 'attribute',
        name: {
          qualifiedName: attribute.name,
          prefix: attribute.prefix || null,
          localName: attribute.localName,
          namespaceUri: attribute.namespaceURI || null,
        },
        value: attribute.value,
        ...(exact
          ? {
              sourceSpan: span(token, lexical.start, lexical.end),
              leadingTriviaSpan: span(
                token,
                lexical.leadingStart,
                lexical.start
              ),
            }
          : {}),
      };
    });
    const children = node.children.map(lowerNode);
    let endTagSpan;
    if (!node.isSelfClosing) {
      const endPrefix = `</${node.name}`;
      const end = next(
        'end-tag',
        candidate =>
          candidate.raw.startsWith(endPrefix) &&
          /^\s*>$/u.test(candidate.raw.slice(endPrefix.length))
      );
      // The lowerer currently qualifies only the canonical no-space spelling.
      // A legal but unusual lexical variant remains valid input with unknown
      // end-tag provenance rather than a fabricated span.
      if (end?.raw === `</${node.name}>`) endTagSpan = span(end);
    }
    return {
      kind: 'element',
      name: expandedName(node),
      attributes,
      children,
      ...(token ? { startTagSpan: span(token) } : {}),
      ...(endTagSpan ? { endTagSpan } : {}),
    };
  };

  const prolog = parsed.prolog
    .filter(node => node.type === 'comment')
    .map(lowerComment);
  const root = lowerNode(parsed.root);
  const epilog = parsed.epilog
    .filter(node => node.type === 'comment')
    .map(lowerComment);
  const document = { kind: 'document', prolog, root, epilog };
  const sourceDocument = {
    text: source,
    encoding: 'utf-8',
    offsetUnit: 'utf16-code-unit',
    utf8ByteLength: Buffer.byteLength(source, 'utf8'),
  };
  return { source: sourceDocument, document };
}

/** Parse admitted source and produce the parser-independent Phase 02 shape. */
export function parseSourceToXmlDocument(source, parserLimits = {}) {
  // This call performs the mandatory admission before candidate structures are
  // allocated and preserves the established security diagnostic codes.
  const parsed = parseSVGForQualification(source, parserLimits);
  return adaptParsedSaxesDocument(source, parsed);
}

export function deeplyFreezeExperimental(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value))
    return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value))
    deeplyFreezeExperimental(value[key], seen);
  return Object.freeze(value);
}
