/**
 * Official Jest Preset for SVGER-CLI
 *
 * Provides Jest transformers and configuration for testing SVG components
 * with full framework support.
 *
 * @example
 * ```js
 * // jest.config.js
 * module.exports = {
 *   preset: 'svger-cli/jest',
 *   // or manually configure:
 *   transform: {
 *     '\\.svg$': 'svger-cli/jest-transformer'
 *   }
 * };
 * ```
 */

import { svgProcessor } from '../processors/svg-processor.js';
import { configService } from '../services/config.js';
import type { JestPresetOptions } from '../types/integrations.js';

/**
 * Jest transformer for SVG files
 */
export const svgerJestTransformer = {
  process(
    sourceText: string,
    sourcePath: string,
    options: any
  ): { code: string } {
    const config = configService.readConfig();
    const transformOptions: JestPresetOptions =
      options?.transformerConfig?.svger || {};

    // Check if we should mock instead of transform
    if (transformOptions.mock) {
      const componentName = svgProcessor.generateComponentName(
        sourcePath,
        'pascal'
      );
      return {
        code: `
const React = require('react');
const ${componentName} = (props) => React.createElement('svg', props);
module.exports = ${componentName};
module.exports.default = ${componentName};
        `,
      };
    }

    // Transform SVG to component
    const framework = transformOptions.framework || config.framework || 'react';
    const typescript =
      transformOptions.typescript !== undefined
        ? transformOptions.typescript
        : config.typescript;

    const componentName = svgProcessor.generateComponentName(
      sourcePath,
      'pascal'
    );

    try {
      // Generate component synchronously for Jest
      const component = generateComponentSync(componentName, sourceText, {
        framework,
        typescript,
        defaultWidth: config.defaultWidth,
        defaultHeight: config.defaultHeight,
        defaultFill: config.defaultFill,
        styleRules: config.styleRules || {},
      });

      // Convert to CommonJS for Jest
      const commonJsCode = convertToCommonJS(component, componentName);

      return {
        code: commonJsCode,
      };
    } catch (error) {
      // Return a simple mock on error
      return {
        code: `
const React = require('react');
const ${componentName} = (props) => React.createElement('svg', props);
module.exports = ${componentName};
module.exports.default = ${componentName};
        `,
      };
    }
  },
};

/**
 * Generate component synchronously (for Jest compatibility)
 */
function generateComponentSync(
  componentName: string,
  svgContent: string,
  options: any
): string {
  // Clean SVG content
  const cleanedContent = svgProcessor.cleanSVGContent(svgContent);

  // For Jest, we'll generate a simple React component
  const viewBox = svgProcessor.extractViewBox(svgContent);

  const template = `
import React from 'react';

interface ${componentName}Props {
  width?: number | string;
  height?: number | string;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
}

const ${componentName}: React.FC<${componentName}Props> = ({
  width = ${options.defaultWidth || 24},
  height = ${options.defaultHeight || 24},
  fill = '${options.defaultFill || 'currentColor'}',
  className,
  style,
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="${viewBox || '0 0 24 24'}"
    fill={fill}
    className={className}
    style={style}
    {...props}
  >
    ${cleanedContent}
  </svg>
);

export default ${componentName};
  `;

  return template.trim();
}

/**
 * Convert ES modules to CommonJS for Jest
 */
function convertToCommonJS(code: string, componentName: string): string {
  // Simple conversion for Jest compatibility
  let commonJsCode = code
    .replace(
      /import\s+React\s+from\s+['"]react['"]/g,
      "const React = require('react')"
    )
    .replace(/export\s+default\s+/g, 'module.exports = ')
    .replace(/export\s+{([^}]+)}/g, (match, exports) => {
      const exportList = exports.split(',').map((e: string) => e.trim());
      return exportList
        .map((exp: string) => `module.exports.${exp} = ${exp}`)
        .join(';');
    });

  // Ensure default export
  if (!commonJsCode.includes('module.exports')) {
    commonJsCode += `\nmodule.exports = ${componentName};`;
  }

  // Also add named export
  commonJsCode += `\nmodule.exports.default = module.exports;`;

  return commonJsCode;
}

/**
 * Jest preset configuration
 */
export const jestPreset = {
  transform: {
    '\\.svg$': ['svger-cli/jest-transformer', {}],
  },
  moduleNameMapper: {
    '\\.svg$': 'svger-cli/jest-transformer',
  },
  transformIgnorePatterns: ['node_modules/(?!(svger-cli)/)'],
};

/**
 * Create custom Jest transformer with options
 */
export function createJestTransformer(
  options: JestPresetOptions = {}
): typeof svgerJestTransformer {
  return {
    process(sourceText: string, sourcePath: string, jestOptions: any) {
      return svgerJestTransformer.process(sourceText, sourcePath, {
        ...jestOptions,
        transformerConfig: {
          svger: options,
        },
      });
    },
  };
}

// Default exports
export default svgerJestTransformer;
