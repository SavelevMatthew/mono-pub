const fs = require('fs')
const path = require('path')
const packages = fs.readdirSync(path.join(__dirname, 'packages'))

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: './',
    testPathIgnorePatterns: ['/node_modules/'],
    moduleFileExtensions: ['js', 'ts'],
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    },
    projects: packages.map((pkg) => ({
        displayName: pkg,
        testEnvironment: 'node',
        transform: {
            '^.+\\.ts?$': 'ts-jest',
        },
        testMatch: [`<rootDir>/${pkg}/**/*.spec.ts`],
    })),
}
