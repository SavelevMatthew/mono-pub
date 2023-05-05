import typescript from '@rollup/plugin-typescript'
import sourcemaps from 'rollup-plugin-sourcemaps'
import externals from 'rollup-plugin-node-externals'
import dts from 'rollup-plugin-dts'
import del from 'rollup-plugin-delete'
import alias from '@rollup/plugin-alias'
import path from 'path'

/**
 * @param {string} input - input file location
 * @param {string} cjs - cjs file destination
 * @param {string} esm - mjs file destination
 * @param {{clean?: boolean, withTypes?: boolean}} opts - object with options. If clean is specified, will clean dist dir. If withTypes is specified will produce types declarations
 * @return {import('rollup').RollupOptions}
 */
export function filePipe(input, cjs, esm, opts = {}) {
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
            sourcemaps(),
        ].filter(Boolean),
    }
}

/**
 * @param {string} input - input file location
 * @param {string} output - output file location
 * @param {{cleanTypes?: boolean}} opts - object with options. If cleanTypes is specified, will clean dist/dts dir
 * @return {import('rollup').RollupOptions}
 */
export function typePipe(input, output, opts) {
    return {
        input: 'dist/dts/index.d.ts',
        output: [
            {
                file: 'dist/index.d.ts',
                format: 'es',
            },
        ],
        plugins: [
            alias({
                entries: [
                    {
                        find: '@',
                        replacement: path.resolve('./dist/dts'),
                    },
                ],
            }),
            dts(),
            opts.cleanTypes && del({ targets: 'dist/dts', hook: 'buildEnd' }),
        ].filter(Boolean),
    }
}
