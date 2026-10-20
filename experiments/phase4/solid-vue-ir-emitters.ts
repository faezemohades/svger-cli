/** Experimental Solid JSX and Vue SFC emitters consuming validated IR v1. */
import type { ElementNode, IRNode } from '../phase3/ir-v1.js';
import {
  FrameworkIrEmitterError,
  type FrameworkEmitterResult,
  frameworkDimensionDefault,
  frameworkJsStringLiteral,
  frameworkRootAttribute,
  isContractRootAttribute,
  jsxRootStaticAttributes,
  validateStaticSvgIRV1,
} from './react-preact-ir-emitters.js';

const XMLNS = 'http://www.w3.org/2000/xmlns/';
const XML = 'http://www.w3.org/XML/1998/namespace';
const XLINK = 'http://www.w3.org/1999/xlink';
const SVG = 'http://www.w3.org/2000/svg';
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

function name(value: string): void {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(value))
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_INVALID',
      'Component name is not a JavaScript identifier'
    );
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

function jsx(node: IRNode): string {
  if (node.kind === 'text' || node.kind === 'cdata')
    return `{${frameworkJsStringLiteral(node.value)}}`;
  if (node.kind === 'comment')
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'XML comments are unsupported in Solid JSX output'
    );
  if (node.kind !== 'element')
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'Generated IR nodes are unsupported'
    );
  const attrs = node.attributes
    .filter(attribute => attribute.name.namespaceUri !== XMLNS)
    .map(attribute => {
      let attrName = attribute.name.localName;
      if (attribute.name.namespaceUri === XML) attrName = `xml:${attrName}`;
      else if (attribute.name.namespaceUri === XLINK) attrName = 'xlinkHref';
      else if (attribute.name.namespaceUri !== null)
        throw new FrameworkIrEmitterError(
          'E_FRAMEWORK_IR_UNSUPPORTED',
          'Foreign attribute namespace is unsupported'
        );
      if (attribute.name.namespaceUri === null) {
        const mapped: Readonly<Record<string, string>> = {
          class: 'class',
          'stroke-width': 'stroke-width',
          'stroke-linecap': 'stroke-linecap',
          'stroke-linejoin': 'stroke-linejoin',
          'fill-rule': 'fill-rule',
          'clip-path': 'clip-path',
        };
        attrName = mapped[attrName] ?? attrName;
      }
      return `${attrName}=${frameworkJsStringLiteral(attribute.value)}`;
    });
  const open = `<${node.name.localName}${attrs.length ? ` ${attrs.join(' ')}` : ''}`;
  if (!node.children.length) return `${open} />`;
  return `${open}>${node.children.map(jsx).join('')}</${node.name.localName}>`;
}

function xmlEscape(value: string, attribute = false): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/\{/gu, '&#123;')
    .replace(/\}/gu, '&#125;')
    .replace(attribute ? /"/gu : /$^/gu, '&quot;');
}

function xmlName(attribute: ElementNode['attributes'][number]): string {
  if (attribute.name.namespaceUri === XMLNS)
    return attribute.name.qualifiedName;
  if (attribute.name.namespaceUri === XML)
    return `xml:${attribute.name.localName}`;
  if (attribute.name.namespaceUri === XLINK)
    return `xlink:${attribute.name.localName}`;
  if (attribute.name.namespaceUri !== null)
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'Foreign attribute namespace is unsupported'
    );
  return attribute.name.localName;
}

function vueNode(node: IRNode, root = false): string {
  if (node.kind === 'text' || node.kind === 'cdata')
    return xmlEscape(node.value);
  if (node.kind === 'comment') return `<!--${node.value}-->`;
  if (node.kind !== 'element')
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'Generated IR nodes are unsupported'
    );
  const attrs: string[] = [];
  if (root) attrs.push(`xmlns="${SVG}"`);
  for (const attribute of node.attributes) {
    if (attribute.name.namespaceUri === XMLNS) continue;
    if (
      root &&
      attribute.name.namespaceUri === null &&
      isContractRootAttribute(attribute.name.localName)
    )
      continue;
    attrs.push(`${xmlName(attribute)}="${xmlEscape(attribute.value, true)}"`);
  }
  const open = `<${node.name.localName}${attrs.length ? ` ${attrs.join(' ')}` : ''}`;
  if (!node.children.length) return `${open} />`;
  return `${open}>${node.children.map(child => vueNode(child)).join('')}</${node.name.localName}>`;
}

function defaults(root: ElementNode) {
  return {
    width: frameworkDimensionDefault(frameworkRootAttribute(root, 'width')),
    height: frameworkDimensionDefault(frameworkRootAttribute(root, 'height')),
    fill: frameworkJsStringLiteral(
      frameworkRootAttribute(root, 'fill') || 'currentColor'
    ),
  };
}

export function emitSolidFromIR(
  input: unknown,
  componentName: string,
  typescript = false,
  maxOutputBytes = MAX_OUTPUT_BYTES
): FrameworkEmitterResult {
  const document = validateStaticSvgIRV1(input);
  name(componentName);
  const d = defaults(document.root);
  const rootAttrs = jsxRootStaticAttributes(document.root);
  const children = document.root.children.map(jsx).join('');
  const types = typescript
    ? `import type { Component, JSX } from 'solid-js';\nexport interface ${componentName}Props extends JSX.SvgSVGAttributes<SVGSVGElement> { className?: string; width?: number | string; height?: number | string; fill?: string; stroke?: string; }\n`
    : '';
  const annotation = typescript ? `: Component<${componentName}Props>` : '';
  const content = `import { createComponent } from 'solid-js';\n${types}const ${componentName}${annotation} = (props) => (<svg ${rootAttrs} class={props.className} style={props.style} width={props.width || ${d.width}} height={props.height || ${d.height}} fill={props.fill || ${d.fill}} stroke={props.stroke} viewBox=${frameworkJsStringLiteral(frameworkRootAttribute(document.root, 'viewBox') || '0 0 24 24')} xmlns="http://www.w3.org/2000/svg" {...props}>${children}</svg>);\nexport default ${componentName};\n`;
  return result(
    `svger-solid-${typescript ? 'tsx' : 'jsx'}-ir-emitter-v1`,
    content,
    maxOutputBytes
  );
}

export interface VueEmitterOptions {
  readonly typescript?: boolean;
  readonly scriptSetup?: boolean;
  readonly maxOutputBytes?: number;
}

export function emitVueFromIR(
  input: unknown,
  componentName: string,
  options: VueEmitterOptions = {}
): FrameworkEmitterResult {
  const document = validateStaticSvgIRV1(input);
  name(componentName);
  const { typescript = false, scriptSetup = true } = options;
  const d = defaults(document.root);
  const root = document.root;
  const attrs = root.attributes
    .filter(
      attribute =>
        attribute.name.namespaceUri !== XMLNS &&
        !(
          attribute.name.namespaceUri === null &&
          isContractRootAttribute(attribute.name.localName)
        )
    )
    .map(
      attribute => `${xmlName(attribute)}="${xmlEscape(attribute.value, true)}"`
    )
    .join(' ');
  const children = root.children.map(child => vueNode(child)).join('');
  const t = typescript ? ' lang="ts"' : '';
  const props = `className: { type: String, default: '' }, style: { type: [String, Object], default: '' }, width: { type: [String, Number], default: ${d.width} }, height: { type: [String, Number], default: ${d.height} }, fill: { type: String, default: ${d.fill} }, stroke: { type: String, default: '' }`;
  const script = scriptSetup
    ? typescript
      ? `<script setup lang="ts">\ninterface Props { className?: string; style?: string | Record<string, unknown>; width?: string | number; height?: string | number; fill?: string; stroke?: string; }\nwithDefaults(defineProps<Props>(), { className: '', width: ${d.width}, height: ${d.height}, fill: ${d.fill}, stroke: '' });\n</script>`
      : `<script setup>\nconst { className = '', style = '', width = ${d.width}, height = ${d.height}, fill = ${d.fill}, stroke = '' } = defineProps({ ${props} });\n</script>`
    : `<script${t}>\nimport { defineComponent } from 'vue';\nexport default defineComponent({ name: ${frameworkJsStringLiteral(componentName)}, props: { ${props} } });\n</script>`;
  const content = `<template>\n<svg ${attrs} :class="className" :style="style" :width="width" :height="height" :fill="fill" :stroke="stroke" viewBox="${xmlEscape(frameworkRootAttribute(root, 'viewBox') || '0 0 24 24', true)}" xmlns="http://www.w3.org/2000/svg" v-bind="$attrs">${children}</svg>\n</template>\n${script}\n`;
  return result(
    `svger-vue-${typescript ? 'ts' : 'js'}-${scriptSetup ? 'setup' : 'options'}-ir-emitter-v1`,
    content,
    options.maxOutputBytes
  );
}
