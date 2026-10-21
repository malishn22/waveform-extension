// PreMiD-style "Now showing" pill. Closed shadow root so page CSS can't touch it.
const COLORS = { ok: '#23c55e', connecting: '#f59e0b', error: '#ef4444' }

const CSS = `
:host { all: initial }
.pill {
  position: fixed; top: 16px; left: 16px; z-index: 2147483647;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 18px 10px 10px; border-radius: 999px;
  background: #1c1e24; color: #fff; font: 13px/1.25 system-ui, sans-serif;
  box-shadow: 0 4px 16px rgba(0,0,0,.4);
  opacity: 0; transform: translateX(-12px);
  transition: opacity .25s, transform .25s;
}
.pill.in { opacity: 1; transform: none }
.logo { position: relative; width: 36px; height: 36px }
.logo img { width: 36px; height: 36px; border-radius: 50%; background: #2a2d35; object-fit: cover }
.dot { position: absolute; left: -2px; bottom: 0; width: 10px; height: 10px;
  border-radius: 50%; border: 2px solid #1c1e24 }
.sub { color: #a1a5b0; font-size: 12px }
.name { font-weight: 700; font-size: 15px }
@media (prefers-reduced-motion: reduce) { .pill { transition: none } }
`

let host: HTMLElement | undefined
let hideTimer: number | undefined

export function showToast(
  state: keyof typeof COLORS,
  siteName: string,
  favicon?: string,
  detail?: string,
) {
  host?.remove()
  clearTimeout(hideTimer)
  host = document.createElement('div')
  const root = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = CSS

  const pill = document.createElement('div')
  pill.className = 'pill'

  const logo = document.createElement('div')
  logo.className = 'logo'
  const img = document.createElement('img')
  if (favicon) img.src = favicon
  const dot = document.createElement('span')
  dot.className = 'dot'
  dot.style.background = COLORS[state]
  logo.append(img, dot)

  const text = document.createElement('div')
  const sub = document.createElement('div')
  sub.className = 'sub'
  sub.textContent = state === 'ok' ? 'Now showing' : (detail ?? 'Presence unavailable')
  const name = document.createElement('div')
  name.className = 'name'
  name.textContent = siteName
  text.append(sub, name)

  pill.append(logo, text)
  root.append(style, pill)
  document.documentElement.append(host)
  requestAnimationFrame(() => pill.classList.add('in'))

  const el = host
  hideTimer = window.setTimeout(() => {
    pill.classList.remove('in')
    window.setTimeout(() => el.remove(), 300)
  }, state === 'ok' ? 4000 : 6000)
}
