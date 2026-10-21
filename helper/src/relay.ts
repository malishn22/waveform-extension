// Elevated relay for when Discord runs as administrator (Windows).
// An elevated Discord creates its IPC pipe with a high-integrity ACL, so the helper — which Chrome
// always starts at normal integrity — gets "access denied". This process runs elevated (started by
// a Task Scheduler task at logon) and forwards raw bytes between a loopback TCP port and the pipe.
// Integrity levels don't apply to loopback TCP, so the normal helper can reach it.
//
// It understands nothing of the protocol: one TCP connection = one Discord pipe connection, so
// Discord still clears the activity when the helper disconnects.
import net from 'node:net'
import { openDiscord, RELAY } from './ipc'

const log = (...a: unknown[]) => console.error(new Date().toISOString(), '[relay]', ...a)

export function runRelay() {
  const server = net.createServer(async (client) => {
    client.pause()
    client.on('error', () => {})
    const pipe = await openDiscord()
    if (typeof pipe === 'string') {
      log(`client refused: Discord ${pipe}`)
      return client.destroy()
    }
    pipe.on('error', () => {})
    const done = () => {
      client.destroy()
      pipe.destroy()
    }
    client.on('close', done)
    pipe.on('close', done)
    client.pipe(pipe)
    pipe.pipe(client)
    client.resume()
  })
  server.on('error', (e: NodeJS.ErrnoException) => {
    // EADDRINUSE: another relay already runs (the task allows only one instance anyway).
    log(e.code === 'EADDRINUSE' ? `port ${RELAY.port} in use` : e)
    process.exit(1)
  })
  server.listen(RELAY.port, RELAY.host, () => log(`listening on ${RELAY.host}:${RELAY.port}`))
}
