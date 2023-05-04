import type { MonoPubPlugin, MonoPubContext, BasePackageInfo, LastReleaseInfo } from '@/types'

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }
type WithSetup = WithRequired<MonoPubPlugin, 'setup'>
type WithGetLastRelease = WithRequired<MonoPubPlugin, 'getLastRelease'>

export class CombinedPlugin implements MonoPubPlugin {
    name = 'CombinedPlugin'
    allPlugins: Array<MonoPubPlugin>
    versionGetter?: WithGetLastRelease
    neededSetup: Array<WithSetup> = []

    constructor(plugins: Array<MonoPubPlugin>) {
        this.allPlugins = plugins
    }

    async setup(ctx: MonoPubContext): Promise<boolean> {
        const logger = ctx.logger
        logger.log('Scanning received plugins')

        for (const plugin of this.allPlugins) {
            logger.log(`Scanning ${plugin.name} plugin`)
            if (plugin && plugin.setup) {
                logger.log(`Found "setup" step on "${plugin.name}" plugin`)
                this.neededSetup.push(plugin as WithSetup)
            }
            if (plugin.getLastRelease) {
                if (this.versionGetter) {
                    logger.log(
                        `Found "getLastRelease" step of "${plugin.name}" plugin. Overriding previous one from "${this.versionGetter.name}"`
                    )
                    this.versionGetter = plugin as WithGetLastRelease
                } else {
                    logger.log(`Found "getLastRelease" step of "${plugin.name}" plugin`)
                }
            }
        }

        if (!this.versionGetter) {
            logger.error('No plugins with "getLastRelease" step found')
            return false
        }

        for (const plugin of this.neededSetup) {
            logger.log(`Running "setup" step of "${plugin.name}" plugin`)
            const success = await plugin.setup(ctx)
            if (!success) {
                return false
            }
        }

        return true
    }

    async getLastRelease(packages: Array<BasePackageInfo>, ctx: MonoPubContext): Promise<LastReleaseInfo> {
        if (!this.versionGetter) {
            throw new Error('No versionGetter found. You should run setup step before this')
        }
        ctx.logger.info(`Running "getLastRelease" of "${this.versionGetter.name}" plugin`)
        return this.versionGetter.getLastRelease(packages, ctx)
    }
}
