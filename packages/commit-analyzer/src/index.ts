import { name } from '../package.json'
import { sync as syncParser } from 'conventional-commits-parser'
import { DEFAULT_CONFIG } from '@/config'
import { getMostImportantType } from '@/utils'
import type { CommitAnalyzerConfig } from '@/config'
import type { Options as ParserOptions } from 'conventional-commits-parser'
import type { CommitInfo, MonoPubPlugin, ReleaseType } from 'mono-pub'

class MonoPubCommitAnalyzer implements MonoPubPlugin {
    name = name
    private readonly parserOptions: ParserOptions = {
        headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?(!?): (.*)$/,
        headerCorrespondence: ['type', 'scope', 'breakMark', 'subject'],
    }

    readonly config: CommitAnalyzerConfig = DEFAULT_CONFIG

    constructor(config?: Partial<CommitAnalyzerConfig>) {
        if (config) {
            this.config = { ...this.config, ...config }
        }
        this.parserOptions.noteKeywords = this.config.breakingNoteKeywords
    }

    getReleaseType(commits: Array<CommitInfo>, isDepsChanged: boolean): ReleaseType {
        let releaseType: ReleaseType = isDepsChanged ? this.config.depsBumpReleaseType : 'none'

        for (const commit of commits) {
            const parsedCommit = syncParser(commit.message, this.parserOptions)

            const commitType = parsedCommit.type
            if (!commitType) {
                continue
            }

            if (
                parsedCommit.breakMark ||
                parsedCommit.notes.some((note) => this.config.breakingNoteKeywords.includes(note.title))
            ) {
                return 'major'
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

/**
 * Creates MonoPubCommitAnalyzer plugin
 * @param [config] {Partial<CommitAnalyzerConfig>}
 * @return {MonoPubPlugin}
 */
export default function commitAnalyzer(config?: Partial<CommitAnalyzerConfig>) {
    return new MonoPubCommitAnalyzer(config)
}
