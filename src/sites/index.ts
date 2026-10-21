import { bandcamp } from './bandcamp'
import { beatport } from './beatport'
import { soundcloud } from './soundcloud'

export const sites = [bandcamp, beatport, soundcloud]
export type { Site, Track } from './types'
