import { filePipe, typePipe } from '@mono-pub/configs/rollup'

/** @typedef import('rollup').RollupOptions RollupOptions */
/** @type {Array<RollupOptions>} */
const options = [
    filePipe('src/utils/index.ts', 'dist/utils.cjs', 'dist/utils.mjs', { clean: true, withTypes: true }),
    filePipe('src/index.ts', 'dist/index.cjs', 'dist/index.mjs', { withTypes: true }),
    typePipe('dist/dts/index.d.ts', 'dist/index.d.ts'),
    typePipe('dist/dts/utils/index.d.ts', 'dist/utils.d.ts', { cleanTypes: true }),
]

export default options
