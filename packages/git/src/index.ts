import { name } from '../package.json'
import {
    NAME_PLACEHOLDER,
    VERSION_PLACEHOLDER,
    DEFAULT_TAG_FORMAT,
    getLatestReleases,
    getMergedTags,
    isValidTagFormat,
    getTagFromVersion,
    pushNewVersionTag,
} from '@/utils/tags'
import { getAllPackageCommits } from '@/utils/commits'
import { getOriginUrl } from '@/utils/branches'
import type {
    BasePackageInfo,
    LatestPackagesReleases,
    MonoPubContext,
    MonoPubPlugin,
    PackageInfoWithLatestRelease,
    ReleasedPackageInfo,
} from 'mono-pub'

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

    async setup(ctx: MonoPubContext): Promise<boolean> {
        const origin = await getOriginUrl(ctx.cwd)
        if (!origin) {
            ctx.logger.log('Current repo has no origin, which is required for pushing new tag after release')
            return false
        }

        return true
    }

    async getLastRelease(packages: Array<BasePackageInfo>, ctx: MonoPubContext): Promise<LatestPackagesReleases> {
        const tags = await getMergedTags(ctx.cwd)
        const packageNames = packages.map((pkg) => pkg.name)
        return getLatestReleases(tags, packageNames, this.tagFormat)
    }

    async extractCommits(pkgInfo: PackageInfoWithLatestRelease, ctx: MonoPubContext): Promise<Array<string>> {
        const latestRelease = pkgInfo.latestRelease
        const latestTag = latestRelease ? getTagFromVersion(this.tagFormat, pkgInfo.name, latestRelease) : null
        return await getAllPackageCommits(pkgInfo, latestTag, ctx.cwd)
    }

    async postPublish(packageInfo: ReleasedPackageInfo, ctx: MonoPubContext): Promise<void> {
        await pushNewVersionTag(this.tagFormat, packageInfo.name, packageInfo.newVersion, ctx.cwd)
    }
}

export type MonoPubGitConfig = {
    tagFormat?: string
}

export default function git(config: MonoPubGitConfig = {}): MonoPubPlugin {
    return new MonoPubGit(config.tagFormat)
}
