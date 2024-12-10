import get from 'lodash/get'
import isEqual from 'lodash/isEqual'
import { getAllPackages } from '@/utils/path'
import getLogger from '@/logger'
import { CombinedPlugin } from '@/utils/plugins'
import { getDependencies, getExecutionOrder, patchPackageDeps } from '@/utils/deps'
import { getNewVersion, versionToString, isPackageChanged } from '@/utils/versions'

import type {
    MonoPubPlugin,
    MonoPubContext,
    MonoPubOptions,
    PackageInfoWithDependencies,
    ReleaseType,
    CommitInfo,
    BumpedDep,
    ReleasedPackageInfo,
    BasePackageInfo,
    LatestReleasedVersion,
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
    const packagesInfo: Record<string, BasePackageInfo> = Object.assign(
        {},
        ...packages.map((pkg) => ({ [pkg.name]: pkg }))
    )
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
    let packagesWithDeps: Record<string, PackageInfoWithDependencies> = {}
    let releaseOrder: Array<BasePackageInfo> = []

    try {
        packagesWithDeps = await getDependencies(packages)
        releaseOrder = getExecutionOrder(Object.values(packagesWithDeps))
    } catch (err) {
        if (err instanceof Error) {
            logger.error(err.message)
        }
        throw err
    }

    logger.success(`Packages release order: [${releaseOrder.map((pkg) => `"${pkg.name}"`).join(', ')}]`)

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

    const newCommits: Record<string, Array<CommitInfo>> = {}
    const releaseTypes: Record<string, ReleaseType> = {}
    const newVersions: Record<string, LatestReleasedVersion> = {}

    for (const { name: pkgName } of releaseOrder) {
        const scopedLogger = scopedContexts[pkgName].logger

        const latestRelease = get(latestReleases, pkgName, null)
        const commits = await releaseChain.extractCommits(
            { ...packagesInfo[pkgName], latestRelease },
            scopedContexts[pkgName]
        )
        scopedLogger.info(`Found ${commits.length} commits since last release`)
        newCommits[pkgName] = commits

        const isDepsChanged = packagesWithDeps[pkgName].dependsOn.some((dep) => releaseTypes[dep.name] !== 'none')

        const releaseType = await releaseChain.getReleaseType(commits, isDepsChanged, scopedContexts[pkgName])
        const newVersion = getNewVersion(latestRelease, releaseType)
        releaseTypes[pkgName] = releaseType
        newVersions[pkgName] = newVersion

        if (!newVersion || releaseType === 'none') {
            scopedLogger.info("There are no relevant changes found, so no new version won't be released")
        } else if (latestRelease) {
            scopedLogger.info(
                `Found "${releaseType}" relevant changes since latest released version ("${versionToString(
                    latestRelease
                )}"). So the next version of the package is "${versionToString(newVersion)}"`
            )
        } else {
            scopedLogger.info(
                `Package has no previous releases, but "${releaseType}" relevant changes found, that's why package will be released under "${versionToString(
                    newVersion
                )} version"`
            )
        }
    }

    for (const pkg of Object.values(packagesWithDeps)) {
        if (releaseTypes[pkg.name] === 'none') {
            continue
        }
        scopedContexts[pkg.name].logger.log('Patching package.json with a new version criteria')
        await patchPackageDeps(pkg, newVersions, latestReleases)
    }

    const foundPackages = Object.values(packagesWithDeps)
    const changedPackages = foundPackages.filter(({ name }) => {
        const newVersion = newVersions[name]
        const releaseType = releaseTypes[name]
        const oldVersion = latestReleases[name]

        return isPackageChanged(newVersion, oldVersion, releaseType)
    })

    await releaseChain.prepareAll(
        {
            foundPackages,
            changedPackages,
        },
        context
    )

    for (const { name: packageName } of releaseOrder) {
        const newVersion = newVersions[packageName]
        const releaseType = releaseTypes[packageName]
        const oldVersion = latestReleases[packageName]
        if (!isPackageChanged(newVersion, oldVersion, releaseType)) {
            continue
        }

        await releaseChain.publish(packagesInfo[packageName], scopedContexts[packageName])

        const bumpedDeps: Array<BumpedDep> = []

        for (const dep of packagesWithDeps[packageName].dependsOn) {
            const depOldVersion = latestReleases[dep.name]
            const depNewVersion = newVersions[dep.name]
            const depReleaseType = releaseTypes[dep.name]
            if (!depNewVersion || isEqual(depNewVersion, depOldVersion) || depReleaseType === 'none') {
                continue
            }
            bumpedDeps.push({
                ...packagesInfo[dep.name],
                oldVersion: depOldVersion,
                newVersion: depNewVersion,
                releaseType: depReleaseType,
            })
        }

        const releasedPackageInfo: ReleasedPackageInfo = {
            ...packagesInfo[packageName],
            oldVersion,
            newVersion,
            releaseType,
            commits: newCommits[packageName],
            bumpedDeps,
        }
        await releaseChain.postPublish(releasedPackageInfo, scopedContexts[packageName])
        scopedContexts[packageName].logger.success('Package is successfully published!')
    }
}
