import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createChromiumCookieTestDatabase } from './browser-cookie-import-test-database'

const state = vi.hoisted(() => ({ root: '' }))
vi.mock('electron', () => ({ app: { getPath: () => state.root } }))

import { applyPendingBrowserCookieImports } from './staging/browser-session-cookie-staging'
import { applyScopedStagedCookieImport } from './staging/browser-cookie-staged-import'

let livePath: string
let stagedPath: string
let metadataPath: string
beforeEach(() => {
  state.root = mkdtempSync(join(tmpdir(), 'orca-staged-import-policy-'))
  livePath = join(state.root, 'Partitions', 'default', 'Network', 'Cookies')
  stagedPath = join(state.root, 'staged-cookies')
  metadataPath = join(state.root, 'browser-session-meta.json')
  createChromiumCookieTestDatabase(livePath, [
    { domain: '.app.example', name: 'sid', value: 'clean-login' }
  ]).close()
  const staged = createChromiumCookieTestDatabase(stagedPath, [
    { domain: '.app.example', name: 'sid', value: 'imported-credential' }
  ])
  staged.exec(
    "CREATE TABLE orca_cookie_import_scope (domain TEXT NOT NULL, format_version INTEGER NOT NULL); INSERT INTO orca_cookie_import_scope VALUES ('app.example', 1)"
  )
  staged.close()
  writeFileSync(
    metadataPath,
    JSON.stringify({
      pendingCookieImports: { 'persist:default': { format: 'scoped-v1', path: stagedPath } },
      profiles: []
    })
  )
})
afterEach(() => {
  rmSync(state.root, { recursive: true, force: true })
})
function liveSession() {
  const database = new DatabaseSync(livePath, { readOnly: true })
  try {
    return database.prepare("SELECT value FROM cookies WHERE name = 'sid'").get()?.value
  } finally {
    database.close()
  }
}
it('refuses saved staged credentials during startup without replacing a clean login', () => {
  applyPendingBrowserCookieImports({
    resolveMetadataPath: () => metadataPath,
    defaultPartition: 'persist:default',
    activeOrcaProfileId: 'saved-profile'
  })
  expect(liveSession()).toBe('clean-login')
})
it('refuses a direct staged import before opening or mutating the destination jar', () => {
  expect(() => applyScopedStagedCookieImport(livePath, stagedPath)).toThrow(
    'Browser credential import is disabled in this Orca fork'
  )
  expect(liveSession()).toBe('clean-login')
})
