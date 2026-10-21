import fs from 'node:fs'
import path from 'node:path'
import * as sea from 'node:sea'

export const isSea = () => {
  try {
    return sea.isSea()
  } catch {
    return false
  }
}

// Packaged: everything lives next to the executable.
// Dev (node helper/dist/main.cjs): the helper/ directory.
export const baseDir = () => (isSea() ? path.dirname(process.execPath) : path.resolve(__dirname, '..'))

export type Config = { clientIds: Partial<Record<string, string>> & { default?: string } }

export function loadConfig(): Config | null {
  const file = process.env.WAVEFORM_CONFIG || path.join(baseDir(), 'config.json')
  try {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8')) as Config
    return cfg.clientIds ? cfg : null
  } catch {
    return null
  }
}

export function clientIdFor(cfg: Config, site: string) {
  return cfg.clientIds[site] || cfg.clientIds.default || Object.values(cfg.clientIds).find(Boolean)
}
