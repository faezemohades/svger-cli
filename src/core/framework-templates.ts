import { ComponentGenerationOptions, FrameworkType, FrameworkOptions } from '../types/index.js'

// Re-export types for convenience
export type { FrameworkType, FrameworkOptions } from '../types/index.js'

interface SVGAttributes {
  viewBox?: string
  width?: string
  height?: string
  fill?: string
  stroke?: string
  xmlns?: string
  [key: string]: string | undefined
}

export class FrameworkTemplateEngine {
  public generateComponent(options: ComponentGenerationOptions): string {
    const { framework, componentName, svgContent, typescript = true, frameworkOptions = {} } = options

    switch (framework) {
      case 'react':
        return this.generateReactComponent(componentName, svgContent, typescript, frameworkOptions)
      case 'vue':
        return this.generateVueComponent(componentName, svgContent, typescript, frameworkOptions)
      case 'svelte':
        return this.generateSvelteComponent(componentName, svgContent, typescript)
      case 'angular':
        return this.generateAngularComponent(componentName, svgContent, typescript, frameworkOptions)
      case 'solid':
        return this.generateSolidComponent(componentName, svgContent, typescript)
      case 'preact':
        return this.generatePreactComponent(componentName, svgContent, typescript)
      case 'lit':
        return this.generateLitComponent(componentName, svgContent, typescript)
      case 'vanilla':
        return this.generateVanillaComponent(componentName, svgContent, typescript)
      case 'react-native':
        return this.generateReactNativeComponent(componentName, svgContent, typescript, frameworkOptions)
      default:
        throw new Error(`Unsupported framework: ${framework}`)
    }
  }

  public getFileExtension(framework: FrameworkType, typescript: boolean = true): string {
    const tsExt = typescript ? 'ts' : 'js'

    switch (framework) {
      case 'react':
      case 'preact':
      case 'solid':
      case 'react-native':
        return typescript ? 'tsx' : 'jsx'
      case 'vue':
        return 'vue'
      case 'svelte':
        return 'svelte'
      case 'angular':
        return `component.${tsExt}`
      case 'lit':
      case 'vanilla':
        return `${tsExt}`
      default:
        return `${tsExt}`
    }
  }

  private parseSVG(svgContent: string): { attributes: SVGAttributes; innerContent: string } {
    const svgMatch = svgContent.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/)
    if (!svgMatch) {
      return { attributes: {}, innerContent: svgContent }
    }

    const attributesString = svgMatch[1]
    const innerContent = svgMatch[2].trim()
    const attributes: SVGAttributes = {}

    const attrRegex = /(\w+(?:-\w+)*)="([^"]*)"/g
    let match
    while ((match = attrRegex.exec(attributesString)) !== null) {
      attributes[match[1]] = match[2]
    }

    return { attributes, innerContent }
  }

  private generateReactComponent(componentName: string, svgContent: string, typescript: boolean, options: FrameworkOptions): string {
    const { attributes, innerContent } = this.parseSVG(svgContent)
    return `import React from "react";
import type { SVGProps } from "react";

export interface ${componentName}Props extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

const ${componentName} = React.forwardRef<SVGSVGElement, ${componentName}Props>(
  ({ size, className, style, ...props }, ref) => {
    const dimensions = size ? { width: size, height: size } : {
      width: props.width || ${attributes.width || 24},
      height: props.height || ${attributes.height || 24}
    };

    return (
      <svg
        ref={ref}
        viewBox="${attributes.viewBox || '0 0 24 24'}"
        xmlns="http://www.w3.org/2000/svg"
        width={dimensions.width}
        height={dimensions.height}
        fill={props.fill || "${attributes.fill || 'currentColor'}"}
        className={className}
        style={style}
        {...props}
      >
        ${innerContent}
      </svg>
    );
  }
);

${componentName}.displayName = "${componentName}";

export default ${componentName};
`
  }

  private generateVueComponent(componentName: string, svgContent: string, typescript: boolean, options: FrameworkOptions): string {
    const { attributes, innerContent } = this.parseSVG(svgContent)
    const { scriptSetup = true } = options

    if (scriptSetup && typescript) {
      return `<template>
  <svg
    :class="className"
    :style="style"
    :width="width || ${attributes.width || 24}"
    :height="height || ${attributes.height || 24}"
    :fill="fill || '${attributes.fill || 'currentColor'}'"
    :stroke="stroke"
    viewBox="${attributes.viewBox || '0 0 24 24'}"
    xmlns="http://www.w3.org/2000/svg"
    v-bind="$attrs"
  >
    ${innerContent}
  </svg>
</template>

<script setup lang="ts">
interface Props {
  className?: string;
  style?: string | Record<string, any>;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}

withDefaults(defineProps<Props>(), {
  className: '',
  fill: '${attributes.fill || 'currentColor'}',
  width: ${attributes.width || 24},
  height: ${attributes.height || 24}
});
</script>
`
    }

    return `<template>
  <svg
    :class="className"
    :style="style"
    :width="width"
    :height="height"
    :fill="fill"
    :stroke="stroke"
    viewBox="${attributes.viewBox || '0 0 24 24'}"
    xmlns="http://www.w3.org/2000/svg"
    v-bind="$attrs"
  >
    ${innerContent}
  </svg>
</template>

<script${typescript ? ' lang="ts"' : ''}>
import { defineComponent } from 'vue';

export default defineComponent({
  name: '${componentName}',
  props: {
    className: { type: String, default: '' },
    style: { type: [String, Object], default: '' },
    width: { type: [String, Number], default: ${attributes.width || 24} },
    height: { type: [String, Number], default: ${attributes.height || 24} },
    fill: { type: String, default: '${attributes.fill || 'currentColor'}' },
    stroke: { type: String, default: '' }
  }
});
</script>
`
  }

  private generateSvelteComponent(componentName: string, svgContent: string, typescript: boolean): string {
    const { attributes, innerContent } = this.parseSVG(svgContent)
    return `<script${typescript ? ' lang="ts"' : ''}>
  export let className${typescript ? ': string' : ''} = '';
  export let style${typescript ? ': string' : ''} = '';
  export let width${typescript ? ': string | number' : ''} = ${attributes.width || 24};
  export let height${typescript ? ': string | number' : ''} = ${attributes.height || 24};
  export let fill${typescript ? ': string' : ''} = '${attributes.fill || 'currentColor'}';
  export let stroke${typescript ? ': string' : ''} = '';
</script>

<svg
  class={className}
  {style}
  {width}
  {height}
  {fill}
  {stroke}
  viewBox="${attributes.viewBox || '0 0 24 24'}"
  xmlns="http://www.w3.org/2000/svg"
  {...$$restProps}
>
  ${innerContent}
</svg>
`
  }

  private generateAngularComponent(componentName: string, svgContent: string, typescript: boolean, options: FrameworkOptions): string {
    const { attributes, innerContent } = this.parseSVG(svgContent)
    const { standalone = true } = options
    const kebabName = this.toKebabCase(componentName)

    return `import { Component, Input${standalone ? ', ChangeDetectionStrategy' : ''} } from '@angular/core';

@Component({
  selector: '${kebabName}',
  ${standalone ? 'standalone: true,' : ''}
  template: \`
    <svg
      [attr.class]="className"
      [attr.width]="width"
      [attr.height]="height"
      [attr.fill]="fill"
      [attr.stroke]="stroke"
      viewBox="${attributes.viewBox || '0 0 24 24'}"
      xmlns="http://www.w3.org/2000/svg"
    >
      ${innerContent}
    </svg>
  \`,${
    standalone
      ? `
  changeDetection: ChangeDetectionStrategy.OnPush`
      : ''
  }
})
export class ${componentName}Component {
  @Input() className: string = '';
  @Input() width: string | number = ${attributes.width || 24};
  @Input() height: string | number = ${attributes.height || 24};
  @Input() fill: string = '${attributes.fill || 'currentColor'}';
  @Input() stroke: string = '';
}
`
  }

  private generateSolidComponent(componentName: string, svgContent: string, typescript: boolean): string {
    const { attributes, innerContent } = this.parseSVG(svgContent)
    return `import { Component, JSX } from 'solid-js';

export interface ${componentName}Props extends JSX.SvgSVGAttributes<SVGSVGElement> {
  className?: string;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}

const ${componentName}: Component<${componentName}Props> = (props) => (
  <svg
    class={props.className}
    style={props.style}
    width={props.width || ${attributes.width || 24}}
    height={props.height || ${attributes.height || 24}}
    fill={props.fill || '${attributes.fill || 'currentColor'}'}
    stroke={props.stroke}
    viewBox="${attributes.viewBox || '0 0 24 24'}"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    ${innerContent}
  </svg>
);

export default ${componentName};
`
  }

  private generatePreactComponent(componentName: string, svgContent: string, typescript: boolean): string {
    const { attributes, innerContent } = this.parseSVG(svgContent)
    return `import { h, FunctionComponent } from 'preact';
import { JSX } from 'preact/jsx-runtime';

export interface ${componentName}Props extends JSX.SVGAttributes<SVGSVGElement> {
  className?: string;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}

const ${componentName}: FunctionComponent<${componentName}Props> = ({ 
  className, 
  style, 
  width, 
  height, 
  fill, 
  stroke, 
  ...props 
}) => {
  return (
    <svg
      class={className}
      style={style}
      width={width || ${attributes.width || 24}}
      height={height || ${attributes.height || 24}}
      fill={fill || '${attributes.fill || 'currentColor'}'}
      stroke={stroke}
      viewBox="${attributes.viewBox || '0 0 24 24'}"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      ${innerContent}
    </svg>
  );
};

export default ${componentName};
`
  }

  private generateLitComponent(componentName: string, svgContent: string, typescript: boolean): string {
    const { attributes, innerContent } = this.parseSVG(svgContent)
    const kebabName = this.toKebabCase(componentName)

    return `import { LitElement, html, css, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('${kebabName}')
export class ${componentName} extends LitElement {
  @property({ type: String }) className = '';
  @property({ type: String, reflect: true }) width = '${attributes.width || 24}';
  @property({ type: String, reflect: true }) height = '${attributes.height || 24}';
  @property({ type: String, reflect: true }) fill = '${attributes.fill || 'currentColor'}';
  @property({ type: String, reflect: true }) stroke = '';

  static styles = css\`:host { display: inline-block; }\`;

  render() {
    return svg\`
      <svg
        class="\${this.className}"
        width="\${this.width}"
        height="\${this.height}"
        fill="\${this.fill}"
        stroke="\${this.stroke}"
        viewBox="${attributes.viewBox || '0 0 24 24'}"
        xmlns="http://www.w3.org/2000/svg"
      >
        ${innerContent}
      </svg>
    \`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    '${kebabName}': ${componentName};
  }
}
`
  }

  private generateVanillaComponent(componentName: string, svgContent: string, typescript: boolean): string {
    const { attributes, innerContent } = this.parseSVG(svgContent)
    return `export interface ${componentName}Options {
  className?: string;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
  [key: string]: any;
}

export function ${componentName}(options: ${componentName}Options = {}): SVGSVGElement {
  const {
    className = '',
    width = ${attributes.width || 24},
    height = ${attributes.height || 24},
    fill = '${attributes.fill || 'currentColor'}',
    stroke = '',
    ...attrs
  } = options;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '${attributes.viewBox || '0 0 24 24'}');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  
  if (className) svg.setAttribute('class', className);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('fill', fill);
  if (stroke) svg.setAttribute('stroke', stroke);
  
  Object.entries(attrs).forEach(([key, value]) => {
    svg.setAttribute(key, String(value));
  });
  
  svg.innerHTML = \`${innerContent}\`;
  
  return svg;
}
`
  }

  private generateReactNativeComponent(componentName: string, svgContent: string, typescript: boolean, options: FrameworkOptions): string {
    const { attributes, innerContent } = this.parseSVG(svgContent)
    const { forwardRef = true, memo = false } = options

    const convertedContent = this.convertSVGToReactNative(innerContent)
    const viewBox = attributes.viewBox || '0 0 24 24'
    const defaultWidth = attributes.width || 24
    const defaultHeight = attributes.height || 24
    const defaultFill = attributes.fill || 'currentColor'

    const svgImports = this.getReactNativeSVGImports(innerContent)
    const imports = typescript
      ? `import React from "react";
import Svg${svgImports ? `, { ${svgImports} }` : ''} from "react-native-svg";
import type { SvgProps } from "react-native-svg";
import { StyleProp, ViewStyle } from "react-native";`
      : `import React from "react";
import Svg${svgImports ? `, { ${svgImports} }` : ''} from "react-native-svg";`

    const propsInterface = typescript
      ? `
export interface ${componentName}Props extends SvgProps {
  width?: number | string;
  height?: number | string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number | string;
  style?: StyleProp<ViewStyle>;
}`
      : ''

    const componentProps = typescript ? `${componentName}Props` : 'any'
    const refType = typescript ? 'React.ComponentRef<typeof Svg>' : 'any'

    let componentCode = ''

    if (forwardRef) {
      componentCode = `const ${componentName} = React.forwardRef<${refType}, ${componentProps}>(
  ({ width = ${defaultWidth}, height = ${defaultHeight}, fill = "${defaultFill}", stroke, strokeWidth, style, ...props }, ref) => {
    return (
      <Svg
        ref={ref}
        viewBox="${viewBox}"
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        style={style}
        {...props}
      >
        ${convertedContent}
      </Svg>
    );
  }
);

${componentName}.displayName = "${componentName}";`
    } else {
      componentCode = `const ${componentName}: React.FC<${componentProps}> = ({ 
  width = ${defaultWidth}, 
  height = ${defaultHeight}, 
  fill = "${defaultFill}", 
  stroke, 
  strokeWidth, 
  style, 
  ...props 
}) => {
  return (
    <Svg
      viewBox="${viewBox}"
      width={width}
      height={height}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      style={style}
      {...props}
    >
      ${convertedContent}
    </Svg>
  );
};`
    }

    if (memo && forwardRef) {
      const memoComponentName = `${componentName}Memo`
      const memoCode = componentCode
        .replace(`const ${componentName} = React.forwardRef`, `const ${memoComponentName} = React.forwardRef`)
        .replace(`${componentName}.displayName`, `${memoComponentName}.displayName`)
      componentCode = `${memoCode}

const ${componentName} = React.memo(${memoComponentName});`
    } else if (memo && !forwardRef) {
      const memoComponentName = `${componentName}Memo`
      const memoCode = componentCode.replace(`const ${componentName}: React.FC`, `const ${memoComponentName}: React.FC`)
      componentCode = `${memoCode}

const ${componentName} = React.memo(${memoComponentName});`
    }

    return `${imports}${propsInterface}

${componentCode}

export default ${componentName};
`
  }

  private getReactNativeSVGImports(svgContent: string): string {
    const components = new Set<string>()

    if (svgContent.includes('<path')) components.add('Path')
    if (svgContent.includes('<circle')) components.add('Circle')
    if (svgContent.includes('<rect')) components.add('Rect')
    if (svgContent.includes('<g')) components.add('G')
    if (svgContent.includes('<line')) components.add('Line')
    if (svgContent.includes('<polyline')) components.add('Polyline')
    if (svgContent.includes('<polygon')) components.add('Polygon')
    if (svgContent.includes('<ellipse')) components.add('Ellipse')
    if (svgContent.includes('<text')) components.add('Text')
    if (svgContent.includes('<tspan')) components.add('TSpan')
    if (svgContent.includes('<defs')) components.add('Defs')
    if (svgContent.includes('<clipPath')) components.add('ClipPath')
    if (svgContent.includes('<linearGradient')) components.add('LinearGradient')
    if (svgContent.includes('<radialGradient')) components.add('RadialGradient')
    if (svgContent.includes('<stop')) components.add('Stop')

    return Array.from(components).sort().join(', ') || ''
  }

  private convertSVGToReactNative(svgContent: string): string {
    let converted = svgContent

    const elementMap: Record<string, string> = {
      '<svg': '<Svg',
      '</svg>': '</Svg>',
      '<path': '<Path',
      '</path>': '</Path>',
      '<circle': '<Circle',
      '</circle>': '</Circle>',
      '<rect': '<Rect',
      '</rect>': '</Rect>',
      '<g': '<G',
      '</g>': '</G>',
      '<line': '<Line',
      '</line>': '</Line>',
      '<polyline': '<Polyline',
      '</polyline>': '</Polyline>',
      '<polygon': '<Polygon',
      '</polygon>': '</Polygon>',
      '<ellipse': '<Ellipse',
      '</ellipse>': '</Ellipse>',
      '<text': '<Text',
      '</text>': '</Text>',
      '<tspan': '<TSpan',
      '</tspan>': '</TSpan>',
      '<defs': '<Defs',
      '</defs>': '</Defs>',
      '<clipPath': '<ClipPath',
      '</clipPath>': '</ClipPath>',
      '<linearGradient': '<LinearGradient',
      '</linearGradient>': '</LinearGradient>',
      '<radialGradient': '<RadialGradient',
      '</radialGradient>': '</RadialGradient>',
      '<stop': '<Stop',
      '</stop>': '</Stop>',
    }

    for (const [svgTag, reactNativeTag] of Object.entries(elementMap)) {
      const regex = new RegExp(svgTag, 'gi')
      converted = converted.replace(regex, reactNativeTag)
    }

    converted = converted
      .replace(/class=/g, 'className=')
      .replace(/stroke-width=/g, 'strokeWidth=')
      .replace(/stroke-linecap=/g, 'strokeLinecap=')
      .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
      .replace(/stroke-miterlimit=/g, 'strokeMiterlimit=')
      .replace(/stroke-dasharray=/g, 'strokeDasharray=')
      .replace(/stroke-dashoffset=/g, 'strokeDashoffset=')
      .replace(/fill-rule=/g, 'fillRule=')
      .replace(/clip-rule=/g, 'clipRule=')
      .replace(/font-family=/g, 'fontFamily=')
      .replace(/font-size=/g, 'fontSize=')
      .replace(/font-weight=/g, 'fontWeight=')
      .replace(/text-anchor=/g, 'textAnchor=')
      .replace(/xlink:href=/g, 'href=')

    return converted
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z])([a-z])/g, '$1-$2$3')
      .toLowerCase()
  }
}

export const frameworkTemplateEngine = new FrameworkTemplateEngine()
