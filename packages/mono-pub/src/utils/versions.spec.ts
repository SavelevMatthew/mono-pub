import { faker } from '@faker-js/faker'
import { versionToString, getNewVersion, getVersionCriteria } from './versions'
import type { PackageVersion, ReleaseType } from '@/types'

function getRandomVersion(): PackageVersion {
    return {
        major: faker.number.int({ min: 1, max: 50 }),
        minor: faker.number.int({ min: 0, max: 50 }),
        patch: faker.number.int({ min: 0, max: 50 }),
    }
}

describe('Versions utils', () => {
    describe('versionToString', () => {
        describe('Should convert versions correctly', () => {
            const cases: Array<[string, PackageVersion]> = [
                ['1.2.3', { major: 1, minor: 2, patch: 3 }],
                ['21.35.6', { major: 21, minor: 35, patch: 6 }],
                ['1.0.0', { major: 1, minor: 0, patch: 0 }],
            ]
            it.each(cases)('%p', (expected, version) => {
                expect(versionToString(version)).toBe(expected)
            })
        })
    })
    describe('getNewVersion', () => {
        describe('Should generate correct version based on latest release and release type', () => {
            it('Should be same as latest release if releaseType is none', () => {
                expect(getNewVersion(null, 'none')).toBeNull()
                const latestVersion = getRandomVersion()
                expect(getNewVersion(latestVersion, 'none')).toStrictEqual(latestVersion)
            })
            describe('Should be 1.0.0 if no latest release and release type is not none', () => {
                const firstVersion: PackageVersion = { major: 1, minor: 0, patch: 0 }
                const cases: Array<ReleaseType> = ['patch', 'minor', 'major']
                it.each(cases)('Release type: %p', (releaseType) => {
                    expect(getNewVersion(null, releaseType)).toStrictEqual(firstVersion)
                })
            })
            describe('Should increment the corresponding version otherwise', () => {
                it('Release type: "patch"', () => {
                    const latestRelease = getRandomVersion()
                    const expected = { ...latestRelease, patch: latestRelease.patch + 1 }
                    expect(getNewVersion(latestRelease, 'patch')).toStrictEqual(expected)
                })
                it('Release type: "minor"', () => {
                    const latestRelease = getRandomVersion()
                    const expected: PackageVersion = {
                        major: latestRelease.major,
                        minor: latestRelease.minor + 1,
                        patch: 0,
                    }
                    expect(getNewVersion(latestRelease, 'minor')).toStrictEqual(expected)
                })
                it('Release type: "major"', () => {
                    const latestRelease = getRandomVersion()
                    const expected: PackageVersion = { major: latestRelease.major + 1, minor: 0, patch: 0 }
                    expect(getNewVersion(latestRelease, 'major')).toStrictEqual(expected)
                })
            })
        })
    })
    describe('getVersionCriteria', () => {
        describe('Should generate valid version range based local version', () => {
            describe('Any version should resolve to latest', () => {
                const syntaxes = ['*', 'workspace:*', '1.2.3', 'x']
                it.each(syntaxes)('%p', (syntax) => {
                    const version = versionToString(getRandomVersion())
                    expect(getVersionCriteria(syntax, version)).toBe(version)
                })
            })
            describe('"Any patch" version should be resolved correctly', () => {
                const syntaxes = ['~1.2.3', 'workspace:~', '1.2.x']
                it.each(syntaxes)('%p', (syntax) => {
                    const version = versionToString(getRandomVersion())
                    expect(getVersionCriteria(syntax, version)).toBe(`~${version}`)
                })
            })
            describe('"Any minor" version should be resolved correctly', () => {
                const syntaxes = ['^1.2.3', 'workspace:^', '1.x']
                it.each(syntaxes)('%p', (syntax) => {
                    const version = versionToString(getRandomVersion())
                    expect(getVersionCriteria(syntax, version)).toBe(`^${version}`)
                })
            })
        })
    })
})
