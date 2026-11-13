import { vi } from 'vitest'
import type * as ForkPolicy from '../../../src/shared/orca-fork-policy'

// Legacy relay protocol tests opt in here; fork admission tests use the real policy.
vi.mock('../../../src/shared/orca-fork-policy', async (importOriginal) => {
  const actual = await importOriginal<typeof ForkPolicy>()
  return {
    ...actual,
    ORCA_FORK_POLICY: Object.freeze({ ...actual.ORCA_FORK_POLICY, vendorServices: true })
  }
})
