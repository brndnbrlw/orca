// oxlint-disable typescript/consistent-type-assertions -- SAFETY: boundary fixtures omit members that the disabled policy must never reach.
import { afterEach, describe, expect, it, vi } from 'vitest'
const transports = vi.hoisted(() => ({ fetch: vi.fn(), request: vi.fn() }))
vi.mock('electron', () => ({
  net: { fetch: transports.fetch },
  app: { getVersion: () => '1.4.0' },
  ipcMain: {}
}))
vi.mock('node:http', () => ({ request: transports.request }))
vi.mock('node:https', () => ({ request: transports.request }))
import { submitFeedback } from '../ipc/feedback'
import { postFeedback, type FeedbackSubmitBody } from '../ipc/feedback-request'
import { uploadBundle, deleteBundle } from './diagnostic-bundle-upload'
import { postJsonForJson } from './diagnostic-upload-http'
import { resolveDiagnosticTokenEndpoint } from './diagnostic-upload-endpoint'

afterEach(() => vi.unstubAllEnvs())

describe('fork diagnostic and feedback transport', () => {
  it('refuses feedback, crash attachments, and direct feedback transport without reporting delivery', async () => {
    for (const submissionType of ['feedback', 'crash'] as const) {
      await expect(
        submitFeedback({
          feedback: 'local report',
          submissionType,
          submitAnonymously: true,
          githubLogin: null,
          githubEmail: null
        })
      ).resolves.toMatchObject({ ok: false, status: null })
    }
    await expect(
      postFeedback('https://orca.dev/v1/feedback', {} as FeedbackSubmitBody)
    ).rejects.toThrow(/disabled/i)
    expect(transports.fetch).not.toHaveBeenCalled()
  })

  it('refuses configured or cached diagnostic endpoints at the request boundary', async () => {
    vi.stubEnv('ORCA_DIAGNOSTICS_TOKEN_URL', 'https://example.test/tokens')
    expect(resolveDiagnosticTokenEndpoint()).toBeNull()
    await expect(
      uploadBundle({
        tokenEndpoint: 'https://example.test/tokens',
        payload: '{}',
        bundleSubmissionId: 'local'
      })
    ).rejects.toThrow(/disabled/i)
    await expect(
      deleteBundle({ tokenEndpoint: 'https://example.test/tokens', ticketId: 'cached' })
    ).rejects.toThrow(/disabled/i)
    await expect(postJsonForJson('https://example.test/tokens', {}, 100)).rejects.toThrow(
      /disabled/i
    )
    expect(transports.request).not.toHaveBeenCalled()
  })
})
