import { IMPORTANCE_ORDER, getMostImportantType } from './utils'
import type { ReleaseType } from 'mono-pub'

describe('commit-analyzer utils', () => {
    describe('getMostImportantType', () => {
        const cases: Array<[ReleaseType, ReleaseType]> = []
        for (let i = 0; i < IMPORTANCE_ORDER.length; i++) {
            for (let j = i; j < IMPORTANCE_ORDER.length; j++) {
                cases.push([IMPORTANCE_ORDER[i], IMPORTANCE_ORDER[j]])
            }
        }
        it.each(cases)('%p release type should be more important than %p', (moreImportant, lessImportant) => {
            expect(getMostImportantType(moreImportant, lessImportant)).toBe(moreImportant)
            expect(getMostImportantType(lessImportant, moreImportant)).toBe(moreImportant)
        })
    })
})
