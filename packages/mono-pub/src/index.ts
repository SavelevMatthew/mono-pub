import get from 'lodash/get'
import { getAllPackages } from '@/utils/path'
import getLogger from '@/logger'
import { CombinedPlugin } from '@/utils/plugins'
import { getDependencies, getReleaseOrder, patchPackageDeps } from '@/utils/deps'
import { getNewVersion, versionToString } from '@/utils/versions'

import type {
    MonoPubPlugin,
    MonoPubContext,
    MonoPubOptions,
    DependenciesPackageInfo,
    ReleaseType,
    PackageVersion,
} from '@/types'

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
    const packagesInfo = Object.assign({}, ...packages.map((pkg) => ({ [pkg.name]: pkg })))
    if (!packages.length) {
        logger.success('No matching packages found. Exiting...')
        return
    }
    const scopedContexts: Record<string, MonoPubContext> = Object.assign(
        {},
        ...packages.map((pkg) => ({
            [pkg.name]: {
                ...context,
                logger: logger.scope(pkg.name),
            },
        }))
    )

    logger.success(
        `Found ${packages.length} packages to release: [${packages.map((pkg) => `"${pkg.name}"`).join(', ')}]`
    )
    logger.log('Calculating release order based on packages dependencies and devDependencies...')
    let packagesWithDeps: Record<string, DependenciesPackageInfo> = {}
    let releaseOrder: Array<string> = []

    try {
        packagesWithDeps = await getDependencies(packages)
        releaseOrder = getReleaseOrder(packagesWithDeps)
    } catch (err) {
        if (err instanceof Error) {
            logger.error(err.message)
        }
        throw err
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
        throw new Error('Setup was not successful')
    }
    logger.log('Searching for the latest releases...')
    const latestReleases = await releaseChain.getLastRelease(packages, context)
    for (const [packageName, release] of Object.entries(latestReleases)) {
        if (!release) {
            scopedContexts[packageName].logger.log('No previous releases found...')
        } else {
            scopedContexts[packageName].logger.log(
                `Found latest release version: ${release.major}.${release.minor}.${release.patch}`
            )
        }
    }

    const newCommits: Record<string, Array<string>> = {}
    const releaseTypes: Record<string, ReleaseType> = {}
    const newVersions: Record<string, PackageVersion> = {}

    for (const pkgName of releaseOrder) {
        const scopedLogger = scopedContexts[pkgName].logger
        const commits = await releaseChain.extractCommits(
            { ...packagesInfo[pkgName], lastRelease: get(latestReleases, pkgName, null) },
            scopedContexts[pkgName]
        )
        scopedLogger.info(`Found ${commits.length} commits since last release`)
        newCommits[pkgName] = commits
        const isDepsChanged = packagesWithDeps[pkgName].dependsOn.some((dep) => releaseTypes[dep.name] !== 'none')
        const releaseType = await releaseChain.getReleaseType(commits, isDepsChanged, scopedContexts[pkgName])
        releaseTypes[pkgName] = releaseType
        if (releaseType === 'none') {
            scopedLogger.info('There are no relevant changes, so no new version is released')
            continue
        }
        const lastRelease = get(latestReleases, pkgName, null)
        const newVersion = getNewVersion(lastRelease, releaseType)
        newVersions[pkgName] = newVersion
        if (lastRelease) {
            scopedLogger.info(
                `Release type was defined as "${releaseType}". So the next release version is ${versionToString(
                    newVersion
                )}`
            )
        } else {
            scopedLogger.info(
                `The next release version is ${versionToString(newVersion)}, since package has no previous releases`
            )
        }
    }
    logger.log('Patching package.json files with new versions')
    for (const pkg of Object.values(packagesWithDeps)) {
        await patchPackageDeps(pkg, newVersions)
    }

    await releaseChain.prepare(packages, context)
}
