import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ... globals.jest 
      },
    },
    rules: {
      'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
      'eqeqeq': 'error',
      'indent': ['warn', 2],
      'quotes': ['warn', 'single'],
      'semi': ['warn', 'always'],
    },
    ignores: [
      'node_modules/'
    ]
  },
];
