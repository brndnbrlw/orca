import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { AgentStateRulesLiveUpdater } from './agent-state-rules-live-update'
import {
  activateAgentStateRules,
  BUNDLED_AGENT_STATE_RULES,
  getActiveAgentStateRules
} from './active-agent-state-rules'
import { BUNDLED_AGENT_STATE_RULE_FILES } from './agent-state-rules-catalog'
import {
  readCachedWslHostsPolicy,
  WslHostsPolicyLiveUpdater
} from '../../wsl/host-lifecycle/wsl-hosts-policy-live-update'

describe('fork rule and WSL refresh', () => {
  it('retains local rule overrides without downloading packaged updates or applying cached vendor WSL blocks', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-fork-rules-'))
    const fetcher = vi.fn(async () => new Response('Not Found', { status: 404 }))
    const overridePath = join(root, 'override.json')
    writeFileSync(
      overridePath,
      JSON.stringify({ version: 9999, engineVersion: 1, files: BUNDLED_AGENT_STATE_RULE_FILES })
    )
    writeFileSync(
      join(root, 'wsl-hosts-policy-stable.json'),
      JSON.stringify({ version: 1, revision: 9999, wslHosts: 'block' })
    )
    const rules = new AgentStateRulesLiveUpdater({
      userDataPath: root,
      appVersion: '1.4.0',
      isPackaged: true,
      fetch: fetcher,
      readSettings: () => ({ agentStateRulesPath: overridePath, agentStateRulesLiveUpdates: true }),
      onActivated: () => {}
    })
    const wsl = new WslHostsPolicyLiveUpdater({
      userDataPath: root,
      appVersion: '1.4.0',
      isPackaged: true,
      fetch: fetcher
    })
    try {
      await rules.start()
      await rules.refresh()
      expect(getActiveAgentStateRules()).toMatchObject({ version: 9999, source: 'override' })
      await wsl.start()
      await wsl.refresh()
      expect(readCachedWslHostsPolicy(root, '1.4.0')).toBeNull()
      expect(fetcher).not.toHaveBeenCalled()
    } finally {
      rules.stop()
      wsl.stop()
      activateAgentStateRules(BUNDLED_AGENT_STATE_RULES)
      rmSync(root, { recursive: true, force: true })
    }
  })
})
