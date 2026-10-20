import type {
  AdmittedSvgSource,
  ParseOutcome,
  ParserOptions,
  ParserResourceLimits,
  XmlChild,
  XmlParser,
} from './parser-contract-v1.js';

// The opaque admission brand prevents an ordinary typed caller from passing a
// string/object directly to the parser contract. Runtime checks remain needed.
// @ts-expect-error Missing the module-private admission brand.
const forgedAdmission: AdmittedSvgSource = {
  text: '<svg/>',
  utf8ByteLength: 6,
  admissionPolicyVersion: 'svg-input-safety-v1',
};
void forgedAdmission;

const parser: XmlParser = {
  parse(admittedSource, options): ParseOutcome {
    void admittedSource.text;
    void options?.signal;
    return {
      ok: false,
      diagnostics: [
        {
          code: 'E_XML_PARSE',
          message: 'SVG XML is not well-formed.',
        },
      ],
    };
  },
};
void parser;

const loweredLimits: ParserOptions = {
  limits: {
    maxInputBytes: 1024,
    maxDepth: 32,
  },
  sourceSpans: 'full-lexical-spans',
};
void loweredLimits;

const ceilings: ParserResourceLimits = {
  maxInputBytes: 10 * 1024 * 1024,
  maxDepth: 256,
  maxElements: 100_000,
  maxAttributesPerElement: 256,
  maxTotalAttributes: 200_000,
  maxDecodedTextBytes: 10 * 1024 * 1024,
};
void ceilings;

function assertNever(node: never): never {
  throw new Error(`Unhandled XML node: ${String(node)}`);
}

export function checkExhaustiveNodeKinds(node: XmlChild): string {
  switch (node.kind) {
    case 'element':
    case 'text':
    case 'cdata':
    case 'comment':
      return node.kind;
    default:
      return assertNever(node);
  }
}

function consumeOutcome(outcome: ParseOutcome): void {
  if (outcome.ok) {
    void outcome.document.root;
    void outcome.source.text;
  } else {
    void outcome.diagnostics[0].code;
    // @ts-expect-error Failed parses never expose a partial document.
    void outcome.document;
  }
}
void consumeOutcome;
