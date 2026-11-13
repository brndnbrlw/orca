import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { pluginManifestSchema } from '../../../shared/plugins/manifest/plugin-manifest'
import { PluginContentVerifier } from '../plugin-content-integrity'
import { PluginWorkerController } from './plugin-worker-controller'
import { startPluginWorker } from './parent-process/plugin-host-process'
import { livePluginActivationState } from '../plugin-activation-policy'
import type { ValidDiscoveredPlugin } from '../plugin-discovery'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
it('rejects a saved approved executable plugin before worker startup, but keeps config-only approval', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-plugin-policy-'))
  roots.push(root)
  const marker = join(root, 'executed.txt')
  await writeFile(marker, 'unexecuted')
  const entry = join(root, 'worker.cjs')
  await writeFile(
    entry,
    `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); process.exit(0)`
  )
  const manifest = pluginManifestSchema.parse({
    manifestVersion: 1,
    id: 'demo',
    publisher: 'samples',
    name: 'Demo',
    version: '1.0.0',
    engines: { orca: '>=1.0.0' },
    pluginApi: 1,
    main: 'worker.cjs',
    contributes: { commands: [{ id: 'run', title: 'Run' }] },
    capabilities: []
  })
  const plugin: ValidDiscoveredPlugin = {
    pluginKey: 'samples.demo',
    rootDir: root,
    manifest,
    consentFingerprint: 'saved',
    contentHash: null,
    isDev: true
  }
  const source = {
    isPluginSystemEnabled: () => true,
    getPluginConsents: () => ({ 'samples.demo': 'saved' }),
    getDisabledPlugins: () => []
  }
  const subject = new PluginWorkerController({
    entryPath: entry,
    contentVerifier: new PluginContentVerifier(),
    capabilities: () => [],
    isCurrentApproved: () => true,
    executeHostCall: async () => ({ ok: true, value: null }),
    log: () => () => {},
    onStateChanged: () => {}
  })
  try {
    await expect(subject.ensure(plugin)).rejects.toThrow(
      'Executable plugins are disabled in this Orca fork'
    )
    await expect(
      startPluginWorker({
        pluginId: plugin.pluginKey,
        rootDir: root,
        mainEntry: 'worker.cjs',
        entryPath: entry,
        grantedCapabilities: [],
        executeHostCall: async () => ({ ok: true, value: null }),
        log: () => {}
      })
    ).rejects.toThrow('Executable plugins are disabled in this Orca fork')
    expect(await readFile(marker, 'utf8')).toBe('unexecuted')
    expect(livePluginActivationState(source, plugin)).toBe('disabled')
    expect(
      livePluginActivationState(source, {
        ...plugin,
        manifest: pluginManifestSchema.parse({
          ...manifest,
          main: undefined,
          capabilities: [{ kind: 'settings:own' }],
          contributes: {
            settings: [{ key: 'pageSize', title: 'Page size', type: 'integer', default: 20 }]
          }
        })
      })
    ).toBe('approved')
  } finally {
    await subject.dispose()
  }
})
