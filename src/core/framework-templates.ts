import { ComponentGenerationOptions } from '../types/index.js';

/**
 * Framework-agnostic template system supporting multiple UI frameworks
 */
export type FrameworkType = 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'preact' | 'lit' | 'vanilla';

export interface FrameworkTemplateOptions extends ComponentGenerationOptions {
  framework: FrameworkType;
  version?: string;
  typescript?: boolean;
  composition?: boolean; // Vue composition API
  setup?: boolean; // Vue setup syntax
  standalone?: boolean; // Angular standalone components
  signals?: boolean; // Solid/Angular signals
  forwardRef?: boolean; // React forwardRef support
}

/**
 * Universal template generator supporting multiple frameworks
 */
export class FrameworkTemplateEngine {
  /**
   * Generate component code for any supported framework
   */
  public generateComponent(
    componentName: string,
    svgContent: string,
    options: FrameworkTemplateOptions
  ): string {
    const { framework, typescript = true } = options;

    switch (framework) {
      case 'react':
        return this.generateReactComponent(componentName, svgContent, options);
      
      case 'vue':
        return this.generateVueComponent(componentName, svgContent, options);
      
      case 'svelte':
        return this.generateSvelteComponent(componentName, svgContent, options);
      
      case 'angular':
        return this.generateAngularComponent(componentName, svgContent, options);
      
      case 'solid':
        return this.generateSolidComponent(componentName, svgContent, options);
      
      case 'preact':
        return this.generatePreactComponent(componentName, svgContent, options);
      
      case 'lit':
        return this.generateLitComponent(componentName, svgContent, options);
      
      case 'vanilla':
        return this.generateVanillaComponent(componentName, svgContent, options);
      
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }
  }

  /**
   * Get file extension for the framework
   */
  public getFileExtension(framework: FrameworkType, typescript: boolean = true): string {
    const tsExt = typescript ? 'ts' : 'js';
    
    switch (framework) {
      case 'react':
      case 'preact':
        return typescript ? 'tsx' : 'jsx';
      
      case 'vue':
        return 'vue';
      
      case 'svelte':
        return 'svelte';
      
      case 'angular':
        return `component.${tsExt}`;
      
      case 'solid':
        return typescript ? 'tsx' : 'jsx';
      
      case 'lit':
        return `${tsExt}`;
      
      case 'vanilla':
        return `${tsExt}`;
      
      default:
        return `${tsExt}`;
    }
  }

  /**
   * React component generation
   */
  private generateReactComponent(
    componentName: string,
    svgContent: string,
    options: FrameworkTemplateOptions
  ): string {
    const { typescript, forwardRef = true } = options;
    const propsType = typescript ? `React.SVGProps<SVGSVGElement>` : '';
    const typeAnnotation = typescript ? `: React.FC<${propsType}>` : '';

    if (forwardRef && typescript) {
      return `import React, { forwardRef } from 'react';

interface ${componentName}Props extends React.SVGProps<SVGSVGElement> {}

const ${componentName} = forwardRef<SVGSVGElement, ${componentName}Props>(
  (props, ref) => (
    ${this.processSVGContent(svgContent, 'react', '{ ...props, ref }')}
  )
);

${componentName}.displayName = '${componentName}';

export default ${componentName};`;
    }

    return `import React from 'react';

const ${componentName}${typeAnnotation} = (props${typescript ? `: ${propsType}` : ''}) => (
  ${this.processSVGContent(svgContent, 'react', 'props')}
);

export default ${componentName};`;
  }

  /**
   * Vue component generation
   */
  private generateVueComponent(
    componentName: string,
    svgContent: string,
    options: FrameworkTemplateOptions
  ): string {
    const { composition = true, setup = true, typescript = true } = options;

    if (setup && typescript) {
      return `<template>
  ${this.processSVGContent(svgContent, 'vue', 'attrs')}
</template>

<script setup lang="ts">
interface Props {
  class?: string;
  style?: string | Record<string, any>;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}

defineProps<Props>();
</script>`;
    }

    if (composition) {
      return `<template>
  ${this.processSVGContent(svgContent, 'vue', 'attrs')}
</template>

<script${typescript ? ' lang="ts"' : ''}>
import { defineComponent } from 'vue';

export default defineComponent({
  name: '${componentName}',
  props: {
    class: String,
    style: [String, Object],
    width: [String, Number],
    height: [String, Number],
    fill: String,
    stroke: String,
  },
});
</script>`;
    }

    return `<template>
  ${this.processSVGContent(svgContent, 'vue', 'attrs')}
</template>

<script${typescript ? ' lang="ts"' : ''}>
export default {
  name: '${componentName}',
  props: ['class', 'style', 'width', 'height', 'fill', 'stroke'],
};
</script>`;
  }

  /**
   * Svelte component generation
   */
  private generateSvelteComponent(
    componentName: string,
    svgContent: string,
    options: FrameworkTemplateOptions
  ): string {
    const { typescript = true } = options;

    return `${typescript ? '<script lang="ts">' : '<script>'}
  export let className: string = '';
  export let style: string = '';
  export let width: string | number = '';
  export let height: string | number = '';
  export let fill: string = '';
  export let stroke: string = '';
</script>

${this.processSVGContent(svgContent, 'svelte', 'props')}`;
  }

  /**
   * Angular component generation
   */
  private generateAngularComponent(
    componentName: string,
    svgContent: string,
    options: FrameworkTemplateOptions
  ): string {
    const { standalone = true, typescript = true } = options;
    const kebabName = this.toKebabCase(componentName);

    const imports = standalone 
      ? `import { Component, Input } from '@angular/core';`
      : `import { Component, Input } from '@angular/core';`;

    return `${imports}

@Component({
  selector: '${kebabName}',
  ${standalone ? 'standalone: true,' : ''}
  template: \`
    ${this.processSVGContent(svgContent, 'angular', 'inputs')}
  \`,
})
export class ${componentName}Component {
  @Input() className: string = '';
  @Input() width: string | number = '';
  @Input() height: string | number = '';
  @Input() fill: string = '';
  @Input() stroke: string = '';
}`;
  }

  /**
   * Solid.js component generation
   */
  private generateSolidComponent(
    componentName: string,
    svgContent: string,
    options: FrameworkTemplateOptions
  ): string {
    const { typescript = true, signals = false } = options;

    const propsType = typescript ? `{
  class?: string;
  style?: string | JSX.CSSProperties;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}` : '';

    return `import { Component${signals ? ', createSignal' : ''} } from 'solid-js';
${typescript ? 'import { JSX } from \'solid-js\';' : ''}

const ${componentName}: Component<${typescript ? propsType : 'any'}> = (props) => (
  ${this.processSVGContent(svgContent, 'solid', 'props')}
);

export default ${componentName};`;
  }

  /**
   * Preact component generation
   */
  private generatePreactComponent(
    componentName: string,
    svgContent: string,
    options: FrameworkTemplateOptions
  ): string {
    const { typescript = true } = options;
    const propsType = typescript ? 'JSX.SVGAttributes<SVGSVGElement>' : '';

    return `import { h } from 'preact';
${typescript ? 'import { JSX } from \'preact\';' : ''}

const ${componentName} = (props${typescript ? `: ${propsType}` : ''}) => (
  ${this.processSVGContent(svgContent, 'preact', 'props')}
);

export default ${componentName};`;
  }

  /**
   * Lit component generation
   */
  private generateLitComponent(
    componentName: string,
    svgContent: string,
    options: FrameworkTemplateOptions
  ): string {
    const kebabName = this.toKebabCase(componentName);

    return `import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('${kebabName}')
export class ${componentName} extends LitElement {
  @property({ type: String }) width = '';
  @property({ type: String }) height = '';
  @property({ type: String }) fill = '';
  @property({ type: String }) stroke = '';

  render() {
    return html\`${this.processSVGContent(svgContent, 'lit', 'properties')}\`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    '${kebabName}': ${componentName};
  }
}`;
  }

  /**
   * Vanilla JavaScript/TypeScript component generation
   */
  private generateVanillaComponent(
    componentName: string,
    svgContent: string,
    options: FrameworkTemplateOptions
  ): string {
    const { typescript = true } = options;

    return `${typescript ? `
interface ${componentName}Options {
  className?: string;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}

export function ${componentName}(options: ${componentName}Options = {}): SVGSVGElement {` : `
export function ${componentName}(options = {}) {`}
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  
  // Set default attributes
  ${this.generateVanillaSVGSetup(svgContent)}
  
  // Apply options
  if (options.className) svg.setAttribute('class', options.className);
  if (options.width) svg.setAttribute('width', String(options.width));
  if (options.height) svg.setAttribute('height', String(options.height));
  if (options.fill) svg.setAttribute('fill', options.fill);
  if (options.stroke) svg.setAttribute('stroke', options.stroke);
  
  return svg;
}`;
  }

  /**
   * Process SVG content for different frameworks
   */
  private processSVGContent(
    svgContent: string,
    framework: FrameworkType,
    propsBinding: string | object
  ): string {
    // Remove SVG wrapper and get inner content
    const innerContent = svgContent
      .replace(/<svg[^>]*>/, '')
      .replace(/<\/svg>$/, '')
      .trim();

    switch (framework) {
      case 'react':
      case 'preact':
      case 'solid':
        return `<svg {...${propsBinding}} xmlns="http://www.w3.org/2000/svg">
    ${innerContent}
  </svg>`;

      case 'vue':
        return `<svg v-bind="${propsBinding}" xmlns="http://www.w3.org/2000/svg">
    ${innerContent}
  </svg>`;

      case 'svelte':
        return `<svg 
  class={className} 
  {style} 
  {width} 
  {height} 
  {fill} 
  {stroke} 
  xmlns="http://www.w3.org/2000/svg"
>
  ${innerContent}
</svg>`;

      case 'angular':
        return `<svg 
  [attr.class]="className" 
  [attr.width]="width" 
  [attr.height]="height" 
  [attr.fill]="fill" 
  [attr.stroke]="stroke" 
  xmlns="http://www.w3.org/2000/svg"
>
  ${innerContent}
</svg>`;

      case 'lit':
        return `<svg 
  width="\${this.width}" 
  height="\${this.height}" 
  fill="\${this.fill}" 
  stroke="\${this.stroke}" 
  xmlns="http://www.w3.org/2000/svg"
>
  ${innerContent}
</svg>`;

      default:
        return svgContent;
    }
  }

  /**
   * Generate vanilla SVG setup code
   */
  private generateVanillaSVGSetup(svgContent: string): string {
    // Extract attributes from original SVG
    const svgMatch = svgContent.match(/<svg([^>]*)>/);
    if (!svgMatch) return '';

    const attributes = svgMatch[1];
    const attrRegex = /(\w+)="([^"]*)"/g;
    const setupLines: string[] = [];

    let match;
    while ((match = attrRegex.exec(attributes)) !== null) {
      const [, name, value] = match;
      if (name !== 'xmlns') {
        setupLines.push(`  svg.setAttribute('${name}', '${value}');`);
      }
    }

    return setupLines.join('\n');
  }

  /**
   * Convert PascalCase to kebab-case
   */
  private toKebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
}

// Export singleton instance
export const frameworkTemplateEngine = new FrameworkTemplateEngine();