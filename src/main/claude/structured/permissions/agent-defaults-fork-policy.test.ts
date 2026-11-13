import { describe, expect, it } from 'vitest'
import { buildDefaultSettings } from '../../../../shared/default-global-settings'
import { structuredLaunchSeedOptions } from '../../../../shared/native-chat/input/native-chat-session-option-defaults'
import { newChatPermissionModeForSettings } from '../../../../shared/agent-launch/permissions/agent-chat-permission-mode'
import { resolveTuiAgentLaunchArgs } from '../../../../shared/agent-launch/choices/tui-agent-launch-defaults'
import { codexStructuredPermissionPolicy } from '../../../../shared/codex-permission-policy'
import { claudeStructuredPermissionOptions } from '../launch/claude-structured-launch-resolution'

function freshSettings() {
  return buildDefaultSettings({
    workspaceDir: '/data/workspaces',
    appFontFamily: 'system',
    editorAutoSaveDelayMs: 1000,
    primarySelectionMiddleClickPaste: false,
    primarySelectionDefaultedForLinux: true,
    terminalFontFamily: 'monospace',
    terminalFontWeight: 400,
    terminalInactivePaneOpacity: 1,
    terminalRightClickToPaste: false,
    notifications: {
      enabled: false,
      agentTaskComplete: false,
      agentNeedsInput: false,
      terminalBell: false,
      suppressWhenFocused: true,
      customSoundId: 'system',
      customSoundPath: null,
      customSoundVolume: 1,
      mutedNotificationSourceIds: [],
      notifyHiddenWorkspaces: false
    },
    voice: {
      enabled: false,
      sttModel: '',
      modelsDir: '',
      dictationLanguage: 'auto',
      dictationMode: 'toggle',
      dictationHoldToRecord: false,
      removeFillerWords: false,
      terminalConfirmBeforeInsert: true,
      openAiApiKeyConfigured: false,
      microphoneDeviceId: null,
      microphoneDeviceLabel: null,
      unloadModelAfterMinutes: 5
    }
  })
}

describe('Orca fork agent launch approvals', () => {
  it('fresh Claude and Codex chat and terminal launches require approvals', () => {
    const settings = freshSettings()
    for (const agent of ['claude', 'codex'] as const) {
      const mode = newChatPermissionModeForSettings(agent, settings)
      expect(structuredLaunchSeedOptions(settings, agent)).toMatchObject({ permissionMode: 'ask' })
      expect(resolveTuiAgentLaunchArgs(agent, settings)).not.toMatch(/dangerously|--yolo/)
      if (mode !== 'ask') {
        throw new Error(`Unexpected default permission: ${mode}`)
      }
      if (agent === 'claude') {
        expect(claudeStructuredPermissionOptions(mode)).toEqual({ permissionMode: 'default' })
      } else {
        expect(codexStructuredPermissionPolicy(mode)).toMatchObject({
          approvalPolicy: 'on-request',
          sandbox: 'read-only'
        })
        expect(resolveTuiAgentLaunchArgs(agent, settings)).toContain('read-only')
      }
    }
  })

  it('honors an explicit full-access selection rather than changing user choices', () => {
    const settings = { ...freshSettings(), agentPermissionDefault: 'full-access' as const }
    expect(
      claudeStructuredPermissionOptions(
        newChatPermissionModeForSettings('claude', settings) ?? 'ask'
      )
    ).toEqual({ extraArgs: { 'dangerously-skip-permissions': null } })
    const mode = newChatPermissionModeForSettings('codex', settings)
    if (mode !== 'full-access') {
      throw new Error('Explicit choice was not preserved')
    }
    expect(codexStructuredPermissionPolicy(mode)).toMatchObject({
      approvalPolicy: 'never',
      sandbox: 'danger-full-access'
    })
  })
})
