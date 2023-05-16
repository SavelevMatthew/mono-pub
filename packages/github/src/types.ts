type CommitTypeRule = { type: string; section: string }
type BreakingRule = { breaking: boolean; section: string }
type DependencyRule = { dependency: boolean; section: string }

export type ReleaseNoteRule = CommitTypeRule | BreakingRule | DependencyRule

export type MonoPubGithubConfig = {
    envTokenKey: string
    extractCommitsFromSquashed: boolean
    tagFormat: string
    releaseNotesOptions: {
        rules: Array<ReleaseNoteRule>
        breakingNoteKeywords: Array<string>
    }
}
