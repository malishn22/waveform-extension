import type { Playback, ToBackground, ToContent } from '../messages'
import { sites, type Track } from '../sites'
import { showToast } from './toast'

const site = sites.find((s) => s.matches(location.hostname))

let timer: number | undefined

// Reloading or updating the extension orphans this script in already-open tabs: chrome.runtime
// loses its id and sendMessage throws "Extension context invalidated" synchronously. The new
// version can't take over an old tab, so stop quietly; refreshing the tab loads the new script.
function send(msg: ToBackground) {
  if (!chrome.runtime?.id) return clearInterval(timer)
  try {
    chrome.runtime.sendMessage(msg).catch(() => {})
  } catch {
    clearInterval(timer)
  }
}

const favicon = () =>
  document.querySelector<HTMLLinkElement>('link[rel~=icon]')?.href ||
  `${location.origin}/favicon.ico`

let last: (Track & { at: number }) | null = null

// Only send on real changes: Discord rate-limits SET_ACTIVITY, and the helper
// re-sends nothing on its own. A seek shows up as position drifting from wall-clock.
function changed(t: Track) {
  if (!last) return true
  if (t.title !== last.title || t.subtitle !== last.subtitle || t.paused !== last.paused) return true
  if (t.extra !== last.extra) return true
  if (t.duration && Math.abs(t.duration - last.duration) > 2) return true
  if (t.paused) return false
  const expected = last.position + (Date.now() - last.at) / 1000
  return Math.abs(t.position - expected) > 3
}

function tick() {
  if (!site) return
  const t = site.read()
  if (!t) {
    if (last) send({ type: 'stopped' })
    last = null
    return
  }
  // Nothing was ever played on this page: don't advertise browsing.
  if (!last && t.paused) return
  if (!changed(t)) return
  last = { ...t, at: Date.now() }
  const msg: Playback = { ...t, type: 'playback', siteId: site.id, siteName: site.name, favicon: favicon() }
  send(msg)
}

if (site) {
  timer = window.setInterval(tick, 1000)
  // Media events don't bubble; capture them on document for an instant update.
  for (const ev of ['play', 'pause', 'seeked', 'ended']) {
    document.addEventListener(ev, () => setTimeout(tick, 50), true)
  }
  addEventListener('pagehide', () => send({ type: 'stopped' }))

  let lastShown = ''
  chrome.runtime.onMessage.addListener((msg: ToContent) => {
    if (msg.type !== 'status' || msg.state === 'connecting') return
    const key = msg.state + (msg.detail ?? '')
    if (key === lastShown) return
    lastShown = key
    showToast(msg.state, msg.siteName ?? site.name, msg.favicon ?? favicon(), msg.detail)
  })
}
