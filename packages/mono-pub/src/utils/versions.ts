import type { LatestReleasedVersion, ReleaseType, PackageVersion } from '@/types'

const PATCH_REGEX = /\d+.\d+.x/i
const MINOR_REGEX = /(?<!\d+.)\d+.x/i

export function versionToString(version: PackageVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`
}

export function getNewVersion(latestRelease: LatestReleasedVersion, releaseType: ReleaseType): LatestReleasedVersion {
    if (releaseType === 'none') {
        return latestRelease
    } else if (!latestRelease) {
        return { major: 1, minor: 0, patch: 0 }
    } else if (releaseType === 'major') {
        return { major: latestRelease.major + 1, minor: 0, patch: 0 }
    } else if (releaseType === 'minor') {
        return { major: latestRelease.major, minor: latestRelease.minor + 1, patch: 0 }
    } else {
        return { ...latestRelease, patch: latestRelease.patch + 1 }
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
