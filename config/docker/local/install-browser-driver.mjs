import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

if (process.platform !== 'linux' || process.arch !== 'x64') {
  throw new Error('This container currently supports Linux x64')
}
const require = createRequire(import.meta.url)
const root = dirname(require.resolve('agent-browser/package.json'))
if (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version !== '0.39.4') {
  throw new Error('Review the browser-driver pin before upgrading agent-browser')
}
const response = await fetch(
  'https://github.com/vercel-labs/agent-browser/releases/download/v0.39.4/agent-browser-linux-x64'
)
if (!response.ok) {
  throw new Error(`Browser-driver download failed: HTTP ${response.status}`)
}
const bytes = Buffer.from(await response.arrayBuffer())
const expected = 'aa82c8ee81a38b8ad9ba61af02ced6dcbbb8af36dd8b2b479384177f8aa077a6'
if (createHash('sha256').update(bytes).digest('hex') !== expected) {
  throw new Error('Browser-driver hash mismatch')
}
mkdirSync(join(root, 'bin'), { recursive: true })
const target = join(root, 'bin', 'agent-browser-linux-x64')
writeFileSync(target, bytes, { mode: 0o755 })
chmodSync(target, 0o755)
console.log('Installed hash-verified agent-browser 0.39.4')
