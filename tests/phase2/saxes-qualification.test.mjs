import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { parseSVGForQualification } from '../../experiments/phase2/saxes-qualification-adapter.mjs';
import { indexXMLSourceSpans } from '../../experiments/phase2/xml-source-spans.mjs';
import {
  rejectedCorpus,
  safeCorpus,
} from '../phase0/svg-security-corpus.fixtures.mjs';
import { applySVGInputSafety } from '../../dist/security/input-safety.js';

function parseWithXmldom(source) {
  applySVGInputSafety(source, { unsafeInputPolicy: 'reject' });
  const errors = [];
  const parser = new DOMParser({
    onError: level => errors.push(level),
  });
  const document = parser.parseFromString(source, 'image/svg+xml');
  if (errors.some(level => level === 'error' || level === 'fatalError')) {
    throw new Error('E_XML_PARSE: Alternative parser rejected malformed XML.');
  }
  if (
    !document.documentElement ||
    document.documentElement.localName !== 'svg'
  ) {
    throw new Error(
      'E_XML_PARSE: Alternative parser produced no SVG document element.'
    );
  }
  return document;
}

const svg = `<?xml version="1.0"?>\r\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" z='last' a="first">
  <text xml:space="preserve"> before <tspan>middle &amp; <tspan>nested</tspan></tspan> after <![CDATA[<literal>]]></text>
  <title>&#x41;</title><style>.shape{fill:url(#paint)}</style>
  <!-- retained comment --><use xlink:href="#shape"/>
</svg>`;
const parsed = parseSVGForQualification(svg);
assert.equal(
  parsed.source,
  svg,
  'the original source is retained without serialization'
);
assert.equal(parsed.sourceLengthCodeUnits, svg.length);
assert.equal(parsed.root.localName, 'svg');
assert.equal(parsed.root.namespaceURI, 'http://www.w3.org/2000/svg');
assert.deepEqual(
  parsed.root.attributes.map(attribute => attribute.name),
  ['xmlns', 'xmlns:xlink', 'z', 'a'],
  'the observed SAX attribute event order is retained'
);
const text = parsed.root.children.find(node => node.type === 'element');
assert.equal(text.localName, 'text');
assert.equal(
  text.attributes.find(attribute => attribute.name === 'xml:space').value,
  'preserve'
);
assert.deepEqual(
  text.children.map(node => node.type),
  ['text', 'element', 'text', 'cdata'],
  'mixed text and CDATA remain distinct nodes'
);
assert.equal(text.children[0].value, ' before ');
assert.equal(text.children[2].value, ' after ');
assert.equal(text.children[3].value, '<literal>');
assert.ok(parsed.root.children.some(node => node.type === 'comment'));
assert.equal(
  parsed.root.children.find(
    node => node.type === 'element' && node.localName === 'title'
  ).children[0].value,
  'A'
);
assert.equal(
  parsed.root.children.find(
    node => node.type === 'element' && node.localName === 'style'
  ).children[0].value,
  '.shape{fill:url(#paint)}'
);
const use = parsed.root.children.find(
  node => node.type === 'element' && node.localName === 'use'
);
assert.equal(use.attributes[0].prefix, 'xlink');
assert.equal(use.attributes[0].localName, 'href');
assert.equal(use.attributes[0].namespaceURI, 'http://www.w3.org/1999/xlink');

// Differentially exercise the exact Phase 00 admission corpus. The candidate
// must never parse its way past a rejection from the authoritative boundary.
for (const [index, sample] of safeCorpus.entries()) {
  assert.doesNotThrow(
    () => parseSVGForQualification(sample),
    `accepted Phase 00 fixture ${index}`
  );
}
for (const [label, sample, expectedCode] of rejectedCorpus) {
  assert.throws(
    () => parseSVGForQualification(sample),
    error => error?.code === expectedCode,
    `rejected Phase 00 fixture ${label}`
  );
  assert.throws(
    () => parseWithXmldom(sample),
    error =>
      error?.code === expectedCode || error?.message.startsWith(expectedCode),
    `alternative parser security differential ${label}`
  );
}
for (const [index, sample] of safeCorpus.entries()) {
  assert.doesNotThrow(
    () => parseWithXmldom(sample),
    `alternative parser accepted Phase 00 fixture ${index}`
  );
}

const wrappedDocument = parseSVGForQualification(
  '<!--prolog--><svg/><!--epilog-->'
);
assert.equal(wrappedDocument.prolog[0].value, 'prolog');
assert.equal(wrappedDocument.epilog[0].value, 'epilog');

// Saxes cursor positions count UTF-16 code units in the original source; line
// and column are separate parser coordinates affected by XML newline folding.
const unicodeSource = '<svg>é😀\r\nA&amp;B</svg>';
const unicodeParsed = parseSVGForQualification(unicodeSource);
assert.equal(unicodeParsed.root.endLocation.offset, unicodeSource.length);
assert.equal(unicodeParsed.root.endLocation.line, 2);
assert.ok(unicodeParsed.root.endLocation.column < unicodeSource.length);
assert.equal(unicodeParsed.root.children[0].value, 'é😀\nA&B');

// Independent source-token indexing uses original string indexes, not SAX
// cursors or decoded-value lengths. Slices prove exact lexical preservation.
const spanSource = `<?xml version="1.0"?>\r\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink='http://www.w3.org/1999/xlink'  z = 'last' a="A&amp;😀">
  <text>é😀&#x41; &amp;Z<![CDATA[<literal>]]><!--note--></text>
  <use xlink:href = '#shape'/>
</svg>`;
const spans = indexXMLSourceSpans(spanSource);
const startTags = spans.filter(token => token.type === 'start-tag');
const spanAttrs = startTags[0].attributes;
assert.equal(
  spanSource.slice(startTags[0].start, startTags[0].end),
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink=\'http://www.w3.org/1999/xlink\'  z = \'last\' a="A&amp;😀">'
);
assert.deepEqual(
  spanAttrs.map(attribute => attribute.name),
  ['xmlns', 'xmlns:xlink', 'z', 'a']
);
assert.equal(
  spanSource.slice(spanAttrs[2].leadingStart, spanAttrs[2].end),
  "  z = 'last'"
);
assert.equal(spanAttrs[2].quote, "'");
assert.equal(
  spanSource.slice(spanAttrs[3].valueStart, spanAttrs[3].valueEnd),
  'A&amp;😀'
);
const entitySpans = spans.filter(token => token.type === 'entity-reference');
assert.deepEqual(
  entitySpans.map(token => token.raw),
  ['&amp;', '&#x41;', '&amp;']
);
const cdataSpan = spans.find(token => token.type === 'cdata');
assert.equal(
  spanSource.slice(cdataSpan.start, cdataSpan.end),
  '<![CDATA[<literal>]]>'
);
assert.equal(
  spanSource.slice(cdataSpan.contentStart, cdataSpan.contentEnd),
  '<literal>'
);
const commentSpan = spans.find(token => token.type === 'comment');
assert.equal(
  spanSource.slice(commentSpan.start, commentSpan.end),
  '<!--note-->'
);
const crlfText = spans.find(
  token => token.type === 'text' && token.raw.includes('\r\n')
);
const lfText = spans.find(
  token =>
    token.type === 'text' &&
    token.raw.includes('\n') &&
    !token.raw.includes('\r\n')
);
assert.equal(spanSource.slice(crlfText.start, crlfText.end), crlfText.raw);
assert.equal(spanSource.slice(lfText.start, lfText.end), lfText.raw);
const endTags = spans.filter(token => token.type === 'end-tag');
assert.ok(endTags.some(token => token.raw === '</text>'));
assert.ok(endTags.some(token => token.raw === '</svg>'));
const afterUnicode = spanSource.indexOf('é😀') + 'é😀'.length;
assert.ok(afterUnicode < Buffer.byteLength(spanSource.slice(0, afterUnicode)));
const spanParsed = parseSVGForQualification(spanSource);
const flattenElements = node => [
  ...(node.type === 'element' ? [node] : []),
  ...(node.children ?? []).flatMap(flattenElements),
];
const spanElements = flattenElements(spanParsed.root);
const spanElementTokens = spans.filter(token => token.type === 'start-tag');
assert.deepEqual(
  spanElements.map(node => node.name),
  spanElementTokens.map(token => token.name),
  'the independent lexical start-tag sequence aligns with qualified parser names'
);
const spanUse = spanParsed.root.children.find(
  node => node.type === 'element' && node.localName === 'use'
);
assert.equal(spanUse.name, 'use');
assert.equal(spanUse.namespaceURI, 'http://www.w3.org/2000/svg');
assert.equal(spanUse.attributes[0].name, 'xlink:href');
assert.equal(
  spanUse.attributes[0].namespaceURI,
  'http://www.w3.org/1999/xlink'
);
const xmldomSpanDoc = parseWithXmldom(spanSource);
assert.equal(
  xmldomSpanDoc.documentElement.namespaceURI,
  'http://www.w3.org/2000/svg'
);
const xmldomUse = xmldomSpanDoc.getElementsByTagName('use')[0];
assert.equal(xmldomUse.namespaceURI, 'http://www.w3.org/2000/svg');
assert.equal(
  xmldomUse.getAttributeNode('xlink:href').namespaceURI,
  'http://www.w3.org/1999/xlink'
);
assert.equal(
  xmldomSpanDoc.getElementsByTagName('text')[0].textContent,
  'é😀A &Z<literal>'
);

function assertParseFailure(source, expectedCode) {
  assert.throws(
    () => parseSVGForQualification(source),
    error =>
      error?.code === expectedCode && !/secret|payload/iu.test(error.message)
  );
}

for (const malformed of [
  '<svg><g></svg>',
  '<svg viewBox=0/>',
  '<svg><path a="1"b="2"/></svg>',
  '<svg>\u0001</svg>',
  '<svg><g></svg>',
]) {
  assertParseFailure(malformed, 'E_INVALID_SVG_XML');
}

// The security boundary rejects DTD/entity declarations before parser creation.
assertParseFailure(
  '<!DOCTYPE svg [<!ENTITY secret "payload">]><svg>&secret;</svg>',
  'E_UNSAFE_SVG_CONTENT'
);
assertParseFailure(
  '<svg><script>payload</script></svg>',
  'E_UNSAFE_SVG_CONTENT'
);
assertParseFailure(
  '<svg><image href="https://example.invalid/a.svg"/></svg>',
  'E_UNSAFE_SVG_CONTENT'
);
assertParseFailure(
  '<svg><path onclick="payload"/></svg>',
  'E_UNSAFE_SVG_CONTENT'
);
// The established boundary currently rejects non-declaration processing
// instructions, so the adapter must not parse them even though saxes supports PI events.
assertParseFailure('<?svger sample?><svg/>', 'E_UNSUPPORTED_SVG_ENCODING');
assertParseFailure(
  '<?xml version="1.0" encoding="UTF-16"?><svg/>',
  'E_UNSUPPORTED_SVG_ENCODING'
);
assertParseFailure('<?xml version="1.1"?><svg/>', 'E_UNSUPPORTED_SVG_ENCODING');
assertParseFailure('<svg><x:node/></svg>', 'E_INVALID_SVG_XML');
assertParseFailure('<svg xmlns:p=""><p:node/></svg>', 'E_INVALID_SVG_XML');

assert.throws(
  () => parseSVGForQualification('<svg/>', { maxInputSizeBytes: 3 }),
  error => error?.code === 'E_SVG_INPUT_TOO_LARGE'
);
const multibyteInput = '<svg>😀</svg>';
const multibyteInputBytes = Buffer.byteLength(multibyteInput, 'utf8');
assert.doesNotThrow(() =>
  parseSVGForQualification(multibyteInput, {
    maxInputSizeBytes: multibyteInputBytes,
  })
);
assert.throws(
  () =>
    parseSVGForQualification(multibyteInput, {
      maxInputSizeBytes: multibyteInputBytes - 1,
    }),
  error => error?.code === 'E_SVG_INPUT_TOO_LARGE'
);
assert.throws(
  () => parseSVGForQualification('<svg><g><path/></g></svg>', { maxDepth: 2 }),
  error => error?.code === 'E_SVG_XML_LIMIT'
);
assert.throws(
  () =>
    parseSVGForQualification('<svg><path/><path/></svg>', { maxElements: 2 }),
  error => error?.code === 'E_SVG_XML_LIMIT'
);
assert.throws(
  () =>
    parseSVGForQualification('<svg a="1" b="2"/>', {
      maxAttributesPerElement: 1,
    }),
  error => error?.code === 'E_SVG_XML_LIMIT'
);
assert.throws(
  () =>
    parseSVGForQualification('<svg a="1" b="2"/>', { maxTotalAttributes: 1 }),
  error => error?.code === 'E_SVG_XML_LIMIT'
);
assert.throws(
  () => parseSVGForQualification('<svg>é😀</svg>', { maxTextSizeBytes: 5 }),
  error => error?.code === 'E_SVG_XML_LIMIT'
);
assert.doesNotThrow(() =>
  parseSVGForQualification('<svg>😀</svg>', { maxTextSizeBytes: 4 })
);
assert.throws(
  () => parseSVGForQualification('<svg>😀</svg>', { maxTextSizeBytes: 3 }),
  error => error?.code === 'E_SVG_XML_LIMIT'
);
assert.doesNotThrow(() =>
  parseSVGForQualification('<svg><g/></svg>', { maxDepth: 2, maxElements: 2 })
);
assert.doesNotThrow(() =>
  parseSVGForQualification('<svg a="1"/>', {
    maxAttributesPerElement: 1,
    maxTotalAttributes: 1,
  })
);

// A rejected parse returns no AST. Repeating malformed input yields stable,
// sanitized diagnostics without preserving attacker-provided excerpts.
const malformed = '<svg><title>secret payload</svg>';
const failures = Array.from({ length: 20 }, () => {
  try {
    parseSVGForQualification(malformed);
  } catch (error) {
    return {
      code: error.code,
      message: error.message,
      location: error.location,
    };
  }
  assert.fail('malformed XML unexpectedly parsed');
});
assert.ok(
  failures.every(
    failure => JSON.stringify(failure) === JSON.stringify(failures[0])
  )
);
assert.doesNotMatch(failures[0].message, /secret|payload/u);
const parserMalformed = '<svg>]]></svg>';
const parserFailures = Array.from({ length: 20 }, () => {
  try {
    parseSVGForQualification(parserMalformed);
  } catch (error) {
    return {
      code: error.code,
      message: error.message,
      location: error.location,
    };
  }
  assert.fail('malformed XML unexpectedly parsed');
});
assert.equal(parserFailures[0].code, 'E_XML_PARSE');
assert.ok(
  parserFailures.every(
    failure => JSON.stringify(failure) === JSON.stringify(parserFailures[0])
  )
);

process.stdout.write(
  'Isolated parser security and fidelity qualification passed (Saxes + xmldom reference).\n'
);
