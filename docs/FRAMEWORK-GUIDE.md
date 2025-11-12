# SVGER-CLI - Multi-Framework SVG to Component Converter 🚀

> Zero-dependency, enterprise-grade SVG processing toolkit supporting **9 modern UI frameworks**

[![NPM Version](https://img.shields.io/npm/v/svger-cli.svg)](https://www.npmjs.com/package/svger-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.17-green.svg)](https://nodejs.org/)

## ✨ Features

- **🎯 Multi-Framework Support**: React, Vue, Svelte, Angular, Solid, Preact, Lit, Vanilla JS, React Native
- **📦 Zero Dependencies**: Native Node.js implementation, no external runtime dependencies
- **⚡ High Performance**: Batch processing with parallel execution and intelligent caching
- **🔒 Type-Safe**: Full TypeScript support with comprehensive type definitions
- **🎨 Framework-Idiomatic**: Generates components following best practices for each framework
- **🔄 Watch Mode**: Auto-rebuild components on SVG file changes
- **🔐 File Locking**: Prevent accidental overwrites with lock/unlock system
- **⚙️ Configurable**: Flexible configuration via `.svgconfig.json` or CLI options

---

## 📦 Installation

```bash
npm install -g svger-cli
```

Or use with npx (no installation):

```bash
npx svger-cli build my-svgs/ components/
```

---

## 🚀 Quick Start

### Basic Usage

```bash
# Build React components (default)
svger-cli build ./svgs ./components

# Build Vue 3 components with Composition API
svger-cli build ./svgs ./components --framework vue --composition

# Build Angular standalone components
svger-cli build ./svgs ./components --framework angular --standalone

# Build Svelte components
svger-cli build ./svgs ./components --framework svelte

# Watch mode for development
svger-cli watch ./svgs ./components --framework vue
```

### Generate Single Component

```bash
# Generate single React component
svger-cli generate ./icon.svg ./components --framework react

# Generate Angular component
svger-cli generate ./icon.svg ./components --framework angular --standalone

# Generate Lit web component
svger-cli generate ./icon.svg ./components --framework lit
```

---

## 🎯 Supported Frameworks

| Framework | Version | TypeScript | Options |
|-----------|---------|------------|---------|
| **React** | 18+ | ✅ | `forwardRef`, `memo` |
| **Vue** | 3+ | ✅ | `scriptSetup`, `composition` |
| **Svelte** | 4+ | ✅ | Native TypeScript |
| **Angular** | 16+ | ✅ | `standalone`, `signals` |
| **Solid** | 1.7+ | ✅ | Reactive primitives |
| **Preact** | 10+ | ✅ | Lightweight React alternative |
| **Lit** | 3+ | ✅ | Web Components |
| **Vanilla** | ES6+ | ✅ | Pure JavaScript |
| **React Native** | 0.70+ | ✅ | `forwardRef`, `memo`, `react-native-svg` |

---

## 📖 Framework-Specific Examples

### React

Generate modern React components with TypeScript, forwardRef, and proper prop types:

```bash
svger-cli build ./svgs ./components --framework react
```

**Generated Output** (`components/Icon.tsx`):

```tsx
import React from "react";
import type { SVGProps } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size, className, style, ...props }, ref) => {
    const dimensions = size ? { width: size, height: size } : {
      width: props.width || 24,
      height: props.height || 24
    };

    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        width={dimensions.width}
        height={dimensions.height}
        fill={props.fill || "currentColor"}
        className={className}
        style={style}
        {...props}
      >
        {/* SVG content */}
      </svg>
    );
  }
);

Icon.displayName = "Icon";
export default Icon;
```

**Usage**:

```tsx
import Icon from "./components/Icon";

<Icon size={32} className="text-blue-500" />
<Icon width={48} height={48} fill="#ff0000" />
```

---

### Vue 3

Generate Vue 3 components with Composition API and TypeScript:

```bash
# Composition API with <script setup>
svger-cli build ./svgs ./components --framework vue --composition

# Options API (legacy)
svger-cli build ./svgs ./components --framework vue --no-composition
```

**Generated Output** (`components/Icon.vue`):

```vue
<template>
  <svg
    :class="className"
    :style="style"
    :width="width || 24"
    :height="height || 24"
    :fill="fill || 'currentColor'"
    :stroke="stroke"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    v-bind="$attrs"
  >
    <!-- SVG content -->
  </svg>
</template>

<script setup lang="ts">
interface Props {
  className?: string;
  style?: string | Record<string, any>;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}

withDefaults(defineProps<Props>(), {
  className: '',
  fill: 'currentColor',
  width: 24,
  height: 24
});
</script>
```

**Usage**:

```vue
<script setup>
import Icon from "./components/Icon.vue";
</script>

<template>
  <Icon :width="32" fill="#ff0000" class="icon" />
</template>
```

---

### Svelte

Generate Svelte components with TypeScript support:

```bash
svger-cli build ./svgs ./components --framework svelte
```

**Generated Output** (`components/Icon.svelte`):

```svelte
<script lang="ts">
  export let className: string = '';
  export let style: string = '';
  export let width: string | number = 24;
  export let height: string | number = 24;
  export let fill: string = 'currentColor';
  export let stroke: string = '';
</script>

<svg
  class={className}
  {style}
  {width}
  {height}
  {fill}
  {stroke}
  viewBox="0 0 24 24"
  xmlns="http://www.w3.org/2000/svg"
  {...$$restProps}
>
  <!-- SVG content -->
</svg>
```

**Usage**:

```svelte
<script>
  import Icon from "./components/Icon.svelte";
</script>

<Icon width={32} fill="#ff0000" class="icon" />
```

---

### Angular

Generate Angular standalone components with modern best practices:

```bash
# Standalone components (Angular 16+)
svger-cli build ./svgs ./components --framework angular --standalone

# Module-based components (legacy)
svger-cli build ./svgs ./components --framework angular --no-standalone
```

**Generated Output** (`components/Icon.component.ts`):

```typescript
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      [attr.class]="className"
      [attr.width]="width"
      [attr.height]="height"
      [attr.fill]="fill"
      [attr.stroke]="stroke"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- SVG content -->
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IconComponent {
  @Input() className: string = '';
  @Input() width: string | number = 24;
  @Input() height: string | number = 24;
  @Input() fill: string = 'currentColor';
  @Input() stroke: string = '';
}
```

**Usage**:

```typescript
import { IconComponent } from "./components/Icon.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IconComponent],
  template: `<app-icon [width]="32" fill="#ff0000"></app-icon>`
})
export class AppComponent {}
```

---

### Solid

Generate SolidJS components with reactive primitives:

```bash
svger-cli build ./svgs ./components --framework solid
```

**Generated Output** (`components/Icon.tsx`):

```tsx
import { Component, JSX } from 'solid-js';

export interface IconProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
  className?: string;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}

const Icon: Component<IconProps> = (props) => (
  <svg
    class={props.className}
    style={props.style}
    width={props.width || 24}
    height={props.height || 24}
    fill={props.fill || 'currentColor'}
    stroke={props.stroke}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* SVG content */}
  </svg>
);

export default Icon;
```

**Usage**:

```tsx
import Icon from "./components/Icon";

<Icon width={32} fill="#ff0000" class="icon" />
```

---

### Preact

Generate Preact components (lightweight React alternative):

```bash
svger-cli build ./svgs ./components --framework preact
```

**Generated Output** (`components/Icon.tsx`):

```tsx
import { h, FunctionComponent } from 'preact';
import { JSX } from 'preact/jsx-runtime';

export interface IconProps extends JSX.SVGAttributes<SVGSVGElement> {
  className?: string;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}

const Icon: FunctionComponent<IconProps> = ({ 
  className, 
  style, 
  width, 
  height, 
  fill, 
  stroke, 
  ...props 
}) => {
  return (
    <svg
      class={className}
      style={style}
      width={width || 24}
      height={height || 24}
      fill={fill || 'currentColor'}
      stroke={stroke}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* SVG content */}
    </svg>
  );
};

export default Icon;
```

---

### React Native

Generate React Native components using `react-native-svg` with proper TypeScript types and best practices:

```bash
svger-cli build ./svgs ./components --framework react-native
```

**Generated Output** (`components/Icon.tsx`):

```tsx
import React from "react";
import Svg, { Path, Circle } from "react-native-svg";
import type { SvgProps } from "react-native-svg";
import { StyleProp, ViewStyle } from "react-native";

export interface IconProps extends SvgProps {
  width?: number | string;
  height?: number | string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number | string;
  style?: StyleProp<ViewStyle>;
}

const Icon = React.forwardRef<React.ComponentRef<typeof Svg>, IconProps>(
  ({ width = 24, height = 24, fill = "currentColor", stroke, strokeWidth, style, ...props }, ref) => {
    return (
      <Svg
        ref={ref}
        viewBox="0 0 24 24"
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        style={style}
        {...props}
      >
        <Path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
        <Circle cx="12" cy="12" r="3"/>
      </Svg>
    );
  }
);

Icon.displayName = "Icon";

export default Icon;
```

**Key Features:**
- ✅ Uses `React.ComponentRef<typeof Svg>` for proper ref typing (not deprecated `ElementRef`)
- ✅ Extends `SvgProps` from `react-native-svg` for full type safety
- ✅ Uses `StyleProp<ViewStyle>` for style prop (not `any`)
- ✅ Automatically imports required SVG components (Path, Circle, Rect, etc.)
- ✅ Supports `forwardRef` and `memo` options

**Prerequisites:**

Install `react-native-svg` in your React Native project:

```bash
npm install react-native-svg

# For iOS
cd ios && pod install
```

**Usage**:

```tsx
import Icon from './components/Icon';
import { View } from 'react-native';

function App() {
  return (
    <View>
      <Icon width={32} height={32} fill="#ff0000" />
      <Icon width={48} style={{ marginTop: 10 }} />
    </View>
  );
}
```

---

### Lit (Web Components)

Generate standards-based Web Components with Lit:

```bash
svger-cli build ./svgs ./components --framework lit
```

**Generated Output** (`components/Icon.ts`):

```typescript
import { LitElement, html, css, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('app-icon')
export class Icon extends LitElement {
  @property({ type: String }) className = '';
  @property({ type: String, reflect: true }) width = '24';
  @property({ type: String, reflect: true }) height = '24';
  @property({ type: String, reflect: true }) fill = 'currentColor';
  @property({ type: String, reflect: true }) stroke = '';

  static styles = css`:host { display: inline-block; }`;

  render() {
    return svg`
      <svg
        class="${this.className}"
        width="${this.width}"
        height="${this.height}"
        fill="${this.fill}"
        stroke="${this.stroke}"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- SVG content -->
      </svg>
    `;
  }
}
```

**Usage**:

```html
<app-icon width="32" fill="#ff0000"></app-icon>
```

---

### Vanilla JavaScript

Generate framework-free functions for maximum compatibility:

```bash
svger-cli build ./svgs ./components --framework vanilla
```

**Generated Output** (`components/Icon.ts`):

```typescript
export interface IconOptions {
  className?: string;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
  [key: string]: any;
}

export function Icon(options: IconOptions = {}): SVGSVGElement {
  const {
    className = '',
    width = 24,
    height = 24,
    fill = 'currentColor',
    stroke = '',
    ...attrs
  } = options;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  
  if (className) svg.setAttribute('class', className);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('fill', fill);
  if (stroke) svg.setAttribute('stroke', stroke);
  
  Object.entries(attrs).forEach(([key, value]) => {
    svg.setAttribute(key, String(value));
  });
  
  svg.innerHTML = `<!-- SVG content -->`;
  
  return svg;
}
```

**Usage**:

```typescript
import { Icon } from "./components/Icon";

const iconElement = Icon({ width: 32, fill: '#ff0000' });
document.body.appendChild(iconElement);
```

---

## ⚙️ Configuration

### Config File (`.svgconfig.json`)

Create a configuration file in your project root:

```bash
svger-cli config --init
```

Example configuration:

```json
{
  "src": "./my-svgs",
  "out": "./components",
  "framework": "react",
  "typescript": true,
  "frameworkOptions": {
    "composition": true,
    "standalone": true,
    "memo": false,
    "forwardRef": true
  },
  "indexFileStrategy": "combined",
  "cleanBefore": false,
  "watch": false
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `framework` | string | `"react"` | Target framework |
| `typescript` | boolean | `true` | Generate TypeScript |
| `frameworkOptions` | object | `{}` | Framework-specific options |
| `indexFileStrategy` | string | `"combined"` | Index generation strategy |
| `cleanBefore` | boolean | `false` | Clean output before build |
| `watch` | boolean | `false` | Enable watch mode |

### Framework Options

#### React
- `forwardRef`: Enable React.forwardRef (default: `true`)
- `memo`: Wrap component with React.memo (default: `false`)

#### Vue
- `scriptSetup`: Use Composition API with `<script setup>` (default: `true`)
- `composition`: Enable Composition API (Options API if false)

#### Angular
- `standalone`: Generate standalone components (default: `true`)
- `signals`: Use Angular signals for reactive state (default: `false`)

#### Solid
- `signals`: Use Solid's fine-grained reactivity (default: `true`)

---

## 📝 CLI Reference

### Commands

```bash
# Build all SVGs from source to output
svger-cli build <src> <out> [options]

# Watch for changes and rebuild automatically
svger-cli watch <src> <out> [options]

# Generate single component from SVG file
svger-cli generate <svgFile> <out> [options]

# Lock files to prevent overwrites
svger-cli lock <files...>

# Unlock files
svger-cli unlock <files...>

# Manage configuration
svger-cli config [--init|--set key=value|--show]

# Clean output directory
svger-cli clean <out>
```

### Global Options

```bash
--framework <type>       # react|vue|svelte|angular|solid|preact|lit|vanilla
--typescript            # Generate TypeScript (default)
--no-typescript         # Generate JavaScript
--composition           # Vue Composition API
--standalone            # Angular standalone components
--signals               # Angular/Solid signals
```

### Examples

```bash
# Build React components with TypeScript
svger-cli build ./svgs ./components

# Build Vue components with Composition API
svger-cli build ./svgs ./components --framework vue --composition

# Build Angular standalone components
svger-cli build ./svgs ./components --framework angular --standalone

# Build JavaScript Svelte components
svger-cli build ./svgs ./components --framework svelte --no-typescript

# Generate single Lit web component
svger-cli generate ./icon.svg ./components --framework lit

# Watch mode for Vue development
svger-cli watch ./svgs ./components --framework vue --composition
```

---

## 🧪 Testing

The project includes comprehensive testing for all 8 frameworks:

```bash
# Run framework tests
node test-frameworks.js

# Build project
npm run build

# Watch mode during development
npm run dev
```

Test output validates:
- ✅ Component generation for all frameworks
- ✅ TypeScript type correctness
- ✅ Framework-specific patterns
- ✅ Proper file extensions
- ✅ Code syntax validity

---

## 🏗️ Architecture

SVGER-CLI follows a modular, zero-dependency architecture:

```
svger-cli/
├── src/
│   ├── core/                  # Core processing engines
│   │   ├── framework-templates.ts  # Multi-framework generator
│   │   ├── logger.ts          # Professional logging
│   │   ├── error-handler.ts   # Error management
│   │   └── performance-engine.ts   # Optimization
│   ├── processors/            # SVG processing logic
│   │   └── svg-processor.ts   # SVG parsing and generation
│   ├── services/              # Business logic services
│   │   ├── svg-service.ts     # High-level SVG operations
│   │   └── config.ts          # Configuration management
│   ├── utils/                 # Native utilities
│   │   └── native.ts          # Zero-dependency helpers
│   └── types/                 # TypeScript definitions
│       └── index.ts           # Comprehensive type system
├── test-output/               # Framework test results
└── dist/                      # Compiled JavaScript
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/svger-cli.git
cd svger-cli

# Install dependencies
npm install

# Build project
npm run build

# Run tests
node test-frameworks.js

# Watch mode
npm run dev
```

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## 🌟 Credits

Developed with ❤️ by the SVGER-CLI team.

Special thanks to the open-source community and the maintainers of React, Vue, Svelte, Angular, Solid, Preact, Lit, and all the frameworks we support.

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/svger-cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/svger-cli/discussions)
- **Documentation**: [Full Docs](https://svger-cli.dev)

---

## 🗺️ Roadmap

- [ ] React Native support
- [ ] Next.js optimization
- [ ] Nuxt.js integration
- [ ] SvelteKit optimization
- [ ] Component caching system
- [ ] Custom template support
- [ ] SVG optimization presets
- [ ] Icon pack generation
- [ ] Storybook integration

---

**Made with TypeScript, Node.js, and Zero Dependencies** 🚀
