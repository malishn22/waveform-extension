import { EXTENSION_ID } from '../../extension-id'
import { runHost } from './host'
import { hostExecutable, install, uninstall } from './install'
import { DiscordIpc } from './ipc'
import { clientIdFor, loadConfig } from './paths'
import { runRelay } from './relay'
import { installRelay, uninstallRelay } from './task'

const USAGE = `waveform-helper — bridges the Waveform extension to the Discord desktop app

  waveform-helper install           register with Chrome, Edge, Brave and Chromium (current user)
  waveform-helper uninstall         remove those registrations (and the relay task)
  waveform-helper selftest          show a test "Listening" status on Discord for 20s

  Windows, only if Discord runs as administrator (run from an admin terminal):
  waveform-helper install-relay     start an elevated relay at every logon (Task Scheduler)
  waveform-helper uninstall-relay   remove it

Reads config.json next to this program: {"clientIds": {"bandcamp": "...", ...}}`

// Hardcoded activity from the original spike: 2:34 into a 5:42 track.
async function selftest() {
  const cfg = loadConfig()
  const clientId = cfg && clientIdFor(cfg, 'bandcamp')
  if (!clientId) return fail('No client ID: create config.json next to this program.')
  const ipc = new DiscordIpc(clientId)
  ipc.on('rejected', (m) => fail(`Discord rejected it: ${JSON.stringify(m.data)}`))
  ipc.on('response', (m) => m.cmd === 'SET_ACTIVITY' && console.log('Discord accepted the activity.'))
  ipc.on('close', () => fail('Discord closed the connection (check the client ID in config.json).'))
  ipc.once('ready', () => {
    const start = Date.now() - 154_000
    ipc.setActivity({
      type: 2,
      name: 'Bandcamp',
      details: 'Test Song',
      state: 'Test Artist',
      timestamps: { start, end: start + 342_000 },
    })
    console.log('Set. Check your Discord profile; clearing in 20s.')
    setTimeout(() => {
      ipc.setActivity(undefined)
      setTimeout(() => process.exit(0), 300)
    }, 20_000)
  })
  const res = await ipc.connect()
  if (res === 'denied')
    fail(
      'Discord runs as administrator, so normal programs (and Chrome) are denied its pipe.\n' +
        'From an admin terminal, run: waveform-helper install-relay',
    )
  if (res === 'missing') fail("Couldn't reach Discord. Is the desktop app running?")
}

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

// Chrome passes the caller's origin as the first argument (Windows adds --parent-window).
const origin = process.argv.slice(2).find((a) => a.startsWith('chrome-extension://'))
if (origin) {
  if (origin !== `chrome-extension://${EXTENSION_ID}/`) process.exit(1)
  runHost()
} else {
  const cmd = process.argv[2]
  if (cmd === 'install') install()
  else if (cmd === 'uninstall') {
    uninstall()
    uninstallRelay()
  } else if (cmd === 'selftest') void selftest()
  else if (cmd === 'relay') runRelay()
  else if (cmd === 'install-relay') installRelay(hostExecutable())
  else if (cmd === 'uninstall-relay') uninstallRelay()
  else console.log(USAGE)
}
