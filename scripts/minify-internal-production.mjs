import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import UglifyJS from 'uglify-js';

const internalFiles = [
  'compiler/ir-v1.js',
  'compiler/lower-svg-document-to-ir.js',
  'compiler/svelte-ir-emitter.js',
  'security/input-safety.js',
  'security/svg-xml-safety.js',
  'processors/svg-processor.js',
  'utils/visual-diff.js',
];

export async function minifyInternalProduction(distRoot = 'dist') {
  const root = path.resolve(distRoot);
  for (const relativeFile of internalFiles) {
    const file = path.join(root, relativeFile);
    const source = await readFile(file, 'utf8');
    const result = UglifyJS.minify(source, {
      module: true,
      keep_fnames: true,
      mangle: { keep_fnames: true },
      output: { max_line_len: 160 },
    });
    if (result.error) throw result.error;
    if (typeof result.code !== 'string' || result.code.length === 0) {
      throw new Error(`Minifier produced no code for ${relativeFile}.`);
    }
    await writeFile(file, `${result.code}\n`);
  }
}

async function main(args) {
  let distRoot = 'dist';
  if (args.length > 0) {
    if (args.length !== 2 || args[0] !== '--dist-root') {
      throw new Error(
        'Usage: minify-internal-production.mjs [--dist-root PATH]'
      );
    }
    distRoot = args[1];
  }
  await minifyInternalProduction(distRoot);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
