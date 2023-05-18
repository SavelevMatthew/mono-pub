import { Octokit } from '@octokit/rest'
import { name } from '../package.json'
import { extractRepoFromOriginUrl, getPullFromCommit, generateReleaseNotes, extractPrCommits } from '@/utils'
import { getOriginUrl, getTagFromVersion, getAllPackageCommits, DEFAULT_TAG_FORMAT } from '@mono-pub/git/utils'
import path from 'path'

import type {
    MonoPubPlugin,
    MonoPubContext,
    PackageInfoWithLatestRelease,
    CommitInfo,
    ReleasedPackageInfo,
} from 'mono-pub'
import type { RepoInfo } from '@/utils'
import type { Octokit as OctoType } from '@octokit/rest'
import type { MonoPubGithubConfig } from '@/types'

export type * from '@/types'

const DEFAULT_CONFIG: MonoPubGithubConfig = {
    envTokenKey: 'GITHUB_TOKEN',
    extractCommitsFromSquashed: true,
    tagFormat: DEFAULT_TAG_FORMAT,
    releaseNotesOptions: {
        rules: [
            { breaking: true, section: 'BREAKING CHANGES' },
            { type: 'feat', section: 'New features' },
            { type: 'fix', section: 'Bug fixes' },
            { dependency: true, section: 'Dependencies' },
        ],
        breakingNoteKeywords: ['BREAKING-CHANGE', 'BREAKING CHANGE'],
    },
}

class MonoPubGithub implements MonoPubPlugin {
    name = name
    readonly config = DEFAULT_CONFIG
    private repoInfo: RepoInfo = { repo: '', owner: '' }
    private octokit?: OctoType

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
        this.octokit = new Octokit({
            auth: ghToken,
        })
        return true
    }

    async extractCommits(packageInfo: PackageInfoWithLatestRelease, ctx: MonoPubContext): Promise<Array<CommitInfo>> {
        if (!this.octokit) {
            ctx.logger.error('Setup step was not successful!')
            throw new Error('No octokit initialized. Probably because setup step was not run correctly')
        }
        const packageDir = path.dirname(path.relative(ctx.cwd, packageInfo.location))
        const latestRelease = packageInfo.latestRelease
        const latestTag = latestRelease
            ? getTagFromVersion(this.config.tagFormat, packageInfo.name, latestRelease)
            : null
        const originalCommits = await getAllPackageCommits({ pkgInfo: packageInfo, fromTag: latestTag, cwd: ctx.cwd })
        if (!this.config.extractCommitsFromSquashed) {
            return originalCommits
        }
        const commits: Array<CommitInfo> = []
        for (const commit of originalCommits) {
            const prNumber = getPullFromCommit(commit)
            if (prNumber === null) {
                commits.push(commit)
                continue
            }

            const prCommits = await extractPrCommits(this.repoInfo, prNumber, packageDir, this.octokit)
            commits.push(...prCommits)
        }

        return commits
    }

    async postPublish(packageInfo: ReleasedPackageInfo, ctx: MonoPubContext): Promise<void> {
        if (!this.octokit) {
            ctx.logger.error('Setup step was not successful!')
            throw new Error('No octokit initialized. Probably because setup step was not run correctly')
        }
        ctx.logger.log('Generating release notes')
        const notes = generateReleaseNotes(
            packageInfo,
            this.config.releaseNotesOptions.rules,
            this.config.releaseNotesOptions.breakingNoteKeywords
        )
        ctx.logger.log('Publishing release notes')
        const newTag = getTagFromVersion(this.config.tagFormat, packageInfo.name, packageInfo.newVersion)
        const response = await this.octokit.rest.repos.createRelease({
            ...this.repoInfo,
            tag_name: newTag,
            name: newTag,
            body: notes,
        })
        if (response.status !== 201) {
            ctx.logger.error('Could not publish release notes')
            ctx.logger.error(response.data)
            throw new Error('Release notes publishing failed')
        }
    }
}

/**
 * Creates MonoPubGithub plugin
 * @param [config] {Partial<MonoPubGithubConfig>}
 * @return {MonoPubPlugin}
 */
export default function github(config?: Partial<MonoPubGithubConfig>) {
    return new MonoPubGithub(config)
}
