import { ORCA_FORK_POLICY } from '../../shared/orca-fork-policy'
import { derivePluginExecutionProfile } from '../../shared/plugins/contributions/plugin-execution-profile'
import type { PluginManifest } from '../../shared/plugins/manifest/plugin-manifest'

export function pluginExecutionAllowed(manifest: PluginManifest): boolean {
  // Settings declarations do not load plugin code.
  const profile = derivePluginExecutionProfile({
    ...manifest,
    contributes: { ...manifest.contributes, settings: [] }
  })
  return (
    ORCA_FORK_POLICY.executablePlugins ||
    (profile !== 'trusted-worker' && profile !== 'sandboxed-ui')
  )
}

export function assertExecutablePluginsAllowed(): void {
  if (!ORCA_FORK_POLICY.executablePlugins) {
    throw new Error('Executable plugins are disabled in this Orca fork')
  }
}
