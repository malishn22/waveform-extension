import { defineManifest } from '@crxjs/vite-plugin'
import { EXTENSION_KEY } from './extension-id'

export default defineManifest({
  manifest_version: 3,
  name: 'Waveform Presence',
  version: '0.1.0',
  // Fixed public key => same extension ID on every PC, so the helper's
  // allowed_origins matches without per-machine edits.
  key: EXTENSION_KEY,
  permissions: ['nativeMessaging'],
  background: { service_worker: 'src/background.ts', type: 'module' },
  content_scripts: [
    {
      matches: [
        'https://bandcamp.com/*',
        'https://*.bandcamp.com/*',
        'https://*.beatport.com/*',
        'https://soundcloud.com/*',
      ],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
})
