import { getOriginUrl } from '@/utils/branches'
import { dirSync } from 'tmp'
import execa from 'execa'
import type { DirResult } from 'tmp'

describe('getOriginUrl', () => {
    let tmpDir: DirResult
    beforeEach(() => {
        tmpDir = dirSync({ unsafeCleanup: true })
    })
    afterEach(() => {
        tmpDir.removeCallback()
    })
    it('Should return null if no git repo found in directory', async () => {
        const url = await getOriginUrl(tmpDir.name)
        expect(url).toBeNull()
    })
    it('Should return null if git repo is setup with no origin remote', async () => {
        await execa('git', ['init'], { cwd: tmpDir.name })
        const url = await getOriginUrl(tmpDir.name)
        expect(url).toBeNull()
    })
    it('Should return origin url if it specified in git config', async () => {
        const remoteUrl = 'https://github.com/OWNER/REPOSITORY.git'
        await execa('git', ['init'], { cwd: tmpDir.name })
        await execa('git', ['remote', 'add', 'origin', remoteUrl], { cwd: tmpDir.name })
        const url = await getOriginUrl(tmpDir.name)
        expect(url).toBe(remoteUrl)
    })
})
