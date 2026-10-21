import { $, absUrl, meta, parseTime, text } from './dom'
import type { Site, Track } from './types'

// Fan collection pages (bandcamp.com/<username>, yours or anyone's) play through a bottom
// "carousel" player built with Knockout. Its data-bind attributes name the field they show
// (currentTrack().trackTitle, .artist, .title = album, .artURL), so key on those rather than on
// layout classes. Checked against a live collection page on 2026-10-21.
const bind = (field: string) => `#carousel-player [data-bind*="currentTrack().${field}"]`

function readCollection(audio: HTMLAudioElement | null): Track | null {
  let title = text(bind('trackTitle'))
  if (!title || !audio?.src) return null
  let subtitle = text(bind('artist'))
  // Compilations list the real artist in the track title: "Machka - Noise 11%".
  const split = /^(.+?) - (.+)$/.exec(title)
  if (split && /^various( artists)?$/i.test(subtitle)) [, subtitle, title] = split
  const album = text(bind('title'))
  return {
    title,
    subtitle,
    art: absUrl($<HTMLImageElement>(`${bind('artURL')}`)?.src),
    // The player's own title link has no href; the "buy now" link carries the release URL.
    url: absUrl($<HTMLAnchorElement>('#carousel-player [data-bind*="tralbumBuyUrl"]')?.getAttribute('href')) ?? location.href,
    position: audio.currentTime,
    duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    paused: audio.paused,
    extra: album && album !== title ? album : undefined,
  }
}

// Album/track pages use an inline player; bandcamp.com/discover has its own player.
export const bandcamp: Site = {
  id: 'bandcamp',
  name: 'Bandcamp',
  matches: (host) => host === 'bandcamp.com' || host.endsWith('.bandcamp.com'),
  read() {
    const audio = $<HTMLAudioElement>('audio')
    if ($('#carousel-player')) return readCollection(audio)
    const discover = $('.discover-player')

    const title = discover
      ? text('.discover-player .player-info .title')
      : text('.title-section .title') || text('#name-section h2.trackTitle')
    if (!title) return null

    const subtitle = discover
      ? text('.discover-player .player-info a')
      : text('#name-section h3 span a') || meta('og:site_name')

    const art = absUrl(
      $<HTMLImageElement>('#tralbumArt img')?.src ||
        $<HTMLImageElement>('.discover-player img')?.src ||
        meta('og:image'),
    )

    let position: number
    let duration: number
    let paused: boolean
    if (audio && audio.src) {
      position = audio.currentTime
      duration = Number.isFinite(audio.duration) ? audio.duration : 0
      paused = audio.paused
    } else {
      position = parseTime(text(discover ? '.playback-time.current' : '.time_elapsed'))
      duration = parseTime(text(discover ? '.playback-time.total' : '.time_total'))
      paused = !$('.playbutton.playing') && navigator.mediaSession?.playbackState !== 'playing'
    }

    // Album for the card's third line, like Spotify. Album pages: the page heading is the album.
    // Track pages: "from <album> by <artist>". Standalone singles have neither.
    const album = discover
      ? ''
      : meta('og:type') === 'album'
        ? text('#name-section h2.trackTitle')
        : text('#name-section .fromAlbum')
    const extra = album && album !== title ? album : undefined

    return { title, subtitle, art, url: location.href, position, duration, paused, extra }
  },
}
