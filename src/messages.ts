import type { Site, Track } from './sites'

export type Playback = Track & {
  type: 'playback'
  siteId: Site['id']
  siteName: string
  favicon?: string
}

export type Stopped = { type: 'stopped' }

export type ToContent = {
  type: 'status'
  state: 'connecting' | 'ok' | 'error'
  detail?: string
  siteName?: string
  favicon?: string
}

export type ToBackground = Playback | Stopped

// What the background sends the native helper.
export type ToHelper =
  | { cmd: 'SET_ACTIVITY'; site: Site['id']; activity: Record<string, unknown> }
  | { cmd: 'CLEAR' }

// What the native helper writes to stdout.
export type HelperMessage =
  | { status: 'ready' }
  | { status: 'activity-set' }
  | { status: 'error'; code: 'no-discord' | 'rejected' | 'lost' | 'config'; detail: string }
