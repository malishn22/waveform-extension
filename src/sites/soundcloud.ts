import { $, absUrl, parseTime, sessionMetadata, text } from './dom'
import type { Site } from './types'

// Everything comes from the bottom player bar, which exists on every page.
export const soundcloud: Site = {
  id: 'soundcloud',
  name: 'SoundCloud',
  matches: (host) => host === 'soundcloud.com' || host.endsWith('.soundcloud.com'),
  read() {
    const session = sessionMetadata()
    const link = $<HTMLAnchorElement>('.playbackSoundBadge__titleLink')
    const title =
      text('.playbackSoundBadge__titleLink > span:nth-child(2)') ||
      link?.textContent?.trim() ||
      session?.title ||
      ''
    if (!title) return null
    const subtitle = text('.playbackSoundBadge__lightLink') || session?.artist || ''

    // Thumbnail is a CSS background; swap the 50x50 variant for 500x500.
    const bg = $('.playbackSoundBadge__avatar span')?.style.backgroundImage ?? ''
    const thumb = /url\("?(.*?)"?\)/.exec(bg)?.[1]?.replace('50x50', '500x500')
    const art = absUrl(thumb || session?.art)

    const position = parseTime(text('.playbackTimeline__timePassed > span:nth-child(2)'))
    const durText = text('.playbackTimeline__duration > span:nth-child(2)')
    // A leading minus means "time remaining" rather than total.
    const duration = durText.startsWith('-') ? position + parseTime(durText) : parseTime(durText)
    const paused = !$('.playControls__play.playing')

    return { title, subtitle, art, url: absUrl(link?.href) ?? location.href, position, duration, paused }
  },
}
