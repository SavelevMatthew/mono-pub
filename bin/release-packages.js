const execa = require('execa')
const publish = require('mono-pub')
const git = require('@mono-pub/git')
const commitAnalyzer = require('@mono-pub/commit-analyzer')
const path = require('path')

const builder = {
    name: '@mono-pub/builder',
    async prepare(_, ctx) {
        await execa('yarn', ['build'], { cwd: ctx.cwd })
    },
}

publish(['packages/*'], [git(), commitAnalyzer(), builder], { cwd: path.join(__dirname, '..') })
