import path from 'path'
import { getAllPackages } from './path'

const cwd = path.join(__dirname, '../../../..', 'test-examples', 'filtering')

describe('getAllPackages', () => {
    describe('Should filter out private packages', () => {
        it('With boolean `true` value', async () => {
            const packages = await getAllPackages(['packages/pkg1/package.json', 'packages/pkg2/package.json'], cwd)
            expect(packages).toHaveLength(1)
            expect(packages[0]).toEqual(expect.stringContaining('pkg1'))
        })
        it('With string "true" value', async () => {
            const packages = await getAllPackages(['libs/lib1/package.json', 'libs/lib2/package.json'], cwd)
            expect(packages).toHaveLength(1)
            expect(packages[0]).toEqual(expect.stringContaining('lib1'))
        })
    })

    it('Should work with dirs glob', async () => {
        const packages = await getAllPackages(['packages/*'], cwd)
        expect(packages).toHaveLength(2)
        expect(packages).toEqual(
            expect.arrayContaining([expect.stringContaining('pkg1'), expect.stringContaining('pkg3')])
        )
    })
    it('Should work with multiple globs', async () => {
        const packages = await getAllPackages(['packages/**/*', 'libs/**/package.json'], cwd)
        expect(packages).toHaveLength(3)
        expect(packages).toEqual(
            expect.arrayContaining([
                expect.stringContaining('pkg1'),
                expect.stringContaining('pkg3'),
                expect.stringContaining('lib1'),
            ])
        )
    })
    it('Should work with relative and absolute paths to package.json', async () => {
        const packages = await getAllPackages(
            ['packages/pkg1/package.json', path.join(cwd, 'libs/lib1/package.json')],
            cwd
        )
        expect(packages).toHaveLength(2)
        expect(packages).toEqual(
            expect.arrayContaining([expect.stringContaining('pkg1'), expect.stringContaining('lib1')])
        )
    })
    it('Should work with relative and absolute path to package dir', async () => {
        const packages = await getAllPackages(['packages/pkg1', path.join(cwd, 'libs/lib1')], cwd)
        expect(packages).toHaveLength(2)
        expect(packages).toEqual(
            expect.arrayContaining([expect.stringContaining('pkg1'), expect.stringContaining('lib1')])
        )
    })
    it('Should return absolute paths to package.json', async () => {
        const packages = await getAllPackages(['packages/*'], cwd)
        expect(packages).not.toHaveLength(0)
        for (const packagePath of packages) {
            expect(path.basename(packagePath)).toBe('package.json')
            expect(path.isAbsolute(packagePath)).toBe(true)
        }
    })
    it('Should exclude nonexistent files', async () => {
        const packages = await getAllPackages(['mega-packages/*', 'libs/lib345'], cwd)
        expect(packages).toHaveLength(0)
    })
})
