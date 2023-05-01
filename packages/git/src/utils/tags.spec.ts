import { getTagRegex, _maxVersion, getLatestReleases } from './tags'
import type { ParsedTag, LatestRelease } from '../types'

describe('Tags utils', () => {
    describe('getTagRegex', () => {
        describe('Should throw errors', () => {
            it('If no {version} found in tagFormat', () => {
                expect(() => getTagRegex(['pkg'], '{name}-release')).toThrow(TypeError)
            })
            it('If multiple {version} found in tagFormat', () => {
                expect(() => getTagRegex(['pkg'], '{name}@{version}-{version}')).toThrow(TypeError)
            })
            it('If no {name} found in tagFormat', () => {
                expect(() => getTagRegex(['pkg'], '{version}-release')).toThrow(TypeError)
            })
            it('If multiple {name} found in tagFormat', () => {
                expect(() => getTagRegex(['pkg'], '{name}-{name}@{version}')).toThrow(TypeError)
            })
        })
        describe('Should generate valid regexps to find tags', () => {
            const tags = [
                'some-package',
                'some-package@1.0.0',
                '@scoped/package@35.26.78',
                '@scoped/package',
                '@scoped/another@1.2.3',
                'another@1.3.2',
                'another@1.3.3.4-dev',
                'some-package-v0.0.1',
                '@scoped/another-v1.2.3',
                '7.6.5',
            ]

            const cases: Array<[Array<string>, string | undefined, Array<ParsedTag>]> = [
                [['some-package'], undefined, [{ package: 'some-package', major: 1, minor: 0, patch: 0 }]],
                [
                    ['another', '@scoped/package'],
                    undefined,
                    [
                        { package: 'another', major: 1, minor: 3, patch: 2 },
                        { package: '@scoped/package', major: 35, minor: 26, patch: 78 },
                    ],
                ],
                [
                    ['some-package', '@scoped/another'],
                    '{name}-v{version}',
                    [
                        { package: 'some-package', major: 0, minor: 0, patch: 1 },
                        { package: '@scoped/another', major: 1, minor: 2, patch: 3 },
                    ],
                ],
            ]

            it.each(cases)('Packages: %p, tagFormat: %p', (packages, format, expected) => {
                const tagRegex = getTagRegex(packages, format)
                const matchingTags: Array<ParsedTag> = []
                for (const tag of tags) {
                    const match = tag.match(tagRegex)
                    if (match) {
                        expect(match.groups).toBeDefined()
                        expect(match.groups).toHaveProperty('package')
                        expect(match.groups).toHaveProperty('major')
                        expect(match.groups).toHaveProperty('minor')
                        expect(match.groups).toHaveProperty('patch')
                        const packageName = match.groups!.package
                        const major = parseInt(match.groups!.major)
                        const minor = parseInt(match.groups!.minor)
                        const patch = parseInt(match.groups!.patch)
                        expect(major).not.toBeNaN()
                        expect(minor).not.toBeNaN()
                        expect(patch).not.toBeNaN()
                        matchingTags.push({ package: packageName, major, minor, patch })
                    }
                }
                expect(matchingTags).toHaveLength(expected.length)
                expect(matchingTags).toEqual(expect.arrayContaining(expected))
            })
        })
    })
    describe('_maxVersion', () => {
        describe('Must detect max version correctly', () => {
            const cases: Array<[string, LatestRelease, LatestRelease]> = [
                ['null must be less than anything else', { major: 0, minor: 0, patch: 1 }, null],
                ['patch difference', { major: 1, minor: 2, patch: 34 }, { major: 1, minor: 2, patch: 1 }],
                ['minor difference', { major: 1, minor: 3, patch: 0 }, { major: 1, minor: 2, patch: 158 }],
                ['major difference', { major: 1, minor: 2, patch: 158 }, { major: 0, minor: 3, patch: 0 }],
            ]
            it.each(cases)('%p', (_, max, min) => {
                expect(_maxVersion(max, min)).toEqual(max)
                expect(_maxVersion(min, max)).toEqual(max)
            })
        })
    })
    describe('getLatestReleases', () => {
        it('Must correctly determine latest release with default tag format', () => {
            const tags = [
                'some-package@1.0.0',
                'some-package@1.1.0',
                'some-package@1.1.1',
                'some-package@1.1.2',
                'some-package@2.0.0',
                '@scoped/package@35.26.78',
                '@scoped/another@1.2.3',
                '@scoped/another@5.2.0',
                '@scoped/another@5.2.3',
            ]
            const packages = ['some-package', '@scoped/package', '@scoped/another', '@another-scope/pkg'] as const
            const latestReleases = getLatestReleases(tags, packages)
            expect(latestReleases).toHaveProperty('some-package', { major: 2, minor: 0, patch: 0 })
            expect(latestReleases).toHaveProperty('@scoped/package', { major: 35, minor: 26, patch: 78 })
            expect(latestReleases).toHaveProperty('@scoped/another', { major: 5, minor: 2, patch: 3 })
            expect(latestReleases).toHaveProperty('@another-scope/pkg', null)
        })
    })
})
