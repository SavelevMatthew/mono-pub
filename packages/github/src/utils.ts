const REPO_URL_REGEXP = /^.+[\/:](?<owner>.+)\/(?<repo>.+).git$/
const PULL_HEADER_REGEXP = /\(#(?<pr>\d+)\)$/

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

export function getPullFromCommit(commit: string): number | null {
    const header = commit.split('\n')[0].trim()
    const match = header.match(PULL_HEADER_REGEXP)
    if (match && match.groups) {
        return parseInt(match.groups['pr'])
    }

    return null
}
