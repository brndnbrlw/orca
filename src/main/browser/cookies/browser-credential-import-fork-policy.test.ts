import { describe, expect, it, vi } from 'vitest'
import type { CookieClearIdentity } from './storage/cookie-store-contracts'
import type { CookieImportTarget } from './imports/cookie-import-contracts'
vi.mock('./browser-cookie-import-diagnostics', () => ({
  diag: () => {},
  getDiagLogPath: () => 'unused',
  summarizeCookieImportError: String
}))
import { importValidatedCookies } from './imports/import-validated-cookies'

describe('shared cookie import boundary', () => {
  it('refuses validated credentials without altering an existing clean-login session', async () => {
    const jar = new Map([['sid', 'clean-login']])
    const target: CookieImportTarget = {
      partition: 'persist:clean-login',
      mutationLockOwner: {},
      openWriteStore: () => ({
        get: async () => [],
        remove: async () => {},
        snapshotClearIdentities: async () => [],
        restoreClearIdentities: async () => {},
        dispose: () => {},
        writeCookieIdentity: async (identity: CookieClearIdentity) => {
          jar.set(identity.name, identity.value)
        }
      })
    }
    expect(
      await importValidatedCookies(
        [
          {
            url: 'https://app.example/',
            domain: 'app.example',
            name: 'sid',
            value: 'imported-credential',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            expirationDate: undefined,
            partition: { status: 'unpartitioned' }
          }
        ],
        1,
        target
      )
    ).toMatchObject({ ok: false, reasonCode: 'credentialImportDisabled' })
    expect([...jar]).toEqual([['sid', 'clean-login']])
  })
})
