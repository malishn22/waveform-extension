// Registers the elevated relay as a Task Scheduler task (Windows only).
// "Run with highest privileges" + a logon trigger is how Windows starts an elevated program at
// login without a UAC prompt each time; creating the task is the one step that needs admin.
// The task is defined in XML because plain `schtasks /Create` can't turn off the default
// 72-hour execution limit, which would silently kill the relay after three days.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TASK = 'Waveform Relay'

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function taskXml(exe: string) {
  const user = xmlEscape(`${process.env.USERDOMAIN ?? os.hostname()}\\${os.userInfo().username}`)
  // conhost --headless runs the console program without opening a window.
  const conhost = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'conhost.exe')
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Lets the Waveform browser extension reach Discord when Discord runs as administrator.</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger><Enabled>true</Enabled><UserId>${user}</UserId></LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${user}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Hidden>true</Hidden>
    <RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${xmlEscape(conhost)}</Command>
      <Arguments>--headless "${xmlEscape(exe)}" relay</Arguments>
    </Exec>
  </Actions>
</Task>
`
}

function schtasks(args: string[]) {
  return execFileSync('schtasks', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
}

export function installRelay(exe: string) {
  if (process.platform !== 'win32') {
    console.log('The relay is only needed on Windows (for Discord running as administrator).')
    return
  }
  // schtasks /XML expects UTF-16 LE with a BOM.
  const file = path.join(os.tmpdir(), 'waveform-relay-task.xml')
  fs.writeFileSync(file, '\ufeff' + taskXml(exe), 'utf16le')
  try {
    schtasks(['/Create', '/TN', TASK, '/XML', file, '/F'])
    schtasks(['/Run', '/TN', TASK])
  } catch (e) {
    const msg = (e as { stderr?: Buffer }).stderr?.toString().trim()
    console.error(msg || e)
    console.error('Run this from a terminal opened with "Run as administrator".')
    process.exit(1)
  } finally {
    fs.rmSync(file, { force: true })
  }
  console.log(`Created and started task "${TASK}" (elevated, at logon, hidden).`)
}

export function uninstallRelay() {
  if (process.platform !== 'win32') return
  for (const args of [['/End', '/TN', TASK], ['/Delete', '/TN', TASK, '/F']]) {
    try {
      schtasks(args)
    } catch {}
  }
  console.log(`Removed task "${TASK}" (if it existed).`)
}
