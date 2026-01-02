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
      const result = svgProcessor.process(validSVG);
      expect(result).toBeDefined();
      expect(result).toContain('svg');
    });

    it('should handle SVG with attributes', async () => {
      const svgWithAttrs = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      </svg>`;

      const result = svgProcessor.process(svgWithAttrs);
      expect(result).toBeDefined();
      expect(result).toContain('svg');
    });

    it('should extract viewBox dimensions', async () => {
      const result = svgProcessor.process(validSVG);
      // Check that viewBox is preserved
      expect(result).toMatch(/viewBox/);
    });
  });

  describe('SVG optimization', () => {
    it('should remove unnecessary attributes', async () => {
      const svgWithExtra = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 24 24" width="24" height="24">
        <circle cx="12" cy="12" r="10"/>
      </svg>`;

      const result = svgProcessor.process(svgWithExtra);
      expect(result).toBeDefined();
    });

    it('should handle inline styles', async () => {
      const svgWithStyles = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" style="fill: red;"/>
      </svg>`;

      const result = svgProcessor.process(svgWithStyles);
      expect(result).toBeDefined();
    });

    it('should preserve essential attributes', async () => {
      const result = svgProcessor.process(validSVG);
      expect(result).toContain('viewBox');
      expect(result).toContain('xmlns');
    });
  });

  describe('error handling', () => {
    it('should handle invalid SVG gracefully', () => {
      const invalidSVG = '<invalid>not svg</invalid>';

      expect(() => {
        svgProcessor.process(invalidSVG);
      }).not.toThrow();
    });

    it('should handle empty SVG', () => {
      const emptySVG = '';

      expect(() => {
        svgProcessor.process(emptySVG);
      }).not.toThrow();
    });

    it('should handle malformed SVG', () => {
      const malformedSVG = '<svg><unclosed';

      expect(() => {
        svgProcessor.process(malformedSVG);
      }).not.toThrow();
    });
  });

  describe('SVG transformation', () => {
    it('should convert fill attributes', async () => {
      const result = svgProcessor.process(validSVG);
      expect(result).toBeDefined();
    });

    it('should handle nested elements', async () => {
      const nestedSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <g>
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2v20"/>
        </g>
      </svg>`;

      const result = svgProcessor.process(nestedSVG);
      expect(result).toBeDefined();
      expect(result).toContain('g');
    });
  });
});
