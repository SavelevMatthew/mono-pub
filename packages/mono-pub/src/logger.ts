import { Signale } from 'signale'

type GetLoggerLoggerOptions = {
    stdout: NodeJS.WriteStream
    stderr: NodeJS.WriteStream
}

export default function getLogger({ stdout, stderr }: GetLoggerLoggerOptions) {
    return new Signale({
        config: { displayTimestamp: true, displayLabel: false },
        types: {
            error: { color: 'red', label: '', stream: [stderr], badge: '✖' },
            log: { color: 'magenta', label: '', stream: [stdout], badge: '•' },
            success: { color: 'green', label: '', stream: [stdout], badge: '✔' },
            info: { color: 'blue', label: '', stream: [stdout], badge: 'ℹ' },
        },
    })
}
