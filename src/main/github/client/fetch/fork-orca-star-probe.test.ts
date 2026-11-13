import { expect, it, vi } from 'vitest'
const gh = vi.hoisted(() => vi.fn(async () => ({ stdout: 'HTTP/2 204', stderr: '' })))
vi.mock('../../../git/command-runner/hosted-cli/gh-exec-file', () => ({ ghExecFileAsync: gh }))
import { checkOrcaStarred } from './orca-star'

it('leaves upstream star state unknown without using the user GitHub credentials', async () => {
  await expect(checkOrcaStarred()).resolves.toBeNull()
  expect(gh).not.toHaveBeenCalled()
})
