import { getAllPackageCommitsInRange } from '@/utils/commits'
import { dirSync } from 'tmp'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import execa from 'execa'
import type { DirResult } from 'tmp'
import type { BasePackageInfo, CommitInfo } from 'mono-pub'

describe('Git commit utils', () => {
    let tmpDir: DirResult
    let firstPackageInfo: BasePackageInfo
    let secondPackageInfo: BasePackageInfo

    const firstPackageInitCommit = 'feat(pkg1): init commit'
    const firstPackageSecondCommit =
        "fix(pkg1): that's commit header\n\nCommit body goes here\n\nBREAKING CHANGE: and there's some note"
    const secondPackageCommit = 'chore(pkg2): init commit'
    const globalCommit = 'chore: fixed typos'

    const userName = 'SavelevMatthew'

    function expectContainingMessages(commits: Array<CommitInfo>, messages: Array<string>) {
        return expect(commits).toEqual(
            expect.arrayContaining(
                messages.map((message) =>
                    expect.objectContaining({
                        message,
                        author: { name: userName },
                        committer: { name: userName },
                        hash: expect.stringMatching(/[0-9a-z]{40}/),
                    })
                )
            )
        )
    }

    beforeEach(async () => {
        tmpDir = dirSync({ unsafeCleanup: true })
        await execa('git', ['init'], { cwd: tmpDir.name })
        await execa('git', ['config', 'user.name', userName], { cwd: tmpDir.name })
        await execa('git', ['config', 'user.email', 'example@example.com'], { cwd: tmpDir.name })
        fs.mkdirSync(path.join(tmpDir.name, 'packages/pkg1'), { recursive: true })
        fs.writeFileSync(
            path.join(tmpDir.name, 'packages/pkg1', 'package.json'),
            JSON.stringify({ name: 'pkg1' }, null, 2)
        )
        await execa('git', ['add', '.'], { cwd: tmpDir.name })
        await execa('git', ['commit', '-m', firstPackageInitCommit], { cwd: tmpDir.name })
        await execa('git', ['tag', 'pkg1@1.0.0'], { cwd: tmpDir.name })

        fs.mkdirSync(path.join(tmpDir.name, 'packages/pkg2'), { recursive: true })
        fs.writeFileSync(
            path.join(tmpDir.name, 'packages/pkg2', 'package.json'),
            JSON.stringify({ name: '@scope/pkg2' }, null, 2)
        )
        await execa('git', ['add', '.'], { cwd: tmpDir.name })
        await execa('git', ['commit', '-m', secondPackageCommit], { cwd: tmpDir.name })
        await execa('git', ['tag', '@scope/pkg2@1.0.0'], { cwd: tmpDir.name })

        fs.writeFileSync(path.join(tmpDir.name, 'packages/pkg1', 'README.md'), 'Hello, world!')
        await execa('git', ['add', '.'], { cwd: tmpDir.name })
        await execa('git', ['commit', '-m', firstPackageSecondCommit], { cwd: tmpDir.name })
        await execa('git', ['tag', 'pkg1@2.0.0'], { cwd: tmpDir.name })

        fs.writeFileSync(path.join(tmpDir.name, 'packages/pkg1', 'README.md'), 'Hello')
        fs.writeFileSync(path.join(tmpDir.name, 'packages/pkg2', 'README.md'), 'World')
        await execa('git', ['add', '.'], { cwd: tmpDir.name })
        await execa('git', ['commit', '-m', globalCommit], { cwd: tmpDir.name })

        firstPackageInfo = { name: 'pkg1', location: path.join(tmpDir.name, 'packages/pkg1', 'package.json') }
        secondPackageInfo = { name: '@scope/pkg2', location: path.join(tmpDir.name, 'packages/pkg2', 'package.json') }
    })
    afterEach(() => {
        tmpDir.removeCallback()
    })

    describe('getAllPackageCommitsInRange', () => {
        it('Should include commits with changes in package directory', async () => {
            const firstPackageCommits = await getAllPackageCommitsInRange({
                to: 'HEAD',
                pkgInfo: firstPackageInfo,
                cwd: tmpDir.name,
            })
            const secondPackageCommits = await getAllPackageCommitsInRange({
                to: 'HEAD',
                pkgInfo: secondPackageInfo,
                cwd: tmpDir.name,
            })
            expect(firstPackageCommits).toHaveLength(3)
            expectContainingMessages(firstPackageCommits, [
                firstPackageInitCommit,
                firstPackageSecondCommit,
                globalCommit,
            ])
            expect(secondPackageCommits).toHaveLength(2)
            expectContainingMessages(secondPackageCommits, [secondPackageCommit, globalCommit])
        })
        it('Should respect "from" and "to" ranges', async () => {
            const firstPackageCommits = await getAllPackageCommitsInRange({
                from: 'pkg1@1.0.0',
                to: 'pkg1@2.0.0',
                pkgInfo: firstPackageInfo,
                cwd: tmpDir.name,
            })
            expect(firstPackageCommits).toHaveLength(1)
            expectContainingMessages(firstPackageCommits, [firstPackageSecondCommit])
        })
    })
    it('should respect single "to" parameter', async () => {
        const firstPackageCommits = await getAllPackageCommitsInRange({
            to: 'pkg1@1.0.0',
            pkgInfo: firstPackageInfo,
            cwd: tmpDir.name,
        })
        expect(firstPackageCommits).toHaveLength(1)
        expectContainingMessages(firstPackageCommits, [firstPackageInitCommit])
    })
    it('should throw on invalid ranges', async () => {
        await expect(
            getAllPackageCommitsInRange({
                to: crypto.randomBytes(20).toString('hex'),
                pkgInfo: firstPackageInfo,
                cwd: tmpDir.name,
            })
        ).rejects.toThrow()
        await expect(
            getAllPackageCommitsInRange({
                from: crypto.randomBytes(20).toString('hex'),
                to: 'HEAD',
                pkgInfo: firstPackageInfo,
                cwd: tmpDir.name,
            })
        ).rejects.toThrow()
    })
})
