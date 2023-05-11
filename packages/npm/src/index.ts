import { name } from '../package.json'
import execa from 'execa'
import tmp from 'tmp'
import fs from 'fs'
import path from 'path'

import type { MonoPubPlugin, MonoPubContext } from 'mono-pub'

type MonoPubNpmConfig = {
    envTokenKey: string
}

const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org'

const DEFAULT_NPM_CONFIG: MonoPubNpmConfig = {
    envTokenKey: 'NPM_TOKEN',
}

class MonoPubNpm implements MonoPubPlugin {
    name = name
    config = DEFAULT_NPM_CONFIG
    npmConfigFile = '.npmrc'

    constructor(config?: MonoPubNpmConfig) {
        tmp.setGracefulCleanup()
        const tmpDir = tmp.dirSync()
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
        } catch (err) {
            ctx.logger.error('Invalid NPM auth token was provided!')
            return false
        }

        return true
    }
}

export default function npm(config?: MonoPubNpmConfig) {
    return new MonoPubNpm(config)
}
