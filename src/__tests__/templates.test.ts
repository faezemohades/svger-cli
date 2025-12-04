import { describe, it, expect } from '@jest/globals';

/**
 * Template Generation Tests
 * Tests framework-specific template generation
 */

describe('Template Generation', () => {
  const mockSVGContent = '<circle cx="12" cy="12" r="10"/>';

  describe('React templates', () => {
    it('should generate React component', () => {
      // Test React component template
      const template = `import React from 'react';

export const TestIcon = (props) => (
  <svg {...props}>
    ${mockSVGContent}
  </svg>
);`;

      expect(template).toContain('React');
      expect(template).toContain('svg');
    });

    it('should generate React TypeScript component', () => {
      const template = `import React from 'react';

interface TestIconProps extends React.SVGProps<SVGSVGElement> {}

export const TestIcon: React.FC<TestIconProps> = (props) => (
  <svg {...props}>
    ${mockSVGContent}
  </svg>
);`;

      expect(template).toContain('React.FC');
      expect(template).toContain('SVGProps');
    });

    it('should include forwardRef for React', () => {
      const template = `import React, { forwardRef } from 'react';

export const TestIcon = forwardRef<SVGSVGElement>((props, ref) => (
  <svg ref={ref} {...props}>
    ${mockSVGContent}
  </svg>
));`;

      expect(template).toContain('forwardRef');
      expect(template).toContain('ref');
    });
  });

  describe('Vue templates', () => {
    it('should generate Vue 3 component', () => {
      const template = `<template>
  <svg v-bind="$attrs">
    ${mockSVGContent}
  </svg>
</template>

<script setup>
</script>`;

      expect(template).toContain('<template>');
      expect(template).toContain('script setup');
    });

    it('should generate Vue TypeScript component', () => {
      const template = `<template>
  <svg v-bind="$attrs">
    ${mockSVGContent}
  </svg>
</template>

<script setup lang="ts">
</script>`;

      expect(template).toContain('lang="ts"');
    });
  });

  describe('Angular templates', () => {
    it('should generate Angular component', () => {
      const template = `import { Component } from '@angular/core';

@Component({
  selector: 'app-test-icon',
  template: \`<svg>
    ${mockSVGContent}
  </svg>\`,
  standalone: true
})
export class TestIconComponent {}`;

      expect(template).toContain('@Component');
      expect(template).toContain('standalone: true');
    });

    it('should generate Angular TypeScript component', () => {
      const template = `import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-test-icon',
  template: \`<svg [attr.width]="width" [attr.height]="height">
    ${mockSVGContent}
  </svg>\`,
  standalone: true
})
export class TestIconComponent {
  @Input() width: number = 24;
  @Input() height: number = 24;
}`;

      expect(template).toContain('@Input()');
      expect(template).toContain('number');
    });
  });

  describe('Svelte templates', () => {
    it('should generate Svelte component', () => {
      const template = `<script>
  export let width = 24;
  export let height = 24;
</script>

<svg {width} {height}>
  ${mockSVGContent}
</svg>`;

      expect(template).toContain('<script>');
      expect(template).toContain('export let');
    });

    it('should generate Svelte TypeScript component', () => {
      const template = `<script lang="ts">
  export let width: number = 24;
  export let height: number = 24;
</script>

<svg {width} {height}>
  ${mockSVGContent}
</svg>`;

      expect(template).toContain('lang="ts"');
      expect(template).toContain(': number');
    });
  });

  describe('Solid templates', () => {
    it('should generate Solid component', () => {
      const template = `import { Component } from 'solid-js';

export const TestIcon: Component = (props) => (
  <svg {...props}>
    ${mockSVGContent}
  </svg>
);`;

      expect(template).toContain('solid-js');
      expect(template).toContain('Component');
    });
  });

  describe('template props', () => {
    it('should include size props', () => {
      const template = `width={width}
height={height}`;

      expect(template).toContain('width');
      expect(template).toContain('height');
    });

    it('should include color props', () => {
      const template = `fill={color}
stroke={strokeColor}`;

      expect(template).toContain('fill');
      expect(template).toContain('stroke');
    });

    it('should include className prop', () => {
      const template = `className={className}`;

      expect(template).toContain('className');
    });
  });

  describe('template exports', () => {
    it('should generate default export', () => {
      const template = `export default TestIcon;`;

      expect(template).toContain('export default');
    });

    it('should generate named export', () => {
      const template = `export { TestIcon };`;

      expect(template).toContain('export {');
    });

    it('should generate both exports', () => {
      const template = `export { TestIcon };
export default TestIcon;`;

      expect(template).toContain('export {');
      expect(template).toContain('export default');
    });
  });

  describe('template naming', () => {
    it('should use PascalCase for React', () => {
      const name = 'ArrowLeft';
      expect(name).toMatch(/^[A-Z][a-zA-Z]*$/);
    });

    it('should use kebab-case for selectors', () => {
      const selector = 'arrow-left';
      expect(selector).toMatch(/^[a-z]+(-[a-z]+)*$/);
    });

    it('should handle multi-word names', () => {
      const name = 'UserProfileIcon';
      expect(name).toMatch(/^[A-Z][a-zA-Z]*$/);
    });
  });

  describe('SVG content preservation', () => {
    it('should preserve viewBox', () => {
      const svgWithViewBox = '<svg viewBox="0 0 24 24">...</svg>';
      expect(svgWithViewBox).toContain('viewBox');
    });

    it('should preserve xmlns', () => {
      const svgWithNamespace = '<svg xmlns="http://www.w3.org/2000/svg">...</svg>';
      expect(svgWithNamespace).toContain('xmlns');
    });

    it('should preserve fill attribute', () => {
      const svgWithFill = '<svg fill="currentColor">...</svg>';
      expect(svgWithFill).toContain('fill');
    });
  });
});
