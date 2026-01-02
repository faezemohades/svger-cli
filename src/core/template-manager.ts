import {
  Template,
  ComponentGenerationOptions,
  TemplateConfig as _TemplateConfig,
} from '../types/index.js';
import { logger } from '../core/logger.js';
import { FileSystem } from '../utils/native.js';
import path from 'path';

/**
 * Template management system for customizable component generation
 */
export class TemplateManager {
  private static instance: TemplateManager;
  private templates: Map<string, Template> = new Map();
  private defaultTemplate = 'react-functional';

  private constructor() {
    this.loadBuiltinTemplates();
  }

  public static getInstance(): TemplateManager {
    if (!TemplateManager.instance) {
      TemplateManager.instance = new TemplateManager();
    }
    return TemplateManager.instance;
  }

  /**
   * Load built-in templates
   */
  private loadBuiltinTemplates(): void {
    // Standard React Functional Component
    this.registerTemplate({
      name: 'react-functional',
      generate: (options: ComponentGenerationOptions) =>
        this.generateReactFunctional(options),
      validate: (options: ComponentGenerationOptions) =>
        !!options.componentName && !!options.svgContent,
    });

    // React Functional Component with forwardRef
    this.registerTemplate({
      name: 'react-forwardref',
      generate: (options: ComponentGenerationOptions) =>
        this.generateReactForwardRef(options),
      validate: (options: ComponentGenerationOptions) =>
        !!options.componentName && !!options.svgContent,
    });

    // React Class Component (legacy support)
    this.registerTemplate({
      name: 'react-class',
      generate: (options: ComponentGenerationOptions) =>
        this.generateReactClass(options),
      validate: (options: ComponentGenerationOptions) =>
        !!options.componentName && !!options.svgContent,
    });

    // Styled Components Template
    this.registerTemplate({
      name: 'styled-components',
      generate: (options: ComponentGenerationOptions) =>
        this.generateStyledComponents(options),
      validate: (options: ComponentGenerationOptions) =>
        !!options.componentName && !!options.svgContent,
    });

    // TypeScript Native (no React)
    this.registerTemplate({
      name: 'typescript-native',
      generate: (options: ComponentGenerationOptions) =>
        this.generateTypeScriptNative(options),
      validate: (options: ComponentGenerationOptions) =>
        !!options.componentName && !!options.svgContent,
    });

    // Enhanced Styled Template
    this.registerTemplate({
      name: 'enhanced-styled',
      generate: (options: ComponentGenerationOptions) =>
        this.generateEnhancedStyled(options),
      validate: (options: ComponentGenerationOptions) =>
        !!options.componentName && !!options.svgContent,
    });

    logger.debug('Built-in templates loaded');
  }

  /**
   * Register a new template
   */
  public registerTemplate(template: Template): void {
    this.templates.set(template.name, template);
    logger.debug(`Template registered: ${template.name}`);
  }

  /**
   * Generate component using specified template
   */
  public generateComponent(
    templateName: string,
    options: ComponentGenerationOptions
  ): string {
    const template = this.templates.get(templateName);

    if (!template) {
      logger.warn(`Template not found: ${templateName}, using default`);
      return this.generateComponent(this.defaultTemplate, options);
    }

    if (template.validate && !template.validate(options)) {
      throw new Error(`Invalid options for template: ${templateName}`);
    }

    return template.generate(options);
  }

  /**
   * Load custom template from file
   */
  public async loadCustomTemplate(templatePath: string): Promise<void> {
    try {
      const resolvedPath = path.resolve(templatePath);

      if (!(await FileSystem.exists(resolvedPath))) {
        throw new Error(`Template file not found: ${resolvedPath}`);
      }

      const templateContent = await FileSystem.readFile(resolvedPath, 'utf-8');

      // Parse template (assuming it's a JavaScript module)
      const templateName = path.basename(
        templatePath,
        path.extname(templatePath)
      );

      // For now, we'll treat it as a simple string template
      this.registerTemplate({
        name: templateName,
        generate: (options: ComponentGenerationOptions) => {
          return this.processStringTemplate(templateContent, options);
        },
      });

      logger.info(`Custom template loaded: ${templateName}`);
    } catch (error) {
      logger.error(`Failed to load template from ${templatePath}:`, error);
      throw error;
    }
  }

  /**
   * Get list of available templates
   */
  public getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Set default template
   */
  public setDefaultTemplate(templateName: string): void {
    if (!this.templates.has(templateName)) {
      throw new Error(`Template not found: ${templateName}`);
    }
    this.defaultTemplate = templateName;
    logger.info(`Default template set to: ${templateName}`);
  }

  // ---- Built-in Template Generators ----

  /**
   * Standard React Functional Component
   */
  private generateReactFunctional(options: ComponentGenerationOptions): string {
    const {
      componentName,
      svgContent,
      defaultWidth = 24,
      defaultHeight = 24,
      defaultFill = 'currentColor',
    } = options;

    return `import React from "react";
import type { SVGProps } from "react";

export interface ${componentName}Props extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * ${componentName} SVG Component
 * Generated by svger-cli
 */
const ${componentName} = React.forwardRef<SVGSVGElement, ${componentName}Props>(
  ({ size, className, style, ...props }, ref) => {
    const dimensions = size ? { width: size, height: size } : {
      width: props.width || ${defaultWidth},
      height: props.height || ${defaultHeight}
    };

    return (
      <svg
        ref={ref}
        viewBox="0 0 ${defaultWidth} ${defaultHeight}"
        xmlns="http://www.w3.org/2000/svg"
        width={dimensions.width}
        height={dimensions.height}
        fill={props.fill || "${defaultFill}"}
        className={className}
        style={style}
        {...props}
      >
        ${svgContent}
      </svg>
    );
  }
);

${componentName}.displayName = "${componentName}";

export default ${componentName};
`;
  }

  /**
   * React Functional Component with forwardRef
   */
  private generateReactForwardRef(options: ComponentGenerationOptions): string {
    const {
      componentName,
      svgContent,
      defaultWidth = 24,
      defaultHeight = 24,
      defaultFill = 'currentColor',
    } = options;

    return `import { forwardRef } from "react";
import type { SVGProps } from "react";

/**
 * ${componentName} SVG Component with forwardRef
 * Generated by svger-cli
 */
const ${componentName} = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  (props, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 ${defaultWidth} ${defaultHeight}"
      xmlns="http://www.w3.org/2000/svg"
      width={props.width || ${defaultWidth}}
      height={props.height || ${defaultHeight}}
      fill={props.fill || "${defaultFill}"}
      className={props.className}
      style={props.style}
      {...props}
    >
      ${svgContent}
    </svg>
  )
);

${componentName}.displayName = "${componentName}";

export default ${componentName};
`;
  }

  /**
   * React Class Component (legacy)
   */
  private generateReactClass(options: ComponentGenerationOptions): string {
    const {
      componentName,
      svgContent,
      defaultWidth = 24,
      defaultHeight = 24,
      defaultFill = 'currentColor',
    } = options;

    return `import { Component } from "react";
import type { SVGProps } from "react";

/**
 * ${componentName} SVG Component (Class-based)
 * Generated by svger-cli
 */
class ${componentName} extends Component<SVGProps<SVGSVGElement>> {
  render() {
    const { width = ${defaultWidth}, height = ${defaultHeight}, fill = "${defaultFill}", ...props } = this.props;
    
    return (
      <svg
        viewBox="0 0 ${defaultWidth} ${defaultHeight}"
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        fill={fill}
        {...props}
      >
        ${svgContent}
      </svg>
    );
  }
}

export default ${componentName};
`;
  }

  /**
   * Styled Components Template
   */
  private generateStyledComponents(
    options: ComponentGenerationOptions
  ): string {
    const {
      componentName,
      svgContent,
      defaultWidth = 24,
      defaultHeight = 24,
      defaultFill = 'currentColor',
    } = options;

    return `import styled from "styled-components";
import type { SVGProps } from "react";

/**
 * ${componentName} SVG Component with Styled Components
 * Generated by svger-cli
 */
const StyledSVG = styled.svg<SVGProps<SVGSVGElement>>\`
  width: \${props => props.width || '${defaultWidth}px'};
  height: \${props => props.height || '${defaultHeight}px'};
  fill: \${props => props.fill || '${defaultFill}'};
\`;

const ${componentName} = (props: SVGProps<SVGSVGElement>) => (
  <StyledSVG
    viewBox="0 0 ${defaultWidth} ${defaultHeight}"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    ${svgContent}
  </StyledSVG>
);

${componentName}.displayName = "${componentName}";

export default ${componentName};
`;
  }

  /**
   * TypeScript Native (no React dependencies)
   */
  private generateTypeScriptNative(
    options: ComponentGenerationOptions
  ): string {
    const {
      componentName,
      svgContent,
      defaultWidth = 24,
      defaultHeight = 24,
      defaultFill = 'currentColor',
    } = options;

    return `/**
 * ${componentName} SVG Icon (Native TypeScript)
 * Generated by svger-cli
 */

export interface ${componentName}Options {
  width?: number | string;
  height?: number | string;
  fill?: string;
  className?: string;
  style?: Record<string, any>;
}

export function ${componentName}(options: ${componentName}Options = {}): string {
  const {
    width = ${defaultWidth},
    height = ${defaultHeight},
    fill = "${defaultFill}",
    className = "",
    style = {}
  } = options;

  const styleString = Object.entries(style)
    .map(([key, value]) => \`\${key}: \${value}\`)
    .join("; ");

  return \`
    <svg
      viewBox="0 0 ${defaultWidth} ${defaultHeight}"
      xmlns="http://www.w3.org/2000/svg"
      width="\${width}"
      height="\${height}"
      fill="\${fill}"
      class="\${className}"
      style="\${styleString}"
    >
      ${svgContent}
    </svg>
  \`.trim();
}

export default ${componentName};
`;
  }

  /**
   * Process string template with variable substitution
   */
  private processStringTemplate(
    template: string,
    options: ComponentGenerationOptions
  ): string {
    const variables = {
      ...options,
      defaultWidth: options.defaultWidth || 24,
      defaultHeight: options.defaultHeight || 24,
      defaultFill: options.defaultFill || 'currentColor',
    };

    let processed = template;

    // Replace variables in the format {{variableName}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      processed = processed.replace(regex, String(value));
    }

    return processed;
  }

  /**
   * Enhanced Styled Template with comprehensive styling support
   */
  private generateEnhancedStyled(options: ComponentGenerationOptions): string {
    const {
      componentName,
      svgContent,
      defaultWidth = 24,
      defaultHeight = 24,
      defaultFill = 'currentColor',
    } = options;

    return `import React from "react";
import type { SVGProps } from "react";

/**
 * ${componentName} SVG Component with Enhanced Styling
 * Generated by svger-cli with comprehensive styling support
 */

export interface ${componentName}Props extends SVGProps<SVGSVGElement> {
  // Size variants
  size?: number | string | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  // Color variants
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  
  // Animation options
  animate?: boolean | 'spin' | 'pulse' | 'bounce' | 'fade';
  
  // Theme support
  theme?: 'light' | 'dark' | 'auto';
  
  // Responsive behavior
  responsive?: boolean;
  
  // Interaction states
  loading?: boolean;
  disabled?: boolean;
}

const sizeMap = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
} as const;

const colorMap = {
  primary: '#007bff',
  secondary: '#6c757d',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  info: '#17a2b8',
} as const;

const ${componentName} = React.forwardRef<SVGSVGElement, ${componentName}Props>(
  ({ 
    size = 'md',
    variant,
    animate = false,
    theme = 'auto',
    responsive = false,
    loading = false,
    disabled = false,
    style,
    className,
    ...props 
  }, ref) => {
    
    // Calculate size
    const dimensions = React.useMemo(() => {
      if (typeof size === 'number') return { width: size, height: size };
      if (typeof size === 'string' && !isNaN(Number(size))) return { width: Number(size), height: Number(size) };
      const mappedSize = sizeMap[size as keyof typeof sizeMap] || sizeMap.md;
      return { width: mappedSize, height: mappedSize };
    }, [size]);
    
    // Generate styles
    const computedStyles = React.useMemo(() => {
      const baseStyles: React.CSSProperties = {
        display: 'inline-block',
        verticalAlign: 'middle',
        transition: 'all 0.2s ease-in-out',
      };
      
      // Apply color variant
      if (variant) {
        baseStyles.color = colorMap[variant];
      }
      
      // Apply theme
      if (theme === 'dark') {
        baseStyles.filter = 'invert(1)';
      } else if (theme === 'auto') {
        baseStyles.filter = 'var(--svger-theme-filter, none)';
      }
      
      // Apply animation
      if (animate) {
        if (animate === true || animate === 'spin') {
          baseStyles.animation = 'svger-spin 2s linear infinite';
        } else if (animate === 'pulse') {
          baseStyles.animation = 'svger-pulse 2s ease-in-out infinite';
        } else if (animate === 'bounce') {
          baseStyles.animation = 'svger-bounce 1s infinite';
        } else if (animate === 'fade') {
          baseStyles.animation = 'svger-fade 2s ease-in-out infinite alternate';
        }
      }
      
      // Apply loading state
      if (loading) {
        baseStyles.animation = 'svger-spin 1s linear infinite';
        baseStyles.opacity = 0.7;
      }
      
      // Apply disabled state
      if (disabled) {
        baseStyles.opacity = 0.5;
        baseStyles.pointerEvents = 'none';
      }
      
      // Apply responsive behavior
      if (responsive) {
        baseStyles.width = '100%';
        baseStyles.height = 'auto';
        baseStyles.maxWidth = \`\${dimensions.width}px\`;
      }
      
      return { ...baseStyles, ...style };
    }, [variant, theme, animate, loading, disabled, responsive, dimensions, style]);
    
    // Generate class names
    const classNames = React.useMemo(() => {
      const classes = ['svger-icon'];
      
      if (typeof size === 'string' && sizeMap[size as keyof typeof sizeMap]) {
        classes.push(\`svger-size-\${size}\`);
      }
      
      if (variant) {
        classes.push(\`svger-variant-\${variant}\`);
      }
      
      if (theme) {
        classes.push(\`svger-theme-\${theme}\`);
      }
      
      if (animate) {
        const animationType = animate === true ? 'spin' : animate;
        classes.push(\`svger-animate-\${animationType}\`);
      }
      
      if (responsive) {
        classes.push('svger-responsive');
      }
      
      if (loading) {
        classes.push('svger-loading');
      }
      
      if (disabled) {
        classes.push('svger-disabled');
      }
      
      if (className) {
        classes.push(className);
      }
      
      return classes.join(' ');
    }, [size, variant, theme, animate, responsive, loading, disabled, className]);

    return (
      <svg
        ref={ref}
        viewBox="0 0 ${defaultWidth} ${defaultHeight}"
        xmlns="http://www.w3.org/2000/svg"
        width={responsive ? '100%' : dimensions.width}
        height={responsive ? 'auto' : dimensions.height}
        fill={props.fill || "${defaultFill}"}
        className={classNames}
        style={computedStyles}
        aria-hidden={props['aria-hidden'] || (disabled ? 'true' : undefined)}
        aria-busy={loading ? 'true' : undefined}
        {...props}
      >
        ${svgContent}
      </svg>
    );
  }
);

${componentName}.displayName = "${componentName}";

export default ${componentName};
`;
  }
}

// Export singleton instance
export const templateManager = TemplateManager.getInstance();
