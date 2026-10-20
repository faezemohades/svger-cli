/** Experimental Angular TypeScript emitter consuming validated static SVG IR v1. */
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

function result(
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
    schemaVersion: 'svger-angular-ts-ir-emitter-v1',
    outcome: 'complete',
    content,
    outputBytes,
    supportedSubset: 'static-svg-ir-v1',
  });
}

function validName(value: string): void {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(value))
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_INVALID',
      'Component name is not a TypeScript identifier'
    );
}

function xmlEscape(value: string, attribute = false): string {
  let escaped = value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
  escaped = escaped.replace(/\{/gu, '&#123;').replace(/\}/gu, '&#125;');
  if (attribute) escaped = escaped.replace(/"/gu, '&quot;');
  return escaped;
}

function qname(node: ElementNode['attributes'][number]): string {
  return node.name.qualifiedName;
}

function nodeMarkup(node: IRNode): string {
  if (node.kind === 'text' || node.kind === 'cdata')
    return xmlEscape(node.value);
  if (node.kind === 'comment') return `<!--${node.value}-->`;
  if (node.kind !== 'element')
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'Generated IR nodes are unsupported'
    );
  const attrs = node.attributes
    .filter(attribute => attribute.name.namespaceUri !== XMLNS)
    .map(
      attribute => `${qname(attribute)}="${xmlEscape(attribute.value, true)}"`
    )
    .join(' ');
  const open = `<${node.name.localName}${attrs ? ` ${attrs}` : ''}`;
  if (!node.children.length) return `${open} />`;
  return `${open}>${node.children.map(nodeMarkup).join('')}</${node.name.localName}>`;
}

function templateEscape(value: string): string {
  return value
    .replace(/\\/gu, '\\\\')
    .replace(/`/gu, '\\`')
    .replace(/\$\{/gu, '\\${');
}

export function emitAngularFromIR(
  input: unknown,
  componentName: string,
  options: {
    readonly standalone?: boolean;
    readonly maxOutputBytes?: number;
  } = {}
): FrameworkEmitterResult {
  const document = validateStaticSvgIRV1(input);
  validName(componentName);
  const standalone = options.standalone ?? true;
  const root = document.root;
  const rootAttrs = root.attributes
    .filter(attribute => attribute.name.namespaceUri !== XMLNS)
    .filter(
      attribute =>
        attribute.name.namespaceUri !== null ||
        !isContractRootAttribute(attribute.name.localName)
    )
    .map(
      attribute => `${qname(attribute)}="${xmlEscape(attribute.value, true)}"`
    )
    .join(' ');
  const width = frameworkDimensionDefault(
    frameworkRootAttribute(root, 'width')
  );
  const height = frameworkDimensionDefault(
    frameworkRootAttribute(root, 'height')
  );
  const fill = frameworkJsStringLiteral(
    frameworkRootAttribute(root, 'fill') || 'currentColor'
  );
  const markup = `<svg ${rootAttrs} [attr.class]="className" [attr.width]="width" [attr.height]="height" [attr.fill]="fill" [attr.stroke]="stroke" viewBox="${xmlEscape(frameworkRootAttribute(root, 'viewBox') || '0 0 24 24', true)}" xmlns="${SVG}">${root.children.map(nodeMarkup).join('')}</svg>`;
  const standaloneImport = standalone ? ', ChangeDetectionStrategy' : '';
  const componentExtra = standalone
    ? '  standalone: true,\n  changeDetection: ChangeDetectionStrategy.OnPush,\n'
    : '';
  const content = `import { Component, Input${standaloneImport} } from '@angular/core';\n@Component({\n  selector: ${frameworkJsStringLiteral(componentName.replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase())},\n${componentExtra}  template: \`${templateEscape(markup)}\`,\n})\nexport class ${componentName}Component {\n  @Input() className: string = '';\n  @Input() width: string | number = ${width};\n  @Input() height: string | number = ${height};\n  @Input() fill: string = ${fill};\n  @Input() stroke: string = '';\n}\n`;
  return result(content, options.maxOutputBytes);
}
