import { expect, it, vi } from 'vitest'
const network = vi.hoisted(() => vi.fn(async () => new Response('{}')))
vi.mock('electron', () => ({ net: { fetch: network }, app: { getPath: () => 'unused' } }))
vi.mock('../browser-extension-support', () => ({ isBrowserExtensionSupportEnabled: () => true }))
vi.mock('../installation/browser-extension-install-store', () => ({
  getBrowserExtensionInstallStore: () => ({
    list: () => [{ id: 'ddkjiahejlhfcafbddmgiahcphecmpfh', version: '1', source: 'webstore' }]
  })
}))
import {
  checkForBrowserExtensionUpdates,
  startBrowserExtensionUpdateChecks
} from './browser-extension-webstore-updater'

it('does not contact the extension store for existing installs or register automatic checks', async () => {
  vi.useFakeTimers()
  try {
    startBrowserExtensionUpdateChecks()
    await checkForBrowserExtensionUpdates()
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
    expect(network).not.toHaveBeenCalled()
  } finally {
    vi.useRealTimers()
  }
})
