import path from 'path'
import { getAllPackages } from './path'

const cwd = path.join(__dirname, '../../../..', 'test-examples', 'filtering')

function expectContainingPackages(packages: Array<string>, scope?: string) {
    return expect.arrayContaining(
        packages.map((pkg) => ({
            name: scope ? `@${scope}/${pkg}` : pkg,
            location: expect.stringContaining(pkg),
        }))
    )
}

describe('getAllPackages', () => {
    describe('Should filter out private packages', () => {
        it('With boolean `true` value', async () => {
            const packages = await getAllPackages(['packages/pkg1/package.json', 'packages/pkg2/package.json'], cwd)
            expect(packages).toHaveLength(1)
            expect(packages).toEqual(expectContainingPackages(['pkg1'], 'filtering'))
        })
        it('With string "true" value', async () => {
            const packages = await getAllPackages(['libs/lib1/package.json', 'libs/lib2/package.json'], cwd)
            expect(packages).toHaveLength(1)
            expect(packages).toEqual(expectContainingPackages(['lib1'], 'filtering'))
        })
    })

    it('Should work with dirs glob', async () => {
        const packages = await getAllPackages(['packages/*'], cwd)
        expect(packages).toHaveLength(2)
        expect(packages).toEqual(expectContainingPackages(['pkg1', 'pkg3'], 'filtering'))
    })
    it('Should work with multiple globs', async () => {
        const packages = await getAllPackages(['packages/**/*', 'libs/**/package.json'], cwd)
        expect(packages).toHaveLength(3)
        expect(packages).toEqual(expectContainingPackages(['pkg1', 'pkg3', 'lib1'], 'filtering'))
    })
    it('Should work with relative and absolute paths to package.json', async () => {
        const packages = await getAllPackages(
            ['packages/pkg1/package.json', path.join(cwd, 'libs/lib1/package.json')],
            cwd
        )
        expect(packages).toHaveLength(2)
        expect(packages).toEqual(expectContainingPackages(['pkg1', 'lib1'], 'filtering'))
    })
    it('Should work with relative and absolute path to package dir', async () => {
        const packages = await getAllPackages(['packages/pkg1', path.join(cwd, 'libs/lib1')], cwd)
        expect(packages).toHaveLength(2)
        expect(packages).toEqual(expectContainingPackages(['pkg1', 'lib1'], 'filtering'))
    })
    it('Should return absolute paths to package.json', async () => {
        const packages = await getAllPackages(['packages/*'], cwd)
        expect(packages).not.toHaveLength(0)
        for (const packagePath of packages) {
            expect(path.basename(packagePath.location)).toBe('package.json')
            expect(path.isAbsolute(packagePath.location)).toBe(true)
        }
    })
    it('Should exclude nonexistent files', async () => {
        const packages = await getAllPackages(['mega-packages/*', 'libs/lib345'], cwd)
        expect(packages).toHaveLength(0)
    })
    it('Should exclude packages with no name', async () => {
        const packages = await getAllPackages(['broken/no-name'], cwd)
        expect(packages).toHaveLength(0)
    })
})
