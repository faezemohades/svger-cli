import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse as parseJavaScript } from '@babel/parser';
import ts from 'typescript';
import {
  parse as parseVue,
  compileScript,
  compileTemplate,
} from '@vue/compiler-sfc';
import {
  compile as compileSvelte,
  preprocess as preprocessSvelte,
} from 'svelte/compiler';
import { parseTemplate as parseAngularTemplate } from '@angular/compiler';
import {
  frameworkTemplateEngine,
  svgProcessor,
  createSVGCompiler,
  SvgerWebpackPlugin,
  svgerVitePlugin,
  svgerRollupPlugin,
  svgerBabelPlugin,
} from '../../dist/index.js';

const fixture = await fs.mkdtemp(
  path.join(os.tmpdir(), 'svger-language-contract-')
);
const sourceDir = path.join(fixture, 'source');
await fs.mkdir(sourceDir);
const svg =
  '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M0 0h24v24H0z" /></svg>';
await fs.writeFile(path.join(sourceDir, 'contract.svg'), svg);
const semanticSvg =
  '<svg viewBox="0 0 24 24"><!-- nonessential XML comment --><title>  A &amp; B  </title><text>line one\n  &lt;tag&gt; {curly} `tick` ${literal}<tspan>nested &amp; text</tspan></text><text><![CDATA[raw <text> {value} & `tick` ${literal}]]></text></svg>';
await fs.writeFile(path.join(sourceDir, 'semantic.svg'), semanticSvg);
const literalSvg =
  '<svg width="100%" height="2em" viewBox="0 0 24 24 &quot;quoted&quot; &apos;apostrophe&apos; &amp;" fill="red &quot;quoted&quot; &apos;apostrophe&apos; &amp; line&#10;next"><path d="M0 0"/></svg>';
await fs.writeFile(path.join(sourceDir, 'literal.svg'), literalSvg);
const inertStyle =
  '.icon { fill: red; --template: "{{notAnExpression}}"; content: "${notAnExpression} `tick` a\\b"; }';
const styleSvg = `<svg viewBox="0 0 24 24"><style>${inertStyle}</style><path class="icon" d="M0 0"/></svg>`;

const frameworks = [
  'react',
  'react-native',
  'vue',
  'svelte',
  'angular',
  'solid',
  'preact',
  'lit',
  'vanilla',
];

function parseJS(source, fileName) {
  try {
    parseJavaScript(source, {
      sourceType: 'module',
      sourceFilename: fileName,
      plugins: ['jsx', 'decorators-legacy'],
    });
  } catch (error) {
    error.message = `${fileName}: ${error.message}`;
    throw error;
  }
}

function checkTypeScript(source, fileName) {
  const virtualDir = path.resolve('tests/phase0');
  const filePath = path.join(
    virtualDir,
    `.conformance-${fileName.replace(/[^a-z0-9.-]/gi, '-')}`
  );
  const shimPath = path.join(virtualDir, '.conformance-framework-shims.d.ts');
  const shims = `
declare namespace JSX { interface IntrinsicElements { [name: string]: any } }
declare module 'react' {
  export type SVGProps<T> = { [key: string]: any; width?: string | number; height?: string | number; fill?: string; className?: string; style?: any };
  export type CSSProperties = { [key: string]: any };
  export type Ref<T> = any;
  const React: { forwardRef<T, P>(render: (props: P, ref: Ref<T>) => any): any; useMemo<T>(factory: () => T, deps: any[]): T };
  export default React;
  export function forwardRef<T, P>(render: (props: P, ref: Ref<T>) => any): any;
  export class Component<P = any> { props: P; render(): any }
}
declare module 'react/jsx-runtime' { export const jsx: any; export const jsxs: any; export const Fragment: any }
declare module 'react-native-svg' { class Svg { constructor(props: any) }; export default Svg; export type SvgProps = { [key: string]: any; width?: string | number; height?: string | number; fill?: string }; export const Path: any; export const Circle: any; export const Rect: any; export const Line: any; export const Polygon: any; export const Polyline: any; export const Ellipse: any; export const G: any; export const Defs: any; export const ClipPath: any; export const LinearGradient: any; export const RadialGradient: any; export const Stop: any }
declare module 'solid-js' { export type Component<P> = (props: P) => any; export namespace JSX { interface SvgSVGAttributes<T> { [key: string]: any } } }
declare module 'preact' { export type FunctionComponent<P> = (props: P) => any; export const h: any }
declare module 'preact/jsx-runtime' { export namespace JSX { interface SVGAttributes<T> { [key: string]: any } } }
declare module 'lit' { export class LitElement { static properties: any; static styles: any; render(): any } export const html: any; export const css: any; export const svg: any }
declare module 'lit/decorators.js' { export function customElement(name: string): ClassDecorator; export function property(options?: any): PropertyDecorator }
declare function defineProps<T>(): T;
declare function defineProps(options: any): any;
declare function withDefaults<T>(props: T, defaults: any): T;
`;
  const options = {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    experimentalDecorators: true,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (
    requested,
    languageVersion,
    onError,
    shouldCreateNewSourceFile
  ) => {
    if (path.resolve(requested) === filePath) {
      return ts.createSourceFile(requested, source, languageVersion, true);
    }
    if (path.resolve(requested) === shimPath) {
      return ts.createSourceFile(requested, shims, languageVersion, true);
    }
    return originalGetSourceFile(
      requested,
      languageVersion,
      onError,
      shouldCreateNewSourceFile
    );
  };
  host.fileExists = (
    original => requested =>
      path.resolve(requested) === filePath ||
      path.resolve(requested) === shimPath ||
      original(requested)
  )(host.fileExists.bind(host));
  host.readFile = (original => requested =>
    path.resolve(requested) === filePath
      ? source
      : path.resolve(requested) === shimPath
        ? shims
        : original(requested))(host.readFile.bind(host));
  const program = ts.createProgram([filePath, shimPath], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(
    diagnostics.map(diagnostic =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    ),
    [],
    `${fileName} has TypeScript semantic errors`
  );
}

function vueCompile(source, filename) {
  const parsed = parseVue(source, { filename });
  assert.deepEqual(parsed.errors, [], `${filename} failed Vue SFC parsing`);
  const descriptor = parsed.descriptor;
  assert.ok(descriptor.template, `${filename} has no template block`);
  const script =
    descriptor.script || descriptor.scriptSetup
      ? compileScript(descriptor, { id: 'svger-contract' })
      : undefined;
  const template = compileTemplate({
    source: descriptor.template.content,
    filename,
    id: 'svger-contract',
    compilerOptions: { bindingMetadata: script?.bindings },
  });
  assert.deepEqual(
    template.errors,
    [],
    `${filename} failed Vue template compilation`
  );
  parseJS(template.code, `${filename}.template.js`);
  const sourceScript = descriptor.scriptSetup || descriptor.script;
  if (sourceScript) {
    if (sourceScript.lang === 'ts') {
      checkTypeScript(sourceScript.content, `${filename}.script.ts`);
    } else {
      parseJS(sourceScript.content, `${filename}.script.js`);
    }
  }
}

async function svelteCompile(source, filename, typescript) {
  const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '';
  if (typescript) checkTypeScript(script, `${filename}.script.ts`);
  let component = source;
  if (typescript) {
    component = (
      await preprocessSvelte(
        source,
        {
          script: ({ content, attributes }) => {
            if (attributes.lang !== 'ts') return;
            const result = ts.transpileModule(content, {
              compilerOptions: {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.ESNext,
              },
            });
            return {
              code: result.outputText,
              attributes: { ...attributes, lang: undefined },
            };
          },
        },
        { filename }
      )
    ).code;
  }
  const compiled = compileSvelte(component, { filename, generate: 'dom' });
  assert.deepEqual(
    compiled.warnings,
    [],
    `${filename} produced Svelte warnings`
  );
  parseJS(compiled.js.code, `${filename}.compiled.js`);
}

function getAngularTemplateLiteral(source, filename) {
  const parsedSource = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  let templateLiteral;
  function visit(node) {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(parsedSource) === 'template' &&
      ts.isNoSubstitutionTemplateLiteral(node.initializer)
    ) {
      templateLiteral = node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(parsedSource);
  assert.ok(templateLiteral, 'Angular fixture did not find an inline template');
  return templateLiteral;
}

function angularCompile(source, filename) {
  checkTypeScript(source, filename);
  const templateLiteral = getAngularTemplateLiteral(source, filename);
  const result = parseAngularTemplate(templateLiteral.text, filename, {
    preserveWhitespaces: true,
  });
  assert.deepEqual(
    result.errors ?? [],
    [],
    `${filename} failed Angular template parsing`
  );
}

function validateGenerated(source, framework, typescript, extension) {
  assert.equal(
    frameworkTemplateEngine.getFileExtension(framework, typescript),
    extension
  );
  if (!typescript && framework !== 'vue' && framework !== 'svelte') {
    parseJS(source, `${framework}.js`);
  }
  if (framework === 'vue') {
    vueCompile(source, 'ContractIcon.vue');
  } else if (framework === 'svelte') {
    return svelteCompile(source, 'ContractIcon.svelte', typescript);
  } else if (framework === 'angular') {
    angularCompile(source, 'ContractIcon.component.ts');
  } else if (typescript) {
    checkTypeScript(source, `${framework}.${extension}`);
  }
}

for (const framework of frameworks) {
  for (const typescript of [false, true]) {
    if (framework === 'angular' && !typescript) {
      assert.throws(
        () =>
          frameworkTemplateEngine.generateComponent({
            framework,
            componentName: 'ContractIcon',
            svgContent: svg,
            typescript,
          }),
        error =>
          error?.code === 'E_UNSUPPORTED_LANGUAGE' &&
          /requires TypeScript/.test(error.message)
      );
      continue;
    }
    const source = frameworkTemplateEngine.generateComponent({
      framework,
      componentName: 'ContractIcon',
      svgContent: svg,
      typescript,
      frameworkOptions: { scriptSetup: true, standalone: true },
    });
    const extension = frameworkTemplateEngine.getFileExtension(
      framework,
      typescript
    );
    await validateGenerated(source, framework, typescript, extension);
  }
}

// Character-data semantics must survive framework emission and each target
// compiler, even where XML serialization (notably CDATA) is not valid template syntax.
for (const framework of frameworks) {
  for (const typescript of [false, true]) {
    if (framework === 'angular' && !typescript) continue;
    const generated = frameworkTemplateEngine.generateComponent({
      framework,
      componentName: 'SemanticIcon',
      svgContent: semanticSvg,
      typescript,
      frameworkOptions: { scriptSetup: true, standalone: true },
    });
    assert.equal(
      generated.includes('<![CDATA['),
      false,
      `${framework} removes XML-only CDATA syntax`
    );
    assert.equal(generated.includes('<!-- nonessential XML comment -->'), false);
    assert.ok(generated.includes('&lt;tag&gt; &#123;curly&#125;'));
    assert.match(generated, /raw &lt;text&gt; &#123;value&#125; &amp;/);
    await validateGenerated(
      generated,
      framework,
      typescript,
      frameworkTemplateEngine.getFileExtension(framework, typescript)
    );
  }
}

const withProcessingInstruction = frameworkTemplateEngine.generateComponent({
  framework: 'react',
  componentName: 'InstructionIcon',
  svgContent: '<svg><?svger internal?><text>visible</text></svg>',
  typescript: true,
});
assert.equal(withProcessingInstruction.includes('<?svger'), false);

// Root dimensions and string-valued attributes must remain literals, regardless
// of units, quotes, XML references, newlines, or template-expression markers.
for (const framework of frameworks) {
  for (const typescript of [false, true]) {
    if (framework === 'angular' && !typescript) continue;
    const generated = frameworkTemplateEngine.generateComponent({
      framework,
      componentName: 'LiteralIcon',
      svgContent: literalSvg,
      typescript,
      frameworkOptions: { scriptSetup: true, standalone: true },
    });
    assert.ok(generated.includes('100%'));
    assert.ok(generated.includes('2em'));
    await validateGenerated(
      generated,
      framework,
      typescript,
      frameworkTemplateEngine.getFileExtension(framework, typescript)
    );
  }
}

// Stylesheet text is supplied as inert text/bindings where framework templates
// recognize braces as expressions. Template-literal based generators must keep
// interpolation markers, backticks, and backslashes in the cooked literal.
// React Native has no supported SVG style
// element representation in this generator and must fail with an actionable code.
assert.throws(
  () =>
    frameworkTemplateEngine.generateComponent({
      framework: 'react-native',
      componentName: 'StyledIcon',
      svgContent: styleSvg,
      typescript: true,
    }),
  error =>
    error?.code === 'E_UNSUPPORTED_SVG_CONSTRUCT' &&
    /style/.test(error.message)
);
for (const framework of frameworks.filter(item => item !== 'react-native')) {
  for (const typescript of [false, true]) {
    if (framework === 'angular' && !typescript) continue;
    const generated = frameworkTemplateEngine.generateComponent({
      framework,
      componentName: 'StyledIcon',
      svgContent: styleSvg,
      typescript,
      frameworkOptions: { scriptSetup: true, standalone: true },
    });
    assert.ok(generated.includes('notAnExpression'));
    assert.ok(generated.includes('fill: red'));
    if (framework === 'angular') {
      const templateLiteral = getAngularTemplateLiteral(
        generated,
        'StyledIcon.component.ts'
      );
      assert.ok(
        templateLiteral.text.includes(
          `[textContent]="${JSON.stringify(inertStyle)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}"`
        ),
        'Angular text binding retains the exact JSON-encoded stylesheet'
      );
      assert.ok(
        templateLiteral.rawText.includes('\\${notAnExpression}') &&
          templateLiteral.rawText.includes('\\`tick\\`') &&
          templateLiteral.rawText.includes('a\\\\\\\\b'),
        'Angular source escapes interpolation, backticks, and backslashes'
      );
    }
    if (framework === 'lit') {
      const parsed = ts.createSourceFile(
        `StyledIcon.${typescript ? 'ts' : 'js'}`,
        generated,
        ts.ScriptTarget.Latest,
        true
      );
      let styleQuasi;
      function visit(node) {
        if (
          ts.isTaggedTemplateExpression(node) &&
          node.tag.getText(parsed) === 'svg' &&
          ts.isTemplateExpression(node.template)
        ) {
          styleQuasi = node.template.templateSpans
            .map(span => span.literal)
            .find(quasi => quasi.text.includes('.icon { fill: red;'));
          assert.equal(
            node.template.templateSpans.some(span =>
              span.expression.getText(parsed).includes('notAnExpression')
            ),
            false,
            'CSS interpolation marker is not a Lit template expression'
          );
        }
        ts.forEachChild(node, visit);
      }
      visit(parsed);
      assert.ok(styleQuasi, 'Lit style text must be in a template quasi');
      assert.ok(
        styleQuasi.text.includes(inertStyle),
        'Lit cooked template quasi retains exact stylesheet text'
      );
      assert.ok(
        styleQuasi.rawText.includes('\\${notAnExpression}') &&
          styleQuasi.rawText.includes('\\`tick\\`') &&
          styleQuasi.rawText.includes('a\\\\b'),
        'Lit source escapes interpolation, backticks, and backslashes'
      );
    }
    await validateGenerated(
      generated,
      framework,
      typescript,
      frameworkTemplateEngine.getFileExtension(framework, typescript)
    );
  }
}

// Public compiler generation writes component artifacts in the selected mode.
for (const framework of frameworks) {
  for (const typescript of [false, true]) {
    if (framework === 'angular' && !typescript) continue;
    const outputDir = path.join(fixture, `service-${framework}-${typescript}`);
    const compiler = await createSVGCompiler({
      cwd: fixture,
      config: { framework, typescript },
    });
    await compiler.build({
      src: sourceDir,
      out: outputDir,
      framework,
      typescript,
    });
    const extension = frameworkTemplateEngine.getFileExtension(
      framework,
      typescript
    );
    const artifactPath = path.join(outputDir, `Contract.${extension}`);
    const artifact = await fs.readFile(artifactPath, 'utf8');
    await validateGenerated(artifact, framework, typescript, extension);
    const semanticArtifact = await fs.readFile(
      path.join(outputDir, `Semantic.${extension}`),
      'utf8'
    );
    await validateGenerated(semanticArtifact, framework, typescript, extension);
    const literalArtifact = await fs.readFile(
      path.join(outputDir, `Literal.${extension}`),
      'utf8'
    );
    await validateGenerated(literalArtifact, framework, typescript, extension);
  }
}

// Each modified build integration is driven through its public lifecycle hook in JS and TS modes.
for (const integration of ['webpack', 'vite', 'rollup', 'babel']) {
  for (const typescript of [false, true]) {
    const outputDir = path.join(fixture, `${integration}-${typescript}`);
    const options = {
      source: sourceDir,
      output: outputDir,
      framework: 'react',
      typescript,
      generateIndex: true,
    };
    if (integration === 'webpack') {
      const plugin = new SvgerWebpackPlugin(options);
      let beforeCompile;
      plugin.apply({
        options: {},
        hooks: {
          beforeCompile: {
            tapPromise(_name, hook) {
              beforeCompile = hook;
            },
          },
        },
      });
      await beforeCompile();
    } else if (integration === 'vite') {
      await svgerVitePlugin(options).buildStart();
    } else if (integration === 'rollup') {
      await svgerRollupPlugin(options).buildStart();
    } else {
      const plugin = svgerBabelPlugin({}, options);
      await plugin.visitor.Program.enter();
    }
    const extension = typescript ? 'tsx' : 'jsx';
    const artifact = await fs.readFile(
      path.join(outputDir, `Contract.${extension}`),
      'utf8'
    );
    validateGenerated(artifact, 'react', typescript, extension);
    const semanticArtifact = await fs.readFile(
      path.join(outputDir, `Semantic.${extension}`),
      'utf8'
    );
    validateGenerated(semanticArtifact, 'react', typescript, extension);
    const literalArtifact = await fs.readFile(
      path.join(outputDir, `Literal.${extension}`),
      'utf8'
    );
    validateGenerated(literalArtifact, 'react', typescript, extension);
    await fs.access(path.join(outputDir, `index.${typescript ? 'ts' : 'js'}`));
  }
}

// Processor's public file path uses the same framework/language extension contract.
for (const framework of frameworks) {
  for (const typescript of [false, true]) {
    if (framework === 'angular' && !typescript) continue;
    const outputDir = path.join(
      fixture,
      `processor-${framework}-${typescript}`
    );
    await fs.mkdir(outputDir);
    const result = await svgProcessor.processSVGFile(
      path.join(sourceDir, 'contract.svg'),
      outputDir,
      { framework, typescript }
    );
    const extension = frameworkTemplateEngine.getFileExtension(
      framework,
      typescript
    );
    assert.ok(path.basename(result.filePath).endsWith(extension));
  }
}

await fs.rm(fixture, { recursive: true, force: true });
console.log('Generator conformance certification passed.');
