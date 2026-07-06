/**
 * @file sessions.ts
 * @description Manages isolated browsing sessions within the extension.
 * Allows users to group a set of tabs into a logical "session" which
 * can be named and persisted. Manages the creation of new windows for these
 * sessions, tracks the tabs captured, and handles saving session metadata to storage.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { nowUtc } from '../../../../src/shared-components/utils';
import { generateEntityId } from '../../../../src/shared-components/utils/idGenerator';
import { createNotification } from '@notifications/notifications';
import { db } from '../../../../src/storage/indexDB/dbConfig';

export interface SessionOpenSettings {
  openMode: 'same_window' | 'new_window';
  autoSaveMode: 'auto_save' | 'dont_save';
  pinSessionTab?: boolean;
}

export interface ActiveSessionEntry {
  sessionId: string;
  sessionName: string;
  windowId: number;
  pinnedTabId: number;
  workspaceId: string;
  folderId: string | null;
  teamId?: string;
  storageMode?: 'local' | 'cloud';
  capturedUrls: string[];
  capturedNames: string[];
  createdAt: string;
  initialTabUrls?: Record<number, string>;
  openSettings?: SessionOpenSettings;
}

/**
 * In-memory map keyed by windowId for fast lookup of active sessions.
 */
export const activeSessions = new Map<number, ActiveSessionEntry>();

/**
 * Restores sessions from local storage when the service worker wakes up.
 */
export async function restoreActiveSessions() {
  try {
    const result = await chrome.storage.local.get('active_sessions');
    const stored: ActiveSessionEntry[] = result.active_sessions || [];
    stored.forEach(s => activeSessions.set(s.windowId, s));
  } catch (e) {
    console.error('[Session] Failed to restore sessions:', e);
  }
}

// Trigger initial restore
restoreActiveSessions();

/**
 * Persists the current in-memory active sessions to local storage.
 */
export function persistActiveSessions() {
  const sessions = Array.from(activeSessions.values());
  chrome.storage.local.set({ active_sessions: sessions }).catch(() => {});
}

/**
 * Handles incoming messages related to session management (start, end, update).
 *
 * @param request The message payload sent from the client/content script.
 * @param sender The sender information.
 * @param sendResponse The callback to send a response back.
 * @returns {boolean | undefined} True if the message requires an asynchronous response.
 */
export function handleSessionMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (res: any) => void,
): boolean | undefined {
  if (request.action === 'start_session') {
    const {
      sessionName,
      workspaceId,
      folderId,
      teamId,
      storageMode,
      sessionId: reqSessionId,
      initialUrls = [],
      initialNames = [],
      openSettings,
    } = request;
    const sessionId = reqSessionId || generateEntityId('session');
    const encodedName = encodeURIComponent(sessionName);
    const pinnedTabUrl = chrome.runtime.getURL(
      `AltS_search_newtab/index.html?session_mode=true&session_id=${sessionId}&session_name=${encodedName}`,
    );
    console.log('[SessionFlow][background] start_session received', { sessionId, sessionName, workspaceId, folderId, initialUrlCount: initialUrls.length, pinnedTabUrl });

    chrome.storage.local.get('session_open_settings', (result) => {
      const storedSettings = result.session_open_settings || { openMode: 'new_window', autoSaveMode: 'auto_save' };
      const settings: SessionOpenSettings = openSettings || storedSettings;
      const useSameWindow = settings.openMode === 'same_window';

      if (useSameWindow) {
        // ─── Same Window Mode ──────────────────────────────────────────────
        // Open tabs in the current (sender) window instead of creating a new one.
        const senderWindowId = sender?.tab?.windowId;

        const openInWindow = (windowId: number) => {
          // Pin the sender tab (the extension tab where the session is created) and make it the control tab
          const senderTabId = sender?.tab?.id;
          
          const finishSetup = (pinnedTabId: number) => {
            const initialTabUrls: Record<number, string> = {};
            if (pinnedTabId > 0) {
              initialTabUrls[pinnedTabId] = pinnedTabUrl;
            }

            // Open the initial URLs as new tabs
            const openedTabIds: number[] = [];
            let tabsOpened = 0;
            const validInitialUrls = initialUrls.filter((url: string) => url && (url.startsWith('http') || url.startsWith('chrome-extension')));
            const totalToOpen = validInitialUrls.length;

            const onAllTabsOpened = () => {
              const session: ActiveSessionEntry = {
                sessionId,
                sessionName,
                windowId,
                pinnedTabId,
                workspaceId,
                folderId: folderId || null,
                teamId,
                storageMode: storageMode || 'cloud',
                capturedUrls: [...initialUrls],
                capturedNames: [...initialNames],
                createdAt: nowUtc(),
                initialTabUrls,
                openSettings: settings,
              };

              activeSessions.set(windowId, session);
              persistActiveSessions();
              sendResponse({ ok: true, sessionId });
            };

            if (totalToOpen === 0) {
              onAllTabsOpened();
              return;
            }

            validInitialUrls.forEach((url: string, index: number) => {
              chrome.tabs.create({ url, windowId, active: false }, newTab => {
                if (newTab?.id) {
                  openedTabIds.push(newTab.id);
                  initialTabUrls[newTab.id] = url;
                }
                tabsOpened++;
                if (tabsOpened === totalToOpen) {
                  onAllTabsOpened();
                }
              });
            });
          };

          const shouldPin = settings.pinSessionTab !== false;
          if (senderTabId) {
            const updateProps: chrome.tabs.UpdateProperties = { pinned: shouldPin };
            if (!request.isInlineCreation) {
              updateProps.url = pinnedTabUrl;
            }
            chrome.tabs.update(senderTabId, updateProps, (updatedTab) => {
              finishSetup(updatedTab?.id ?? senderTabId);
            });
          } else {
            chrome.tabs.create({ url: pinnedTabUrl, windowId, pinned: shouldPin, active: false }, pinnedTab => {
              if (chrome.runtime.lastError || !pinnedTab) {
                console.error('[Session] Failed to create pinned tab:', chrome.runtime.lastError);
                sendResponse({ ok: false, error: 'pinned_tab_create_failed' });
                return;
              }
              finishSetup(pinnedTab.id ?? -1);
            });
          }
        };

        if (senderWindowId) {
          openInWindow(senderWindowId);
        } else {
          // Fallback: get the current focused window
          chrome.windows.getCurrent({ populate: false }, currentWindow => {
            if (currentWindow?.id) {
              openInWindow(currentWindow.id);
            } else {
              sendResponse({ ok: false, error: 'no_window_found' });
            }
          });
        }
      } else {
        // ─── New Window Mode (default / existing behavior) ─────────────────
        const validInitialUrls = initialUrls.filter((url: string) => url && (url.startsWith('http') || url.startsWith('chrome-extension')));
        const urlsToOpen = [pinnedTabUrl, ...validInitialUrls];
        chrome.windows.create({ url: urlsToOpen, type: 'normal' }, newWindow => {
          if (chrome.runtime.lastError || !newWindow) {
            console.error('[Session] Failed to create window:', chrome.runtime.lastError);
            sendResponse({ ok: false, error: 'window_create_failed' });
            return;
          }

          const pinnedTabId = newWindow.tabs?.[0]?.id ?? -1;
          console.log('[SessionFlow][background] New window created. windowId:', newWindow.id, '| pinnedTabId:', pinnedTabId, '| tabCount:', newWindow.tabs?.length);
          if (pinnedTabId > 0) {
            const shouldPin = settings.pinSessionTab !== false;
            console.log(`[SessionFlow][background] → pinning tab: ${pinnedTabId} (pin: ${shouldPin})`);
            chrome.tabs.update(pinnedTabId, { pinned: shouldPin, active: true });
          } else {
            console.warn('[SessionFlow][background] ⚠ pinnedTabId is invalid, tab will not be pinned');
          }

          const initialTabUrls: Record<number, string> = {};
          if (newWindow.tabs) {
            newWindow.tabs.forEach((t, index) => {
              if (t.id) {
                const url = t.url || urlsToOpen[index];
                if (url) {
                  initialTabUrls[t.id] = url;
                }
              }
            });
          }

          const session: ActiveSessionEntry = {
            sessionId,
            sessionName,
            windowId: newWindow.id!,
            pinnedTabId,
            workspaceId,
            folderId: folderId || null,
            teamId,
            storageMode: storageMode || 'cloud',
            capturedUrls: [...initialUrls],
            capturedNames: [...initialNames],
            createdAt: nowUtc(),
            initialTabUrls,
            openSettings: settings,
          };

          activeSessions.set(newWindow.id!, session);
          persistActiveSessions();
          console.log('[SessionFlow][background] ✓ session saved to activeSessions. windowId:', newWindow.id, '| sessionId:', sessionId);
          sendResponse({ ok: true, sessionId });
        });
      }
    });

    return true; // async
  }

  if (request.action === 'update_session_id') {
    const { oldSessionId, newSessionId } = request;
    for (const [windowId, session] of activeSessions.entries()) {
      if (session.sessionId === oldSessionId) {
        session.sessionId = newSessionId;
        activeSessions.set(windowId, session);
        persistActiveSessions();
        break;
      }
    }
    sendResponse({ ok: true });
    return false; // sync
  }

  if (request.action === 'end_session') {
    const { windowId } = request;
    const session = activeSessions.get(windowId);
    if (session) {
      activeSessions.delete(windowId);
      persistActiveSessions();
      
      db.sessions.get(session.sessionId).then(sessionRecord => {
        const savedCount = sessionRecord?.urls ? sessionRecord.urls.length : session.capturedUrls.length;
        createNotification(null, {
          title: 'Session Complete',
          message: `"${session.sessionName}" — ${savedCount} tab${savedCount !== 1 ? 's' : ''} saved`,
        });
      }).catch(err => {
        createNotification(null, {
          title: 'Session Complete',
          message: `"${session.sessionName}" — ${session.capturedUrls.length} tab${session.capturedUrls.length !== 1 ? 's' : ''} saved`,
        });
      });
    }
    sendResponse({ ok: true });
    return false; // sync
  }

  return undefined;
}
