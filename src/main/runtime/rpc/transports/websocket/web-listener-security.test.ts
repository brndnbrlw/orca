import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { WebSocketTransport } from './ws-transport'

let root: string
let transport: WebSocketTransport
let port: number
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-web-security-'))
  await mkdir(join(root, 'public', 'assets'), { recursive: true })
  await mkdir(join(root, 'private'))
  await writeFile(join(root, 'public', 'web-index.html'), '<html>Orca</html>')
  await writeFile(join(root, 'public', 'assets', 'app.js'), 'public asset')
  await writeFile(join(root, 'private', 'secret.js'), 'private credential')
  await symlink(
    join(root, 'private'),
    join(root, 'public', 'assets', 'escape'),
    process.platform === 'win32' ? 'junction' : 'dir'
  )
  transport = new WebSocketTransport({
    host: '127.0.0.1',
    port: 0,
    staticRoot: join(root, 'public')
  })
  await transport.start()
  port = transport.resolvedPort
})
afterEach(async () => {
  await transport?.stop()
  await rm(root, { recursive: true, force: true })
})
function get(path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, headers }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
    req.end()
  })
}
function upgrade(headers: Record<string, string> = {}) {
  return new Promise<number>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers })
    ws.on('error', reject)
    ws.on('unexpected-response', (_req, res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    ws.on('open', () => {
      ws.once('close', () => resolve(101))
      ws.close()
    })
  })
}
describe('browser listener admission', () => {
  it('serves normal assets but refuses a directory symlink outside the static root', async () => {
    expect(await get('/assets/app.js')).toEqual({ status: 200, body: 'public asset' })
    expect(await get('/assets/escape/secret.js')).toEqual({ status: 404, body: '' })
  })
  it('refuses an untrusted Host, cross-origin browser requests, opaque origins and forged web markers', async () => {
    const rejectedHeaders: Record<string, string>[] = [
      { Host: `attacker.example:${port}` },
      { Origin: 'https://attacker.example' },
      { Origin: 'null' },
      { Origin: `http://127.0.0.1:${port + 1}` }
    ]
    for (const headers of rejectedHeaders) {
      expect((await get('/?orca-client=web', headers)).status).toBe(403)
      expect(await upgrade(headers)).toBe(403)
    }
  })
  it('admits same-origin browsers and native no-Origin clients to the existing pairing protocol', async () => {
    expect((await get('/', { Origin: `http://127.0.0.1:${port}` })).status).toBe(200)
    expect(await upgrade({ Origin: `http://127.0.0.1:${port}` })).toBe(101)
    expect(await upgrade()).toBe(101)
  })
})
