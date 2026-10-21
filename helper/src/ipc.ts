// Minimal client for the Discord desktop app's local RPC over IPC.
// Protocol: https://docs.discord.com/developers/topics/rpc
// Frames are [op int32 LE][length int32 LE][JSON]; op 0 = handshake, 1 = frame, 2 = close.
import { EventEmitter } from 'node:events'
import net from 'node:net'
import path from 'node:path'

const OP_HANDSHAKE = 0
const OP_FRAME = 1

function encode(op: number, payload: unknown) {
  const body = Buffer.from(JSON.stringify(payload))
  const head = Buffer.alloc(8)
  head.writeInt32LE(op, 0)
  head.writeInt32LE(body.length, 4)
  return Buffer.concat([head, body])
}

// Windows: named pipe. macOS/Linux: unix socket in the first of these env dirs (per the docs).
// Flatpak and Snap builds of Discord put the socket in a subdirectory instead — not in
// Discord's docs, but where those packages are known to place it.
export function candidatePaths(): string[] {
  const out: string[] = []
  for (let i = 0; i < 10; i++) {
    if (process.platform === 'win32') {
      out.push(`\\\\?\\pipe\\discord-ipc-${i}`)
      continue
    }
    const { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } = process.env
    const base = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp'
    out.push(path.join(base, `discord-ipc-${i}`))
    if (process.platform === 'linux') {
      out.push(path.join(base, 'app', 'com.discordapp.Discord', `discord-ipc-${i}`))
      out.push(path.join(base, 'snap.discord', `discord-ipc-${i}`))
    }
  }
  return out
}

export function tryConnect(target: string | net.TcpNetConnectOpts): Promise<net.Socket | string> {
  return new Promise((resolve) => {
    const s = typeof target === 'string' ? net.connect(target) : net.connect(target)
    s.once('connect', () => resolve(s))
    s.once('error', (e: NodeJS.ErrnoException) => resolve(e.code ?? 'ERROR'))
  })
}

/** First Discord pipe/socket we can open, or the reason none could be opened. */
export async function openDiscord(): Promise<net.Socket | 'missing' | 'denied'> {
  let denied = false
  for (const p of candidatePaths()) {
    const s = await tryConnect(p)
    if (typeof s !== 'string') return s
    if (s === 'EPERM' || s === 'EACCES') denied = true
  }
  return denied ? 'denied' : 'missing'
}

// Elevated relay (see relay.ts). Loopback only.
export const RELAY = { host: '127.0.0.1', port: 47823 } as const

// 'missing': no Discord listening. 'denied': the pipe exists but we may not open it — on
// Windows, Discord runs as administrator and no relay is running.
export type ConnectResult = 'ok' | 'missing' | 'denied'

type Msg = { cmd?: string; evt?: string | null; data?: { code?: number; message?: string } }

/**
 * Events: 'ready', 'response' (Msg for a command reply), 'rejected' (Msg with evt ERROR),
 * 'close' (the connection dropped after it had opened).
 */
export class DiscordIpc extends EventEmitter {
  private sock: net.Socket | null = null
  private buf = Buffer.alloc(0)
  ready = false

  constructor(readonly clientId: string) {
    super()
  }

  /** Opens the pipe directly, or through the elevated relay when the pipe denies us. */
  async connect(): Promise<ConnectResult> {
    let s: net.Socket | string = await openDiscord()
    if (s === 'denied') {
      const relayed = await tryConnect(RELAY)
      if (typeof relayed === 'string') return 'denied'
      s = relayed
    }
    if (typeof s === 'string') return 'missing'
    const sock = s
    this.sock = sock
    sock.on('data', (d) => this.onData(d))
    sock.on('close', () => {
      const wasOpen = this.sock === sock
      this.ready = false
      this.sock = null
      if (wasOpen) this.emit('close')
    })
    sock.on('error', () => {})
    sock.write(encode(OP_HANDSHAKE, { v: 1, client_id: this.clientId }))
    return 'ok'
  }

  private onData(d: Buffer) {
    this.buf = Buffer.concat([this.buf, d])
    while (this.buf.length >= 8) {
      const len = this.buf.readInt32LE(4)
      if (this.buf.length < 8 + len) break
      const msg: Msg = JSON.parse(this.buf.subarray(8, 8 + len).toString())
      this.buf = this.buf.subarray(8 + len)
      if (msg.evt === 'READY') {
        this.ready = true
        this.emit('ready')
      } else if (msg.evt === 'ERROR') this.emit('rejected', msg)
      else this.emit('response', msg)
    }
  }

  /** Pass undefined to clear the activity. */
  setActivity(activity: Record<string, unknown> | undefined) {
    if (!this.sock || !this.ready) return false
    this.sock.write(
      encode(OP_FRAME, {
        cmd: 'SET_ACTIVITY',
        args: { pid: process.pid, ...(activity && { activity }) },
        nonce: `${Date.now()}-${Math.random()}`,
      }),
    )
    return true
  }

  destroy() {
    const s = this.sock
    this.sock = null
    this.ready = false
    s?.destroy()
  }
}
