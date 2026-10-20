import { Buffer } from 'node:buffer';
import { SaxesParser } from 'saxes';
import {
  DEFAULT_MAX_SVG_INPUT_SIZE_BYTES,
  applySVGInputSafety,
} from '../../dist/security/input-safety.js';

export class ParserQualificationError extends Error {
  constructor(code, message, location) {
    super(`${code}: ${message}`);
    this.name = 'ParserQualificationError';
    this.code = code;
    if (location) this.location = location;
  }
}

const DEFAULT_LIMITS = Object.freeze({
  maxInputSizeBytes: DEFAULT_MAX_SVG_INPUT_SIZE_BYTES,
  maxDepth: 256,
  maxElements: 100_000,
  maxAttributesPerElement: 256,
  maxTotalAttributes: 200_000,
  maxTextSizeBytes: DEFAULT_MAX_SVG_INPUT_SIZE_BYTES,
});

function locationOf(parser) {
  return {
    // Saxes positions are exclusive cursors measured in JavaScript string
    // (UTF-16 code-unit) offsets. They are not UTF-8 byte offsets.
    offset: parser.position,
    line: parser.line,
    column: parser.column,
  };
}

function makeLimitError(message, parser) {
  return new ParserQualificationError(
    'E_SVG_XML_LIMIT',
    message,
    locationOf(parser)
  );
}

/**
 * Experimental structural adapter. The existing security boundary is always
 * run first and remains authoritative. This function retains, but never
 * serializes or rewrites, the admitted source string.
 */
export function parseSVGForQualification(source, requestedLimits = {}) {
  if (typeof source !== 'string') {
    throw new TypeError('SVG parser input must be a string.');
  }
  const limits = { ...DEFAULT_LIMITS, ...requestedLimits };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive safe integer.`);
    }
  }

  // Admission is deliberately performed before constructing any candidate
  // parser structures. Reject mode prevents this prototype from silently
  // accepting stripped or otherwise rewritten input.
  const admitted = applySVGInputSafety(source, {
    unsafeInputPolicy: 'reject',
    maxInputSizeBytes: limits.maxInputSizeBytes,
  });
  if (admitted !== source) {
    throw new ParserQualificationError(
      'E_XML_ADMISSION_CHANGED_INPUT',
      'The security boundary changed input; parser qualification requires unchanged admitted source.'
    );
  }

  const document = {
    source,
    root: null,
    prolog: [],
    epilog: [],
    sourceLengthCodeUnits: source.length,
  };
  const stack = [];
  let elementCount = 0;
  let totalAttributeCount = 0;
  let textSizeBytes = 0;
  let parserFailure;
  let adapterFailure;
  const parser = new SaxesParser({ xmlns: true, position: true });

  parser.on('error', () => {
    // Never expose saxes' message: it can quote attacker-controlled input.
    parserFailure = new ParserQualificationError(
      'E_XML_PARSE',
      'SVG XML is not well-formed or uses unsupported XML namespace syntax.',
      locationOf(parser)
    );
    throw parserFailure;
  });

  const append = node => {
    const parent = stack.at(-1);
    if (parent) parent.children.push(node);
    else if (node.type === 'element') {
      if (document.root) {
        throw new ParserQualificationError(
          'E_XML_PARSE',
          'XML document contains more than one document element.',
          locationOf(parser)
        );
      }
      document.root = node;
    } else (document.root ? document.epilog : document.prolog).push(node);
  };

  parser.on('doctype', () => {
    // Normally rejected by the scanner before saxes is constructed; retain an
    // explicit guard so a future scanner-policy change cannot enable DTDs here.
    throw new ParserQualificationError(
      'E_XML_DTD_FORBIDDEN',
      'Document type declarations are not accepted during parser qualification.',
      locationOf(parser)
    );
  });

  parser.on('opentag', tag => {
    try {
      elementCount++;
      const depth = stack.length + 1;
      const attributes = Object.values(tag.attributes);
      totalAttributeCount += attributes.length;
      if (depth > limits.maxDepth)
        throw makeLimitError(
          'XML nesting depth exceeds the parser qualification limit.',
          parser
        );
      if (elementCount > limits.maxElements)
        throw makeLimitError(
          'XML element count exceeds the parser qualification limit.',
          parser
        );
      if (attributes.length > limits.maxAttributesPerElement)
        throw makeLimitError(
          'XML attributes per element exceed the parser qualification limit.',
          parser
        );
      if (totalAttributeCount > limits.maxTotalAttributes)
        throw makeLimitError(
          'XML total attribute count exceeds the parser qualification limit.',
          parser
        );

      const node = {
        type: 'element',
        name: tag.name,
        prefix: tag.prefix,
        localName: tag.local,
        namespaceURI: tag.uri,
        attributes: attributes.map(attribute => ({
          name: attribute.name,
          prefix: attribute.prefix,
          localName: attribute.local,
          namespaceURI: attribute.uri,
          // XML entity/attribute normalization has already been applied.
          value: attribute.value,
        })),
        children: [],
        location: locationOf(parser),
        endLocation: null,
        isSelfClosing: tag.isSelfClosing,
      };
      append(node);
      if (!tag.isSelfClosing) stack.push(node);
      else node.endLocation = locationOf(parser);
    } catch (error) {
      adapterFailure = error;
      throw error;
    }
  });

  parser.on('closetag', tag => {
    // Saxes emits a close event for syntactically self-closing elements too;
    // those nodes were never pushed onto the open-element stack.
    if (tag.isSelfClosing) return;
    const node = stack.pop();
    if (node) node.endLocation = locationOf(parser);
  });

  for (const [eventName, nodeType] of [
    ['text', 'text'],
    ['cdata', 'cdata'],
    ['comment', 'comment'],
  ]) {
    parser.on(eventName, value => {
      try {
        const content = typeof value === 'string' ? value : String(value);
        if (nodeType !== 'comment') {
          textSizeBytes += Buffer.byteLength(content, 'utf8');
          if (textSizeBytes > limits.maxTextSizeBytes) {
            throw makeLimitError(
              'XML text volume exceeds the parser qualification limit.',
              parser
            );
          }
        }
        append({
          type: nodeType,
          value: content,
          location: locationOf(parser),
        });
      } catch (error) {
        adapterFailure = error;
        throw error;
      }
    });
  }

  parser.on('processinginstruction', instruction => {
    append({
      type: 'processing-instruction',
      target: instruction.target,
      body: instruction.body,
      location: locationOf(parser),
    });
  });

  try {
    // One complete, bounded JS string is fed at once. This avoids chunk-boundary
    // surrogate ambiguity; the input cap is applied before parsing.
    parser.write(source).close();
  } catch (error) {
    if (adapterFailure) throw adapterFailure;
    if (error instanceof ParserQualificationError) throw error;
    if (parserFailure) throw parserFailure;
    throw new ParserQualificationError(
      'E_XML_PARSE',
      'SVG XML parsing failed.',
      locationOf(parser)
    );
  }

  if (stack.length !== 0 || !document.root) {
    throw new ParserQualificationError(
      'E_XML_PARSE',
      'XML document did not produce a complete document element.',
      locationOf(parser)
    );
  }
  document.locationModel =
    'Saxes exclusive UTF-16 code-unit cursor; line/column are parser coordinates.';
  document.statistics = {
    elementCount,
    totalAttributeCount,
    textSizeBytes,
  };
  return document;
}
