import { Octokit } from '@octokit/rest'
import get from 'lodash/get'
import { name } from '../package.json'
import { extractRepoFromOriginUrl, getPullFromCommit } from '@/utils'
import { getOriginUrl, getTagFromVersion, getAllPackageCommits, getAllPackageCommitsInRange } from '@mono-pub/git/utils'
import type { MonoPubPlugin, MonoPubContext, PackageInfoWithLatestRelease } from 'mono-pub'
import type { RepoInfo } from '@/utils'
import type { Octokit as OctoType } from '@octokit/rest'

type MonoPubGithubConfig = {
    envTokenKey: string
    extractCommitsFromSquashed: boolean
    tagFormat: string
}

const DEFAULT_CONFIG: MonoPubGithubConfig = {
    envTokenKey: 'GITHUB_TOKEN',
    extractCommitsFromSquashed: true,
    tagFormat: '{name}@{version}',
}

class MonoPubGithub implements MonoPubPlugin {
    name = name
    config = DEFAULT_CONFIG
    repoInfo: RepoInfo = { repo: '', owner: '' }
    #octokit?: OctoType

    constructor(config?: Partial<MonoPubGithubConfig>) {
        this.config = { ...this.config, ...config }
    }

    async setup(ctx: MonoPubContext): Promise<boolean> {
        const ghToken = ctx.env[this.config.envTokenKey]
        if (!ghToken) {
            ctx.logger.error(
                `No github auth token found in mono-pub environment (key: "${this.config.envTokenKey}"). ` +
                    `Make sure you specified it in env and provided "envTokenKey" in plugin config in case it is stored not under "${DEFAULT_CONFIG.envTokenKey}" key`
            )
            return false
        }

        const originUrl = await getOriginUrl(ctx.cwd)
        if (!originUrl) {
            ctx.logger.error('No origin url on current repo was found')
            return false
        }
        const repoInfo = extractRepoFromOriginUrl(originUrl)
        if (!repoInfo) {
            ctx.logger.error('Could not extract repo information from "remote.origin.url"')
            return false
        }
        this.repoInfo = repoInfo
        this.#octokit = new Octokit({
            auth: ghToken,
        })
        return true
    }

    async extractCommits(packageInfo: PackageInfoWithLatestRelease, ctx: MonoPubContext): Promise<Array<string>> {
        if (!this.#octokit) {
            ctx.logger.error('Setup step was not successful!')
            throw new Error('No octokit initialized. Probably because setup step was not run correctly')
        }
        const latestRelease = packageInfo.latestRelease
        const latestTag = latestRelease
            ? getTagFromVersion(this.config.tagFormat, packageInfo.name, latestRelease)
            : null
        const originalCommits = await getAllPackageCommits(packageInfo, latestTag, ctx.cwd)
        if (!this.config.extractCommitsFromSquashed) {
            return originalCommits
        }
        const commits: Array<string> = []
        for (const commit of originalCommits) {
            const prNumber = getPullFromCommit(commit)
            if (prNumber === null) {
                commits.push(commit)
                continue
            }
            const pr = await this.#octokit.rest.pulls.get({
                ...this.repoInfo,
                pull_number: prNumber,
            })
            const baseSha = get(pr, ['data', 'base', 'sha'], null)
            const headSha = get(pr, ['data', 'head', 'sha'], null)
            if (pr.status !== 200 || !baseSha || !headSha) {
                ctx.logger.error('Could not extract PR info from commit header')
                throw new Error('Could not extract PR info from commit header')
            }
            const prCommits = await getAllPackageCommitsInRange(packageInfo, baseSha, headSha, ctx.cwd)
            commits.push(...prCommits)
        }

        return commits
    }
}

export default function github() {
    return new MonoPubGithub()
}
