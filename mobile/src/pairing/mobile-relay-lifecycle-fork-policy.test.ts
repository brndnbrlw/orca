import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostProfile } from '../host-catalog/host-profile'

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  secrets: new Map<string, string>()
}))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('expo-crypto', async () => import('../test-support/expo-crypto-node'))
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.values.set(key, value)
    },
    removeItem: async (key: string) => {
      storage.values.delete(key)
    }
  }
}))
vi.mock('../host-credentials/pairing-keychain', () => ({
  readPairingKeychainItem: async (key: string) => storage.secrets.get(key) ?? null,
  writePairingKeychainItem: async (key: string, value: string) => {
    storage.secrets.set(key, value)
  },
  deletePairingKeychainItem: async (key: string) => {
    storage.secrets.delete(key)
  },
  resetPairingKeychainForTests: vi.fn()
}))
vi.mock('../host-catalog/host-store', () => ({
  resolvePairingHostIdentity: async () => ({ id: 'host-restored', name: 'Local Orca' }),
  savePairedHost: vi.fn(),
  loadHosts: async () => [],
  setRelayRouting: vi.fn(),
  RelayRoutingHostRemovedError: class extends Error {}
}))
vi.mock('../host-descriptors/host-descriptor-recorder', () => ({
  recordHostDescriptorFromStatus: vi.fn()
}))
vi.mock('../transport/connection/host-path-memory', () => ({
  lastGoodPathWasDirectHere: async () => false,
  readLocalNetworkFingerprint: async () => null,
  recordHostGoodPath: vi.fn()
}))

import { startMobileEndpointLifecycle } from '../transport/connection/mobile-endpoint-lifecycle'
import {
  FakeLogicalClient,
  FakeSession
} from '../transport/connection/mobile-endpoint-supervisor-test-fakes'
import { startPreProfilePairing } from './pre-profile-pairing-coordinator'
import { createMobileRelayPairingJournal } from './mobile-relay-pairing-journal'
import { recoverMobileRelayPairing } from './mobile-relay-pairing-recovery'
import { upgradeDirectMobileRelay } from '../transport/relay/mobile-relay-direct-upgrade'
import { writeMobileRelayCredentialBundle } from '../host-credentials/mobile-relay-credential-bundle'

const offer = {
  v: 2 as const,
  endpoint: 'ws://127.0.0.1:6768',
  deviceToken: 'saved-device-auth-token',
  publicKeyB64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  relay: {
    v: 1 as const,
    directorUrl: 'https://relay.onorca.dev',
    cellUrl: 'https://relay-c1.onorca.dev',
    assignmentEpoch: 7,
    relayHostId: 'AbCdEf0123_-xyZ9',
    inviteToken: 'abcdefghijklmnopqrstuvwxyzABCDEFGH012345678',
    inviteExpiresAt: 4_000_000_000_000,
    e2eeFraming: 2 as const
  }
}
const host: HostProfile = {
  id: 'host-restored',
  name: 'Local Orca',
  endpoint: offer.endpoint,
  deviceToken: offer.deviceToken,
  publicKeyB64: offer.publicKeyB64,
  lastConnected: 1,
  relay: offer.relay
}
const bundle = {
  v: 1 as const,
  hostId: host.id,
  deviceToken: offer.deviceToken,
  current: {
    token: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFG',
    hash: 'A'.repeat(43),
    version: 2,
    expiresAt: 4_000_000_000_000
  }
}

describe('restored mobile relay policy and direct local pairing', () => {
  const fetcher = vi.fn(async () => {
    throw new Error('Unexpected relay fetch')
  })
  const socketFactory = vi.fn(function (_url: string): WebSocket {
    throw new Error('Unexpected relay socket')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    storage.values.clear()
    storage.secrets.clear()
    vi.useFakeTimers()
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('WebSocket', socketFactory)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps a restored relay profile on its existing direct session across lifecycle nudges', async () => {
    await writeMobileRelayCredentialBundle(bundle)
    const logical = new FakeLogicalClient('connecting', 'lan')
    const lifecycle = startMobileEndpointLifecycle(logical, host, vi.fn())
    try {
      lifecycle.setForeground(false)
      lifecycle.setForeground(true)
      lifecycle.nudge('network-change')
      await vi.advanceTimersByTimeAsync(0)
      expect(fetcher).not.toHaveBeenCalled()
      expect(socketFactory).not.toHaveBeenCalled()
      logical.publishState('connected')
      expect(logical.getState()).toBe('connected')
      expect(logical.getActivePath()).toBe('lan')
      expect(fetcher).not.toHaveBeenCalled()
      expect(socketFactory).not.toHaveBeenCalled()
    } finally {
      lifecycle.stop()
    }
  })

  it('pairs a mixed direct/relay native offer locally without creating relay credentials', async () => {
    const direct = new FakeSession('connected')
    const saved: HostProfile[] = []
    const saveJournal = vi.fn(async () => undefined)
    const attempt = startPreProfilePairing({
      offer,
      timeoutMs: 5000,
      dependencies: {
        connectDirect: () => direct,
        savePairedHost: async (paired) => {
          saved.push(paired)
        },
        saveJournal,
        recoverPendingJournal: async () => undefined,
        exchangeTicket: async () => 'local-exchanged-device-token',
        recordDescriptorFromStatus: vi.fn(),
        platform: 'ios',
        now: () => 1
      }
    })
    await expect(attempt.result).resolves.toEqual({ hostId: 'host-restored' })
    expect(saved).toEqual([
      {
        id: 'host-restored',
        name: 'Local Orca',
        endpoint: 'ws://127.0.0.1:6768',
        deviceToken: 'local-exchanged-device-token',
        publicKeyB64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        lastConnected: 1
      }
    ])
    expect(saveJournal).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
    expect(socketFactory).not.toHaveBeenCalled()
  })

  it('does not replay saved invite/resume credentials from a pairing recovery journal', async () => {
    const journal = createMobileRelayPairingJournal({
      offer,
      hostId: host.id,
      hostName: host.name,
      now: 1,
      randomBytes: (length) => new Uint8Array(length).fill(1)
    })
    await expect(
      recoverMobileRelayPairing({
        loadJournal: async () => journal,
        readCredentialBundle: async () => bundle,
        loadHosts: async () => [],
        platform: 'ios',
        now: () => 1
      })
    ).resolves.toBe('none')
    expect(fetcher).not.toHaveBeenCalled()
    expect(socketFactory).not.toHaveBeenCalled()
  })

  it('declines automatic relay credential provisioning on a direct local connection', async () => {
    const direct = new FakeLogicalClient('connected', 'lan')
    const { relay: _relay, ...localHost } = host
    await expect(
      upgradeDirectMobileRelay({
        client: direct,
        host: localHost,
        dependencies: {
          readJournal: async () => null,
          writeJournal: async () => undefined,
          clearJournal: async () => undefined,
          randomBytes: (length) => new Uint8Array(length).fill(1)
        }
      })
    ).resolves.toBeNull()
    expect(direct.sendRequest).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
    expect(socketFactory).not.toHaveBeenCalled()
  })
})
