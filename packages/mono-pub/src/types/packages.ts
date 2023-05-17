import type { CommitInfo } from './commits'

export type BasePackageInfo = {
    name: string
    location: string
}

export type DependencyInfo = {
    name: string
    type: 'dep' | 'devDep'
    value: string
}

export type PackageInfoWithDependencies = BasePackageInfo & {
    dependsOn: Array<DependencyInfo>
}

export type PackageVersion = {
    major: number
    minor: number
    patch: number
}

export type LatestReleasedVersion = PackageVersion | null

export type PackageInfoWithLatestRelease = BasePackageInfo & {
    latestRelease: LatestReleasedVersion
}

export type LatestPackagesReleases = Record<string, LatestReleasedVersion>

export type ReleaseType = keyof PackageVersion | 'none'

type PackageReleaseInfo = {
    oldVersion: LatestReleasedVersion
    newVersion: PackageVersion
    releaseType: ReleaseType
}

export type BumpedDep = BasePackageInfo & PackageReleaseInfo

export type ReleasedPackageInfo = BasePackageInfo &
    PackageReleaseInfo & {
        commits: Array<CommitInfo>
        bumpedDeps: Array<BumpedDep>
    }
