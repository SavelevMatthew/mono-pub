import type { Signale } from 'signale'

export type MonoPubContext = {
    cwd: string
    env: Record<string, string | undefined>
    logger: Signale<'info' | 'error' | 'log' | 'success'>
}

export type MonoPubOptions = Partial<
    Pick<MonoPubContext, 'cwd' | 'env'> & {
        stdout: NodeJS.WriteStream
        stderr: NodeJS.WriteStream
    }
>
