import { $, absUrl, meta, parseTime, sessionMetadata, text } from './dom'
import type { Site, Track } from './types'

// Compilations list the real artist in the track title: "Machka - Noise 11%" by "Various Artists".
function splitVarious(title: string, artist: string) {
  const split = /^(.+?) - (.+)$/.exec(title)
  return split && /^various( artists)?$/i.test(artist)
    ? { title: split[2], subtitle: split[1] }
    : { title, subtitle: artist }
}

// Playlist pages (bandcamp.com/<user>/playlist/<slug>) are a separate Vue app whose audio is not
// in the DOM. The page keeps navigator.mediaSession current (metadata and playbackState), and its
// scrubber is a range input whose value/max are position/duration in seconds. Checked against a
// live playlist on 2026-10-27.
function readPlaylist(): Track | null {
  const session = sessionMetadata()
  if (!session) return null
  const { title, subtitle } = splitVarious(session.title, session.artist)
  const range = $<HTMLInputElement>('.track-progress input[type="range"]')
  const [elapsed, total] = [...document.querySelectorAll('.track-progress .time')].map((e) =>
    parseTime(e.textContent ?? ''),
  )
  const row = $('.track-list-item.currently-playing')
  const link = row?.querySelector<HTMLAnchorElement>('a[href*="/track/"], a[href*="/album/"]')
  return {
    title,
    subtitle,
    art: absUrl(session.art),
    url: absUrl(link?.getAttribute('href')) ?? location.href,
    position: range ? Number(range.value) || 0 : (elapsed ?? 0),
    duration: range ? Number(range.max) || 0 : (total ?? 0),
    paused: navigator.mediaSession.playbackState !== 'playing',
    extra: session.album && session.album !== title ? session.album : undefined,
  }
}

// Fan collection pages (bandcamp.com/<username>, yours or anyone's) play through a bottom
// "carousel" player built with Knockout. Its data-bind attributes name the field they show
// (currentTrack().trackTitle, .artist, .title = album, .artURL), so key on those rather than on
// layout classes. Checked against a live collection page on 2026-10-21.
const bind = (field: string) => `#carousel-player [data-bind*="currentTrack().${field}"]`

function stripLabel(title: string, album: string, buyUrl: string | undefined) {
  const split = /^(.+?) - (.+)$/.exec(title)
  if (!split) return title
  const slug = split[1].toLowerCase().replace(/[^a-z0-9]/g, '')
  const account = buyUrl ? new URL(buyUrl).hostname.split('.')[0] : ''
  return slug === account || split[2] === album ? split[2] : title
}

function readCollection(audio: HTMLAudioElement | null): Track | null {
  const rawTitle = text(bind('trackTitle'))
  if (!rawTitle || !audio?.src) return null
  const album = text(bind('title'))
  // The player's own title link has no href; the "buy now" link carries the release URL.
  const buyUrl = absUrl($<HTMLAnchorElement>('#carousel-player [data-bind*="tralbumBuyUrl"]')?.getAttribute('href'))
  const various = splitVarious(rawTitle, text(bind('artist')))
  const title = various.title === rawTitle ? stripLabel(rawTitle, album, buyUrl) : various.title
  const { subtitle } = various
  return {
    title,
    subtitle,
    art: absUrl($<HTMLImageElement>(`${bind('artURL')}`)?.src),
    url: buyUrl ?? location.href,
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
    if (location.pathname.includes('/playlist/')) return readPlaylist()
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
