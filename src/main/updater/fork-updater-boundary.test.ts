import { describe, expect, it, vi } from 'vitest'
const sdk = vi.hoisted(() => ({
  load: vi.fn(() => {
    throw new Error('updater SDK started')
  })
}))
vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: () => '1.4.0', getPath: () => 'unused' },
  BrowserWindow: { getAllWindows: () => [] },
  powerMonitor: { on: vi.fn() }
}))
vi.mock('./electron-updater-loader', () => ({ loadElectronAutoUpdater: sdk.load }))
import {
  checkForRemoteServerUpdate,
  checkForUpdatesFromMenu,
  downloadUpdate,
  getRemoteServerUpdaterSnapshot,
  getUpdateStatus,
  installRemoteServerUpdate,
  listAvailableReleaseBuilds,
  setupAutoUpdater
} from './updater-service'

describe('fork updater facade', () => {
  it('exposes unavailable status and refuses manual operations before creating the updater SDK', async () => {
    setupAutoUpdater(null)
    expect(getUpdateStatus()).toMatchObject({ state: 'error', retryable: false })
    expect(getRemoteServerUpdaterSnapshot('runtime')).toMatchObject({
      runtimeId: 'runtime',
      support: { automatic: false, reason: 'updater-unavailable' },
      status: { state: 'error', retryable: false }
    })
    expect(checkForRemoteServerUpdate('runtime')).toMatchObject({
      status: { state: 'error', retryable: false }
    })
    expect(() => checkForUpdatesFromMenu()).toThrow(/disabled/i)
    expect(() => downloadUpdate()).toThrow(/disabled/i)
    expect(() => installRemoteServerUpdate('runtime')).toThrow(/disabled/i)
    await expect(listAvailableReleaseBuilds('stable')).rejects.toThrow(/disabled/i)
    expect(sdk.load).not.toHaveBeenCalled()
  })
})
