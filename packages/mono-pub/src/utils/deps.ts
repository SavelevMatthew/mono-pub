import { promises as fsPromises } from 'fs'
import get from 'lodash/get'
import set from 'lodash/set'
import { versionToString, getVersionCriteria } from '@/utils/versions'

import type { BasePackageInfo, PackageInfoWithDependencies, DependencyInfo, LatestPackagesReleases } from '@/types'

export async function getDependencies(
    packages: Array<BasePackageInfo>
): Promise<Record<string, PackageInfoWithDependencies>> {
    const packagesNames = packages.map((pkg) => pkg.name)
    const result: Record<string, PackageInfoWithDependencies> = Object.assign(
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
            .map((dep) => ({ name: dep, type: 'devDep', value: devDeps[dep] }))
        pkg.dependsOn.push(...devDepsInfo)
    }

    return result
}

export function getReleaseOrder(packages: Record<string, PackageInfoWithDependencies>): Array<string> {
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
    pkg: PackageInfoWithDependencies,
    newVersions: LatestPackagesReleases,
    latestReleases: LatestPackagesReleases
): Promise<void> {
    const file = await fsPromises.readFile(pkg.location)
    const packageJson = JSON.parse(file.toString())

    const version = newVersions[pkg.name] || latestReleases[pkg.name]

    if (!version) {
        throw new TypeError(
            `Unable to patch package version ("${pkg.name}"), since it wasn't released before and no relevant changes were introduced`
        )
    }

    set(packageJson, 'version', versionToString(version))

    for (const dep of pkg.dependsOn) {
        const depsGroup = dep.type === 'dep' ? 'dependencies' : 'devDependencies'
        const depVersion = newVersions[dep.name] ?? latestReleases[dep.name]
        if (!depVersion) {
            throw new TypeError(
                `Unable to patch package dependency ("${dep.name}"), since it has no previous versions and relevant changes`
            )
        }
        set(packageJson, [depsGroup, dep.name], getVersionCriteria(dep.value, versionToString(depVersion)))
    }

    await fsPromises.writeFile(pkg.location, JSON.stringify(packageJson, null, 2))
}
