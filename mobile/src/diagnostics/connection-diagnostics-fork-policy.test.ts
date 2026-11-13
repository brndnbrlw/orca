import { describe, expect, it, vi } from 'vitest'
import { submitConnectionDiagnostics } from './connection-diagnostics-submission'

describe('Orca mobile diagnostic upload policy', () => {
  it('rejects explicit uploads before a report can reach the vendor endpoint', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 200 }))
    expect(
      await submitConnectionDiagnostics(
        {
          report: 'redacted local report',
          appVersion: '1.4.214',
          platform: 'web'
        },
        fetcher
      )
    ).toMatchObject({ ok: false })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
