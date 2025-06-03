import path from 'path'
import fs from 'fs'
import { faker } from '@faker-js/faker'
import { dirSync } from 'tmp'
import { getDependencies, getExecutionOrder } from '@/utils/deps'
import getLogger from '../logger'
import { CombinedPlugin } from './plugins'
import type { DirResult } from 'tmp'
import type {
    MonoPubPlugin,
    MonoPubContext,
    BasePackageInfo,
    LatestPackagesReleases,
    CommitInfo,
    PackageInfoWithLatestRelease,
    ReleaseType,
    ReleasedPackageInfo,
    PackageInfoWithDependencies,
    PrepareAllInfo,
} from '@/types'

function writePackageJson(obj: Record<string, unknown>, packagePath: string, cwd: string) {
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    fs.mkdirSync(path.join(cwd, packagePath), { recursive: true })
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    fs.writeFileSync(path.join(cwd, packagePath, 'package.json'), JSON.stringify(obj, null, 2))
}

function getEventName(plugin: string, step: string, pkg?: string): string {
    return [plugin, step, pkg].filter(Boolean).join(':')
}

function getFakeVersionGetter(eventLog: Array<string>): MonoPubPlugin {
    return {
        name: faker.string.uuid(),
        setup(): boolean {
            eventLog.push(getEventName(this.name, 'setup'))
            return true
        },
        getLastRelease(): LatestPackagesReleases {
            eventLog.push(getEventName(this.name, 'getLastRelease'))
            return {}
        },
    }
}

function getFakeExtractor(eventLog: Array<string>): MonoPubPlugin {
    return {
        name: faker.string.uuid(),
        async setup(): Promise<boolean> {
            eventLog.push(getEventName(this.name, 'setup'))
            return true
        },
        async extractCommits(packageInfo: PackageInfoWithLatestRelease): Promise<Array<CommitInfo>> {
            eventLog.push(getEventName(this.name, 'extractCommits', packageInfo.name))
            return []
        },
    }
}

function getFakeAnalyzer(eventLog: Array<string>): MonoPubPlugin {
    return {
        name: faker.string.uuid(),
        getReleaseType(): ReleaseType {
            eventLog.push(getEventName(this.name, 'getReleaseType'))
            return 'none'
        },
    }
}

function getFakePreparer(eventLog: Array<string>, single?: boolean): MonoPubPlugin {
    if (single) {
        return {
            name: faker.string.uuid(),
            async prepareSingle({ targetPackage }): Promise<void> {
                eventLog.push(getEventName(this.name, 'prepareSingle', targetPackage.name))
            },
        }
    }

    return {
        name: faker.string.uuid(),
        async prepareAll(): Promise<void> {
            eventLog.push(getEventName(this.name, 'prepareAll'))
        },
    }
}

function getFakePublisher(eventLog: Array<string>): MonoPubPlugin {
    return {
        name: faker.string.uuid(),
        async setup(): Promise<boolean> {
            eventLog.push(getEventName(this.name, 'setup'))
            return true
        },
        async publish(packageInfo: BasePackageInfo): Promise<void> {
            eventLog.push(getEventName(this.name, 'publish', packageInfo.name))
        },
    }
}

function getFakerPostPublisher(eventLog: Array<string>): MonoPubPlugin {
    return {
        name: faker.string.uuid(),
        postPublish(packageInfo: ReleasedPackageInfo): void {
            eventLog.push(getEventName(this.name, 'postPublish', packageInfo.name))
        },
    }
}

interface ReleaseChain {
    getter: MonoPubPlugin
    analyzer: MonoPubPlugin
    extractor: MonoPubPlugin
    preparers: Array<MonoPubPlugin>
    publishers: Array<MonoPubPlugin>
    postPublishers: Array<MonoPubPlugin>
    all: () => Array<MonoPubPlugin>
}

describe('CombinedPlugin', () => {
    let eventLog: Array<string> = []
    let ctx: MonoPubContext
    let chain: ReleaseChain

    let tmpDir: DirResult
    let packages: Array<PackageInfoWithDependencies>

    beforeEach(async () => {
        tmpDir = dirSync({ unsafeCleanup: true })
        const pkg1Info = {
            name: 'pkg1',
            location: path.join(tmpDir.name, 'packages/pkg1', 'package.json'),
        }
        const pkg2Info = {
            name: '@scope/pkg2',
            location: path.join(tmpDir.name, 'packages/pkg2', 'package.json'),
        }
        const pkg3Info = {
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

        packages = Object.values(await getDependencies([pkg3Info, pkg2Info, pkg1Info]))

        eventLog = []
        ctx = {
            cwd: process.cwd(),
            env: {},
            logger: getLogger({ stdout: process.stdout, stderr: process.stderr }),
            ignoreDependencies: {},
        }
        chain = {
            getter: getFakeVersionGetter(eventLog),
            extractor: getFakeExtractor(eventLog),
            analyzer: getFakeAnalyzer(eventLog),
            preparers: [getFakePreparer(eventLog), getFakePreparer(eventLog, true)],
            publishers: [getFakePublisher(eventLog), getFakePublisher(eventLog)],
            postPublishers: [getFakerPostPublisher(eventLog), getFakerPostPublisher(eventLog)],
            all() {
                return [
                    this.getter,
                    this.extractor,
                    this.analyzer,
                    ...this.preparers,
                    ...this.publishers,
                    ...this.postPublishers,
                ]
            },
        }
    })
    afterEach(() => {
        tmpDir.removeCallback()
    })
    describe('Setup', () => {
        it('Should setup all plugins in setup stage', async () => {
            const combined = new CombinedPlugin([chain.getter, chain.extractor, chain.analyzer])
            const success = await combined.setup(ctx)
            expect(success).toBe(true)
            expect(eventLog).toHaveLength(2)
            expect(eventLog).toEqual([
                getEventName(chain.getter.name, 'setup'),
                getEventName(chain.extractor.name, 'setup'),
            ])
        })
        it('Should fail setup if one of plugins failed', async () => {
            const broken: MonoPubPlugin = {
                name: faker.string.uuid(),
                setup(): boolean {
                    eventLog.push(getEventName(this.name, 'setup'))
                    return false
                },
            }
            const combined = new CombinedPlugin([chain.getter, chain.extractor, chain.analyzer, broken])
            const success = await combined.setup(ctx)
            expect(success).toBe(false)
            expect(eventLog).toHaveLength(3)
            expect(eventLog).toEqual([
                getEventName(chain.getter.name, 'setup'),
                getEventName(chain.extractor.name, 'setup'),
                getEventName(broken.name, 'setup'),
            ])
        })
        describe('Should fail if no extractor / analyzer / versionGetter found', () => {
            it('No extractor', async () => {
                const combined = new CombinedPlugin([chain.getter, chain.analyzer])
                const success = await combined.setup(ctx)
                expect(success).toBe(false)
                expect(eventLog).toHaveLength(0)
            })
            it('No analyzer', async () => {
                const combined = new CombinedPlugin([chain.getter, chain.extractor])
                const success = await combined.setup(ctx)
                expect(success).toBe(false)
                expect(eventLog).toHaveLength(0)
            })
            it('No versionGetter', async () => {
                const combined = new CombinedPlugin([chain.extractor, chain.analyzer])
                const success = await combined.setup(ctx)
                expect(success).toBe(false)
                expect(eventLog).toHaveLength(0)
            })
        })
        it('Should register plugins sequentially and override previously registered plugins, but run setup stage for all of them', async () => {
            const secondGetter = getFakeVersionGetter(eventLog)
            const secondExtractor = getFakeExtractor(eventLog)
            const secondAnalyzer = getFakeAnalyzer(eventLog)
            const combined = new CombinedPlugin([
                chain.analyzer,
                chain.extractor,
                secondAnalyzer,
                secondExtractor,
                chain.getter,
                secondGetter,
            ])
            const success = await combined.setup(ctx)
            expect(success).toBe(true)
            expect(combined.versionGetter?.name).toBe(secondGetter.name)
            expect(combined.extractor?.name).toBe(secondExtractor.name)
            expect(combined.analyzer?.name).toBe(secondAnalyzer.name)
            expect(eventLog).toHaveLength(4)
            expect(eventLog).toEqual([
                getEventName(chain.extractor.name, 'setup'),
                getEventName(secondExtractor.name, 'setup'),
                getEventName(chain.getter.name, 'setup'),
                getEventName(secondGetter.name, 'setup'),
            ])
        })
        it('Should register plugins sequentially and register multiple plugins for step if allowed', async () => {
            const combined = new CombinedPlugin(chain.all())
            const success = await combined.setup(ctx)
            expect(success).toBe(true)
            expect(combined.preparers).toEqual(chain.preparers)
            expect(combined.publishers).toEqual(chain.publishers)
            expect(combined.postPublishers).toEqual(chain.postPublishers)
            expect(eventLog).toEqual(
                chain
                    .all()
                    .filter((plugin) => plugin.setup)
                    .map((plugin) => getEventName(plugin.name, 'setup'))
            )
        })
    })
    describe('Other steps should call the corresponding method of the child plugin', () => {
        it('getLastRelease', async () => {
            const combined = new CombinedPlugin(chain.all())
            const setupSuccess = await combined.setup(ctx)
            expect(setupSuccess).toBe(true)
            expect(combined.versionGetter).toEqual(chain.getter)
            await combined.getLastRelease([], ctx)
            const stepLog = eventLog.filter((event) => event.includes('getLastRelease'))
            expect(stepLog).toEqual([getEventName(chain.getter.name, 'getLastRelease')])
        })
        it('extractCommits', async () => {
            const combined = new CombinedPlugin(chain.all())
            const setupSuccess = await combined.setup(ctx)
            expect(setupSuccess).toBe(true)
            expect(combined.extractor).toEqual(chain.extractor)
            const packageName = faker.string.alpha({ length: 20 })
            await combined.extractCommits({ name: packageName, location: process.cwd(), latestRelease: null }, ctx)
            const stepLog = eventLog.filter((event) => event.includes('extractCommits'))
            expect(stepLog).toEqual([getEventName(chain.extractor.name, 'extractCommits', packageName)])
        })
        it('getReleaseType', async () => {
            const combined = new CombinedPlugin(chain.all())
            const setupSuccess = await combined.setup(ctx)
            expect(setupSuccess).toBe(true)
            expect(combined.analyzer).toEqual(chain.analyzer)
            await combined.getReleaseType([], false, ctx)
            const stepLog = eventLog.filter((event) => event.includes('getReleaseType'))
            expect(stepLog).toEqual([getEventName(chain.analyzer.name, 'getReleaseType')])
        })
        it('prepare', async () => {
            const combined = new CombinedPlugin(chain.all())
            const setupSuccess = await combined.setup(ctx)
            expect(setupSuccess).toBe(true)
            expect(combined.preparers).toEqual(chain.preparers)

            const payload: PrepareAllInfo = {
                foundPackages: packages,
                changedPackages: packages,
            }

            await combined.prepareAll(payload, ctx)
            // console.log(eventLog)
            const stepLog = eventLog.filter((event) => event.includes('prepare'))
            const expectedLogs = combined.preparers.map((plugin) => {
                if (plugin.prepareAll) {
                    return [getEventName(plugin.name, 'prepareAll')]
                }

                return getExecutionOrder(payload.foundPackages).map((pkg) =>
                    getEventName(plugin.name, 'prepareSingle', pkg.name)
                )
            })
            expect(stepLog).toEqual(expectedLogs.flat())
        })
        it('publish', async () => {
            const combined = new CombinedPlugin(chain.all())
            const setupSuccess = await combined.setup(ctx)
            expect(setupSuccess).toBe(true)
            expect(combined.publishers).toEqual(chain.publishers)
            const packageName = faker.string.alpha({ length: 20 })
            await combined.publish({ name: packageName, location: process.cwd() }, ctx)
            const stepLog = eventLog.filter((event) => event.includes('publish'))
            expect(stepLog).toHaveLength(chain.publishers.length)
            expect(stepLog).toEqual(
                combined.publishers.map((plugin) => getEventName(plugin.name, 'publish', packageName))
            )
        })
        it('postPublish', async () => {
            const combined = new CombinedPlugin(chain.all())
            const setupSuccess = await combined.setup(ctx)
            expect(setupSuccess).toBe(true)
            expect(combined.postPublishers).toEqual(chain.postPublishers)
            const packageName = faker.string.alpha({ length: 20 })
            await combined.postPublish(
                {
                    name: packageName,
                    location: process.cwd(),
                    oldVersion: null,
                    releaseType: 'minor',
                    newVersion: { major: 1, minor: 0, patch: 0 },
                    commits: [],
                    bumpedDeps: [],
                },
                ctx
            )
            const stepLog = eventLog.filter((event) => event.includes('postPublish'))
            expect(stepLog).toHaveLength(chain.postPublishers.length)
            expect(stepLog).toEqual(
                combined.postPublishers.map((plugin) => getEventName(plugin.name, 'postPublish', packageName))
            )
        })
    })
})
