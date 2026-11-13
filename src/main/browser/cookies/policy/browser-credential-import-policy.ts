import { ORCA_FORK_POLICY } from '../../../../shared/orca-fork-policy'
import type { BrowserCookieImportFailure } from '../../../../shared/browser-cookie-import-failure-copy'

export function browserCredentialImportDenial(): BrowserCookieImportFailure | null {
  return ORCA_FORK_POLICY.browserCredentialImport
    ? null
    : {
        ok: false,
        reason: 'Browser credential import is disabled in this Orca fork.',
        reasonCode: 'credentialImportDisabled'
      }
}
