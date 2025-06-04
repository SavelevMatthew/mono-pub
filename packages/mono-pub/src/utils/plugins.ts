import { getExecutionOrder } from '@/utils'

import type {
    MonoPubPlugin,
    MonoPubContext,
    BasePackageInfo,
    LatestPackagesReleases,
    PackageInfoWithLatestRelease,
    ReleaseType,
    CommitInfo,
    ReleasedPackageInfo,
    PrepareAllInfo,
} from '@/types'

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }
type WithSetup = WithRequired<MonoPubPlugin, 'setup'>
type WithGetLastRelease = WithRequired<MonoPubPlugin, 'getLastRelease'>
type WithExtractor = WithRequired<MonoPubPlugin, 'extractCommits'>
type WithAnalyzer = WithRequired<MonoPubPlugin, 'getReleaseType'>
type WithPrepare = WithRequired<MonoPubPlugin, 'prepareAll'> | WithRequired<MonoPubPlugin, 'prepareSingle'>
type WithPublish = WithRequired<MonoPubPlugin, 'publish'>
type WithPostPublish = WithRequired<MonoPubPlugin, 'postPublish'>

export class CombinedPlugin implements MonoPubPlugin {
    name = 'CombinedPlugin'
    allPlugins: Array<MonoPubPlugin>
    versionGetter?: WithGetLastRelease
    extractor?: WithExtractor
    analyzer?: WithAnalyzer
    neededSetup: Array<WithSetup> = []
    preparers: Array<WithPrepare> = []
    publishers: Array<WithPublish> = []
    postPublishers: Array<WithPostPublish> = []

    constructor(plugins: Array<MonoPubPlugin>) {
        this.allPlugins = plugins
    }

    _getStepMessage(step: string, plugin: MonoPubPlugin, prev?: MonoPubPlugin): string {
        if (prev) {
            return `Found "${step}" step of "${plugin.name}" plugin. Overriding previous one from "${prev.name}"`
        }
        return `Found "${step}" step of "${plugin.name}" plugin.`
    }

    async setup(ctx: MonoPubContext): Promise<boolean> {
        const logger = ctx.logger
        logger.log('Scanning received plugins')

        for (const plugin of this.allPlugins) {
            logger.log(`Scanning ${plugin.name} plugin`)

            if (plugin.setup) {
                logger.log(this._getStepMessage('setup', plugin))
                this.neededSetup.push(plugin as WithSetup)
            }
            if (plugin.getLastRelease) {
                logger.log(this._getStepMessage('getLastRelease', plugin, this.versionGetter))
                this.versionGetter = plugin as WithGetLastRelease
            }

            if (plugin.extractCommits) {
                logger.log(this._getStepMessage('extractCommits', plugin, this.extractor))
                this.extractor = plugin as WithExtractor
            }

            if (plugin.getReleaseType) {
                logger.log(this._getStepMessage('getReleaseType', plugin, this.analyzer))
                this.analyzer = plugin as WithAnalyzer
            }

            if (plugin.prepareAll || plugin.prepareSingle) {
                if (plugin.prepareAll && plugin.prepareSingle) {
                    logger.warn(
                        `Plugin "${plugin.name}" implements both "prepareAll" and "prepareSingle" methods, so only "prepareAll" be executed`
                    )
                } else if (plugin.prepareAll) {
                    logger.info(this._getStepMessage('prepareAll', plugin))
                } else {
                    logger.info(this._getStepMessage('prepareSingle', plugin))
                }

                this.preparers.push(plugin as WithPrepare)
            }

            if (plugin.publish) {
                logger.log(this._getStepMessage('publish', plugin))
                this.publishers.push(plugin as WithPublish)
            }

            if (plugin.postPublish) {
                logger.log(this._getStepMessage('postPublish', plugin))
                this.postPublishers.push(plugin as WithPostPublish)
            }
        }

        if (!this.versionGetter) {
            logger.error('No plugins with "getLastRelease" step found')
            return false
        }

        if (!this.extractor) {
            logger.error('No plugins with "extractCommits" step found')
            return false
        }

        if (!this.analyzer) {
            logger.error('No plugins with "getReleaseType" step found')
            return false
        }

        for (const plugin of this.neededSetup) {
            logger.log(`Running "setup" step of "${plugin.name}" plugin`)
            const success = await plugin.setup(ctx)
            if (!success) {
                logger.error(`Conditions for setting up plugin ${plugin.name} have not been met. Aborting`)
                return false
            }
        }

        logger.success('All plugins are set up and ready to use')

        return true
    }

    async getLastRelease(packages: Array<BasePackageInfo>, ctx: MonoPubContext): Promise<LatestPackagesReleases> {
        if (!this.versionGetter) {
            throw new Error('No versionGetter found. You should run setup step before this')
        }
        ctx.logger.info(`Running "getLastRelease" of "${this.versionGetter.name}" plugin`)
        return this.versionGetter.getLastRelease(packages, ctx)
    }

    async extractCommits(pkgInfo: PackageInfoWithLatestRelease, ctx: MonoPubContext): Promise<Array<CommitInfo>> {
        if (!this.extractor) {
            throw new Error('No extractor found. You should run setup step before this')
        }
        ctx.logger.log(`Running "extractCommits" of "${this.extractor.name}" plugin`)
        return this.extractor.extractCommits(pkgInfo, ctx)
    }

    async getReleaseType(
        commits: Array<CommitInfo>,
        isDepsChanged: boolean,
        ctx: MonoPubContext
    ): Promise<ReleaseType> {
        if (!this.analyzer) {
            throw new Error('No analyzer found. You should run setup step before this')
        }
        ctx.logger.log(`Running "getReleaseType" step of "${this.analyzer.name}" plugin`)
        return this.analyzer.getReleaseType(commits, isDepsChanged, ctx)
    }

    async prepareAll(info: PrepareAllInfo, ctx: MonoPubContext): Promise<void> {
        const executionOrder = getExecutionOrder(info.foundPackages, {
            ignoreDependencies: ctx.ignoreDependencies,
        })

        for (const plugin of this.preparers) {
            if (plugin.prepareAll) {
                ctx.logger.log(`Running "prepareAll" step of "${plugin.name}" plugin`)
                await plugin.prepareAll(info, ctx)
            } else if (plugin.prepareSingle) {
                for (const pkg of executionOrder) {
                    const scopedLogger = ctx.logger.scope(pkg.name)
                    const scopedContext = { ...ctx, logger: scopedLogger }

                    scopedLogger.log(`Running "prepareSingle" step of "${plugin.name}" plugin`)
                    await plugin.prepareSingle({ ...info, targetPackage: pkg }, scopedContext)
                }
            }
        }
    }

    async publish(packageInfo: BasePackageInfo, ctx: MonoPubContext): Promise<void> {
        ctx.logger.log('Starting to publish a package')
        for (const plugin of this.publishers) {
            ctx.logger.log(`Running "publish" step of "${plugin.name}" plugin`)
            await plugin.publish(packageInfo, ctx)
        }
    }

    async postPublish(packageInfo: ReleasedPackageInfo, ctx: MonoPubContext): Promise<void> {
        ctx.logger.log('Running postPublish side effects')
        for (const plugin of this.postPublishers) {
            ctx.logger.log(`Running "postPublish" step of "${plugin.name}" plugin`)
            await plugin.postPublish(packageInfo, ctx)
        }
    }
}
