/**
 * Conservative source-side oracle for a versioned static SVG syntax subset.
 * It consumes an admitted, lowered IR value and never rewrites source.
 */
import { createHash } from 'node:crypto';

export const STATIC_SVG_SOURCE_ORACLE_SCHEMA =
  'svger-static-svg-source-oracle-v3';

const SVG = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';
const XML = 'http://www.w3.org/XML/1998/namespace';
const XMLNS = 'http://www.w3.org/2000/xmlns/';
const DIMENSIONS = Object.freeze([
  'text',
  'namespaces',
  'attributes',
  'references',
  'accessibility',
  'geometry',
]);
const ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textPath',
  'title',
  'desc',
  'use',
  'symbol',
  'a',
  'clipPath',
  'mask',
  'pattern',
  'linearGradient',
  'radialGradient',
  'stop',
  'filter',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feMerge',
  'feMergeNode',
  'feOffset',
  'image',
  'metadata',
]);
const ATTRIBUTES = new Set([
  'id',
  'href',
  'viewBox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'fill',
  'fill-rule',
  'stroke',
  'stroke-width',
  'opacity',
  'transform',
  'clip-path',
  'preserveAspectRatio',
  'role',
  'tabindex',
  'focusable',
  'class',
  'style',
]);
const ARIA_ATTRIBUTES = new Set([
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
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
  'aria-controls',
  'aria-owns',
  'aria-activedescendant',
  'aria-flowto',
  'aria-details',
  'aria-errormessage',
]);
const IDREF_ATTRIBUTES = new Set([
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'aria-activedescendant',
  'aria-flowto',
  'aria-details',
  'aria-errormessage',
]);
const XML_SPACE = 'space';
const TEXT_CONTAINERS = new Set(['text', 'tspan', 'textPath', 'title', 'desc']);
const ELEMENT_ONLY_CONTAINERS = new Set(['svg', 'g', 'defs', 'symbol']);
const sortNames = values =>
  Object.freeze(
    [...values].sort((left, right) => left.localeCompare(right, 'en'))
  );

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digestStaticProjection(projection) {
  return createHash('sha256').update(canonicalJson(projection)).digest('hex');
}

export const STATIC_SVG_GRAMMAR = Object.freeze({
  schemaVersion: STATIC_SVG_SOURCE_ORACLE_SCHEMA,
  dimensions: DIMENSIONS,
  elements: sortNames(ELEMENTS),
  unqualifiedAttributes: sortNames(ATTRIBUTES),
  ariaAttributes: sortNames(ARIA_ATTRIBUTES),
  ariaIdrefAttributes: sortNames(IDREF_ATTRIBUTES),
  textContainers: sortNames(TEXT_CONTAINERS),
  elementOnlyWhitespaceContainers: sortNames(ELEMENT_ONLY_CONTAINERS),
  referenceScope: 'literal-id-and-href-syntax; no-browser-resource-resolution',
  accessibilityScope:
    'static-title-desc-role-aria-and-idref-integrity; no-name-computation',
  geometryScope:
    'literal-root-viewBox-width-height; no-rendering-interpretation',
  namespacePolicy:
    'expanded-names-only; svg/xlink/xml bindings; prefix-and-unused-declaration-insensitive',
  runtimeScope:
    'static-markup-syntax-only; no-script-execution-or-runtime-dom-mutation-analysis',
  completeMeans:
    'all observed syntax in this versioned subset is projected for this dimension; semantic validity is reported separately',
  validityStates: Object.freeze(['valid', 'invalid', 'unresolved']),
});

function semanticValidity(projection, unresolvedAnalysis = false) {
  const issues = [];
  const counts = new Map();
  for (const id of projection.references.ids)
    counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, count] of counts) {
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
  const status = uniqueIssues.some(issue => issue.state === 'invalid')
    ? 'invalid'
    : unresolvedAnalysis || uniqueIssues.length > 0
      ? 'unresolved'
      : 'valid';
  return { status, issues: uniqueIssues };
}

export function isSupportedStaticSvgElement(localName) {
  return ELEMENTS.has(localName);
}

export function isSupportedStaticSvgAttribute(namespaceUri, localName) {
  return (
    (namespaceUri === null && ATTRIBUTES.has(localName)) ||
    (namespaceUri === XLINK && localName === 'href') ||
    (namespaceUri === XML && localName === XML_SPACE) ||
    (namespaceUri === null && ARIA_ATTRIBUTES.has(localName))
  );
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

function textOnly(element) {
  let value = '';
  for (const child of element.children) {
    if (child.kind === 'text' || child.kind === 'cdata') value += child.value;
    else if (child.kind !== 'comment') return null;
  }
  return value;
}

function localIdrefTargets(value) {
  return value
    .trim()
    .split(/[\t\n\r ]+/u)
    .filter(Boolean);
}

function canonicalAttributeValue(localName, value) {
  return IDREF_ATTRIBUTES.has(localName)
    ? localIdrefTargets(value).join(' ')
    : value;
}

/** Analyze one admitted Phase 03 IR value against the declared subset. */
export function analyzeStaticSvgSource(ir) {
  const projection = emptyProjection();
  const coverage = Object.fromEntries(
    DIMENSIONS.map(name => [name, 'complete'])
  );
  const diagnosticCodes = new Set();
  const mark = (dimensions, code) => {
    for (const dimension of dimensions) coverage[dimension] = 'partial';
    diagnosticCodes.add(code);
  };
  const markAll = code => mark(DIMENSIONS, code);
  if (!ir || ir.version !== 'svger-ir-v1' || !ir.root) {
    return {
      schemaVersion: STATIC_SVG_SOURCE_ORACLE_SCHEMA,
      status: 'invalid',
      analysisStatus: 'invalid',
      coverageStatus: 'unresolved',
      validity: {
        status: 'unresolved',
        issues: [
          { code: 'E_SOURCE_ORACLE_INPUT_INVALID', state: 'unresolved' },
        ],
      },
      projectionSha256: null,
      coverage: Object.fromEntries(
        DIMENSIONS.map(name => [name, 'unresolved'])
      ),
      projection: null,
      diagnosticCodes: ['E_SOURCE_ORACLE_INPUT_INVALID'],
      grammar: STATIC_SVG_GRAMMAR,
    };
  }

  if (
    ir.root.name.localName !== 'svg' ||
    (ir.root.name.namespaceUri !== SVG && ir.root.name.namespaceUri !== null)
  ) {
    markAll('E_SOURCE_ORACLE_ROOT_UNSUPPORTED');
  }
  if (ir.root.name.namespaceUri === null)
    mark(['namespaces'], 'E_SOURCE_ORACLE_NAMESPACE_UNRESOLVED');

  const ids = [];
  const pendingReferences = [];
  const pendingIdrefs = [];
  const visit = (element, inheritedSpace, elementPath, isRoot = false) => {
    const name = element.name;
    const namespaceUri = name.namespaceUri;
    if (namespaceUri !== SVG || !ELEMENTS.has(name.localName))
      markAll('E_SOURCE_ORACLE_ELEMENT_UNSUPPORTED');
    if (name.localName === 'foreignObject')
      markAll('E_SOURCE_ORACLE_FOREIGN_CONTENT');
    projection.namespaces.push({
      kind: 'element',
      namespaceUri,
      localName: name.localName,
    });

    const xmlSpaceState = element.xmlSpace;
    const xmlSpace =
      xmlSpaceState?.state === 'resolved' ? xmlSpaceState.value : null;
    if (xmlSpace === null)
      mark(['text'], 'E_SOURCE_ORACLE_XML_SPACE_UNRESOLVED');

    const projectedAttributes = [];
    for (const attribute of element.attributes) {
      const attrName = attribute.name;
      const localName = attrName.localName;
      const attrNamespace = attrName.namespaceUri;
      if (attrNamespace === XMLNS) {
        const isAllowedBinding =
          (localName === 'xmlns' && attribute.value === SVG) ||
          (localName === 'xlink' && attribute.value === XLINK) ||
          (localName === 'xml' && attribute.value === XML) ||
          (localName !== 'xml' &&
            localName !== 'xmlns' &&
            [SVG, XLINK].includes(attribute.value));
        if (!isAllowedBinding)
          mark(['namespaces'], 'E_SOURCE_ORACLE_NAMESPACE_BINDING_UNSUPPORTED');
        continue;
      }
      if (attrNamespace !== null) {
        projection.namespaces.push({
          kind: 'attribute',
          namespaceUri: attrNamespace,
          localName,
        });
      }
      if (
        attrNamespace !== null &&
        !(
          (attrNamespace === XML && localName === XML_SPACE) ||
          (attrNamespace === XLINK && localName === 'href')
        )
      ) {
        mark(
          ['namespaces', 'attributes'],
          'E_SOURCE_ORACLE_ATTRIBUTE_NAMESPACE_UNSUPPORTED'
        );
      }
      if (
        (localName === 'href' &&
          attrNamespace !== null &&
          attrNamespace !== XLINK) ||
        (localName === 'id' && attrNamespace !== null)
      ) {
        mark(['references'], 'E_SOURCE_ORACLE_REFERENCE_NAMESPACE_UNSUPPORTED');
      }
      const isKnownAttribute =
        (attrNamespace === null && ATTRIBUTES.has(localName)) ||
        (attrNamespace === XLINK && localName === 'href') ||
        (attrNamespace === XML && localName === XML_SPACE);
      const isAria = localName.startsWith('aria-');
      if (!isKnownAttribute && !(isAria && ARIA_ATTRIBUTES.has(localName))) {
        mark(['attributes'], 'E_SOURCE_ORACLE_ATTRIBUTE_UNSUPPORTED');
        if (isAria) mark(['accessibility'], 'E_SOURCE_ORACLE_ARIA_UNSUPPORTED');
      }
      if (
        localName === 'style' ||
        localName === 'class' ||
        /url\s*\(/iu.test(attribute.value)
      ) {
        if (localName === 'style' || /url\s*\(/iu.test(attribute.value))
          mark(['references'], 'E_SOURCE_ORACLE_CSS_REFERENCE_UNSUPPORTED');
        mark(
          ['geometry', 'accessibility'],
          'E_SOURCE_ORACLE_STYLE_EFFECTS_UNRESOLVED'
        );
      }
      if (attrNamespace === XML && localName === XML_SPACE) {
        if (attribute.value !== 'default' && attribute.value !== 'preserve')
          mark(['text'], 'E_SOURCE_ORACLE_XML_SPACE_INVALID');
      }

      if (
        attrNamespace === null &&
        localName === 'id' &&
        attribute.value !== ''
      )
        ids.push(attribute.value);
      if (
        localName === 'href' &&
        (attrNamespace === null || attrNamespace === XLINK)
      ) {
        pendingReferences.push(attribute.value);
      }
      if (
        attrNamespace === null &&
        (localName === 'role' ||
          localName === 'tabindex' ||
          localName === 'focusable' ||
          isAria)
      ) {
        projection.accessibility.attributes.push({
          name: localName,
          value: canonicalAttributeValue(localName, attribute.value),
        });
        if (IDREF_ATTRIBUTES.has(localName))
          pendingIdrefs.push({
            path: elementPath,
            attribute: localName,
            value: attribute.value,
          });
      }
      if (
        isRoot &&
        attrNamespace === null &&
        ['viewBox', 'width', 'height'].includes(localName)
      ) {
        projection.geometry[localName] = attribute.value;
      }
      projectedAttributes.push({
        namespaceUri: attrNamespace,
        localName,
        value: canonicalAttributeValue(localName, attribute.value),
      });
    }
    projectedAttributes.sort(
      (left, right) =>
        String(left.namespaceUri).localeCompare(
          String(right.namespaceUri),
          'en'
        ) || left.localName.localeCompare(right.localName, 'en')
    );
    projection.attributes.push({
      elementNamespaceUri: namespaceUri,
      elementLocalName: name.localName,
      attributes: projectedAttributes,
    });

    if (name.namespaceUri === SVG && name.localName === 'title') {
      const value = textOnly(element);
      if (value === null)
        mark(['accessibility'], 'E_SOURCE_ORACLE_TITLE_MARKUP_UNSUPPORTED');
      else projection.accessibility.titles.push(value);
    }
    if (name.namespaceUri === SVG && name.localName === 'desc') {
      const value = textOnly(element);
      if (value === null)
        mark(['accessibility'], 'E_SOURCE_ORACLE_DESC_MARKUP_UNSUPPORTED');
      else projection.accessibility.descriptions.push(value);
    }

    let childElementIndex = 0;
    for (const child of element.children) {
      if (child.kind === 'text' || child.kind === 'cdata') {
        if (
          ELEMENT_ONLY_CONTAINERS.has(name.localName) &&
          xmlSpace !== 'preserve' &&
          /^\s*$/u.test(child.value)
        ) {
          continue;
        }
        if (!TEXT_CONTAINERS.has(name.localName))
          mark(['text'], 'E_SOURCE_ORACLE_TEXT_CONTEXT_UNSUPPORTED');
        const last = projection.text.at(-1);
        if (
          last &&
          JSON.stringify(last.path) === JSON.stringify(elementPath) &&
          last.xmlSpace === xmlSpace
        ) {
          last.value += child.value;
        } else {
          projection.text.push({
            path: [...elementPath],
            value: child.value,
            xmlSpace,
          });
        }
      } else if (child.kind === 'element') {
        visit(child, xmlSpace ?? inheritedSpace, [
          ...elementPath,
          childElementIndex,
        ]);
        childElementIndex++;
      } else if (child.kind !== 'comment') {
        markAll('E_SOURCE_ORACLE_NODE_UNSUPPORTED');
      }
    }
  };
  visit(ir.root, 'default', [], true);

  const idCounts = new Map();
  for (const id of ids) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  projection.references.ids = ids;
  projection.references.occurrences = pendingReferences.map(value => {
    if (!value.startsWith('#') || value.length < 2)
      return { state: 'blocked-external', target: value };
    const target = value.slice(1);
    const count = idCounts.get(target) ?? 0;
    return {
      state: count === 0 ? 'unresolved' : count > 1 ? 'ambiguous' : 'resolved',
      target,
    };
  });
  projection.accessibility.idrefs = pendingIdrefs.map(item => ({
    path: item.path,
    attribute: item.attribute,
    targets: localIdrefTargets(item.value).map(target => {
      const count = idCounts.get(target) ?? 0;
      return {
        target,
        state:
          count === 0 ? 'unresolved' : count > 1 ? 'ambiguous' : 'resolved',
      };
    }),
  }));

  const coverageStatus = Object.values(coverage).every(
    value => value === 'complete'
  )
    ? 'complete'
    : 'partial';
  const validity = semanticValidity(projection, coverageStatus !== 'complete');
  if (diagnosticCodes.has('E_SOURCE_ORACLE_XML_SPACE_INVALID')) {
    validity.status = 'invalid';
    validity.issues.push({ code: 'E_XML_SPACE_INVALID', state: 'invalid' });
    validity.issues.sort((left, right) =>
      left.code.localeCompare(right.code, 'en')
    );
  }

  return {
    schemaVersion: STATIC_SVG_SOURCE_ORACLE_SCHEMA,
    status: coverageStatus,
    analysisStatus: coverageStatus,
    coverageStatus,
    validity,
    projectionSha256: digestStaticProjection(projection),
    coverage,
    projection,
    diagnosticCodes: [...diagnosticCodes].sort(),
    grammar: STATIC_SVG_GRAMMAR,
  };
}
