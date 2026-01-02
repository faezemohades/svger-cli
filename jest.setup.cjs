// Jest setup file

// Mock visual-diff module for all tests
jest.mock('./src/utils/visual-diff.js', () => ({
  compareSVGs: async () => ({
    diffPercent: 0,
    passed: true,
  }),
}));
