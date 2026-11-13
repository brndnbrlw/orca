import { existsSync, readFileSync, realpathSync, unlinkSync, symlinkSync } from 'node:fs'
const hash = readFileSync('/opt/orca/orcad/.runtime-node', 'utf8').trim()
if (!/^[a-f0-9]{64}$/.test(hash)) {
  throw new Error('Invalid bundled Node runtime identity')
}
const target = `/opt/orca/runtimes/node-${hash}/bin/node`
if (!existsSync(target)) {
  throw new Error('Missing bundled Node runtime')
}
if (realpathSync('/usr/local/bin/node') !== realpathSync(target)) {
  unlinkSync('/usr/local/bin/node')
  symlinkSync(target, '/usr/local/bin/node')
}
