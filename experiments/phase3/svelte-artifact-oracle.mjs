/**
 * Read-only static SVG projection for bounded Svelte-JavaScript artifacts.
 * Uses Svelte's parser AST and never evaluates scripts or expressions.
 */
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { parse, VERSION } from 'svelte/compiler';
import {
  isSupportedStaticSvgAttribute,
  isSupportedStaticSvgElement,
  digestStaticProjection,
  STATIC_SVG_SOURCE_ORACLE_SCHEMA,
} from './static-svg-source-oracle.mjs';

export const SVELTE_ARTIFACT_ORACLE_VERSION = '4.0.0';
export const SVELTE_ARTIFACT_ORACLE_SCHEMA =
  'svger-svelte-artifact-analysis-v4';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_NODES = 100_000;
const MAX_DEPTH = 256;
const MAX_ATTRIBUTES_PER_ELEMENT = 256;
const MAX_TOTAL_ATTRIBUTES = 100_000;
const DIMENSIONS = [
  'text',
  'namespaces',
  'attributes',
  'references',
  'accessibility',
  'geometry',
];
const COVERAGE_SCOPE = Object.freeze({
  kind: 'static-svg-markup-projection',
  grammarSchema: STATIC_SVG_SOURCE_ORACLE_SCHEMA,
  runtimeEquivalence: false,
  accessibleNameComputation: false,
  browserResourceResolution: false,
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function emptyProjection() {
  return {
    text: [],
    namespaces: [],
    attributes: [],
    references: { ids: [], occurrences: [] },
    accessibility: {
      attributes: [],
      titles: [],
      descriptions: [],
      idrefs: [],
    },
    geometry: { viewBox: null, width: null, height: null },
  };
}

function failedAnalysis(artifact, status, diagnosticCode, artifactSha256) {
  return {
    schemaVersion: SVELTE_ARTIFACT_ORACLE_SCHEMA,
    status,
    analysisStatus: status,
    artifactSha256,
    artifactPathSha256: sha256(artifact.path),
    analyzer: {
      name: 'svelte-static-svg-artifact-oracle',
      version: SVELTE_ARTIFACT_ORACLE_VERSION,
      parser: 'svelte/compiler',
      parserVersion: VERSION,
    },
    scope: COVERAGE_SCOPE,
    coverage: Object.fromEntries(DIMENSIONS.map(name => [name, 'unresolved'])),
    coverageStatus: 'unresolved',
    validity: {
      status: 'unresolved',
      issues: [{ code: diagnosticCode, state: 'unresolved' }],
    },
    projectionSha256: null,
    projection: null,
    diagnosticCodes: [diagnosticCode],
  };
}

function semanticValidity(projection, unresolvedAnalysis = false) {
  const issues = [];
  const counts = new Map();
  for (const id of projection.references.ids)
    counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const count of counts.values()) {
    if (count > 1) issues.push({ code: 'E_DUPLICATE_ID', state: 'invalid' });
  }
  const inspectTarget = state => {
    if (state === 'ambiguous')
      issues.push({ code: 'E_AMBIGUOUS_REFERENCE', state: 'invalid' });
    else if (state === 'unresolved')
      issues.push({ code: 'E_UNRESOLVED_REFERENCE', state: 'unresolved' });
    else if (state === 'blocked-external')
      issues.push({
        code: 'E_EXTERNAL_REFERENCE_UNRESOLVED',
        state: 'unresolved',
      });
  };
  for (const occurrence of projection.references.occurrences)
    inspectTarget(occurrence.state);
  for (const item of projection.accessibility.idrefs)
    for (const target of item.targets) inspectTarget(target.state);
  const uniqueIssues = [
    ...new Map(issues.map(issue => [issue.code, issue])).values(),
  ].sort((left, right) => left.code.localeCompare(right.code, 'en'));
  return {
    status: uniqueIssues.some(issue => issue.state === 'invalid')
      ? 'invalid'
      : unresolvedAnalysis || uniqueIssues.length > 0
        ? 'unresolved'
        : 'valid',
    issues: uniqueIssues,
  };
}

function isStaticValue(value) {
  if (value === true) return true;
  return (
    Array.isArray(value) &&
    value.every(item => item?.type === 'Text' && typeof item.data === 'string')
  );
}

function staticValue(value) {
  return value === true ? '' : value.map(item => item.data).join('');
}

function attributeNamespace(name, bindings) {
  if (name === 'xmlns' || name.startsWith('xmlns:')) return XMLNS_NAMESPACE;
  if (!name.includes(':')) return null;
  return bindings.get(name.slice(0, name.indexOf(':')));
}

function accessibleAttribute(name) {
  const lower = name.toLowerCase();
  return (
    lower.startsWith('aria-') ||
    ['role', 'tabindex', 'focusable'].includes(lower)
  );
}

const STATIC_ARIA_IDREFS = new Set([
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'aria-activedescendant',
  'aria-flowto',
  'aria-details',
  'aria-errormessage',
]);

const STATIC_ARIA = new Set([
  ...STATIC_ARIA_IDREFS,
  'aria-label',
  'aria-hidden',
  'aria-checked',
  'aria-disabled',
  'aria-expanded',
  'aria-haspopup',
  'aria-pressed',
  'aria-selected',
  'aria-current',
  'aria-live',
  'aria-atomic',
  'aria-busy',
  'aria-relevant',
  'aria-roledescription',
  'aria-valuenow',
  'aria-valuemin',
  'aria-valuemax',
  'aria-valuetext',
]);
const TEXT_CONTAINERS = new Set(['text', 'tspan', 'textPath', 'title', 'desc']);
const ELEMENT_ONLY_CONTAINERS = new Set(['svg', 'g', 'defs', 'symbol']);

function containsCssReference(value) {
  return /url\s*\(/iu.test(value);
}

function canonicalAttributeValue(localName, value) {
  if (!STATIC_ARIA_IDREFS.has(localName)) return value;
  return value
    .trim()
    .split(/[\t\n\r ]+/u)
    .filter(Boolean)
    .join(' ');
}

/** Analyze one bounded, captured Svelte-JS artifact without executing it. */
export function analyzeSvelteArtifact(artifact) {
  if (
    !artifact ||
    typeof artifact.path !== 'string' ||
    typeof artifact.content !== 'string'
  ) {
    throw new TypeError('Svelte artifact record is invalid');
  }
  const bytes = Buffer.from(artifact.content, 'utf8');
  const artifactSha256 = sha256(bytes);
  if (bytes.length > MAX_BYTES)
    return failedAnalysis(
      artifact,
      'invalid',
      'E_ARTIFACT_SIZE_LIMIT',
      artifactSha256
    );

  let ast;
  try {
    ast = parse(artifact.content, { filename: artifact.path });
  } catch {
    return failedAnalysis(
      artifact,
      'invalid',
      'E_ARTIFACT_PARSE',
      artifactSha256
    );
  }

  const projection = emptyProjection();
  const coverage = Object.fromEntries(
    DIMENSIONS.map(name => [name, 'complete'])
  );
  const diagnosticCodes = new Set();
  let nodes = 0;
  let totalAttributes = 0;
  const mark = (dimensions, code) => {
    for (const dimension of dimensions) coverage[dimension] = 'partial';
    diagnosticCodes.add(code);
  };
  const markAll = code => mark(DIMENSIONS, code);

  if (ast.css)
    mark(
      ['references', 'accessibility', 'geometry'],
      'E_ARTIFACT_CSS_RUNTIME_UNQUALIFIED'
    );
  // Script execution is outside this oracle's static-AST contract. Markup
  // expressions/spreads below lower only the dimensions they can affect; this
  // never claims runtime equivalence or executes script contents.
  if (ast.instance || ast.module)
    diagnosticCodes.add('E_ARTIFACT_SCRIPT_RUNTIME_UNQUALIFIED');

  const topLevelSvg = (ast.html?.children ?? []).filter(
    node => node.type === 'Element' && node.name.toLowerCase() === 'svg'
  );
  const nonWhitespaceOutside = (ast.html?.children ?? []).some(
    node =>
      node.type !== 'Comment' &&
      !(node.type === 'Text' && /^\s*$/u.test(node.data)) &&
      !(node.type === 'Element' && node.name.toLowerCase() === 'svg')
  );
  if (topLevelSvg.length !== 1 || nonWhitespaceOutside) {
    return failedAnalysis(
      artifact,
      'partial',
      'E_ARTIFACT_AMBIGUOUS_SVG_ROOT',
      artifactSha256
    );
  }

  const root = topLevelSvg[0];
  const initialBindings = new Map([
    ['', SVG_NAMESPACE],
    ['xml', XML_NAMESPACE],
    ['xlink', XLINK_NAMESPACE],
  ]);
  const appendText = (value, xmlSpace, elementPath) => {
    const normalized = value.replace(/\r\n?/gu, '\n');
    const last = projection.text.at(-1);
    if (
      last &&
      JSON.stringify(last.path) === JSON.stringify(elementPath) &&
      last.xmlSpace === xmlSpace
    ) {
      last.value += normalized;
    } else if (normalized.length > 0) {
      projection.text.push({
        path: [...elementPath],
        value: normalized,
        xmlSpace,
      });
    }
  };
  const visit = (
    element,
    inheritedSpace,
    depth,
    inheritedBindings = initialBindings,
    elementPath = [],
    inForeignObject = false
  ) => {
    nodes++;
    if (nodes > MAX_NODES || depth > MAX_DEPTH) {
      markAll('E_ARTIFACT_STRUCTURE_LIMIT');
      return;
    }
    if (
      !Array.isArray(element.attributes) ||
      !Array.isArray(element.children)
    ) {
      markAll('E_ARTIFACT_UNSUPPORTED_NODE');
      return;
    }
    totalAttributes += element.attributes.length;
    if (
      element.attributes.length > MAX_ATTRIBUTES_PER_ELEMENT ||
      totalAttributes > MAX_TOTAL_ATTRIBUTES
    ) {
      markAll('E_ARTIFACT_STRUCTURE_LIMIT');
      return;
    }

    const elementName = element.name;
    const colon = elementName.indexOf(':');
    const elementPrefix = colon < 0 ? null : elementName.slice(0, colon);
    const elementLocalName =
      colon < 0 ? elementName : elementName.slice(colon + 1);
    const bindings = new Map(inheritedBindings);
    for (const attribute of element.attributes) {
      if (
        typeof attribute.name !== 'string' ||
        (attribute.name !== 'xmlns' && !attribute.name.startsWith('xmlns:'))
      )
        continue;
      if (attribute.type !== 'Attribute' || !isStaticValue(attribute.value)) {
        mark(['namespaces'], 'E_ARTIFACT_NAMESPACE_UNRESOLVED');
        continue;
      }
      const prefix = attribute.name === 'xmlns' ? '' : attribute.name.slice(6);
      bindings.set(prefix, staticValue(attribute.value));
      const value = staticValue(attribute.value);
      const allowedBinding =
        (prefix === '' && value === SVG_NAMESPACE) ||
        (prefix === 'xlink' && value === XLINK_NAMESPACE) ||
        (prefix === 'xml' && value === XML_NAMESPACE) ||
        (prefix !== '' &&
          prefix !== 'xml' &&
          [SVG_NAMESPACE, XLINK_NAMESPACE].includes(value));
      if (!allowedBinding)
        mark(['namespaces'], 'E_ARTIFACT_NAMESPACE_UNRESOLVED');
    }
    const elementNamespaceUri =
      (elementPrefix === null
        ? bindings.get('')
        : bindings.get(elementPrefix)) ?? null;
    const isForeignObject = elementLocalName === 'foreignObject';
    const localForeignObject = inForeignObject || isForeignObject;
    if (!isSupportedStaticSvgElement(elementLocalName))
      markAll('E_ARTIFACT_ELEMENT_UNSUPPORTED');
    if (elementNamespaceUri !== SVG_NAMESPACE || localForeignObject) {
      mark(['namespaces'], 'E_ARTIFACT_NAMESPACE_UNRESOLVED');
      if (elementNamespaceUri !== SVG_NAMESPACE)
        markAll('E_ARTIFACT_FOREIGN_NAMESPACE_UNSUPPORTED');
    }
    if (localForeignObject || elementLocalName === 'style')
      markAll('E_ARTIFACT_UNSUPPORTED_ELEMENT_SEMANTICS');
    projection.namespaces.push({
      kind: 'element',
      namespaceUri:
        localForeignObject && inForeignObject
          ? HTML_NAMESPACE
          : elementNamespaceUri,
      localName: elementLocalName,
    });

    let xmlSpace = inheritedSpace;
    const staticAttributes = [];
    for (const attribute of element.attributes) {
      if (attribute.type !== 'Attribute' || !isStaticValue(attribute.value)) {
        if (attribute.type === 'Spread') {
          mark(
            ['attributes', 'references', 'accessibility', 'geometry'],
            'E_ARTIFACT_DYNAMIC_ATTRIBUTE'
          );
        } else {
          mark(
            [
              'attributes',
              'namespaces',
              'references',
              'accessibility',
              'geometry',
            ],
            'E_ARTIFACT_DYNAMIC_ATTRIBUTE'
          );
          if (['viewBox', 'width', 'height'].includes(attribute.name)) {
            mark(['geometry'], 'E_ARTIFACT_DYNAMIC_GEOMETRY');
          }
          if (
            attribute.name === 'href' ||
            attribute.name === 'xlink:href' ||
            attribute.name === 'id'
          ) {
            mark(['references'], 'E_ARTIFACT_DYNAMIC_REFERENCE');
          }
          if (accessibleAttribute(attribute.name)) {
            mark(['accessibility'], 'E_ARTIFACT_DYNAMIC_ACCESSIBILITY');
          }
        }
        continue;
      }
      const value = staticValue(attribute.value);
      const namespaceUri = attributeNamespace(attribute.name, bindings);
      if (namespaceUri === undefined) {
        mark(['namespaces'], 'E_ARTIFACT_NAMESPACE_UNRESOLVED');
      }
      const localName = attribute.name.includes(':')
        ? attribute.name.slice(attribute.name.indexOf(':') + 1)
        : attribute.name;
      if (namespaceUri === XMLNS_NAMESPACE) continue;
      if (!isSupportedStaticSvgAttribute(namespaceUri ?? null, localName)) {
        mark(['attributes'], 'E_ARTIFACT_ATTRIBUTE_UNSUPPORTED');
        if (localName.startsWith('aria-'))
          mark(['accessibility'], 'E_ARTIFACT_ARIA_UNSUPPORTED');
      }
      if (
        (localName === 'href' &&
          namespaceUri !== null &&
          namespaceUri !== XLINK_NAMESPACE) ||
        (localName === 'id' && namespaceUri !== null)
      ) {
        mark(['references'], 'E_ARTIFACT_REFERENCE_NAMESPACE_UNSUPPORTED');
      }
      if (namespaceUri !== null) {
        projection.namespaces.push({
          kind: 'attribute',
          namespaceUri,
          localName,
        });
      }
      staticAttributes.push({
        namespaceUri: namespaceUri ?? null,
        localName,
        value: canonicalAttributeValue(localName, value),
      });
      if (namespaceUri === XML_NAMESPACE && localName === 'space') {
        if (value === 'preserve' || value === 'default') xmlSpace = value;
        else mark(['text'], 'E_ARTIFACT_XML_SPACE_INVALID');
      }
      if (containsCssReference(value) || localName === 'style') {
        mark(['references'], 'E_ARTIFACT_CSS_REFERENCE_UNSUPPORTED');
      }
      if (localName === 'style' || localName === 'class') {
        mark(['geometry', 'accessibility'], 'E_ARTIFACT_STYLE_UNRESOLVED');
      }
      if (namespaceUri === null && localName === 'id' && value !== '') {
        projection.references.ids.push(value);
      }
      if (
        localName === 'href' &&
        (namespaceUri === null || namespaceUri === XLINK_NAMESPACE)
      ) {
        projection.references.occurrences.push({
          state:
            value.startsWith('#') && value.length > 1
              ? 'pending-local'
              : 'blocked-external',
          target:
            value.startsWith('#') && value.length > 1 ? value.slice(1) : value,
        });
      }
      if (namespaceUri === null && accessibleAttribute(localName)) {
        projection.accessibility.attributes.push({
          name: localName,
          value: canonicalAttributeValue(localName, value),
        });
        if (localName.startsWith('aria-') && !STATIC_ARIA.has(localName))
          mark(['accessibility'], 'E_ARTIFACT_ARIA_UNSUPPORTED');
        if (STATIC_ARIA_IDREFS.has(localName)) {
          projection.accessibility.idrefs.push({
            path: [...elementPath],
            attribute: localName,
            targets: value
              .trim()
              .split(/[\t\n\r ]+/u)
              .filter(Boolean)
              .map(target => ({ target, state: 'pending-local' })),
          });
        }
      }
      if (
        element === root &&
        namespaceUri === null &&
        ['viewBox', 'width', 'height'].includes(localName)
      ) {
        projection.geometry[localName] = value;
      }
    }
    staticAttributes.sort(
      (left, right) =>
        String(left.namespaceUri).localeCompare(
          String(right.namespaceUri),
          'en'
        ) || left.localName.localeCompare(right.localName, 'en')
    );
    projection.attributes.push({
      elementNamespaceUri,
      elementLocalName,
      attributes: staticAttributes,
    });

    let childElementIndex = 0;
    for (const child of element.children) {
      if (child.type === 'Text') {
        nodes++;
        if (nodes > MAX_NODES) {
          markAll('E_ARTIFACT_STRUCTURE_LIMIT');
          return;
        }
        if (
          ELEMENT_ONLY_CONTAINERS.has(elementLocalName) &&
          xmlSpace !== 'preserve' &&
          /^\s*$/u.test(child.data)
        ) {
          continue;
        }
        if (!TEXT_CONTAINERS.has(elementLocalName))
          mark(['text'], 'E_ARTIFACT_TEXT_CONTEXT_UNSUPPORTED');
        if (child.data.length > 0)
          appendText(child.data, xmlSpace, elementPath);
      } else if (child.type === 'Comment') {
        nodes++;
        if (nodes > MAX_NODES) {
          markAll('E_ARTIFACT_STRUCTURE_LIMIT');
          return;
        }
        continue;
      } else if (child.type === 'Element') {
        if (child.name === 'title' || child.name === 'desc') {
          const collected = [];
          const collectText = (node, currentDepth) => {
            if (currentDepth > MAX_DEPTH) {
              mark(['accessibility'], 'E_ARTIFACT_STRUCTURE_LIMIT');
              return;
            }
            for (const nested of node.children ?? []) {
              if (nested.type === 'Text') collected.push(nested.data);
              else if (nested.type === 'Element')
                collectText(nested, currentDepth + 1);
              else if (nested.type !== 'Comment')
                mark(['accessibility'], 'E_ARTIFACT_DYNAMIC_ACCESSIBILITY');
            }
          };
          collectText(child, depth + 1);
          (child.name === 'title'
            ? projection.accessibility.titles
            : projection.accessibility.descriptions
          ).push(collected.join(''));
        }
        const siblingIndex = childElementIndex++;
        visit(
          child,
          xmlSpace,
          depth + 1,
          isForeignObject
            ? new Map([...bindings, ['', HTML_NAMESPACE]])
            : bindings,
          [...elementPath, siblingIndex],
          localForeignObject
        );
      } else {
        markAll('E_ARTIFACT_DYNAMIC_MARKUP');
      }
    }
  };

  visit(root, 'default', 0);
  const ids = new Map();
  for (const id of projection.references.ids)
    ids.set(id, (ids.get(id) ?? 0) + 1);
  projection.references.occurrences = projection.references.occurrences.map(
    occurrence => {
      if (occurrence.state !== 'pending-local') return occurrence;
      const count = ids.get(occurrence.target) ?? 0;
      return {
        state:
          count === 0 ? 'unresolved' : count > 1 ? 'ambiguous' : 'resolved',
        target: occurrence.target,
      };
    }
  );
  projection.accessibility.idrefs = projection.accessibility.idrefs.map(
    item => ({
      ...item,
      targets: item.targets.map(({ target }) => {
        const count = ids.get(target) ?? 0;
        return {
          target,
          state:
            count === 0 ? 'unresolved' : count > 1 ? 'ambiguous' : 'resolved',
        };
      }),
    })
  );

  const coverageStatus = Object.values(coverage).every(
    value => value === 'complete'
  )
    ? 'complete'
    : 'partial';
  const validity = semanticValidity(projection, coverageStatus !== 'complete');
  if (diagnosticCodes.has('E_ARTIFACT_XML_SPACE_INVALID')) {
    validity.status = 'invalid';
    validity.issues.push({ code: 'E_XML_SPACE_INVALID', state: 'invalid' });
    validity.issues.sort((left, right) =>
      left.code.localeCompare(right.code, 'en')
    );
  }

  return {
    schemaVersion: SVELTE_ARTIFACT_ORACLE_SCHEMA,
    status: coverageStatus,
    analysisStatus: coverageStatus,
    coverageStatus,
    validity,
    projectionSha256: digestStaticProjection(projection),
    artifactSha256,
    artifactPathSha256: sha256(artifact.path),
    analyzer: {
      name: 'svelte-static-svg-artifact-oracle',
      version: SVELTE_ARTIFACT_ORACLE_VERSION,
      parser: 'svelte/compiler',
      parserVersion: VERSION,
    },
    scope: COVERAGE_SCOPE,
    coverage,
    projection,
    diagnosticCodes: [...diagnosticCodes].sort(),
  };
}
