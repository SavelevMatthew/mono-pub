import { sync as syncParser } from 'conventional-commits-parser'
import get from 'lodash/get'
import { versionToString } from 'mono-pub/utils'

import type { CommitInfo, ReleasedPackageInfo } from 'mono-pub'
import type { ReleaseNoteRule } from '@/types'
import type { Options as ParserOptions } from 'conventional-commits-parser'
import type { Octokit } from '@octokit/rest'

const MAX_KIT_RESULTS = 100
const REPO_URL_REGEXP = /^.+[/:](?<owner>.+)\/(?<repo>.+?)(?:\..+)?$/
const PULL_HEADER_REGEXP = /\(#(?<pr>\d+)\)$/
const COMMIT_PARSER_OPTIONS: ParserOptions = {
    headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?(!?): (.*)$/,
    headerCorrespondence: ['type', 'scope', 'breakMark', 'subject'],
}

export type RepoInfo = {
    owner: string
    repo: string
}

export function extractRepoFromOriginUrl(repoUrl: string): RepoInfo | null {
    const match = REPO_URL_REGEXP.exec(repoUrl)
    if (!match?.groups) {
        return null
    }

    return {
        owner: match.groups.owner,
        repo: match.groups.repo,
    }
}

export function getPullFromCommit(commit: CommitInfo): number | null {
    const header = commit.message.split('\n')[0].trim()
    const match = PULL_HEADER_REGEXP.exec(header)
    if (match?.groups) {
        return parseInt(match.groups.pr)
    }

    return null
}

export async function extractPrCommits(
    repoInfo: RepoInfo,
    pr: number,
    packagePrefix: string,
    octokit: Octokit
): Promise<Array<CommitInfo>> {
    let previouslyFetched = MAX_KIT_RESULTS
    let pagesFetched = 0
    const prCommits: Array<CommitInfo> = []
    while (previouslyFetched === MAX_KIT_RESULTS) {
        const response = await octokit.rest.pulls.listCommits({
            ...repoInfo,
            pull_number: pr,
            per_page: MAX_KIT_RESULTS,
            page: pagesFetched + 1,
        })
        if (response.status !== 200) {
            throw new Error(`Could not fetch PR commits. Details: ${response.data}`)
        }
        const data = get(response, 'data', [])
        pagesFetched++
        previouslyFetched = data.length
        for (const commit of data) {
            const sha = commit.sha
            const originalAuthorName = get(commit.commit.author, 'name', '')
            const originalCommitterName = get(commit.commit.committer, 'name', '')
            const authorName = get(commit.author, 'login', originalAuthorName)
            const committerName = get(commit.committer, 'login', originalCommitterName)
            const message = commit.commit.message
            const commitResponse = await octokit.repos.getCommit({
                ...repoInfo,
                ref: sha,
            })
            if (response.status !== 200) {
                throw new Error(`Could not fetch commit info. Details: ${response.data}`)
            }
            const packageFilesAffected = (commitResponse.data.files ?? [])
                .map((file) => file.filename)
                .some((fileName) => fileName.startsWith(packagePrefix))
            if (!packageFilesAffected) {
                continue
            }
            prCommits.push({
                hash: sha,
                message,
                author: { name: authorName },
                committer: { name: committerName },
            })
        }
    }

    return prCommits
}

export function generateReleaseNotes(
    packageInfo: ReleasedPackageInfo,
    rules: Array<ReleaseNoteRule>,
    breakingNotes: Array<string> = ['BREAKING-CHANGE', 'BREAKING CHANGE']
): string {
    const parserOptions: ParserOptions = { ...COMMIT_PARSER_OPTIONS, noteKeywords: breakingNotes }
    const sections: Record<string, Array<string>> = {}
    for (const rule of rules) {
        sections[rule.section] = []
    }
    commitLoop: for (const commit of packageInfo.commits) {
        const parsedCommit = syncParser(commit.message, parserOptions)
        const baseMessage = parsedCommit.subject
            ? `${parsedCommit.scope ? `**${parsedCommit.scope}:** ` : ''}${parsedCommit.subject}`
            : commit.message.trim()
        const isBreakingCommit =
            parsedCommit.breakMark || parsedCommit.notes.some((note) => breakingNotes.includes(note.title))
        for (const rule of rules) {
            if ('breaking' in rule) {
                if (rule.breaking && isBreakingCommit) {
                    const commitNotes = parsedCommit.notes
                        .filter((note) => breakingNotes.includes(note.title))
                        .map((note) => note.text)
                    if (commitNotes.length) {
                        sections[rule.section].push(...commitNotes)
                        // NOTE: Breaking section can be part of big commit, which can be shown in another rule, so no continue here
                    } else {
                        sections[rule.section].push(baseMessage)
                        continue commitLoop
                    }
                } else if (!rule.breaking && !isBreakingCommit) {
                    sections[rule.section].push(baseMessage)
                    continue commitLoop
                }
            }
            if ('type' in rule && parsedCommit.type === rule.type) {
                sections[rule.section].push(baseMessage)
                continue commitLoop
            }
            if ('dependency' in rule && !rule.dependency) {
                sections[rule.section].push(baseMessage)
                continue commitLoop
            }
        }
    }

    const depsRule = rules.find((rule) => 'dependency' in rule && rule.dependency)
    if (depsRule) {
        sections[depsRule.section].push(
            ...packageInfo.bumpedDeps.map((bump) => {
                if (bump.oldVersion) {
                    return `**${bump.name}:** upgraded from ${versionToString(bump.oldVersion)} to ${versionToString(
                        bump.newVersion
                    )}`
                }

                return `**${bump.name}:** upgraded to ${versionToString(bump.newVersion)}`
            })
        )
    }

    const mentionedSections = new Set<string>()
    const lines: Array<string> = []
    for (const rule of rules) {
        if (mentionedSections.has(rule.section)) {
            continue
        }
        const notes = sections[rule.section]
        if (!notes?.length) {
            continue
        }
        lines.push(`### ${rule.section}`)
        lines.push(...notes.map((note) => `- ${note}`))
        mentionedSections.add(rule.section)
    }
    return lines.join('\n')
}
