/**
 * Internal, implementation-neutral parser contract proposal for Phase 02.6.
 * This file is intentionally outside src/ and is not part of package exports.
 * It defines types only; it does not implement admission or parsing.
 */

declare const admittedSvgSourceBrand: unique symbol;

/**
 * Opaque result of the mandatory SVG security admission boundary. The brand
 * symbol is module-private so ordinary callers cannot structurally construct
 * this value. Runtime validation remains mandatory; TypeScript types are not
 * a security boundary.
 */
export interface AdmittedSvgSource {
  readonly [admittedSvgSourceBrand]: true;
  readonly text: string;
  readonly utf8ByteLength: number;
  readonly admissionPolicyVersion: 'svg-input-safety-v1';
}

export interface SvgAdmissionOptions {
  /** Narrow the established input ceiling; never raise it. */
  readonly maxInputBytes?: number;
}

export type AdmissionDiagnosticCode =
  | 'E_SVG_INPUT_TOO_LARGE'
  | 'E_UNSUPPORTED_SVG_ENCODING'
  | 'E_INVALID_SVG_XML'
  | 'E_UNSAFE_SVG_CONTENT'
  | 'E_SVG_XML_LIMIT'
  | 'E_SVG_ADMISSION_ABORTED';

export interface AdmissionDiagnostic {
  readonly code: AdmissionDiagnosticCode;
  /** Sanitized, stable text. Must not include source snippets or attribute values. */
  readonly message: string;
  readonly sourceSpan?: SourceSpan;
}

export type AdmissionOutcome =
  | {
      readonly ok: true;
      readonly admitted: AdmittedSvgSource;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly [
        AdmissionDiagnostic,
        ...AdmissionDiagnostic[],
      ];
    };

/** The only authority permitted to create an AdmittedSvgSource. */
export interface SvgAdmissionBoundary {
  admit(untrustedText: string, options?: SvgAdmissionOptions): AdmissionOutcome;
}

export type OffsetUnit = 'utf16-code-unit';

/** Inclusive start, exclusive end in JavaScript UTF-16 code-unit offsets. */
export interface SourceSpan {
  readonly start: number;
  readonly end: number;
  readonly unit: OffsetUnit;
}

export interface SourceDocument {
  /** The exact admitted input, not normalized or serialized output. */
  readonly text: string;
  readonly encoding: 'utf-8';
  readonly offsetUnit: OffsetUnit;
  readonly utf8ByteLength: number;
}

export interface ExpandedXmlName {
  /** Original qualified spelling, e.g. `xlink:href`. */
  readonly qualifiedName: string;
  readonly prefix: string | null;
  readonly localName: string;
  /** `null` means no namespace; the default namespace does not apply to attributes. */
  readonly namespaceUri: string | null;
}

export interface XmlAttribute {
  readonly kind: 'attribute';
  readonly name: ExpandedXmlName;
  /** XML-decoded value; original entity/quote spelling remains in source text. */
  readonly value: string;
  /** Ordered with source attributes. */
  readonly sourceSpan?: SourceSpan;
  /** Whitespace preceding this attribute, available only in full lexical mode. */
  readonly leadingTriviaSpan?: SourceSpan;
}

export interface XmlElement {
  readonly kind: 'element';
  readonly name: ExpandedXmlName;
  readonly attributes: readonly XmlAttribute[];
  readonly children: readonly XmlChild[];
  /** Exact raw tag token spans; never parser event cursors. */
  readonly startTagSpan?: SourceSpan;
  readonly endTagSpan?: SourceSpan;
}

export interface XmlText {
  readonly kind: 'text';
  /** Decoded XML character data; do not trim or merge adjacent nodes. */
  readonly value: string;
  readonly sourceSpan?: SourceSpan;
}

export interface XmlCdata {
  readonly kind: 'cdata';
  /** CDATA content without delimiters; node kind preserves the distinction. */
  readonly value: string;
  readonly sourceSpan?: SourceSpan;
  readonly contentSpan?: SourceSpan;
}

export interface XmlComment {
  readonly kind: 'comment';
  readonly value: string;
  readonly sourceSpan?: SourceSpan;
}

export type XmlChild = XmlElement | XmlText | XmlCdata | XmlComment;
export type XmlMiscNode = XmlComment;

export interface XmlDocument {
  readonly kind: 'document';
  readonly prolog: readonly XmlMiscNode[];
  readonly root: XmlElement;
  readonly epilog: readonly XmlMiscNode[];
}

export type ParserDiagnosticCode =
  | 'E_XML_PARSE'
  | 'E_XML_NAMESPACE'
  | 'E_SVG_XML_LIMIT'
  | 'E_XML_PARSE_ABORTED'
  | 'E_XML_PARSER_FAILURE';

export interface ParserCursor {
  /** Exclusive parser cursor in UTF-16 code units; not a token span. */
  readonly offset: number;
  readonly unit: OffsetUnit;
}

export interface ParserDiagnostic {
  readonly code: ParserDiagnosticCode;
  /** Stable, sanitized diagnostic; never includes source text or decoded values. */
  readonly message: string;
  readonly sourceSpan?: SourceSpan;
  /** May be present when an exact raw-token span cannot be established. */
  readonly cursor?: ParserCursor;
}

export type ParseOutcome =
  | {
      readonly ok: true;
      readonly document: XmlDocument;
      readonly source: SourceDocument;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      /** Failure is atomic: no document or partially built tree is returned. */
      readonly diagnostics: readonly [ParserDiagnostic, ...ParserDiagnostic[]];
    };

export type SourceSpanPolicy = 'none' | 'node-spans' | 'full-lexical-spans';

/** These are ceilings, not requested defaults; callers may only lower them. */
export interface ParserResourceLimits {
  readonly maxInputBytes: number;
  readonly maxDepth: number;
  readonly maxElements: number;
  readonly maxAttributesPerElement: number;
  readonly maxTotalAttributes: number;
  readonly maxDecodedTextBytes: number;
}

export interface ParserOptions {
  readonly limits?: Partial<ParserResourceLimits>;
  readonly sourceSpans?: SourceSpanPolicy;
  readonly signal?: AbortSignal;
}

/**
 * Synchronous, single-document parsing. A pre-aborted signal fails before
 * allocation. Implementations check cancellation at bounded parser checkpoints
 * where possible; synchronous JavaScript cannot promise event-loop-delivered
 * cancellation during one uninterrupted parse call.
 */
export interface XmlParser {
  parse(
    admittedSource: AdmittedSvgSource,
    options?: ParserOptions
  ): ParseOutcome;
}

export const PARSER_RESOURCE_CEILINGS: ParserResourceLimits = Object.freeze({
  maxInputBytes: 10 * 1024 * 1024,
  maxDepth: 256,
  maxElements: 100_000,
  maxAttributesPerElement: 256,
  maxTotalAttributes: 200_000,
  maxDecodedTextBytes: 10 * 1024 * 1024,
});
