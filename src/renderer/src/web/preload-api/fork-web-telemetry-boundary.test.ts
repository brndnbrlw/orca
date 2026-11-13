import { expect, it } from 'vitest'
import { createWebTelemetryApi } from './web-telemetry-api'

it('reports disabled consent and declines captures in the built web client', async () => {
  const web = createWebTelemetryApi()
  await expect(web.telemetryGetConsentState!()).resolves.toEqual({
    effective: 'disabled',
    reason: 'orca_disabled'
  })
  await expect(web.telemetryTrack!('telemetry_opted_in', { via: 'settings' })).resolves.toBe(false)
})
