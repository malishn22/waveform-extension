// Bundles the helper to one CommonJS file, and with --sea packs it into a single
// executable for the current OS (Node SEA: https://nodejs.org/api/single-executable-applications.html).
// SEA can only target the OS it runs on, so CI builds each platform on its own runner.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
fs.mkdirSync(dist, { recursive: true })

const bundle = path.join(dist, 'main.cjs')
await build({
  entryPoints: [path.join(root, 'src', 'main.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
})
console.log(`bundled  ${bundle}`)

if (process.argv.includes('--sea')) {
  const blob = path.join(dist, 'sea-prep.blob')
  const seaConfig = path.join(dist, 'sea-config.json')
  fs.writeFileSync(
    seaConfig,
    JSON.stringify({ main: bundle, output: blob, disableExperimentalSEAWarning: true }),
  )
  execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' })

  const exe = path.join(dist, process.platform === 'win32' ? 'waveform-helper.exe' : 'waveform-helper')
  // Chrome or the relay task may be running the old binary. Windows won't overwrite a running
  // exe but will rename one, so move it aside; the running copy keeps working until restarted.
  if (fs.existsSync(exe)) {
    const old = `${exe}.old`
    try {
      fs.rmSync(old, { force: true })
    } catch {}
    try {
      fs.renameSync(exe, old)
    } catch {
      fs.rmSync(exe, { force: true })
    }
  }
  fs.copyFileSync(process.execPath, exe)
  if (process.platform === 'darwin') execFileSync('codesign', ['--remove-signature', exe])

  const { inject } = await import('postject')
  await inject(exe, 'NODE_SEA_BLOB', fs.readFileSync(blob), {
    sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
    ...(process.platform === 'darwin' && { machoSegmentName: 'NODE_SEA' }),
  })
  // macOS refuses to run an unsigned arm64 binary; an ad-hoc signature is enough locally.
  if (process.platform === 'darwin') execFileSync('codesign', ['--sign', '-', exe])

  fs.copyFileSync(path.join(root, 'config.example.json'), path.join(dist, 'config.example.json'))
  fs.rmSync(blob)
  fs.rmSync(seaConfig)
  console.log(`packaged ${exe}`)
}
