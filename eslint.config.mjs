import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['package-lock.json']
  },

  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.node'], // Lint JavaScript and Node.js files
    ...js.configs.recommended,

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: false
        }
      }
    },

    rules: {
      'comma-dangle': [2, 'never'],
      'no-empty': [2, { 'allowEmptyCatch': true }],
      'no-extra-parens': [2, 'all', { 'nestedBinaryExpressions': false }],
      'no-inner-declarations': 2,
      'no-irregular-whitespace': 2,
      'curly': 2,
      'dot-location': [2, 'property'],
      'eqeqeq': 2,
      'no-empty-pattern': 2,
      'no-new': 2,
      'no-return-assign': [2, 'always'],
      'no-warning-comments': 1,
      'wrap-iife': [2, 'inside'],
      'no-undef': [2, { 'typeof': true }],
      'no-unused-vars': 2,
      'no-use-before-define': [2, 'nofunc'],
      'handle-callback-err': 1,
      'no-mixed-requires': [2, { 'grouping': true, 'allowCall': true }],
      'array-bracket-spacing': [2, 'never'],
      'brace-style': [2, '1tbs', { 'allowSingleLine': false }],
      'camelcase': [2, { 'properties': 'always' }],
      'comma-spacing': [2, { 'before': false, 'after': true }],
      'comma-style': [2, 'last'],
      'indent': [2, 2, { 'SwitchCase': 1 }],
      'key-spacing': [2, { 'beforeColon': false, 'afterColon': true }],
      'keyword-spacing': 2,
      'linebreak-style': [2, 'unix'],
      'max-len': [1, { 'code': 100 }],
      'max-nested-callbacks': [1, 4],
      'max-statements-per-line': 2,
      'new-cap': [2, { 'newIsCap': true, 'capIsNew': true }],
      'no-mixed-spaces-and-tabs': 2,
      'no-multiple-empty-lines': [2, { 'max': 1 }],
      'no-nested-ternary': 1,
      'no-new-object': 2,
      'no-trailing-spaces': 2,
      'object-curly-spacing': [2, 'always'],
      'one-var': [2, 'never'],
      'operator-linebreak': [2, 'after'],
      'quotes': [2, 'single', { 'allowTemplateLiterals': true }],
      'semi': [2, 'always'],
      'space-before-blocks': [2, 'always'],
      'space-before-function-paren': [2, 'never'],
      'spaced-comment': [2, 'always', { 'markers': ['!'] }],
      'arrow-parens': [2, 'as-needed'],
      'arrow-spacing': [2, { 'before': true, 'after': true }],
      'no-duplicate-imports': [2, { 'includeExports': true }],
      'template-curly-spacing': 2,
      'generator-star-spacing': [2, { 'before': false, 'after': true }],
      'yield-star-spacing': [2, 'both']
    }
  }
];
