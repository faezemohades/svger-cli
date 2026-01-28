import { describe, it, expect } from '@jest/globals';
import { SVGProcessor } from '../processors/svg-processor.js';

/**
 * Tests for SVG style attribute conversion and React compatibility
 * Testing fix for: https://github.com/faezemohades/svger-cli/issues/XXX
 */
describe('SVG Style Conversion', () => {
  let processor: SVGProcessor;

  beforeEach(() => {
    processor = SVGProcessor.getInstance();
  });

  describe('inline style conversion', () => {
    it('should convert inline CSS styles to React style objects', async () => {
      const svgWithStyle = `<svg xmlns="http://www.w3.org/2000/svg">
        <path style="fill: #000; stroke-width: 2px;" d="M10 10"/>
      </svg>`;

      const cleaned = await processor.cleanSVGContent(svgWithStyle);

      // Should convert to React style object syntax
      expect(cleaned).toContain("style={{fill: '#000', strokeWidth: '2px'}}");
      // Should NOT contain raw CSS style string
      expect(cleaned).not.toContain('style="fill: #000');
    });

    it('should handle multiple style properties correctly', async () => {
      const svgWithMultipleStyles = `<svg xmlns="http://www.w3.org/2000/svg">
        <path style="fill: red; stroke: blue; stroke-width: 2; opacity: 0.5;" d="M0 0"/>
      </svg>`;

      const cleaned = await processor.cleanSVGContent(svgWithMultipleStyles);

      // Should convert all properties
      expect(cleaned).toContain("fill: 'red'");
      expect(cleaned).toContain("stroke: 'blue'");
      expect(cleaned).toContain("strokeWidth: '2'");
      expect(cleaned).toContain("opacity: '0.5'");
    });

    it('should convert kebab-case CSS properties to camelCase', async () => {
      const svgWithKebabCase = `<svg xmlns="http://www.w3.org/2000/svg">
        <text style="font-family: Arial; font-size: 14px; text-anchor: middle;">Test</text>
      </svg>`;

      const cleaned = await processor.cleanSVGContent(svgWithKebabCase);

      // Should use camelCase
      expect(cleaned).toContain('fontFamily:');
      expect(cleaned).toContain('fontSize:');
      expect(cleaned).toContain('textAnchor:');
      // Should NOT contain kebab-case
      expect(cleaned).not.toContain('font-family');
      expect(cleaned).not.toContain('text-anchor');
    });

    it('should handle empty style attributes', async () => {
      const svgWithEmptyStyle = `<svg xmlns="http://www.w3.org/2000/svg">
        <path style="" d="M0 0"/>
      </svg>`;

      const cleaned = await processor.cleanSVGContent(svgWithEmptyStyle);

      // Should remove empty style attributes
      expect(cleaned).not.toContain('style=');
    });
  });

  describe('width and height attribute handling', () => {
    it('should remove px units from width and height attributes', async () => {
      const svgWithPxUnits = `<svg xmlns="http://www.w3.org/2000/svg">
        <rect width="24px" height="24px" fill="red"/>
      </svg>`;

      const cleaned = await processor.cleanSVGContent(svgWithPxUnits);

      // Should convert to numeric JSX expression
      expect(cleaned).toContain('width={24}');
      expect(cleaned).toContain('height={24}');
      // Should NOT contain px units in attributes
      expect(cleaned).not.toContain('width="24px"');
      expect(cleaned).not.toContain('height="24px"');
    });

    it('should handle numeric width/height without units', async () => {
      const svgWithoutUnits = `<svg xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="200" fill="blue"/>
      </svg>`;

      const cleaned = await processor.cleanSVGContent(svgWithoutUnits);

      // Should preserve numeric values
      expect(cleaned).toContain('width');
      expect(cleaned).toContain('height');
    });
  });

  describe('React attribute conversion', () => {
    it('should convert SVG attributes to React camelCase', async () => {
      const svgWithAttrs = `<svg xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" stroke-width="2" stroke-linecap="round" stroke-linejoin="miter" d="M0 0"/>
      </svg>`;

      const cleaned = await processor.cleanSVGContent(svgWithAttrs);

      // Should convert to camelCase
      expect(cleaned).toContain('fillRule');
      expect(cleaned).toContain('clipRule');
      expect(cleaned).toContain('strokeWidth');
      expect(cleaned).toContain('strokeLinecap');
      expect(cleaned).toContain('strokeLinejoin');

      // Should NOT contain kebab-case
      expect(cleaned).not.toContain('fill-rule');
      expect(cleaned).not.toContain('clip-rule');
      expect(cleaned).not.toContain('stroke-width');
    });
  });

  describe('complex SVG scenarios', () => {
    it('should handle SVG with both styles and attributes', async () => {
      const complexSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path style="fill: #FF0000; stroke-width: 2px;" fill-rule="evenodd" d="M10 10"/>
        <circle cx="12" cy="12" r="10" width="24px" height="24px" style="opacity: 0.8;"/>
      </svg>`;

      const cleaned = await processor.cleanSVGContent(complexSVG);

      // Should convert styles to React objects
      expect(cleaned).toContain('style={{');
      expect(cleaned).toContain('strokeWidth:');

      // Should convert attributes to camelCase
      expect(cleaned).toContain('fillRule');

      // Should convert px units
      expect(cleaned).toMatch(/width=\{24\}|width="24"/);

      // Should be valid React/JSX (no raw CSS strings)
      expect(cleaned).not.toContain('style="fill:');
      expect(cleaned).not.toContain('fill-rule=');
    });

    it('should produce TypeScript/React compatible output', async () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px">
        <path style="fill: currentColor; stroke-width: 1.5px;" d="M0 0 L10 10"/>
      </svg>`;

      const cleaned = await processor.cleanSVGContent(svg);

      // The output should be embeddable in a React component without errors
      // No raw CSS strings, no px in numeric attributes, all camelCase
      const hasInvalidReactSyntax =
        cleaned.includes('style="') ||
        cleaned.includes('stroke-width=') ||
        cleaned.includes('fill-rule=') ||
        (cleaned.includes('width=') && cleaned.includes('px"'));

      expect(hasInvalidReactSyntax).toBe(false);
    });
  });
});
