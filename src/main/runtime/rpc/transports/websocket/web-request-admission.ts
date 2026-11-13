import type { IncomingMessage } from 'node:http'

/** Host validation also blocks DNS rebinding; Origin is browser admission, never device authentication. */
export function admitWebRequest(request: IncomingMessage): boolean {
  const host = request.headers.host
  if (!host || /[\s,\\/@?#]/.test(host)) {
    return false
  }
  let authority: URL
  try {
    authority = new URL(`http://${host}`)
  } catch {
    return false
  }
  const hostname = authority.hostname.toLowerCase()
  const localAddress = request.socket.localAddress?.replace(/^::ffff:/, '')
  const trustedHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
  if (localAddress) {
    trustedHosts.add(localAddress.includes(':') ? `[${localAddress}]` : localAddress)
  }
  if (!trustedHosts.has(hostname)) {
    return false
  }

  const origin = request.headers.origin
  if (origin === undefined) {
    return true
  }
  if (typeof origin !== 'string') {
    return false
  }
  try {
    const parsed = new URL(origin)
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.origin === origin &&
      parsed.host === new URL(`${parsed.protocol}//${host}`).host
    )
  } catch {
    return false
  }
}
