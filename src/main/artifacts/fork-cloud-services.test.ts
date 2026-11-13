// oxlint-disable typescript/consistent-type-assertions -- SAFETY: boundary fixtures omit members that the disabled policy must never reach.
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({
  app: { isPackaged: true },
  safeStorage: { isEncryptionAvailable: () => false }
}))
import { ArtifactCloudService } from './artifact-cloud-service'
import { artifactRequest } from './artifact-cloud-request'
import { refreshOrcaCloudSession } from '../orca-profiles/cloud-auth/profile-cloud-client'
import {
  installSkillCloudGrant,
  installSkillBundleCloudGrant
} from '../skills/cloud/skill-cloud-grant-installation'
import { SkillCloudService } from '../skills/cloud/skill-cloud-package-service'
import { skillCloudRequest } from '../skills/cloud/skill-cloud-request'
import { uploadSkillPackageToSignedPolicy } from '../skills/cloud/skill-cloud-direct-upload'
import {
  getOrcaCloudAuthConfig,
  isOrcaCloudDevAuthEnabled
} from '../orca-profiles/cloud-auth/profile-cloud-auth-config'
import { DesktopPushService } from '../runtime/push/desktop-push-service'
import { createDesktopRelayServiceInstaller } from '../runtime/mobile-cloud-relay/desktop-relay-service-installer'

afterEach(() => vi.unstubAllGlobals())

describe('fork cloud service admission', () => {
  it('refuses authenticated and anonymous hosted operations despite explicit endpoint/token overrides', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const options = { apiUrl: 'https://example.test', authToken: 'cached-token' }
    await expect(
      new ArtifactCloudService('unused-local-profile', () => true).list(options)
    ).resolves.toMatchObject({ status: 'unconfigured' })
    const skills = new SkillCloudService('unused-local-profile')
    await expect(skills.listOwnedShares(options)).resolves.toMatchObject({ status: 'unconfigured' })
    await expect(skills.resolveShare('cached-share', options)).resolves.toMatchObject({
      status: 'unconfigured'
    })
    await expect(
      skillCloudRequest({ ...options, path: '/v1/skill-shares/cached-share', fetcher })
    ).rejects.toThrow(/disabled/i)
    await expect(
      uploadSkillPackageToSignedPolicy({
        policy: { url: 'https://example.test/upload', fields: {} },
        archivePath: 'unused-local-archive',
        expectedBytes: 1,
        fetcher
      })
    ).rejects.toThrow(/disabled/i)
    await expect(
      artifactRequest('https://example.test', 'cached-token', '/cached-artifact')
    ).rejects.toThrow(/disabled/i)
    await expect(
      refreshOrcaCloudSession(
        { refreshEndpoint: 'https://example.test/refresh' } as Parameters<
          typeof refreshOrcaCloudSession
        >[0],
        { refreshToken: 'cached-token' } as Parameters<typeof refreshOrcaCloudSession>[1]
      )
    ).rejects.toThrow(/disabled/i)
    const runtime = {
      installSharedSkillRequest: fetcher,
      installSharedSkillBundleRequest: fetcher
    } as unknown as Parameters<typeof installSkillCloudGrant>[0]
    await expect(
      installSkillCloudGrant(
        runtime,
        {} as Parameters<typeof installSkillCloudGrant>[1],
        {} as Parameters<typeof installSkillCloudGrant>[2]
      )
    ).rejects.toThrow(/disabled/i)
    await expect(
      installSkillBundleCloudGrant(
        runtime,
        {} as Parameters<typeof installSkillBundleCloudGrant>[1],
        {} as Parameters<typeof installSkillBundleCloudGrant>[2]
      )
    ).rejects.toThrow(/disabled/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not admit packaged/dev cloud authentication or key-based push and relay factories', async () => {
    const env = {
      ORCA_CLOUD_API_URL: 'https://example.test',
      ORCA_CLOUD_CLIENT_ID: 'override',
      ORCA_CLOUD_DEV_AUTH: '1',
      NODE_ENV: 'development'
    }
    expect(getOrcaCloudAuthConfig(env, true)).toMatchObject({ configured: false })
    expect(getOrcaCloudAuthConfig(env, false)).toMatchObject({ configured: false })
    expect(isOrcaCloudDevAuthEnabled(env, false)).toBe(false)
    const options = {
      runtimeRpc: {
        getE2EEKeypair: () => {
          throw new Error('read host credentials')
        }
      },
      gatewayUrl: 'https://example.test'
    } as unknown as Parameters<typeof DesktopPushService.create>[0]
    expect(DesktopPushService.create(options)).toBeNull()
    const installer = createDesktopRelayServiceInstaller({
      runtimeRpc: { setMobileRelayPairingProvider: () => {} },
      whenNetworkReady: Promise.resolve(),
      isFenced: () => false,
      create: () =>
        ({ start: () => {} }) as ReturnType<
          Parameters<typeof createDesktopRelayServiceInstaller>[0]['create']
        >,
      onInstalled: () => {}
    })
    await expect(installer.ensure()).resolves.toBe(false)
    await expect(installer.authChanged()).resolves.toBe(false)
  })
})
