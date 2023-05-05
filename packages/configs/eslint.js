const jestVersion = require('jest/package.json').version

module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'jest'],
    extends: [
        'eslint:recommended',
        'plugin:jest/recommended',
        'plugin:jest/style',
        'plugin:import/recommended',
        'plugin:import/typescript',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        'jest/no-disabled-tests': 'error',
        'jest/no-focused-tests': 'error',
        'jest/no-identical-title': 'error',
        'jest/prefer-to-have-length': 'warn',
        'jest/valid-expect': 'error',
        'jest/no-conditional-expect': 'warn',
        '@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
        '@typescript-eslint/consistent-type-assertions': [
            'error',
            { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
        ],
        '@typescript-eslint/consistent-type-imports': [
            'error',
            { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/consistent-type-exports': 'error',
        '@typescript-eslint/no-confusing-non-null-assertion': 'error',
    },
    parserOptions: {
        ecmaVersion: 2019,
        sourceType: 'module',
        project: ['tsconfig.json'],
    },
    env: {
        'jest/globals': true,
    },
    settings: {
        jest: {
            version: jestVersion,
        },
        'import/resolver': {
            typescript: true,
            node: true,
        },
    },
}
