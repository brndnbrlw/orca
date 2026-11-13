import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeviceRegistry } from './device-registry'
import { createOwnerPairingOffer, type PairingOfferServer } from './pairing-offer-requests'

const directories: string[] = []
afterEach(() => {
  vi.useRealTimers()
  for (const directory of directories.splice(0)) {
    if (!directory.startsWith(join(tmpdir(), 'orca-owner-offer-'))) {
      throw new Error('Refusing cleanup outside the owned pairing fixture directory')
    }
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('owner pairing in the Orca fork', () => {
  it('expires an unused CLI browser offer and keeps it restricted to this computer', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000_000)
    const directory = mkdtempSync(join(tmpdir(), 'orca-owner-offer-'))
    directories.push(directory)
    const registry = new DeviceRegistry(directory)
    let token = ''
    const widen = vi.fn(async () => {})
    const server: PairingOfferServer = {
      getNetworkExposureBindHost: () => '127.0.0.1',
      ensureNetworkExposure: widen,
      createMobilePairingOffer: async () => {
        throw new Error('unexpected mobile pairing')
      },
      createPairingOffer: (args) => {
        const device = registry.getOrCreatePendingDevice(
          args.name ?? 'browser',
          args.scope ?? 'runtime',
          args.reach,
          args.grants,
          args.offerTtlMs
        )
        token = device.token
        return {
          available: true,
          deviceId: device.deviceId,
          endpoint: 'ws://127.0.0.1:6768',
          pairingUrl: 'orca://pair',
          webClientUrl: 'http://127.0.0.1:6768/',
          offerExpiresAt: device.offerExpiresAt ?? null
        }
      }
    }
    const offer = await createOwnerPairingOffer(server, {
      scope: 'runtime',
      address: '127.0.0.1',
      rotate: true
    })
    expect(offer.available).toBe(true)
    expect(widen).not.toHaveBeenCalled()
    expect(registry.validateToken(token)?.pairingReach).toBe('this-computer')
    vi.setSystemTime(1_300_000)
    expect(new DeviceRegistry(directory).validateToken(token)).toBeNull()
  })
})
