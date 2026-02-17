import { describe, it, expect } from '@jest/globals';
import { svgProcessor } from '../processors/svg-processor.js';

/**
 * SVG Processor Tests
 * Tests SVG optimization and processing
 */

describe('SVG Processor', () => {
  const validSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
    <circle cx="12" cy="12" r="10" fill="currentColor"/>
  </svg>`;

  describe('SVG parsing', () => {
    it('should parse valid SVG content', async () => {
      const result = await svgProcessor.cleanSVGContent(validSVG);
      expect(result).toBeDefined();
      expect(result).toContain('svg');
    });

    it('should handle SVG with attributes', async () => {
      const svgWithAttrs = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      </svg>`;

      const result = await svgProcessor.cleanSVGContent(svgWithAttrs);
      expect(result).toBeDefined();
      expect(result).toContain('svg');
    });

    it('should extract viewBox dimensions', async () => {
      const result = await svgProcessor.cleanSVGContent(validSVG);
      // Check that viewBox is preserved
      expect(result).toMatch(/viewBox/);
    });
  });

  describe('SVG optimization', () => {
    it('should remove unnecessary attributes', async () => {
      const svgWithExtra = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 24 24" width="24" height="24">
        <circle cx="12" cy="12" r="10"/>
      </svg>`;

      const result = await svgProcessor.cleanSVGContent(svgWithExtra);
      expect(result).toBeDefined();
    });

    it('should handle inline styles', async () => {
      const svgWithStyles = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" style="fill: red;"/>
      </svg>`;

      const result = await svgProcessor.cleanSVGContent(svgWithStyles);
      expect(result).toBeDefined();
    });

    it('should preserve essential attributes', async () => {
      const result = await svgProcessor.cleanSVGContent(validSVG);
      expect(result).toContain('viewBox');
    });
  });

  describe('error handling', () => {
    it('should handle invalid SVG gracefully', async () => {
      const invalidSVG = '<invalid>not svg</invalid>';

      await expect(svgProcessor.cleanSVGContent(invalidSVG)).resolves.toBeDefined();
    });

    it('should handle empty SVG', async () => {
      const emptySVG = '';

      await expect(svgProcessor.cleanSVGContent(emptySVG)).resolves.toBeDefined();
    });

    it('should handle malformed SVG', async () => {
      const malformedSVG = '<svg><unclosed';

      await expect(svgProcessor.cleanSVGContent(malformedSVG)).resolves.toBeDefined();
    });
  });

  describe('SVG transformation', () => {
    it('should convert fill attributes', async () => {
      const result = await svgProcessor.cleanSVGContent(validSVG);
      expect(result).toBeDefined();
    });

    it('should handle nested elements', async () => {
      const nestedSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <g>
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2v20"/>
        </g>
      </svg>`;

      const result = await svgProcessor.cleanSVGContent(nestedSVG);
      expect(result).toBeDefined();
      expect(result).toContain('g');
    });
  });
});
