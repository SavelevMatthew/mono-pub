import { name } from '../package.json'
import {
    DEFAULT_TAG_FORMAT,
    getLatestReleases,
    getMergedTags,
    isValidTagFormat,
    NAME_PLACEHOLDER,
    VERSION_PLACEHOLDER,
} from '@/utils/tags'
import type { BasePackageInfo, LastReleaseInfo, MonoPubContext, MonoPubPlugin } from 'mono-pub'

class MonoPubGit implements MonoPubPlugin {
    name = name
    tagFormat = DEFAULT_TAG_FORMAT

    constructor(tagFormat?: string) {
        if (tagFormat) {
            if (!isValidTagFormat(tagFormat)) {
                throw new TypeError(
                    `Invalid tag format. Valid tag must contains 1 and only 1 ${VERSION_PLACEHOLDER} and ${NAME_PLACEHOLDER} fragment`
                )
            }
            this.tagFormat = tagFormat
        }
    }

    async getLastRelease(packages: Array<BasePackageInfo>, ctx: MonoPubContext): Promise<LastReleaseInfo> {
        const tags = await getMergedTags(ctx.cwd)
        const packageNames = packages.map((pkg) => pkg.name)
        return getLatestReleases(tags, packageNames, this.tagFormat)
    }
}

export type MonoPubGitConfig = {
    tagFormat?: string
}

export default function git(config: MonoPubGitConfig = {}): MonoPubPlugin {
    return new MonoPubGit(config.tagFormat)
}
