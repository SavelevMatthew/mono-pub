import execa from 'execa'
import type { LatestRelease } from '@/types'
import type { PackageVersion, LastReleaseInfo } from 'mono-pub'

export const VERSION_PLACEHOLDER = '{version}'
export const NAME_PLACEHOLDER = '{name}'
const VERSION_FIND_REGEXP = new RegExp(_escapeRegex(VERSION_PLACEHOLDER), 'g')
const NAME_FIND_REGEXP = new RegExp(_escapeRegex(NAME_PLACEHOLDER), 'g')
export const DEFAULT_TAG_FORMAT = `${NAME_PLACEHOLDER}@${VERSION_PLACEHOLDER}`
const SPLIT_REGEXP = new RegExp(`(${_escapeRegex(VERSION_PLACEHOLDER)}|${_escapeRegex(NAME_PLACEHOLDER)})`)
const VERSION_REPLACE = '(?<major>\\d+).(?<minor>\\d+).(?<patch>\\d+)'

function _escapeRegex(str: string) {
    return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}

export function _maxVersion(lhs: LatestRelease, rhs: LatestRelease): LatestRelease {
    if (lhs === null) {
        return rhs
    } else if (rhs === null) {
        return lhs
    }

    if (lhs.major > rhs.major) {
        return lhs
    } else if (lhs.major < rhs.major) {
        return rhs
    }

    if (lhs.minor > rhs.minor) {
        return lhs
    } else if (lhs.minor < rhs.minor) {
        return rhs
    }

    return lhs.patch > rhs.patch ? lhs : rhs
}

/**
 * Determines if tagFormat is valid. Valid tag format has single {version} and {name} fragment
 * @param tagFormat {string}
 */
export function isValidTagFormat(tagFormat: string) {
    const versionsFound = [...tagFormat.matchAll(VERSION_FIND_REGEXP)].length
    const namesFound = [...tagFormat.matchAll(NAME_FIND_REGEXP)].length

    return versionsFound === 1 && namesFound === 1
}

/**
 * Generate regexp, which is used to catch all previous release tags
 * @param packageNames array containing all packages names to catch.
 * @param tagFormat tag format, use {version} and {name} placeholders to generate your own. {name}@{version} by default
 */
export function getTagRegex(packageNames: ReadonlyArray<string>, tagFormat = DEFAULT_TAG_FORMAT) {
    if (!isValidTagFormat(tagFormat)) {
        throw new TypeError(
            `Invalid tag format. Valid tag must contains 1 and only 1 ${VERSION_PLACEHOLDER} and ${NAME_PLACEHOLDER} fragment`
        )
    }

    const parts = tagFormat.split(SPLIT_REGEXP)

    const escapedParts = parts.map((part) => {
        if (part === VERSION_PLACEHOLDER) {
            return VERSION_REPLACE
        } else if (part === NAME_PLACEHOLDER) {
            const packagesNamesRegexpPart = packageNames.map((pkg) => _escapeRegex(pkg)).join('|')
            return `(?<package>${packagesNamesRegexpPart})`
        } else {
            return part
        }
    })

    return new RegExp(`^${escapedParts.join('')}$`)
}

export async function getMergedTags(cwd: string) {
    const { stdout } = await execa('git', ['tag', '--merged'], { cwd })

    return stdout.split('\n').map((tag) => tag.trim())
}

export function getLatestReleases(
    tags: ReadonlyArray<string>,
    packageNames: ReadonlyArray<string>,
    tagFormat?: string
): LastReleaseInfo {
    const tagRegex = getTagRegex(packageNames, tagFormat)
    const result: LastReleaseInfo = Object.assign({}, ...packageNames.map((pkg) => ({ [pkg]: null })))

    for (const tag of tags) {
        const match = tag.match(tagRegex)
        if (match && match.groups) {
            const packageName = match.groups.package
            const release: PackageVersion = {
                major: parseInt(match.groups.major),
                minor: parseInt(match.groups.minor),
                patch: parseInt(match.groups.patch),
            }
            result[packageName] = _maxVersion(result[packageName], release)
        }
    }

    return result
}

export function getTagFromVersion(tagFormat: string, pkgName: string, version: PackageVersion) {
    const versionPart = `${version.major}.${version.minor}.${version.patch}`
    return tagFormat.replace(NAME_PLACEHOLDER, pkgName).replace(VERSION_PLACEHOLDER, versionPart)
}
