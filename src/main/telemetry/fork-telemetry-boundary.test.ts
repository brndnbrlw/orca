// oxlint-disable typescript/consistent-type-assertions -- SAFETY: boundary fixtures omit members that the disabled policy must never reach.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Store } from '../persistence/loading-store/store'
import type { GlobalSettings } from '../../shared/global-settings-types'
import {
  initTelemetry,
  isTelemetryEnabled,
  persistBannerAcknowledgeWithoutEmitting,
  setOptIn,
  shutdownTelemetry,
  track
} from './client'
import { resolveConsent } from './consent'
import { createPostHogClient } from './posthog-transport'

afterEach(() => vi.unstubAllEnvs())

describe('fork telemetry admission', () => {
  it('cannot restore consent by clearing environment switches or acknowledging the banner', async () => {
    vi.stubEnv('DO_NOT_TRACK', '')
    vi.stubEnv('ORCA_TELEMETRY_DISABLED', '0')
    vi.stubEnv('CI', '')
    const settings = {
      telemetry: { installId: 'local-install', optedIn: true, existedBeforeTelemetryRelease: true }
    } as GlobalSettings
    const store = {
      getSettings: () => settings,
      updateSettings: (updates: Partial<GlobalSettings>) => Object.assign(settings, updates)
    } as Store
    initTelemetry(store, () => {
      throw new Error('SDK startup scheduled')
    })
    await setOptIn('settings', true)
    await persistBannerAcknowledgeWithoutEmitting()
    expect(resolveConsent(settings)).toEqual({ effective: 'disabled', reason: 'orca_disabled' })
    expect(isTelemetryEnabled()).toBe(false)
    expect(track('telemetry_opted_in', { via: 'settings' })).toBe(false)
    await shutdownTelemetry()
  })

  it('rejects direct SDK creation even with cached credentials and enabled consent', async () => {
    expect(() => createPostHogClient('cached-write-key', { effective: 'enabled' })).toThrow(
      /disabled/i
    )
  })
})
