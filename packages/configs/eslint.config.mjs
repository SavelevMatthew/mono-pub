import { createRequire } from 'node:module'
import tsEslint from 'typescript-eslint'
import eslint from '@eslint/js'
import jestPlugin from 'eslint-plugin-jest'
import importPlugin from 'eslint-plugin-import'

const require = createRequire(import.meta.url)
const jestVersion = require('jest/package.json').version

/** @type {import('eslint').Linter.Config}  */
const config = tsEslint.config(
    eslint.configs.recommended,
    tsEslint.configs.recommendedTypeChecked,
    tsEslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    importPlugin.flatConfigs.recommended,
    {
        rules: {
            'import/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
                },
            ],
        },
    },
    {
        settings: {
            'import/resolver': {
                typescript: true,
                node: true,
            },
        },
    },
    jestPlugin.configs['flat/recommended'],
    {
        files: ['**/*.spec.ts', '**/*.test.ts'],
        plugins: { jest: jestPlugin },
        languageOptions: {
            globals: jestPlugin.environments.globals.globals,
        },
        rules: {
            'jest/no-disabled-tests': 'error',
            'jest/no-focused-tests': 'error',
            'jest/no-identical-title': 'error',
            'jest/prefer-to-have-length': 'warn',
            'jest/valid-expect': 'error',
            'jest/no-conditional-expect': 'warn',
        },
        settings: {
            jest: {
                version: jestVersion,
            },
        },
    },
    {
        rules: {
            'require-await': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/consistent-type-definitions': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/prefer-nullish-coalescing': 'off',
            '@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
            '@typescript-eslint/consistent-type-assertions': [
                'error',
                { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
            ],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
            ],
            '@typescript-eslint/consistent-type-exports': 'error',
            '@typescript-eslint/no-confusing-non-null-assertion': 'error',
        },
    },
    {
        files: ['**/*.mjs', '**/*.js'],
        extends: [tsEslint.configs.disableTypeChecked],
    }
)

export default config
