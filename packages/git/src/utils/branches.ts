import execa from 'execa'

/**
 * Extracts remote origin url from local git config
 * @param cwd {string} Repo root directory
 */
export async function getOriginUrl(cwd: string): Promise<string | null> {
    try {
        const { stdout } = await execa('git', ['config', '--get', 'remote.origin.url'], { cwd })
        return stdout
    } catch {
        return null
    }
}
