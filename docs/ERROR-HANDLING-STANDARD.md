# Error Handling Standards

## Purpose
This document establishes standardized error handling patterns for SVGER-CLI v4.0.3+ to ensure consistency, proper error propagation, and appropriate user feedback.

## Standard Patterns

### 1. CLI Command Error Handling (Process Exit Required)
**Pattern:** Log error + exit with code 1
```typescript
try {
  await someOperation();
} catch (error) {
  logger.error('Operation failed:', error);
  process.exit(1);
}
```

### 2. Service Method Error Handling (Propagate to Caller)
**Pattern:** Log error + throw
```typescript
try {
  const result = await operation();
  return result;
} catch (error) {
  logger.error('Failed to perform operation:', error);
  throw error;
}
```

### 3. Background/Async Error Handling (Non-blocking)
**Pattern:** Log error + return error state
```typescript
try {
  await backgroundTask();
} catch (error) {
  logger.error('Background task failed:', error);
  return { success: false, error };
}
```

### 4. Batch Processing Error Handling (Continue on Individual Failures)
**Pattern:** Log individual errors + collect results
```typescript
const results = [];
for (const item of items) {
  try {
    const result = await processItem(item);
    results.push({ success: true, data: result });
  } catch (error) {
    logger.error(`Failed to process ${item}:`, error);
    results.push({ success: false, error });
  }
}
```

### 5. Plugin Error Handling (Isolated Failure)
**Pattern:** Log error + skip plugin + continue pipeline
```typescript
try {
  await plugin.execute();
} catch (error) {
  logger.error(`Plugin "${plugin.name}" failed:`, (error as Error).message);
  // Continue with next plugin
}
```

## Error Types by Severity

### Critical (Process Exit)
- Configuration file corruption
- Permission denied for required directories
- Invalid CLI arguments

### High (Throw Error)
- File not found for specific operation
- Invalid SVG syntax
- Build failures

### Medium (Log + Return Error State)
- Individual file processing failures in batch
- Plugin execution failures
- Optional feature failures (visual validation)

### Low (Log Warning + Continue)
- Missing optional configuration
- Deprecation warnings
- Non-critical file operations

## Implementation Status

### ✅ Completed
- CLI commands properly exit on error
- Service methods properly propagate errors
- Batch processing collects individual failures

### 🔄 Needs Review
- Ensure all catch blocks follow appropriate pattern for their context
- Verify error messages are clear and actionable
- Check that error context is preserved in stack traces

## Related Fixes
- Bug #2: Added process.exit(1) in config command
- Bug #12: Plugin registration now throws on duplicate names
- Bug #17: Added CLI argument validation with early exit

## Next Steps
1. Audit all catch blocks for consistency
2. Ensure error messages are user-friendly
3. Add error codes for common scenarios
4. Consider using error-handler.ts more consistently
