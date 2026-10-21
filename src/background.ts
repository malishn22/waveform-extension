import { HOST_NAME } from '../extension-id'
import type { HelperMessage, Playback, ToBackground, ToContent, ToHelper } from './messages'

// Discord rejects details/state shorter than 2 or longer than 128 characters.
const clip = (s: string) => (s.length >= 2 ? s.slice(0, 128) : s.padEnd(2, ' '))

let port: chrome.runtime.Port | undefined
let activeTab: number | undefined
let site: { siteName?: string; favicon?: string } = {}

function tell(state: ToContent['state'], detail?: string) {
  if (activeTab === undefined) return
  const msg: ToContent = { type: 'status', state, detail, ...site }
  chrome.tabs.sendMessage(activeTab, msg).catch(() => {})
}

// Chrome's own wording when the host isn't registered or the ID isn't allowed.
function explain(err: string) {
  if (/not found/i.test(err)) return 'Helper not installed'
  if (/forbidden/i.test(err)) return 'Helper not allowed for this extension ID'
  if (/exited/i.test(err)) return 'Helper crashed or missing config'
  return err
}

function connect() {
  if (port) return port
  const p = chrome.runtime.connectNative(HOST_NAME)
  p.onMessage.addListener((m: HelperMessage) => {
    if (m.status === 'activity-set') tell('ok')
    else if (m.status === 'error') tell('error', m.detail)
  })
  p.onDisconnect.addListener(() => {
    port = undefined
    tell('error', explain(chrome.runtime.lastError?.message ?? 'Helper disconnected'))
  })
  port = p
  return p
}

function post(msg: ToHelper) {
  connect().postMessage(msg)
}

function setPresence(tabId: number, p: Playback) {
  activeTab = tabId
  site = { siteName: p.siteName, favicon: p.favicon }
  if (p.paused) return post({ cmd: 'CLEAR' })
  const start = Math.round(Date.now() - p.position * 1000)
  const activity = {
    type: 2, // Listening
    name: p.siteName,
    details: clip(p.title),
    state: clip(p.subtitle || p.siteName),
    status_display_type: 0, // member list shows "Listening to <site>"; the profile card is unaffected
    details_url: p.url,
    ...(p.duration > 0 && { timestamps: { start, end: Math.round(start + p.duration * 1000) } }),
    // Discord prints large_text as the card's third line for Listening, so don't repeat the
    // title there; use it for site extras (BPM/key) when there are any.
    ...(p.art && { assets: { large_image: p.art, ...(p.extra && { large_text: clip(p.extra) }) } }),
  }
  post({ cmd: 'SET_ACTIVITY', site: p.siteId, activity })
}

chrome.runtime.onMessage.addListener((msg: ToBackground, sender) => {
  // Only accept messages from our own content scripts, never other extensions or pages.
  if (sender.id !== chrome.runtime.id || sender.tab?.id === undefined) return
  if (msg.type === 'playback') setPresence(sender.tab.id, msg)
  else if (msg.type === 'stopped' && sender.tab.id === activeTab) port?.postMessage({ cmd: 'CLEAR' })
})

chrome.tabs.onRemoved.addListener((id) => {
  if (id !== activeTab) return
  port?.postMessage({ cmd: 'CLEAR' })
  activeTab = undefined
})
