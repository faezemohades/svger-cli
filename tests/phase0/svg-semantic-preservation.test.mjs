import assert from 'node:assert/strict';
import { svgProcessor } from '../../dist/processors/svg-processor.js';
import { OptLevel } from '../../dist/optimizers/types.js';
import { applySVGInputSafety } from '../../dist/security/input-safety.js';
import { performanceEngine } from '../../dist/core/performance-engine.js';
import {
  normalizeSVGFormattingWhitespace,
  transformSVGAttributeValues,
} from '../../dist/optimizers/xml-attribute-transform.js';
import { frameworkTemplateEngine } from '../../dist/core/framework-templates.js';

const semanticSVG = `<svg xmlns="http://www.w3.org/2000/svg" aria-label="  Release 1.234567  ">
  <title>  Version 1.234567\n  release  </title>
  <desc>Icon for version 2.345678; literal style="fill:red" stroke-width</desc>
  <g xml:space="preserve"><title>  inherited\n whitespace  </title><g>  <path d="M0 0"/> \n </g></g>
  <text x="10.12345" y="20" xml:space="preserve">Version 1.234567
    <tspan> first </tspan> <tspan>second 2.345678</tspan>
    <tspan><![CDATA[ raw 3.456789 <text> ]]></tspan>
    <tspan><![CDATA[<!-- not an XML comment -->]]></tspan>
  </text>
  <path style="fill: red; stroke-width: 2px" d="M0 0L1 1"/>
</svg>`;

const requiredText = [
  '<title>  Version 1.234567\n  release  </title>',
  '<desc>Icon for version 2.345678; literal style="fill:red" stroke-width</desc>',
  '<title>  inherited\n whitespace  </title>',
  '<g>  <path d="M0 0"/> \n </g>',
  'Version 1.234567\n    ',
  '<tspan> first </tspan> <tspan>second 2.345678</tspan>',
  '<![CDATA[ raw 3.456789 <text> ]]>',
  '<![CDATA[<!-- not an XML comment -->]]>',
];

for (const level of Object.values(OptLevel)) {
  svgProcessor.setOptimizationLevel(level);
  const output = await svgProcessor.cleanSVGContent(semanticSVG);
  for (const text of requiredText) {
    assert.ok(
      output.includes(text),
      `${level} preserves ${JSON.stringify(text)}`
    );
  }
  assert.match(output, /aria-label=" {2}Release 1\.234567 {2}"/);
}

const generated = await svgProcessor.generateComponent(
  'Semantic',
  semanticSVG,
  {
    framework: 'react',
    typescript: true,
  }
);
assert.ok(generated.includes('<title>  Version 1.234567\n  release  </title>'));
assert.ok(
  generated.includes('<tspan> first </tspan> <tspan>second 2.345678</tspan>')
);
assert.equal(generated.includes('<![CDATA['), false);
assert.ok(generated.includes(' raw 3.456789 &lt;text&gt; '));
assert.ok(generated.includes('&lt;!-- not an XML comment --&gt;'));
assert.ok(generated.includes("style={{fill: 'red', strokeWidth: '2px'}}"));
assert.ok(generated.includes('literal style="fill:red" stroke-width'));

const rootPreserved =
  '<svg xml:space="preserve">  <text> root text </text>  </svg>';
const rootPreservedOutput = await svgProcessor.generateComponent(
  'RootPreserved',
  rootPreserved,
  { framework: 'react', typescript: true }
);
assert.ok(rootPreservedOutput.includes('<text> root text </text>  '));

assert.equal(
  normalizeSVGFormattingWhitespace(
    '<svg><g xml:space="preserve">  <path/>   <g xml:space="default">  <path/>  </g></g></svg>'
  ),
  '<svg><g xml:space="preserve">  <path/>   <g xml:space="default"> <path/> </g></g></svg>'
);

const escapedAttributes = transformSVGAttributeValues(
  `<svg a="old" b='old'/>`,
  (_tag, name) => (name === 'a' || name === 'b' ? `"'<>&` : undefined)
);
assert.equal(
  escapedAttributes,
  `<svg a="&quot;'&lt;&gt;&amp;" b='"&apos;&lt;&gt;&amp;'/>`
);
assert.equal(applySVGInputSafety(escapedAttributes), escapedAttributes);

const utf8SVG = '\uFEFF<?xml version="1.0" encoding="UTF-8"?><svg><text>café</text></svg>';
assert.match(await svgProcessor.cleanSVGContent(utf8SVG), /<text>café<\/text>/);
assert.throws(
  () =>
    frameworkTemplateEngine.generateComponent({
      componentName: 'Broken',
      svgContent: '<svg><g></svg>',
      framework: 'react',
      typescript: true,
    }),
  error => error?.code === 'E_INVALID_SVG_XML'
);
assert.throws(
  () =>
    frameworkTemplateEngine.generateComponent({
      componentName: 'Mismatched',
      svgContent: '<svg><g></path></svg>',
      framework: 'react',
      typescript: true,
    }),
  error => error?.code === 'E_INVALID_SVG_XML'
);
assert.throws(
  () => applySVGInputSafety('<?xml version="1.0" encoding="UTF-16"?><svg/>'),
  error => error?.code === 'E_UNSUPPORTED_SVG_ENCODING'
);

// Geometry optimization remains eligible, while references stay connected.
svgProcessor.setOptimizationLevel(OptLevel.BALANCED);
const geometry = await svgProcessor.cleanSVGContent(
  '<svg viewBox="0 0 24 24"><defs><linearGradient id="paint"/></defs><circle cx="10.12345" cy="20.98765" r="2"/><path d="M0 0 L10.12345 20.98765" fill="url(#paint)"/></svg>'
);
assert.match(geometry, /viewBox="0 0 24 24"/);
assert.match(geometry, /id="paint"/);
assert.match(geometry, /fill="url\(#paint\)"/);
assert.match(geometry, /10\.123/);
assert.match(geometry, /20\.988/);
assert.ok(geometry.includes('d="M0 0 L10.12345 20.98765"'));

const styledGeometry =
  '<svg><style>.mark{fill:red}.mark{fill:blue!important}</style><path id="shape" class="mark" transform="translate(1.25 2.5)" d="M0 0L3.14159 6.28318" fill="url(#paint)"/><defs><linearGradient id="paint"/></defs><use href="#shape"/></svg>';
svgProcessor.setOptimizationLevel(OptLevel.MAXIMUM);
const optimizedStyledGeometry =
  await svgProcessor.cleanSVGContent(styledGeometry);
assert.ok(
  optimizedStyledGeometry.includes(
    '<style>.mark{fill:red}.mark{fill:blue!important}</style>'
  )
);
assert.ok(optimizedStyledGeometry.includes('id="shape"'));
assert.ok(optimizedStyledGeometry.includes('class="mark"'));
assert.ok(optimizedStyledGeometry.includes('transform="translate(1.25 2.5)"'));
assert.ok(optimizedStyledGeometry.includes('fill="url(#paint)"'));
assert.ok(optimizedStyledGeometry.includes('href="#shape"'));
assert.equal(
  applySVGInputSafety(optimizedStyledGeometry),
  optimizedStyledGeometry
);

for (const level of ['fast', 'balanced', 'maximum']) {
  assert.equal(
    performanceEngine.optimizeSVGContent(semanticSVG, level),
    semanticSVG,
    `${level} performance strategy preserves semantic source`
  );
}
