import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('expo-crypto', async () => import('../../test-support/expo-crypto-node'))
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) }
}))

import { resolveMobileRelayEndpoint } from './mobile-relay-resume-director'
import { resolvePairingInviteThroughDirector } from '../../pairing/mobile-relay-invite-director'
import { connectMobileRelayForPairing } from '../../pairing/mobile-relay-physical-client'
import { MobileRelayE2eeLink } from '../encryption/mobile-relay-e2ee-link'
import { connectMobileRelayRpcSession } from './mobile-relay-rpc-session'
import { createRecoveringPairingRelayCandidate } from '../../pairing/pairing-relay-candidate'
import { createMobileRelayPairingJournal } from '../../pairing/mobile-relay-pairing-journal'

const relay = {
  v: 1 as const,
  directorUrl: 'https://relay.onorca.dev',
  cellUrl: 'https://relay-c1.onorca.dev',
  assignmentEpoch: 7,
  relayHostId: 'AbCdEf0123_-xyZ9',
  e2eeFraming: 2 as const
}
const savedResumeToken = 'abcdefghijklmnopqrstuvwxyzABCDEFGH012345678'
const pairingRelay = {
  ...relay,
  inviteToken: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFG',
  inviteExpiresAt: 4_000_000_000_000
}
const publicKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
const blocked = /Hosted relay connections are disabled in this Orca fork/

describe('mobile relay fork admission at physical boundaries', () => {
  const fetcher = vi.fn(async () => {
    throw new Error('Unexpected relay HTTP request')
  })
  const socketFactory = vi.fn(function (_url: string): WebSocket {
    throw new Error('Unexpected relay WebSocket')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('WebSocket', socketFactory)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects saved resume tokens before default or injected director fetch', async () => {
    await expect(
      resolveMobileRelayEndpoint({ relay, resumeToken: savedResumeToken })
    ).rejects.toThrow(blocked)
    await expect(
      resolveMobileRelayEndpoint({ relay, resumeToken: savedResumeToken, fetchImpl: fetcher })
    ).rejects.toThrow(blocked)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects saved invite authentication before default or injected director sockets', async () => {
    await expect(resolvePairingInviteThroughDirector({ relay: pairingRelay })).rejects.toThrow(
      blocked
    )
    await expect(
      resolvePairingInviteThroughDirector({ relay: pairingRelay, createSocket: socketFactory })
    ).rejects.toThrow(blocked)
    expect(socketFactory).not.toHaveBeenCalled()
  })

  it('rejects restored pairing credentials before opening a cell socket', () => {
    expect(() =>
      connectMobileRelayForPairing({
        relay: pairingRelay,
        deviceToken: 'saved-device-auth-token',
        desktopPublicKeyB64: publicKey,
        credential: savedResumeToken,
        expectedCredentialKind: 'resume',
        createSocket: socketFactory
      })
    ).toThrow(blocked)
    expect(socketFactory).not.toHaveBeenCalled()
  })

  it('rejects a saved pairing journal before invoking its relay connection factory', () => {
    const journal = createMobileRelayPairingJournal({
      offer: {
        v: 2,
        endpoint: 'ws://127.0.0.1:6768',
        deviceToken: 'saved-device-auth-token',
        publicKeyB64: publicKey,
        relay: pairingRelay
      },
      hostId: 'restored-host',
      hostName: 'Local Orca',
      now: 1,
      randomBytes: (length) => new Uint8Array(length).fill(1)
    })
    const connectRelay = vi.fn(() =>
      connectMobileRelayForPairing({
        relay: pairingRelay,
        deviceToken: journal.secrets.deviceToken,
        desktopPublicKeyB64: publicKey,
        createSocket: socketFactory
      })
    )
    expect(() =>
      createRecoveringPairingRelayCandidate({
        journal,
        connect: connectRelay,
        resolveDirector: (offered) =>
          resolvePairingInviteThroughDirector({ relay: offered, createSocket: socketFactory }),
        persistMove: async () => undefined,
        now: () => 1
      })
    ).toThrow(blocked)
    expect(connectRelay).not.toHaveBeenCalled()
    expect(socketFactory).not.toHaveBeenCalled()
  })

  it('rejects a direct physical-link caller before the default WebSocket constructor', () => {
    expect(
      () =>
        new MobileRelayE2eeLink({
          endpoint: relay,
          credential: savedResumeToken,
          expectedCredentialKind: 'resume',
          deviceToken: 'saved-device-auth-token',
          desktopPublicKeyB64: publicKey,
          onAuthenticated: vi.fn(),
          onText: vi.fn(),
          onBinary: vi.fn(),
          onError: vi.fn()
        })
    ).toThrow(blocked)
    expect(socketFactory).not.toHaveBeenCalled()
  })

  it('rejects restored RPC session credentials before an injected cell socket', () => {
    expect(() =>
      connectMobileRelayRpcSession({
        relay,
        resumeToken: savedResumeToken,
        resumeCredentialVersion: 2,
        resumeConfirmReqId: 'saved-confirm-request',
        deviceToken: 'saved-device-auth-token',
        desktopPublicKeyB64: publicKey,
        createSocket: socketFactory
      })
    ).toThrow(blocked)
    expect(socketFactory).not.toHaveBeenCalled()
  })
})
