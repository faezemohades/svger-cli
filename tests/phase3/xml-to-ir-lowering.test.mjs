import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { applySVGInputSafety } from '../../dist/security/input-safety.js';
import {
  IR_VERSION,
  SVG_NAMESPACE,
  XML_NAMESPACE,
  validateAndFreezeIR,
} from '../../experiments/phase3/.build/phase3/ir-v1.js';
import {
  buildSemanticSidecars,
  lowerXmlDocumentToIR,
  lowerXmlStructure,
} from '../../experiments/phase3/.build/phase3/lower-xml-to-ir.js';

const XMLNS = 'http://www.w3.org/2000/xmlns/';
const XLINK = 'http://www.w3.org/1999/xlink';
const sourceText =
  '<!--lead--><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" xml:space="preserve" role="img" aria-labelledby="label"><title id="label">A&amp;😀<tspan>B</tspan></title><text xml:space="default"> X<![CDATA[Y]]><!--inside--><tspan>Z</tspan></text><g id="dup"/><g id="dup"/><use xlink:href="#dup"/><use href="#missing"/><path style="fill:red;--x:var(--y)"/><widget proprietary="keep">Q</widget></svg><!--tail-->';

function spanFor(text) {
  return (raw, occurrence = 0) => {
    let start = -1;
    let from = 0;
    for (let index = 0; index <= occurrence; index++) {
      start = text.indexOf(raw, from);
      assert.notEqual(start, -1, `span token exists: ${raw}`);
      from = start + raw.length;
    }
    return { start, end: start + raw.length, unit: 'utf16-code-unit' };
  };
}

function makeInput(text = sourceText, options = {}) {
  const admitted = applySVGInputSafety(text, { unsafeInputPolicy: 'reject' });
  assert.equal(
    admitted,
    text,
    'fixture admission must be unchanged in reject mode'
  );
  const at = spanFor(text);
  const xmlName = (
    qualifiedName,
    localName,
    namespaceUri = SVG_NAMESPACE,
    prefix = null
  ) => ({
    qualifiedName,
    prefix,
    localName,
    namespaceUri,
  });
  const attr = (
    qualifiedName,
    localName,
    namespaceUri,
    prefix,
    value,
    raw,
    occurrence = 0
  ) => ({
    kind: 'attribute',
    name: xmlName(qualifiedName, localName, namespaceUri, prefix),
    value,
    sourceSpan: at(raw, occurrence),
  });
  const elem = (
    qualifiedName,
    localName,
    rawOpen,
    rawClose,
    attributes = [],
    children = [],
    occurrence = 0,
    endOccurrence = occurrence
  ) => ({
    kind: 'element',
    name: xmlName(qualifiedName, localName),
    attributes,
    children,
    startTagSpan: at(rawOpen, occurrence),
    ...(rawClose ? { endTagSpan: at(rawClose, endOccurrence) } : {}),
  });
  const xmlText = (kind, value, raw, occurrence = 0) => ({
    kind,
    value,
    sourceSpan: at(raw, occurrence),
    ...(kind === 'cdata' ? { contentSpan: at(value, occurrence) } : {}),
  });
  const comment = raw => ({
    kind: 'comment',
    value: raw.slice(4, -3),
    sourceSpan: at(raw),
  });

  const rootOpen =
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" xml:space="preserve" role="img" aria-labelledby="label">';
  const title = elem(
    'title',
    'title',
    '<title id="label">',
    '</title>',
    [attr('id', 'id', null, null, 'label', 'id="label"')],
    [
      xmlText('text', 'A&😀', 'A&amp;😀'),
      elem(
        'tspan',
        'tspan',
        '<tspan>',
        '</tspan>',
        [],
        [xmlText('text', 'B', 'B')]
      ),
    ]
  );
  const textElement = elem(
    'text',
    'text',
    '<text xml:space="default">',
    '</text>',
    [
      attr(
        'xml:space',
        'space',
        XML_NAMESPACE,
        'xml',
        'default',
        'xml:space="default"'
      ),
    ],
    [
      xmlText('text', ' X', ' X'),
      xmlText('cdata', 'Y', '<![CDATA[Y]]>'),
      comment('<!--inside-->'),
      elem(
        'tspan',
        'tspan',
        '<tspan>',
        '</tspan>',
        [],
        [xmlText('text', 'Z', 'Z')],
        1
      ),
    ]
  );
  const duplicate = occurrence =>
    elem(
      'g',
      'g',
      '<g id="dup"/>',
      null,
      [attr('id', 'id', null, null, 'dup', 'id="dup"', occurrence)],
      [],
      occurrence
    );
  const root = elem(
    'svg',
    'svg',
    rootOpen,
    '</svg>',
    [
      attr(
        'xmlns',
        'xmlns',
        XMLNS,
        null,
        SVG_NAMESPACE,
        'xmlns="http://www.w3.org/2000/svg"'
      ),
      attr(
        'xmlns:xlink',
        'xlink',
        XMLNS,
        'xmlns',
        XLINK,
        'xmlns:xlink="http://www.w3.org/1999/xlink"'
      ),
      attr('width', 'width', null, null, '100%', 'width="100%"'),
      attr(
        'viewBox',
        'viewBox',
        null,
        null,
        '0 0 24 24',
        'viewBox="0 0 24 24"'
      ),
      attr(
        'xml:space',
        'space',
        XML_NAMESPACE,
        'xml',
        'preserve',
        'xml:space="preserve"'
      ),
      attr('role', 'role', null, null, 'img', 'role="img"'),
      attr(
        'aria-labelledby',
        'aria-labelledby',
        null,
        null,
        'label',
        'aria-labelledby="label"'
      ),
    ],
    [
      title,
      textElement,
      duplicate(0),
      duplicate(1),
      elem('use', 'use', '<use xlink:href="#dup"/>', null, [
        attr('xlink:href', 'href', XLINK, 'xlink', '#dup', 'xlink:href="#dup"'),
      ]),
      elem('use', 'use', '<use href="#missing"/>', null, [
        attr('href', 'href', null, null, '#missing', 'href="#missing"'),
      ]),
      elem('path', 'path', '<path style="fill:red;--x:var(--y)"/>', null, [
        attr(
          'style',
          'style',
          null,
          null,
          'fill:red;--x:var(--y)',
          'style="fill:red;--x:var(--y)"'
        ),
      ]),
      elem(
        'widget',
        'widget',
        '<widget proprietary="keep">',
        '</widget>',
        [
          attr(
            'proprietary',
            'proprietary',
            null,
            null,
            'keep',
            'proprietary="keep"'
          ),
        ],
        [xmlText('text', 'Q', 'Q')]
      ),
    ]
  );
  const source = {
    text: admitted,
    encoding: 'utf-8',
    offsetUnit: 'utf16-code-unit',
    utf8ByteLength: Buffer.byteLength(admitted, 'utf8'),
  };
  const document = {
    kind: 'document',
    prolog: [comment('<!--lead-->')],
    root,
    epilog: [comment('<!--tail-->')],
  };
  if (options.shareName) {
    const shared = root.children[2].name;
    root.children[3].name = shared;
  }
  return { source, document };
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value))
    return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

const { source, document } = makeInput();
const lowered = lowerXmlDocumentToIR(source, document, {
  sourceId: 'contract-fixture',
});
assert.equal(lowered.root.children.length, 8);
assert.deepEqual(
  lowered.prolog.map(node => node.value),
  ['lead']
);
assert.deepEqual(
  lowered.epilog.map(node => node.value),
  ['tail']
);
assert.equal(lowered.root.children[0].children[0].value, 'A&😀');
assert.equal(lowered.root.children[0].children[1].children[0].value, 'B');
assert.equal(lowered.root.children[1].children[1].kind, 'cdata');
assert.equal(lowered.root.children[1].children[2].kind, 'comment');
assert.deepEqual(
  lowered.root.attributes.map(attribute => attribute.name.qualifiedName),
  [
    'xmlns',
    'xmlns:xlink',
    'width',
    'viewBox',
    'xml:space',
    'role',
    'aria-labelledby',
  ]
);
assert.equal(lowered.root.attributes[1].name.namespaceUri, XMLNS);
assert.equal(lowered.root.children[4].attributes[0].name.namespaceUri, XLINK);
assert.equal(lowered.root.children[7].interpretation, 'unknown-svg');
assert.equal(
  lowered.root.children[7].attributes[0].interpretation,
  'opaque-property'
);
assert.equal(lowered.root.xmlSpace.state, 'resolved');
assert.equal(lowered.root.xmlSpace.evidence, 'authored');
assert.equal(lowered.root.children[0].xmlSpace.value, 'preserve');
assert.equal(lowered.root.children[0].xmlSpace.evidence, 'inferred');
assert.equal(lowered.root.children[1].xmlSpace.value, 'default');
assert.equal(lowered.root.children[1].xmlSpace.evidence, 'authored');
assert.equal(
  lowered.root.children[1].children[3].xmlSpace.evidence,
  'inferred'
);
assert.deepEqual(
  lowered.root.provenance.span.sourceSlice,
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" xml:space="preserve" role="img" aria-labelledby="label">'
);
assert.equal(
  lowered.root.children[0].children[0].provenance.span.sourceSlice,
  'A&amp;😀'
);
assert.notEqual(
  lowered.root.children[0].children[0].provenance.span.endUtf16Exclusive -
    lowered.root.children[0].children[0].provenance.span.startUtf16,
  Buffer.byteLength('A&amp;😀', 'utf8')
);
assert.equal(
  lowered.root.children[1].children[1].provenance.span.sourceSlice,
  '<![CDATA[Y]]>'
);
assert.equal(lowered.analysis.rootGeometry.width.state, 'opaque');
assert.equal(lowered.analysis.rootGeometry.width.evidence, 'authored');
assert.equal(lowered.analysis.rootGeometry.height.state, 'unresolved');
assert.equal(lowered.analysis.rootGeometry.height.evidence, 'not-established');
assert.equal(
  lowered.analysis.ids.definitions.filter(entry => entry.id === 'dup').length,
  2
);
assert.equal(lowered.analysis.references.occurrences[0].state, 'ambiguous');
assert.equal(lowered.analysis.references.occurrences[1].state, 'unresolved');
assert.equal(lowered.analysis.css.coverage, 'lexically-retained');
assert.deepEqual(lowered.analysis.css.declarations, []);
assert.deepEqual(lowered.analysis.accessibility.titles, ['A&😀B']);
assert.deepEqual(lowered.analysis.accessibility.descriptions, []);
assert.ok(Object.isFrozen(lowered) && Object.isFrozen(lowered.root.children));

// The copy mode is mutation-isolated from a mutable contract input and does not
// infer provenance when the contract omitted an exact source span.
const beforeMutation = lowered.root.name.localName;
document.root.name.localName = 'mutated';
assert.equal(lowered.root.name.localName, beforeMutation);
const missingSpanInput = makeInput();
missingSpanInput.document.root.attributes[2].sourceSpan = undefined;
missingSpanInput.document.root.children[0].startTagSpan = undefined;
const missingSpanIR = lowerXmlDocumentToIR(
  missingSpanInput.source,
  missingSpanInput.document,
  { sourceId: 'no-guessed-span' }
);
assert.equal(missingSpanIR.root.attributes[2].provenance.kind, 'unknown');
assert.equal(missingSpanIR.root.children[0].provenance.kind, 'unknown');

const generated = structuredClone(lowered);
generated.root.children.push({
  kind: 'generated',
  value: 'annotation',
  provenance: { kind: 'generated', passId: 'phase3-test-pass' },
});
assert.equal(
  validateAndFreezeIR(generated).root.children.at(-1).provenance.kind,
  'generated'
);
const badGenerated = structuredClone(generated);
badGenerated.root.children.at(-1).provenance = {
  kind: 'source',
  span: {
    startUtf16: 0,
    endUtf16Exclusive: 1,
    unit: 'utf16-code-unit',
    sourceSlice: '<',
  },
};
assert.throws(() => validateAndFreezeIR(badGenerated), /generated provenance/u);

// Structural sharing is only available for a deeply frozen contract input.
const sharedInput = makeInput(sourceText, { shareName: true });
deepFreeze(sharedInput.source);
deepFreeze(sharedInput.document);
const shared = lowerXmlDocumentToIR(sharedInput.source, sharedInput.document, {
  sourceId: 'shared-ownership-fixture',
  ownership: 'share-verified-immutable',
});
assert.equal(shared.root.children[2].name, shared.root.children[3].name);
assert.equal(
  shared.root.children[2].name,
  sharedInput.document.root.children[2].name
);
assert.equal(Object.isFrozen(sharedInput.document.root.children[2].name), true);
const copiedImmutableAlias = validateAndFreezeIR(shared);
assert.equal(
  copiedImmutableAlias.root.children[2].name.localName,
  shared.root.children[2].name.localName
);
assert.notEqual(
  copiedImmutableAlias.root.children[2].name,
  copiedImmutableAlias.root.children[3].name
);
assert.throws(() => {
  const mutable = makeInput();
  lowerXmlDocumentToIR(mutable.source, mutable.document, {
    sourceId: 'mutable-sharing-must-fail',
    ownership: 'share-verified-immutable',
  });
}, /deeply frozen/u);

const brokenSpanInput = makeInput();
brokenSpanInput.document.root.startTagSpan.end = source.text.length + 1;
assert.throws(
  () =>
    lowerXmlDocumentToIR(brokenSpanInput.source, brokenSpanInput.document, {
      sourceId: 'bad-span',
    }),
  /outside the retained source/u
);
const mismatchedQNameInput = makeInput();
mismatchedQNameInput.document.root.name.qualifiedName = 'x:svg';
assert.throws(
  () =>
    lowerXmlDocumentToIR(
      mismatchedQNameInput.source,
      mismatchedQNameInput.document,
      { sourceId: 'bad-qname' }
    ),
  /QName does not match/u
);
const mismatchedNamespaceInput = makeInput();
mismatchedNamespaceInput.document.root.children[4].attributes[0].name.namespaceUri =
  'urn:wrong';
assert.throws(
  () =>
    lowerXmlDocumentToIR(
      mismatchedNamespaceInput.source,
      mismatchedNamespaceInput.document,
      { sourceId: 'bad-namespace' }
    ),
  /namespace URI does not match/u
);
const sparseInput = makeInput();
sparseInput.document.root.children[10] = sparseInput.document.root.children[0];
assert.throws(
  () =>
    lowerXmlDocumentToIR(sparseInput.source, sparseInput.document, {
      sourceId: 'sparse-child-array',
    }),
  /sparse entries/u
);

async function collectGarbage() {
  await new Promise(resolve => setImmediate(resolve));
  global.gc?.();
  await new Promise(resolve => setImmediate(resolve));
  global.gc?.();
  await new Promise(resolve => setImmediate(resolve));
}

async function memorySample(ownership, count = 700) {
  await collectGarbage();
  const heapStart = process.memoryUsage().heapUsed;
  let text = '<svg xmlns="http://www.w3.org/2000/svg">';
  const rootStart = text;
  for (let index = 0; index < count; index++) {
    const token = `<g id="${index}"/>`;
    text += token;
  }
  text += '</svg>';
  const source = {
    text,
    encoding: 'utf-8',
    offsetUnit: 'utf16-code-unit',
    utf8ByteLength: Buffer.byteLength(text, 'utf8'),
  };
  const sourceAllocation = process.memoryUsage().heapUsed - heapStart;
  assert.equal(
    applySVGInputSafety(text, { unsafeInputPolicy: 'reject' }),
    text
  );
  await collectGarbage();
  const afterSourceGC = process.memoryUsage().heapUsed;
  const structuralStart = process.memoryUsage().heapUsed;
  const children = [];
  for (let index = 0; index < count; index++) {
    const token = `<g id="${index}"/>`;
    const start = text.indexOf(token);
    const idRaw = `id="${index}"`;
    const idStart = start + 3;
    children.push({
      kind: 'element',
      name: {
        qualifiedName: 'g',
        prefix: null,
        localName: 'g',
        namespaceUri: SVG_NAMESPACE,
      },
      attributes: [
        {
          kind: 'attribute',
          name: {
            qualifiedName: 'id',
            prefix: null,
            localName: 'id',
            namespaceUri: null,
          },
          value: String(index),
          sourceSpan: {
            start: idStart,
            end: idStart + idRaw.length,
            unit: 'utf16-code-unit',
          },
        },
      ],
      children: [],
      startTagSpan: {
        start,
        end: start + token.length,
        unit: 'utf16-code-unit',
      },
    });
  }
  const document = {
    kind: 'document',
    prolog: [],
    epilog: [],
    root: {
      kind: 'element',
      name: {
        qualifiedName: 'svg',
        prefix: null,
        localName: 'svg',
        namespaceUri: SVG_NAMESPACE,
      },
      attributes: [
        {
          kind: 'attribute',
          name: {
            qualifiedName: 'xmlns',
            prefix: null,
            localName: 'xmlns',
            namespaceUri: XMLNS,
          },
          value: SVG_NAMESPACE,
          sourceSpan: {
            start: 5,
            end: rootStart.length - 1,
            unit: 'utf16-code-unit',
          },
        },
      ],
      children,
      startTagSpan: {
        start: 0,
        end: rootStart.length,
        unit: 'utf16-code-unit',
      },
      endTagSpan: {
        start: text.length - 6,
        end: text.length,
        unit: 'utf16-code-unit',
      },
    },
  };
  const structuralAllocation = process.memoryUsage().heapUsed - structuralStart;
  if (ownership === 'share-verified-immutable') {
    deepFreeze(source);
    deepFreeze(document);
  }
  await collectGarbage();
  const afterInputGC = process.memoryUsage().heapUsed;
  const lowerStart = process.memoryUsage().heapUsed;
  const lowerStartTime = performance.now();
  const staged = lowerXmlStructure(source, document, {
    sourceId: `memory-${ownership}`,
    ownership,
  });
  const lowerMilliseconds = performance.now() - lowerStartTime;
  const afterLowerAllocation = process.memoryUsage().heapUsed;
  await collectGarbage();
  const afterLowerGC = process.memoryUsage().heapUsed;
  const sidecarStart = process.memoryUsage().heapUsed;
  const sidecarStartTime = performance.now();
  const analysis = buildSemanticSidecars(staged.root);
  const sidecarMilliseconds = performance.now() - sidecarStartTime;
  const afterSidecarAllocation = process.memoryUsage().heapUsed;
  await collectGarbage();
  const afterSidecarGC = process.memoryUsage().heapUsed;
  const publicationStart = process.memoryUsage().heapUsed;
  const publicationStartTime = performance.now();
  const published = validateAndFreezeIR(
    { version: IR_VERSION, ...staged, analysis },
    {
      ownership:
        ownership === 'share-verified-immutable' ? 'freeze-owned' : 'copy',
    }
  );
  const publicationMilliseconds = performance.now() - publicationStartTime;
  const afterPublicationAllocation = process.memoryUsage().heapUsed;
  await collectGarbage();
  const afterPublicationGC = process.memoryUsage().heapUsed;
  const result = {
    ownership,
    elements: count + 1,
    sourceBytes: source.utf8ByteLength,
    sourceAllocationDelta: sourceAllocation,
    sourceRetainedDelta: afterSourceGC - heapStart,
    structuralAllocationDelta: structuralAllocation,
    structuralInputRetainedDelta: afterInputGC - afterSourceGC,
    loweringAllocationDelta: afterLowerAllocation - lowerStart,
    loweringRetainedDelta: afterLowerGC - lowerStart,
    semanticSidecarAllocationDelta: afterSidecarAllocation - sidecarStart,
    semanticSidecarRetainedDelta: afterSidecarGC - sidecarStart,
    validationAndPublishAllocationDelta:
      afterPublicationAllocation - publicationStart,
    validationAndPublishRetainedDelta: afterPublicationGC - publicationStart,
    timingsMs: {
      lower: lowerMilliseconds,
      sidecars: sidecarMilliseconds,
      publish: publicationMilliseconds,
    },
    identityShared:
      published.root.children[0].name === document.root.children[0].name,
  };
  return { result, released: new WeakRef(published) };
}

if (typeof global.gc === 'function') {
  const copy = await memorySample('copy');
  const sharedSample = await memorySample('share-verified-immutable');
  await new Promise(resolve => setImmediate(resolve));
  global.gc();
  await new Promise(resolve => setImmediate(resolve));
  console.log(
    JSON.stringify({
      phase3OwnershipMemory: '700-node-structural-input-sidecar-publication',
      samples: [copy.result, sharedSample.result],
      releasedAfterScopeAndGc: {
        copy: copy.released.deref() === undefined,
        share: sharedSample.released.deref() === undefined,
      },
    })
  );
}

console.log(
  'Phase 03.2B structural XML-to-IR lowering and ownership checks passed.'
);
