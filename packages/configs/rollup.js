const typescript = require('@rollup/plugin-typescript')
const sourcemaps = require('rollup-plugin-sourcemaps')
const externals = require('rollup-plugin-node-externals')
const dts = require('rollup-plugin-dts').default
const del = require('rollup-plugin-delete')
const alias = require('@rollup/plugin-alias')
const json = require('@rollup/plugin-json')
const path = require('path')

/**
 * @param {string} input - input file location
 * @param {string} cjs - cjs file destination
 * @param {string} esm - mjs file destination
 * @param {{clean?: boolean, withTypes?: boolean}} opts - object with options. If clean is specified, will clean dist dir. If withTypes is specified will produce types declarations
 * @return {import('rollup').RollupOptions}
 */
function filePipe(input, cjs, esm, opts = {}) {
    return {
        input,
        output: [
            {
                sourcemap: 'inline',
                file: cjs,
                format: 'cjs',
            },
            {
                sourcemap: 'inline',
                file: esm,
                format: 'es',
            },
        ],
        plugins: [
            opts.clean && del({ targets: 'dist/*' }),
            externals(),
            opts.withTypes
                ? typescript({
                      sourceMap: true,
                      inlineSources: true,
                      tsconfig: './tsconfig.json',
                      compilerOptions: { declaration: true, declarationDir: 'dist/dts', declarationMap: true },
                  })
                : typescript({
                      sourceMap: true,
                      inlineSources: true,
                      tsconfig: './tsconfig.json',
                      compilerOptions: { declaration: false },
                  }),
            json(),
            sourcemaps(),
        ].filter(Boolean),
    }
}

/**
 * @param {string} input - input file location
 * @param {string} output - output file location
 * @param {{cleanTypes?: boolean, typesDir?: string}} opts - object with options. If cleanTypes is specified, will clean dist/dts dir
 * @return {import('rollup').RollupOptions}
 */
function typePipe(input, output, opts = {}) {
    return {
        input,
        output: [
            {
                file: output,
                format: 'es',
            },
        ],
        plugins: [
            alias({
                entries: [
                    {
                        find: '@',
                        // NOTE: Part of logic
                        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
                        replacement: path.resolve('./dist/dts', opts.typesDir || '.'),
                    },
                ],
            }),
            dts(),
            opts.cleanTypes && del({ targets: 'dist/dts', hook: 'buildEnd' }),
        ].filter(Boolean),
    }
}

module.exports = {
    filePipe,
    typePipe,
}
