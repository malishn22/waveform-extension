# Waveform Presence

Shows what you're playing on **Bandcamp**, **Beatport** and **SoundCloud** as a Discord
"Listening to…" status, with cover art and a progress bar.

A browser extension can't talk to Discord directly, so a small helper program bridges the two.
The browser starts and stops it on its own.

## Setup

1. Create an application named `Waveform` in the
   [Discord Developer Portal](https://discord.com/developers/applications) and copy its Application ID.
2. Build and load the extension:
   ```
   pnpm install
   pnpm build
   ```
   Then in `chrome://extensions`, turn on Developer mode → Load unpacked → `dist/`.
3. Build the helper (or download it from the GitHub Actions artifacts):
   ```
   pnpm package:helper
   ```
4. Next to `helper/dist/waveform-helper.exe`, create `config.json`:
   ```json
   { "clientIds": { "default": "YOUR_APPLICATION_ID" } }
   ```
5. Register the helper once per PC, then reload the extension:
   ```
   helper/dist/waveform-helper.exe install
   ```

Discord desktop needs to be open. To check the connection, run `waveform-helper selftest`.

**Discord running as administrator (Windows):** run `waveform-helper install-relay` once from an
admin terminal.

## Commands

| Command | What it does |
|---|---|
| `install` / `uninstall` | Register or remove the helper for your browsers |
| `selftest` | Show a test status on Discord for 20 seconds |
| `install-relay` / `uninstall-relay` | Windows only, for Discord running as admin |
