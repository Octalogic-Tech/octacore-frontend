module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'react', 'react-hooks', '@nx/eslint-plugin'],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
      'plugin:@nx/eslint-plugin/react'
    ],
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
    }
  };
  