import type { Signale } from 'signale'

export type IgnoringDependencies = Record<string, Array<string>>

export type MonoPubContext = {
    /** Path to start scanning from, process.cwd() by default */
    cwd: string
    /** Plugins shared environment, process.env by default */
    env: Record<string, string | undefined>
    /** Context-specific logger which can be used by plugins to display progress  */
    logger: Signale<'info' | 'error' | 'log' | 'success'>
    /**
     * List of dependencies per package, which should not affect its version bump.
     * Might be helpful to break cyclic dependencies, so proper release order can be resolved
     * */
    ignoreDependencies: IgnoringDependencies
}

export type MonoPubOptions = Partial<
    Pick<MonoPubContext, 'cwd' | 'env' | 'ignoreDependencies'> & {
        stdout: NodeJS.WriteStream
        stderr: NodeJS.WriteStream
    }
>
