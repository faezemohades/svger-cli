/** Experimental React Native SVG emitter for the explicitly supported primitives. */
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

const XMLNS = 'http://www.w3.org/2000/xmlns/';
const XML = 'http://www.w3.org/XML/1998/namespace';
const XLINK = 'http://www.w3.org/1999/xlink';
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

const COMPONENTS: Readonly<Record<string, string>> = Object.freeze({
  g: 'G',
  path: 'Path',
  circle: 'Circle',
  rect: 'Rect',
  line: 'Line',
  polygon: 'Polygon',
  polyline: 'Polyline',
  ellipse: 'Ellipse',
  defs: 'Defs',
  clipPath: 'ClipPath',
  linearGradient: 'LinearGradient',
  radialGradient: 'RadialGradient',
  stop: 'Stop',
});

const ATTRIBUTES = new Set([
  'id',
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
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'fill-opacity',
  'opacity',
  'transform',
  'clip-path',
  'clip-rule',
  'offset',
  'stop-color',
  'stop-opacity',
  'viewBox',
  'width',
  'height',
  'preserveAspectRatio',
]);

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
    schemaVersion: 'svger-react-native-ir-emitter-v1',
    outcome: 'complete',
    content,
    outputBytes,
    supportedSubset: 'static-svg-ir-v1',
  });
}

function name(value: string): void {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(value))
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_INVALID',
      'Component name is not a JavaScript identifier'
    );
}

function attributeName(attribute: ElementNode['attributes'][number]): string {
  const { namespaceUri, localName } = attribute.name;
  if (namespaceUri === XMLNS) return '';
  if (namespaceUri === XLINK && localName === 'href') return 'href';
  if (namespaceUri === XML && localName === 'space') return 'xmlSpace';
  if (namespaceUri !== null)
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'Foreign namespace attribute is unsupported in React Native SVG'
    );
  if (localName === 'aria-label') return 'accessibilityLabel';
  if (!ATTRIBUTES.has(localName))
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      `React Native SVG attribute is unsupported: ${localName}`
    );
  const mappings: Readonly<Record<string, string>> = {
    'fill-rule': 'fillRule',
    'stroke-width': 'strokeWidth',
    'stroke-linecap': 'strokeLinecap',
    'stroke-linejoin': 'strokeLinejoin',
    'stroke-dasharray': 'strokeDasharray',
    'stroke-dashoffset': 'strokeDashoffset',
    'stroke-opacity': 'strokeOpacity',
    'fill-opacity': 'fillOpacity',
    'clip-path': 'clipPath',
    'clip-rule': 'clipRule',
    'stop-color': 'stopColor',
    'stop-opacity': 'stopOpacity',
  };
  return mappings[localName] ?? localName;
}

function render(node: IRNode): string {
  if (node.kind === 'text' || node.kind === 'cdata')
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'SVG text nodes are unsupported by the React Native SVG subset'
    );
  if (node.kind === 'comment')
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'Comments are unsupported in React Native SVG output'
    );
  if (node.kind !== 'element')
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      'Generated IR nodes are unsupported'
    );
  const component = COMPONENTS[node.name.localName];
  if (!component)
    throw new FrameworkIrEmitterError(
      'E_FRAMEWORK_IR_UNSUPPORTED',
      `React Native SVG element is unsupported: ${node.name.localName}`
    );
  const attrs = node.attributes
    .map(attribute => {
      const mapped = attributeName(attribute);
      return mapped
        ? `${mapped}=${frameworkJsStringLiteral(attribute.value)}`
        : '';
    })
    .filter(Boolean);
  const open = `<${component}${attrs.length ? ` ${attrs.join(' ')}` : ''}`;
  if (!node.children.length) return `${open} />`;
  return `${open}>${node.children.map(render).join('')}</${component}>`;
}

export function emitReactNativeFromIR(
  input: unknown,
  componentName: string,
  typescript = false,
  maxOutputBytes = MAX_OUTPUT_BYTES
): FrameworkEmitterResult {
  const document = validateStaticSvgIRV1(input);
  name(componentName);
  const width = frameworkDimensionDefault(
    frameworkRootAttribute(document.root, 'width')
  );
  const height = frameworkDimensionDefault(
    frameworkRootAttribute(document.root, 'height')
  );
  const fill = frameworkJsStringLiteral(
    frameworkRootAttribute(document.root, 'fill') || 'currentColor'
  );
  const rootAttrs = document.root.attributes
    .map(attribute => {
      if (attribute.name.namespaceUri === XMLNS) return '';
      if (
        attribute.name.namespaceUri === null &&
        isContractRootAttribute(attribute.name.localName)
      )
        return '';
      const mapped = attributeName(attribute);
      return mapped
        ? `${mapped}=${frameworkJsStringLiteral(attribute.value)}`
        : '';
    })
    .filter(Boolean)
    .join(' ');
  const types = typescript
    ? `export type ${componentName}Props = React.ComponentProps<typeof Svg> & { size?: string | number; color?: string; };\n`
    : '';
  const typed = typescript
    ? `<React.ElementRef<typeof Svg>, ${componentName}Props>`
    : '';
  const content = `import React from 'react';\nimport Svg, { Path, Circle, Rect, Line, Polygon, Polyline, Ellipse, G, Defs, ClipPath, LinearGradient, RadialGradient, Stop } from 'react-native-svg';\n${types}const ${componentName} = React.forwardRef${typed}(({ size, color, ...props }, ref) => {\n const dimensions = size ? { width: size, height: size } : { width: props.width || ${width}, height: props.height || ${height} };\n return (<Svg ${rootAttrs} ref={ref} viewBox=${frameworkJsStringLiteral(frameworkRootAttribute(document.root, 'viewBox') || '0 0 24 24')} width={dimensions.width} height={dimensions.height} fill={color || props.fill || ${fill}} {...props}>${document.root.children.map(render).join('')}</Svg>);\n});\n${componentName}.displayName = ${frameworkJsStringLiteral(componentName)};\nexport default ${componentName};\n`;
  return result(content, maxOutputBytes);
}
