export type BasePackageInfo = {
    name: string
    location: string
}

export type PackageVersion = {
    major: number
    minor: number
    patch: number
}

export type LastReleaseInfo<TPackages extends string> = {
    [Key in TPackages]: PackageVersion | null
}
