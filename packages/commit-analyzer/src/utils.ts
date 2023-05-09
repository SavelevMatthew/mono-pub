import type { ReleaseType } from 'mono-pub'

const IMPORTANCE_ORDER: Array<ReleaseType> = ['major', 'minor', 'patch', 'none']

export function getMostImportantType(lhs: ReleaseType, rhs: ReleaseType): ReleaseType {
    const lhsIndex = IMPORTANCE_ORDER.indexOf(lhs)
    const rhsIndex = IMPORTANCE_ORDER.indexOf(rhs)

    return lhsIndex < rhsIndex ? lhs : rhs
}
