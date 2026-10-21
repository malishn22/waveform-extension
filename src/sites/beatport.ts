import { $, absUrl, parseTime, sessionMetadata, text } from './dom'
import type { Site } from './types'

// Checked against the live player on 2026-10-21. Beatport is a Next.js app with CSS-module class
// names ("Player_bpmInfo__KEJ2J"), so prefer its data-testid hooks and match class prefixes only
// where there is none. The player renders a large or small layout depending on window width;
// these selectors work in both. Audio is not in the DOM, so timing comes from the clock text.
export const beatport: Site = {
  id: 'beatport',
  name: 'Beatport',
  matches: (host) => host === 'beatport.com' || host.endsWith('.beatport.com'),
  read() {
    const session = sessionMetadata()
    // DOM fallback: name and mix are separate elements ("DANGER DANGER" + "Extended").
    const name = text('[class*="Player_trackName"]')
    const mix = text('[class*="Player_mixName"]')
    const title = session?.title || (name && mix ? `${name} (${mix})` : name)
    if (!title) return null
    const subtitle =
      session?.artist ||
      [...document.querySelectorAll('[class*="Player_artists"] a')]
        .map((a) => a.textContent?.trim())
        .filter(Boolean)
        .join(', ')
    const art = absUrl(session?.art || $<HTMLImageElement>('[data-testid="player-artwork"] img')?.src)

    const state = navigator.mediaSession?.playbackState
    const paused = state ? state !== 'playing' : !$('[data-testid="player-control-pause_track"]')

    const position = parseTime(text('[data-testid="player-clock-played_time"]'))
    const duration = parseTime(text('[class*="Clock_total"]'))

    // Two <p class="Player_bpmInfo…">: "130 bpm" and "A major".
    const info = [...document.querySelectorAll('[class*="Player_bpmInfo"]')].map(
      (e) => e.textContent?.trim() ?? '',
    )
    const bpm = info.find((t) => /^\d+\s*bpm$/i.test(t))?.replace(/bpm/i, 'BPM')
    const key = info.find((t) => /\b(major|minor)$/i.test(t))
    const extra = [bpm, key].filter(Boolean).join(' · ') || undefined

    return { title, subtitle, art, url: location.href, position, duration, paused, extra }
  },
}
