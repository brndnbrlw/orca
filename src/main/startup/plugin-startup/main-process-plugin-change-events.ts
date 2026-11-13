import { BrowserWindow } from 'electron'
import type { Store } from '../../persistence/loading-store/store'
import type { PluginService } from '../../plugins/plugin-service'
import { setMainPluginLanguagePacks, setMainUiLanguage } from '../../i18n/main-i18n'
import { isUsablePluginLanguagePack } from '../../../shared/plugins/languages/plugin-language-pack-coverage'
import { rebuildAppMenu } from '../../menu/register-app-menu'
import { rebuildSystemTrayMenu } from '../../tray/system-tray'

/** Keep desktop language/menu updates and window notifications on the current plugin service. */
export function bindDesktopPluginChangedEvents(
  store: Store,
  pluginService: PluginService,
  getCurrentPluginService: () => PluginService | null | undefined
): void {
  pluginService.onChanged((event) => {
    if (
      event.contentPacksChanged &&
      setMainPluginLanguagePacks(
        (getCurrentPluginService()?.contentPacks.languagePacks.list() ?? []).filter(
          isUsablePluginLanguagePack
        )
      )
    ) {
      void setMainUiLanguage(store.getSettings().uiLanguage).then(() => {
        rebuildAppMenu()
        rebuildSystemTrayMenu()
      })
    }
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('plugins:changed', event)
      }
    }
  })
}
