// oxlint-disable typescript/consistent-type-assertions -- SAFETY: boundary fixtures omit members that the disabled policy must never reach.
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { PluginMarketplaceService } from './plugin-marketplace-service'
import { PluginInstallStatsService, fetchPluginInstallStats } from './plugin-install-stats-service'
import { PluginKillListService, fetchPluginKillList } from './plugin-kill-list-service'
import { PluginAutoUpdater } from './plugin-auto-updater'

describe('fork background vendor catalogs', () => {
  it('does not seed vendor catalogs or refresh stale counts and revocations despite enabled settings', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-fork-catalogs-'))
    const fetcher = vi.fn()
    const countsPath = join(root, 'plugin-install-stats.json')
    writeFileSync(
      countsPath,
      JSON.stringify({
        schemaVersion: 1,
        generatedAt: '2026-01-01T00:00:00Z',
        plugins: { 'local.example': { installs: 42 } }
      })
    )
    utimesSync(countsPath, new Date('2026-01-01'), new Date('2026-01-01'))
    const marketplace = new PluginMarketplaceService({ pluginsDataDir: root, fetcher })
    const counts = new PluginInstallStatsService({
      pluginsDataDir: root,
      isFetchAllowed: () => true,
      fetcher
    })
    const safety = new PluginKillListService({ pluginsDataDir: root, fetcher })
    const updater = new PluginAutoUpdater({
      isEnabled: () => true,
      refreshCatalogs: fetcher
    } as unknown as ConstructorParameters<typeof PluginAutoUpdater>[0])
    try {
      await expect(marketplace.seedOfficialSource()).rejects.toThrow(/disabled/i)
      await expect(marketplace.seedCommunitySource()).rejects.toThrow(/disabled/i)
      expect(await counts.getInstallCounts()).toEqual({ 'local.example': 42 })
      await counts.settled()
      await expect(safety.refresh()).rejects.toThrow(/disabled/i)
      await expect(updater.run()).rejects.toThrow(/disabled/i)
      await expect(fetchPluginKillList(fetcher)).rejects.toThrow(/disabled/i)
      await expect(fetchPluginInstallStats(fetcher)).rejects.toThrow(/disabled/i)
      expect(fetcher).not.toHaveBeenCalled()
    } finally {
      safety.dispose()
      updater.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
