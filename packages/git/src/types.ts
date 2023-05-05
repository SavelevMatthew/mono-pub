import type { PackageVersion } from 'mono-pub'

export type ParsedTag = PackageVersion & {
    package: string
}

export type LatestRelease = PackageVersion | null
