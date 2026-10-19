import assert from 'node:assert/strict';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ContentAddressableCache,
  createCacheKey,
  createPipelineFingerprint,
  createSVGCompiler,
} from '../../dist/index.js';
import {
  applySVGInputSafety,
  readSVGInputFile,
} from '../../dist/security/input-safety.js';
import { svgProcessor } from '../../dist/processors/svg-processor.js';

const safeCorpus = [
  '<svg viewBox="0 0 24 24"><path fill="url(#paint)" d="M0 0h1v1z"/></svg>',
  '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><title>A &amp; B</title><path d="M0 0"/></svg>',
  '<svg><style>.icon{fill:url(#paint)}</style><defs><linearGradient id="paint"/></defs><use href="#shape"/></svg>',
  '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><g><use xlink:href="#shape"/></g></svg>',
  '<svg><text><![CDATA[<script>not markup</script>]]></text></svg>',
  '<svg><style>.x::after{content:"url(https://example.invalid/)";fill:url(#paint)}</style></svg>',
];

for (const [index, sample] of safeCorpus.entries()) {
  assert.equal(applySVGInputSafety(sample), sample, `safe corpus ${index}`);
}
assert.throws(
  () => applySVGInputSafety(safeCorpus[0], { unsafeInputPolicy: 'ignore' }),
  error => error?.code === 'E_INVALID_UNSAFE_INPUT_POLICY'
);
assert.throws(
  () =>
    applySVGInputSafety('<svg onload="x"/>', { unsafeInputPolicy: 'ignore' }),
  error => error?.code === 'E_INVALID_UNSAFE_INPUT_POLICY'
);

const rejectedCorpus = [
  [
    'entity-obfuscated-scheme',
    '<svg><a href="java&#x73;cript:alert(1)">x</a></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'external-image',
    '<svg><image href="https://example.invalid/a.png"/></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'external-xml-base',
    '<svg xml:base="https://example.invalid/"><use href="#remote"/></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'external-css',
    '<svg><style>.x{fill:u\\72l(https://example.invalid/a)}</style></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'comment-obfuscated-css-url',
    '<svg><style>.x{fill:u/**/rl(https://example.invalid/a)}</style></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'css-comment-marker-in-string',
    '<svg><style>.x{content:"/*";@import url(https://example.invalid/a) */}</style></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'css-out-of-range-escape',
    '<svg><style>.x{fill:url(\\110000https://example.invalid/a)}</style></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'nested-style-markup',
    '<svg><style>.x{fill:url(#a)}<g/></style></svg>',
    'E_INVALID_SVG_XML',
  ],
  [
    'malformed-css-escape',
    '<svg><style>.x{color:red}\\</style></svg>',
    'E_UNSUPPORTED_SVG_CSS',
  ],
  [
    'malformed-css-string',
    '<svg><style>.x{content:"unterminated}</style></svg>',
    'E_UNSUPPORTED_SVG_CSS',
  ],
  [
    'event-handler',
    '<svg><path onload="alert(1)"/></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'active-foreign-content',
    '<svg><foreignObject><div/></foreignObject></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'doctype',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  ['unknown-entity', '<svg><title>&custom;</title></svg>', 'E_INVALID_SVG_XML'],
  ['mismatched-tag', '<svg><g></svg>', 'E_INVALID_SVG_XML'],
  ['unquoted-attribute', '<svg viewBox=0/>', 'E_INVALID_SVG_XML'],
  ['whitespace-in-tag-delimiter', '< svg/>', 'E_INVALID_SVG_XML'],
  ['missing-attribute-separator', '<svg a="1"b="2"/>', 'E_INVALID_SVG_XML'],
  ['foreign-namespace', '<x:svg xmlns:x="urn:foreign"/>', 'E_INVALID_SVG_XML'],
  [
    'unsupported-encoding',
    '<?xml version="1.0" encoding="UTF-16"?><svg/>',
    'E_UNSUPPORTED_SVG_ENCODING',
  ],
];

for (const [label, sample, code] of rejectedCorpus) {
  assert.throws(
    () => applySVGInputSafety(sample),
    error => error?.code === code,
    label
  );
}
for (const policy of ['reject', 'strip']) {
  assert.throws(
    () => applySVGInputSafety('<svg><g></svg>', { unsafeInputPolicy: policy }),
    error => error?.code === 'E_INVALID_SVG_XML',
    `malformed XML under ${policy}`
  );
}

assert.throws(
  () =>
    applySVGInputSafety(`<svg>${'<g>'.repeat(257)}${'</g>'.repeat(257)}</svg>`),
  error => error?.code === 'E_SVG_XML_LIMIT',
  'depth limit'
);
assert.throws(
  () =>
    applySVGInputSafety(
      `<svg ${Array.from({ length: 257 }, (_, i) => `a${i}="v"`).join(' ')}/>`
    ),
  error => error?.code === 'E_SVG_XML_LIMIT',
  'attribute limit'
);
assert.throws(
  () => applySVGInputSafety(`<svg>${'<g/>'.repeat(100_000)}</svg>`),
  error => error?.code === 'E_SVG_XML_LIMIT',
  'element-count limit'
);
const manyFindings = `<svg>${Array.from(
  { length: 300 },
  (_, i) => `<g onhandler${i}="x"/>`
).join('')}</svg>`;
assert.throws(
  () => applySVGInputSafety(manyFindings),
  error => error?.code === 'E_SVG_XML_LIMIT',
  'finding-count limit'
);

let nearLimitSVG = `<svg><title>${'x'.repeat(9 * 1024 * 1024)}</title></svg>`;
const heapBefore = process.memoryUsage().heapUsed;
const scanStart = performance.now();
assert.equal(applySVGInputSafety(nearLimitSVG), nearLimitSVG);
const elapsedMs = performance.now() - scanStart;
const heapDeltaMiB =
  (process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024;
console.log(
  `Near-limit valid SVG scan: ${elapsedMs.toFixed(1)} ms, ${heapDeltaMiB.toFixed(1)} MiB heap delta.`
);
const nearLimitAdversarial = nearLimitSVG.replace(
  '</title></svg>',
  '</title><g onload="attack()"/></svg>'
);
nearLimitSVG = '';
const adversarialHeapBefore = process.memoryUsage().heapUsed;
const adversarialStart = performance.now();
assert.throws(
  () => applySVGInputSafety(nearLimitAdversarial),
  error => error?.code === 'E_UNSAFE_SVG_CONTENT'
);
const adversarialMs = performance.now() - adversarialStart;
const adversarialHeapDelta =
  (process.memoryUsage().heapUsed - adversarialHeapBefore) / 1024 / 1024;
assert.ok(adversarialMs < 10_000, `adversarial scan took ${adversarialMs} ms`);
assert.ok(
  adversarialHeapDelta < 64,
  `adversarial scan retained ${adversarialHeapDelta} MiB of heap`
);
console.log(
  `Near-limit adversarial SVG scan: ${adversarialMs.toFixed(1)} ms, ${adversarialHeapDelta.toFixed(1)} MiB heap delta.`
);

const fileFixture = await mkdtemp(path.join(os.tmpdir(), 'svger-svg-size-'));
const oversizedPath = path.join(fileFixture, 'oversized.svg');
await writeFile(oversizedPath, '<svg>larger than limit</svg>');
await assert.rejects(
  () => readSVGInputFile(oversizedPath, 8),
  error => error?.code === 'E_SVG_INPUT_TOO_LARGE'
);
const invalidUtf8Path = path.join(fileFixture, 'invalid-utf8.svg');
await writeFile(invalidUtf8Path, Buffer.from([0x3c, 0x73, 0x76, 0x67, 0xff]));
await assert.rejects(
  () => readSVGInputFile(invalidUtf8Path),
  error => error?.code === 'E_UNSUPPORTED_SVG_ENCODING'
);
const processorOversized = await svgProcessor.processSVGFile(
  oversizedPath,
  path.join(fileFixture, 'output'),
  { maxInputSizeBytes: 8 }
);
assert.equal(processorOversized.error?.code, 'E_SVG_INPUT_TOO_LARGE');
await rm(fileFixture, { recursive: true, force: true });

const warnings = [];
const stripped = applySVGInputSafety(
  '<svg><script>bad()</script><a href="java&#x73;cript:bad()" onclick="bad()">x</a><image href="remote.png"/></svg>',
  { unsafeInputPolicy: 'strip', warn: message => warnings.push(message) }
);
assert.equal(stripped.includes('<script'), false);
assert.equal(stripped.includes('href='), false);
assert.equal(stripped.includes('onclick'), false);
assert.equal(warnings.length, 1);
const overlappingStrip = applySVGInputSafety(
  '<svg><script><foreignObject><div/></foreignObject></script><path/></svg>',
  { unsafeInputPolicy: 'strip', warn: () => undefined }
);
assert.equal(applySVGInputSafety(overlappingStrip), overlappingStrip);
const optimizedStrip = await svgProcessor.cleanSVGContent(overlappingStrip);
assert.equal(applySVGInputSafety(optimizedStrip), optimizedStrip);

await assert.rejects(
  () => svgProcessor.generateComponent('Encoded', rejectedCorpus[0][1]),
  error => error?.code === 'E_UNSAFE_SVG_CONTENT'
);

const poisonedFixture = await mkdtemp(
  path.join(os.tmpdir(), 'svger-poisoned-cache-')
);
const poisonContent = '<svg><script>cached attack()</script></svg>';
await writeFile(path.join(poisonedFixture, 'poison.svg'), poisonContent);
const poisonCompiler = await createSVGCompiler({ cwd: poisonedFixture });
const poisonConfig = poisonCompiler.config.explain().reduce((config, entry) => {
  const segments = entry.path.split('.');
  let target = config;
  for (const segment of segments.slice(0, -1)) {
    target[segment] ??= {};
    target = target[segment];
  }
  target[segments.at(-1)] = entry.value;
  return config;
}, {});
const poisonKey = createCacheKey(
  `Poison\0${poisonContent}`,
  createPipelineFingerprint(poisonConfig, 'basic')
);
const poisonedCache = new ContentAddressableCache(
  path.join(poisonedFixture, '.svger-cache')
);
await poisonedCache.write(
  poisonKey,
  'export default function Poison(){return <script/>;}'
);
assert.equal(
  (await poisonedCache.read(poisonKey, { evictCorrupt: false })).status,
  'hit'
);
const poisonedBuild = await poisonCompiler.build({ src: '.', out: 'output' });
assert.equal(poisonedBuild.status, 'failed');
assert.equal(poisonedBuild.diagnostics[0].code, 'E_UNSAFE_SVG_CONTENT');
assert.equal(
  poisonedBuild.diagnostics.some(item => item.code === 'I_CACHE_HIT'),
  false
);
await assert.rejects(
  () => access(path.join(poisonedFixture, 'output')),
  error => error?.code === 'ENOENT'
);
await rm(poisonedFixture, { recursive: true, force: true });
console.log(
  `SVG security corpus passed (${safeCorpus.length} safe, ${rejectedCorpus.length + 1} rejected cases).`
);
