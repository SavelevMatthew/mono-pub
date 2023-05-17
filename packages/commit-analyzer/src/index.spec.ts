import crypto from 'crypto'
import commitAnalyzer from './index'
import type { CommitInfo } from 'mono-pub'

const commitAuthor = { name: 'Name' }
const minorCommitMessage = 'feat: some commit header'
const breakingHeaderMessage = 'fix!: some commit header'
const breakingNoteMessage = `feat(scope): some commit header

BREAKING-CHANGE: Some note explaining what happened`
const patchCommitMessage = `fix(another-scope): some commit header

Some body with more detailed info`
const skipCommitMessage = 'test: added more tests to @mono-pub/commit-analyzer'
const nonConventionalCommitMessage = `It can be very important feature, but not in conventional format

BREAKING-CHANGE: Even breaking change must be ignored`

function generateCommit(msg: string): CommitInfo {
    return { author: commitAuthor, committer: commitAuthor, message: msg, hash: crypto.randomBytes(20).toString('hex') }
}

describe('commitAnalyzer', () => {
    describe('getReleaseType', () => {
        describe('Should determine correct release type with default conventional config', () => {
            const analyzer = commitAnalyzer()
            describe('Breaking changes should always result in a major release', () => {
                it('With "!" mark in header', () => {
                    const releaseType = analyzer.getReleaseType(
                        [
                            generateCommit(patchCommitMessage),
                            generateCommit(breakingHeaderMessage),
                            generateCommit(minorCommitMessage),
                        ],
                        false
                    )
                    expect(releaseType).toBe('major')
                })
                it('With BREAKING note', () => {
                    const releaseType = analyzer.getReleaseType(
                        [
                            generateCommit(patchCommitMessage),
                            generateCommit(breakingNoteMessage),
                            generateCommit(minorCommitMessage),
                        ],
                        false
                    )
                    expect(releaseType).toBe('major')
                })
            })
            it('Non-conventional commits should be skipped', () => {
                const releaseType = analyzer.getReleaseType(
                    [generateCommit(nonConventionalCommitMessage), generateCommit(skipCommitMessage)],
                    false
                )
                expect(releaseType).toBe('none')
            })
            it('Dependencies changes must resolve in patch by default', () => {
                const releaseType = analyzer.getReleaseType([generateCommit(skipCommitMessage)], true)
                expect(releaseType).toBe('patch')
                const anotherType = analyzer.getReleaseType([generateCommit(minorCommitMessage)], true)
                expect(anotherType).toBe('minor')
            })
        })
        describe('Should respect custom config options', () => {
            test('Custom major types', () => {
                const analyzer = commitAnalyzer({ majorTypes: ['breaking'] })
                const message = 'breaking(scope): this commit should trigger major release'
                const releaseType = analyzer.getReleaseType([generateCommit(message)], false)
                expect(releaseType).toBe('major')
            })
            test('Custom minor types', () => {
                const analyzer = commitAnalyzer({ minorTypes: ['minor'] })
                const featReleaseType = analyzer.getReleaseType([generateCommit(minorCommitMessage)], false)
                expect(featReleaseType).toBe('none')
                const message = 'minor: this commit should trigger minor release'
                const releaseType = analyzer.getReleaseType([generateCommit(message)], false)
                expect(releaseType).toBe('minor')
            })
            test('Custom patch types', () => {
                const analyzer = commitAnalyzer({ patchTypes: ['security'] })
                const fixReleaseType = analyzer.getReleaseType([generateCommit(patchCommitMessage)], false)
                expect(fixReleaseType).toBe('none')
                const message = 'security(scope): this commit should trigger minor release'
                const releaseType = analyzer.getReleaseType([generateCommit(message)], false)
                expect(releaseType).toBe('patch')
            })
            test('Custom breaking notes title', () => {
                const analyzer = commitAnalyzer({ breakingNoteKeywords: ['Oopsie'] })
                const defaultReleaseType = analyzer.getReleaseType([generateCommit(breakingNoteMessage)], false)
                expect(defaultReleaseType).toBe('minor')
                const message = `fix: types fixed
                Oopsie: I screwed up the types, so some of plugins may not work properly`
                const releaseType = analyzer.getReleaseType([generateCommit(message)], false)
                expect(releaseType).toBe('major')
            })
            test('Custom dependencies release type', () => {
                const analyzer = commitAnalyzer({ depsBumpReleaseType: 'minor' })
                const releaseType = analyzer.getReleaseType([generateCommit(skipCommitMessage)], true)
                expect(releaseType).toBe('minor')
            })
        })
    })
})
