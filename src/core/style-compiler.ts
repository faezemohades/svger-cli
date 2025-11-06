/**
 * Comprehensive styling system for SVG components
 * Supports all CSS properties, responsive design, theming, and dynamic styling
 */

export interface StyleTheme {
  name: string;
  colors: Record<string, string>;
  sizes: Record<string, number | string>;
  spacing: Record<string, number | string>;
  breakpoints?: Record<string, string>;
  animations?: Record<string, string>;
}

export interface ResponsiveValue<T> {
  base: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  [key: string]: T | undefined;
}

export interface SVGStyleOptions {
  // Basic styling
  fill?: string | ResponsiveValue<string>;
  stroke?: string | ResponsiveValue<string>;
  strokeWidth?: number | string | ResponsiveValue<number | string>;
  
  // Size and dimensions
  width?: number | string | ResponsiveValue<number | string>;
  height?: number | string | ResponsiveValue<number | string>;
  size?: number | string | ResponsiveValue<number | string>; // shorthand for width & height
  
  // Positioning and transform
  transform?: string;
  rotate?: number | string;
  scale?: number | string;
  translateX?: number | string;
  translateY?: number | string;
  
  // Visual effects
  opacity?: number | ResponsiveValue<number>;
  filter?: string;
  clipPath?: string;
  mask?: string;
  
  // Animation
  animation?: string;
  transition?: string;
  
  // Interaction states
  hover?: Partial<SVGStyleOptions>;
  focus?: Partial<SVGStyleOptions>;
  active?: Partial<SVGStyleOptions>;
  disabled?: Partial<SVGStyleOptions>;
  
  // Theme integration
  theme?: string | StyleTheme;
  
  // Responsive design
  responsive?: boolean;
  
  // Custom CSS properties
  css?: Record<string, string | number>;
  
  // CSS classes
  className?: string;
  
  // Accessibility
  'aria-label'?: string;
  'aria-hidden'?: boolean;
  title?: string;
  role?: string;
}

export interface CompiledStyles {
  inline: Record<string, string | number>;
  classes: string[];
  cssRules: string[];
  mediaQueries: string[];
}

export class SVGStyleCompiler {
  private static instance: SVGStyleCompiler;
  private themes: Map<string, StyleTheme> = new Map();
  private globalCSS: string[] = [];
  
  private constructor() {
    this.loadDefaultThemes();
  }

  public static getInstance(): SVGStyleCompiler {
    if (!SVGStyleCompiler.instance) {
      SVGStyleCompiler.instance = new SVGStyleCompiler();
    }
    return SVGStyleCompiler.instance;
  }

  /**
   * Compile SVG styling options into CSS
   */
  public compileStyles(
    options: SVGStyleOptions,
    componentName: string
  ): CompiledStyles {
    const compiled: CompiledStyles = {
      inline: {},
      classes: [],
      cssRules: [],
      mediaQueries: []
    };

    // Get theme if specified
    const theme = this.resolveTheme(options.theme);
    
    // Compile base styles
    this.compileBaseStyles(options, compiled, theme);
    
    // Compile responsive styles
    if (options.responsive) {
      this.compileResponsiveStyles(options, compiled, theme, componentName);
    }
    
    // Compile interaction states
    this.compileInteractionStates(options, compiled, componentName);
    
    // Add custom CSS
    if (options.css) {
      Object.assign(compiled.inline, options.css);
    }
    
    // Add class names
    if (options.className) {
      compiled.classes.push(options.className);
    }
    
    return compiled;
  }

  /**
   * Register a custom theme
   */
  public registerTheme(theme: StyleTheme): void {
    this.themes.set(theme.name, theme);
  }

  /**
   * Generate CSS for a component with all styling options
   */
  public generateComponentCSS(
    componentName: string,
    options: SVGStyleOptions
  ): string {
    const compiled = this.compileStyles(options, componentName);
    
    let css = '';
    
    // Add CSS rules
    if (compiled.cssRules.length > 0) {
      css += compiled.cssRules.join('\n') + '\n';
    }
    
    // Add media queries
    if (compiled.mediaQueries.length > 0) {
      css += compiled.mediaQueries.join('\n') + '\n';
    }
    
    return css;
  }

  /**
   * Generate enhanced React component template with full styling support
   */
  public generateStyledComponent(
    componentName: string,
    svgContent: string,
    options: SVGStyleOptions = {}
  ): string {
    const compiled = this.compileStyles(options, componentName);
    const hasCustomStyles = compiled.cssRules.length > 0 || compiled.mediaQueries.length > 0;
    
    const imports = hasCustomStyles 
      ? `import React from 'react';\nimport type { SVGProps } from "react";`
      : `import type { SVGProps } from "react";`;

    const styledCSS = hasCustomStyles ? `
const ${componentName}Styles = \`
${compiled.cssRules.join('\n')}
${compiled.mediaQueries.join('\n')}
\`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = '${componentName.toLowerCase()}-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = ${componentName}Styles;
    document.head.appendChild(style);
  }
}
` : '';

    const inlineStyleObject = Object.keys(compiled.inline).length > 0
      ? `const defaultStyles = ${JSON.stringify(compiled.inline, null, 2)};`
      : '';

    const classNames = compiled.classes.length > 0
      ? `'${compiled.classes.join(' ')} ' + (props.className || '')`
      : 'props.className';

    return `${imports}

/**
 * ${componentName} SVG Component with Enhanced Styling
 * Generated by svger-cli with comprehensive styling support
 */

${styledCSS}${inlineStyleObject}

export interface ${componentName}Props extends SVGProps<SVGSVGElement> {
  // Enhanced styling props
  size?: number | string;
  variant?: 'primary' | 'secondary' | 'accent' | 'muted';
  responsive?: boolean;
  
  // Animation props
  animate?: boolean;
  animationType?: 'spin' | 'pulse' | 'bounce' | 'fade';
  
  // Theme props
  theme?: 'light' | 'dark' | 'auto';
}

const ${componentName} = React.forwardRef<SVGSVGElement, ${componentName}Props>(
  ({ 
    size, 
    variant = 'primary',
    responsive = false,
    animate = false,
    animationType = 'spin',
    theme = 'auto',
    style,
    className,
    ...props 
  }, ref) => {
    
    // Calculate dimensions
    const dimensions = React.useMemo(() => {
      if (size) {
        return { width: size, height: size };
      }
      return {
        width: props.width || ${options.width || 24},
        height: props.height || ${options.height || 24}
      };
    }, [size, props.width, props.height]);
    
    // Combine styles
    const combinedStyles = React.useMemo(() => {
      const baseStyles = ${inlineStyleObject ? 'defaultStyles' : '{}'};
      const variantStyles = getVariantStyles(variant);
      const animationStyles = animate ? getAnimationStyles(animationType) : {};
      const themeStyles = getThemeStyles(theme);
      
      return {
        ...baseStyles,
        ...variantStyles,
        ...animationStyles,
        ...themeStyles,
        ...style
      };
    }, [variant, animate, animationType, theme, style]);
    
    // Combine class names
    const combinedClassName = React.useMemo(() => {
      const classes = [];
      ${compiled.classes.length > 0 ? `classes.push('${compiled.classes.join(' ')}');` : ''}
      if (responsive) classes.push(\`\${componentName.toLowerCase()}-responsive\`);
      if (animate) classes.push(\`\${componentName.toLowerCase()}-animate-\${animationType}\`);
      classes.push(\`\${componentName.toLowerCase()}-variant-\${variant}\`);
      classes.push(\`\${componentName.toLowerCase()}-theme-\${theme}\`);
      if (className) classes.push(className);
      return classes.join(' ');
    }, [responsive, animate, animationType, variant, theme, className]);

    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        width={dimensions.width}
        height={dimensions.height}
        fill={props.fill || "${options.fill || 'currentColor'}"}
        className={combinedClassName}
        style={combinedStyles}
        aria-hidden={props['aria-hidden']}
        aria-label={props['aria-label']}
        role={props.role || 'img'}
        {...props}
      >
        ${options.title ? `<title>${options.title}</title>` : ''}
        ${svgContent}
      </svg>
    );
  }
);

// Utility functions for styling
function getVariantStyles(variant: string): React.CSSProperties {
  const variants = {
    primary: { color: 'var(--color-primary, #007bff)' },
    secondary: { color: 'var(--color-secondary, #6c757d)' },
    accent: { color: 'var(--color-accent, #28a745)' },
    muted: { color: 'var(--color-muted, #6c757d)', opacity: 0.7 }
  };
  return variants[variant as keyof typeof variants] || variants.primary;
}

function getAnimationStyles(animationType: string): React.CSSProperties {
  const animations = {
    spin: { animation: 'svger-spin 1s linear infinite' },
    pulse: { animation: 'svger-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' },
    bounce: { animation: 'svger-bounce 1s infinite' },
    fade: { animation: 'svger-fade 2s ease-in-out infinite alternate' }
  };
  return animations[animationType as keyof typeof animations] || {};
}

function getThemeStyles(theme: string): React.CSSProperties {
  if (theme === 'dark') {
    return { filter: 'invert(1) hue-rotate(180deg)' };
  }
  if (theme === 'auto') {
    return { filter: 'var(--svger-theme-filter, none)' };
  }
  return {};
}

${componentName}.displayName = "${componentName}";

export default ${componentName};

// CSS Animations (injected globally)
if (typeof document !== 'undefined') {
  const animationCSS = \`
    @keyframes svger-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    @keyframes svger-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    @keyframes svger-bounce {
      0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
      40%, 43% { transform: translate3d(0,-30px,0); }
      70% { transform: translate3d(0,-15px,0); }
      90% { transform: translate3d(0,-4px,0); }
    }
    
    @keyframes svger-fade {
      from { opacity: 0.4; }
      to { opacity: 1; }
    }
    
    /* CSS Custom Properties for theming */
    :root {
      --color-primary: #007bff;
      --color-secondary: #6c757d;
      --color-accent: #28a745;
      --color-muted: #6c757d;
      --svger-theme-filter: none;
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --svger-theme-filter: invert(1) hue-rotate(180deg);
      }
    }
  \`;
  
  const globalStyleId = 'svger-global-animations';
  if (!document.getElementById(globalStyleId)) {
    const style = document.createElement('style');
    style.id = globalStyleId;
    style.textContent = animationCSS;
    document.head.appendChild(style);
  }
}
`;
  }

  // Private helper methods

  private loadDefaultThemes(): void {
    // Light theme
    this.registerTheme({
      name: 'light',
      colors: {
        primary: '#007bff',
        secondary: '#6c757d',
        success: '#28a745',
        warning: '#ffc107',
        danger: '#dc3545',
        info: '#17a2b8',
        light: '#f8f9fa',
        dark: '#343a40'
      },
      sizes: {
        xs: 12,
        sm: 16,
        md: 24,
        lg: 32,
        xl: 48
      },
      spacing: {
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.5rem'
      },
      breakpoints: {
        sm: '576px',
        md: '768px',
        lg: '992px',
        xl: '1200px'
      }
    });

    // Dark theme
    this.registerTheme({
      name: 'dark',
      colors: {
        primary: '#0d6efd',
        secondary: '#6c757d',
        success: '#198754',
        warning: '#ffc107',
        danger: '#dc3545',
        info: '#0dcaf0',
        light: '#212529',
        dark: '#f8f9fa'
      },
      sizes: {
        xs: 12,
        sm: 16,
        md: 24,
        lg: 32,
        xl: 48
      },
      spacing: {
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.5rem'
      },
      breakpoints: {
        sm: '576px',
        md: '768px',
        lg: '992px',
        xl: '1200px'
      }
    });
  }

  private resolveTheme(theme?: string | StyleTheme): StyleTheme | null {
    if (!theme) return null;
    
    if (typeof theme === 'string') {
      return this.themes.get(theme) || null;
    }
    
    return theme;
  }

  private compileBaseStyles(
    options: SVGStyleOptions,
    compiled: CompiledStyles,
    theme: StyleTheme | null
  ): void {
    // Handle basic properties
    const styleMap: Record<string, keyof SVGStyleOptions> = {
      fill: 'fill',
      stroke: 'stroke',
      strokeWidth: 'strokeWidth',
      opacity: 'opacity',
      transform: 'transform',
      filter: 'filter',
      clipPath: 'clipPath',
      mask: 'mask',
      animation: 'animation',
      transition: 'transition'
    };

    for (const [cssProp, optionKey] of Object.entries(styleMap)) {
      const value = options[optionKey];
      if (value !== undefined) {
        if (this.isResponsiveValue(value)) {
          compiled.inline[cssProp] = (value as ResponsiveValue<any>).base;
        } else {
          compiled.inline[cssProp] = value as string | number;
        }
      }
    }

    // Handle size shorthand
    if (options.size !== undefined) {
      const sizeValue = this.isResponsiveValue(options.size)
        ? (options.size as ResponsiveValue<any>).base
        : options.size;
      compiled.inline.width = sizeValue;
      compiled.inline.height = sizeValue;
    }

    // Handle transform shortcuts
    const transforms: string[] = [];
    if (options.rotate) transforms.push(`rotate(${options.rotate}deg)`);
    if (options.scale) transforms.push(`scale(${options.scale})`);
    if (options.translateX) transforms.push(`translateX(${options.translateX})`);
    if (options.translateY) transforms.push(`translateY(${options.translateY})`);
    
    if (transforms.length > 0) {
      const existingTransform = compiled.inline.transform as string;
      compiled.inline.transform = existingTransform
        ? `${existingTransform} ${transforms.join(' ')}`
        : transforms.join(' ');
    }
  }

  private compileResponsiveStyles(
    options: SVGStyleOptions,
    compiled: CompiledStyles,
    theme: StyleTheme | null,
    componentName: string
  ): void {
    const breakpoints = theme?.breakpoints || {
      sm: '576px',
      md: '768px',
      lg: '992px',
      xl: '1200px'
    };

    for (const [prop, value] of Object.entries(options)) {
      if (this.isResponsiveValue(value)) {
        const responsiveValue = value as ResponsiveValue<any>;
        
        for (const [breakpoint, breakpointValue] of Object.entries(responsiveValue)) {
          if (breakpoint === 'base') continue;
          
          const mediaQuery = breakpoints[breakpoint];
          if (mediaQuery && breakpointValue !== undefined) {
            const rule = `@media (min-width: ${mediaQuery}) {
  .${componentName.toLowerCase()}-responsive {
    ${this.camelToKebab(prop)}: ${breakpointValue};
  }
}`;
            compiled.mediaQueries.push(rule);
          }
        }
      }
    }
  }

  private compileInteractionStates(
    options: SVGStyleOptions,
    compiled: CompiledStyles,
    componentName: string
  ): void {
    const states = ['hover', 'focus', 'active', 'disabled'] as const;
    
    for (const state of states) {
      const stateStyles = options[state];
      if (stateStyles) {
        const selector = state === 'disabled' 
          ? `.${componentName.toLowerCase()}[disabled], .${componentName.toLowerCase()}[aria-disabled="true"]`
          : `.${componentName.toLowerCase()}:${state}`;
        
        const rules: string[] = [];
        for (const [prop, value] of Object.entries(stateStyles)) {
          rules.push(`  ${this.camelToKebab(prop)}: ${value};`);
        }
        
        if (rules.length > 0) {
          compiled.cssRules.push(`${selector} {\n${rules.join('\n')}\n}`);
        }
      }
    }
  }

  private isResponsiveValue(value: any): value is ResponsiveValue<any> {
    return value && typeof value === 'object' && 'base' in value;
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }
}

// Export singleton instance
export const styleCompiler = SVGStyleCompiler.getInstance();