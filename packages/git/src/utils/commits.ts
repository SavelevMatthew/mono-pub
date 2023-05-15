import path from 'path'
import execa from 'execa'
import crypto from 'crypto'
import type { BasePackageInfo, CommitInfo } from 'mono-pub'

const AUTHOR_COMMIT_PART = '%aN'
const COMMITTER_COMMIT_PART = '%cN'
const COMMIT_PART = '%B'
const COMMIT_UNIQUE_SEPARATOR = crypto.randomBytes(20).toString('hex')
const COMMIT_LOG_FORMAT = `${AUTHOR_COMMIT_PART}%n${COMMITTER_COMMIT_PART}%n${COMMIT_PART}%n%n%n${COMMIT_UNIQUE_SEPARATOR}`

export function parseCommitMessage(formattedMsg: string): CommitInfo {
    const lines = formattedMsg.trim().split('\n')
    const hash = lines[0].split(' ')[1]
    return {
        hash,
        author: { name: lines[1] },
        committer: { name: lines[2] },
        message: lines.slice(3).join('\n').trim(),
    }
}
//
export async function getAllPackageCommitsInRange(options: {
    pkgInfo: BasePackageInfo
    from?: string | null
    to: string
    cwd: string
}): Promise<Array<CommitInfo>> {
    const { pkgInfo, to, from, cwd } = options
    const packageDirectory = path.dirname(path.relative(cwd, pkgInfo.location))
    const range = from ? `${from}..${to}` : to
    const { stdout } = await execa(
        'git',
        ['rev-list', `--format=${COMMIT_LOG_FORMAT}`, range, '--', packageDirectory],
        {
            cwd,
        }
    )
    const splitRegexp = new RegExp(`\n\n\n${COMMIT_UNIQUE_SEPARATOR}\n`)
    const messages = stdout.split(splitRegexp)

    return messages.filter(Boolean).map(parseCommitMessage)
}

export async function getAllPackageCommits(options: {
    pkgInfo: BasePackageInfo
    fromTag?: string | null
    cwd: string
}): Promise<Array<CommitInfo>> {
    return await getAllPackageCommitsInRange({
        pkgInfo: options.pkgInfo,
        cwd: options.cwd,
        from: options.fromTag,
        to: 'HEAD',
    })
}
