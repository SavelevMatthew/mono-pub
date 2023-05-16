import { sync as syncParser } from 'conventional-commits-parser'
import { versionToString } from 'mono-pub/utils'

import type { CommitInfo, ReleasedPackageInfo } from 'mono-pub'
import type { ReleaseNoteRule } from '@/types'
import type { Options as ParserOptions } from 'conventional-commits-parser'

const REPO_URL_REGEXP = /^.+[/:](?<owner>.+)\/(?<repo>.+).git$/
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
    const match = repoUrl.match(REPO_URL_REGEXP)
    if (!match || !match.groups) {
        return null
    }

    return {
        owner: match.groups['owner'],
        repo: match.groups['repo'],
    }
}

export function getPullFromCommit(commit: CommitInfo): number | null {
    const header = commit.message.split('\n')[0].trim()
    const match = header.match(PULL_HEADER_REGEXP)
    if (match && match.groups) {
        return parseInt(match.groups['pr'])
    }

    return null
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
        if (!notes || !notes.length) {
            continue
        }
        lines.push(`### ${rule.section}`)
        lines.push(...notes.map((note) => `- ${note}`))
        mentionedSections.add(rule.section)
    }
    return lines.join('\n')
}
