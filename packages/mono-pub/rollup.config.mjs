import typescript from '@rollup/plugin-typescript'
import sourcemaps from 'rollup-plugin-sourcemaps'
import externals from 'rollup-plugin-node-externals'
import dts from 'rollup-plugin-dts'
import del from 'rollup-plugin-delete'
import alias from '@rollup/plugin-alias'
import path from 'path'

/** @typedef import('rollup').RollupOptions RollupOptions */
/** @type {Array<RollupOptions>} */
const options = [
    {
        input: 'src/index.ts',
        output: [
            {
                sourcemap: 'inline',
                file: 'dist/index.cjs',
                format: 'cjs',
            },
            {
                sourcemap: 'inline',
                file: 'dist/index.mjs',
                format: 'es',
            },
        ],
        plugins: [
            del({ targets: 'dist/*' }),
            externals(),
            typescript({ sourceMap: true, inlineSources: true, tsconfig: './tsconfig.json' }),
            sourcemaps()
        ],
    },
    {
        input: "src/index.ts",
        output: [{
            file: "dist/index.d.ts",
            format: "es",
        }],
        plugins: [
            alias({
                entries: [{
                    find: '@',
                    // In tsconfig this would be like `"paths": { "@/*": ["./src/*"] }`
                    replacement: path.resolve('./dist/dts'),
                }]
            }),
            dts(),
            del({ targets: "dist/dts", hook: "buildEnd" })
        ],
    }
]

export default options
