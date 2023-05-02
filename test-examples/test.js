const { globSync } = require('glob')

console.log(process.cwd())
console.log(globSync('packages/**/package.json'))
