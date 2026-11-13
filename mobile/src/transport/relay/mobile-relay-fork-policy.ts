import { ORCA_FORK_POLICY } from '../../../../src/shared/orca-fork-policy'

export function assertMobileRelayAllowed(): void {
  if (!ORCA_FORK_POLICY.vendorServices) {
    throw new Error('Hosted relay connections are disabled in this Orca fork.')
  }
}
