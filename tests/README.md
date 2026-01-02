# Test Directory Structure

This directory contains all test files for SVGER-CLI.

## Directory Organization

```
tests/
├── unit/                          # Unit tests for individual components
│   ├── cli-framework.test.js      # CLI framework tests
│   ├── frameworks.test.js         # Framework template tests
│   ├── optimizer-pipeline.test.js # Optimizer pipeline tests
│   └── tree-parser.test.js        # Tree parser tests
│
├── performance/                   # Performance benchmarking tests
│   ├── test-accurate-perf.js      # Main performance test script (606 real icons)
│   └── test-real-performance.js   # Alternative performance test script
│
├── dev/                           # Development/experimental tests
│   ├── debug-tree.js              # Tree debugging utilities
│   ├── test-*.js                  # Various optimization tests
│   └── ...                        # Other dev tests
│
├── integrations/                  # Build tool integration tests
│   ├── webpack.test.ts            # Webpack integration tests
│   └── verify-integrations.mjs    # Integration verification
│
├── dist-tests/                    # Tests for compiled distribution
│   ├── config-options.test.js     # Config options tests (compiled)
│   └── e2e-complete.test.js       # E2E tests (compiled)
│
├── config-options.test.ts         # Configuration options tests
├── e2e-complete.test.ts           # End-to-end tests
├── config-migration.test.cjs      # v3.x to v4.0.0 migration tests
├── locked-files-index.test.ts     # Locked files and index generation tests
│
├── test-config-output/            # Test output for config tests
├── test-e2e-complete/             # Test output for E2E tests
└── test-output/                   # General test output
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests
```bash
npm test -- tests/unit/
```

### Performance Tests
```bash
# Run comprehensive performance benchmarks
node tests/performance/test-accurate-perf.js

# Alternative performance test
node tests/performance/test-real-performance.js
```

### Integration Tests
```bash
npm test -- tests/integrations/
```

### Specific Test File
```bash
npm test -- tests/unit/frameworks.test.js
```

## Test Results

Performance test results are saved to:
- `docs/performance/REAL-WORLD-BENCHMARKS.md` - Comprehensive report
- `docs/performance/PERFORMANCE-RESULTS.md` - Raw data

## Development Tests

The `dev/` directory contains experimental and development tests that are not part of the main test suite. These are used for:
- Testing new optimization algorithms
- Debugging specific issues
- Visual diff testing
- Path simplification experiments

These tests are excluded from git via `.gitignore`.

## Test Coverage

Current test coverage:
- ✅ 114+ automated tests
- ✅ Unit tests for core modules
- ✅ Integration tests for build tools
- ✅ E2E tests for complete workflows
- ✅ Performance benchmarks on 606 real icons
- ✅ Configuration migration tests
- ✅ Locked files functionality

## Adding New Tests

1. **Unit tests:** Add to `tests/unit/`
2. **Performance tests:** Add to `tests/performance/`
3. **Integration tests:** Add to `tests/integrations/`
4. **Dev/experimental tests:** Add to `tests/dev/`

All test files should follow the naming convention: `*.test.js`, `*.test.ts`, or `*.test.cjs`
