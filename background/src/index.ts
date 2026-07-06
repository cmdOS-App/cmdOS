/**
 * @file index.ts
 * @description Main entry point for the extension service worker / background script.
 * Acts as the central event router for Chrome extension lifecycle events (installation,
 * messaging, tab/window updates, commands, and alarms) and delegates execution to 
 * specific domain controllers.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'webextension-polyfill';
import { handleTodoAlarm } from '@todos/todos';
import { handleAutomationAlarm } from '@automation/runtime_Execution_Engine/runner';
import { setupContextMenus, attachContextMenuListeners } from '@chatAgents/contextMenus';


import { CMDOS_INSTALL_URL } from '@config/config';
import { setupOmnibox } from './commandTerminal/omnibox/omniboxEvents';

setupOmnibox();

import {
  backgroundSync,
  handleTodoMessage,
  findTodoById,
} from '@todos/todos';

import { createNotification, handleNotificationClick } from '@notifications/notifications';
import { db } from '../../src/storage/indexDB/dbConfig';

import { handleSessionMessage, activeSessions, persistActiveSessions } from '@browserWindows/sessions';

import {
  executeAutomation,
  stopCurrentAutomation,
  pendingAutoSubmitTabs,
} from '@automation/runtime_Execution_Engine/runner';

import {
  handleDriveMessage,
} from '@automation/integrations/googleDriveSync';

import {
  pendingAiSessions,
  tabPromptQueues,
  processingTabs,
  ensureStateRestored,
  processTabQueue,
  executeAutoSubmit,
  handleAiMessage,
} from '@chatAgents/runtimeExecutionEngine';
import type { PendingAiSession } from '@chatAgents/runtimeExecutionEngine';
// import { editTodo, updateSnippetRealtime, createSnippet } from '../../src/storage/_private/API/features/snippetApi';
// import { cleanupStaleSnapshots } from '../../src/storage/_private/API/services/backupService';
import { handleBrowserWindowMessage } from '@browserWindows/index';
import { handleSearchMessage } from '@browserData/index';
import { handleHotkeyMessage } from '@hotkeys/hotkeys';
import { handleExtractorMessage } from '@preBuiltCommands/extraction/index';
import { handleElementPickerMessage } from '@automation/domSelector/visualPicker';
import { handleAuthMessage } from '@_authentication/auth';
// import { runDrivePullCheck } from '../../src/storage/_private/API/services/backup/continuationSync';

let newTabKeystrokeRecordingTabId: number | null = null;
// Initial sync
backgroundSync();
attachContextMenuListeners();
// cleanupStaleSnapshots().catch(() => {});

const TOGGLE_ALTS_MESSAGE = 'tasklabs:toggle-alts-popup';
const TOGGLE_ALTQ_MESSAGE = 'tasklabs:toggle-altq-popup';

chrome.runtime.onInstalled.addListener(async details => {
  setupContextMenus();

  // Create periodic alarm for background sync (every 30 minutes)
  chrome.alarms.create('tasklabs-periodic-sync', { periodInMinutes: 30 });

  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    await chrome.storage.local.set({ omnibox_override_enabled: false });

    const tutorialUrl = CMDOS_INSTALL_URL;

    if (chrome.tabs?.create) {
      chrome.tabs.create({ url: tutorialUrl }, () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          console.warn('[onInstalled] failed to open tutorials tab:', lastError.message);
        }
      });
    } else {
      console.warn('[onInstalled] chrome.tabs unavailable; unable to auto-open tutorials.');
    }
  }

  const result = await chrome.storage.local.get(['myFavouriteItems']);

  // Set uninstall redirect URL to feedback form
  const uninstallFeedbackUrl = 'https://docs.google.com/forms/d/1YAm02YiQfcc4HoV-XtN1WMkihAL__GH2nwDKkWsMNgI/edit';
  if (chrome.runtime?.setUninstallURL) {
    chrome.runtime.setUninstallURL(uninstallFeedbackUrl, () => {
      if (chrome.runtime.lastError) {
        console.warn('[onInstalled] Failed to set uninstall URL:', chrome.runtime.lastError.message);
      }
    });
  }
});


// Listen for create actions from the content script overlay
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'tasklabs:execute-create-action') {
    const action = message.action; // e.g., 'createnotes', 'createlinks'
    const extensionUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?open_sheet=${action}`);
    chrome.tabs.create({ url: extensionUrl, active: true });
  }

  // Drive Continuation: manual trigger from BackupPanel "Check Now" button
  if (message && message.type === 'TRIGGER_DRIVE_PULL_CHECK') {
    (async () => {
      try {
        // const result = await runDrivePullCheck();
        // console.log('[DriveContinuation] Manual pull result:', result);
        sendResponse({ result: 'temporarily disabled' });
      } catch (err) {
        console.error('[DriveContinuation] Manual pull failed:', err);
        sendResponse({ result: 'error' });
      }
    })();
    return true; // keep message channel open for async response
  }

  return false; // sync handlers — no async response needed
});



chrome.commands?.onCommand?.addListener(command => {
  if (!chrome.tabs?.query) return;

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const activeTab = tabs?.[0];
    const activeTabId = activeTab?.id;
    const activeUrl = activeTab?.url || '';
    const isNewTabPage = activeUrl.startsWith(chrome.runtime.getURL('AltS_search_newtab/'));

    if (typeof activeTabId === 'number' && newTabKeystrokeRecordingTabId === activeTabId && isNewTabPage) {
      return;
    }
    if (command === 'open_alt_q') {
      const isActualNewTabPage =
        isNewTabPage ||
        activeUrl.startsWith('chrome://newtab') ||
        activeUrl.startsWith('chrome://new-tab-page') ||
        activeUrl.startsWith('about:blank');

      if (isNewTabPage && typeof activeTabId === 'number') {
        chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:force-board-view' }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) console.warn('[commands] open_alt_q message error:', lastError.message);
        });
      } else if (isActualNewTabPage && typeof activeTabId === 'number') {
        // Build per-tab storage key
        const focusKey = `new_tab_focus_${activeTabId}`;
        // Try reading the per-tab key first; if undefined, fall back to the old shared key
        chrome.storage.local.get([focusKey, 'new_tab_has_page_focus'], result => {
          const hasFocus = result?.[focusKey] === true || result?.new_tab_has_page_focus === true;
          if (hasFocus) {
            chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:force-board-view' }, () => {
              const lastError = chrome.runtime.lastError;
              if (lastError) console.warn('[commands] open_alt_q message error:', lastError.message);
            });
          } else {
            // Cursor is stuck in the Omnibox — must replace tab to steal focus back.
            const extensionUrl = chrome.runtime.getURL('AltS_search_newtab/index.html?force_board_view=true');
            chrome.tabs.create({ url: extensionUrl, active: true }, () => {
              chrome.tabs.remove(activeTabId);
            });
          }
        });
      } else {
        // We are on an external site! Trigger Alt+S functionality (Command Palette)
        if (typeof activeTabId === 'number') {
          chrome.tabs.sendMessage(activeTabId, { type: TOGGLE_ALTQ_MESSAGE }, () => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              console.warn('[commands] toggle_altq message error:', lastError.message);
            }
          });
        }
      }
    }

    // Clean up per‑tab focus flags when a New‑Tab page is closed
    chrome.tabs.onRemoved.addListener((closedTabId, removeInfo) => {
      const focusKey = `new_tab_focus_${closedTabId}`;
      chrome.storage.local.remove(focusKey, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            '[cleanup] error removing focus key for closed tab',
            closedTabId,
            ':',
            chrome.runtime.lastError.message,
          );
        }
      });
    });

    if (command === 'open_create') {
      if (!chrome.tabs?.query) return;

      const isActualNewTabPage =
        isNewTabPage ||
        activeUrl.startsWith('chrome://newtab') ||
        activeUrl.startsWith('chrome://new-tab-page') ||
        activeUrl.startsWith('about:blank');

      if (isNewTabPage && typeof activeTabId === 'number') {
        chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:open-create-menu' }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) console.warn('[commands] open_create message error:', lastError.message);
        });
      } else if (isActualNewTabPage && typeof activeTabId === 'number') {
        // Build per-tab storage key
        const focusKey = `new_tab_focus_${activeTabId}`;
        chrome.storage.local.get([focusKey, 'new_tab_has_page_focus'], result => {
          const hasFocus = result?.[focusKey] === true || result?.new_tab_has_page_focus === true;
          if (hasFocus) {
            chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:open-create-menu' }, () => {
              const lastError = chrome.runtime.lastError;
              if (lastError) console.warn('[commands] open_create message error:', lastError.message);
            });
          } else {
            // Cursor is stuck in the Omnibox — must replace tab to steal focus back.
            const extensionUrl = chrome.runtime.getURL('AltS_search_newtab/index.html?open_create=true');
            chrome.tabs.create({ url: extensionUrl, active: true }, () => {
              chrome.tabs.remove(activeTabId);
            });
          }
        });
      } else {
        // Send message to active tab to open the overlay menu
        if (typeof activeTabId === 'number') {
          chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:open-create-menu' }, () => {
            const lastError = chrome.runtime.lastError;
            if (lastError) console.warn('[commands] open_create message error:', lastError.message);
          });
        }
      }
    }
  });


});

/**
 * Standardizes a URL by converting it to lowercase, removing protocols (http/https),
 * striping 'www.' prefix, and removing trailing slashes for clean and reliable URL comparisons.
 *
 * @param urlStr Raw URL string to normalize.
 * @returns {string} Normalized URL string.
 */
function normalizeUrlForComparison(urlStr: string): string {
  try {
    let u = urlStr.toLowerCase();
    u = u.replace(/^https?:\/\//, '');
    u = u.replace(/^www\./, '');
    u = u.replace(/\/$/, '');
    return u;
  } catch {
    return urlStr.toLowerCase();
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await ensureStateRestored();

  if (!changeInfo.url && !changeInfo.status) return; // Early return for irrelevant changes

  // 1. AI Chat History Tracking logic (ALWAYS run for registered sessions)
  if ((changeInfo.url || changeInfo.status) && pendingAiSessions.size > 0) {
    const url = changeInfo.url || tab.url || '';
    for (const [sessionId, session] of pendingAiSessions.entries()) {
      const tabIndex = session.tabIds.indexOf(tabId);
      if (tabIndex !== -1) {
        const model = session.models[tabIndex];

        if (changeInfo.url) {
        }

        let isFinal = false;
        // Refined patterns for SPA transitions
        if (model === 'gpt' && url.includes('chatgpt.com/c/')) isFinal = true;
        else if (model === 'gemini' && url.match(/gemini\.google\.com\/app\/([a-zA-Z0-9_-]+)/)) isFinal = true;
        else if (
          model === 'perplexity' &&
          url.includes('perplexity.ai/search/') &&
          !url.includes('/search/new/') // Exclude the intermediate /search/new/UUID loading URL
        )
          isFinal = true;
        else if (model === 'claude' && url.includes('claude.ai/chat/')) isFinal = true;
        else if (model === 'google' && url.includes('google.com/search?q=')) isFinal = true;
        else if (model === 'copilot' && url.includes('copilot.microsoft.com/chats/')) isFinal = true;

        if (isFinal) {
          session.urls[model] = url; // Always update to the latest final URL
          pendingAiSessions.set(sessionId, session);

          // Notify AltS_search_newtab page with updated session URL so it can track the real chat link.
          // We use chrome.runtime.sendMessage to broadcast to all extension pages (like AltS_search_newtab)
          // because chrome.tabs.query might fail to find "AltS_search_newtab" tabs which Chrome often
          // masks as chrome://newtab/ instead of the extension URL.
          chrome.runtime
            .sendMessage({
              action: 'ai_session_url_updated',
              sessionId,
              model,
              url,
              tabId,
            })
            .catch(() => {});
        }
      }
    }
  }

  // 2. Sequential Queue Trigger Logic
  if (changeInfo.status === 'complete') {
    // Fail-safe: If a page load completes, the previous script context or navigation is finished.
    // We clear the processing flag to ensure the queue doesn't stay blocked if the
    // injection script was killed by the navigation.
    if (processingTabs.has(tabId)) {
      processingTabs.delete(tabId);
    }

    const queue = tabPromptQueues.get(tabId);
    if (queue && queue.length > 0) {
      processTabQueue(tabId);
    }
  }

  // ─── Session Tab Capture ─────────────────────────────────────────────────────
  const isComplete = changeInfo.status === 'complete';
  const hasNewUrl = !!changeInfo.url;

  if ((isComplete || hasNewUrl) && tab.url && tab.windowId) {
    const session = activeSessions.get(tab.windowId);
    if (session) {
      // Skip the pinned tracker tab itself
      if (tabId === session.pinnedTabId) return;

      // Skip initial seeding loads to prevent duplicate captures of the initial tabs
      if (session.initialTabUrls && tabId in session.initialTabUrls) {
        const seededUrl = session.initialTabUrls[tabId];
        const normalizedTab = normalizeUrlForComparison(tab.url);
        const normalizedSeed = normalizeUrlForComparison(seededUrl);
        if (normalizedTab === normalizedSeed) {
          // If the tab finished loading its seeded URL, we can stop ignoring it for future updates
          if (changeInfo.status === 'complete') {
            delete session.initialTabUrls[tabId];
            activeSessions.set(tab.windowId, session);
            persistActiveSessions();
          }
          return;
        } else {
          // The user navigated away from the seeded URL, stop ignoring
          delete session.initialTabUrls[tabId];
          activeSessions.set(tab.windowId, session);
          persistActiveSessions();
        }
      }

      // Skip all non-real URLs
      if (
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('about:') ||
        tab.url === 'chrome://newtab/'
      )
        return;

      // Prevent duplicate capture of the same URL in immediate succession
      const lastCapturedUrl = session.capturedUrls[session.capturedUrls.length - 1];
      if (tab.url === lastCapturedUrl) return;

      const title = tab.title || new URL(tab.url).hostname;

      const mode = session.openSettings?.autoSaveMode === 'last_saved' ? 'auto_save' : session.openSettings?.autoSaveMode;

      if (mode === 'dont_save') {
        return;
      }

      if (mode === 'auto_save') {
        chrome.tabs.query({ windowId: tab.windowId }, (tabs) => {
          const nonPinnedTabs = tabs.filter(t => t.id !== session.pinnedTabId && !t.url?.startsWith('chrome'));
          session.capturedUrls = nonPinnedTabs.map(t => t.url || '');
          session.capturedNames = nonPinnedTabs.map(t => t.title || (t.url ? new URL(t.url).hostname : ''));
          activeSessions.set(tab.windowId, session);
          persistActiveSessions();
          
          chrome.runtime.sendMessage({
            action: 'session_tab_captured',
            sessionId: session.sessionId,
            url: tab.url,
            title: title,
            favIconUrl: tab.favIconUrl,
            capturedUrls: session.capturedUrls,
            capturedNames: session.capturedNames,
          }).catch(() => {});
        });
        return;
      }
    }
  }
  // ─── End Session Tab Capture ──────────────────────────────────────────────────
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  await ensureStateRestored();
  if (newTabKeystrokeRecordingTabId === tabId) {
    newTabKeystrokeRecordingTabId = null;
  }
  pendingAutoSubmitTabs.delete(tabId);
  tabPromptQueues.delete(tabId);

  // Check if this was a session's pinned tab
  for (const [windowId, session] of activeSessions.entries()) {
    if (session.pinnedTabId === tabId) {
      activeSessions.delete(windowId);
      persistActiveSessions();
      createNotification(null, {
        title: 'Session Ended',
        message: `"${session.sessionName}" control tab closed. Session ended.`,
      });
      break;
    }
  }

  // Handle 'last_saved' live tracking when a normal tab is closed
  if (removeInfo && removeInfo.windowId) {
    const session = activeSessions.get(removeInfo.windowId);
    const mode = session.openSettings?.autoSaveMode === 'last_saved' ? 'auto_save' : session.openSettings?.autoSaveMode;
    if (session && mode === 'auto_save') {
      chrome.tabs.query({ windowId: removeInfo.windowId }, (tabs) => {
        const nonPinnedTabs = tabs.filter(t => t.id !== session.pinnedTabId && !t.url?.startsWith('chrome'));
        session.capturedUrls = nonPinnedTabs.map(t => t.url || '');
        session.capturedNames = nonPinnedTabs.map(t => t.title || (t.url ? new URL(t.url).hostname : ''));
        activeSessions.set(removeInfo.windowId, session);
        persistActiveSessions();

        chrome.runtime.sendMessage({
          action: 'session_tab_captured',
          sessionId: session.sessionId,
          url: '',
          title: '',
          favIconUrl: '',
          capturedUrls: session.capturedUrls,
          capturedNames: session.capturedNames,
        }).catch(() => {});
      });
    }
  }
});

chrome.windows.onRemoved.addListener(async windowId => {
  await ensureStateRestored();
  const session = activeSessions.get(windowId);
  if (!session) return;

  activeSessions.delete(windowId);
  persistActiveSessions();




  let savedCount = session.capturedUrls.length;
  try {
    const sessionRecord = await db.sessions.get(session.sessionId);
    if (sessionRecord && sessionRecord.urls) {
      savedCount = sessionRecord.urls.length;
    }
  } catch (err) {
    console.error('[background] Failed to get session from Dexie for notification:', err);
  }

  createNotification(null, {
    title: 'Session Complete',
    message: `"${session.sessionName}" — ${savedCount} tab${savedCount !== 1 ? 's' : ''} saved`,
  });
});

// Internal message listener for the popup to check auth
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  ensureStateRestored().catch(() => {}); // Ensure state starts restoring but don't block sync responses

  const sessionResult = handleSessionMessage(request, sender, sendResponse);
  if (sessionResult !== undefined) return sessionResult;

  // Handle pin_extension_tab: Pin the sender tab (Workona-style persistent pinned manager)
  if (request.action === 'pin_extension_tab') {
    const tabId = sender?.tab?.id;
    console.log('[SessionFlow][background] pin_extension_tab received. tabId:', tabId);
    if (tabId) {
      chrome.tabs.update(tabId, { pinned: true }, () => {
        if (chrome.runtime.lastError) {
          console.error('[SessionFlow][background] pin_extension_tab FAILED:', chrome.runtime.lastError.message);
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('[SessionFlow][background] ✓ tab pinned successfully. tabId:', tabId);
          sendResponse({ ok: true });
        }
      });
      return true; // async
    }
    console.warn('[SessionFlow][background] ⚠ pin_extension_tab: no tabId in sender');
    sendResponse({ ok: false, error: 'no_tab_id' });
    return false;
  }

  const todoResult = handleTodoMessage(request, sender, sendResponse);
  if (todoResult !== undefined) return todoResult;

  const driveResult = handleDriveMessage(request, sender, sendResponse);
  if (driveResult !== undefined) return driveResult;

  const aiResult = handleAiMessage(request, sender, sendResponse);
  if (aiResult !== undefined) return aiResult;

  const browserWindowResult = handleBrowserWindowMessage(request, sender, sendResponse);
  if (browserWindowResult !== undefined) return browserWindowResult;

  const searchResult = handleSearchMessage(request, sender, sendResponse);
  if (searchResult !== undefined) return searchResult;

  const hotkeyResult = handleHotkeyMessage(request, sender, sendResponse);
  if (hotkeyResult !== undefined) return hotkeyResult;

  if (handleExtractorMessage(request, sender, sendResponse)) return true;
  if (handleElementPickerMessage(request, sender, sendResponse)) return true;

  const authResult = handleAuthMessage(request, sender, sendResponse);
  if (authResult !== undefined) return authResult;

  if (request.action === 'track_ai_session') {
    const { prompt, tabIds, models } = request;
    const sessionId = Date.now().toString();
    const session: PendingAiSession = {
      id: sessionId,
      prompt,
      models,
      tabIds,
      urls: {},
      timestamp: Date.now(),
    };
    pendingAiSessions.set(sessionId, session);

    // Timeout: cleanup tracking after 2 minutes
    setTimeout(() => {
      pendingAiSessions.delete(sessionId);
    }, 120000);

    sendResponse({ ok: true, sessionId });
    return true;
  }



  if (request.action === 'run_automation') {
    executeAutomation(request.automation).catch(console.error);
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'stop_automation') {
    stopCurrentAutomation();
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'get_tab_id') {
    sendResponse({ tabId: sender.tab?.id });
    return true;
  }




  if (request.type === 'inject_auto_submit') {
    const { tabId, request: nestedRequest } = request;
    if (tabId && nestedRequest) {
      executeAutoSubmit(tabId, nestedRequest)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('[Background] executeAutoSubmit error:', error);
          sendResponse({ success: false, error: String(error) });
        });
      return true;
    }
  }

  if (request.type === 'GET_TAB_ID' || request.action === 'GET_TAB_ID') {
    if (sender.tab?.id) {
      sendResponse(sender.tab.id);
      return false;
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        sendResponse(tabs[0]?.id);
      });
      return true; // Keep channel open for async response
    }
  }

  return true;
});


import { handleNewTodoAlarm } from './todos/newTodos';

// --- ALARM LISTENER ---
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'tasklabs-periodic-sync') {
    console.log('[BackgroundSync] Periodic sync alarm fired');
    await backgroundSync();
    return;
  }

  if (alarm.name.startsWith('automation_')) {
    handleAutomationAlarm(alarm);
    return;
  }
  
  if (alarm.name.startsWith('todo|')) {
    handleTodoAlarm(alarm);
    return;
  }

  if (alarm.name.startsWith('newtodo|')) {
    handleNewTodoAlarm(alarm);
    return;
  }
  
  if (alarm.name === 'tasklabs-drive-pull') {
    console.log('[DriveContinuation] Hourly Drive pull alarm fired');
    try {
      // const result = await runDrivePullCheck();
      // console.log('[DriveContinuation] Pull cycle result:', result);
    } catch (err) {
      console.error('[DriveContinuation] Error during pull alarm handler:', err);
    }
    return;
  }

  if (alarm.name === 'tasklabs-auto-backup') {
    console.log('[AutoBackup] Triggering scheduled Google Drive backup');
    // try {
    //   const { uploadToGoogleDrive } = await import('../../src/storage/_private/API/services/backup/drive');
    //   const { updateAutoBackupSettings } = await import('../../src/storage/_private/API/services/backup/autoBackup');
    //   const { nowUtc } = await import('../../src/storage/_private/API/services/metadataService');
    //   
    //   const success = await uploadToGoogleDrive();
    //   if (success) {
    //     console.log('[AutoBackup] Upload successful');
    //     await updateAutoBackupSettings({ lastAutoBackupAt: nowUtc() });
    //   } else {
    //     console.warn('[AutoBackup] Upload failed or no connection');
    //   }
    // } catch (err) {
    //   console.error('[AutoBackup] Error during scheduled backup:', err);
    // }
  }
});

// --- NOTIFICATION CLICK LISTENER ---
chrome.notifications.onClicked.addListener(handleNotificationClick);

let lastModifiedWriteTime = 0;
const BACKUP_SYSTEM_KEYS = [
  'lastModifiedAt',
  'lastBackupAt',
  'lastUploadedFingerprint',
  'globalDataVersion',
  'restore_rollback_snapshot',
  // Drive continuation keys — must not trigger lastModifiedAt updates
  'lastDriveCheckAttemptAt',
  'lastDriveCheckSuccessAt',
  'lastImportedDriveBackupAt',
  'pending_drive_merge_plan',
];
const SYSTEM_PREFIXES = ['backup_', 'sync_', 'restore_'];

/**
 * Determines if a storage key is a system-level key that should not trigger
 * user data modification timestamps (e.g., backup or sync metadata).
 *
 * @param key The local storage key string.
 * @returns {boolean} True if the key is a system key, otherwise false.
 */
function isSystemKey(key: string): boolean {
  if (BACKUP_SYSTEM_KEYS.includes(key)) return true;
  return SYSTEM_PREFIXES.some(prefix => key.startsWith(prefix));
}

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local') {
    const alteredKeys = Object.keys(changes);
    const hasUserDataChanges = alteredKeys.some(key => !isSystemKey(key));

    if (hasUserDataChanges) {
      const now = Date.now();
      if (now - lastModifiedWriteTime > 2000) {
        lastModifiedWriteTime = now;
        chrome.storage.local.set({ lastModifiedAt: new Date().toISOString() });
      }
    }
  }
});

