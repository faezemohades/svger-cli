# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2025-11-26

### 🎉 Major Release - Official Build Tool Integrations

This major release introduces **official build tool integrations**, making SVGER-CLI the most
comprehensive SVG-to-component solution with first-class support for all major build tools and
frameworks.

### Added - Build Tool Integrations

#### **Webpack Integration** (`svger-cli/webpack`)

- ✅ Full webpack plugin with HMR (Hot Module Replacement) support
- ✅ Webpack loader for inline SVG transformation
- ✅ Watch mode with intelligent debouncing
- ✅ Asset emission directly to webpack compilation
- ✅ TypeScript support with full type definitions
- ✅ Multi-framework support (React, Vue, Angular, etc.)

#### **Vite Plugin** (`svger-cli/vite`)

- ✅ Native Vite plugin with lightning-fast HMR
- ✅ Virtual module support for dynamic imports
- ✅ Dev server integration with instant updates
- ✅ Build optimization and tree-shaking
- ✅ Named and default export options
- ✅ Source map generation

#### **Rollup Plugin** (`svger-cli/rollup`)

- ✅ Full Rollup plugin with tree-shaking support
- ✅ Load and transform hooks for SVG files
- ✅ Source map generation for debugging
- ✅ Bundle optimization for production
- ✅ Library-friendly named exports
- ✅ Zero runtime overhead

#### **Babel Plugin** (`svger-cli/babel`)

- ✅ Complete Babel plugin with visitor pattern
- ✅ Automatic import transformation (SVG → Component)
- ✅ Dynamic import support (`import('./icon.svg')`)
- ✅ Pre-build SVG processing
- ✅ Works with Create React App, Gatsby, Vue CLI
- ✅ Framework-agnostic with full TypeScript support

#### **Next.js Integration** (`svger-cli/nextjs`)

- ✅ `withSvger` wrapper for seamless Next.js integration
- ✅ Server-Side Rendering (SSR) support
- ✅ App Router and Pages Router compatibility
- ✅ Webpack configuration extension
- ✅ Hot Module Replacement for development
- ✅ TypeScript support out of the box

#### **Jest Preset** (`svger-cli/jest`)

- ✅ Complete Jest transformer for SVG files
- ✅ Jest preset configuration
- ✅ Custom transformer factory
- ✅ Mock mode for faster test execution
- ✅ CommonJS and ES module support
- ✅ Multi-framework compatibility

### Added - Package Infrastructure

- **11 New Export Paths**: Added dedicated exports for all integrations
  - `./webpack`, `./webpack-loader`
  - `./vite`
  - `./rollup`
  - `./babel`, `./babel-plugin`
  - `./nextjs`
  - `./jest`, `./jest-transformer`, `./jest-preset`

- **Comprehensive Documentation**:
  - New `docs/INTEGRATIONS.md` - Complete integration guide (500+ lines)
  - New `docs/INTEGRATION-IMPLEMENTATION-SUMMARY.md` - Implementation overview
  - 6 example configuration files in `examples/` directory
  - Updated API documentation with integration examples

- **Enhanced Testing**:
  - New integration verification test suite
  - 100% integration test coverage (7/7 passing)
  - Automated testing for all build tool integrations
  - New `test:integrations` npm script

- **Updated Keywords**: Added 18+ new npm keywords:
  - Build tools: `webpack`, `webpack-plugin`, `webpack-loader`
  - Bundlers: `vite`, `vite-plugin`, `rollup`, `rollup-plugin`
  - Transpilers: `babel`, `babel-plugin`, `babel-transform`
  - Frameworks: `nextjs`, `next-js`
  - Testing: `jest`, `jest-preset`, `jest-transformer`
  - General: `build-tools`, `bundler`, `hmr`, `hot-module-replacement`

### Changed

- **Package Description**: Updated to highlight official build tool integrations
- **Main Index**: Reorganized exports to include all integration plugins
- **Type Definitions**: Enhanced TypeScript types for all integrations
- **Documentation Structure**: Improved organization with dedicated integration docs

### Features Comparison

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

### Migration Guide from 2.x to 3.0

**No Breaking Changes for CLI Users**: If you're using the CLI (`svger-cli`), everything works
exactly as before.

**New Features for Build Tool Users**:

```bash
# Install
npm install svger-cli@3.0.0 --save-dev

# Use with your build tool
# See docs/INTEGRATIONS.md for detailed examples
```

### Performance

- Zero runtime dependencies
- 85% faster than SVGR for batch processing
- Tree-shakeable exports - only bundle what you use
- Optimized build tool integrations with minimal overhead

### Documentation

- Complete integration guide in `docs/INTEGRATIONS.md`
- 6 working example configurations in `examples/` directory
- Updated README with integration quick-start
- Enhanced API documentation

---

## [2.0.7] - 2025-11-20

### Fixed

- Version bump for npm publishing (2.0.6 was already published)

## [2.0.6] - 2025-11-20

### Added

- **🎉 React Native Support**: Full support for React Native with `react-native-svg`
  - Automatic conversion of SVG elements to React Native SVG components
  - Support for Path, Circle, Rect, Line, Polygon, Polyline, Ellipse, G, Defs, ClipPath, and
    gradient components
  - Proper prop conversion (strokeWidth, strokeLinecap, fillRule, etc.)
  - TypeScript interfaces with SvgProps
  - Size and color prop support
  - ForwardRef implementation for React Native components
- Enhanced test suite with React Native validation
- Comprehensive React Native documentation

### Changed

- Updated framework count from 8 to 9 supported frameworks
- Enhanced framework template engine to handle React Native SVG transformations
- Improved package description to include React Native
- Updated all documentation to reflect React Native support

### Fixed

- Framework type definitions to include 'react-native'
- File extension handling for React Native (.tsx)
- Test validation for react-native-svg imports

## [2.0.5] - 2025-11-11

### Fixed

- **🔧 CRITICAL FIX: PascalCase Component Naming**: Fixed issue where files like
  "ArrowBendDownLeft.svg" were incorrectly converted to "Arrowbenddownleft.tsx" instead of
  preserving the correct "ArrowBendDownLeft.tsx" format
- Enhanced regex pattern in toPascalCase() to properly detect existing PascalCase names
- All existing PascalCase filenames now preserved correctly during component generation

### Changed

- Updated README.md to v2.0.5 with critical fix details
- Updated all installation commands to new version

## [2.0.4] - 2025-11-11

### Added

- Complete 28-property configuration schema with React/Vue/Angular specific options
- Enhanced responsive design support with breakpoint configurations
- Comprehensive theme system with multiple design systems
- Advanced performance optimization settings
- Professional error handling and validation system

### Fixed

- TypeScript duplicate export errors in index generation
- Enhanced toPascalCase to preserve existing PascalCase names
- Simplified index.ts generation to prevent conflicts
- Improved configuration validation and error messages

### Documentation

- Updated README.md with comprehensive v2.0.4 feature documentation
- Added complete configuration schema documentation
- Enhanced comparison tables and installation instructions
- Included recent fixes section with technical details

## [Unreleased] - 2025-11-12

### Added

- Comprehensive performance analysis documentation with detailed technical breakdown
- Professional competitive analysis with fair tool comparisons
- Transparency section welcoming community feedback
- Use case recommendations for each tool in the ecosystem
- Detailed methodology for performance claims and benchmarking
- Research sources and feedback channels for documentation accuracy

### Changed

- Corrected SVGR description to acknowledge webpack ecosystem support (not React-only)
- Clarified 85% performance improvement claim with proper context and scope
- Enhanced "Advanced Props" definition vs standard SVG props
- Improved competitive analysis to be fair, accurate, and professional
- Removed misleading bundle size comparisons (dev dependencies vs runtime)
- Updated documentation tone to be educational rather than competitive

### Fixed

- Inaccurate claims about competitor tools' capabilities
- Misleading performance comparisons without proper context
- Unprofessional competitive analysis language
- Missing disclaimers and acknowledgments for ecosystem tools

## [2.0.5] - 2025-11-11

### Fixed

- **CRITICAL**: PascalCase component naming preservation
  - Fixed issue where PascalCase filenames were incorrectly converted to lowercase
  - ArrowBendDownLeft.svg → ArrowBendDownLeft.tsx (was: Arrowbenddownleft.tsx)
  - MyCustomIcon.svg → MyCustomIcon.tsx (was: Mycustomicon.tsx)
  - Enhanced regex pattern in toPascalCase() to properly detect existing PascalCase
- Maintained compatibility with all existing functionality
- All 28 framework tests continue passing

### Changed

- Updated package version to 2.0.5
- Enhanced toPascalCase utility function for better case detection

## [2.0.4] - 2025-11-11

### Added

- Complete 28-property configuration schema
- React/Vue/Angular specific configuration options
- Enhanced responsive design support with breakpoint configurations
- Comprehensive theme system with multiple design systems support
- Advanced performance optimization settings
- Professional error handling and validation system
- Enhanced TypeScript support with improved type definitions

### Changed

- Streamlined ESLint configuration (.eslintrc.js → .eslintrc.cjs)
- Enhanced component templates with new configuration support
- Improved configuration management across multiple files
- Updated README.md with comprehensive v2.0.4 feature documentation
- Enhanced comparison tables and installation instructions

### Fixed

- TypeScript duplicate export errors in index generation
- Simplified index.ts generation to prevent conflicts
- Improved configuration validation and error messages
- Enhanced toPascalCase to preserve existing PascalCase names

### Removed

- Redundant test documentation files (COMPLETE-TEST-REPORT.md, TEST-RESULTS.md, TESTING-SUMMARY.md)
- Deprecated ESLint configuration format
- Outdated package dependencies reducing bundle size

## [2.0.3] - 2024-11-11

### Added

- Enhanced package.json with comprehensive metadata
- Professional development tooling configuration
- Extended TypeScript support and type definitions
- Additional CLI aliases (`svger` shorthand)
- Comprehensive export map for better module resolution
- Development scripts for testing, linting, and formatting
- Documentation generation scripts
- Comprehensive testing suite with unified export pattern

### Changed

- Improved package description with full feature list
- Enhanced keywords for better discoverability
- Updated contributor information with roles
- Expanded file inclusion patterns
- More comprehensive engine requirements

### Fixed

- Package metadata completeness
- Export definitions for better tree-shaking
- Module resolution issues
- Native module file path resolution error

### Removed

- Unnecessary test folders and configuration files
- Redundant package configurations

## [2.0.2] - 2024-11-01

### Added

- Multi-framework support (React, Vue, Angular, Svelte, Solid, Lit, Preact, Vanilla)
- Auto-generated index.ts exports with tree-shaking support
- Responsive design system with breakpoint configurations
- Theme support (light/dark/auto) with CSS variables
- File locking mechanism for protecting critical files
- Performance optimization engine with parallel processing

### Changed

- Complete rewrite for enterprise-grade performance
- Zero-dependency architecture implementation
- 85% performance improvement over traditional tools (SVG processing time)
- TypeScript-first approach with native type generation

### Removed

- Legacy dependencies reducing package size by 89%
- Single-framework limitation
- Dependency-heavy build processes

## [2.0.0] - 2024-10-30

### Added

- Complete multi-framework support for all 8 UI frameworks
- Enhanced CLI commands with comprehensive options
- Open source project files (CODE_OF_CONDUCT, LICENSE, CONTRIBUTING)
- Professional project structure and documentation

### Changed

- Major version release with breaking changes from 1.x
- Enhanced README with multi-framework guide and benchmarks
- Consolidated project structure and test organization

### Removed

- node_modules folder from repository
- Legacy 1.x architecture and dependencies

## [1.x.x] - Legacy Versions

Please see the [releases page](https://github.com/faezemohades/svger-cli/releases) for information
about 1.x versions.

---

## Legend

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes
