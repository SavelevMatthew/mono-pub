import { glob } from 'glob'
import path from 'path'
import uniq from 'lodash/uniq'
import fs, { promises as fsPromises } from 'fs'
import get from 'lodash/get'

async function _isPrivatePackage(filePath: string): Promise<boolean> {
    const content = await fsPromises.readFile(filePath)
    const pkg = JSON.parse(content.toString())
    const pkgPrivateField = get(pkg, 'private', false)

    return pkgPrivateField === 'true' || pkgPrivateField === true
}

export async function getAllPackages(paths: Array<string>, cwd: string): Promise<Array<string>> {
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

    const uniqPkgNames = uniq(fileNames)
    const privateInfo = await Promise.all(uniqPkgNames.map(_isPrivatePackage))

    return uniqPkgNames.filter((_, idx) => !privateInfo[idx])
}
