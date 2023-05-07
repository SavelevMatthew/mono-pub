const publish = require('mono-pub')
const git = require('@mono-pub/git')
const path = require('path')

publish(['packages/configs'], [git()], { cwd: path.join(__dirname, '..') })
