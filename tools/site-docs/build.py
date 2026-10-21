#!/usr/bin/env python3
"""Build the crawlable, dependency-free SVGER-CLI GitHub Pages site."""

from html import escape, unescape
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "docs-site"
BASE = "https://faezemohades.github.io/svger-cli/"

PAGES = {
    "index": ("SVG to component documentation", "Learn to generate framework components from SVG files with SVGER-CLI.", """
<p class="lead">SVGER-CLI converts admitted SVG files into source components for React, React Native, Vue, Angular, Svelte, Solid, Preact, Lit, and browser-native JavaScript.</p>
<div class="callout"><strong>Release status:</strong> package 4.1.0 is planned and unpublished. This site documents source behavior; it is not a release notice or npm availability guarantee.</div>
<h2>Start with a workflow</h2><p>Install the CLI, select a target framework, build a directory, and compile the generated files in the consuming application. SVGER generates source; it does not install framework runtimes.</p>
<pre><code>npm install --save-dev svger-cli
npx svger build ./icons ./src/components/icons --framework react --typescript</code></pre>
<h2>Choose a framework</h2><ul><li><a href="react.html">React and JSX</a> · <a href="react-native.html">React Native</a> · <a href="vue.html">Vue 3</a></li><li><a href="angular.html">Angular</a> · <a href="svelte.html">Svelte</a> · <a href="solid.html">Solid</a></li><li><a href="preact.html">Preact</a> · <a href="lit.html">Lit</a> · <a href="vanilla.html">Vanilla DOM</a></li></ul>
<h2>Documentation categories</h2><div class="card-grid"><a class="card" href="getting-started.html"><h3>Getting started</h3><p>Build your first set of components and verify the output.</p></a><a class="card" href="commands.html"><h3>CLI reference</h3><p>Commands, options, exit behavior, and safe workflows.</p></a><a class="card" href="configuration.html"><h3>Configuration</h3><p>Config files, precedence, naming, optimization, and examples.</p></a><a class="card" href="integrations.html"><h3>Build integrations</h3><p>Vite, Webpack, Rollup, Babel, Next.js, and Jest.</p></a><a class="card" href="security.html"><h3>SVG security</h3><p>Admission rules, external references, and trust boundaries.</p></a><a class="card" href="benchmark.html"><h3>Live local comparison</h3><p>Run real SVGER and SVGR transforms on 50, 100, or 170 files.</p></a></div>
<h2>What the benchmark does—and does not—claim</h2><p>GitHub Pages cannot measure the CPU and resident memory of local Node processes. The benchmark page connects only after you start its loopback companion; metrics come from fresh local Node child processes. Results are host-specific and may favor either implementation. No preselected winner or synthetic result is displayed.</p>
<h2>Support and limits</h2><p>Read the <a href="installation.html">installation guide</a>, <a href="optimization.html">compiler and optimization limits</a>, and <a href="troubleshooting.html">troubleshooting guide</a>. Input security, framework syntax validation, semantic coverage, and pixel comparison are distinct checks.</p>
"""),
    "getting-started": ("Getting started with SVGER-CLI", "A practical first build: install SVGER-CLI, choose a framework, generate components, and validate them in your application.", """
<p class="lead">This walkthrough takes an SVG folder to framework component files. Run commands from the consumer application's root so paths and configuration are predictable.</p>
<h2>1. Install the CLI</h2><pre><code>npm install --save-dev svger-cli</code></pre><p>The package supports Node.js according to its declared engine range. Use a currently supported Node LTS for production; see <a href="installation.html">installation and runtime guidance</a>.</p>
<h2>2. Organize source icons</h2><p>Place trusted <code>.svg</code> files in a dedicated folder such as <code>./assets/icons</code>. Keep originals in version control. The build discovers immediate children by default; use <code>--recursive</code> for nested folders.</p>
<h2>3. Generate one target</h2><pre><code>npx svger build ./assets/icons ./src/components/icons --framework react --typescript</code></pre><p>Choose one of the <a href="frameworks.html">supported output targets</a>. The target framework and its compiler remain the consuming app's responsibility.</p>
<h2>4. Compile and inspect generated files</h2><p>Run the app's own TypeScript/framework build and tests. Review accessibility labels, IDs and references, CSS assumptions, dimensions, and the generated diff. A successful conversion is not proof of browser-rendering equivalence.</p>
<h2>5. Make the build repeatable</h2><p>Commit configuration and generated outputs only if that matches your project policy. Use <code>--check</code> in CI to detect stale generated artifacts, and <code>--dry-run</code> to preview without writing.</p>
<pre><code>npx svger build ./assets/icons ./src/components/icons --framework react --check --format json</code></pre>
<p>Continue to <a href="commands.html">the command reference</a> or <a href="configuration.html">configuration guide</a>.</p>
"""),
    "installation": ("Install SVGER-CLI", "Install the SVGER-CLI package, check Node.js compatibility, and understand optional dependencies and package contents.", """
<p class="lead">SVGER-CLI is installed as a project tool. It emits component source but does not bundle React, Vue, Angular, Svelte, or other framework runtimes into your application.</p>
<h2>Install from npm</h2><pre><code>npm install --save-dev svger-cli
npx svger --version
npx svger --help</code></pre><p>Package publication is controlled independently from this documentation. Check the npm registry for the version currently available to your account.</p>
<h2>Runtime compatibility</h2><p>Use the <a href="https://nodejs.org/en/about/previous-releases">Node.js release table</a> and the package's <a href="https://github.com/faezemohades/svger-cli/blob/main/docs/SUPPORT-MATRIX.md">support matrix</a> when selecting a runtime. The declared compatibility floor and currently security-supported Node releases are different concepts.</p>
<h2>Optional visual validation</h2><p>Raster-based <code>--validate</code> is optional and needs compatible separately installed packages. Ordinary source generation does not require the rasterizer. See <a href="https://github.com/faezemohades/svger-cli/blob/main/docs/OPTIONAL-DEPENDENCIES.md">optional dependency requirements</a> before enabling it in CI.</p>
<h2>Development checkout</h2><p>Repository-only tests, benchmark tools, and the SVG sample corpus are not runtime dependencies. The sample corpus is maintained for project testing and is intentionally excluded from the npm package.</p>
"""),
    "frameworks": ("Framework support overview", "Compare SVGER-CLI output targets, file types, language modes, runtime requirements, and framework-specific setup.", """
<p class="lead">SVGER-CLI generates source files for nine target families. Install framework runtimes separately, then compile and test generated files in the consumer application.</p><table><thead><tr><th>Target</th><th>Common output</th><th>Key note</th><th>Guide</th></tr></thead><tbody><tr><td>React</td><td>JSX / TSX</td><td>Compile with your app's React toolchain</td><td><a href="react.html">React guide</a></td></tr><tr><td>React Native</td><td>JSX / TSX</td><td>Requires react-native-svg in the app</td><td><a href="react-native.html">React Native guide</a></td></tr><tr><td>Vue</td><td>.vue</td><td>Composition API option available</td><td><a href="vue.html">Vue guide</a></td></tr><tr><td>Angular</td><td>.component.ts</td><td>TypeScript required</td><td><a href="angular.html">Angular guide</a></td></tr><tr><td>Svelte</td><td>.svelte</td><td>Legacy remains default</td><td><a href="svelte.html">Svelte guide</a></td></tr><tr><td>Solid</td><td>JSX / TSX</td><td>Validate with the Solid compiler</td><td><a href="solid.html">Solid guide</a></td></tr><tr><td>Preact</td><td>JSX / TSX</td><td>Use Preact's JSX runtime</td><td><a href="preact.html">Preact guide</a></td></tr><tr><td>Lit</td><td>.js / .ts</td><td>Web component output</td><td><a href="lit.html">Lit guide</a></td></tr><tr><td>Vanilla DOM</td><td>.js / .ts</td><td>Requires browser DOM at runtime</td><td><a href="vanilla.html">Vanilla guide</a></td></tr></tbody></table><p>TypeScript is selected by default where supported. Use <code>--no-typescript</code> for JavaScript. Unsupported combinations return diagnostics instead of silently selecting another framework.</p><p>Framework compiler and runtime conformance depends on the support matrix and version; see <a href="installation.html">runtime guidance</a> and <a href="troubleshooting.html">troubleshooting</a>.</p>
"""),
    "react": ("Generate React SVG components", "Generate JSX or TSX React components from SVG files with SVGER-CLI, including accessibility and validation guidance.", """
<p class="lead">React output is generated as JavaScript or TypeScript component source. Install React and its compiler in the consuming application; SVGER-CLI does not add them as runtime dependencies.</p>
<h2>TypeScript TSX</h2><pre><code>npx svger build ./icons ./src/icons --framework react --typescript</code></pre><h2>JavaScript JSX</h2><pre><code>npx svger build ./icons ./src/icons --framework react --no-typescript</code></pre>
<p>Use components with standard React imports from generated files. Check the output against your JSX runtime, lint rules, accessibility requirements, and the React version in your application. Review <code>viewBox</code>, title/label behavior, IDs, gradients, and references for each icon set.</p><h2>Single icon</h2><pre><code>npx svger generate ./icons/search.svg ./src/icons --framework react --typescript</code></pre>
<p>For shared build pipelines, see <a href="integrations.html">Vite, Webpack, Rollup, Babel, Next.js, and Jest integration examples</a>. For all framework outputs see <a href="frameworks.html">the framework overview</a>.</p>
"""),
    "react-native": ("Generate React Native SVG components", "Create React Native component source from SVG files and learn the react-native-svg runtime requirement.", """
<p class="lead">React Native output uses React Native SVG primitives. The consuming application must install and configure <code>react-native-svg</code>; generated source alone does not provide that runtime.</p><pre><code>npx svger build ./icons ./src/icons --framework react-native --typescript</code></pre><p>Use <code>--no-typescript</code> for JavaScript output when supported by the target configuration.</p><h2>Validate in the actual app</h2><p>Native renderers differ from browser SVG. Compile with the app's React Native toolchain and test representative icons on supported platforms. Check gradients, masks, clipping, text, external references, and unsupported SVG features rather than assuming browser support maps exactly to native output.</p><h2>Security and asset handling</h2><p>SVG input is admitted before generation. External references are restricted by default. Review the <a href="security.html">security guide</a> and <a href="frameworks.html">framework overview</a>.</p>
"""),
    "vue": ("Generate Vue 3 SVG components", "Generate Vue single-file components from SVG files using Options or Composition API output.", """
<p class="lead">Vue output uses <code>.vue</code> single-file components. Select Composition API script setup or the default component style where offered.</p><h2>Composition API</h2><pre><code>npx svger build ./icons ./src/icons --framework vue --typescript --composition</code></pre><h2>JavaScript output</h2><pre><code>npx svger build ./icons ./src/icons --framework vue --no-typescript --composition</code></pre><p>Compile generated files with the Vue compiler version and bundler used by your app. Check component naming, props, SVG accessibility semantics, styling assumptions, IDs, and resource references in the generated output.</p><h2>Build integration</h2><p>Use the <a href="integrations.html">Vite or Webpack integration guide</a> for build-time imports. See <a href="configuration.html">configuration precedence</a> for persistent framework defaults.</p>
"""),
    "angular": ("Generate Angular SVG components", "Generate TypeScript Angular components from SVG files, including standalone component workflows.", """
<p class="lead">Angular generation requires TypeScript; JavaScript output is not supported for this target. The CLI creates source components and does not replace Angular workspace configuration.</p><pre><code>npx svger build ./icons ./src/app/icons --framework angular --typescript --standalone</code></pre><p>Use <code>--standalone</code> when appropriate for the target application. Compile with the app's Angular CLI and verify generated imports and metadata in that workspace.</p><h2>Module-based applications</h2><p>Omit <code>--standalone</code> when the output is intended for a module-oriented setup, then register components according to that application's architecture. Validate selectors, naming collisions, and accessibility behavior.</p><h2>Support</h2><p>Supported major lines are maintained in the <a href="https://github.com/faezemohades/svger-cli/blob/main/docs/SUPPORT-MATRIX.md">support matrix</a>; compatibility outside that matrix may work but is not release-gated.</p>
"""),
    "svelte": ("Generate Svelte SVG components", "Generate Svelte components from SVG files and understand the default legacy path and explicit experimental IR mode.", """
<p class="lead">SVGER-CLI writes <code>.svelte</code> component files. The legacy generator remains the default; the source candidate also has an explicitly selected static IR-v1 path for supported cases.</p><h2>Default generation</h2><pre><code>npx svger build ./icons ./src/lib/icons --framework svelte --typescript</code></pre><p>Use <code>--no-typescript</code> for JavaScript components. Compile output with the Svelte toolchain in the consuming project.</p><h2>Explicit IR-v1 opt-in</h2><p>There is no dedicated CLI switch. Set <code>svelteCompiler: "ir-v1"</code> in <code>.svgconfig.json</code> or call the public compiler API with that option. Unsupported static constructs are rejected rather than silently falling back. This is not a claim of full dynamic-Svelte, CSS-cascade, browser rendering, or accessibility equivalence.</p><pre><code>{ "framework": "svelte", "typescript": false, "svelteCompiler": "ir-v1" }</code></pre><p>Read the <a href="optimization.html">compiler limits</a> and <a href="benchmark.html">live benchmark methodology</a> before comparing modes.</p>
"""),
    "solid": ("Generate Solid SVG components", "Generate Solid JSX or TSX component source from SVG files and validate it with your Solid toolchain.", """
<p class="lead">Solid output is generated as JavaScript or TypeScript component source. Install Solid and its build tooling in the consuming app.</p><pre><code>npx svger build ./icons ./src/icons --framework solid --typescript
npx svger build ./icons ./src/icons-js --framework solid --no-typescript</code></pre><p>Build the generated source with the same Solid compiler and JSX settings as the application. Verify props, SVG attributes, references, and accessibility behavior with representative inputs.</p><p>The <code>--signals</code> option is available on the build command for applicable generator behavior; consult <code>svger build --help</code> for the installed version. See <a href="configuration.html">configuration</a> and <a href="commands.html">commands</a>.</p>
"""),
    "preact": ("Generate Preact SVG components", "Create Preact JSX or TSX components from SVG icons using SVGER-CLI.", """
<p class="lead">Preact components are emitted as JSX or TSX source. Keep Preact, JSX transform settings, and any compatibility layer configured in the application itself.</p><pre><code>npx svger build ./icons ./src/icons --framework preact --typescript
npx svger build ./icons ./src/icons-js --framework preact --no-typescript</code></pre><p>Compile and render representative output with the project's Preact toolchain. Do not infer React runtime compatibility from syntactic JSX similarity.</p><p>See <a href="integrations.html">bundler integrations</a> and the <a href="frameworks.html">framework overview</a>.</p>
"""),
    "lit": ("Generate Lit SVG web components", "Generate Lit TypeScript or JavaScript web components from SVG source files.", """
<p class="lead">Lit output creates web component source. The consuming project must provide Lit and a browser-compatible build environment.</p><pre><code>npx svger build ./icons ./src/icons --framework lit --typescript
npx svger build ./icons ./src/icons-js --framework lit --no-typescript</code></pre><p>Validate custom-element names, shadow DOM styling, attributes, accessibility semantics, and browser support in the application. Test generated components in the actual target browsers.</p><p>See <a href="security.html">input safety</a> and <a href="troubleshooting.html">troubleshooting</a>.</p>
"""),
    "vanilla": ("Generate vanilla JavaScript SVG components", "Generate framework-free browser DOM factories from SVG files using SVGER-CLI.", """
<p class="lead">Vanilla output uses standard browser DOM facilities instead of a component framework. Generated code still requires a browser DOM when executed.</p><pre><code>npx svger build ./icons ./src/icons --framework vanilla --typescript
npx svger build ./icons ./src/icons-js --framework vanilla --no-typescript</code></pre><p>Review output in the browser environment where it will run. Server-side Node execution without a DOM is not implied. Keep event handling, IDs, external resource policy, and accessibility labels in view.</p><p>For framework output options, visit <a href="frameworks.html">frameworks</a>.</p>
"""),
    "commands": ("SVGER-CLI command reference", "Reference for SVGER-CLI build, generate, watch, optimize, config, plugins, lock, recover, migrate, and clean commands.", """
<p class="lead">The binary names are <code>svger</code> and <code>svger-cli</code>. Use the installed version's help output as the authority for the command surface.</p><pre><code>svger --help
svger build &lt;src&gt; &lt;out&gt; --framework react --typescript
svger generate ./icons/search.svg ./src/icons --framework svelte
svger watch ./icons ./src/icons</code></pre>
<h2>Build options</h2><p><code>--framework</code> selects react, react-native, vue, angular, svelte, solid, preact, lit, or vanilla. TypeScript is the default where supported; use <code>--no-typescript</code> for JavaScript. Vue supports <code>--composition</code>, Angular supports <code>--standalone</code>. Builds also accept optimization, validation, include/exclude globs, recursion, hidden-file and symlink policies, collision policy, concurrency, file-count limits, dry-run/check/diff modes, and report formats.</p>
<h2>Maintenance</h2><pre><code>svger optimize ./icon.svg ./out/icon.svg --level balanced
svger config --init
svger plugins
svger lock ./icons/logo.svg
svger unlock ./icons/logo.svg
svger recover ./src/icons --format json
svger migrate config .svgconfig.json --dry-run
svger clean ./src/icons</code></pre><p><code>clean</code> removes generated files from the chosen directory. Check the path before running it. Plugins execute with the invoking user's process permissions; load only trusted code. Deprecated aliases may warn. Read the complete <a href="https://github.com/faezemohades/svger-cli/blob/main/docs/CLI-REFERENCE.md">CLI reference source</a> for exact flags and migration behavior.</p>
"""),
    "configuration": ("SVGER-CLI configuration guide", "Configure framework, TypeScript, naming, optimization, file discovery, and compiler behavior for repeatable SVG builds.", """
<p class="lead">SVGER reads <code>.svgconfig.json</code> from the working directory. Command options and project config combine into effective settings; inspect origins with <code>config --explain</code>.</p><pre><code>npx svger config --init
npx svger config --set framework=vue
npx svger config --set typescript=false
npx svger config --set outputConfig.naming=kebab
npx svger config --explain framework --format json</code></pre>
<h2>Example configuration</h2><pre><code>{
  "framework": "react",
  "typescript": true,
  "optimizationLevel": "basic",
  "recursive": false,
  "outputConfig": { "naming": "pascal" }
}</code></pre><p>Use options supported by the installed version. Keep environment-specific paths in command invocations rather than sharing private machine paths in committed configs.</p>
<h2>Reproducibility and discovery</h2><p>Hidden files are skipped and symlinks ignored by default. Set recursive/include/exclude rules deliberately; enforce sensible file-count and input-size limits. Default output-name collisions fail so you can resolve ambiguous names explicitly.</p><p>See <a href="commands.html">CLI options</a>, <a href="optimization.html">optimization levels</a>, and <a href="security.html">security policy</a>.</p>
"""),
    "api": ("SVGER-CLI programmatic API", "Use the public createSVGCompiler API to build components, inspect resolved configuration, and consume structured reports.", """
<p class="lead">The public package root exports <code>createSVGCompiler</code>. It creates a scoped compiler service with <code>build()</code> and <code>config.explain()</code>.</p><pre><code>import { createSVGCompiler } from 'svger-cli';

const compiler = await createSVGCompiler({ cwd: process.cwd() });
const report = await compiler.build({
  src: './icons',
  out: './src/generated/icons',
  framework: 'react',
  typescript: true,
});
console.log(report.status, report.artifacts.length);</code></pre>
<p>Request fields include source/output paths, framework, language, optimization, selection, concurrency and safety policy. Validate reports and handle failure status in the calling application. Internal compiler modules are not public imports; rely on declarations from the installed package.</p><h2>Configuration explanation</h2><pre><code>const entries = compiler.config.explain({ framework: 'svelte' });</code></pre><p>For method signatures, inspect the installed <code>dist/index.d.ts</code>. Browse the generated <a href="https://faezemohades.github.io/svger-cli/api/">API reference</a> if present in the deployment, or the repository's TypeDoc output.</p>
"""),
    "integrations": ("Bundler and test integrations", "Configure SVGER-CLI with Vite, Webpack, Rollup, Babel, Next.js, and Jest using package subpath imports.", """
<p class="lead">Use documented integration subpaths instead of running the CLI from a build hook. Integrations execute in the toolchain process; configure file scope and only load trusted plugins.</p>
<h2>Vite</h2><pre><code>import { svgerVitePlugin } from 'svger-cli/vite';
export default { plugins: [svgerVitePlugin({ source: './src/icons', framework: 'react' })] };</code></pre>
<h2>Webpack</h2><pre><code>const { SvgerWebpackPlugin } = require('svger-cli/webpack');
module.exports = { plugins: [new SvgerWebpackPlugin({ source: './src/icons', output: './src/generated' })] };</code></pre>
<h2>Other integrations</h2><p>Package subpaths are <code>svger-cli/rollup</code>, <code>svger-cli/babel</code>, <code>svger-cli/nextjs</code>, and <code>svger-cli/jest</code>. Confirm options and compatibility against the installed version and the <a href="https://github.com/faezemohades/svger-cli/blob/main/docs/INTEGRATIONS.md">full integration guide</a>. Integrations are release-gated against the documented toolchain matrix; using a different major may work without being covered.</p><p>Build plugins can write generated files or transform SVG imports depending on integration mode. Review source and destination paths, watch/HMR behavior, and CI permissions before enabling writes.</p>
"""),
    "plugins": ("SVGER-CLI plugin guide", "Develop and use SVGER-CLI plugins safely, with hook examples, lifecycle guidance, and trust-boundary notes.", """
<p class="lead">Plugins extend processing hooks and run in the same process as SVGER-CLI. A plugin is executable code with the permissions of the invoking user—there is no plugin sandbox.</p><h2>Load a plugin</h2><pre><code>svger plugins
svger plugins --load ./plugins/my-plugin.js
svger build ./icons ./out --plugin optimize,minify</code></pre><p>Only install or load plugins from sources you trust. Pin versions and review transitive packages; do not treat a plugin name or TypeScript type as a security boundary.</p><h2>Development</h2><p>Implement declared hooks, validate plugin metadata, avoid ambient network/filesystem access unless necessary, and return bounded diagnostics. Test hook ordering, errors, cleanup and repeated builds. See the <a href="https://github.com/faezemohades/svger-cli/blob/main/docs/PLUGIN-DEVELOPMENT-GUIDE.md">plugin development guide</a> for types and lifecycle contracts.</p><h2>Operational boundary</h2><p>Plugins receive no separate OS identity and are not isolated from the CLI. For high-risk untrusted plugin code, do not load it in a process containing credentials or sensitive paths.</p>
"""),
    "optimization": ("SVG compiler and optimization limits", "Understand SVGER-CLI optimization levels, Svelte IR opt-in status, semantic limits, and framework validation requirements.", """
<p class="lead">Optimization rewrites SVG source; generation converts admitted input into framework syntax. Neither operation proves full browser behavior or pixel equivalence.</p><h2>Optimization levels</h2><p>Choose <code>none</code>, <code>basic</code>, <code>balanced</code>, <code>aggressive</code>, or <code>maximum</code> according to your tolerance for source changes. Preserve originals and validate output with your target renderer and application tests.</p><h2>Svelte IR-v1</h2><p>The experimental static IR emitter is an explicit opt-in for Svelte only. Legacy remains default. Other framework IR emitters remain experiments and are not production routes. Unsupported IR syntax fails closed; it does not silently fall back.</p><h2>Coverage boundaries</h2><p>Static SVG conversion is not a browser, CSS cascade engine, external-resource resolver, or universal semantic analyzer. Text, references, CSS, filters, masks, foreign content and accessibility can have nuanced behavior. Review the <a href="security.html">security policy</a> and run target framework compilation.</p><h2>Benchmark interpretation</h2><p>Use <a href="benchmark.html">live local benchmarks</a> to compare actual transforms on your machine. This site does not promise SVGER is faster: it reports measured wall time, CPU time, sampled RSS, output bytes, and successes for both implementations.</p>
"""),
    "migration": ("Migration and compatibility guide", "Migrate earlier SVGER-CLI configuration and command usage while preserving reproducible output and release compatibility.", """
<p class="lead">Before migrating, commit existing configuration and generated output, then run a preview. This project maintains a compatibility baseline; do not assume planned changes are published.</p><pre><code>svger migrate config .svgconfig.json --dry-run
svger migrate config .svgconfig.json</code></pre><p>Migration targets include configuration, plugin declarations, and import forms. Backups are created by default for supported migrations. Review the report before accepting changes.</p><h2>Deprecated options</h2><p>V4 aliases such as <code>--src</code>, <code>--out</code>, and older naming flags may emit deprecation warnings. Prefer positional source/output arguments and configuration keys documented by the installed version.</p><h2>Version differences</h2><p>The documentation source may describe an unpublished candidate. Check <code>svger --version</code>, the package changelog, and the compatibility matrix before relying on new flags. See <a href="https://github.com/faezemohades/svger-cli/blob/main/docs/MIGRATION-4.0.0.md">the migration guide</a>.</p>
"""),
    "security": ("SVG input security and safe use", "Understand SVG admission, unsafe constructs, filesystem behavior, plugin trust, and limitations of SVGER-CLI security controls.", """
<p class="lead">SVG files are untrusted structured input. SVGER-CLI validates inputs before generation and rejects selected unsafe constructs by default. This is defense in depth, not a guarantee that arbitrary generated code is harmless.</p><h2>Default rejection</h2><p>Active content, event handlers, unsafe URI forms, malformed XML, external references, and resource-limit violations are handled by the input safety policy. Exact rules are version-specific. Keep dependencies patched and review the <a href="https://github.com/faezemohades/svger-cli/blob/main/docs/phase0-svg-input-security.md">security design record</a>.</p><h2>Strip mode is not a sanitizer</h2><p><code>--unsafe-input-policy strip</code> explicitly removes selected constructs and warns. Stripping can change meaning and does not establish semantic safety. Reject mode is preferred for ordinary workflows.</p><h2>Paths, outputs, and plugins</h2><p>Use isolated output directories, preserve backups, and review destructive commands such as <code>clean</code>. Build-tool plugins and extension code run with the host process permissions. Never load untrusted code in a process with secrets.</p><h2>Report security issues</h2><p>Follow the project's <a href="https://github.com/faezemohades/svger-cli/blob/main/SECURITY.md">security reporting policy</a>. Do not paste credentials or sensitive exploit material into public issues.</p>
"""),
    "troubleshooting": ("SVGER-CLI troubleshooting", "Resolve common SVGER-CLI install, framework, SVG admission, path, collision, and benchmark setup issues.", """
<h2>CLI not found</h2><p>Install the package in the project, then use <code>npx svger --help</code> or the local package manager's executable path. Check that Node.js and npm are available.</p><h2>Unsupported framework option</h2><p>Use one of the accepted framework identifiers listed on the <a href="frameworks.html">framework page</a>. For exact behavior, consult the installed CLI's help output.</p><h2>Unsafe SVG rejected</h2><p>Review the diagnostic and source. Prefer correcting/removing unsafe external references or active markup. Strip mode is an explicit lossy policy, not a general sanitizer.</p><h2>Output collision</h2><p>Two input names may map to the same output component name. Rename source files or select a documented collision policy deliberately; default behavior fails rather than silently overwriting.</p><h2>Generated component fails framework compilation</h2><p>Verify the framework version, TS/JS mode, framework-specific dependencies, and integration options. Compile in the target application and share a minimal sanitized fixture when requesting help.</p><h2>Live benchmark cannot connect</h2><p>Start the local companion after building the repository and installing its benchmark-only dependencies. Keep it on the loopback address and allow the documented Pages origin. No hosted server is provided by GitHub Pages.</p>
"""),
    "benchmark": ("Live SVGER vs SVGR benchmark", "Run real local SVGER-CLI and SVGR transforms on the same SVG corpus and compare time, CPU, sampled RSS, output size, and success counts.", """
<p class="lead">Select 50, 100, or 170 source SVGs and compare the real local SVGER-CLI processor with SVGR's core JSX transform. The test runs only after you start a local companion and press Run.</p><div class="callout"><strong>Local execution:</strong> GitHub Pages cannot execute Node packages or measure your process CPU/RAM. You must run the companion from a trusted clone. It binds to <code>127.0.0.1</code>; this page sends only the selected count, and result data stays in your browser.</div>
<label for="fixture-count">SVG file count</label><select id="fixture-count"><option value="50">50 files</option><option value="100">100 files</option><option value="170">170 files</option></select> <button id="run-benchmark" type="button">Run real comparison</button><p id="benchmark-status" role="status" aria-live="polite">Not connected. Start the local companion using the instructions below.</p><section id="benchmark-results" hidden aria-live="polite"></section><a id="download-report" hidden download="svger-local-comparison.json">Download this run's JSON</a>
<h2>Start the companion</h2><pre><code>npm run build
npm --prefix tools/site-benchmark ci --ignore-scripts
npm run benchmark:site</code></pre><p>For local preview, serve <code>docs-site</code> at <code>http://localhost:8000</code>; the companion permits that exact origin and the official project Pages origin. Check readiness from this page with the Run button; direct requests without an approved <code>Origin</code> are intentionally rejected.</p>
<h2>What the report measures</h2><p>Each engine runs in a fresh child process and receives the same deterministically sorted SVG inputs. The report includes wall time and Node process user/system CPU time for the transform loop, plus core-equivalent utilization (process CPU time divided by wall time; it is not whole-system CPU utilization), sampled peak resident set size (RSS), output bytes, output SHA-256, success/failure count, Node/package versions, and a fixture digest. Input loading, package import/startup and filesystem writes are excluded from timing; RSS includes the imported runtime and package baseline. RSS is sampled every 10ms and may miss short peaks, so it is not exact peak memory consumption.</p><h2>Fair interpretation</h2><p>Both engines generate React JavaScript in memory with a documented configuration. Different products can have different semantics, optimization defaults, error handling and generated output; this workload is not a security-equivalence test. If either implementation fails any input, the report shows counts and withholds a wall-time winner. Otherwise it reports the lower measured wall time for this run only. Do not treat results as a universal ranking or guaranteed advantage.</p><h2>Alternative implementation</h2><p>This comparison uses SVGR's <code>@svgr/core</code> and JSX plugin, version-pinned in the benchmark-only tool. Installing them does not modify SVGER-CLI's runtime dependencies or published package.</p>
"""),
}

NAV = [
    ("Overview", "index.html"), ("Get started", "getting-started.html"),
    ("Commands", "commands.html"), ("Frameworks", "react.html"),
    ("Integrations", "integrations.html"), ("Security", "security.html"),
    ("Live benchmark", "benchmark.html"),
]

def shell(slug, title, description, body):
    url = BASE if slug == "index" else f"{BASE}{slug}.html"
    nav = "".join(f'<a href="{escape(href)}">{escape(label)}</a>' for label, href in NAV)
    schema = json.dumps({
        "@context": "https://schema.org", "@type": "TechArticle",
        "headline": title, "description": description,
        "mainEntityOfPage": url, "publisher": {"@type": "Organization", "name": "SVGER-CLI"},
    }, ensure_ascii=False)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} | SVGER-CLI</title><meta name="description" content="{escape(description)}">
<link rel="canonical" href="{escape(url)}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="article"><meta property="og:title" content="{escape(title)}"><meta property="og:description" content="{escape(description)}"><meta property="og:url" content="{escape(url)}"><meta property="og:site_name" content="SVGER-CLI">
<meta name="twitter:card" content="summary"><link rel="icon" href="svger-cli-logo.png"><link rel="stylesheet" href="styles.css">
<script type="application/ld+json">{schema}</script>
</head><body><a class="skip-link" href="#main">Skip to content</a>
<header><a class="brand" href="index.html">SVGER-CLI Docs</a><nav aria-label="Main navigation">{nav}</nav>
<form id="site-search" role="search"><label class="visually-hidden" for="search-query">Search documentation</label><input id="search-query" type="search" placeholder="Search docs" autocomplete="off"><button>Search</button><ul id="search-results" hidden></ul></form></header>
<main id="main"><p class="eyebrow">Documentation · source-candidate behavior</p><h1>{escape(title)}</h1>{body}
<p class="source-link">Related source and version caveats: <a href="https://github.com/faezemohades/svger-cli">SVGER-CLI repository</a>.</p></main>
<footer><p>Static documentation, no telemetry. Benchmark runs only on request through the local companion. Planned 4.1.0 documentation; package availability may differ.</p><a href="index.html">Documentation home</a></footer>
<script src="search.js" defer></script>{'<script src="benchmark.js" defer></script>' if slug == 'benchmark' else ''}</body></html>'''

SITE.mkdir(parents=True, exist_ok=True)
for slug, (title, description, body) in PAGES.items():
    (SITE / f"{slug}.html").write_text(shell(slug, title, description, body), encoding="utf-8")

# Keep stable links from the previous site while directing crawlers to the new canonical pages.
aliases = {"optimizer.html": "optimization.html", "benchmark-demo.html": "benchmark.html"}
for alias, target in aliases.items():
    name = target.removesuffix(".html")
    title, description, _ = PAGES[name]
    (SITE / alias).write_text(
        f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)} | SVGER-CLI</title><meta name="description" content="{escape(description)}"><meta name="robots" content="noindex,follow"><link rel="canonical" href="{BASE}{target}"><meta http-equiv="refresh" content="0;url={target}"></head><body><p>This page moved. <a href="{target}">Continue to {escape(title)}</a>.</p></body></html>''',
        encoding="utf-8",
    )

search_data = [
    {
        "title": values[0],
        "description": values[1],
        "content": re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", values[2]))).strip(),
        "url": f"{slug}.html",
    }
    for slug, values in PAGES.items()
]
(SITE / "search-index.json").write_text(json.dumps(search_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(SITE / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + "".join(f"  <url><loc>{BASE if slug == 'index' else BASE + slug + '.html'}</loc></url>\n" for slug in PAGES)
    + "</urlset>\n", encoding="utf-8"
)
(SITE / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}sitemap.xml\n", encoding="utf-8")
(SITE / "404.html").write_text(
    f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | SVGER-CLI</title><meta name="robots" content="noindex,follow"><link rel="stylesheet" href="styles.css"></head><body><main><h1>Page not found</h1><p>That page is unavailable. Start at the <a href="index.html">documentation home</a> or browse <a href="frameworks.html">framework guides</a>.</p></main></body></html>',
    encoding="utf-8",
)
print(f"Built {len(PAGES)} crawlable documentation pages and static search/sitemap assets in {SITE}")
