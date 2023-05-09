import type { MonoPubContext } from './config'
import type { BasePackageInfo, LastReleaseInfo, ReleasePackageInfo, ReleaseType } from './packages'

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
     * @return {Awaitable<LastReleaseInfo>} Object with packages names as keys and PackageVersion or null as values
     */
    getLastRelease?(packages: Array<BasePackageInfo>, ctx: MonoPubContext): Awaitable<LastReleaseInfo>

    /**
     * Gets list of commits, which is relevant to package and happened after latest known release.
     * @param pkgInfo {ReleasePackageInfo} Information about package containing "lastRelease" - latest released version
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {Array<string>} List of commits messages
     */
    extractCommits?(pkgInfo: ReleasePackageInfo, ctx: MonoPubContext): Awaitable<Array<string>>

    /**
     * Parse commits messages and determines release type ("major", "minor", "patch" or "none") based on them.
     * @param commits {Array<string>} commits messages
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {ReleaseType} type of release
     */
    getReleaseType?(commits: Array<string>, ctx: MonoPubContext): Awaitable<ReleaseType>
}
