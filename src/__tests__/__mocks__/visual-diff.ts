/**
 * Mock implementation of visual-diff for testing
 */

export async function compareSVGs(
  original: string,
  modified: string
): Promise<{ diffPercent: number; passed: boolean }> {
  // Mock implementation - always return success
  // The parameters are intentionally unused in the mock
  void original;
  void modified;

  return {
    diffPercent: 0,
    passed: true,
  };
}
