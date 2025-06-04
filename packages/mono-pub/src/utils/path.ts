import path from 'path'
import fs, { promises as fsPromises } from 'fs'
import globby from 'globby'
import uniq from 'lodash/uniq'
import get from 'lodash/get'
import type { BasePackageInfo } from '@/types'

interface PackageScanInfo {
    name: string | null
    private: boolean
}

async function _scanPackage(filePath: string): Promise<PackageScanInfo> {
    const content = await fsPromises.readFile(filePath)
    const pkg = JSON.parse(content.toString())
    const name = get(pkg, 'name', null)
    const privateFieldValue = get(pkg, 'private', false)
    const isPrivate = privateFieldValue === 'true' || privateFieldValue === true

    return { private: isPrivate, name }
}

export async function getAllPackages(paths: Array<string>, cwd: string): Promise<Array<BasePackageInfo>> {
    const matches = await globby(paths, {
        cwd,
        expandDirectories: false,
        onlyFiles: false,
        absolute: true,
        objectMode: true,
    })

    const fileNames: Array<string> = []
    for (const match of matches) {
        if (match.dirent.isFile() && path.basename(match.name) === 'package.json') {
            fileNames.push(match.path)
        } else if (match.dirent.isDirectory()) {
            const fullPath = match.path
            // NOTE: Repo traversal is a part of package logic
            // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            const pkgPath = path.join(fullPath, 'package.json')
            if (fs.existsSync(pkgPath)) {
                fileNames.push(pkgPath)
            }
        }
    }

    const uniqPkgFileNames = uniq(fileNames)
    const packagesInfo = await Promise.all(uniqPkgFileNames.map(_scanPackage))

    const result: Array<BasePackageInfo> = []

    uniqPkgFileNames.forEach((filename, idx) => {
        const info = packagesInfo[idx]
        if (!info.private && info.name) {
            result.push({ name: info.name, location: filename })
        }
    })

    return result
}
