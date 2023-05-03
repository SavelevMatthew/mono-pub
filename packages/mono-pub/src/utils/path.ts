import { glob } from 'glob'
import path from 'path'
import uniq from 'lodash/uniq'
import fs, { promises as fsPromises } from 'fs'
import get from 'lodash/get'
import type { BasePackageInfo } from '@/types/packages'

type PackageScanInfo = {
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
    const matches = await glob(paths, { cwd, stat: true, withFileTypes: true })

    const fileNames: Array<string> = []
    for (const match of matches) {
        if (match.isFile() && match.name === 'package.json') {
            fileNames.push(match.fullpath())
        } else if (match.isDirectory()) {
            const fullPath = match.fullpath()
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
