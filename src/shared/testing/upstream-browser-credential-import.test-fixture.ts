import { vi } from 'vitest'
import type * as ForkPolicy from '../orca-fork-policy'

vi.mock('../orca-fork-policy', async (importOriginal) => {
  const actual = await importOriginal<typeof ForkPolicy>()
  return {
    ...actual,
    ORCA_FORK_POLICY: Object.freeze({ ...actual.ORCA_FORK_POLICY, browserCredentialImport: true })
  }
})
