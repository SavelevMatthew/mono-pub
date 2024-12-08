import fs from 'fs'
import path from 'path'
import execa from 'execa'
import { dirSync, setGracefulCleanup } from 'tmp'
import { name } from '../package.json'

import type { MonoPubPlugin, MonoPubContext, BasePackageInfo } from 'mono-pub'

interface MonoPubNpmConfig {
    envTokenKey: string
    distTag: string
    dryRun: boolean
    provenance: boolean
}

const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org'

const DEFAULT_NPM_CONFIG: MonoPubNpmConfig = {
    envTokenKey: 'NPM_TOKEN',
    distTag: 'latest',
    dryRun: false,
    provenance: false,
}

class MonoPubNpm implements MonoPubPlugin {
    name = name
    readonly config = DEFAULT_NPM_CONFIG
    private readonly npmConfigFile: string = '.npmrc'

    constructor(config?: Partial<MonoPubNpmConfig>) {
        setGracefulCleanup()
        const tmpDir = dirSync()
        this.npmConfigFile = path.join(tmpDir.name, '.npmrc')
        this.config = { ...DEFAULT_NPM_CONFIG, ...config }
    }

    async setup(ctx: MonoPubContext): Promise<boolean> {
        const npmToken = ctx.env[this.config.envTokenKey]
        if (!npmToken) {
            ctx.logger.error(
                `No npm token found in mono-pub environment (key: "${this.config.envTokenKey}"). ` +
                    `Make sure you specified it in env and provided "envTokenKey" in plugin config in case it is stored not under "${DEFAULT_NPM_CONFIG.envTokenKey}" key`
            )
            return false
        }

        const url = new URL(DEFAULT_NPM_REGISTRY)
        const hostPrefix = `//${url.host}/:`
        fs.writeFileSync(this.npmConfigFile, `${hostPrefix}_authToken=\${NPM_TOKEN}`)

        try {
            await execa(
                'npm',
                ['whoami', '--no-workspaces', '--userconfig', this.npmConfigFile, '--registry', DEFAULT_NPM_REGISTRY],
                {
                    env: { NPM_TOKEN: npmToken },
                }
            )
        } catch {
            ctx.logger.error('Invalid NPM auth token was provided!')
            return false
        }

        return true
    }

    async publish(packageInfo: BasePackageInfo, ctx: MonoPubContext): Promise<void> {
        const npmToken = ctx.env[this.config.envTokenKey]
        const runDir = path.dirname(packageInfo.location)
        const args = ['publish', '--tag', this.config.distTag, '--userconfig', this.npmConfigFile, '--no-workspaces']
        if (this.config.dryRun) {
            args.push('--dry-run')
        }
        if (this.config.provenance) {
            args.push('--provenance')
        }

        await execa('npm', args, { cwd: runDir, env: { NPM_TOKEN: npmToken } })
    }
}

/**
 * Creates MonoPubNpm plugin
 * @param [config] {Partial<MonoPubNpmConfig>}
 * @return {MonoPubPlugin}
 */
export default function npm(config?: Partial<MonoPubNpmConfig>) {
    return new MonoPubNpm(config)
}
