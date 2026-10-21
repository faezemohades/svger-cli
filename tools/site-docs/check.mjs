import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs-site');
const base = 'https://faezemohades.github.io/svger-cli/';
const expected = [
  'index', 'getting-started', 'installation', 'frameworks', 'react', 'react-native',
  'vue', 'angular', 'svelte', 'solid', 'preact', 'lit', 'vanilla', 'commands',
  'configuration', 'api', 'integrations', 'plugins', 'optimization', 'migration',
  'security', 'troubleshooting', 'benchmark',
];
const errors = [];
const htmlFiles = (await readdir(root)).filter(name => name.endsWith('.html'));
for (const slug of expected) {
  const filename = `${slug}.html`;
  if (!htmlFiles.includes(filename)) {
    errors.push(`Missing generated page: ${filename}`);
    continue;
  }
  const source = await readFile(path.join(root, filename), 'utf8');
  const title = source.match(/<title>([^<]+)<\/title>/iu)?.[1];
  const description = source.match(/<meta\s+name="description"\s+content="([^"]+)"/iu)?.[1];
  const canonical = source.match(/<link\s+rel="canonical"\s+href="([^"]+)"/iu)?.[1];
  if (!title || title.length < 20) errors.push(`${filename}: missing or short title`);
  if (!description || description.length < 50 || description.length > 170)
    errors.push(`${filename}: description must be 50–170 characters`);
  const expectedCanonical = slug === 'index' ? base : `${base}${filename}`;
  if (canonical !== expectedCanonical) errors.push(`${filename}: incorrect canonical URL`);
  const jsonLd = source.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/iu)?.[1];
  try {
    const data = JSON.parse(jsonLd ?? 'null');
    assert.equal(data?.['@type'], 'TechArticle');
    assert.equal(data?.mainEntityOfPage, expectedCanonical);
  } catch {
    errors.push(`${filename}: invalid or missing TechArticle structured data`);
  }
}

const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
for (const slug of expected) {
  const url = slug === 'index' ? base : `${base}${slug}.html`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) errors.push(`Sitemap missing canonical page ${url}`);
}
if (!robots.includes(`${base}sitemap.xml`)) errors.push('robots.txt is missing sitemap location');

for (const filename of htmlFiles) {
  const source = await readFile(path.join(root, filename), 'utf8');
  for (const match of source.matchAll(/\b(?:href|src)="([^"]+)"/giu)) {
    const url = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|#)/iu.test(url)) continue;
    const targetName = url.split('#', 1)[0].split('?', 1)[0];
    if (!targetName) continue;
    const target = path.resolve(root, targetName);
    if (!target.startsWith(`${root}${path.sep}`) && target !== root) {
      errors.push(`${filename}: local link escapes site root: ${url}`);
      continue;
    }
    try {
      if (!(await stat(target)).isFile()) errors.push(`${filename}: link target is not a file: ${url}`);
    } catch {
      errors.push(`${filename}: missing local link target: ${url}`);
    }
  }
  if (/<script\s+src="https?:/iu.test(source)) errors.push(`${filename}: remote executable script is prohibited`);
}

if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`SEO, sitemap, structured data, and local asset checks passed (${expected.length} indexable pages).\n`);
}
