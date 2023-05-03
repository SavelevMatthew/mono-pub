import { defineConfig } from 'tsup'

const env = process.env.NODE_ENV

export default defineConfig({
    splitting: true,
    clean: true,
    dts: true,
    format: ['cjs', 'esm'],
    minify: env === 'production',
    bundle: env === 'production',
    skipNodeModulesBundle: true,
    entry: ['src/index.ts'],
    watch: env === 'development',
    target: 'es6',
    outDir: 'dist',
})
