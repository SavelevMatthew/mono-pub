import execa from 'execa'
import { versionToString } from 'mono-pub/utils'
import type { LatestRelease } from '@/types'
import type { PackageVersion, LatestPackagesReleases } from 'mono-pub'

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

/**
 * Compares 2 versions (typeof LatestRelease from mono-pub) and determines which one is latest
 * @param lhs {LatestRelease} - first version (left hand side)
 * @param rhs {LatestRelease} - second version (right hand side)
 * @return {LatestRelease} - latest release
 */
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
 * @param tagFormat {string} - tag format
 * @return {boolean} - indicator that tag is valid or not
 */
export function isValidTagFormat(tagFormat: string) {
    const versionsFound = [...tagFormat.matchAll(VERSION_FIND_REGEXP)].length
    const namesFound = [...tagFormat.matchAll(NAME_FIND_REGEXP)].length

    return versionsFound === 1 && namesFound === 1
}

/**
 * Generate regexp, which is used to catch all previous release tags
 * @param packageNames {ReadonlyArray<string>} array containing all packages names to catch.
 * @param [tagFormat] {string} tag format, use {version} and {name} placeholders to generate your own. {name}@{version} by default
 * @return{RegExp} - regexp for catching tags
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

/**
 * Obtains all merged tags from HEAD revision
 * @param cwd {string} repository root directory, in most cases - ctx.cwd from mono-pub
 * @return {Promise<string>} list of merged tags
 */
export async function getMergedTags(cwd: string) {
    const { stdout } = await execa('git', ['tag', '--merged'], { cwd })

    return stdout.split('\n').map((tag) => tag.trim())
}

/**
 * Generates tag regexp to scan package-related tags. Then from matching tags determines latest one for each package.
 * @param tags {ReadonlyArray<string>}
 * @param packageNames {ReadonlyArray<string>}
 * @param [tagFormat] {string}
 * @return {LatestPackagesReleases} Object, containing latest release for each package. If no tags found for some package - it's key will have null value
 */
export function getLatestReleases(
    tags: ReadonlyArray<string>,
    packageNames: ReadonlyArray<string>,
    tagFormat?: string
): LatestPackagesReleases {
    const tagRegex = getTagRegex(packageNames, tagFormat)
    const result: LatestPackagesReleases = Object.assign({}, ...packageNames.map((pkg) => ({ [pkg]: null })))

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

/**
 * Generates tag from package name and version by replacing placeholders
 * @param tagFormat {string} - tag format
 * @param pkgName {string} - name of package
 * @param version {PackageVersion} - version of package
 * @return {string} - resulting tag
 */
export function getTagFromVersion(tagFormat: string, pkgName: string, version: PackageVersion) {
    return tagFormat.replace(NAME_PLACEHOLDER, pkgName).replace(VERSION_PLACEHOLDER, versionToString(version))
}

/**
 * Generates tag from package name and version, then adds it locally and pushes to remote
 * @param tagFormat {string} - tag format
 * @param pkgName {string} - name of package
 * @param newVersion {PackageVersion} - version of package
 * @param cwd {string} - repo root, in most cases obtained from mono-pub ctx
 * @return {Promise<void>}
 */
export async function pushNewVersionTag(tagFormat: string, pkgName: string, newVersion: PackageVersion, cwd: string) {
    const newTag = tagFormat
        .replace(NAME_PLACEHOLDER, pkgName)
        .replace(VERSION_PLACEHOLDER, versionToString(newVersion))
    await execa('git', ['tag', newTag], { cwd })
    await execa('git', ['push', 'origin', newTag], { cwd })
}
