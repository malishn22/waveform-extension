// Registers this helper as a Chrome Native Messaging host for the current user.
// Chrome finds hosts by name: on Windows via a registry key whose default value is the
// manifest path, on macOS/Linux via a <name>.json file in a per-browser directory.
// https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging#native-messaging-host-location
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EXTENSION_ID, HOST_NAME } from '../../extension-id'
import { baseDir, isSea } from './paths'

const WIN_KEYS = [
  'Software\\Google\\Chrome',
  'Software\\Microsoft\\Edge',
  'Software\\BraveSoftware\\Brave-Browser',
  'Software\\Chromium',
].map((k) => `HKCU\\${k}\\NativeMessagingHosts\\${HOST_NAME}`)

function unixBrowserDirs(): string[] {
  const home = os.homedir()
  const rel =
    process.platform === 'darwin'
      ? ['Google/Chrome', 'Microsoft Edge', 'BraveSoftware/Brave-Browser', 'Chromium'].map((d) =>
          path.join(home, 'Library', 'Application Support', d),
        )
      : ['google-chrome', 'microsoft-edge', 'BraveSoftware/Brave-Browser', 'chromium'].map((d) =>
          path.join(home, '.config', d),
        )
  return rel
}

// Chrome can only launch an executable. In dev, write a wrapper that runs node with
// an absolute path, since Chrome doesn't inherit your shell's PATH (notably on macOS).
export function hostExecutable(): string {
  if (isSea()) return process.execPath
  const bundle = path.resolve(__dirname, 'main.cjs')
  if (process.platform === 'win32') {
    const p = path.join(baseDir(), 'waveform-helper-dev.cmd')
    fs.writeFileSync(p, `@echo off\r\n"${process.execPath}" "${bundle}" %*\r\n`)
    return p
  }
  const p = path.join(baseDir(), 'waveform-helper-dev.sh')
  fs.writeFileSync(p, `#!/bin/sh\nexec "${process.execPath}" "${bundle}" "$@"\n`, { mode: 0o755 })
  return p
}

function manifest(exe: string) {
  return JSON.stringify(
    {
      name: HOST_NAME,
      description: 'Waveform Presence helper',
      path: exe,
      type: 'stdio',
      allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
    },
    null,
    2,
  )
}

export function install() {
  const body = manifest(hostExecutable())
  if (process.platform === 'win32') {
    const file = path.join(baseDir(), `${HOST_NAME}.json`)
    fs.writeFileSync(file, body)
    for (const key of WIN_KEYS) {
      execFileSync('reg', ['add', key, '/ve', '/t', 'REG_SZ', '/d', file, '/f'], { stdio: 'ignore' })
      console.log(`registered  ${key}`)
    }
    console.log(`manifest    ${file}`)
  } else {
    const dirs = unixBrowserDirs()
    // Only browsers that exist; fall back to Chrome so a fresh install still works.
    const present = dirs.filter((d) => fs.existsSync(d))
    for (const d of present.length ? present : [dirs[0]]) {
      const dir = path.join(d, 'NativeMessagingHosts')
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, `${HOST_NAME}.json`), body)
      console.log(`registered  ${dir}`)
    }
  }
  console.log(`extension   ${EXTENSION_ID}`)
  console.log('Done. Reload the extension in your browser.')
}

export function uninstall() {
  if (process.platform === 'win32') {
    for (const key of WIN_KEYS) {
      try {
        execFileSync('reg', ['delete', key, '/f'], { stdio: 'ignore' })
        console.log(`removed     ${key}`)
      } catch {}
    }
    fs.rmSync(path.join(baseDir(), `${HOST_NAME}.json`), { force: true })
  } else {
    for (const d of unixBrowserDirs()) {
      const f = path.join(d, 'NativeMessagingHosts', `${HOST_NAME}.json`)
      if (fs.existsSync(f)) {
        fs.rmSync(f)
        console.log(`removed     ${f}`)
      }
    }
  }
  for (const f of ['waveform-helper-dev.cmd', 'waveform-helper-dev.sh']) {
    fs.rmSync(path.join(baseDir(), f), { force: true })
  }
}
