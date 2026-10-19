import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from '@babel/parser';
import {
  parse as parseVue,
  compileScript as compileVueScript,
  compileTemplate,
} from '@vue/compiler-sfc';
import {
  compile as compileSvelte,
  preprocess as preprocessSvelte,
} from 'svelte/compiler';
import { createSVGCompiler, ExitCode } from '../../dist/index.js';
import { createBuildPlan } from '../../dist/application/build-plan.js';
import { svgService } from '../../dist/services/svg-service.js';

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'svger-artifacts-'));
const frameworks = [
  ['react', true, 'default', 'tsx'],
  ['react', false, 'default', 'jsx'],
  ['react-native', true, 'default', 'tsx'],
  ['react-native', false, 'default', 'jsx'],
  ['vue', true, 'default', 'vue'],
  ['vue', false, 'default', 'vue'],
  ['svelte', true, 'default', 'svelte'],
  ['svelte', false, 'default', 'svelte'],
  ['angular', true, 'named', 'component.ts'],
  ['solid', true, 'default', 'tsx'],
  ['solid', false, 'default', 'jsx'],
  ['preact', true, 'default', 'tsx'],
  ['preact', false, 'default', 'jsx'],
  ['lit', true, 'named', 'ts'],
  ['lit', false, 'named', 'js'],
  ['vanilla', true, 'named', 'ts'],
  ['vanilla', false, 'named', 'js'],
];

function parseModule(source, fileName) {
  return parse(source, {
    sourceType: 'module',
    sourceFilename: fileName,
    plugins: ['jsx', 'typescript', 'decorators-legacy'],
  });
}

function exportedDeclarations(ast) {
  const names = new Set();
  let hasDefault = false;
  for (const node of ast.program.body) {
    if (node.type === 'ExportDefaultDeclaration') hasDefault = true;
    if (node.type !== 'ExportNamedDeclaration') continue;
    const declaration = node.declaration;
    if (declaration?.id?.name) names.add(declaration.id.name);
    for (const specifier of node.specifiers) {
      if (specifier.exported?.name) names.add(specifier.exported.name);
    }
  }
  return { names, hasDefault };
}

const readArtifactSet = async directory =>
  Promise.all(
    (await fs.readdir(directory))
      .sort()
      .map(async name => [
        name,
        await fs.readFile(path.join(directory, name), 'utf8'),
      ])
  );

try {
  for (const [framework, typescript, exportStyle, extension] of frameworks) {
    const sourceDir = path.join(fixture, `${framework}-${typescript}-src`);
    const output = path.join(fixture, `${framework}-${typescript}-out`);
    await fs.mkdir(sourceDir);
    await fs.writeFile(
      path.join(sourceDir, 'icon.svg'),
      '<svg viewBox="0 0 24 24"><path d="M2 2h20v20z"/></svg>'
    );
    const compiler = await createSVGCompiler({
      cwd: fixture,
      config: { framework, typescript },
    });
    const report = await compiler.build({
      src: path.basename(sourceDir),
      out: path.basename(output),
    });
    assert.equal(report.status, 'success', `${framework} build failed`);
    const serviceOutput = path.join(
      fixture,
      `${framework}-${typescript}-service-out`
    );
    await svgService.buildAll({
      src: sourceDir,
      out: serviceOutput,
      framework,
      typescript,
    });
    assert.deepEqual(
      await readArtifactSet(serviceOutput),
      await readArtifactSet(output),
      `${framework} public service and compiler artifacts diverged`
    );

    const componentFile = `Icon.${extension}`;
    const componentArtifact = report.artifacts.find(item =>
      item.output.endsWith(componentFile)
    );
    assert.ok(componentArtifact, `${framework} component extension mismatch`);
    const barrelArtifact = report.artifacts.find(item =>
      item.output.endsWith(typescript ? 'index.ts' : 'index.js')
    );
    assert.ok(barrelArtifact, `${framework} barrel missing`);

    const barrelPath = path.join(output, typescript ? 'index.ts' : 'index.js');
    const barrel = parseModule(
      await fs.readFile(barrelPath, 'utf8'),
      barrelPath
    );
    const exports = barrel.program.body.filter(
      node => node.type === 'ExportNamedDeclaration' && node.source
    );
    assert.equal(
      exports.length,
      1,
      `${framework} barrel should resolve one component`
    );
    const entry = exports[0];
    assert.equal(
      entry.source.value,
      framework === 'angular'
        ? `./${componentArtifact.componentName}.component`
        : framework === 'vue'
          ? `./${componentArtifact.componentName}.vue`
          : framework === 'svelte'
            ? `./${componentArtifact.componentName}.svelte`
            : !typescript && ['lit', 'vanilla'].includes(framework)
              ? `./${componentArtifact.componentName}.js`
              : `./${componentArtifact.componentName}`
    );
    assert.equal(
      entry.specifiers[0].exported.name,
      componentArtifact.componentName
    );
    const importedName = entry.specifiers[0].local.name;
    assert.equal(
      importedName,
      exportStyle === 'default'
        ? 'default'
        : framework === 'angular'
          ? `${componentArtifact.componentName}Component`
          : componentArtifact.componentName
    );

    const componentPath = path.join(output, componentFile);
    const component = await fs.readFile(componentPath, 'utf8');
    if (framework === 'vue') {
      const parsed = parseVue(component, { filename: componentPath });
      assert.equal(parsed.errors.length, 0);
      const template = compileTemplate({
        source: parsed.descriptor.template.content,
        filename: componentPath,
        id: 'artifact-contract',
      });
      assert.equal(template.errors.length, 0);
      if (parsed.descriptor.scriptSetup) {
        compileVueScript(parsed.descriptor, { id: 'artifact-contract' });
      } else {
        assert.match(component, /export default defineComponent/);
      }
    } else if (framework === 'svelte') {
      const preprocessed = typescript
        ? await preprocessSvelte(
            component,
            {
              script: ({ content, attributes }) => ({
                code: content.replace(
                  /: (?:string|number)(?: \| (?:string|number))?/g,
                  ''
                ),
                attributes: { ...attributes, lang: undefined },
              }),
            },
            { filename: componentPath }
          )
        : { code: component };
      compileSvelte(preprocessed.code, {
        filename: componentPath,
        generate: 'dom',
      });
    } else {
      const ast = parseModule(component, componentPath);
      const actual = exportedDeclarations(ast);
      if (exportStyle === 'default') {
        assert.equal(
          actual.hasDefault,
          true,
          `${framework} default export missing`
        );
      } else {
        assert.ok(
          actual.names.has(importedName),
          `${framework} named export ${importedName} missing`
        );
      }
    }
  }

  // The planner detects output stems that conflict with a barrel, including
  // index.svg on case-insensitive filesystems, before creating output state.
  const indexSource = path.join(fixture, 'index-source');
  const indexOutput = path.join(fixture, 'index-output');
  await fs.mkdir(indexSource);
  await fs.mkdir(indexOutput);
  await fs.writeFile(path.join(indexOutput, 'keep.txt'), 'unchanged');
  await fs.writeFile(path.join(indexSource, 'index.svg'), '<svg/>');
  const collision = await (
    await createSVGCompiler({ cwd: fixture })
  ).build({
    src: 'index-source',
    out: 'index-output',
  });
  assert.equal(collision.exitCode, ExitCode.NameCollision);
  assert.equal(collision.diagnostics[0].code, 'E_ARTIFACT_COLLISION');
  assert.deepEqual(await fs.readdir(indexOutput), ['keep.txt']);
  assert.equal(
    (await fs.readdir(fixture)).some(name => name.startsWith('.svger-stage-')),
    false
  );
  assert.equal(
    (await fs.readdir(fixture)).some(name =>
      name.startsWith('.svger-transaction-')
    ),
    false
  );

  const duplicateSource = path.join(fixture, 'duplicate-source');
  const duplicateOutput = path.join(fixture, 'duplicate-output');
  await fs.mkdir(duplicateSource);
  await fs.mkdir(duplicateOutput);
  await fs.writeFile(path.join(duplicateOutput, 'keep.txt'), 'unchanged');
  await fs.writeFile(path.join(duplicateSource, 'home-icon.svg'), '<svg/>');
  await fs.writeFile(path.join(duplicateSource, 'home_icon.svg'), '<svg/>');
  const duplicate = await (
    await createSVGCompiler({ cwd: fixture })
  ).build({
    src: 'duplicate-source',
    out: 'duplicate-output',
  });
  assert.equal(duplicate.exitCode, ExitCode.NameCollision);
  assert.equal(duplicate.diagnostics[0].code, 'E_NAME_COLLISION');
  assert.deepEqual(await fs.readdir(duplicateOutput), ['keep.txt']);
  await assert.rejects(
    svgService.buildAll({
      src: duplicateSource,
      out: duplicateOutput,
      config: { framework: 'react', typescript: true },
    }),
    error => error.code === 'E_NAME_COLLISION'
  );
  assert.deepEqual(await fs.readdir(duplicateOutput), ['keep.txt']);

  const nestedPlan = () =>
    createBuildPlan(
      [
        { absolutePath: '/source/a.svg', relativePath: 'a.svg' },
        { absolutePath: '/source/b.svg', relativePath: 'b.svg' },
      ],
      '/output',
      {
        componentName: sourceName => sourceName,
        outputFileName: componentName =>
          componentName === 'a.svg' ? 'shared' : 'shared/Child.tsx',
      }
    );
  assert.throws(nestedPlan, error => error.code === 'E_ARTIFACT_COLLISION');

  const repeatSource = path.join(fixture, 'repeat-source');
  const repeatOutputA = path.join(fixture, 'repeat-a');
  const repeatOutputB = path.join(fixture, 'repeat-b');
  await fs.mkdir(repeatSource);
  await fs.writeFile(path.join(repeatSource, 'zulu.svg'), '<svg/>');
  await fs.writeFile(path.join(repeatSource, 'alpha.svg'), '<svg/>');
  const repeatCompiler = await createSVGCompiler({ cwd: fixture });
  await repeatCompiler.build({ src: 'repeat-source', out: 'repeat-a' });
  await repeatCompiler.build({ src: 'repeat-source', out: 'repeat-b' });
  assert.deepEqual(
    await readArtifactSet(repeatOutputA),
    await readArtifactSet(repeatOutputB)
  );

  const kebabSource = path.join(fixture, 'kebab-source');
  const kebabOutput = path.join(fixture, 'kebab-output');
  await fs.mkdir(kebabSource);
  await fs.writeFile(path.join(kebabSource, 'home-icon.svg'), '<svg/>');
  const kebabCompiler = await createSVGCompiler({
    cwd: fixture,
    config: {
      framework: 'react',
      typescript: false,
      outputConfig: { naming: 'kebab' },
    },
  });
  await kebabCompiler.build({ src: 'kebab-source', out: 'kebab-output' });
  assert.ok((await fs.readdir(kebabOutput)).includes('home-icon.jsx'));
  assert.match(
    await fs.readFile(path.join(kebabOutput, 'home-icon.jsx'), 'utf8'),
    /const HomeIcon =/
  );
  assert.match(
    await fs.readFile(path.join(kebabOutput, 'index.js'), 'utf8'),
    /default as HomeIcon.*\.\/home-icon/s
  );
} finally {
  await fs.rm(fixture, { recursive: true, force: true });
}

console.log('Artifact export and collision contracts passed.');
