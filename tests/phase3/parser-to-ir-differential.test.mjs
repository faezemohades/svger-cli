import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Buffer } from 'node:buffer';
import { applySVGInputSafety } from '../../dist/security/input-safety.js';
import { lowerXmlDocumentToIR } from '../../experiments/phase3/.build/phase3/lower-xml-to-ir.js';
import {
  adaptParsedSaxesDocument,
  deeplyFreezeExperimental,
  parseSourceToXmlDocument,
} from '../../experiments/phase3/saxes-xml-document-adapter.mjs';
import { parseSVGForQualification } from '../../experiments/phase2/saxes-qualification-adapter.mjs';
import { indexXMLSourceSpans } from '../../experiments/phase2/xml-source-spans.mjs';
import {
  rejectedCorpus,
  safeCorpus,
} from '../phase0/svg-security-corpus.fixtures.mjs';

const SVG = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';
const sourceText =
  `<!--prolog-->\r\n<svg xmlns="${SVG}" xmlns:xlink='${XLINK}' width='100%' viewBox="0 0 24 24" xml:space="preserve" role="img" aria-labelledby="title">\r\n` +
  '<title id="title">A&amp;😀<tspan>B</tspan></title>' +
  '<text> lead <tspan>middle</tspan> tail <![CDATA[<raw>]]><!--inside--></text>' +
  '<g id="shape"/><use xlink:href = "#shape"/>' +
  '<path style="fill:red;--accent:var(--other)"/><desc>Accessible</desc>' +
  '<widget proprietary="keep">opaque</widget></svg><!--epilog-->';

function pipeline(source, ownership = 'copy') {
  const { source: contractSource, document } = parseSourceToXmlDocument(source);
  if (ownership === 'share-verified-immutable') {
    deeplyFreezeExperimental(contractSource);
    deeplyFreezeExperimental(document);
  }
  const ir = lowerXmlDocumentToIR(contractSource, document, {
    sourceId: 'parser-to-ir-differential',
    ownership,
  });
  return { contractSource, document, ir };
}

// Security parity: admission runs before Saxes construction, and its exact
// established error code remains observable through this end-to-end adapter.
for (const [index, sample] of safeCorpus.entries()) {
  assert.doesNotThrow(
    () => parseSourceToXmlDocument(sample),
    `security-safe source reaches parser ${index}`
  );
}
for (const [label, sample, code] of rejectedCorpus) {
  assert.throws(
    () => parseSourceToXmlDocument(sample),
    error => error?.code === code,
    `security rejection remains authoritative: ${label}`
  );
}

const { contractSource, document, ir } = pipeline(sourceText);
assert.equal(contractSource.text, sourceText);
assert.equal(contractSource.utf8ByteLength, Buffer.byteLength(sourceText));
assert.deepEqual(
  document.prolog.map(node => node.value),
  ['prolog']
);
assert.deepEqual(
  document.epilog.map(node => node.value),
  ['epilog']
);
assert.equal(document.root.name.namespaceUri, SVG);
assert.equal(
  ir.root.children[0].provenance.span.sourceSlice,
  '\r\n',
  'CRLF source is retained even though the XML parser normalizes text events'
);
assert.deepEqual(
  document.root.attributes.map(attribute => attribute.name.qualifiedName),
  [
    'xmlns',
    'xmlns:xlink',
    'width',
    'viewBox',
    'xml:space',
    'role',
    'aria-labelledby',
  ],
  'Saxes ordered attributes lower without parser-specific types'
);
assert.equal(
  document.root.attributes[2].sourceSpan &&
    sourceText.slice(
      document.root.attributes[2].sourceSpan.start,
      document.root.attributes[2].sourceSpan.end
    ),
  "width='100%'"
);
assert.equal(
  document.root.attributes[2].leadingTriviaSpan &&
    sourceText.slice(
      document.root.attributes[2].leadingTriviaSpan.start,
      document.root.attributes[2].leadingTriviaSpan.end
    ),
  ' '
);
assert.equal(
  document.root.attributes[3].sourceSpan &&
    sourceText.slice(
      document.root.attributes[3].sourceSpan.start,
      document.root.attributes[3].sourceSpan.end
    ),
  'viewBox="0 0 24 24"'
);
assert.throws(
  () => parseSourceToXmlDocument(sourceText, { maxDepth: 1 }),
  error => error?.code === 'E_SVG_XML_LIMIT',
  'the parser adapter retains the established configurable resource ceiling'
);

const title = ir.root.children.find(
  node => node.kind === 'element' && node.name.localName === 'title'
);
assert.equal(title.children[0].value, 'A&😀');
assert.equal(title.children[0].provenance.kind, 'source');
assert.equal(title.children[0].provenance.span.sourceSlice, 'A&amp;😀');
assert.notEqual(
  title.children[0].provenance.span.endUtf16Exclusive -
    title.children[0].provenance.span.startUtf16,
  Buffer.byteLength('A&amp;😀')
);
const textNode = ir.root.children.find(
  node => node.kind === 'element' && node.name.localName === 'text'
);
assert.deepEqual(
  textNode.children.map(node => node.kind),
  ['text', 'element', 'text', 'cdata', 'comment']
);
assert.equal(textNode.xmlSpace.state, 'resolved');
assert.equal(textNode.xmlSpace.value, 'preserve');
assert.equal(textNode.xmlSpace.evidence, 'inferred');
assert.equal(
  textNode.children[3].provenance.span.sourceSlice,
  '<![CDATA[<raw>]]>'
);
assert.equal(textNode.children[4].provenance.span.sourceSlice, '<!--inside-->');
assert.equal(
  ir.root.children[1].provenance.span.sourceSlice,
  '<title id="title">'
);
assert.equal(
  ir.root.children[1].attributes[0].provenance.span.sourceSlice,
  'id="title"'
);
assert.equal(
  ir.root.children[1].children[1].provenance.span.sourceSlice,
  '<tspan>'
);
assert.equal(
  ir.root.children[1].children[1].children[0].provenance.span.sourceSlice,
  'B'
);
assert.equal(
  ir.root.children.find(
    node => node.kind === 'element' && node.name.localName === 'use'
  ).attributes[0].name.namespaceUri,
  XLINK
);
assert.equal(ir.root.children.at(-1).interpretation, 'unknown-svg');
assert.equal(
  ir.root.children.at(-1).attributes[0].interpretation,
  'opaque-property'
);
assert.equal(ir.analysis.rootGeometry.width.state, 'opaque');
assert.equal(ir.analysis.rootGeometry.width.evidence, 'authored');
assert.equal(ir.analysis.references.occurrences[0].state, 'resolved');
assert.equal(ir.analysis.css.coverage, 'lexically-retained');
assert.deepEqual(ir.analysis.accessibility.titles, ['A&😀B']);
assert.deepEqual(ir.analysis.accessibility.descriptions, ['Accessible']);
assert.ok(Object.isFrozen(ir) && Object.isFrozen(ir.root.children));

// Attribute spans require exact QName, quote boundaries, and XML-normalized
// value correspondence. Literal attribute whitespace normalizes to spaces;
// numeric character references retain their referenced whitespace characters.
const normalizedAttributeSource = `<svg xmlns="${SVG}"><path aria-label="x&#x9;y\tz&#xA;q&#13;r&amp;"/></svg>`;
const normalizedAttribute = parseSourceToXmlDocument(normalizedAttributeSource)
  .document.root.children[0].attributes[0];
assert.equal(normalizedAttribute.value, 'x\ty z\nq\rr&');
assert.ok(normalizedAttribute.sourceSpan);
const rawNormalizedAttribute = normalizedAttributeSource.slice(
  normalizedAttribute.sourceSpan.start,
  normalizedAttribute.sourceSpan.end
);
assert.equal(
  rawNormalizedAttribute,
  'aria-label="x&#x9;y\tz&#xA;q&#13;r&amp;"'
);

// Repeated identical siblings must align monotonically, while text/CDATA/text
// and comments on nested elements retain distinct source tokens.
const repeatedSource =
  `<svg xmlns="${SVG}"><g id="same"/><g id="same"/><g id="same"/>` +
  '<text>one<![CDATA[two]]>three<g><!--nested--></g><!--sibling--></text></svg>';
const repeated = parseSourceToXmlDocument(repeatedSource);
const repeatedChildren = repeated.document.root.children.slice(0, 3);
assert.deepEqual(
  repeatedChildren.map(node =>
    repeatedSource.slice(node.startTagSpan.start, node.startTagSpan.end)
  ),
  ['<g id="same"/>', '<g id="same"/>', '<g id="same"/>']
);
assert.equal(
  new Set(repeatedChildren.map(node => node.startTagSpan.start)).size,
  3
);
const textFixture = repeated.document.root.children[3];
assert.deepEqual(
  textFixture.children.map(node => node.kind),
  ['text', 'cdata', 'text', 'element', 'comment']
);
assert.deepEqual(
  textFixture.children
    .slice(0, 3)
    .map(node =>
      repeatedSource.slice(node.sourceSpan.start, node.sourceSpan.end)
    ),
  ['one', '<![CDATA[two]]>', 'three']
);
assert.equal(
  repeatedSource.slice(
    textFixture.children[3].children[0].sourceSpan.start,
    textFixture.children[3].children[0].sourceSpan.end
  ),
  '<!--nested-->'
);
assert.equal(
  repeatedSource.slice(
    textFixture.children[4].sourceSpan.start,
    textFixture.children[4].sourceSpan.end
  ),
  '<!--sibling-->'
);

// A legal noncanonical end tag is consumed for alignment but receives no span
// because the lowerer's qualified exact-token policy recognizes only </name>.
const noncanonicalEndSource = `<svg xmlns="${SVG}"><g></g ></svg>`;
const noncanonicalEnd = parseSourceToXmlDocument(noncanonicalEndSource);
assert.equal(noncanonicalEnd.document.root.children[0].endTagSpan, undefined);
assert.equal(
  noncanonicalEndSource.slice(
    noncanonicalEnd.document.root.children[0].startTagSpan.start,
    noncanonicalEnd.document.root.children[0].startTagSpan.end
  ),
  '<g>'
);

// Corrupt only the lexical adapter's token metadata to simulate parser/token
// disagreement. Provenance stops at that mismatch and is never promoted from
// a later coincidentally matching sibling.
const mismatchSource = `<svg xmlns="${SVG}"><g id="a"/><g id="b"/><g id="c"/></svg>`;
const mismatchParsed = parseSVGForQualification(mismatchSource);
const mismatchTokens = indexXMLSourceSpans(mismatchSource);
const mismatchStarts = mismatchTokens.filter(
  token => token.type === 'start-tag'
);
mismatchStarts[2].name = 'different-name';
const misaligned = adaptParsedSaxesDocument(
  mismatchSource,
  mismatchParsed,
  mismatchTokens
);
assert.ok(misaligned.document.root.startTagSpan);
assert.ok(misaligned.document.root.children[0].startTagSpan);
assert.equal(misaligned.document.root.children[1].startTagSpan, undefined);
assert.equal(misaligned.document.root.children[2].startTagSpan, undefined);
const misalignedIr = lowerXmlDocumentToIR(
  misaligned.source,
  misaligned.document,
  { sourceId: 'forced-token-mismatch' }
);
assert.equal(misalignedIr.root.children[0].provenance.kind, 'source');
assert.equal(misalignedIr.root.children[1].provenance.kind, 'unknown');
assert.equal(misalignedIr.root.children[2].provenance.kind, 'unknown');

const endMismatchSource = `<svg xmlns="${SVG}"><g></g></svg>`;
const endMismatchParsed = parseSVGForQualification(endMismatchSource);
const endMismatchTokens = indexXMLSourceSpans(endMismatchSource);
const childEnd = endMismatchTokens.find(
  token => token.type === 'end-tag' && token.raw === '</g>'
);
childEnd.raw = '</gibberish>';
const endMisaligned = adaptParsedSaxesDocument(
  endMismatchSource,
  endMismatchParsed,
  endMismatchTokens
);
assert.equal(endMisaligned.document.root.children[0].endTagSpan, undefined);
assert.equal(
  endMisaligned.document.root.endTagSpan,
  undefined,
  'a later parent end tag is not promoted after the child token mismatch'
);

// A damaged attribute lexical boundary cannot retain an otherwise matching
// QName's span or trivia span.
const attrMismatchSource = `<svg xmlns="${SVG}"><path id="verified"/></svg>`;
const attrMismatchParsed = parseSVGForQualification(attrMismatchSource);
const attrMismatchTokens = indexXMLSourceSpans(attrMismatchSource);
const pathToken = attrMismatchTokens.find(
  token => token.type === 'start-tag' && token.name === 'path'
);
pathToken.attributes[0].valueStart++;
const attrMismatch = adaptParsedSaxesDocument(
  attrMismatchSource,
  attrMismatchParsed,
  attrMismatchTokens
);
assert.equal(
  attrMismatch.document.root.children[0].attributes[0].sourceSpan,
  undefined
);
assert.equal(
  attrMismatch.document.root.children[0].attributes[0].leadingTriviaSpan,
  undefined
);

// Every known source-backed span is checked against the original UTF-16 slice.
function checkProvenance(node) {
  if (node.provenance?.kind === 'source') {
    const { startUtf16, endUtf16Exclusive, sourceSlice } = node.provenance.span;
    assert.equal(sourceText.slice(startUtf16, endUtf16Exclusive), sourceSlice);
  }
  for (const attribute of node.attributes ?? []) {
    if (attribute.provenance?.kind === 'source') {
      const span = attribute.provenance.span;
      assert.equal(
        sourceText.slice(span.startUtf16, span.endUtf16Exclusive),
        span.sourceSlice
      );
    }
  }
  for (const child of node.children ?? []) checkProvenance(child);
}
checkProvenance(ir.root);

// Copy/share modes produce semantically equal frozen IR; sharing is limited to
// verified immutable expanded names and does not alias mutable state.
const sharedRun = pipeline(sourceText, 'share-verified-immutable');
assert.deepEqual(
  JSON.parse(JSON.stringify(sharedRun.ir)),
  JSON.parse(JSON.stringify(ir)),
  'copy and verified-sharing modes produce equivalent serialized values'
);
assert.equal(sharedRun.ir.root.name, sharedRun.document.root.name);
assert.ok(Object.isFrozen(sharedRun.document));
assert.throws(
  () =>
    lowerXmlDocumentToIR(contractSource, document, {
      sourceId: 'mutable-share-rejected',
      ownership: 'share-verified-immutable',
    }),
  /deeply frozen/u
);
const defensiveCopy = pipeline(sourceText);
defensiveCopy.document.root.name.localName = 'mutated-after-publication';
assert.equal(defensiveCopy.ir.root.name.localName, 'svg');

// Parser/admission failure and lowering failure are atomic: neither returns a
// document or IR. Corrupt metadata only after the parser has returned it.
assert.throws(
  () => pipeline('<svg><g></svg>'),
  error => Boolean(error?.code)
);
const bad = parseSourceToXmlDocument(
  '<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>'
);
bad.document.root.startTagSpan.end = bad.source.text.length + 1;
assert.throws(
  () =>
    lowerXmlDocumentToIR(bad.source, bad.document, { sourceId: 'bad-span' }),
  /outside the retained source/u
);

// Repeated end-to-end parses demonstrate independent parser state. WeakRef
// observations are reported only: GC timing is not a pass/fail oracle.
function createWeakResult() {
  const result = pipeline(sourceText).ir;
  return new WeakRef(result);
}
async function combinedRetentionSample() {
  global.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const parsed = parseSourceToXmlDocument(sourceText);
  const heapWithXml = process.memoryUsage().heapUsed;
  const result = lowerXmlDocumentToIR(parsed.source, parsed.document, {
    sourceId: 'combined-retention-sample',
  });
  const heapWithIr = process.memoryUsage().heapUsed;
  return {
    xml: new WeakRef(parsed.document),
    ir: new WeakRef(result),
    heapBefore,
    heapWithXml,
    heapWithIr,
  };
}
const weakResult = createWeakResult();
const retention = await combinedRetentionSample();
const started = performance.now();
for (let index = 0; index < 30; index++) {
  const repeated = pipeline(sourceText);
  assert.equal(repeated.ir.analysis.accessibility.titles[0], 'A&😀B');
}
global.gc?.();
await new Promise(resolve => setImmediate(resolve));
global.gc?.();
console.log(
  JSON.stringify({
    phase3ParserToIr: 'saxes-contract-lowering',
    repeatedRuns: 30,
    elapsedMs: Number((performance.now() - started).toFixed(2)),
    gcExposed: typeof global.gc === 'function',
    weakResultReleased: weakResult.deref() === undefined,
    retention: {
      sourcePlusXmlHeapDelta: retention.heapWithXml - retention.heapBefore,
      sourcePlusXmlPlusIrHeapDelta: retention.heapWithIr - retention.heapBefore,
      xmlReleasedAfterScope: retention.xml.deref() === undefined,
      irReleasedAfterScope: retention.ir.deref() === undefined,
    },
    lifecycleMeasurementsAreInformational: true,
  })
);
console.log('Phase 03.2C parser-to-IR differential qualification passed.');
