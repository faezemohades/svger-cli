# Development Guide

This guide will help you set up the development environment and contribute to SVGER-CLI.

## Prerequisites

- **Node.js**: >= 18.17.0 (we recommend using [nvm](https://github.com/nvm-sh/nvm))
- **npm**: >= 9.0.0
- **Git**: Latest version

## Setup Development Environment

1. **Clone the repository:**
   ```bash
   git clone https://github.com/faezemohades/svger-cli.git
   cd svger-cli
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

## Development Workflow

### Building

```bash
# Build once
npm run build

# Build and watch for changes
npm run build:watch
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run integration tests only
npm run test:integration
```

### Linting and Formatting

```bash
# Check for linting issues
npm run lint

# Fix linting issues
npm run lint:fix

# Check formatting
npm run format:check

# Fix formatting
npm run format
```

### Development Mode

To test the CLI during development:

```bash
# Run CLI directly from source
npm run dev -- build ./test-icons ./test-output

# Or install globally for testing
npm run build
npm link
svger-cli --version
```

## Project Structure

```
svger-cli/
├── src/                    # Source code
│   ├── core/              # Core functionality
│   ├── processors/        # SVG processing logic
│   ├── services/          # Business logic services
│   ├── templates/         # Framework templates
│   ├── types/            # TypeScript definitions
│   └── utils/            # Utility functions
├── bin/                   # CLI entry point
├── docs/                  # Documentation
├── dist/                  # Compiled output (generated)
└── tests/                # Test files
```

## Adding New Framework Support

1. **Create framework template:**
   ```typescript
   // src/core/framework-templates.ts
   export const newFrameworkTemplate = {
     name: 'newframework',
     extension: '.jsx',
     generate: (svgContent: string, componentName: string, options: any) => {
       // Implementation
     }
   };
   ```

2. **Add to framework list:**
   ```typescript
   // src/types/index.ts
   export type FrameworkType = 'react' | 'vue' | 'angular' | 'newframework';
   ```

3. **Update CLI options:**
   ```typescript
   // src/cli.ts - Add to framework choices
   ```

4. **Add tests:**
   ```typescript
   // tests/frameworks/newframework.test.ts
   ```

## Testing Strategy

### Unit Tests
- Test individual functions and classes
- Mock external dependencies
- Focus on business logic

### Integration Tests
- Test CLI commands end-to-end
- Test file generation with real SVG files
- Verify output correctness

### Performance Tests
- Benchmark processing times
- Memory usage testing
- Regression detection

## Code Style Guidelines

### TypeScript
- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use generics for reusable code
- Document complex types

### Naming Conventions
- **Files**: kebab-case (e.g., `svg-processor.ts`)
- **Classes**: PascalCase (e.g., `SVGProcessor`)
- **Functions/Variables**: camelCase (e.g., `processFile`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `DEFAULT_SIZE`)

### Error Handling
- Use custom error classes
- Provide meaningful error messages
- Include context in errors
- Log appropriate levels

## Performance Considerations

### Optimization Guidelines
- Use streaming for large files
- Implement caching where appropriate
- Parallelize CPU-intensive tasks
- Monitor memory usage

### Benchmarking
```bash
# Run performance benchmarks
npm run benchmark

# Compare with previous versions
npm run benchmark -- --compare
```

## Contributing Guidelines

### Before You Start
1. Check existing issues and PRs
2. Create an issue for new features
3. Follow coding standards
4. Write tests for new code

### Pull Request Process
1. **Create feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test:**
   ```bash
   npm run validate  # runs typecheck, lint, and test
   ```

3. **Commit with conventional format:**
   ```bash
   git commit -m "feat: add support for new framework"
   ```

4. **Push and create PR:**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting changes
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

## Debugging

### CLI Debugging
```bash
# Enable verbose logging
DEBUG=svger:* npm run dev -- build ./icons ./components

# Debug specific modules
DEBUG=svger:processor npm run dev -- build ./icons ./components
```

### VS Code Configuration
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug CLI",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/cli.ts",
      "args": ["build", "./test-icons", "./test-output"],
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "console": "integratedTerminal"
    }
  ]
}
```

## Release Process

### Version Management
```bash
# Patch release (bug fixes)
npm run release

# Minor release (new features)
npm run release:minor

# Major release (breaking changes)
npm run release:major
```

### Manual Release Steps
1. Update CHANGELOG.md
2. Run all tests and validation
3. Build and test package
4. Update version and tag
5. Publish to npm
6. Create GitHub release

## Documentation

### API Documentation
```bash
# Generate API docs
npm run docs:generate
```

### Adding Documentation
- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Update CHANGELOG.md for releases
- Create ADRs for architectural decisions

## Troubleshooting

### Common Issues

**Build Errors:**
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

**Test Failures:**
```bash
# Update snapshots
npm test -- --updateSnapshot

# Run specific test
npm test -- --testNamePattern="specific test"
```

**TypeScript Errors:**
```bash
# Check types without emitting
npm run typecheck

# Check specific file
npx tsc --noEmit src/specific-file.ts
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Support

If you need help with development:

1. Check existing issues and documentation
2. Ask in GitHub Discussions
3. Contact maintainers: faezemohades@gmail.com

---

Happy coding! 🚀