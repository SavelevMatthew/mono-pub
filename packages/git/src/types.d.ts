export type ParsedTag = PackageVersion & {
    package: string
}

export type LatestRelease = PackageVersion | null
