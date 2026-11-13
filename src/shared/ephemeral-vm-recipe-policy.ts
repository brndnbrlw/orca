import { ORCA_FORK_POLICY } from './orca-fork-policy'

export function assertCloudRecipesAllowed(): void {
  if (!ORCA_FORK_POLICY.cloudRecipes) {
    throw new Error('Cloud recipes are disabled in this Orca fork')
  }
}
