import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import type { OrcaVmRecipe } from './orca-yaml-hook-types'
import { quoteShellToken, runRecipeCommand } from './ephemeral-vm-recipe-process'
import { doctorEphemeralVmRecipe } from './ephemeral-vm-recipe-doctor'
import {
  runEphemeralVmRecipeStart,
  runEphemeralVmRecipeCleanup,
  runEphemeralVmRecipeSuspend,
  runEphemeralVmRecipeResume
} from './ephemeral-vm-recipe-runner'

let root: string
let marker: string
let recipe: OrcaVmRecipe
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-recipe-policy-'))
  marker = join(root, 'execution.txt')
  await writeFile(marker, 'unexecuted')
  const script = join(root, 'recipe.cjs')
  await writeFile(script, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed')`)
  const command = `${quoteShellToken(process.execPath)} ${quoteShellToken(script)}`
  recipe = {
    id: 'saved-approved',
    name: 'Saved recipe',
    create: command,
    destroy: command,
    suspend: command,
    resume: command
  }
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})
it('denies saved recipe create, destroy, suspend, resume and direct shell execution before scripts run', async () => {
  const args = { recipe, repoPath: root, context: { recipeId: recipe.id, repoPath: root } }
  for (const execute of [
    () => runEphemeralVmRecipeStart({ recipe, repoPath: root }),
    () => runEphemeralVmRecipeCleanup(args),
    () => runEphemeralVmRecipeSuspend(args),
    () => runEphemeralVmRecipeResume(args),
    () =>
      runRecipeCommand({
        command: recipe.create,
        repoPath: root,
        context: args.context,
        mode: 'create',
        resultSchemaVersion: 1
      })
  ]) {
    await expect(execute()).rejects.toThrow('Cloud recipes are disabled in this Orca fork')
    expect(await readFile(marker, 'utf8')).toBe('unexecuted')
  }
})
it('denies lifecycle no-ops and doctor while preserving the doctor result shape', async () => {
  const args = {
    recipe: { ...recipe, destroyDisabled: true, suspend: undefined, resume: undefined },
    repoPath: root,
    context: { recipeId: recipe.id, repoPath: root }
  }
  await expect(runEphemeralVmRecipeCleanup(args)).rejects.toThrow('Cloud recipes are disabled')
  await expect(runEphemeralVmRecipeSuspend(args)).rejects.toThrow('Cloud recipes are disabled')
  await expect(runEphemeralVmRecipeResume(args)).rejects.toThrow('Cloud recipes are disabled')
  expect(
    doctorEphemeralVmRecipe({
      repoPath: root,
      recipeId: recipe.id,
      recipes: [recipe],
      localExecutionSupported: true
    })
  ).toMatchObject({
    recipeId: 'saved-approved',
    repoPath: root,
    ok: false,
    checks: [{ id: 'recipe.policy', status: 'fail' }]
  })
})
