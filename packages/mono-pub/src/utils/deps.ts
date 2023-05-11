import { promises as fsPromises } from 'fs'
import get from 'lodash/get'
import set from 'lodash/set'
import { versionToString, getVersionCriteria } from '@/utils/versions'

import type { BasePackageInfo, DependenciesPackageInfo, DependencyInfo, PackageVersion } from '@/types'

export async function getDependencies(
    packages: Array<BasePackageInfo>
): Promise<Record<string, DependenciesPackageInfo>> {
    const packagesNames = packages.map((pkg) => pkg.name)
    const result: Record<string, DependenciesPackageInfo> = Object.assign(
        {},
        ...packages.map((pkg) => ({ [pkg.name]: { ...pkg, dependsOn: [] } }))
    )

    for (const pkg of Object.values(result)) {
        const content = await fsPromises.readFile(pkg.location)
        const json = JSON.parse(content.toString())

        const deps = get(json, 'dependencies', {})
        const depsInfo: Array<DependencyInfo> = Object.keys(deps)
            .filter((dep) => packagesNames.includes(dep))
            .map((dep) => ({ name: dep, type: 'dep', value: deps[dep] }))
        pkg.dependsOn.push(...depsInfo)

        const devDeps = get(json, 'devDependencies', {})
        const devDepsInfo: Array<DependencyInfo> = Object.keys(devDeps)
            .filter((dep) => packagesNames.includes(dep))
            .map((dep) => ({ name: dep, type: 'devDep', value: deps[dep] }))
        pkg.dependsOn.push(...devDepsInfo)
    }

    return result
}

export function getReleaseOrder(packages: Record<string, DependenciesPackageInfo>): Array<string> {
    const order: Array<string> = []

    const deps = new Map<string, Array<string>>()
    for (const pkg of Object.values(packages)) {
        deps.set(
            pkg.name,
            pkg.dependsOn.map((dep) => dep.name)
        )
    }

    while (deps.size > 0) {
        const toRelease: Array<string> = []
        for (const [key, value] of deps) {
            if (value.length === 0) {
                toRelease.push(key)
                deps.delete(key)
            }
        }
        if (toRelease.length === 0) {
            throw new Error('The release cannot be done because of cyclic dependencies')
        } else {
            order.push(...toRelease)
            for (const [key, value] of deps) {
                deps.set(
                    key,
                    value.filter((pkg) => !toRelease.includes(pkg))
                )
            }
        }
    }

    return order
}

export async function patchPackageDeps(
    pkg: DependenciesPackageInfo,
    newVersions: Record<string, PackageVersion>
): Promise<void> {
    const file = await fsPromises.readFile(pkg.location)
    const packageJson = JSON.parse(file.toString())
    set(packageJson, 'version', versionToString(newVersions[pkg.name]))
    for (const dep of pkg.dependsOn) {
        const depsGroup = dep.type === 'dep' ? 'dependencies' : 'devDependencies'
        set(packageJson, [depsGroup, dep.name], getVersionCriteria(dep.value, versionToString(newVersions[pkg.name])))
    }
    await fsPromises.writeFile(pkg.location, JSON.stringify(packageJson, null, 2))
}
