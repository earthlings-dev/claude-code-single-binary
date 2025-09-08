/* eslint-env node */
module.exports = {
  root: true,
  env: { es2022: true, node: true },
  globals: { Bun: 'readonly' },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  extends: [
    'eslint:recommended',
  ],
  rules: {
    'no-var': 'error',
    'prefer-const': ['error', { destructuring: 'all' }],
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'curly': ['error', 'all'],
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-shadow': 'error',
    'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }],
    // Scripts are CLIs and can log
    'no-console': 'off',
  },
  overrides: [
    {
      files: ['scripts/**/*.{js,mjs,cjs,ts}', 'tests/**/*.{js,mjs,ts}'],
      rules: {
        'no-var': 'error',
        'prefer-const': ['error', { destructuring: 'all' }],
        'eqeqeq': ['error', 'always', { null: 'ignore' }],
        'curly': ['error', 'all'],
        'no-undef': 'error',
        'no-redeclare': 'error',
        'no-shadow': 'error',
        'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }],
        'no-implied-eval': 'error',
        'no-return-await': 'error',
        'no-throw-literal': 'error',
        'prefer-template': 'error',
        'object-shorthand': ['error', 'always'],
        'arrow-body-style': ['error', 'as-needed'],
      },
    },
  ],
};
