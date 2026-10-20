import { performance } from 'node:perf_hooks';
import { NullLogger, SVGProcessor } from '../../dist/index.js';

const groups = 750;
const warmups = 8;
const samples = 40;
const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 16">${Array.from(
  { length: groups },
  (_, index) =>
    `<g id="g${index}"><path d="M${index} 0h8v8z" fill="currentColor"/><text x="${index}" y="8">Icon ${index}</text></g>`
).join('')}</svg>`;
const processor = new SVGProcessor({ logger: new NullLogger() });
const modes = [
  [
    'legacy',
    {
      framework: 'svelte',
      typescript: false,
      optimizationLevel: 'none',
    },
  ],
  [
    'ir-v1',
    {
      framework: 'svelte',
      typescript: false,
      svelteCompiler: 'ir-v1',
      optimizationLevel: 'none',
    },
  ],
];
const timings = new Map(modes.map(([mode]) => [mode, []]));
const outputBytes = new Map();

for (const [mode, options] of modes)
  for (let index = 0; index < warmups; index++)
    await processor.generateComponent('BenchIcon', source, options);

// Alternate modes within each round to reduce order and transient-load bias.
for (let index = 0; index < samples; index++) {
  for (const [mode, options] of modes) {
    const start = performance.now();
    const output = await processor.generateComponent(
      'BenchIcon',
      source,
      options
    );
    timings.get(mode).push(performance.now() - start);
    outputBytes.set(mode, Buffer.byteLength(output));
  }
}

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    medianMs: Number(sorted[Math.floor(sorted.length / 2)].toFixed(3)),
    p95Ms: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(3)),
    minMs: Number(sorted[0].toFixed(3)),
    maxMs: Number(sorted.at(-1).toFixed(3)),
  };
}

console.log(
  JSON.stringify(
    {
      benchmark: 'phase4-production-svelte-generator-v1',
      node: process.version,
      sourceBytes: Buffer.byteLength(source),
      elementCount: groups * 2 + 1,
      warmupsPerMode: warmups,
      samplesPerMode: samples,
      threshold: 'informational-only',
      modes: Object.fromEntries(
        [...timings].map(([mode, values]) => [
          mode,
          { ...summarize(values), outputBytes: outputBytes.get(mode) },
        ])
      ),
    },
    null,
    2
  )
);
