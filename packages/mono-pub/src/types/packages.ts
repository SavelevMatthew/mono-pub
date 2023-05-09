export type BasePackageInfo = {
    name: string
    location: string
}

export type DependencyInfo = {
    name: string
    type: 'dep' | 'devDep'
    value: string
}

export type DependenciesPackageInfo = BasePackageInfo & {
    dependsOn: Array<DependencyInfo>
}

export type PackageVersion = {
    major: number
    minor: number
    patch: number
}

export type LastRelease = PackageVersion | null

export type ReleasePackageInfo = BasePackageInfo & {
    lastRelease: LastRelease
}

export type LastReleaseInfo = Record<string, LastRelease>

export type ReleaseType = keyof PackageVersion | 'none'
