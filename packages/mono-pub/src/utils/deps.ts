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

type ExecutionOrder<T extends boolean | undefined> = T extends true
    ? Array<Array<BasePackageInfo>>
    : Array<BasePackageInfo>

type TaskPlanningOptions<T extends boolean | undefined> = {
    batching?: T
}

export function getExecutionOrder<T extends boolean | undefined = undefined>(
    packages: Array<PackageInfoWithDependencies>,
    options?: TaskPlanningOptions<T>
): ExecutionOrder<T> {
    const batches: Array<Array<BasePackageInfo>> = []
    const pkgMap = Object.fromEntries(packages.map((pkg) => [pkg.name, pkg]))

    const dependencies = new Map<string, Array<string>>()
    for (const pkg of packages) {
        dependencies.set(
            pkg.name,
            pkg.dependsOn.map((dep) => dep.name)
        )
    }

    while (dependencies.size > 0) {
        const batch: Array<BasePackageInfo> = []
        for (const [pkgName, pkgDeps] of dependencies) {
            if (pkgDeps.length === 0) {
                batch.push({ name: pkgName, location: pkgMap[pkgName].location })
                dependencies.delete(pkgName)
            }
        }

        if (batch.length === 0) {
            throw new Error('The release cannot be done because of cyclic dependencies')
        }

        batches.push(batch)
        const includedPackages = batch.map((pkg) => pkg.name)
        for (const [pkgName, pkgDeps] of dependencies) {
            dependencies.set(
                pkgName,
                pkgDeps.filter((depName) => !includedPackages.includes(depName))
            )
        }
    }

    if (options?.batching) {
        return batches as ExecutionOrder<T>
    }

    return batches.flat() as ExecutionOrder<T>
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
