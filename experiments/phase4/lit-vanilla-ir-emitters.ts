/** Experimental Lit and DOM-factory emitters consuming validated SVG IR v1. */
import type { ElementNode, IRNode } from '../phase3/ir-v1.js';
import {
  FrameworkIrEmitterError,
  type FrameworkEmitterResult,
  frameworkDimensionDefault,
  frameworkJsStringLiteral,
  frameworkRootAttribute,
  isContractRootAttribute,
  validateStaticSvgIRV1,
} from './react-preact-ir-emitters.js';

const SVG = 'http://www.w3.org/2000/svg';
const XMLNS = 'http://www.w3.org/2000/xmlns/';
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

function componentName(value: string): void {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(value))
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_INVALID',
      'Component name is not a JavaScript identifier'
    );
}

function kebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/([A-Z])([A-Z])([a-z])/gu, '$1-$2$3')
    .toLowerCase();
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

function attrQName(node: ElementNode['attributes'][number]): string {
  if (node.name.namespaceUri === XMLNS) return node.name.qualifiedName;
  return node.name.qualifiedName;
}

function xmlEscape(value: string, attribute = false): string {
  let escaped = value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
  if (attribute) escaped = escaped.replace(/"/gu, '&quot;');
  return escaped;
}

function staticElement(node: ElementNode, omitComponentProps = false): string {
  const attrs = node.attributes
    .filter(attribute => attribute.name.namespaceUri !== XMLNS)
    .filter(
      attribute =>
        !omitComponentProps ||
        attribute.name.namespaceUri !== null ||
        !isContractRootAttribute(attribute.name.localName)
    )
    .map(
      attribute =>
        `${attrQName(attribute)}="${xmlEscape(attribute.value, true)}"`
    );
  const open = `<${node.name.localName}${attrs.length ? ` ${attrs.join(' ')}` : ''}`;
  if (!node.children.length) return `${open} />`;
  return `${open}>${node.children.map(staticNode).join('')}</${node.name.localName}>`;
}

function staticNode(node: IRNode): string {
  if (node.kind === 'text' || node.kind === 'cdata')
    return xmlEscape(node.value);
  if (node.kind === 'comment') return `<!--${node.value}-->`;
  if (node.kind !== 'element')
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'Generated IR nodes are unsupported'
    );
  return staticElement(node);
}

function litTemplateEscape(value: string): string {
  return value
    .replace(/\\/gu, '\\\\')
    .replace(/`/gu, '\\`')
    .replace(/\$\{/gu, '\\${');
}

export function emitLitFromIR(
  input: unknown,
  name: string,
  typescript = false,
  maxOutputBytes = MAX_OUTPUT_BYTES
): FrameworkEmitterResult {
  const document = validateStaticSvgIRV1(input);
  componentName(name);
  const tag = kebab(name);
  const width = frameworkJsStringLiteral(
    frameworkRootAttribute(document.root, 'width') || '24'
  );
  const height = frameworkJsStringLiteral(
    frameworkRootAttribute(document.root, 'height') || '24'
  );
  const fill = frameworkJsStringLiteral(
    frameworkRootAttribute(document.root, 'fill') || 'currentColor'
  );
  const rootAttrs = document.root.attributes
    .filter(attribute => attribute.name.namespaceUri !== XMLNS)
    .filter(
      attribute =>
        attribute.name.namespaceUri !== null ||
        !isContractRootAttribute(attribute.name.localName)
    )
    .map(
      attribute =>
        `${attrQName(attribute)}="${xmlEscape(attribute.value, true)}"`
    )
    .join(' ');
  const template = `${litTemplateEscape(`<svg ${rootAttrs} class="`)}\${this.className}${litTemplateEscape('" width="')}\${this.width}${litTemplateEscape('" height="')}\${this.height}${litTemplateEscape('" fill="')}\${this.fill}${litTemplateEscape('" stroke="')}\${this.stroke}${litTemplateEscape(`" viewBox="${xmlEscape(frameworkRootAttribute(document.root, 'viewBox') || '0 0 24 24', true)}" xmlns="${SVG}">`)}${litTemplateEscape(document.root.children.map(staticNode).join(''))}${litTemplateEscape('</svg>')}`;
  const common = `import { LitElement, css, svg } from 'lit';\n`;
  const props = `className: { type: String }, width: { type: String, reflect: true }, height: { type: String, reflect: true }, fill: { type: String, reflect: true }, stroke: { type: String, reflect: true }`;
  const content = typescript
    ? `${common}import { customElement, property } from 'lit/decorators.js';\n@customElement(${frameworkJsStringLiteral(tag)})\nexport class ${name} extends LitElement {\n  @property({ type: String }) className = '';\n  @property({ type: String, reflect: true }) width = ${width};\n  @property({ type: String, reflect: true }) height = ${height};\n  @property({ type: String, reflect: true }) fill = ${fill};\n  @property({ type: String, reflect: true }) stroke = '';\n  static styles = css\`:host { display: inline-block; }\`;\n  render() { return svg\`${template}\`; }\n}\ndeclare global { interface HTMLElementTagNameMap { ${frameworkJsStringLiteral(tag)}: ${name}; } }\n`
    : `${common}export class ${name} extends LitElement {\n  static properties = { ${props} };\n  static styles = css\`:host { display: inline-block; }\`;\n  constructor() { super(); this.className = ''; this.width = ${width}; this.height = ${height}; this.fill = ${fill}; this.stroke = ''; }\n  render() { return svg\`${template}\`; }\n}\ncustomElements.define(${frameworkJsStringLiteral(tag)}, ${name});\n`;
  return result(
    `svger-lit-${typescript ? 'ts' : 'js'}-ir-emitter-v1`,
    content,
    maxOutputBytes
  );
}

function createStatements(
  node: IRNode,
  parent: string,
  state: { index: number; lines: string[] }
): void {
  if (node.kind === 'text' || node.kind === 'cdata') {
    state.lines.push(
      `${parent}.appendChild(document.createTextNode(${frameworkJsStringLiteral(node.value)}));`
    );
    return;
  }
  if (node.kind === 'comment') {
    state.lines.push(
      `${parent}.appendChild(document.createComment(${frameworkJsStringLiteral(node.value)}));`
    );
    return;
  }
  if (node.kind !== 'element')
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'Generated IR nodes are unsupported'
    );
  const variable = `_svgNode${state.index++}`;
  state.lines.push(
    `const ${variable} = document.createElementNS(${frameworkJsStringLiteral(SVG)}, ${frameworkJsStringLiteral(node.name.localName)});`
  );
  for (const attribute of node.attributes) {
    if (attribute.name.namespaceUri === XMLNS) continue;
    if (attribute.name.namespaceUri) {
      state.lines.push(
        `${variable}.setAttributeNS(${frameworkJsStringLiteral(attribute.name.namespaceUri)}, ${frameworkJsStringLiteral(attribute.name.qualifiedName)}, ${frameworkJsStringLiteral(attribute.value)});`
      );
    } else {
      state.lines.push(
        `${variable}.setAttribute(${frameworkJsStringLiteral(attribute.name.localName)}, ${frameworkJsStringLiteral(attribute.value)});`
      );
    }
  }
  for (const child of node.children) createStatements(child, variable, state);
  state.lines.push(`${parent}.appendChild(${variable});`);
}

export function emitVanillaFromIR(
  input: unknown,
  name: string,
  typescript = false,
  maxOutputBytes = MAX_OUTPUT_BYTES
): FrameworkEmitterResult {
  const document = validateStaticSvgIRV1(input);
  componentName(name);
  const root = document.root;
  const width = frameworkDimensionDefault(
    frameworkRootAttribute(root, 'width')
  );
  const height = frameworkDimensionDefault(
    frameworkRootAttribute(root, 'height')
  );
  const fill = frameworkJsStringLiteral(
    frameworkRootAttribute(root, 'fill') || 'currentColor'
  );
  const props = root.attributes
    .filter(attribute => attribute.name.namespaceUri !== XMLNS)
    .filter(
      attribute =>
        attribute.name.namespaceUri !== null ||
        !isContractRootAttribute(attribute.name.localName)
    )
    .map(attribute =>
      attribute.name.namespaceUri
        ? `svg.setAttributeNS(${frameworkJsStringLiteral(attribute.name.namespaceUri)}, ${frameworkJsStringLiteral(attribute.name.qualifiedName)}, ${frameworkJsStringLiteral(attribute.value)});`
        : `svg.setAttribute(${frameworkJsStringLiteral(attribute.name.localName)}, ${frameworkJsStringLiteral(attribute.value)});`
    );
  const tree = { index: 0, lines: [] as string[] };
  root.children.forEach(child => createStatements(child, 'svg', tree));
  const tsTypes = typescript
    ? `export interface ${name}Options { className?: string; width?: string | number; height?: string | number; fill?: string; stroke?: string; [key: string]: unknown; }\n`
    : '';
  const signature = typescript
    ? `(options: ${name}Options = {}): SVGSVGElement`
    : '(options = {})';
  const content = `${tsTypes}export function ${name}${signature} {\n  const { className = '', width = ${width}, height = ${height}, fill = ${fill}, stroke = '', ...attrs } = options;\n  const svg = document.createElementNS(${frameworkJsStringLiteral(SVG)}, 'svg');\n  svg.setAttribute('viewBox', ${frameworkJsStringLiteral(frameworkRootAttribute(root, 'viewBox') || '0 0 24 24')});\n  svg.setAttribute('xmlns', ${frameworkJsStringLiteral(SVG)});\n  if (className) svg.setAttribute('class', String(className));\n  svg.setAttribute('width', String(width));\n  svg.setAttribute('height', String(height));\n  svg.setAttribute('fill', String(fill));\n  if (stroke) svg.setAttribute('stroke', String(stroke));\n  ${props.join('\n  ')}\n  for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, String(value));\n  ${tree.lines.join('\n  ')}\n  return svg;\n}\n`;
  return result(
    `svger-vanilla-${typescript ? 'ts' : 'js'}-ir-emitter-v1`,
    content,
    maxOutputBytes
  );
}
