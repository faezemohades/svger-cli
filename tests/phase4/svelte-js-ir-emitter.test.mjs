import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { performance } from 'node:perf_hooks';
import { compile, VERSION } from 'svelte/compiler';
import { parse as parseJavaScript } from '@babel/parser';
import ts from 'typescript';
import {
  compileScript as compileVueScript,
  compileTemplate as compileVueTemplate,
  parse as parseVue,
} from '@vue/compiler-sfc';
import { preprocess as preprocessSvelte } from 'svelte/compiler';
import { parseTemplate as parseAngularTemplate } from '@angular/compiler';
import { SVGProcessor, NullLogger } from '../../dist/index.js';
import { parseSourceToXmlDocument } from '../../experiments/phase3/saxes-xml-document-adapter.mjs';
import { analyzeStaticSvgSource } from '../../experiments/phase3/static-svg-source-oracle.mjs';
import { analyzeSvelteArtifact } from '../../experiments/phase3/svelte-artifact-oracle.mjs';
import {
  emitSvelteJsFromIR,
  emitSvelteTsFromIR,
  SvelteIrEmitterError,
} from '../../experiments/phase4/.build/phase4/svelte-js-ir-emitter.js';
import {
  emitPreactFromIR,
  emitReactFromIR,
  FrameworkIrEmitterError,
} from '../../experiments/phase4/.build/phase4/react-preact-ir-emitters.js';
import {
  emitSolidFromIR,
  emitVueFromIR,
} from '../../experiments/phase4/.build/phase4/solid-vue-ir-emitters.js';
import {
  emitLitFromIR,
  emitVanillaFromIR,
} from '../../experiments/phase4/.build/phase4/lit-vanilla-ir-emitters.js';
import { emitAngularFromIR } from '../../experiments/phase4/.build/phase4/angular-ir-emitter.js';
import { emitReactNativeFromIR } from '../../experiments/phase4/.build/phase4/react-native-ir-emitter.js';
import { lowerXmlDocumentToIR } from '../../experiments/phase4/.build/phase3/lower-xml-to-ir.js';

function lower(source, sourceId = 'phase4-fixture') {
  const parsed = parseSourceToXmlDocument(source);
  return lowerXmlDocumentToIR(parsed.source, parsed.document, { sourceId });
}

function expectEmitterError(callback, code) {
  assert.throws(callback, error => {
    assert.ok(error instanceof SvelteIrEmitterError);
    assert.equal(error.code, code);
    return true;
  });
}

async function renderSvelte(componentSource, props = {}) {
  const preprocessed = await preprocessSvelte(
    componentSource,
    {
      script: ({ content, attributes }) => {
        if (attributes.lang !== 'ts') return;
        return {
          code: ts.transpileModule(content, {
            compilerOptions: {
              target: ts.ScriptTarget.ES2022,
              module: ts.ModuleKind.ESNext,
            },
          }).outputText,
          attributes: { ...attributes, lang: undefined },
        };
      },
    },
    { filename: 'RuntimeContract.svelte' }
  );
  const compiled = compile(preprocessed.code, {
    filename: 'RuntimeContract.svelte',
    generate: 'ssr',
  }).js.code.replaceAll(
    '"svelte/internal"',
    JSON.stringify(import.meta.resolve('svelte/internal'))
  );
  const encoded = Buffer.from(compiled).toString('base64');
  const component = (await import(`data:text/javascript;base64,${encoded}`))
    .default;
  return component.render(props).html;
}

const staticSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" viewBox="0 0 8 8" width="8" height="8" role="img" aria-labelledby="label"><title id="label">Icon &amp; shape</title><text> A <tspan xml:space="default">content</tspan> C </text><path id="shape" d="M0 0h8v8z" fill="currentColor"/><use xlink:href="#shape"/></svg>';
const ir = lower(staticSvg, 'static-icon');

// Batch 031-A emitters preserve the shared IR fixture and existing JSX props.
// Babel is used as syntax validation only; React and Preact consumer compilers
// are not installed, so these results are not marked framework-qualified.
for (const frameworkEmitter of [emitReactFromIR, emitPreactFromIR]) {
  for (const typescript of [false, true]) {
    const emitted = frameworkEmitter(ir, 'StaticIcon', typescript);
    assert.equal(emitted.outcome, 'complete');
    assert.equal(emitted.outputBytes, Buffer.byteLength(emitted.content));
    assert.equal(
      emitted.content,
      frameworkEmitter(ir, 'StaticIcon', typescript).content
    );
    assert.match(emitted.content, /width\s*\|\|?\s*8/u);
    assert.match(emitted.content, /height\s*\|\|?\s*8/u);
    assert.match(emitted.content, /aria-labelledby|ariaLabelledby/u);
    assert.match(emitted.content, /xlinkHref/u);
    parseJavaScript(emitted.content, {
      sourceType: 'module',
      plugins: typescript ? ['jsx', 'typescript'] : ['jsx'],
    });
  }
}
const reactContract = emitReactFromIR(ir, 'StaticIcon').content;
assert.match(reactContract, /size, className, style, \.\.\.props \}, ref/u);
assert.match(reactContract, /\{\.\.\.props\}/u);
assert.match(reactContract, /size \? \{ width: size, height: size \}/u);
const preactContract = emitPreactFromIR(ir, 'StaticIcon').content;
assert.match(
  preactContract,
  /\{ className, style, width, height, fill, stroke, \.\.\.props \}/u
);
assert.match(preactContract, /\{\.\.\.props\}/u);
for (const typescript of [false, true]) {
  const solid = emitSolidFromIR(ir, 'StaticIcon', typescript);
  assert.equal(solid.outputBytes, Buffer.byteLength(solid.content));
  assert.match(solid.content, /aria-labelledby="label"/u);
  assert.match(solid.content, /xlinkHref="#shape"/u);
  assert.match(solid.content, /props\.width \|\| 8/u);
  parseJavaScript(solid.content, {
    sourceType: 'module',
    plugins: typescript ? ['jsx', 'typescript'] : ['jsx'],
  });
  for (const scriptSetup of [false, true]) {
    const vue = emitVueFromIR(ir, 'StaticIcon', { typescript, scriptSetup });
    assert.equal(vue.outputBytes, Buffer.byteLength(vue.content));
    assert.equal(vue.content.includes('<script setup'), scriptSetup);
    assert.match(vue.content, /:width="width"/u);
    assert.match(vue.content, /aria-labelledby="label"/u);
    assert.match(vue.content, /xlink:href="#shape"/u);
    const script = vue.content.match(/<script[^>]*>([\s\S]*?)<\/script>/u)?.[1];
    assert.ok(script, 'Vue SFC includes a script block');
    parseJavaScript(script, {
      sourceType: 'module',
      plugins: typescript ? ['typescript'] : [],
    });
    const descriptor = parseVue(vue.content, {
      filename: 'StaticIcon.vue',
    }).descriptor;
    const compiledScript = compileVueScript(descriptor, {
      id: 'phase4-vue-ir',
    });
    const compiledTemplate = compileVueTemplate({
      source: descriptor.template.content,
      filename: 'StaticIcon.vue',
      id: 'phase4-vue-ir',
      compilerOptions: { bindingMetadata: compiledScript.bindings },
    });
    assert.deepEqual(compiledTemplate.errors, []);
  }
}
for (const standalone of [false, true]) {
  const angular = emitAngularFromIR(ir, 'StaticIcon', { standalone });
  assert.equal(angular.outputBytes, Buffer.byteLength(angular.content));
  assert.match(angular.content, /@Input\(\) width: string \| number = 8/u);
  assert.match(angular.content, /aria-labelledby="label"/u);
  assert.match(angular.content, /xlink:href="#shape"/u);
  assert.equal(angular.content.includes('standalone: true'), standalone);
  parseJavaScript(angular.content, {
    sourceType: 'module',
    plugins: ['typescript', 'decorators-legacy'],
  });
  const template = angular.content.match(/template: `([\s\S]*?)`,/u)?.[1];
  assert.ok(template, 'Angular emitter provides an inline template');
  const parsedTemplate = parseAngularTemplate(template, 'StaticIcon');
  assert.deepEqual(parsedTemplate.errors, null);
}
const nativeSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><g><path d="M0 0h8v8z" stroke-width="2"/><circle cx="12" cy="12" r="4"/></g></svg>';
const nativeIr = lower(nativeSvg, 'react-native-fixture');
for (const typescript of [false, true]) {
  const native = emitReactNativeFromIR(nativeIr, 'NativeIcon', typescript);
  assert.equal(native.outputBytes, Buffer.byteLength(native.content));
  assert.match(native.content, /<Svg/u);
  assert.match(native.content, /<Path[^>]*strokeWidth="2"/u);
  assert.match(native.content, /size, color, \.\.\.props/u);
  parseJavaScript(native.content, {
    sourceType: 'module',
    plugins: typescript ? ['jsx', 'typescript'] : ['jsx'],
  });
}
assert.throws(
  () => emitReactNativeFromIR(ir, 'NativeWithUnsupportedText'),
  error =>
    error instanceof FrameworkIrEmitterError &&
    error.code === 'E_FRAMEWORK_IR_UNSUPPORTED'
);
assert.throws(
  () =>
    emitReactNativeFromIR(
      lower(
        '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/>label</svg>'
      ),
      'NativeWithText'
    ),
  error =>
    error instanceof FrameworkIrEmitterError &&
    error.code === 'E_FRAMEWORK_IR_UNSUPPORTED'
);
for (const typescript of [false, true]) {
  const lit = emitLitFromIR(ir, 'StaticIcon', typescript);
  assert.match(lit.content, /\$\{this\.className\}/u);
  assert.match(lit.content, /\$\{this\.width\}/u);
  assert.match(lit.content, /aria-labelledby="label"/u);
  assert.match(lit.content, /xlink:href="#shape"/u);
  parseJavaScript(lit.content, {
    sourceType: 'module',
    plugins: typescript ? ['typescript', 'decorators-legacy'] : [],
  });
  const vanilla = emitVanillaFromIR(ir, 'StaticIcon', typescript);
  parseJavaScript(vanilla.content, {
    sourceType: 'module',
    plugins: typescript ? ['typescript'] : [],
  });
  assert.doesNotMatch(vanilla.content, /innerHTML/u);
  assert.match(vanilla.content, /createTextNode/u);
  assert.match(vanilla.content, /aria-labelledby/u);
}

const boundedEmitterCalls = [
  () => emitReactFromIR(ir, 'BoundedReact', false, 1),
  () => emitPreactFromIR(ir, 'BoundedPreact', false, 1),
  () => emitSolidFromIR(ir, 'BoundedSolid', false, 1),
  () => emitVueFromIR(ir, 'BoundedVue', { maxOutputBytes: 1 }),
  () => emitLitFromIR(ir, 'BoundedLit', false, 1),
  () => emitVanillaFromIR(ir, 'BoundedVanilla', false, 1),
  () => emitAngularFromIR(ir, 'BoundedAngular', { maxOutputBytes: 1 }),
  () => emitReactNativeFromIR(nativeIr, 'BoundedNative', false, 1),
  () => emitSvelteJsFromIR(ir, { maxOutputBytes: 1 }),
  () => emitSvelteTsFromIR(ir, { maxOutputBytes: 1 }),
];
for (const emit of boundedEmitterCalls) {
  assert.throws(emit, error =>
    ['E_FRAMEWORK_IR_LIMIT', 'E_SVELTE_IR_LIMIT'].includes(error?.code)
  );
}

// The DOM factory emitter is exercised against a small test double to verify
// its options and node-construction contract. This is not browser qualification.
const originalDocument = globalThis.document;
function mockNode(nodeName, namespaceURI = null, nodeValue = null) {
  return {
    nodeName,
    namespaceURI,
    nodeValue,
    attributes: new Map(),
    children: [],
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
    setAttributeNS(namespace, name, value) {
      this.attributes.set(`${namespace ?? ''}|${name}`, value);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
}
globalThis.document = {
  createElementNS: (namespace, name) => mockNode(name, namespace),
  createTextNode: value => mockNode('#text', null, value),
  createComment: value => mockNode('#comment', null, value),
};
try {
  const vanillaModule = await import(
    `data:text/javascript;base64,${Buffer.from(emitVanillaFromIR(ir, 'RuntimeIcon').content).toString('base64')}`
  );
  const renderedVanilla = vanillaModule.RuntimeIcon({
    className: 'custom',
    width: 18,
    height: '20px',
    fill: 'red',
    stroke: 'blue',
    'aria-label': 'Runtime icon',
  });
  assert.equal(renderedVanilla.attributes.get('class'), 'custom');
  assert.equal(renderedVanilla.attributes.get('width'), '18');
  assert.equal(renderedVanilla.attributes.get('height'), '20px');
  assert.equal(renderedVanilla.attributes.get('fill'), 'red');
  assert.equal(renderedVanilla.attributes.get('stroke'), 'blue');
  assert.equal(renderedVanilla.attributes.get('aria-labelledby'), 'label');
  assert.equal(renderedVanilla.attributes.get('aria-label'), 'Runtime icon');
  assert.equal(renderedVanilla.children.length, 4);
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}
assert.throws(
  () =>
    emitReactFromIR(
      lower(
        '<svg xmlns="http://www.w3.org/2000/svg"><!-- retained comment --></svg>'
      ),
      'CommentIcon'
    ),
  error =>
    error instanceof FrameworkIrEmitterError &&
    error.code === 'E_FRAMEWORK_IR_UNSUPPORTED'
);
assert.throws(
  () => emitPreactFromIR(ir, 'Not-A-Component'),
  error =>
    error instanceof FrameworkIrEmitterError &&
    error.code === 'E_FRAMEWORK_IR_INVALID'
);
const first = emitSvelteJsFromIR(ir);
const repeated = emitSvelteJsFromIR(ir);
assert.equal(first.schemaVersion, 'svger-svelte-js-emitter-v1');
assert.equal(first.outcome, 'complete');
assert.equal(first.supportedSubset, 'static-svg-ir-v1');
assert.equal(first.content, repeated.content, 'generation is deterministic');
assert.equal(first.outputBytes, Buffer.byteLength(first.content));
assert.equal(Object.isFrozen(first), true);
assert.match(first.content, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/u);
assert.match(
  first.content,
  /xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/u
);
assert.match(first.content, /<use xlink:href="#shape"><\/use>/u);
assert.match(first.content, /xml:space="preserve"/u);
const svelteTs = emitSvelteTsFromIR(ir);
assert.equal(svelteTs.schemaVersion, 'svger-svelte-ts-ir-emitter-v1');
assert.match(svelteTs.content, /^<script lang="ts">/u);
assert.match(svelteTs.content, /export let width: string \| number = 8/u);
assert.equal(
  compile(
    (
      await preprocessSvelte(
        svelteTs.content,
        {
          script: ({ content, attributes }) => ({
            code: ts.transpileModule(content, {
              compilerOptions: {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.ESNext,
              },
            }).outputText,
            attributes: { ...attributes, lang: undefined },
          }),
        },
        { filename: 'StaticIcon.svelte' }
      )
    ).code,
    {
      filename: 'StaticIcon.svelte',
      generate: 'dom',
    }
  ).js.code.length > 0,
  true
);
const tsDefaultRender = await renderSvelte(svelteTs.content);
assert.match(tsDefaultRender, /width="8"/u);
const tsOverrideRender = await renderSvelte(svelteTs.content, {
  width: '32',
  fill: 'orange',
});
assert.match(tsOverrideRender, /width="32"/u);
assert.match(tsOverrideRender, /fill="orange"/u);
assert.match(first.content, /<tspan xml:space="default">content<\/tspan>/u);
assert.match(first.content, /<script>/u);
assert.doesNotMatch(first.content, /<script[^>]*lang="ts"/u);
assert.match(first.content, /\{\.\.\.\$\$restProps\}/u);
const compiled = compile(first.content, {
  filename: 'StaticIcon.svelte',
  generate: 'dom',
});
assert.equal(typeof compiled.js.code, 'string');
assert.equal(typeof VERSION, 'string');

const sourceAnalysis = analyzeStaticSvgSource(ir);
const candidateAnalysis = analyzeSvelteArtifact({
  path: 'StaticIcon.svelte',
  content: first.content,
});
assert.equal(sourceAnalysis.coverageStatus, 'complete');
assert.equal(sourceAnalysis.validity.status, 'valid');
assert.equal(
  candidateAnalysis.coverageStatus,
  'partial',
  'dynamic prop and rest-prop bindings are not statically oracle-qualified'
);
assert.equal(
  candidateAnalysis.validity.status,
  'unresolved',
  'native Svelte validity is supplemented by runtime contract tests'
);
assert.ok(candidateAnalysis.projection);
for (const dimension of ['text', 'namespaces', 'references', 'accessibility']) {
  assert.deepEqual(
    candidateAnalysis.projection[dimension],
    sourceAnalysis.projection[dimension],
    `dynamic bindings retain statically observed ${dimension}`
  );
}

// Legacy component props/defaults are part of the compatibility contract.
// SSR exercises actual Svelte prop behavior without a browser or new dependency.
const defaultRender = await renderSvelte(first.content);
assert.match(defaultRender, /class=""/u);
assert.match(defaultRender, /style=""/u);
assert.match(defaultRender, /width="8"/u);
assert.match(defaultRender, /height="8"/u);
assert.match(defaultRender, /fill="currentColor"/u);
assert.match(defaultRender, /stroke=""/u);
const overriddenRender = await renderSvelte(first.content, {
  className: 'custom-icon',
  style: 'color: red',
  width: 16,
  height: '20px',
  fill: 'tomato',
  stroke: 'navy',
  'aria-label': 'Overridden icon',
  'data-custom': 'forwarded',
});
for (const expected of [
  'class="custom-icon"',
  'style="color: red"',
  'width="16"',
  'height="20px"',
  'fill="tomato"',
  'stroke="navy"',
  'aria-label="Overridden icon"',
  'data-custom="forwarded"',
])
  assert.ok(overriddenRender.includes(expected), expected);
const defaultsIr = lower(
  '<svg xmlns="http://www.w3.org/2000/svg" width="12px" height="auto" fill="purple"/>',
  'legacy-defaults'
);
const defaultsOutput = emitSvelteJsFromIR(defaultsIr).content;
const sourceDefaultsRender = await renderSvelte(defaultsOutput);
for (const expected of [
  'width="12"',
  'height="auto"',
  'fill="purple"',
  'stroke=""',
])
  assert.ok(sourceDefaultsRender.includes(expected), expected);
const missingDimensionsOutput = emitSvelteJsFromIR(
  lower('<svg xmlns="http://www.w3.org/2000/svg"/>', 'missing-dimensions')
).content;
const missingDimensionsRender = await renderSvelte(missingDimensionsOutput);
assert.match(missingDimensionsRender, /width="24"/u);
assert.match(missingDimensionsRender, /height="24"/u);
const scriptLikeAttributeIr = lower(
  '<svg xmlns="http://www.w3.org/2000/svg" fill="&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;"/>',
  'script-like-prop-default'
);
const scriptLikeAttributeOutput = emitSvelteJsFromIR(scriptLikeAttributeIr);
assert.match(scriptLikeAttributeOutput.content, /\\u003c\/script>/u);
assert.doesNotMatch(
  scriptLikeAttributeOutput.content,
  /<script>\s*export let fill = "<\/script>/u
);
compile(scriptLikeAttributeOutput.content, {
  filename: 'ScriptLikeDefault.svelte',
  generate: 'dom',
});

// The legacy generator remains the compatibility baseline. Its prop-driven
// markup is valid but outside the static oracle's complete projection; record
// that limitation rather than treating missing observations as equality.
const processor = new SVGProcessor({ logger: new NullLogger() });
const legacy = await processor.generateComponent('StaticIcon', staticSvg, {
  framework: 'svelte',
  typescript: false,
  optimizationLevel: 'none',
});
assert.equal(
  compile(legacy, { filename: 'LegacyIcon.svelte', generate: 'dom' }).js.code
    .length > 0,
  true
);
const legacyDefaultRender = await renderSvelte(legacy);
for (const expected of [
  'class=""',
  'style=""',
  'width="8"',
  'height="8"',
  'fill="currentColor"',
  'stroke=""',
])
  assert.ok(legacyDefaultRender.includes(expected), expected);
const legacyOverrideRender = await renderSvelte(legacy, {
  className: 'custom-icon',
  style: 'color: red',
  width: 16,
  height: '20px',
  fill: 'tomato',
  stroke: 'navy',
  'aria-label': 'Overridden icon',
});
for (const expected of [
  'class="custom-icon"',
  'style="color: red"',
  'width="16"',
  'height="20px"',
  'fill="tomato"',
  'stroke="navy"',
  'aria-label="Overridden icon"',
])
  assert.ok(legacyOverrideRender.includes(expected), expected);
const legacyAnalysis = analyzeSvelteArtifact({
  path: 'LegacyIcon.svelte',
  content: legacy,
});
assert.notEqual(legacy, first.content);
assert.notEqual(legacyAnalysis.coverageStatus, 'complete');
assert.equal(legacyAnalysis.coverage.text, 'complete');
assert.deepEqual(
  legacyAnalysis.projection.text.map(({ path, value }) => ({ path, value })),
  candidateAnalysis.projection.text.map(({ path, value }) => ({ path, value })),
  'legacy and IR emitters preserve observed text values and order'
);
assert.notDeepEqual(
  legacyAnalysis.projection.text.map(({ xmlSpace }) => xmlSpace),
  candidateAnalysis.projection.text.map(({ xmlSpace }) => xmlSpace),
  'the candidate preserves inherited xml:space that the legacy output loses'
);
assert.notDeepEqual(
  legacyAnalysis.projection.accessibility,
  candidateAnalysis.projection.accessibility,
  'the candidate preserves source accessibility metadata omitted by legacy output'
);

// Text and attribute data that resembles a Svelte expression remains literal.
const bracesIr = lower(
  '<svg xmlns="http://www.w3.org/2000/svg"><title>{not an expression}</title><path aria-label="{literal}" d="M0 0"/></svg>',
  'braces'
);
const bracesOutput = emitSvelteJsFromIR(bracesIr).content;
assert.match(bracesOutput, /&#123;not an expression&#125;/u);
assert.match(bracesOutput, /aria-label="&#123;literal&#125;"/u);
compile(bracesOutput, { filename: 'Braces.svelte', generate: 'dom' });
const bracesAnalysis = analyzeSvelteArtifact({
  path: 'Braces.svelte',
  content: bracesOutput,
});
assert.equal(
  bracesAnalysis.validity.status,
  'unresolved',
  'static oracle does not claim to resolve the component prop bindings'
);
assert.equal(bracesAnalysis.projection.text[0].value, '{not an expression}');

// Unsupported or invalid semantic states fail explicitly, never by dropping
// nodes, attributes, references or behavior.
expectEmitterError(
  () => emitSvelteJsFromIR({ version: 'wrong' }),
  'E_SVELTE_IR_INVALID'
);
expectEmitterError(
  () =>
    emitSvelteJsFromIR(
      lower('<svg xmlns="http://www.w3.org/2000/svg"><widget/></svg>')
    ),
  'E_SVELTE_IR_UNSUPPORTED'
);
expectEmitterError(
  () =>
    emitSvelteJsFromIR(
      lower(
        '<svg xmlns="http://www.w3.org/2000/svg"><use href="#missing"/></svg>'
      )
    ),
  'E_SVELTE_IR_REFERENCE'
);
expectEmitterError(
  () =>
    emitSvelteJsFromIR(
      lower(
        '<svg xmlns="http://www.w3.org/2000/svg"><g id="same"/><path id="same"/></svg>'
      )
    ),
  'E_SVELTE_IR_REFERENCE'
);
expectEmitterError(
  () =>
    emitSvelteJsFromIR(
      lower(
        '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><path fill="url(#g)" d="M0 0"/></svg>'
      )
    ),
  'E_SVELTE_IR_UNSUPPORTED'
);
expectEmitterError(
  () => emitSvelteJsFromIR(ir, { maxOutputBytes: 1 }),
  'E_SVELTE_IR_LIMIT'
);

// A moderately large static tree provides reproducible, informational timing
// and output-size evidence without a host-sensitive pass/fail threshold.
const stressSource = `<svg xmlns="http://www.w3.org/2000/svg">${Array.from(
  { length: 750 },
  (_, index) => `<path data-index="${index}" d="M0 0h1v1z"/>`
).join('')}</svg>`;
const stressIr = lower(stressSource, 'stress-750-paths');
const heapBefore = process.memoryUsage().heapUsed;
const started = performance.now();
const stressOutput = emitSvelteJsFromIR(stressIr);
const generationMs = performance.now() - started;
const heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;
assert.equal(stressOutput.outcome, 'complete');
assert.ok(stressOutput.outputBytes < 16 * 1024 * 1024);
const stressSourceAnalysis = analyzeStaticSvgSource(stressIr);
const stressArtifactAnalysis = analyzeSvelteArtifact({
  path: 'Stress.svelte',
  content: stressOutput.content,
});
assert.equal(
  stressSourceAnalysis.coverage.attributes,
  'partial',
  'safe data-* attributes remain outside the source oracle grammar'
);
assert.equal(
  stressArtifactAnalysis.coverage.attributes,
  'partial',
  'successful emission does not claim complete attribute semantics'
);
console.log(
  JSON.stringify({
    phase4Emitter: 'svelte-js-ir-v1',
    nodes: 750,
    generationMs: Number(generationMs.toFixed(3)),
    outputBytes: stressOutput.outputBytes,
    heapDeltaBytes,
    threshold: 'informational-only',
  })
);

console.log('Phase 04.1 Svelte-JS IR emitter regressions passed.');
