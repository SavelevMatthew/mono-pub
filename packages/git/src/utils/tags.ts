const VERSION_PLACEHOLDER = '{version}'
const NAME_PLACEHOLDER = '{name}'
const DEFAULT_TAG_FORMAT = `${NAME_PLACEHOLDER}@${VERSION_PLACEHOLDER}`
const SPLIT_REGEXP = new RegExp(`(${_escapeRegex(VERSION_PLACEHOLDER)}|${_escapeRegex(NAME_PLACEHOLDER)})`)
const VERSION_REPLACE = '(?<major>\\d+).(?<minor>\\d+).(?<patch>\\d+)'

export type ParsedTag = {
    package: string
    major: number
    minor: number
    patch: number
}

function _escapeRegex(str: string) {
    return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}

/**
 * Generate regexp, which is used to catch all previous release tags
 * @param packageNames array containing all packages names to catch.
 * @param tagFormat tag format, use {version} and {name} placeholders to generate your own. {name}@{version} by default
 */
export function getTagRegex(packageNames: Array<string>, tagFormat = DEFAULT_TAG_FORMAT) {
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
