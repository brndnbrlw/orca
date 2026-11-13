import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { RuntimeRpcResponse } from '../../../shared/runtime-rpc-envelope'
import type { RuntimeClientEvent } from '../../../shared/runtime-client-events'
import type { WebRuntimeSubscriptionCallbacks } from './web-runtime-subscription-contract'
import {
  installBrowserGlobals,
  writeStoredRuntimeEnvironment
} from './web-preload-api-test-harness'
import { createCompatibleRuntimeStatusResponse } from '@/runtime/rpc/testing/runtime-compatibility-test-fixture'
import { useAppStore } from '@/store'
import { registerRuntimeClientIpcBridge } from '../hooks/ipc-events/runtime-client-ipc-bridge'
import { runtimeCompatibilityChecks } from '@/runtime/rpc/compatibility/runtime-compatibility-cache'
import { clearLinearRequestMaps } from '@/store/slices/linear/linear-slice-request-state'
import { issue } from '@/store/slices/linear/linear-slice-test-harness'

const TEST_NOW = 1_799_999_999_000
const cleanups: (() => void)[] = []
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TEST_NOW)
})
afterEach(() => {
  cleanups.splice(0).forEach((stop) => stop())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.doUnmock('./web-runtime-client')
})

async function installPairedApi() {
  const status = createCompatibleRuntimeStatusResponse('runtime-a')
  const call = vi.fn(
    async (method: string, _params?: unknown): Promise<RuntimeRpcResponse<unknown>> => {
      if (method === 'status.get') {
        return status
      }
      return { id: method, ok: true, result: null, _meta: status._meta }
    }
  )
  let respond: WebRuntimeSubscriptionCallbacks['onResponse'] = () => {}
  const unsubscribe = vi.fn()
  const subscribe = vi.fn(
    async (_method: string, _params: unknown, callbacks: WebRuntimeSubscriptionCallbacks) => {
      respond = callbacks.onResponse
      return { unsubscribe, sendBinary: vi.fn() }
    }
  )
  vi.doMock('./web-runtime-client', () => ({
    WebRuntimeClient: class {
      call = call
      subscribe = subscribe
      close(): void {}
    }
  }))
  const globals = installBrowserGlobals()
  writeStoredRuntimeEnvironment(globals.storage, 'web-server-a')
  const { installWebPreloadApi } = await import('./web-preload-api')
  installWebPreloadApi()
  return {
    api: globals.window.api,
    call,
    subscribe,
    unsubscribe,
    status,
    emit: (event: RuntimeClientEvent) =>
      respond({ id: 'events', ok: true, result: event, _meta: status._meta })
  }
}

it('registers the desktop-only Linear listener synchronously without a listener RPC', async () => {
  const h = await installPairedApi()
  const callback = vi.fn()
  const stop = h.api.linear.onLinkedIssueUpdated?.(callback)
  expect(typeof stop).toBe('function')
  stop?.()
  expect(h.call).not.toHaveBeenCalled()
  expect(h.subscribe).not.toHaveBeenCalled()
  expect(callback).not.toHaveBeenCalled()
})

it('forwards supported Linear calls and preserves runtime method errors', async () => {
  const h = await installPairedApi()
  await h.api.linear.status()
  await h.api.linear.searchIssues({ query: 'ENG-1', limit: 5, workspaceId: 'workspace-a' })
  await h.api.linear.createIssue({ teamId: 'team-a', title: 'A linked issue' })
  await h.api.linear.listProjects({ workspaceId: 'all', force: true })
  await h.api.linear.disconnect()
  expect(h.call.mock.calls).toEqual([
    ['linear.status', undefined, { timeoutMs: undefined }],
    [
      'linear.searchIssues',
      { query: 'ENG-1', limit: 5, workspaceId: 'workspace-a' },
      { timeoutMs: undefined }
    ],
    ['linear.createIssue', { teamId: 'team-a', title: 'A linked issue' }, { timeoutMs: undefined }],
    ['linear.listProjects', { workspaceId: 'all', force: true }, { timeoutMs: undefined }],
    ['linear.disconnect', undefined, { timeoutMs: undefined }]
  ])
  h.call.mockResolvedValueOnce({
    id: 'linear.status',
    ok: false,
    error: { code: 'method_not_found', message: 'Unknown method: linear.status' }
  })
  await expect(h.api.linear.status()).rejects.toThrow('Unknown method: linear.status')
})

it('bootstraps paired project discovery and routes Linear events through the owned runtime stream', async () => {
  const h = await installPairedApi()
  const initialState = useAppStore.getState()
  const fetchRuntimeEnvironmentRepos = vi.fn(async () => [])
  useAppStore.setState({
    settings: null,
    runtimeEnvironments: await h.api.runtimeEnvironments.list(),
    runtimeStatusByEnvironmentId: new Map([
      ['web-server-a', { status: h.status.result, checkedAt: TEST_NOW }]
    ]),
    linearIssueCache: {},
    linearSearchCache: {},
    linearListCache: {},
    linearProjectIssueCache: {},
    linearCustomViewIssueCache: {},
    fetchRuntimeEnvironmentRepos,
    fetchProjectGroups: vi.fn(async () => {}),
    fetchFolderWorkspaces: vi.fn(async () => {}),
    fetchWorktreeLineage: vi.fn(async () => {}),
    fetchHostWorkspaceStatuses: vi.fn(async () => {}),
    refreshRuntimeEnvironmentStatus: vi.fn(async () => true)
  })
  cleanups.push(() => {
    clearLinearRequestMaps()
    runtimeCompatibilityChecks.clear()
    useAppStore.setState(initialState, true)
  })
  const unsubs: (() => void)[] = []
  const stopStore = registerRuntimeClientIpcBridge(unsubs, {
    worktreeChangeRefreshQueue: { enqueue: vi.fn(), dispose: vi.fn() },
    activateNotifiedWorktree: vi.fn(async () => {})
  })
  const stop = () => {
    stopStore()
    unsubs.splice(0).forEach((unsubscribe) => unsubscribe())
  }
  cleanups.unshift(stop)
  await vi.waitFor(() => expect(fetchRuntimeEnvironmentRepos).toHaveBeenCalledWith('web-server-a'))
  expect(h.subscribe).toHaveBeenCalledWith(
    'runtime.clientEvents.subscribe',
    { browserHostRequests: true },
    expect.objectContaining({ onResponse: expect.any(Function) }),
    expect.any(Object)
  )
  const updated = { ...issue('ENG-1'), workspaceId: 'workspace-a', title: 'Updated by paired host' }
  h.call.mockImplementation(async (method) =>
    method === 'status.get'
      ? h.status
      : { id: method, ok: true, result: updated, _meta: h.status._meta }
  )
  const event: RuntimeClientEvent = {
    type: 'linearLinkedIssueUpdated',
    worktreeId: 'missing-row',
    identifier: 'ENG-1',
    workspaceId: 'workspace-a'
  }
  h.emit(event)
  await vi.waitFor(() =>
    expect(useAppStore.getState().linearIssueCache['workspace-a::ENG-1']?.data?.title).toBe(
      'Updated by paired host'
    )
  )
  expect(h.call).toHaveBeenCalledWith(
    'linear.getIssue',
    { id: 'ENG-1', workspaceId: 'workspace-a' },
    { timeoutMs: undefined }
  )
  stop()
  expect(h.unsubscribe).toHaveBeenCalled()
  h.call.mockClear()
  h.emit({ ...event, identifier: 'ENG-2' })
  await Promise.resolve()
  expect(h.call).not.toHaveBeenCalled()
})
