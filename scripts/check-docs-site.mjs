import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../docs-site'
);
const htmlFiles = (await readdir(root)).filter(name => name.endsWith('.html'));
const errors = [];

for (const file of htmlFiles) {
  const source = await readFile(path.join(root, file), 'utf8');
  const ids = new Set(
    [...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/giu)].map(
      match => match[1]
    )
  );
  for (const match of source.matchAll(
    /\b(?:href|src)\s*=\s*["']([^"']+)["']/giu
  )) {
    const value = match[1].trim();
    if (
      !value ||
      /^(?:https?:|mailto:|tel:|data:|javascript:|#)/iu.test(value)
    ) {
      if (value.startsWith('#') && !ids.has(decodeURIComponent(value.slice(1))))
        errors.push(`${file}: missing anchor ${value}`);
      continue;
    }
    const [filePart, anchor] = value.split('#', 2);
    const target = path.resolve(root, file, '..', decodeURIComponent(filePart));
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      errors.push(`${file}: link escapes docs-site: ${value}`);
      continue;
    }
    try {
      const metadata = await stat(target);
      if (!metadata.isFile())
        errors.push(`${file}: target is not a file: ${value}`);
      else if (anchor) {
        const targetSource = await readFile(target, 'utf8');
        const targetIds = new Set(
          [...targetSource.matchAll(/\bid\s*=\s*["']([^"']+)["']/giu)].map(
            item => item[1]
          )
        );
        if (!targetIds.has(decodeURIComponent(anchor)))
          errors.push(`${file}: missing target anchor ${value}`);
      }
    } catch {
      errors.push(`${file}: missing target ${value}`);
    }
  }
}

const requiredPages = ['index.html', 'commands.html', 'frameworks.html', 'benchmark.html'];
for (const required of requiredPages)
  if (!htmlFiles.includes(required))
    errors.push(`Required page missing: ${required}`);
for (const file of htmlFiles) {
  const source = await readFile(path.join(root, file), 'utf8');
  if (/<script\s+src\s*=\s*["']https?:/iu.test(source))
    errors.push(`${file}: remote script loading is not allowed`);
}
if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Documentation site links passed (${htmlFiles.length} HTML pages).\n`
  );
}
