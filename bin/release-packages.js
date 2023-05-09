const publish = require('mono-pub')
const git = require('@mono-pub/git')
const commitAnalyzer = require('@mono-pub/commit-analyzer')
const path = require('path')

publish(['packages/*'], [git(), commitAnalyzer()], { cwd: path.join(__dirname, '..') })
