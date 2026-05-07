import { describe, it, expect } from '@jest/globals';
import { SVGProcessor } from '../processors/svg-processor.js';

/**
 * Tests for SVG style attribute conversion and React compatibility
 * Testing fix for: https://github.com/faezemohades/svger-cli/issues/XXX
 */
describe('SVG Style Conversion', () => {
  let processor: SVGProcessor;

  async function generateReactComponent(svg: string): Promise<string> {
    return processor.generateComponent('TestIcon', svg, {
      framework: 'react',
      typescript: true,
    });
  }

  beforeEach(() => {
    processor = SVGProcessor.getInstance();
  });

  describe('inline style conversion', () => {
    it('should convert inline CSS styles to React style objects', async () => {
      const svgWithStyle = `<svg xmlns="http://www.w3.org/2000/svg">
        <path style="fill: #000; stroke-width: 2px;" d="M10 10"/>
      </svg>`;

      const component = await generateReactComponent(svgWithStyle);

      // Should convert to React style object syntax
      expect(component).toContain("style={{fill: '#000', strokeWidth: '2px'}}");
      // Should NOT contain raw CSS style string
      expect(component).not.toContain('style="fill: #000');
    });

    it('should handle multiple style properties correctly', async () => {
      const svgWithMultipleStyles = `<svg xmlns="http://www.w3.org/2000/svg">
        <path style="fill: red; stroke: blue; stroke-width: 2; opacity: 0.5;" d="M0 0"/>
      </svg>`;

      const component = await generateReactComponent(svgWithMultipleStyles);

      // Should convert all properties
      expect(component).toContain("fill: 'red'");
      expect(component).toContain("stroke: 'blue'");
      expect(component).toContain("strokeWidth: '2'");
      expect(component).toContain("opacity: '0.5'");
    });

    it('should convert kebab-case CSS properties to camelCase', async () => {
      const svgWithKebabCase = `<svg xmlns="http://www.w3.org/2000/svg">
        <text style="font-family: Arial; font-size: 14px; text-anchor: middle;">Test</text>
      </svg>`;

      const component = await generateReactComponent(svgWithKebabCase);

      // Should use camelCase
      expect(component).toContain('fontFamily:');
      expect(component).toContain('fontSize:');
      expect(component).toContain('textAnchor:');
      // Should NOT contain kebab-case
      expect(component).not.toContain('font-family');
      expect(component).not.toContain('text-anchor');
    });

    it('should handle empty style attributes', async () => {
      const svgWithEmptyStyle = `<svg xmlns="http://www.w3.org/2000/svg">
        <path style="" d="M0 0"/>
      </svg>`;

      const component = await generateReactComponent(svgWithEmptyStyle);

      // Should remove empty style attributes
      expect(component).not.toContain('style=""');
    });
  });

  describe('width and height attribute handling', () => {
    it('should remove px units from width and height attributes', async () => {
      const svgWithPxUnits = `<svg xmlns="http://www.w3.org/2000/svg">
        <rect width="24px" height="24px" fill="red"/>
      </svg>`;

      const component = await generateReactComponent(svgWithPxUnits);

      // Should remove px units from rendered SVG attributes
      expect(component).toContain('width="24"');
      expect(component).toContain('height="24"');
      // Should NOT contain px units in attributes
      expect(component).not.toContain('width="24px"');
      expect(component).not.toContain('height="24px"');
    });

    it('should handle numeric width/height without units', async () => {
      const svgWithoutUnits = `<svg xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="200" fill="blue"/>
      </svg>`;

      const component = await generateReactComponent(svgWithoutUnits);

      // Should preserve numeric values
      expect(component).toContain('width="100"');
      expect(component).toContain('height="200"');
    });
  });

  describe('React attribute conversion', () => {
    it('should convert SVG attributes to React camelCase', async () => {
      const svgWithAttrs = `<svg xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" stroke-width="2" stroke-linecap="round" stroke-linejoin="miter" d="M0 0"/>
      </svg>`;

      const component = await generateReactComponent(svgWithAttrs);

      // Should convert to camelCase
      expect(component).toContain('fillRule');
      expect(component).toContain('clipRule');
      expect(component).toContain('strokeWidth');
      expect(component).toContain('strokeLinecap');
      expect(component).toContain('strokeLinejoin');

      // Should NOT contain kebab-case
      expect(component).not.toContain('fill-rule');
      expect(component).not.toContain('clip-rule');
      expect(component).not.toContain('stroke-width');
    });
  });

  describe('complex SVG scenarios', () => {
    it('should handle SVG with both styles and attributes', async () => {
      const complexSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path style="fill: #FF0000; stroke-width: 2px;" fill-rule="evenodd" d="M10 10"/>
        <circle cx="12" cy="12" r="10" width="24px" height="24px" style="opacity: 0.8;"/>
      </svg>`;

      const component = await generateReactComponent(complexSVG);

      // Should convert styles to React objects
      expect(component).toContain('style={{');
      expect(component).toContain('strokeWidth:');

      // Should convert attributes to camelCase
      expect(component).toContain('fillRule');

      // Should convert px units
      expect(component).toMatch(/width=\{24\}|width="24"/);

      // Should be valid React/JSX (no raw CSS strings)
      expect(component).not.toContain('style="fill:');
      expect(component).not.toContain('fill-rule=');
    });

    it('should produce TypeScript/React compatible output', async () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px">
        <path style="fill: currentColor; stroke-width: 1.5px;" d="M0 0 L10 10"/>
      </svg>`;

      const component = await generateReactComponent(svg);

      // The output should be embeddable in a React component without errors
      // No raw CSS strings, no px in numeric attributes, all camelCase
      const hasInvalidReactSyntax =
        component.includes('style="') ||
        component.includes('stroke-width=') ||
        component.includes('fill-rule=') ||
        (component.includes('width=') && component.includes('px"'));

      expect(hasInvalidReactSyntax).toBe(false);
    });
  });
});
