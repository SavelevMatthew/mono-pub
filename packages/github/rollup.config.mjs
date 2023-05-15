import { filePipe, typePipe } from '@mono-pub/configs/rollup'

/** @typedef import('rollup').RollupOptions RollupOptions */
/** @type {Array<RollupOptions>} */
const options = [
    filePipe('src/index.ts', 'dist/index.cjs', 'dist/index.mjs', { clean: true, withTypes: true }),
    typePipe('dist/dts/src/index.d.ts', 'dist/index.d.ts', { cleanTypes: true, typesDir: 'src' }),
]

export default options
