export type PackageVersion = {
    major: number
    minor: number
    patch: number
}

export type ParsedTag = PackageVersion & {
    package: string
}

export type LatestRelease = PackageVersion | null

type LatestReleasesMap<TPackages extends ReadonlyArray<string>> = {
    [Key in TPackages[number]]: LatestRelease
}
