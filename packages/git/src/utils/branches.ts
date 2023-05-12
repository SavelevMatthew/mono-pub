import execa from 'execa'

export async function getOriginUrl(cwd: string): Promise<string | null> {
    try {
        const { stdout } = await execa('git', ['config', '--get', 'remote.origin.url'], { cwd })
        return stdout
    } catch {
        return null
    }
}
