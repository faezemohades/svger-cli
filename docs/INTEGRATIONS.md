# SVGER-CLI Build Tool Integrations

Official build tool integrations for SVGER-CLI, providing seamless SVG to component conversion in
your existing build pipeline.

## 🚀 Quick Start

```bash
npm install svger-cli --save-dev
```

## 📦 Available Integrations

- **[Webpack](#webpack-integration)** - Plugin & Loader with HMR
- **[Vite](#vite-integration)** - Plugin with HMR & Virtual Modules
- **[Rollup](#rollup-integration)** - Plugin with Tree-Shaking
- **[Babel](#babel-integration)** - Plugin with Import Transformation
- **[Next.js](#nextjs-integration)** - Wrapper with SSR Support
- **[Jest](#jest-integration)** - Preset & Transformer

---

## Webpack Integration

### Installation

```bash
npm install svger-cli --save-dev
```

### Usage

**webpack.config.js:**

```javascript
const { SvgerWebpackPlugin } = require('svger-cli/webpack');

module.exports = {
  plugins: [
    new SvgerWebpackPlugin({
      source: './src/icons',
      output: './src/components/icons',
      framework: 'react',
      typescript: true,
      hmr: true,
      generateIndex: true,
    }),
  ],

  module: {
    rules: [
      {
        test: /\.svg$/,
        use: [
          {
            loader: 'svger-cli/webpack-loader',
            options: {
              framework: 'react',
              typescript: true,
            },
          },
        ],
      },
    ],
  },
};
```

### Options

| Option          | Type    | Default                    | Description                                  |
| --------------- | ------- | -------------------------- | -------------------------------------------- |
| `source`        | string  | `'./src/icons'`            | Source directory containing SVG files        |
| `output`        | string  | `'./src/components/icons'` | Output directory for generated components    |
| `framework`     | string  | `'react'`                  | Target framework (react, vue, angular, etc.) |
| `typescript`    | boolean | `true`                     | Generate TypeScript files                    |
| `hmr`           | boolean | `true`                     | Enable Hot Module Replacement                |
| `generateIndex` | boolean | `true`                     | Generate index file with exports             |

[See full example →](./examples/webpack.config.example.js)

---

## Vite Integration

### Installation

```bash
npm install svger-cli --save-dev
```

### Usage

**vite.config.js:**

```javascript
import { svgerVitePlugin } from 'svger-cli/vite';

export default {
  plugins: [
    svgerVitePlugin({
      source: './src/icons',
      output: './src/components/icons',
      framework: 'react',
      typescript: true,
      hmr: true,
    }),
  ],
};
```

### Options

| Option       | Type    | Default                    | Description                               |
| ------------ | ------- | -------------------------- | ----------------------------------------- |
| `source`     | string  | `'./src/icons'`            | Source directory containing SVG files     |
| `output`     | string  | `'./src/components/icons'` | Output directory for generated components |
| `framework`  | string  | `'react'`                  | Target framework                          |
| `typescript` | boolean | `true`                     | Generate TypeScript files                 |
| `hmr`        | boolean | `true`                     | Enable Hot Module Replacement             |
| `virtual`    | boolean | `false`                    | Use virtual modules                       |
| `exportType` | string  | `'default'`                | Export type ('default' or 'named')        |

[See full example →](./examples/vite.config.example.js)

---

## Rollup Integration

### Installation

```bash
npm install svger-cli --save-dev
```

### Usage

**rollup.config.js:**

```javascript
import { svgerRollupPlugin } from 'svger-cli/rollup';

export default {
  plugins: [
    svgerRollupPlugin({
      source: './src/icons',
      output: './src/components/icons',
      framework: 'react',
      typescript: true,
      sourcemap: true,
    }),
  ],
};
```

### Options

| Option       | Type    | Default                    | Description                               |
| ------------ | ------- | -------------------------- | ----------------------------------------- |
| `source`     | string  | `'./src/icons'`            | Source directory containing SVG files     |
| `output`     | string  | `'./src/components/icons'` | Output directory for generated components |
| `framework`  | string  | `'react'`                  | Target framework                          |
| `typescript` | boolean | `true`                     | Generate TypeScript files                 |
| `sourcemap`  | boolean | `false`                    | Generate source maps                      |
| `exportType` | string  | `'default'`                | Export type ('default' or 'named')        |

[See the full Rollup configuration in the SVGER-CLI repository →](https://github.com/faezemohades/svger-cli/blob/main/examples/rollup.config.example.js)

---

## Babel Integration

### Installation

```bash
npm install svger-cli --save-dev
```

### Usage

**babel.config.js:**

```javascript
const { svgerBabelPlugin } = require('svger-cli/babel');

module.exports = {
  presets: ['@babel/preset-env', '@babel/preset-react'],
  plugins: [
    [
      svgerBabelPlugin,
      {
        source: './src/icons',
        output: './src/components/icons',
        framework: 'react',
        typescript: true,
        transformImports: true,
        processOnInit: true,
        generateIndex: true,
      },
    ],
  ],
};
```

**Or with ES Modules (babel.config.mjs):**

```javascript
import { svgerBabelPlugin } from 'svger-cli/babel';

export default {
  presets: ['@babel/preset-react'],
  plugins: [
    [
      svgerBabelPlugin,
      {
        source: './src/icons',
        output: './src/components/icons',
        framework: 'react',
      },
    ],
  ],
};
```

### Features

- ✅ **Import Transformation** - Automatically transforms SVG imports to component imports
- ✅ **Dynamic Imports** - Supports `import('./icon.svg')` syntax
- ✅ **Auto-Processing** - Processes all SVGs when plugin initializes
- ✅ **Framework Agnostic** - Works with any Babel-based setup
- ✅ **TypeScript Support** - Full type definitions included

### How It Works

```javascript
// Before transformation
import HomeIcon from './assets/home.svg';

// After transformation (automatic)
import HomeIcon from './components/icons/HomeIcon';

// Use in your component
function App() {
  return <HomeIcon width={24} height={24} />;
}
```

### Options

| Option             | Type    | Default                    | Description                                  |
| ------------------ | ------- | -------------------------- | -------------------------------------------- |
| `source`           | string  | `'./src/icons'`            | Source directory containing SVG files        |
| `output`           | string  | `'./src/components/icons'` | Output directory for generated components    |
| `framework`        | string  | `'react'`                  | Target framework (react, vue, angular, etc.) |
| `typescript`       | boolean | `true`                     | Generate TypeScript files                    |
| `transformImports` | boolean | `true`                     | Transform SVG imports to component imports   |
| `processOnInit`    | boolean | `true`                     | Process all SVGs when plugin initializes     |
| `generateIndex`    | boolean | `true`                     | Generate index file with all exports         |
| `include`          | array   | `['**/*.svg']`             | Glob patterns to include                     |
| `exclude`          | array   | `['node_modules/**']`      | Glob patterns to exclude                     |

### Use Cases

**Create React App:**

```javascript
// babel-plugin-macros.config.js
const { createBabelPlugin } = require('svger-cli/babel');

module.exports = {
  svger: createBabelPlugin({
    source: './src/icons',
    framework: 'react',
  }),
};
```

**Gatsby:**

```javascript
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-babel-plugin-svger',
      options: {
        source: './src/assets/icons',
        framework: 'react',
      },
    },
  ],
};
```

**Vue CLI:**

```javascript
// babel.config.js
const { svgerBabelPlugin } = require('svger-cli/babel');

module.exports = {
  presets: ['@vue/cli-plugin-babel/preset'],
  plugins: [
    [
      svgerBabelPlugin,
      {
        source: './src/assets/icons',
        framework: 'vue',
      },
    ],
  ],
};
```

[See the full Babel configuration in the SVGER-CLI repository →](https://github.com/faezemohades/svger-cli/blob/main/examples/babel.config.example.js)

---

## Next.js Integration

### Installation

```bash
npm install svger-cli --save-dev
```

### Usage

**next.config.js:**

```javascript
const { withSvger } = require('svger-cli/nextjs');

module.exports = withSvger({
  svger: {
    source: './public/icons',
    output: './components/icons',
    framework: 'react',
    typescript: true,
    ssr: true,
  },
  // ... other Next.js config
});
```

### Options

| Option       | Type    | Default                    | Description                               |
| ------------ | ------- | -------------------------- | ----------------------------------------- |
| `source`     | string  | `'./src/icons'`            | Source directory containing SVG files     |
| `output`     | string  | `'./src/components/icons'` | Output directory for generated components |
| `framework`  | string  | `'react'`                  | Always 'react' for Next.js                |
| `typescript` | boolean | `true`                     | Generate TypeScript files                 |
| `ssr`        | boolean | `true`                     | Enable Server-Side Rendering support      |
| `hmr`        | boolean | `true`                     | Enable Hot Module Replacement             |

[See the full Next.js configuration in the SVGER-CLI repository →](https://github.com/faezemohades/svger-cli/blob/main/examples/next.config.example.js)

---

## Jest Integration

### Installation

```bash
npm install svger-cli --save-dev
```

### Usage

**jest.config.js:**

```javascript
module.exports = {
  preset: 'svger-cli/jest',
  testEnvironment: 'jsdom',
};
```

**Or manually:**

```javascript
module.exports = {
  transform: {
    '\\.svg$': 'svger-cli/jest-transformer',
  },
};
```

### Options

Configure through transformer config:

```javascript
transform: {
  '\\.svg$': ['svger-cli/jest-transformer', {
    framework: 'react',
    typescript: true,
    mock: false,  // Use simple mocks for faster tests
  }],
}
```

[See the full Jest configuration in the SVGER-CLI repository →](https://github.com/faezemohades/svger-cli/blob/main/examples/jest.config.example.js)

---

## 🎯 Usage Examples

### React Component

```tsx
import { StarIcon, MenuIcon } from './components/icons';

function App() {
  return (
    <div>
      <StarIcon width={24} height={24} fill="gold" />
      <MenuIcon />
    </div>
  );
}
```

### Vue Component

```vue
<template>
  <div>
    <StarIcon :width="24" :height="24" fill="gold" />
  </div>
</template>

<script setup>
import { StarIcon } from './components/icons';
</script>
```

### Angular Component

```typescript
import { Component } from '@angular/core';
import { StarIconComponent } from './components/icons';

@Component({
  selector: 'app-root',
  template: ` <app-star-icon [width]="24" [height]="24" fill="gold"></app-star-icon> `,
  standalone: true,
  imports: [StarIconComponent],
})
export class AppComponent {}
```

---

## 🔧 Supported Frameworks

All integrations support these frameworks:

- ✅ React
- ✅ React Native
- ✅ Vue 3 (Composition & Options API)
- ✅ Angular (Standalone & Module)
- ✅ Svelte
- ✅ Solid
- ✅ Preact
- ✅ Lit
- ✅ Vanilla JS/TS

---

## 📚 Complete Examples

The npm archive includes the Webpack and Vite configuration files in `examples/`. To preserve the
reviewed package entry-count headroom, the full Babel, Jest, Next.js, and Rollup files remain in the
repository rather than the tarball. Their complete configurations are available here:

- [Webpack Configuration](./examples/webpack.config.example.js)
- [Vite Configuration](./examples/vite.config.example.js)
- [Rollup Configuration](https://github.com/faezemohades/svger-cli/blob/main/examples/rollup.config.example.js)
- [Babel Configuration](https://github.com/faezemohades/svger-cli/blob/main/examples/babel.config.example.js)
- [Next.js Configuration](https://github.com/faezemohades/svger-cli/blob/main/examples/next.config.example.js)
- [Jest Configuration](https://github.com/faezemohades/svger-cli/blob/main/examples/jest.config.example.js)

---

## 🚀 Features

### All Integrations Include:

- ✅ **Zero Dependencies** - No bloat
- ✅ **TypeScript Support** - Full type safety
- ✅ **Framework Agnostic** - Works with all major frameworks
- ✅ **Tree Shaking** - Bundle only what you use
- ✅ **Auto-Generated Exports** - Convenient barrel files
- ✅ **85% Faster** - Than alternatives like SVGR

### Build Tool Specific:

| Feature            | Webpack | Vite | Rollup | Babel | Next.js | Jest |
| ------------------ | ------- | ---- | ------ | ----- | ------- | ---- |
| HMR Support        | ✅      | ✅   | ❌     | ❌    | ✅      | N/A  |
| Source Maps        | ✅      | ✅   | ✅     | ❌    | ✅      | ❌   |
| SSR Support        | ❌      | ✅   | ❌     | ❌    | ✅      | N/A  |
| Virtual Modules    | ❌      | ✅   | ❌     | ❌    | ❌      | N/A  |
| Watch Mode         | ✅      | ✅   | ✅     | ✅    | ✅      | N/A  |
| Import Transform   | ✅      | ✅   | ✅     | ✅    | ✅      | ✅   |
| Dynamic Imports    | ✅      | ✅   | ✅     | ✅    | ✅      | ❌   |
| Framework Agnostic | ✅      | ✅   | ✅     | ✅    | ❌      | ✅   |

---

## 🧪 Testing

Run integration tests:

```bash
npm run test:integrations
```

All integrations are thoroughly tested and verified to work correctly.

---

## 📖 Documentation

For complete documentation, visit the [main README](../README.md) or check out specific guides:

- [CLI Documentation](../README.md#-comprehensive-cli-reference)
- [Configuration Reference](../README.md#-configuration-reference)
- [API Documentation](../README.md#-programmatic-api)

---

## 💬 Support

- 📝 [Report Issues](https://github.com/navidrezadoost/svger-cli/issues)
- 💡 [Request Features](https://github.com/navidrezadoost/svger-cli/issues/new)
- 📖 [Read Docs](../README.md)

---

## 📄 License

MIT © SVGER-CLI Development Team
