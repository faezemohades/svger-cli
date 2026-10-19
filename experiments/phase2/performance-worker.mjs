import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { DOMParser } from '@xmldom/xmldom';
import { SaxesParser } from 'saxes';
import { applySVGInputSafety } from '../../dist/security/input-safety.js';
import { parseSVGForQualification } from './saxes-qualification-adapter.mjs';
import { indexXMLSourceSpans } from './xml-source-spans.mjs';
import { performanceFixtures } from './performance-fixtures.mjs';

const [fixtureName, configuration, iterationsArg, mode = 'accepted'] =
  process.argv.slice(2);
const iterations = Number(iterationsArg);
const fixtureSet =
  mode === 'accepted' || mode === 'memory'
    ? performanceFixtures.accepted
    : performanceFixtures.rejected;
const fixture = fixtureSet.find(item => item.name === fixtureName);
if (!fixture || !Number.isSafeInteger(iterations) || iterations < 1) {
  throw new Error(
    'Expected fixture name, configuration, and positive iteration count.'
  );
}

function scan(source) {
  applySVGInputSafety(source, { unsafeInputPolicy: 'reject' });
}

function saxesWithoutTree(source) {
  scan(source);
  let elements = 0;
  let attributes = 0;
  let textCodeUnits = 0;
  const parser = new SaxesParser({ xmlns: true, position: true });
  parser.on('error', () => {
    throw new Error(
      'E_XML_PARSE: Saxes rejected input after scanner admission.'
    );
  });
  parser.on('opentag', tag => {
    elements++;
    attributes += Object.keys(tag.attributes).length;
  });
  parser.on('text', text => (textCodeUnits += text.length));
  parser.on('cdata', text => (textCodeUnits += text.length));
  parser.write(source).close();
  return { elements, attributes, textCodeUnits };
}

function xmldomParse(source) {
  scan(source);
  const errors = [];
  const document = new DOMParser({
    onError: level => errors.push(level),
  }).parseFromString(source, 'image/svg+xml');
  if (errors.some(level => level === 'error' || level === 'fatalError')) {
    throw new Error(
      'E_XML_PARSE: xmldom rejected input after scanner admission.'
    );
  }
  if (!document.documentElement)
    throw new Error('E_XML_PARSE: xmldom returned no root.');
  return document;
}

function walkDOM(document) {
  let elements = 0;
  let attributes = 0;
  let textCodeUnits = 0;
  const stack = [document.documentElement];
  while (stack.length) {
    const node = stack.pop();
    if (node.nodeType === 1) {
      elements++;
      attributes += node.attributes?.length ?? 0;
      for (let child = node.lastChild; child; child = child.previousSibling)
        stack.push(child);
    } else if (node.nodeType === 3 || node.nodeType === 4) {
      textCodeUnits += node.data.length;
    }
  }
  return { elements, attributes, textCodeUnits };
}

function run() {
  if (mode === 'rejected') {
    try {
      switch (configuration) {
        case 'scanner':
          scan(fixture.source);
          break;
        case 'saxes-adapter':
          parseSVGForQualification(fixture.source);
          break;
        case 'xmldom':
          xmldomParse(fixture.source);
          break;
        default:
          throw new Error(
            `Unknown rejected-input configuration: ${configuration}`
          );
      }
      return { rejected: false };
    } catch (error) {
      return { rejected: true, code: error?.code ?? error?.name ?? 'Error' };
    }
  }
  if (mode === 'raw-parser-failure') {
    if (configuration === 'saxes-raw') {
      let errorCount = 0;
      const parser = new SaxesParser({ xmlns: true, position: true });
      parser.on('error', () => errorCount++);
      parser.write('<svg><g></svg>').close();
      return { errorCount };
    }
    if (configuration === 'xmldom-raw') {
      const errors = [];
      try {
        new DOMParser({ onError: level => errors.push(level) }).parseFromString(
          '<svg><g></svg>',
          'image/svg+xml'
        );
        return {
          errorCount: errors.filter(
            level => level === 'error' || level === 'fatalError'
          ).length,
          thrown: false,
        };
      } catch {
        return { errorCount: 1, thrown: true };
      }
    }
  }
  switch (configuration) {
    case 'scanner':
      scan(fixture.source);
      return { bytes: fixture.bytes };
    case 'saxes-events':
      return saxesWithoutTree(fixture.source);
    case 'saxes-adapter':
      return parseSVGForQualification(fixture.source).statistics;
    case 'xmldom':
      return xmldomParse(fixture.source).documentElement.localName;
    case 'xmldom-walk':
      return walkDOM(xmldomParse(fixture.source));
    case 'source-spans':
      scan(fixture.source);
      return { spans: indexXMLSourceSpans(fixture.source).length };
    default:
      throw new Error(`Unknown benchmark configuration: ${configuration}`);
  }
}

if (mode === 'memory') {
  if (typeof global.gc !== 'function')
    throw new Error('Memory mode requires --expose-gc.');
  global.gc();
  const baselineHeapBytes = process.memoryUsage().heapUsed;
  const baselineRssBytes = process.memoryUsage().rss;
  let materialized;
  switch (configuration) {
    case 'scanner':
      scan(fixture.source);
      materialized = null;
      break;
    case 'saxes-events':
      materialized = saxesWithoutTree(fixture.source);
      break;
    case 'saxes-adapter':
      materialized = parseSVGForQualification(fixture.source);
      break;
    case 'xmldom':
      materialized = xmldomParse(fixture.source);
      break;
    case 'xmldom-walk': {
      const document = xmldomParse(fixture.source);
      materialized = { document, statistics: walkDOM(document) };
      break;
    }
    case 'source-spans':
      scan(fixture.source);
      materialized = indexXMLSourceSpans(fixture.source);
      break;
    default:
      throw new Error(`Unknown memory configuration: ${configuration}`);
  }
  const postOperationHeapBytes = process.memoryUsage().heapUsed;
  const statusBeforeGc =
    process.platform === 'linux'
      ? readFileSync('/proc/self/status', 'utf8')
      : '';
  const beforeGcPeakMatch = statusBeforeGc.match(/^VmHWM:\s+(\d+) kB$/mu);
  const peakRssBytes = beforeGcPeakMatch
    ? Number(beforeGcPeakMatch[1]) * 1024
    : process.memoryUsage().rss;
  const retainedSignature =
    configuration === 'saxes-adapter'
      ? JSON.stringify(materialized.statistics)
      : configuration === 'source-spans'
        ? String(materialized.length)
        : configuration === 'xmldom'
          ? materialized.documentElement.localName
          : configuration === 'xmldom-walk'
            ? JSON.stringify(materialized.statistics)
            : JSON.stringify(materialized);
  global.gc();
  const heldHeapBytes = process.memoryUsage().heapUsed;
  materialized = null;
  global.gc();
  const releasedHeapBytes = process.memoryUsage().heapUsed;
  process.stdout.write(
    `${JSON.stringify({
      fixture: fixtureName,
      configuration,
      baselineHeapBytes,
      postOperationHeapBytes,
      heldHeapBytes,
      retainedStructureDeltaBytes: heldHeapBytes - baselineHeapBytes,
      cleanupHeapDeltaBytes: releasedHeapBytes - baselineHeapBytes,
      baselineRssBytes,
      peakRssBytes,
      peakRssDeltaBytes: peakRssBytes - baselineRssBytes,
      peakRssMethod: beforeGcPeakMatch
        ? 'Linux /proc VmHWM'
        : 'post-operation rss sample',
      signature: retainedSignature,
      gcExposed: true,
    })}\n`
  );
  process.exit(0);
}

global.gc?.();
const heapStart = process.memoryUsage().heapUsed;
const rssStart = process.memoryUsage().rss;
const coldStarted = performance.now();
const coldResult = run();
const coldMs = performance.now() - coldStarted;
let maxObservedHeap = process.memoryUsage().heapUsed;
let maxObservedRss = process.memoryUsage().rss;
const samplesMs = [];
let signature = JSON.stringify(coldResult);
for (let index = 0; index < iterations; index++) {
  const started = performance.now();
  const result = run();
  samplesMs.push(performance.now() - started);
  signature = JSON.stringify(result);
  const usage = process.memoryUsage();
  maxObservedHeap = Math.max(maxObservedHeap, usage.heapUsed);
  maxObservedRss = Math.max(maxObservedRss, usage.rss);
}
global.gc?.();
const retainedHeap = process.memoryUsage().heapUsed;
const procStatus =
  process.platform === 'linux' ? readFileSync('/proc/self/status', 'utf8') : '';
const peakRssMatch = procStatus.match(/^VmHWM:\s+(\d+) kB$/mu);
const sorted = [...samplesMs].sort((a, b) => a - b);
const percentile = fraction =>
  sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
const output = {
  fixture: fixtureName,
  configuration,
  iterations,
  coldMs,
  warmMedianMs: percentile(0.5),
  warmP95Ms: iterations >= 20 ? percentile(0.95) : null,
  warmP99Ms: iterations >= 100 ? percentile(0.99) : null,
  warmElapsedMs: samplesMs.reduce((sum, value) => sum + value, 0),
  throughputDocsPerSecond:
    (1000 * iterations) / samplesMs.reduce((sum, value) => sum + value, 0),
  heapStartBytes: heapStart,
  heapAfterGcBytes: retainedHeap,
  retainedHeapDeltaBytes: retainedHeap - heapStart,
  maxObservedHeapBytes: maxObservedHeap,
  rssStartBytes: rssStart,
  maxObservedRssBytes: maxObservedRss,
  peakRssBytes: peakRssMatch ? Number(peakRssMatch[1]) * 1024 : maxObservedRss,
  peakRssMethod: peakRssMatch
    ? 'Linux /proc VmHWM'
    : 'post-operation rss samples',
  signature,
  gcExposed: typeof global.gc === 'function',
};
process.stdout.write(`${JSON.stringify(output)}\n`);
