import { getAllPackages } from '@/utils/path'
import getLogger from '@/logger'
import { CombinedPlugin } from '@/utils/plugins'

import type { MonoPubPlugin, MonoPubContext, MonoPubOptions } from '@/types'

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
    logger.success(
        `Found ${plugins.length} to form release chain: [${plugins.map((plugin) => `"${plugin.name}"`).join(', ')}]`
    )
    logger.log('Starting the process of assembling the release chain')
    const releaseChain = new CombinedPlugin(plugins)
    const success = await releaseChain.setup(context)
    if (!success) {
        process.exit(1)
    }
}
