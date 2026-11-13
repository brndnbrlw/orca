import { defineConfig } from 'vitest/config'
import { createWorkspaceSourceResolver } from './scripts/workspace/source-exports/workspace-source-exports.mjs'

export default defineConfig({
  oxc: { tsconfig: false },
  resolve: { alias: createWorkspaceSourceResolver().aliases },
  test: {
    environment: 'node',
    pool: 'forks',
    env: { ORCA_BACKGROUND_LAUNCH: '1' },
    execArgv: ['--no-experimental-webstorage'],
    include: [
      'mobile/src/pairing/mobile-relay-invite-director.test.ts',
      'mobile/src/pairing/mobile-relay-physical-client.test.ts',
      'mobile/src/pairing/pairing-relay-candidate.test.ts',
      'mobile/src/pairing/mobile-relay-pairing-recovery.test.ts',
      'mobile/src/transport/encryption/mobile-relay-e2ee-link.test.ts',
      'mobile/src/transport/relay/mobile-relay-resume-director.test.ts',
      'mobile/src/pairing/mobile-relay-lifecycle-fork-policy.test.ts',
      'mobile/src/transport/relay/mobile-relay-fork-policy.test.ts',
      'mobile/src/diagnostics/connection-diagnostics-fork-policy.test.ts',
      'mobile/src/diagnostics/connection-diagnostics-submission.test.ts',
      'src/main/runtime/rpc/transports/websocket/web-listener-security.test.ts',
      'src/main/runtime/rpc/transports/websocket/static-web-client-handler-stream.test.ts',
      'src/shared/ephemeral-vm-recipe-fork-policy.test.ts',
      'src/main/plugins/workers/plugin-execution-fork-policy.test.ts',
      'src/main/browser/cookies/browser-credential-import-fork-policy.test.ts',
      'src/main/browser/cookies/browser-staged-credential-import-fork-policy.test.ts'
    ],
    hookTimeout: 15000,
    testTimeout: 15000
  }
})
