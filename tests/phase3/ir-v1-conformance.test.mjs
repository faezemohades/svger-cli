import assert from 'node:assert/strict';
import { applySVGInputSafety } from '../../dist/security/input-safety.js';
import {
  rejectedCorpus,
  safeCorpus,
} from '../phase0/svg-security-corpus.fixtures.mjs';
import {
  IR_VERSION,
  SVG_NAMESPACE,
  XML_NAMESPACE,
  validateAndFreezeIR,
} from '../../dist/phase3-prototype/ir-v1.js';

const reject = value => ({ state: 'unresolved', reason: value });
const resolved = (value, interpreter) => ({
  state: 'resolved',
  value,
  interpreter,
});

function fixtureSource(text, id = 'semantic-fixture') {
  // This is the only fixture input adapter: the existing admission boundary
  // must accept the exact bytes before a controlled structure can be built.
  const admittedText = applySVGInputSafety(text, {
    unsafeInputPolicy: 'reject',
  });
  assert.equal(
    admittedText,
    text,
    'reject-mode fixture admission must not rewrite source'
  );
  return {
    id,
    text: admittedText,
    utf8ByteLength: Buffer.byteLength(admittedText, 'utf8'),
    admissionPolicy: 'svg-input-safety-v1',
  };
}

function spans(source) {
  return (needle, occurrence = 0) => {
    let start = -1;
    let from = 0;
    for (let index = 0; index <= occurrence; index++) {
      start = source.indexOf(needle, from);
      assert.notEqual(start, -1, `fixture span token exists: ${needle}`);
      from = start + needle.length;
    }
    return {
      startUtf16: start,
      endUtf16Exclusive: start + needle.length,
      unit: 'utf16-code-unit',
      sourceSlice: source.slice(start, start + needle.length),
    };
  };
}

function sourceOrigin(spanFor) {
  return needle => ({ kind: 'source', span: spanFor(needle) });
}

const sourceText =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="24" viewBox="0 0 24 24" role="img" aria-labelledby="label" xml:space="preserve"><title id="label">Logo &amp; <tspan>mark</tspan></title><text xml:space="default"> A<![CDATA[ B ]]><tspan> C </tspan></text><svger-widget data-opaque="keep">opaque</svger-widget><g id="same"/><g id="same"/><use xlink:href="#missing"/><style>.x { fill: red; --theme: var(--brand) !important; }</style></svg>';

function buildSemanticFixture(text = sourceText, id = 'semantic-fixture') {
  const source = fixtureSource(text, id);
  const at = spans(source.text);
  const origin = sourceOrigin(at);
  const attr = (
    qualifiedName,
    prefix,
    localName,
    namespaceUri,
    value,
    token,
    interpretation = 'known-property'
  ) => ({
    name: { qualifiedName, prefix, localName, namespaceUri },
    value,
    provenance: origin(token),
    interpretation,
  });
  const element = (
    qualifiedName,
    prefix,
    localName,
    namespaceUri,
    interpretation,
    token,
    attributes = [],
    children = [],
    xmlSpace = reject('no explicit or inherited interpretation')
  ) => ({
    kind: 'element',
    name: { qualifiedName, prefix, localName, namespaceUri },
    interpretation,
    provenance: origin(token),
    attributes,
    children,
    xmlSpace,
  });
  const makeText = (kind, value, token) => ({
    kind,
    value,
    provenance: origin(token),
  });
  const rootAttributes = [
    attr(
      'xmlns',
      null,
      'xmlns',
      'http://www.w3.org/2000/xmlns/',
      SVG_NAMESPACE,
      'xmlns="http://www.w3.org/2000/svg"',
      'opaque-property'
    ),
    attr(
      'xmlns:xlink',
      'xmlns',
      'xlink',
      'http://www.w3.org/2000/xmlns/',
      'http://www.w3.org/1999/xlink',
      'xmlns:xlink="http://www.w3.org/1999/xlink"',
      'opaque-property'
    ),
    attr('width', null, 'width', null, '100%', 'width="100%"'),
    attr('height', null, 'height', null, '24', 'height="24"'),
    attr('viewBox', null, 'viewBox', null, '0 0 24 24', 'viewBox="0 0 24 24"'),
    attr('role', null, 'role', null, 'img', 'role="img"'),
    attr(
      'aria-labelledby',
      null,
      'aria-labelledby',
      null,
      'label',
      'aria-labelledby="label"'
    ),
    attr(
      'xml:space',
      'xml',
      'space',
      XML_NAMESPACE,
      'preserve',
      'xml:space="preserve"'
    ),
  ];
  const title = element(
    'title',
    null,
    'title',
    SVG_NAMESPACE,
    'known-svg',
    '<title id="label">',
    [attr('id', null, 'id', null, 'label', 'id="label"')],
    [
      makeText('text', 'Logo & ', 'Logo &amp; '),
      element(
        'tspan',
        null,
        'tspan',
        SVG_NAMESPACE,
        'known-svg',
        '<tspan>mark</tspan>',
        [],
        [makeText('text', 'mark', 'mark')],
        resolved('preserve', 'fixture-xml-space-v1')
      ),
    ],
    resolved('preserve', 'fixture-xml-space-v1')
  );
  const textNode = element(
    'text',
    null,
    'text',
    SVG_NAMESPACE,
    'known-svg',
    '<text xml:space="default">',
    [
      attr(
        'xml:space',
        'xml',
        'space',
        XML_NAMESPACE,
        'default',
        'xml:space="default"'
      ),
    ],
    [
      makeText('text', ' A', '> A'),
      makeText('cdata', ' B ', '<![CDATA[ B ]]>'),
      element(
        'tspan',
        null,
        'tspan',
        SVG_NAMESPACE,
        'known-svg',
        '<tspan> C </tspan>',
        [],
        [makeText('text', ' C ', ' C ')],
        reject('inherits default from parent')
      ),
    ],
    resolved('default', 'fixture-xml-space-v1')
  );
  const extension = element(
    'svger-widget',
    null,
    'svger-widget',
    SVG_NAMESPACE,
    'unknown-svg',
    '<svger-widget data-opaque="keep">opaque</svger-widget>',
    [
      attr(
        'data-opaque',
        null,
        'data-opaque',
        null,
        'keep',
        'data-opaque="keep"',
        'opaque-property'
      ),
    ],
    [makeText('text', 'opaque', 'opaque')],
    reject('foreign content is opaque')
  );
  const duplicate1 = element(
    'g',
    null,
    'g',
    SVG_NAMESPACE,
    'known-svg',
    '<g id="same"/>',
    [attr('id', null, 'id', null, 'same', 'id="same"')]
  );
  const duplicate2 = element(
    'g',
    null,
    'g',
    SVG_NAMESPACE,
    'known-svg',
    '<g id="same"/>',
    [attr('id', null, 'id', null, 'same', 'id="same"', 'known-property')]
  );
  // Give the duplicate occurrence its own distinct source span.
  duplicate2.provenance = origin('<g id="same"/>', 1);
  duplicate2.attributes[0].provenance = origin('id="same"', 1);
  const use = element(
    'use',
    null,
    'use',
    SVG_NAMESPACE,
    'known-svg',
    '<use xlink:href="#missing"/>',
    [
      attr(
        'xlink:href',
        'xlink',
        'href',
        'http://www.w3.org/1999/xlink',
        '#missing',
        'xlink:href="#missing"'
      ),
    ]
  );
  const style = element(
    'style',
    null,
    'style',
    SVG_NAMESPACE,
    'known-svg',
    '<style>.x { fill: red; --theme: var(--brand) !important; }</style>',
    [],
    [
      makeText(
        'text',
        '.x { fill: red; --theme: var(--brand) !important; }',
        '.x { fill: red; --theme: var(--brand) !important; }'
      ),
    ]
  );
  const root = element(
    'svg',
    null,
    'svg',
    SVG_NAMESPACE,
    'known-svg',
    '<svg xmlns=',
    rootAttributes,
    [title, textNode, extension, duplicate1, duplicate2, use, style],
    resolved('preserve', 'fixture-xml-space-v1')
  );
  return {
    version: IR_VERSION,
    source,
    root,
    analysis: {
      rootGeometry: {
        width: resolved(
          { lexical: '100%', unit: '%' },
          'fixture-svg-geometry-v1'
        ),
        height: resolved(
          { lexical: '24', unit: null },
          'fixture-svg-geometry-v1'
        ),
        viewBox: resolved([0, 0, 24, 24], 'fixture-svg-geometry-v1'),
      },
      ids: {
        coverage: 'partial',
        definitions: [
          { id: 'label', nodePath: '/svg/title' },
          { id: 'same', nodePath: '/svg/g[1]' },
          { id: 'same', nodePath: '/svg/g[2]' },
        ],
      },
      references: {
        coverage: 'partial',
        occurrences: [
          { state: 'resolved', target: 'label' },
          {
            state: 'ambiguous',
            target: 'same',
            candidates: ['/svg/g[1]', '/svg/g[2]'],
          },
          { state: 'unresolved', target: 'missing' },
          {
            state: 'opaque-reference',
            reason: 'foreign extension reference grammar not analyzed',
          },
        ],
      },
      css: {
        coverage: 'declarations-parsed',
        declarations: [
          {
            property: 'fill',
            value: 'red',
            important: false,
            order: 0,
            provenance: origin('fill: red;'),
            interpretation: resolved('red', 'fixture-css-declarations-v1'),
          },
          {
            property: '--theme',
            value: 'var(--brand)',
            important: true,
            order: 1,
            provenance: origin('--theme: var(--brand) !important;'),
            interpretation: {
              state: 'opaque',
              reason: 'custom property resolution is out of scope',
              original: 'var(--brand)',
            },
          },
        ],
      },
      accessibility: {
        titles: ['Logo & mark'],
        descriptions: [],
        coverage: 'preserved',
      },
    },
  };
}

const fixture = buildSemanticFixture();
const published = validateAndFreezeIR(fixture);
assert.equal(published.version, 'svger-ir-v1');
assert.ok(
  Object.isFrozen(published) && Object.isFrozen(published.root.children)
);
assert.equal(published.root.children[0].children[0].value, 'Logo & ');
assert.equal(published.root.children[1].children[1].kind, 'cdata');
assert.equal(published.root.children[1].xmlSpace.value, 'default');
assert.equal(published.root.children[0].xmlSpace.value, 'preserve');
assert.equal(published.root.children[0].children[1].xmlSpace.value, 'preserve');
assert.equal(published.root.children[2].interpretation, 'unknown-svg');
assert.deepEqual(
  published.root.attributes.slice(0, 3).map(value => value.name.qualifiedName),
  ['xmlns', 'xmlns:xlink', 'width']
);
assert.equal(
  published.root.children[5].attributes[0].name.namespaceUri,
  'http://www.w3.org/1999/xlink'
);
assert.equal(
  published.analysis.ids.definitions.filter(value => value.id === 'same')
    .length,
  2
);
assert.equal(published.analysis.references.occurrences[1].state, 'ambiguous');
assert.equal(published.analysis.references.occurrences[2].state, 'unresolved');
assert.equal(published.analysis.css.declarations[1].important, true);
assert.equal(published.analysis.rootGeometry.width.value.unit, '%');
assert.deepEqual(published.analysis.accessibility.titles, ['Logo & mark']);
assert.equal(fixture.root.children[0].children[0].value, 'Logo & ');
assert.throws(() => {
  published.root.children.push({});
}, TypeError);
fixture.root.children[0].children[0].value = 'mutated after publication';
assert.equal(published.root.children[0].children[0].value, 'Logo & ');
assert.equal(
  JSON.stringify(validateAndFreezeIR(buildSemanticFixture())),
  JSON.stringify(validateAndFreezeIR(buildSemanticFixture()))
);

assert.throws(
  () => fixtureSource('<svg><script>unsafe()</script></svg>'),
  error => error?.code === 'E_UNSAFE_SVG_CONTENT',
  'unsafe source must be rejected by the existing admission boundary'
);
for (const [index, sample] of safeCorpus.entries()) {
  assert.equal(
    fixtureSource(sample, `phase0-safe-${index}`).text,
    sample,
    `Phase 00 safe fixture ${index} retains established admission`
  );
}
for (const [label, sample, code] of rejectedCorpus) {
  assert.throws(
    () => fixtureSource(sample, `phase0-rejected-${label}`),
    error => error?.code === code,
    `Phase 00 rejection remains unchanged: ${label}`
  );
}
const brokenSpan = buildSemanticFixture();
brokenSpan.root.children[0].provenance.span.sourceSlice = 'not the source';
assert.throws(() => validateAndFreezeIR(brokenSpan), /exact source slice/u);
const badVersion = buildSemanticFixture();
badVersion.version = 'svger-ir-v2';
assert.throws(() => validateAndFreezeIR(badVersion), /unsupported IR version/u);
const cyclic = buildSemanticFixture();
cyclic.root.children.push(cyclic.root);
assert.throws(
  () => validateAndFreezeIR(cyclic),
  /cycle or shared mutable object/u
);

// A synthetic admitted structural fixture characterizes combined retention of
// source, its controlled syntax-like structure, and the defensively cloned IR.
if (typeof global.gc === 'function') {
  global.gc();
  const heapBefore = process.memoryUsage().heapUsed;
  const count = 1_200;
  let text = '<svg xmlns="http://www.w3.org/2000/svg">';
  const children = [];
  for (let index = 0; index < count; index++) {
    const token = `<g data-i="${index}"/>`;
    const start = text.length;
    text += token;
    const span = {
      startUtf16: start,
      endUtf16Exclusive: start + token.length,
      unit: 'utf16-code-unit',
      sourceSlice: token,
    };
    children.push({
      kind: 'element',
      name: {
        namespaceUri: SVG_NAMESPACE,
        localName: 'g',
        qualifiedName: 'g',
        prefix: null,
      },
      interpretation: 'known-svg',
      provenance: { kind: 'source', span },
      attributes: [
        {
          name: {
            namespaceUri: null,
            localName: 'data-i',
            qualifiedName: 'data-i',
            prefix: null,
          },
          value: String(index),
          provenance: { kind: 'source', span: { ...span, sourceSlice: token } },
          interpretation: 'opaque-property',
        },
      ],
      children: [],
      xmlSpace: reject('not interpreted in memory fixture'),
    });
  }
  text += '</svg>';
  // Supply exact full-token spans for fixture nodes and attribute token spans.
  for (let index = 0; index < children.length; index++) {
    const token = `<g data-i="${index}"/>`;
    const start = text.indexOf(token);
    const fullSpan = {
      startUtf16: start,
      endUtf16Exclusive: start + token.length,
      unit: 'utf16-code-unit',
      sourceSlice: token,
    };
    children[index].provenance = { kind: 'source', span: fullSpan };
    const attrToken = `data-i="${index}"`;
    const attrStart = text.indexOf(attrToken, start);
    children[index].attributes[0].provenance = {
      kind: 'source',
      span: {
        startUtf16: attrStart,
        endUtf16Exclusive: attrStart + attrToken.length,
        unit: 'utf16-code-unit',
        sourceSlice: attrToken,
      },
    };
  }
  const admitted = fixtureSource(text, 'memory-characterization');
  const rootToken = '<svg xmlns="http://www.w3.org/2000/svg">';
  const rootStart = 0;
  const root = {
    kind: 'element',
    name: {
      namespaceUri: SVG_NAMESPACE,
      localName: 'svg',
      qualifiedName: 'svg',
      prefix: null,
    },
    interpretation: 'known-svg',
    provenance: {
      kind: 'source',
      span: {
        startUtf16: rootStart,
        endUtf16Exclusive: rootToken.length,
        unit: 'utf16-code-unit',
        sourceSlice: rootToken,
      },
    },
    attributes: [
      {
        name: {
          namespaceUri: 'http://www.w3.org/2000/xmlns/',
          localName: 'xmlns',
          qualifiedName: 'xmlns',
          prefix: null,
        },
        value: SVG_NAMESPACE,
        provenance: {
          kind: 'source',
          span: {
            startUtf16: 5,
            endUtf16Exclusive: rootToken.length - 1,
            unit: 'utf16-code-unit',
            sourceSlice: rootToken.slice(5, -1),
          },
        },
        interpretation: 'opaque-property',
      },
    ],
    children,
    xmlSpace: reject('not interpreted in memory fixture'),
  };
  const memoryIR = validateAndFreezeIR({
    version: IR_VERSION,
    source: admitted,
    root,
    analysis: {
      rootGeometry: {
        width: reject('absent'),
        height: reject('absent'),
        viewBox: reject('absent'),
      },
      ids: { coverage: 'not-built', definitions: [] },
      references: { coverage: 'not-built', occurrences: [] },
      css: { coverage: 'lexically-retained', declarations: [] },
      accessibility: { titles: [], descriptions: [], coverage: 'not-built' },
    },
  });
  global.gc();
  console.log(
    JSON.stringify({
      phase3Memory: 'combined-source-structure-ir',
      elements: count + 1,
      sourceUtf8Bytes: admitted.utf8ByteLength,
      retainedHeapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
      gcExposed: true,
      outputRetained: memoryIR.root.children.length,
    })
  );
}

console.log('Phase 03.2A IR v1 conformance fixtures passed.');
