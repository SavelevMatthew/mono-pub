import type { MonoPubContext } from './config'
import type { CommitInfo } from './commits'
import type {
    BasePackageInfo,
    LatestPackagesReleases,
    PackageInfoWithLatestRelease,
    ReleaseType,
    ReleasedPackageInfo,
    PackageInfoWithDependencies,
} from './packages'

type Awaitable<T> = T | Promise<T>

export type PrepareAllInfo = {
    /** All packages found by filter */
    foundPackages: Array<PackageInfoWithDependencies>
    /** Packages, which will actually be published */
    changedPackages: Array<PackageInfoWithDependencies>
}

export type PrepareSingleInfo = PrepareAllInfo & {
    targetPackage: BasePackageInfo
}

export interface MonoPubPlugin {
    /**
     * Name of plugin
     */
    name: string

    /**
     * Configures the plugin depending on the context and determines whether the plugin can be run successfully or not
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {Awaitable<boolean>} Returns true if plugin was set up successfully and ready ro run. False otherwise.
     */
    setup?(ctx: MonoPubContext): Awaitable<boolean>

    /**
     * Scans repo for latest release (usually using tags) and figures out latest release version of each package
     * @param packages {Array<BasePackageInfo>} List of packages containing its name and location (absolute path to package.json)
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {Awaitable<LatestPackagesReleases>} Object with packages names as keys and PackageVersion or null as values
     */
    getLastRelease?(packages: Array<BasePackageInfo>, ctx: MonoPubContext): Awaitable<LatestPackagesReleases>

    /**
     * Gets list of commits, which is relevant to package and happened after latest known release.
     * @param packageInfo {PackageInfoWithLatestRelease} Information about package containing "latestRelease" - latest released version
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {Array<string>} List of commits messages
     */
    extractCommits?(packageInfo: PackageInfoWithLatestRelease, ctx: MonoPubContext): Awaitable<Array<CommitInfo>>

    /**
     * Parses commits messages and determines release type ("major", "minor", "patch" or "none") based on them.
     * @param commits {Array<string>} commits messages
     * @param isDepsChanged {boolean} indicates if some of packages deps will be changed in current release,
     * so it can be bumped even if no relevant commits found
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {ReleaseType} type of release
     */
    getReleaseType?(commits: Array<CommitInfo>, isDepsChanged: boolean, ctx: MonoPubContext): Awaitable<ReleaseType>

    /**
     * Prepares packages for publishing. Usually includes build process.
     * Most suitable for scenarios in monorepos with existing orchestrator, such as TurboRepo,
     * where multiple packages can be built at once.
     * NOTE: This step is triggered once for all packages, not for each package individually
     * NOTE: You can get execution order with or without batches by using getExecutionOrder util from mono-pub/utils
     * @param info {PrepareAllInfo} Information about all packages found, as well as packages that will be published immediately.
     * List of packages containing its name and location (absolute path to package.json)
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {void}
     */
    prepareAll?(info: PrepareAllInfo, ctx: MonoPubContext): Awaitable<void>

    /**
     * Prepares individual package for publishing. Usually includes build process.
     * Most suitable for scenarios in monorepos without, where you can just execute "yarn build" one by one.
     * Order of execution is controlled for mono-pub, so you can ensure,
     * that all package dependencies are built before package itself
     * NOTE: This step is triggered once for all packages, not for each package individually
     * @param info {PrepareSingleInfo} Information about all packages found, packages that will be directly published,
     * and the current package being prepared
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {void}
     */
    prepareSingle?(info: PrepareSingleInfo, ctx: MonoPubContext): Awaitable<void>

    /**
     * Publishes package to a specific registry
     * @param packageInfo {BasePackageInfo} Package info containing its name and location (absolute path to package.json)
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     */
    publish?(packageInfo: BasePackageInfo, ctx: MonoPubContext): Awaitable<void>

    /**
     * Runs side effects after successful publishing.
     * Examples: mark HEAD with new tag, publish release notes, send webhooks.
     * @param packageInfo {ReleasedPackageInfo} information about released package
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     */
    postPublish?(packageInfo: ReleasedPackageInfo, ctx: MonoPubContext): Awaitable<void>
}
