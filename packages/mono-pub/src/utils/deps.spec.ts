import fs from 'fs'
import path from 'path'
import { dirSync } from 'tmp'
import { faker } from '@faker-js/faker'
import { getDependencies, getReleaseOrder, patchPackageDeps } from './deps'
import { getNewVersion, versionToString } from './versions'

import type { DirResult } from 'tmp'
import type { BasePackageInfo, LatestPackagesReleases, PackageVersion } from '@/types'

function writePackageJson(obj: Record<string, unknown>, packagePath: string, cwd: string) {
    fs.mkdirSync(path.join(cwd, packagePath), { recursive: true })
    fs.writeFileSync(path.join(cwd, packagePath, 'package.json'), JSON.stringify(obj, null, 2))
}

function getRandomVersion(): PackageVersion {
    return {
        major: faker.number.int({ min: 1, max: 50 }),
        minor: faker.number.int({ min: 0, max: 50 }),
        patch: faker.number.int({ min: 0, max: 50 }),
    }
}

describe('Dependencies utils', () => {
    let tmpDir: DirResult
    let pkg1Info: BasePackageInfo
    let pkg2Info: BasePackageInfo
    let pkg3Info: BasePackageInfo
    beforeEach(() => {
        tmpDir = dirSync({ unsafeCleanup: true })
        pkg1Info = {
            name: 'pkg1',
            location: path.join(tmpDir.name, 'packages/pkg1', 'package.json'),
        }
        pkg2Info = {
            name: '@scope/pkg2',
            location: path.join(tmpDir.name, 'packages/pkg2', 'package.json'),
        }
        pkg3Info = {
            name: '@scope/pkg3',
            location: path.join(tmpDir.name, 'packages/pkg3', 'package.json'),
        }

        writePackageJson({ name: pkg1Info.name, version: '0.0.0-development' }, 'packages/pkg1', tmpDir.name)
        writePackageJson(
            {
                name: pkg2Info.name,
                version: '0.0.0-development',
                dependencies: {
                    execa: '^5',
                    [pkg1Info.name]: 'workspace:^',
                },
            },
            'packages/pkg2',
            tmpDir.name
        )
        writePackageJson(
            {
                name: pkg3Info.name,
                version: '0.0.0-development',
                dependencies: {
                    execa: '^5',
                    [pkg1Info.name]: 'workspace:^',
                },
                devDependencies: {
                    other: '1.0.0',
                    [pkg2Info.name]: 'workspace:~',
                },
            },
            'packages/pkg3',
            tmpDir.name
        )
    })
    afterEach(() => {
        tmpDir.removeCallback()
    })
    describe('getDependencies', () => {
        it('Should determine deps of packages correctly', async () => {
            const deps = await getDependencies([pkg1Info, pkg2Info, pkg3Info])
            expect(deps).toEqual(
                expect.objectContaining({
                    [pkg1Info.name]: {
                        ...pkg1Info,
                        dependsOn: [],
                    },
                    [pkg2Info.name]: {
                        ...pkg2Info,
                        dependsOn: expect.arrayContaining([{ name: pkg1Info.name, type: 'dep', value: 'workspace:^' }]),
                    },
                    [pkg3Info.name]: {
                        ...pkg3Info,
                        dependsOn: expect.arrayContaining([
                            { name: pkg1Info.name, type: 'dep', value: 'workspace:^' },
                            { name: pkg2Info.name, type: 'devDep', value: 'workspace:~' },
                        ]),
                    },
                })
            )
            expect(deps[pkg1Info.name].dependsOn).toHaveLength(0)
            expect(deps[pkg2Info.name].dependsOn).toHaveLength(1)
            expect(deps[pkg3Info.name].dependsOn).toHaveLength(2)
        })
        it('Should contains only deps from args', async () => {
            const deps = await getDependencies([pkg1Info, pkg3Info])
            expect(deps).toEqual(
                expect.objectContaining({
                    [pkg1Info.name]: {
                        ...pkg1Info,
                        dependsOn: [],
                    },
                    [pkg3Info.name]: {
                        ...pkg3Info,
                        dependsOn: [{ name: pkg1Info.name, type: 'dep', value: 'workspace:^' }],
                    },
                })
            )
        })
    })
    describe('getReleaseOrder', () => {
        it('Should determine release order from leafs to root of deps tree', async () => {
            const deps = await getDependencies([pkg3Info, pkg2Info, pkg1Info])
            const order = getReleaseOrder(deps)
            expect(order).toEqual([pkg1Info.name, pkg2Info.name, pkg3Info.name])
        })
        it('Should throw if cyclic deps found', async () => {
            const deps = await getDependencies([pkg3Info, pkg2Info, pkg1Info])
            deps[pkg1Info.name].dependsOn.push({ name: pkg3Info.name, value: '1.0.0', type: 'dep' })

            expect(() => {
                getReleaseOrder(deps)
            }).toThrow('The release cannot be done because of cyclic dependencies')
        })
    })
    describe('patchPackageDeps', () => {
        it('Should patch package with new version or version from latest release', async () => {
            const deps = await getDependencies([pkg1Info, pkg2Info, pkg3Info])
            const pkg1LatestRelease = getRandomVersion()
            const pkg2LatestRelease = getRandomVersion()
            const pkg3LatestRelease = getRandomVersion()
            const latestReleases: LatestPackagesReleases = {
                [pkg1Info.name]: pkg1LatestRelease,
                [pkg2Info.name]: pkg2LatestRelease,
                [pkg3Info.name]: pkg3LatestRelease,
            }
            const pkg1NewVersion = getNewVersion(pkg1LatestRelease, 'major') as PackageVersion
            const pkg3NewVersion = getNewVersion(pkg3LatestRelease, 'patch') as PackageVersion
            const newVersions: LatestPackagesReleases = {
                [pkg1Info.name]: pkg1NewVersion,
                [pkg3Info.name]: pkg3NewVersion,
            }
            await patchPackageDeps(deps[pkg1Info.name], newVersions, latestReleases)
            const pkg1 = JSON.parse(fs.readFileSync(pkg1Info.location).toString())
            expect(pkg1).toEqual(
                expect.objectContaining({
                    name: pkg1Info.name,
                    version: versionToString(pkg1NewVersion),
                })
            )
            await patchPackageDeps(deps[pkg2Info.name], newVersions, latestReleases)
            const pkg2 = JSON.parse(fs.readFileSync(pkg2Info.location).toString())
            expect(pkg2).toEqual(
                expect.objectContaining({
                    name: pkg2Info.name,
                    version: versionToString(pkg2LatestRelease),
                    dependencies: expect.objectContaining({
                        [pkg1Info.name]: `^${versionToString(pkg1NewVersion)}`,
                    }),
                })
            )
            await patchPackageDeps(deps[pkg3Info.name], newVersions, latestReleases)
            const pkg3 = JSON.parse(fs.readFileSync(pkg3Info.location).toString())
            expect(pkg3).toEqual(
                expect.objectContaining({
                    name: pkg3Info.name,
                    version: versionToString(pkg3NewVersion),
                    dependencies: expect.objectContaining({
                        [pkg1Info.name]: `^${versionToString(pkg1NewVersion)}`,
                    }),
                    devDependencies: expect.objectContaining({
                        [pkg2Info.name]: `~${versionToString(pkg2LatestRelease)}`,
                    }),
                })
            )
        })
        describe('Should throw if no newVersion or latestRelease specified', () => {
            it('For package version', async () => {
                const deps = await getDependencies([pkg1Info, pkg2Info])
                const latestReleases: LatestPackagesReleases = {
                    [pkg2Info.name]: getRandomVersion(),
                }
                const newVersions: LatestPackagesReleases = {
                    [pkg2Info.name]: getNewVersion(latestReleases[pkg3Info.name], 'patch'),
                }
                await expect(patchPackageDeps(deps[pkg1Info.name], newVersions, latestReleases)).rejects.toThrow()
            })
            it('For dependency version', async () => {
                const deps = await getDependencies([pkg1Info, pkg2Info])
                const latestReleases: LatestPackagesReleases = {
                    [pkg2Info.name]: getRandomVersion(),
                }
                const newVersions: LatestPackagesReleases = {
                    [pkg2Info.name]: getNewVersion(latestReleases[pkg3Info.name], 'patch'),
                }
                await expect(patchPackageDeps(deps[pkg2Info.name], newVersions, latestReleases)).rejects.toThrow()
            })
        })
    })
})
