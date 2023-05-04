import { getAllPackages } from '@/utils/path'
import getLogger from '@/logger'

import type { MonoPubPlugin, MonoPubContext, MonoPubOptions } from '@/types'

export type * from '@/types'

export default async function publish(
    paths: Array<string>,
    _plugins: Array<MonoPubPlugin>,
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
        logger.info('No matching packages found. Exiting...')
        return
    }

    logger.success(
        `Found ${packages.length} packages to release: [${packages.map((pkg) => `"${pkg.name}"`).join(', ')}]`
    )
}
