import { promises as fsPromises } from 'fs'
import get from 'lodash/get'

import type { BasePackageInfo, DependenciesPackageInfo, DependencyInfo } from '@/types'

export async function getDependencies(packages: Array<BasePackageInfo>): Promise<Array<DependenciesPackageInfo>> {
    const packagesNames = packages.map((pkg) => pkg.name)
    const result: Array<DependenciesPackageInfo> = packages.map((pkg) => ({ ...pkg, dependsOn: [] }))

    for (const pkg of result) {
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

export function getReleaseOrder(packages: Array<DependenciesPackageInfo>): Array<string> {
    const order: Array<string> = []

    const deps = new Map<string, Array<string>>()
    for (const pkg of packages) {
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