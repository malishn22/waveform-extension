export const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)

export const text = (sel: string) => $(sel)?.textContent?.trim() || ''

export const meta = (prop: string) =>
  $<HTMLMetaElement>(`meta[property="${prop}"]`)?.content || ''

// "1:23", "01:02:03", "-2:30" -> seconds (sign dropped).
export function parseTime(s: string): number {
  const parts = s.replace(/[^\d:]/g, '').split(':').filter(Boolean).map(Number)
  if (!parts.length || parts.some(Number.isNaN)) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

export function absUrl(u: string | null | undefined) {
  if (!u) return undefined
  try {
    return new URL(u, location.href).href
  } catch {
    return undefined
  }
}

// mediaSession is backed by the browser, so the isolated world sees what the page set.
export function sessionMetadata() {
  const m = navigator.mediaSession?.metadata
  if (!m?.title) return null
  const art = m.artwork?.length ? m.artwork[m.artwork.length - 1].src : undefined
  return { title: m.title, artist: m.artist, art }
}
