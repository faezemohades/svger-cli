# Test Suite Documentation

This directory contains comprehensive tests for SVGER-CLI covering unit tests, integration tests, and end-to-end tests.

## 📁 Test Structure

```
src/__tests__/
├── builder.test.ts          # Builder module tests
├── cli.test.ts              # CLI command tests
├── config-service.test.ts   # Configuration service tests
├── integration.test.ts      # End-to-end integration tests
├── svg-processor.test.ts    # SVG processing tests
├── templates.test.ts        # Template generation tests
├── utils.test.ts            # Utility function tests
└── fixtures.ts              # Shared test data and fixtures

tests/
├── config-options.test.ts   # Configuration options tests
├── e2e-complete.test.ts     # Complete end-to-end tests
└── integrations/
    ├── webpack.test.ts
    └── verify-integrations.mjs
```

## 🧪 Running Tests

### Run all tests
```bash
npm test
```

### Run specific test suites
```bash
# Jest unit tests
npm run test:jest

# Framework tests
npm run test:frameworks

# Config tests
npm run test:config

# E2E tests
npm run test:e2e

# Integration tests
npm run test:integrations
```

### Run with coverage
```bash
npm run test:coverage
```

### Watch mode
```bash
npm run test:watch
```

## 📊 Test Coverage

Current coverage targets:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

Coverage reports are generated in the `coverage/` directory.

View coverage:
```bash
# HTML report
open coverage/lcov-report/index.html

# Terminal summary
npm run test:coverage
```

## 🔍 Test Categories

### Unit Tests

**Location**: `src/__tests__/*.test.ts`

Test individual modules and functions in isolation:

- **builder.test.ts** - Build orchestration, batch processing, error handling
- **svg-processor.test.ts** - SVG parsing, optimization, transformation
- **utils.test.ts** - String utilities (PascalCase, camelCase, kebab-case), FileSystem operations
- **config-service.test.ts** - Configuration loading, validation, defaults
- **templates.test.ts** - Framework template generation (React, Vue, Angular, Svelte, etc.)

### Integration Tests

**Location**: `src/__tests__/integration.test.ts`

Test complete workflows with multiple components:

- Complete SVG to component conversion
- Multiple framework support
- Naming convention application
- Performance testing
- Error recovery
- Output validation

### CLI Tests

**Location**: `src/__tests__/cli.test.ts`

Test command-line interface:

- Command parsing (build, clean, watch)
- Flag handling (--framework, --typescript, --naming)
- Help and version display
- Error messages
- Configuration file loading

### E2E Tests

**Location**: `tests/e2e-complete.test.ts`

Complete end-to-end testing:

- Full build pipeline
- All framework outputs
- Real file system operations
- Integration verification

## 🛠️ Writing Tests

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Module Name', () => {
  // Setup
  beforeEach(async () => {
    // Prepare test environment
  });

  // Cleanup
  afterEach(async () => {
    // Clean up resources
  });

  describe('Feature', () => {
    it('should do something', async () => {
      // Arrange
      const input = 'test';

      // Act
      const result = processInput(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Using Fixtures

Import shared test data from `fixtures.ts`:

```typescript
import { sampleSVGs, sampleConfigs, expectedOutputs } from './fixtures';

it('should process SVG', () => {
  const result = processor.process(sampleSVGs.simple);
  expect(result).toBeDefined();
});
```

### Testing Async Operations

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Testing Errors

```typescript
it('should throw error on invalid input', () => {
  expect(() => {
    functionThatThrows();
  }).toThrow('Expected error message');
});
```

### Testing File Operations

Always clean up test files:

```typescript
const testDir = path.join(process.cwd(), 'test-temp');

afterEach(async () => {
  await FileSystem.removeDir(testDir);
});
```

## 🎯 Test Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach`/`afterEach` for setup/cleanup
- Don't rely on test execution order

### 2. Clear Naming
```typescript
// ✅ Good
it('should convert kebab-case to PascalCase', () => {});

// ❌ Bad
it('test1', () => {});
```

### 3. AAA Pattern
```typescript
it('should process input correctly', () => {
  // Arrange - set up test data
  const input = 'test';
  
  // Act - execute the function
  const result = process(input);
  
  // Assert - verify the result
  expect(result).toBe('expected');
});
```

### 4. One Assertion Per Test
```typescript
// ✅ Good
it('should return correct name', () => {
  expect(result.name).toBe('test');
});

it('should return correct type', () => {
  expect(result.type).toBe('icon');
});

// ❌ Less ideal
it('should return correct object', () => {
  expect(result.name).toBe('test');
  expect(result.type).toBe('icon');
  expect(result.size).toBe(24);
});
```

### 5. Test Edge Cases
```typescript
describe('String conversion', () => {
  it('should handle empty string', () => {});
  it('should handle single character', () => {});
  it('should handle special characters', () => {});
  it('should handle very long strings', () => {});
  it('should handle null/undefined', () => {});
});
```

## 🔧 Debugging Tests

### Run specific test file
```bash
npm test -- builder.test.ts
```

### Run specific test
```bash
npm test -- -t "should convert kebab-case"
```

### Run in debug mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### View detailed output
```bash
npm test -- --verbose
```

## 📈 Continuous Integration

Tests run automatically in CI/CD:

- **GitHub Actions**: On every push and PR
- **Pre-commit**: Using git hooks
- **Coverage**: Uploaded to Codecov

### CI Configuration

See `.github/workflows/ci.yml` for the complete CI setup.

## 🐛 Troubleshooting

### Tests timing out

Increase timeout in `jest.config.js` or individual tests:
```typescript
it('long running test', async () => {
  // test code
}, 60000); // 60 second timeout
```

### File permission errors

Ensure test cleanup:
```typescript
afterEach(async () => {
  try {
    await FileSystem.removeDir(testDir);
  } catch (error) {
    // Ignore cleanup errors
  }
});
```

### Module resolution issues

Check `moduleNameMapper` in `jest.config.js`:
```javascript
moduleNameMapper: {
  '^(\\.{1,2}/.*)\\.js$': '$1'
}
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [SVGER-CLI Contributing Guide](../../CONTRIBUTING.md)

## 🤝 Contributing

When adding new features:

1. Write tests FIRST (TDD)
2. Ensure all existing tests pass
3. Add tests to cover new code
4. Maintain or improve coverage
5. Update this documentation

## 📝 Test Checklist

Before committing:

- [ ] All tests pass (`npm test`)
- [ ] Coverage meets threshold (`npm run test:coverage`)
- [ ] No console errors or warnings
- [ ] Test files properly named (`*.test.ts`)
- [ ] Tests are isolated and independent
- [ ] Edge cases covered
- [ ] Documentation updated if needed

---

**Last Updated**: December 4, 2025
