import { name } from '../package.json'
import { sync as syncParser } from 'conventional-commits-parser'
import { DEFAULT_CONFIG } from '@/config'
import { getMostImportantType } from '@/utils'
import type { CommitAnalyzerConfig } from '@/config'
import type { Options as ParserOptions } from 'conventional-commits-parser'
import type { MonoPubPlugin, ReleaseType } from 'mono-pub'

class MonoPubCommitAnalyzer implements MonoPubPlugin {
    name = name
    parserOptions: ParserOptions = {
        headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?(!?): (.*)$/,
        headerCorrespondence: ['type', 'scope', 'breakMark', 'subject'],
    }

    config: CommitAnalyzerConfig = DEFAULT_CONFIG

    constructor(config?: Partial<CommitAnalyzerConfig>) {
        if (config) {
            this.config = { ...this.config, ...config }
        }
        this.parserOptions.noteKeywords = this.config.breakingNoteKeywords
    }

    getReleaseType(commits: Array<string>, isDepsChanged: boolean): ReleaseType {
        let releaseType: ReleaseType = isDepsChanged ? this.config.depsBumpReleaseType : 'none'

        for (const commit of commits) {
            const parsedCommit = syncParser(commit, this.parserOptions)
            if (
                parsedCommit.breakMark ||
                parsedCommit.notes.some((note) => this.config.breakingNoteKeywords.includes(note.title))
            ) {
                return 'major'
            }

            const commitType = parsedCommit.type

            if (!commitType) {
                continue
            }

            if (this.config.majorTypes.includes(commitType)) {
                return 'major'
            } else if (this.config.minorTypes.includes(commitType)) {
                releaseType = getMostImportantType(releaseType, 'minor')
            } else if (this.config.patchTypes.includes(commitType)) {
                releaseType = getMostImportantType(releaseType, 'patch')
            }
        }

        return releaseType
    }
}

export default function commitAnalyzer(config?: Partial<CommitAnalyzerConfig>) {
    return new MonoPubCommitAnalyzer(config)
}
