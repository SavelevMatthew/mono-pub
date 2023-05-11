import type { ReleaseType } from 'mono-pub'

export type CommitAnalyzerConfig = {
    majorTypes: Array<string>
    minorTypes: Array<string>
    patchTypes: Array<string>
    breakingNoteKeywords: Array<string>
    depsBumpReleaseType: ReleaseType
}

export const DEFAULT_CONFIG: CommitAnalyzerConfig = {
    majorTypes: [],
    minorTypes: ['feat'],
    patchTypes: ['fix', 'perf'],
    breakingNoteKeywords: ['BREAKING CHANGE', 'BREAKING-CHANGE'],
    depsBumpReleaseType: 'patch',
}
