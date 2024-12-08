import path from 'path'
import { lstatSync, existsSync } from 'fs'
import { defineConfig } from 'tsup'

const ALLOWED_EXTENSIONS = ['.ts']

function _getInputs(exports) {
    return Object.keys(exports).map((relativeImport) => {
        // NOTE: path utils are expected and part of logic here
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const srcPath = path.join('src', relativeImport)
        const isDirectory = existsSync(srcPath) && lstatSync(srcPath).isDirectory()

        // NOTE: path utils are expected and part of logic here
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const pathToFile = isDirectory ? path.join(srcPath, 'index') : srcPath

        const ext = ALLOWED_EXTENSIONS.find((extension) => existsSync(`${pathToFile}${extension}`))
        if (!ext) throw new Error(`No allowed extensions found for file: ${relativeImport}`)

        return `${pathToFile}${ext}`
    })
}

export function createBuildPipeline(exports) {
    return defineConfig({
        entry: _getInputs(exports),
        clean: true,
        dts: true,
        sourcemap: true,
        format: ['cjs', 'esm'],
        target: 'node16',
        minify: false,
        splitting: false,
        cjsInterop: true,
    })
}
