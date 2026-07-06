/**
 * @file sessionSettings.ts
 * @description Manages session open behavior settings. These settings control
 * how session links are opened (same window vs new window), tab pinning behavior,
 * auto-save preferences, and tab positioning. Settings are persisted in
 * chrome.storage.local under the key 'session_open_settings'.
 */

export interface SessionOpenSettings {
  /** Whether to open session tabs in the current window or a new window */
  openMode: 'same_window' | 'new_window';

  /** Auto-save behavior: append closed/opened tabs, sync exactly to window, or dont save */
  autoSaveMode: 'auto_save' | 'dont_save';

  /** Whether the session editor newtab itself should be pinned when opening a session */
  pinSessionTab?: boolean;
}

const STORAGE_KEY = 'session_open_settings';

export const DEFAULT_SESSION_SETTINGS: SessionOpenSettings = {
  openMode: 'new_window',
  autoSaveMode: 'auto_save',
  pinSessionTab: true,
};

/**
 * Reads session open settings from chrome.storage.local.
 * Returns defaults if no settings are stored yet.
 */
export async function loadSessionSettings(): Promise<SessionOpenSettings> {
  return new Promise<SessionOpenSettings>((resolve) => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) {
      resolve({ ...DEFAULT_SESSION_SETTINGS });
      return;
    }

    chromeAny.storage.local.get(STORAGE_KEY, (result: any) => {
      const stored = result?.[STORAGE_KEY];
      if (stored && typeof stored === 'object') {
        resolve({
          ...DEFAULT_SESSION_SETTINGS,
          ...stored,
        });
      } else {
        resolve({ ...DEFAULT_SESSION_SETTINGS });
      }
    });
  });
}

/**
 * Saves session open settings to chrome.storage.local.
 */
export async function saveSessionSettings(settings: SessionOpenSettings): Promise<void> {
  return new Promise<void>((resolve) => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) {
      resolve();
      return;
    }

    chromeAny.storage.local.set({ [STORAGE_KEY]: settings }, () => {
      resolve();
    });
  });
}

/**
 * Partially updates session settings. Merges with existing stored settings.
 */
export async function updateSessionSettings(
  partial: Partial<SessionOpenSettings>,
): Promise<SessionOpenSettings> {
  const current = await loadSessionSettings();
  const updated = { ...current, ...partial };
  await saveSessionSettings(updated);
  return updated;
}
