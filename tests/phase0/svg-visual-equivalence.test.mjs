import assert from 'node:assert/strict';
import { parse } from '@babel/parser';
import { compareVisually } from '../../dist/utils/visual-diff.js';
import { svgProcessor } from '../../dist/processors/svg-processor.js';
import { OptLevel } from '../../dist/optimizers/types.js';

const fixtures = [
  {
    name: 'gradient-and-clip',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0%" stop-color="#f06"/><stop offset="100%" stop-color="#06f"/></linearGradient><clipPath id="c"><circle cx="12" cy="12" r="10"/></clipPath></defs><g clip-path="url(#c)"><rect width="24" height="24" fill="url(#g)"/><path d="M2 12h20" stroke="#fff" stroke-width="1.25"/></g></svg>`,
  },
  {
    name: 'text-and-cdata',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><rect width="24" height="24" fill="#fff"/><text x="2" y="12">alpha &amp; beta <tspan><![CDATA[<gamma> {delta}]]></tspan></text></svg>`,
  },
  {
    name: 'stylesheet-text',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><style>.mark { fill: #d24; }</style><rect class="mark" width="24" height="24"/></svg>`,
  },
  {
    name: 'rounded-geometry',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><circle cx="12.041" cy="11.963" r="8.237" fill="#345678"/><path d="M3.141 4.271L20.913 18.889" stroke="#123456" stroke-width="0.731"/></svg>`,
  },
];

function getReactSVGChildren(source, typescript) {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: typescript ? ['typescript', 'jsx'] : ['jsx'],
  });
  let root;
  function visit(node) {
    if (!node || typeof node !== 'object' || root) return;
    if (
      node.type === 'JSXElement' &&
      node.openingElement?.name?.type === 'JSXIdentifier' &&
      node.openingElement.name.name === 'svg'
    ) {
      root = node;
      return;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  assert.ok(root?.closingElement, 'generated React source has a closed SVG root');
  return source
    .slice(root.openingElement.end, root.closingElement.start)
    .replace(
      /<style>\{("(?:\\.|[^"\\])*")\}<\/style>/g,
      (_match, encodedCSS) => `<style>${JSON.parse(encodedCSS)}</style>`
    );
}

const levelTolerance = {
  [OptLevel.NONE]: 0.1,
  [OptLevel.BASIC]: 0.1,
  [OptLevel.BALANCED]: 0.1,
  [OptLevel.AGGRESSIVE]: 0.5,
  // Maximum intentionally rounds eligible coordinates to one decimal place.
  [OptLevel.MAXIMUM]: 2.0,
};

for (const fixture of fixtures) {
  for (const level of Object.values(OptLevel)) {
    svgProcessor.setOptimizationLevel(level);
    const optimized = await svgProcessor.cleanSVGContent(fixture.svg);
    const comparison = await compareVisually(fixture.svg, optimized, {
      render: { width: 192, height: 192, density: 72 },
      diff: { threshold: 0.1, maxDiffPercent: levelTolerance[level] },
    });
    assert.ok(
      comparison.passed,
      `${fixture.name} at ${level}: ${comparison.message}`
    );
  }
}

// The generated React child tree is extracted from parsed JSX and rendered
// inside the fixture's SVG root, covering the framework-emission boundary.
const jsxFixture = fixtures.find(fixture => fixture.name === 'stylesheet-text');
assert.ok(jsxFixture);
for (const typescript of [false, true]) {
  const generated = await svgProcessor.generateComponent(
    'VisualSemantic',
    jsxFixture.svg,
    { framework: 'react', typescript }
  );
  const children = getReactSVGChildren(generated, typescript);
  const componentMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">${children}</svg>`;
  const comparison = await compareVisually(jsxFixture.svg, componentMarkup, {
    render: { width: 192, height: 192, density: 72 },
    diff: { threshold: 0.1, maxDiffPercent: 0.1 },
  });
  assert.ok(comparison.passed, `React ${typescript ? 'TSX' : 'JSX'}: ${comparison.message}`);
}

console.log('SVG visual-equivalence regressions passed.');
