import type { LastRelease, ReleaseType, PackageVersion } from '@/types'

const PATCH_REGEX = /\d+.\d+.x/i
const MINOR_REGEX = /(?<!\d+.)\d+.x/i

export function versionToString(version: PackageVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`
}

export function getNewVersion(lastRelease: LastRelease, releaseType: Exclude<ReleaseType, 'none'>): PackageVersion {
    if (!lastRelease) {
        return { major: 1, minor: 0, patch: 0 }
    } else if (releaseType === 'major') {
        return { major: lastRelease.major + 1, minor: 0, patch: 0 }
    } else if (releaseType === 'minor') {
        return { major: lastRelease.major, minor: lastRelease.minor + 1, patch: 0 }
    } else {
        return { ...lastRelease, patch: lastRelease.patch + 1 }
    }
}

export function getVersionCriteria(currentVersion: string, newVersion: string) {
    if (currentVersion.includes('~') || PATCH_REGEX.test(currentVersion)) {
        return `~${newVersion}`
    }
    if (currentVersion.includes('^') || MINOR_REGEX.test(currentVersion)) {
        return `^${newVersion}`
    }
    return newVersion
}
