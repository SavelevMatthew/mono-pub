const execa = require('execa')
const publish = require('mono-pub')
const git = require('@mono-pub/git')
const github = require('@mono-pub/github')
const npm = require('@mono-pub/npm')
const commitAnalyzer = require('@mono-pub/commit-analyzer')

const builder = {
    name: '@mono-pub/local-builder',
    async prepare(_, ctx) {
        await execa('yarn', ['build'], { cwd: ctx.cwd })
    },
}

const BREAKING_KEYWORDS = ['BREAKING CHANGE', 'BREAKING-CHANGE', 'BREAKING CHANGES', 'BREAKING-CHANGES']

publish(
    ['packages/*'],
    [
        git(),
        github({
            extractCommitsFromSquashed: true,
            releaseNotesOptions: {
                rules: [
                    { breaking: true, section: '⚠️ BREAKING CHANGES' },
                    { type: 'feat', section: '🦕 New features' },
                    { type: 'fix', section: '🐞 Bug fixes' },
                    { type: 'perf', section: '🚀 Performance increases' },
                    { dependency: true, section: '🌐Dependencies' },
                ],
                breakingNoteKeywords: BREAKING_KEYWORDS,
            },
        }),
        commitAnalyzer({
            minorTypes: ['feat'],
            patchTypes: ['perf', 'fix'],
            breakingNoteKeywords: BREAKING_KEYWORDS,
        }),
        builder,
        npm({ provenance: true }),
    ]
)
