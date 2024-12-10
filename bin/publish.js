const execa = require('execa')
const publish = require('mono-pub')
const git = require('@mono-pub/git')
const github = require('@mono-pub/github')
const npm = require('@mono-pub/npm')
const commitAnalyzer = require('@mono-pub/commit-analyzer')
const { getExecutionOrder } = require('mono-pub/utils')

/** @type {import('mono-pub').MonoPubPlugin} */
const builder = {
    name: '@mono-pub/local-builder',
    async prepareAll({ foundPackages }, ctx) {
        const batches = getExecutionOrder(foundPackages, { batching: true })
        for (const batch of batches) {
            await execa('yarn', ['build', batch.map((pkg) => `--filter=${pkg.name}`)], { cwd: ctx.cwd })
        }
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
).then(() => console.log('ALL DONE!'))
