import { ORCA_FORK_POLICY } from '../../shared/orca-fork-policy'
import type { BrowserWindow } from 'electron'
import type {
  LinuxPackageInstallInstructions,
  UpdateCheckOptions,
  UpdateStatus
} from '../../shared/update-status-types'
import type {
  RemoteServerUpdateInstallResult,
  RemoteServerUpdaterSnapshot,
  RemoteServerUpdateSupport
} from '../../shared/remote-server-update'
import type { ReleaseBuild, ReleaseChannel } from '../../shared/release-channel'
import type { ReleaseBuildListOptions } from './releases/updater-release-build-cache'
import { UpdaterSetup, type UpdaterSetupOptions } from './lifecycle/updater-setup'
import type { UpdateInstallMode } from './lifecycle/updater-state'

const updater = new UpdaterSetup()

function assertVendorUpdaterEnabled(): void {
  if (!ORCA_FORK_POLICY.vendorServices) {
    throw new Error('Vendor updates are disabled in this fork.')
  }
}

export function resolveUpdateInstallMode(isServeMode: boolean): UpdateInstallMode {
  return updater.resolveUpdateInstallMode(isServeMode)
}

export function getUpdateStatus(): UpdateStatus {
  if (!ORCA_FORK_POLICY.vendorServices) {
    return {
      state: 'error',
      message: 'Vendor updates are disabled in this fork.',
      retryable: false
    }
  }
  return updater.getUpdateStatus()
}

export function getRemoteServerUpdateSupport(): RemoteServerUpdateSupport {
  if (!ORCA_FORK_POLICY.vendorServices) {
    return {
      installMode: 'unsupported-headless-serve',
      automatic: false,
      reason: 'updater-unavailable'
    }
  }
  return updater.getRemoteServerUpdateSupport()
}

export function getRemoteServerUpdaterSnapshot(runtimeId: string): RemoteServerUpdaterSnapshot {
  if (!ORCA_FORK_POLICY.vendorServices) {
    return {
      ...updater.getRemoteServerUpdaterSnapshot(runtimeId),
      support: getRemoteServerUpdateSupport(),
      status: getUpdateStatus()
    }
  }
  return updater.getRemoteServerUpdaterSnapshot(runtimeId)
}

export function checkForRemoteServerUpdate(
  runtimeId: string,
  options?: UpdateCheckOptions
): RemoteServerUpdaterSnapshot {
  if (!ORCA_FORK_POLICY.vendorServices) {
    return getRemoteServerUpdaterSnapshot(runtimeId)
  }
  return updater.checkForRemoteServerUpdate(runtimeId, options)
}

export function downloadRemoteServerUpdate(runtimeId: string): RemoteServerUpdaterSnapshot {
  if (!ORCA_FORK_POLICY.vendorServices) {
    return getRemoteServerUpdaterSnapshot(runtimeId)
  }
  return updater.downloadRemoteServerUpdate(runtimeId)
}

export function installRemoteServerUpdate(runtimeId: string): RemoteServerUpdateInstallResult {
  assertVendorUpdaterEnabled()
  return updater.installRemoteServerUpdate(runtimeId)
}

export function checkForUpdates(): void {
  if (!ORCA_FORK_POLICY.vendorServices) {
    return
  }
  updater.checkForUpdates()
}

export function checkForUpdatesFromMenu(options?: UpdateCheckOptions): void {
  assertVendorUpdaterEnabled()
  updater.checkForUpdatesFromMenu(options)
}

export function downloadUpdate(): void {
  assertVendorUpdaterEnabled()
  updater.downloadUpdate()
}

export function quitAndInstall(): void {
  assertVendorUpdaterEnabled()
  updater.quitAndInstall()
}

export function isQuittingForUpdate(): boolean {
  return ORCA_FORK_POLICY.vendorServices && updater.isQuittingForUpdate()
}

export async function getLinuxPackageInstallInstructions(): Promise<LinuxPackageInstallInstructions> {
  assertVendorUpdaterEnabled()
  return updater.getLinuxPackageInstallInstructions()
}

export async function showLinuxPackage(): Promise<void> {
  assertVendorUpdaterEnabled()
  return updater.showLinuxPackage()
}

export async function listAvailableReleaseBuilds(
  channel: ReleaseChannel,
  options?: ReleaseBuildListOptions
): Promise<ReleaseBuild[]> {
  assertVendorUpdaterEnabled()
  return updater.listAvailableReleaseBuilds(channel, options)
}

export function dismissNudge(): void {
  updater.dismissNudge()
}

export function dismissAvailableUpdate(): void {
  updater.dismissAvailableUpdate()
}

export function setupAutoUpdater(
  mainWindow: BrowserWindow | null,
  opts?: UpdaterSetupOptions
): void {
  if (!ORCA_FORK_POLICY.vendorServices) {
    return
  }
  updater.setupAutoUpdater(mainWindow, opts)
}
