import { getAllPackages } from '@/utils/path'
import getLogger from '@/logger'
import { CombinedPlugin } from '@/utils/plugins'
import { getDependencies, getReleaseOrder } from '@/utils/deps'

import type { MonoPubPlugin, MonoPubContext, MonoPubOptions, DependenciesPackageInfo } from '@/types'

export type * from '@/types'

/**
 *
 * @param paths {Array<string>} List of globes or paths to packages that need to be released
 * @param plugins {Array<string>} List
 * @param options
 */
export default async function publish(
    paths: Array<string>,
    plugins: Array<MonoPubPlugin>,
    options: MonoPubOptions = {}
) {
    const { stdout = process.stdout, stderr = process.stderr, ...restOptions } = options
    const logger = getLogger({ stdout, stderr })
    const context: MonoPubContext = {
        cwd: process.cwd(),
        env: process.env,
        ...restOptions,
        logger,
    }

    logger.info('Starting releasing process...')
    const packages = await getAllPackages(paths, context.cwd)
    if (!packages.length) {
        logger.success('No matching packages found. Exiting...')
        return
    }

    logger.success(
        `Found ${packages.length} packages to release: [${packages.map((pkg) => `"${pkg.name}"`).join(', ')}]`
    )
    logger.log('Calculating release order based on packages dependencies and devDependencies...')
    let packagesWithDeps: Array<DependenciesPackageInfo> = []
    let releaseOrder: Array<string> = []

    try {
        packagesWithDeps = await getDependencies(packages)
        releaseOrder = getReleaseOrder(packagesWithDeps)
    } catch (err) {
        if (err instanceof Error) {
            logger.error(err.message)
        }
        process.exit(1)
    }

    logger.success(`Packages release order: [${releaseOrder.map((pkg) => `"${pkg}"`).join(', ')}]`)

    logger.success(
        `Found ${plugins.length} plugins to form release chain: [${plugins
            .map((plugin) => `"${plugin.name}"`)
            .join(', ')}]`
    )
    logger.log('Starting the process of assembling the release chain')
    const releaseChain = new CombinedPlugin(plugins)
    const success = await releaseChain.setup(context)
    if (!success) {
        process.exit(1)
    }
    logger.log('Searching for the latest releases...')
    const latestReleases = await releaseChain.getLastRelease(packages, context)
    for (const [packageName, release] of Object.entries(latestReleases)) {
        if (!release) {
            logger.scope(packageName).log('No releases found...')
        } else {
            logger
                .scope(packageName)
                .log(`Found latest release version: ${release.major}.${release.minor}.${release.patch}`)
        }
    }
}
