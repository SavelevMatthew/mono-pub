import path from 'path'
import execa from 'execa'
import type { BasePackageInfo } from 'mono-pub'

const COMMIT_SPLIT_REGEXP = /(?:\n\n\n|^)commit [a-z0-9]{40}\n/g

export async function getAllPackageCommitsInRange(
    pkgInfo: BasePackageInfo,
    from: string | null,
    to: string,
    cwd: string
) {
    const packageDirectory = path.dirname(path.relative(cwd, pkgInfo.location))
    const range = from ? `${from}..${to}` : to
    const { stdout } = await execa('git', ['rev-list', '--format=%B%n%n%n', range, '--', packageDirectory], { cwd })
    const messages = stdout.split(COMMIT_SPLIT_REGEXP)
    messages.shift()

    return messages.map((msg) => msg.trim())
}

export async function getAllPackageCommits(pkgInfo: BasePackageInfo, fromTag: string | null, cwd: string) {
    return await getAllPackageCommitsInRange(pkgInfo, fromTag, 'HEAD', cwd)
}
