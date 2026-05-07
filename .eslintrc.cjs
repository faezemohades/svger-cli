module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['eslint:recommended', 'prettier'],
  rules: {
    // Disable base rule as it can report incorrect errors
    'no-unused-vars': 'off',

    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',

    // General JavaScript rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',

    // Code style
    'prettier/prettier': 'error',
  },
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', 'coverage/', 'docs/'],
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
    {
      files: [
        'src/builder.ts',
        'src/clean.ts',
        'src/lock.ts',
        'src/watch.ts',
        'src/optimizers/**/*.ts',
        'src/utils/visual-diff.ts',
        'src/services/config.ts',
      ],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['src/types/**/*.ts', 'src/integrations/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
