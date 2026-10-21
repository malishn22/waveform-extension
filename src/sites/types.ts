export type Track = {
  title: string
  subtitle: string // artist
  art?: string
  url: string
  position: number // seconds
  duration: number // seconds, 0 if unknown
  paused: boolean
  extra?: string // third line on the Discord card, e.g. "130 BPM · A major"
}

export type Site = {
  id: 'bandcamp' | 'beatport' | 'soundcloud'
  name: string
  matches: (host: string) => boolean
  read: () => Track | null
}
