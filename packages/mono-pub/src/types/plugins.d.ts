import type { MonoPubContext } from './config'
import type { BasePackageInfo, LastReleaseInfo } from './packages'

export interface MonoPubPlugin {
    /**
     * Name of plugin
     */
    name: string

    /**
     * Configures the plugin depending on the context and determines whether the plugin can be run successfully or not
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {boolean} Returns true if plugin was set up successfully and ready ro run. False otherwise.
     */
    setup?(ctx: MonoPubContext): boolean

    /**
     * Scans repo for latest release (usually using tags) and figures out latest release version of each package
     * @param packages {Array<BasePackageInfo>} List of packages containing its name and location (absolute path to package.json)
     * @param ctx {MonoPubContext} Execution context. Used to obtain cwd, env and logger
     * @return {LastReleaseInfo<(typeof packages)[number]['name']>} Object with packages names as keys and PackageVersion or null as values
     */
    getLastRelease?(
        packages: Array<BasePackageInfo>,
        ctx: MonoPubContext
    ): LastReleaseInfo<(typeof packages)[number]['name']>
}
