import type { LatestRelease, LatestReleasesMap, PackageVersion } from '../types'

const VERSION_PLACEHOLDER = '{version}'
const NAME_PLACEHOLDER = '{name}'
const DEFAULT_TAG_FORMAT = `${NAME_PLACEHOLDER}@${VERSION_PLACEHOLDER}`
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
 * Generate regexp, which is used to catch all previous release tags
 * @param packageNames array containing all packages names to catch.
 * @param tagFormat tag format, use {version} and {name} placeholders to generate your own. {name}@{version} by default
 */
export function getTagRegex(packageNames: ReadonlyArray<string>, tagFormat = DEFAULT_TAG_FORMAT) {
    const versionIndex = tagFormat.indexOf(VERSION_PLACEHOLDER)
    if (versionIndex === -1) {
        throw new TypeError(`no "${VERSION_PLACEHOLDER}" found in tagFormat`)
    } else if (tagFormat.indexOf(VERSION_PLACEHOLDER, versionIndex + 1) !== -1) {
        throw new TypeError(`multiple "${VERSION_PLACEHOLDER}" found in tagFormat`)
    }

    const nameIndex = tagFormat.indexOf(NAME_PLACEHOLDER)
    if (nameIndex === -1) {
        throw new TypeError(`no "${NAME_PLACEHOLDER}" found in tagFormat`)
    } else if (tagFormat.indexOf(NAME_PLACEHOLDER, nameIndex + 1) !== -1) {
        throw new TypeError(`multiple "${NAME_PLACEHOLDER}" found in tagFormat`)
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

export function getLatestReleases<TPackages extends ReadonlyArray<string>>(
    tags: ReadonlyArray<string>,
    packageNames: TPackages,
    tagFormat?: string
): LatestReleasesMap<TPackages> {
    const tagRegex = getTagRegex(packageNames, tagFormat)
    const result: LatestReleasesMap<TPackages> = Object.assign({}, ...packageNames.map((pkg) => ({ [pkg]: null })))

    for (const tag of tags) {
        const match = tag.match(tagRegex)
        if (match) {
            const groups = match.groups!
            const packageName = groups.package as TPackages[number]
            const release: PackageVersion = {
                major: parseInt(groups.major),
                minor: parseInt(groups.minor),
                patch: parseInt(groups.patch),
            }
            result[packageName] = _maxVersion(result[packageName], release)
        }
    }

    return result
}
