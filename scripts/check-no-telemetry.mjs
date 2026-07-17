import { promises as fs } from 'node:fs';
import path from 'node:path';

const roots = ['src', 'bin'];
const forbidden = [
  /from\s+['"](?:node:)?(?:http|https|http2|net|tls|dgram)['"]/u,
  /require\(\s*['"](?:node:)?(?:http|https|http2|net|tls|dgram)['"]\s*\)/u,
  /\bfetch\s*\(/u,
  /\b(?:telemetry|analytics)\b/iu,
];
const allowList = new Set(['src/core/logger.ts']);
const violations = [];

async function visit(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(entryPath);
    else if (/\.(?:ts|js)$/u.test(entry.name) && !allowList.has(entryPath)) {
      const content = await fs.readFile(entryPath, 'utf8');
      if (forbidden.some(pattern => pattern.test(content)))
        violations.push(entryPath);
    }
  }
}

for (const root of roots) await visit(root);

if (violations.length > 0) {
  process.stderr.write(
    `Network-capable or telemetry-related runtime code requires privacy approval:\n${violations.map(file => `- ${file}`).join('\n')}\n`
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    'No default runtime telemetry or network-capable imports detected.\n'
  );
}
