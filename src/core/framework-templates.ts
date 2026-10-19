import {
  ComponentGenerationOptions,
  FrameworkType,
  FrameworkOptions,
} from '../types/index.js';
import { getFrameworkArtifactContract } from '../application/artifact-contract.js';
import {
  extractSVGRootParts,
  normalizeSVGFormattingWhitespace,
} from '../optimizers/xml-attribute-transform.js';

// Re-export types for convenience
export type { FrameworkType, FrameworkOptions } from '../types/index.js';

export class UnsupportedLanguageError extends Error {
  public readonly code = 'E_UNSUPPORTED_LANGUAGE';

  public constructor(
    public readonly framework: FrameworkType,
    public readonly typescript: boolean,
    message: string
  ) {
    super(message);
    this.name = 'UnsupportedLanguageError';
  }
}

export class InvalidSVGMarkupError extends Error {
  public readonly code = 'E_INVALID_SVG_XML';

  public constructor(message: string) {
    super(message);
    this.name = 'InvalidSVGMarkupError';
  }
}

export class UnsupportedSVGConstructError extends Error {
  public readonly code = 'E_UNSUPPORTED_SVG_CONSTRUCT';

  public constructor(
    public readonly framework: FrameworkType,
    public readonly construct: string
  ) {
    super(
      `SVG <${construct}> content is not supported for ${framework} output.`
    );
    this.name = 'UnsupportedSVGConstructError';
  }
}

interface SVGAttributes {
  viewBox?: string;
  width?: string;
  height?: string;
  fill?: string;
  stroke?: string;
  xmlns?: string;
  [key: string]: string | undefined;
}

function escapeMarkupText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function escapeTemplateLiteralContent(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

function decodeXMLReferences(value: string): string {
  return value.replace(
    /&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos);/gi,
    (reference, token: string) => {
      const normalized = token.toLowerCase();
      if (normalized === 'amp') return '&';
      if (normalized === 'lt') return '<';
      if (normalized === 'gt') return '>';
      if (normalized === 'quot') return '"';
      if (normalized === 'apos') return "'";
      const codePoint = normalized.startsWith('#x')
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);
      return codePoint <= 0x10ffff &&
        !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : reference;
    }
  );
}

function jsStringLiteral(value: string): string {
  return JSON.stringify(decodeXMLReferences(value));
}

function dimensionLiteral(value: string | undefined): string {
  if (value === undefined) return '24';
  const decoded = decodeXMLReferences(value);
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(decoded)) {
    const numeric = Number(decoded);
    if (Number.isFinite(numeric)) return String(numeric);
  }
  return JSON.stringify(decoded);
}

function markupAttributeValue(value: string): string {
  return decodeXMLReferences(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function htmlAttributeExpression(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class FrameworkTemplateEngine {
  public generateComponent(options: ComponentGenerationOptions): string {
    const {
      framework,
      componentName,
      svgContent,
      typescript = true,
      frameworkOptions = {},
    } = options;

    this.assertLanguageCapability(framework, typescript);

    // Object lookup map for framework generators - O(1) performance
    const frameworkGenerators = {
      react: () =>
        this.generateReactComponent(
          componentName,
          svgContent,
          typescript,
          frameworkOptions
        ),
      'react-native': () =>
        this.generateReactNativeComponent(
          componentName,
          svgContent,
          typescript,
          frameworkOptions
        ),
      vue: () =>
        this.generateVueComponent(
          componentName,
          svgContent,
          typescript,
          frameworkOptions
        ),
      svelte: () =>
        this.generateSvelteComponent(componentName, svgContent, typescript),
      angular: () =>
        this.generateAngularComponent(
          componentName,
          svgContent,
          typescript,
          frameworkOptions
        ),
      solid: () =>
        this.generateSolidComponent(componentName, svgContent, typescript),
      preact: () =>
        this.generatePreactComponent(componentName, svgContent, typescript),
      lit: () =>
        this.generateLitComponent(componentName, svgContent, typescript),
      vanilla: () =>
        this.generateVanillaComponent(componentName, svgContent, typescript),
    } as const;

    const generator =
      frameworkGenerators[framework as keyof typeof frameworkGenerators];

    if (!generator) {
      throw new Error(`Unsupported framework: ${framework}`);
    }

    const generated = generator();
    return framework === 'vue' ? this.relocateVueStyles(generated) : generated;
  }

  private relocateVueStyles(component: string): string {
    const styles: string[] = [];
    const result = component.replace(
      /(<template\b[^>]*>)([\s\S]*?)(<\/template>)/i,
      (_template, open: string, body: string, close: string) => {
        const safeBody = body.replace(
          /<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi,
          (_style, attributes: string, cssText: string) => {
            if (/<\/style/i.test(cssText)) {
              throw new UnsupportedSVGConstructError('vue', 'style');
            }
            styles.push(`<style${attributes}>${cssText}</style>`);
            return '';
          }
        );
        return `${open}${safeBody}${close}`;
      }
    );
    return styles.length > 0 ? `${result}\n${styles.join('\n')}\n` : result;
  }

  public getFileExtension(
    framework: FrameworkType,
    typescript: boolean = true
  ): string {
    this.assertLanguageCapability(framework, typescript);
    return getFrameworkArtifactContract(framework).extension(typescript);
  }

  private assertLanguageCapability(
    framework: FrameworkType,
    typescript: boolean
  ): void {
    if (framework === 'angular' && !typescript) {
      throw new UnsupportedLanguageError(
        framework,
        typescript,
        'Angular generation requires TypeScript; typescript=false is unsupported.'
      );
    }
  }

  private parseSVG(
    svgContent: string,
    framework: FrameworkType
  ): {
    attributes: SVGAttributes;
    innerContent: string;
  } {
    const root = extractSVGRootParts(svgContent);
    if (!root) {
      throw new InvalidSVGMarkupError(
        'Cannot generate a framework component from malformed or ambiguous SVG markup.'
      );
    }
    const attributes: SVGAttributes = {};
    for (const { name, value } of root.attributes) {
      attributes[name] =
        (name === 'width' || name === 'height') &&
        /^\d+(?:\.\d+)?px$/.test(value)
          ? value.slice(0, -2)
          : value;
    }

    const rootPreservesWhitespace = root.attributes.some(
      attribute =>
        attribute.name.toLowerCase() === 'xml:space' &&
        attribute.value === 'preserve'
    );
    // Whitespace outside child elements at the SVG root is formatting trivia
    // unless the root explicitly preserves it.
    const innerContent = rootPreservesWhitespace
      ? root.innerContent
      : normalizeSVGFormattingWhitespace(root.innerContent.trim());
    return {
      attributes,
      innerContent: this.prepareFrameworkMarkup(innerContent, framework),
    };
  }

  /** Convert XML character data to static framework-template text. */
  private prepareFrameworkMarkup(
    source: string,
    framework: FrameworkType
  ): string {
    const output: string[] = [];
    const stack: string[] = [];
    let position = 0;

    while (position < source.length) {
      const start = source.indexOf('<', position);
      const endOfText = start < 0 ? source.length : start;
      const text = source.slice(position, endOfText);
      const inStyle = stack.at(-1)?.toLowerCase() === 'style';
      output.push(
        inStyle
          ? text
          : text.replace(/[{}]/g, char => (char === '{' ? '&#123;' : '&#125;'))
      );
      if (start < 0) break;

      if (source.startsWith('<![CDATA[', start)) {
        const close = source.indexOf(']]>', start + 9);
        if (close < 0) {
          throw new Error(
            'Cannot generate a framework component from unterminated SVG CDATA.'
          );
        }
        const content = source.slice(start + 9, close);
        output.push(inStyle ? content : escapeMarkupText(content));
        position = close + 3;
        continue;
      }

      if (source.startsWith('<!--', start)) {
        const close = source.indexOf('-->', start + 4);
        if (close < 0) {
          throw new Error(
            'Cannot generate a framework component from an unterminated SVG comment.'
          );
        }
        position = close + 3;
        continue;
      }

      if (source.startsWith('<?', start)) {
        const close = source.indexOf('?>', start + 2);
        if (close < 0) {
          throw new InvalidSVGMarkupError(
            'Cannot generate a framework component from an unterminated processing instruction.'
          );
        }
        position = close + 2;
        continue;
      }

      let quote = '';
      let end = start + 1;
      for (; end < source.length; end++) {
        const char = source[end];
        if (quote) {
          if (char === quote) quote = '';
        } else if (char === '"' || char === "'") quote = char;
        else if (char === '>') break;
      }
      if (end >= source.length) {
        throw new Error(
          'Cannot generate a framework component from an ambiguous SVG tag.'
        );
      }
      const tag = source.slice(start, end + 1);
      const openingName = tag.match(/^<([A-Za-z_:][\w.:-]*)/)?.[1];
      if (!tag.startsWith('</') && openingName?.toLowerCase() === 'style') {
        if (framework === 'react-native') {
          throw new UnsupportedSVGConstructError(framework, 'style');
        }
        const closing = /<\/style\s*>/i.exec(source.slice(end + 1));
        if (!closing) {
          throw new InvalidSVGMarkupError(
            'Cannot generate a framework component from an unterminated SVG style element.'
          );
        }
        const styleEnd = end + 1 + closing.index;
        let cssText = source.slice(end + 1, styleEnd);
        cssText = cssText.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
        cssText = decodeXMLReferences(cssText);
        if (
          framework === 'react' ||
          framework === 'preact' ||
          framework === 'solid'
        ) {
          output.push(`${tag}{${JSON.stringify(cssText)}}</style>`);
        } else if (framework === 'angular') {
          const binding = `[textContent]="${htmlAttributeExpression(jsStringLiteral(cssText))}"`;
          output.push(
            `${tag.slice(0, -1)} ${binding}>${source.slice(styleEnd, styleEnd + closing[0].length)}`
          );
        } else if (framework === 'svelte') {
          output.push(
            `${tag}{@html ${JSON.stringify(cssText)}}${source.slice(styleEnd, styleEnd + closing[0].length)}`
          );
        } else {
          output.push(
            tag + cssText + source.slice(styleEnd, styleEnd + closing[0].length)
          );
        }
        position = styleEnd + closing[0].length;
        continue;
      }
      output.push(tag);
      const closing = /^<\//.test(tag);
      const name = tag.match(/^<\/?([A-Za-z_:][\w.:-]*)/)?.[1];
      if (!name) {
        position = end + 1;
        continue;
      }
      if (closing) stack.pop();
      else if (!/\/\s*>$/.test(tag)) stack.push(name);
      position = end + 1;
    }

    return output.join('');
  }

  private generateReactComponent(
    componentName: string,
    svgContent: string,
    _typescript: boolean,
    _options: FrameworkOptions
  ): string {
    const { attributes, innerContent } = this.parseSVG(svgContent, 'react');
    if (!_typescript) {
      return `import React from "react";

const ${componentName} = React.forwardRef(
  ({ size, className, style, ...props }, ref) => {
    const dimensions = size ? { width: size, height: size } : {
      width: props.width || ${dimensionLiteral(attributes.width)},
      height: props.height || ${dimensionLiteral(attributes.height)}
    };

    return (
      <svg
        ref={ref}
        viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
        xmlns="http://www.w3.org/2000/svg"
        width={dimensions.width}
        height={dimensions.height}
        fill={props.fill || ${jsStringLiteral(attributes.fill || 'currentColor')}}
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
`;
    }
    return `import React from "react";
import type { SVGProps } from "react";

export interface ${componentName}Props extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

const ${componentName} = React.forwardRef<SVGSVGElement, ${componentName}Props>(
  ({ size, className, style, ...props }, ref) => {
    const dimensions = size ? { width: size, height: size } : {
      width: props.width || ${dimensionLiteral(attributes.width)},
      height: props.height || ${dimensionLiteral(attributes.height)}
    };

    return (
      <svg
        ref={ref}
        viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
        xmlns="http://www.w3.org/2000/svg"
        width={dimensions.width}
        height={dimensions.height}
        fill={props.fill || ${jsStringLiteral(attributes.fill || 'currentColor')}}
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
`;
  }

  private generateReactNativeComponent(
    componentName: string,
    svgContent: string,
    _typescript: boolean,
    _options: FrameworkOptions
  ): string {
    const { attributes, innerContent } = this.parseSVG(
      svgContent,
      'react-native'
    );

    // Convert SVG elements to React Native SVG components
    const convertedContent = innerContent
      .replace(/<path/g, '<Path')
      .replace(/<\/path>/g, '</Path>')
      .replace(/<circle/g, '<Circle')
      .replace(/<\/circle>/g, '</Circle>')
      .replace(/<rect/g, '<Rect')
      .replace(/<\/rect>/g, '</Rect>')
      .replace(/<line/g, '<Line')
      .replace(/<\/line>/g, '</Line>')
      .replace(/<polygon/g, '<Polygon')
      .replace(/<\/polygon>/g, '</Polygon>')
      .replace(/<polyline/g, '<Polyline')
      .replace(/<\/polyline>/g, '</Polyline>')
      .replace(/<ellipse/g, '<Ellipse')
      .replace(/<\/ellipse>/g, '</Ellipse>')
      .replace(/<g>/g, '<G>')
      .replace(/<\/g>/g, '</G>')
      .replace(/<defs>/g, '<Defs>')
      .replace(/<\/defs>/g, '</Defs>')
      .replace(/<clipPath/g, '<ClipPath')
      .replace(/<\/clipPath>/g, '</ClipPath>')
      .replace(/<linearGradient/g, '<LinearGradient')
      .replace(/<\/linearGradient>/g, '</LinearGradient>')
      .replace(/<radialGradient/g, '<RadialGradient')
      .replace(/<\/radialGradient>/g, '</RadialGradient>')
      .replace(/<stop/g, '<Stop')
      .replace(/<\/stop>/g, '</Stop>')
      .replace(/stroke-width=/g, 'strokeWidth=')
      .replace(/stroke-linecap=/g, 'strokeLinecap=')
      .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
      .replace(/fill-rule=/g, 'fillRule=')
      .replace(/clip-rule=/g, 'clipRule=');

    if (!_typescript) {
      return `import React from "react";
import Svg, {
  Path, Circle, Rect, Line, Polygon, Polyline, Ellipse, G, Defs,
  ClipPath, LinearGradient, RadialGradient, Stop,
} from "react-native-svg";

const ${componentName} = React.forwardRef(
  ({ size, color, ...props }, ref) => {
    const dimensions = size ? { width: size, height: size } : {
      width: props.width || ${dimensionLiteral(attributes.width)},
      height: props.height || ${dimensionLiteral(attributes.height)}
    };

    return (
      <Svg
        ref={ref}
        viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
        width={dimensions.width}
        height={dimensions.height}
        fill={color || props.fill || ${jsStringLiteral(attributes.fill || 'currentColor')}}
        {...props}
      >
        ${convertedContent}
      </Svg>
    );
  }
);

${componentName}.displayName = "${componentName}";

export default ${componentName};
`;
    }

    return `import React from "react";
import Svg, {
  Path,
  Circle,
  Rect,
  Line,
  Polygon,
  Polyline,
  Ellipse,
  G,
  Defs,
  ClipPath,
  LinearGradient,
  RadialGradient,
  Stop,
} from "react-native-svg";
import type { SvgProps } from "react-native-svg";

export interface ${componentName}Props extends SvgProps {
  size?: number | string;
  color?: string;
}

const ${componentName} = React.forwardRef<Svg, ${componentName}Props>(
  ({ size, color, ...props }, ref) => {
    const dimensions = size ? { width: size, height: size } : {
      width: props.width || ${dimensionLiteral(attributes.width)},
      height: props.height || ${dimensionLiteral(attributes.height)}
    };

    return (
      <Svg
        ref={ref}
        viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
        width={dimensions.width}
        height={dimensions.height}
        fill={color || props.fill || ${jsStringLiteral(attributes.fill || 'currentColor')}}
        {...props}
      >
        ${convertedContent}
      </Svg>
    );
  }
);

${componentName}.displayName = "${componentName}";

export default ${componentName};
`;
  }

  private generateVueComponent(
    componentName: string,
    svgContent: string,
    typescript: boolean,
    options: FrameworkOptions
  ): string {
    const { attributes, innerContent } = this.parseSVG(svgContent, 'vue');
    const { scriptSetup = true } = options;

    if (scriptSetup && !typescript) {
      return `<template>
  <svg
    :class="className"
    :style="style"
    :width="width"
    :height="height"
    :fill="fill"
    :stroke="stroke"
    viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
    xmlns="http://www.w3.org/2000/svg"
    v-bind="$attrs"
  >
    ${innerContent}
  </svg>
</template>

<script setup>
const {
  className = '',
  style = '',
  width = ${dimensionLiteral(attributes.width)},
  height = ${dimensionLiteral(attributes.height)},
  fill = ${jsStringLiteral(attributes.fill || 'currentColor')},
  stroke = ''
} = defineProps({
  className: { type: String, default: '' },
  style: { type: [String, Object], default: '' },
  width: { type: [String, Number], default: ${dimensionLiteral(attributes.width)} },
  height: { type: [String, Number], default: ${dimensionLiteral(attributes.height)} },
  fill: { type: String, default: ${jsStringLiteral(attributes.fill || 'currentColor')} },
  stroke: { type: String, default: '' }
});
</script>
`;
    }

    if (scriptSetup && typescript) {
      return `<template>
  <svg
    :class="className"
    :style="style"
    :width="width"
    :height="height"
    :fill="fill"
    :stroke="stroke"
    viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
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
  fill: ${jsStringLiteral(attributes.fill || 'currentColor')},
  width: ${dimensionLiteral(attributes.width)},
  height: ${dimensionLiteral(attributes.height)}
});
</script>
`;
    }

    return `<template>
  <svg
    :class="className"
    :style="style"
    :width="width"
    :height="height"
    :fill="fill"
    :stroke="stroke"
    viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
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
    width: { type: [String, Number], default: ${dimensionLiteral(attributes.width)} },
    height: { type: [String, Number], default: ${dimensionLiteral(attributes.height)} },
    fill: { type: String, default: ${jsStringLiteral(attributes.fill || 'currentColor')} },
    stroke: { type: String, default: '' }
  }
});
</script>
`;
  }

  private generateSvelteComponent(
    _componentName: string,
    svgContent: string,
    typescript: boolean
  ): string {
    const { attributes, innerContent } = this.parseSVG(svgContent, 'svelte');
    return `<script${typescript ? ' lang="ts"' : ''}>
  export let className${typescript ? ': string' : ''} = '';
  export let style${typescript ? ': string' : ''} = '';
  export let width${typescript ? ': string | number' : ''} = ${dimensionLiteral(attributes.width)};
  export let height${typescript ? ': string | number' : ''} = ${dimensionLiteral(attributes.height)};
  export let fill${typescript ? ': string' : ''} = ${jsStringLiteral(attributes.fill || 'currentColor')};
  export let stroke${typescript ? ': string' : ''} = '';
</script>

<svg
  class={className}
  {style}
  {width}
  {height}
  {fill}
  {stroke}
  viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
  xmlns="http://www.w3.org/2000/svg"
  {...$$restProps}
>
  ${innerContent}
</svg>
`;
  }

  private generateAngularComponent(
    componentName: string,
    svgContent: string,
    _typescript: boolean,
    options: FrameworkOptions
  ): string {
    const { attributes, innerContent } = this.parseSVG(svgContent, 'angular');
    const { standalone = true } = options;
    const kebabName = this.toKebabCase(componentName);

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
      viewBox="${escapeTemplateLiteralContent(markupAttributeValue(attributes.viewBox || '0 0 24 24'))}"
      xmlns="http://www.w3.org/2000/svg"
    >
      ${escapeTemplateLiteralContent(innerContent)}
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
  @Input() width: string | number = ${dimensionLiteral(attributes.width)};
  @Input() height: string | number = ${dimensionLiteral(attributes.height)};
  @Input() fill: string = ${jsStringLiteral(attributes.fill || 'currentColor')};
  @Input() stroke: string = '';
}
`;
  }

  private generateSolidComponent(
    componentName: string,
    svgContent: string,
    _typescript: boolean
  ): string {
    const { attributes, innerContent } = this.parseSVG(svgContent, 'solid');
    if (!_typescript) {
      return `import { createComponent } from 'solid-js';

const ${componentName} = (props) => (
  <svg
    class={props.className}
    style={props.style}
    width={props.width || ${dimensionLiteral(attributes.width)}}
    height={props.height || ${dimensionLiteral(attributes.height)}}
    fill={props.fill || ${jsStringLiteral(attributes.fill || 'currentColor')}}
    stroke={props.stroke}
    viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    ${innerContent}
  </svg>
);

export default ${componentName};
`;
    }
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
    width={props.width || ${dimensionLiteral(attributes.width)}}
    height={props.height || ${dimensionLiteral(attributes.height)}}
    fill={props.fill || ${jsStringLiteral(attributes.fill || 'currentColor')}}
    stroke={props.stroke}
    viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    ${innerContent}
  </svg>
);

export default ${componentName};
`;
  }

  private generatePreactComponent(
    componentName: string,
    svgContent: string,
    _typescript: boolean
  ): string {
    const { attributes, innerContent } = this.parseSVG(svgContent, 'preact');
    if (!_typescript) {
      return `import { h } from 'preact';

const ${componentName} = ({
  className, style, width, height, fill, stroke, ...props
}) => (
  <svg
    class={className}
    style={style}
    width={width || ${dimensionLiteral(attributes.width)}}
    height={height || ${dimensionLiteral(attributes.height)}}
    fill={fill || ${jsStringLiteral(attributes.fill || 'currentColor')}}
    stroke={stroke}
    viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    ${innerContent}
  </svg>
);

export default ${componentName};
`;
    }
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
      width={width || ${dimensionLiteral(attributes.width)}}
      height={height || ${dimensionLiteral(attributes.height)}}
      fill={fill || ${jsStringLiteral(attributes.fill || 'currentColor')}}
      stroke={stroke}
      viewBox="${markupAttributeValue(attributes.viewBox || '0 0 24 24')}"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      ${innerContent}
    </svg>
  );
};

export default ${componentName};
`;
  }

  private generateLitComponent(
    componentName: string,
    svgContent: string,
    _typescript: boolean
  ): string {
    const { attributes, innerContent } = this.parseSVG(svgContent, 'lit');
    const kebabName = this.toKebabCase(componentName);

    if (!_typescript) {
      return `import { LitElement, html, css, svg } from 'lit';

export class ${componentName} extends LitElement {
  static properties = {
    className: { type: String },
    width: { type: String, reflect: true },
    height: { type: String, reflect: true },
    fill: { type: String, reflect: true },
    stroke: { type: String, reflect: true },
  };

  static styles = css\`:host { display: inline-block; }\`;

  constructor() {
    super();
    this.className = '';
    this.width = ${jsStringLiteral(attributes.width || '24')};
    this.height = ${jsStringLiteral(attributes.height || '24')};
    this.fill = ${jsStringLiteral(attributes.fill || 'currentColor')};
    this.stroke = '';
  }

  render() {
    return svg\`
      <svg
        class="\${this.className}"
        width="\${this.width}"
        height="\${this.height}"
        fill="\${this.fill}"
        stroke="\${this.stroke}"
        viewBox="${escapeTemplateLiteralContent(markupAttributeValue(attributes.viewBox || '0 0 24 24'))}"
        xmlns="http://www.w3.org/2000/svg"
      >
        ${escapeTemplateLiteralContent(innerContent)}
      </svg>
    \`;
  }
}

customElements.define('${kebabName}', ${componentName});
`;
    }

    return `import { LitElement, html, css, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('${kebabName}')
export class ${componentName} extends LitElement {
  @property({ type: String }) className = '';
  @property({ type: String, reflect: true }) width = ${jsStringLiteral(attributes.width || '24')};
  @property({ type: String, reflect: true }) height = ${jsStringLiteral(attributes.height || '24')};
  @property({ type: String, reflect: true }) fill = ${jsStringLiteral(attributes.fill || 'currentColor')};
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
        viewBox="${escapeTemplateLiteralContent(markupAttributeValue(attributes.viewBox || '0 0 24 24'))}"
        xmlns="http://www.w3.org/2000/svg"
      >
        ${escapeTemplateLiteralContent(innerContent)}
      </svg>
    \`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    '${kebabName}': ${componentName};
  }
}
`;
  }

  private generateVanillaComponent(
    componentName: string,
    svgContent: string,
    _typescript: boolean
  ): string {
    const { attributes, innerContent } = this.parseSVG(svgContent, 'vanilla');
    if (!_typescript) {
      return `export function ${componentName}(options = {}) {
  const {
    className = '',
    width = ${dimensionLiteral(attributes.width)},
    height = ${dimensionLiteral(attributes.height)},
    fill = ${jsStringLiteral(attributes.fill || 'currentColor')},
    stroke = '',
    ...attrs
  } = options;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', ${jsStringLiteral(attributes.viewBox || '0 0 24 24')});
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (className) svg.setAttribute('class', className);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('fill', fill);
  if (stroke) svg.setAttribute('stroke', stroke);
  Object.entries(attrs).forEach(([key, value]) => {
    svg.setAttribute(key, String(value));
  });
  svg.innerHTML = ${JSON.stringify(innerContent)};
  return svg;
}
`;
    }
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
    width = ${dimensionLiteral(attributes.width)},
    height = ${dimensionLiteral(attributes.height)},
    fill = ${jsStringLiteral(attributes.fill || 'currentColor')},
    stroke = '',
    ...attrs
  } = options;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', ${jsStringLiteral(attributes.viewBox || '0 0 24 24')});
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  
  if (className) svg.setAttribute('class', className);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('fill', fill);
  if (stroke) svg.setAttribute('stroke', stroke);
  
  Object.entries(attrs).forEach(([key, value]) => {
    svg.setAttribute(key, String(value));
  });
  
  svg.innerHTML = ${JSON.stringify(innerContent)};
  
  return svg;
}
`;
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z])([a-z])/g, '$1-$2$3')
      .toLowerCase();
  }
}

export const frameworkTemplateEngine = new FrameworkTemplateEngine();
