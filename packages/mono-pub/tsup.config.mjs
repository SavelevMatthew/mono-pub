import { createRequire } from 'node:module'
import { createBuildPipeline } from '@mono-pub/configs/tsup'
const require = createRequire(import.meta.url)
const pkg = require('./package.json')

export default createBuildPipeline(pkg.exports)
