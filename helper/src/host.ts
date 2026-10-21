// Native Messaging mode: Chrome launches us, talks over stdio, kills us when the port closes.
// Chrome framing: [length uint32 native-endian][JSON]. stdout is the protocol — log to stderr.
// https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging
import type { HelperMessage, ToHelper } from '../../src/messages'
import { DiscordIpc } from './ipc'
import { clientIdFor, loadConfig } from './paths'

const log = (...a: unknown[]) => console.error('[waveform]', ...a)

function reply(msg: HelperMessage) {
  const body = Buffer.from(JSON.stringify(msg))
  const head = Buffer.alloc(4)
  head.writeUInt32LE(body.length, 0)
  process.stdout.write(Buffer.concat([head, body]))
}

export function runHost() {
  const cfg = loadConfig()
  let ipc: DiscordIpc | null = null
  let wanted: { clientId: string; activity: Record<string, unknown> } | null = null
  let retry: NodeJS.Timeout | undefined

  function flush() {
    if (!ipc?.ready) return
    ipc.setActivity(wanted?.activity)
  }

  async function open(clientId: string) {
    clearTimeout(retry)
    retry = undefined
    ipc?.destroy()
    const c = new DiscordIpc(clientId)
    ipc = c
    c.on('ready', () => {
      reply({ status: 'ready' })
      flush()
    })
    c.on('response', (m) => {
      if (m.cmd === 'SET_ACTIVITY' && wanted) reply({ status: 'activity-set' })
    })
    c.on('rejected', (m) =>
      reply({ status: 'error', code: 'rejected', detail: m.data?.message ?? 'Discord rejected the activity' }),
    )
    c.on('close', () => {
      if (ipc !== c) return
      ipc = null
      reply({ status: 'error', code: 'lost', detail: 'Discord closed the connection' })
      scheduleRetry()
    })
    const res = await c.connect()
    if (res !== 'ok' && ipc === c) {
      ipc = null
      const detail =
        res === 'denied' ? 'Discord runs as admin: install the relay' : "Discord isn't running"
      reply({ status: 'error', code: 'no-discord', detail })
      scheduleRetry()
    }
  }

  // Keep trying while there is something to show, so starting Discord later just works.
  function scheduleRetry() {
    clearTimeout(retry)
    retry = setTimeout(() => {
      retry = undefined
      if (wanted) void open(wanted.clientId)
    }, 5000)
  }

  function handle(msg: ToHelper) {
    if (msg.cmd === 'CLEAR') {
      wanted = null
      return flush()
    }
    if (msg.cmd !== 'SET_ACTIVITY') return
    const clientId = cfg && clientIdFor(cfg, msg.site)
    if (!clientId) {
      reply({ status: 'error', code: 'config', detail: 'No Discord client ID in helper config.json' })
      return
    }
    wanted = { clientId, activity: msg.activity }
    // Each site can have its own Discord application, so switching sites reconnects.
    if (ipc?.ready && ipc.clientId === clientId) return flush()
    // A live ipc that isn't ready is mid-handshake: 'ready' will flush.
    // No ipc but a retry pending: the retry will pick this up.
    if (ipc?.clientId === clientId) return
    if (!ipc && retry) return
    void open(clientId)
  }

  let inbuf = Buffer.alloc(0)
  process.stdin.on('data', (d: Buffer) => {
    inbuf = Buffer.concat([inbuf, d])
    while (inbuf.length >= 4) {
      const len = inbuf.readUInt32LE(0)
      if (inbuf.length < 4 + len) break
      try {
        handle(JSON.parse(inbuf.subarray(4, 4 + len).toString()))
      } catch (e) {
        log('bad message', e)
      }
      inbuf = inbuf.subarray(4 + len)
    }
  })

  // Chrome closed the port (extension reloaded, browser quit): clear, then exit.
  process.stdin.on('end', () => {
    clearTimeout(retry)
    if (ipc?.ready) {
      ipc.setActivity(undefined)
      setTimeout(() => process.exit(0), 200)
    } else process.exit(0)
  })
}
