import type { MonoPubContext } from './config'
import type {
    BasePackageInfo,
    LatestPackagesReleases,
    PackageInfoWithLatestRelease,
    ReleaseType,
    ReleasedPackageInfo,
} from './packages'

type Awaitable<T> = T | Promise<T>

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
    extractCommits?(packageInfo: PackageInfoWithLatestRelease, ctx: MonoPubContext): Awaitable<Array<string>>

    /**
     * Parses commits messages and determines release type ("major", "minor", "patch" or "none") based on them.
     * @param commits {Array<string>} commits messages
     * @param isDepsChanged {boolean} indicates if some of packages deps will be changed in current release,
     * so it can be bumped even if no relevant commits found
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {ReleaseType} type of release
     */
    getReleaseType?(commits: Array<string>, isDepsChanged: boolean, ctx: MonoPubContext): Awaitable<ReleaseType>

    /**
     * Prepares packages for publishing. Usually includes build process.
     * NOTE: This step is triggered once for all packages, not for each package individually
     * @param packages {Array<BasePackageInfo>} List of packages containing its name and location (absolute path to package.json)
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {void}
     */
    prepare?(packages: Array<BasePackageInfo>, ctx: MonoPubContext): Awaitable<void>

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
