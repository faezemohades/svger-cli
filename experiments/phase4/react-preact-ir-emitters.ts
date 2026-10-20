/** Experimental React/Preact JSX emitters over the shared validated SVG IR v1. */
import type { ElementNode, IRDocument, IRNode } from '../phase3/ir-v1.js';
import { validateStaticSvgIRV1 as prepareSvelteStaticIR } from './svelte-js-ir-emitter.js';

const XML = 'http://www.w3.org/XML/1998/namespace';
const XLINK = 'http://www.w3.org/1999/xlink';
const XMLNS = 'http://www.w3.org/2000/xmlns/';
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

export class FrameworkIrEmitterError extends Error {
  constructor(
    readonly code:
      | 'E_FRAMEWORK_IR_INVALID'
      | 'E_FRAMEWORK_IR_UNSUPPORTED'
      | 'E_FRAMEWORK_IR_LIMIT',
    message: string
  ) {
    super(message);
    this.name = 'FrameworkIrEmitterError';
  }
}

export interface FrameworkEmitterResult {
  readonly schemaVersion: string;
  readonly outcome: 'complete';
  readonly content: string;
  readonly outputBytes: number;
  readonly supportedSubset: 'static-svg-ir-v1';
}

export function validateStaticSvgIRV1(input: unknown): IRDocument {
  // Reuse the qualified shared static-SVG semantic and reference boundary;
  // no framework emitter needs a second traversal or a parallel validator.
  return prepareSvelteStaticIR(input).document;
}

function identifier(name: string): void {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name))
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_INVALID',
      'Component name is not a JavaScript identifier'
    );
}

export function frameworkJsStringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/</gu, '\\u003c')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}

export function frameworkDimensionDefault(value: string | undefined): string {
  if (value === undefined) return '24';
  const normalized = value.replace(/px$/u, '');
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(normalized)) {
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) return String(numeric);
  }
  return frameworkJsStringLiteral(value);
}

export function frameworkRootAttribute(
  root: ElementNode,
  name: string
): string | undefined {
  return root.attributes.find(
    attribute =>
      attribute.name.namespaceUri === null && attribute.name.localName === name
  )?.value;
}

const JSX_NAMES: Readonly<Record<string, string>> = Object.freeze({
  class: 'className',
  for: 'htmlFor',
  'clip-path': 'clipPath',
  'clip-rule': 'clipRule',
  'fill-rule': 'fillRule',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-opacity': 'strokeOpacity',
  'fill-opacity': 'fillOpacity',
  'xml:space': 'xmlSpace',
  'xlink:href': 'xlinkHref',
});

function jsxName(attribute: ElementNode['attributes'][number]): string {
  const { namespaceUri, localName } = attribute.name;
  if (namespaceUri === XLINK) return 'xlinkHref';
  if (namespaceUri === XML) return 'xmlSpace';
  if (namespaceUri !== null)
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'Foreign attribute namespace is unsupported'
    );
  return JSX_NAMES[localName] ?? localName;
}

export function isContractRootAttribute(name: string): boolean {
  return [
    'class',
    'style',
    'width',
    'height',
    'fill',
    'stroke',
    'viewBox',
  ].includes(name);
}

function renderJsxNode(node: IRNode): string {
  if (node.kind === 'text' || node.kind === 'cdata')
    return `{${frameworkJsStringLiteral(node.value)}}`;
  if (node.kind === 'comment')
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'XML comments are not represented by the JSX emitter'
    );
  if (node.kind !== 'element')
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'Generated IR nodes are unsupported'
    );
  const tag = node.name.localName;
  const attrs: string[] = [];
  for (const attribute of node.attributes) {
    if (attribute.name.namespaceUri === XMLNS) continue;
    attrs.push(
      `${jsxName(attribute)}=${frameworkJsStringLiteral(attribute.value)}`
    );
  }
  const open = `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}`;
  if (node.children.length === 0) return `${open} />`;
  return `${open}>${node.children.map(child => renderJsxNode(child)).join('')}</${tag}>`;
}

export function jsxRootStaticAttributes(root: ElementNode): string {
  return root.attributes
    .filter(
      attribute =>
        attribute.name.namespaceUri !== XMLNS &&
        !(
          attribute.name.namespaceUri === null &&
          isContractRootAttribute(attribute.name.localName)
        )
    )
    .map(
      attribute =>
        `${jsxName(attribute)}=${frameworkJsStringLiteral(attribute.value)}`
    )
    .join(' ');
}

function result(
  schemaVersion: string,
  content: string,
  maxOutputBytes = MAX_OUTPUT_BYTES
): FrameworkEmitterResult {
  const outputBytes = Buffer.byteLength(content, 'utf8');
  if (
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes <= 0 ||
    maxOutputBytes > MAX_OUTPUT_BYTES ||
    outputBytes > maxOutputBytes
  )
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_LIMIT',
      'Generated component exceeds the 16 MiB output limit'
    );
  return Object.freeze({
    schemaVersion,
    outcome: 'complete',
    content,
    outputBytes,
    supportedSubset: 'static-svg-ir-v1',
  });
}

function defaults(root: ElementNode) {
  return {
    width: frameworkDimensionDefault(frameworkRootAttribute(root, 'width')),
    height: frameworkDimensionDefault(frameworkRootAttribute(root, 'height')),
    fill: frameworkJsStringLiteral(
      frameworkRootAttribute(root, 'fill') || 'currentColor'
    ),
    viewBox: frameworkJsStringLiteral(
      frameworkRootAttribute(root, 'viewBox') || '0 0 24 24'
    ),
  };
}

export function emitReactFromIR(
  input: unknown,
  componentName: string,
  typescript = false,
  maxOutputBytes = MAX_OUTPUT_BYTES
): FrameworkEmitterResult {
  const document = validateStaticSvgIRV1(input);
  identifier(componentName);
  const d = defaults(document.root);
  const rootAttrs = jsxRootStaticAttributes(document.root);
  const children = document.root.children
    .map(child => renderJsxNode(child))
    .join('');
  const typeSection = typescript
    ? `import type { SVGProps } from 'react';\nexport interface ${componentName}Props extends SVGProps<SVGSVGElement> { size?: number | string; }\n`
    : '';
  const forwardType = typescript
    ? `React.forwardRef<SVGSVGElement, ${componentName}Props>`
    : 'React.forwardRef';
  const content = `import React from 'react';\n${typeSection}const ${componentName} = ${forwardType}(({ size, className, style, ...props }, ref) => {\n  const dimensions = size ? { width: size, height: size } : { width: props.width || ${d.width}, height: props.height || ${d.height} };\n  return (<svg ${rootAttrs} ref={ref} viewBox={${d.viewBox}} xmlns="http://www.w3.org/2000/svg" width={dimensions.width} height={dimensions.height} fill={props.fill || ${d.fill}} className={className} style={style} {...props}>${children}</svg>);\n});\n${componentName}.displayName = ${frameworkJsStringLiteral(componentName)};\nexport default ${componentName};\n`;
  return result(
    `svger-react-${typescript ? 'tsx' : 'jsx'}-ir-emitter-v1`,
    content,
    maxOutputBytes
  );
}

export function emitPreactFromIR(
  input: unknown,
  componentName: string,
  typescript = false,
  maxOutputBytes = MAX_OUTPUT_BYTES
): FrameworkEmitterResult {
  const document = validateStaticSvgIRV1(input);
  identifier(componentName);
  const d = defaults(document.root);
  const rootAttrs = jsxRootStaticAttributes(document.root);
  const children = document.root.children
    .map(child => renderJsxNode(child))
    .join('');
  const types = typescript
    ? `import type { FunctionComponent } from 'preact';\nimport type { JSX } from 'preact/jsx-runtime';\nexport interface ${componentName}Props extends JSX.SVGAttributes<SVGSVGElement> { className?: string; width?: string | number; height?: string | number; fill?: string; stroke?: string; }\n`
    : '';
  const typed = typescript ? `: FunctionComponent<${componentName}Props>` : '';
  const content = `import { h } from 'preact';\n${types}const ${componentName}${typed} = ({ className, style, width, height, fill, stroke, ...props }) => (<svg ${rootAttrs} className={className} style={style} width={width || ${d.width}} height={height || ${d.height}} fill={fill || ${d.fill}} stroke={stroke} viewBox={${d.viewBox}} xmlns="http://www.w3.org/2000/svg" {...props}>${children}</svg>);\nexport default ${componentName};\n`;
  return result(
    `svger-preact-${typescript ? 'tsx' : 'jsx'}-ir-emitter-v1`,
    content,
    maxOutputBytes
  );
}
