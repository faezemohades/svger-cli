/**
 * Jest Configuration Example with SVGER-CLI
 *
 * This example shows how to use SVGER-CLI with Jest for testing
 * components that use SVG imports.
 */

/**
 * Method 1: Using the preset (Recommended)
 */
module.exports = {
  preset: 'svger-cli/jest',

  testEnvironment: 'jsdom',

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
};

/**
 * Method 2: Manual configuration
 */
const manualConfig = {
  testEnvironment: 'jsdom',

  transform: {
    // Transform SVG files to components
    '\\.svg$': 'svger-cli/jest-transformer',

    // Transform JS/TS files
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },

  transformIgnorePatterns: ['node_modules/(?!(svger-cli)/)'],

  moduleNameMapper: {
    '\\.svg$': 'svger-cli/jest-transformer',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

// module.exports = manualConfig;

/**
 * Method 3: Custom transformer with options
 */
const { createJestTransformer } = require('svger-cli/jest-preset');

const customConfig = {
  testEnvironment: 'jsdom',

  transform: {
    '\\.svg$': [
      'svger-cli/jest-transformer',
      {
        framework: 'react',
        typescript: true,
        mock: false, // Set to true for simple mocks
      },
    ],
  },
};

// module.exports = customConfig;

/**
 * Usage in tests:
 *
 * // MyComponent.test.tsx
 * import React from 'react';
 * import { render, screen } from '@testing-library/react';
 * import { StarIcon } from '@/components/icons';
 * import Logo from './logo.svg';
 *
 * describe('Icon Components', () => {
 *   it('renders StarIcon correctly', () => {
 *     render(<StarIcon width={24} height={24} fill="gold" />);
 *     const svg = screen.getByRole('img', { hidden: true });
 *     expect(svg).toBeInTheDocument();
 *     expect(svg).toHaveAttribute('width', '24');
 *     expect(svg).toHaveAttribute('fill', 'gold');
 *   });
 *
 *   it('renders Logo correctly', () => {
 *     render(<Logo width={50} height={50} />);
 *     const svg = screen.getByRole('img', { hidden: true });
 *     expect(svg).toBeInTheDocument();
 *   });
 * });
 */

/**
 * jest.setup.js example:
 *
 * import '@testing-library/jest-dom';
 *
 * // Mock IntersectionObserver if needed
 * global.IntersectionObserver = class IntersectionObserver {
 *   constructor() {}
 *   disconnect() {}
 *   observe() {}
 *   takeRecords() { return []; }
 *   unobserve() {}
 * };
 */

/**
 * TypeScript configuration (tsconfig.json):
 *
 * {
 *   "compilerOptions": {
 *     "types": ["jest", "@testing-library/jest-dom"],
 *     "esModuleInterop": true
 *   }
 * }
 */

/**
 * Using mock mode for faster tests:
 *
 * When you don't need to test SVG internals, use mock mode
 * for faster test execution:
 */
const mockConfig = {
  testEnvironment: 'jsdom',

  transform: {
    '\\.svg$': [
      'svger-cli/jest-transformer',
      {
        mock: true, // Creates simple React component mocks
      },
    ],
  },
};

// module.exports = mockConfig;

/**
 * Testing with Vitest:
 *
 * // vitest.config.ts
 * import { defineConfig } from 'vitest/config';
 * import { svgerVitePlugin } from 'svger-cli/vite';
 *
 * export default defineConfig({
 *   plugins: [svgerVitePlugin()],
 *   test: {
 *     environment: 'jsdom',
 *     setupFiles: './vitest.setup.ts',
 *   },
 * });
 */
