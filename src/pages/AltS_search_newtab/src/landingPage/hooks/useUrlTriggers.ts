import { useEffect, useRef } from 'react';
import { useSpreadsheetStore } from '../../components/spreadsheetUi/logic/spreadsheetStateStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { extractSnippetIdFromCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { useDbStore } from '../../../../../storage/store/useDbStore';

interface UseUrlTriggersProps {
  userId: string;
  openSpreadsheetView: (section?: string) => void;
  searchbarRef: React.MutableRefObject<any>;
  setIsGlobalCreateMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dismissAllViews: (except?: any) => void;
  handleAltSInitialization: (forceBoardView?: boolean) => void;
}

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().trim();
};

const includesQuery = (value: unknown, query: string): boolean => normalizeText(value).includes(query);

const getLinkSearchText = (item: any): string => {
  const parts = [item?.title, item?.name];
  if (typeof item?.url === 'string') parts.push(item.url);
  if (Array.isArray(item?.urls)) {
    for (const link of item.urls) {
      if (typeof link?.title === 'string') parts.push(link.title);
      if (typeof link?.name === 'string') parts.push(link.name);
      if (typeof link?.url === 'string') parts.push(link.url);
    }
  }
  return parts.filter(Boolean).join(' ');
};

const openNoteById = (noteId: string) => {
  const noteUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(noteId)}`);
  window.location.replace(noteUrl);
};

export const useUrlTriggers = ({
  userId,
  openSpreadsheetView,
  searchbarRef,
  setIsGlobalCreateMenuOpen,
  dismissAllViews,
  handleAltSInitialization,
}: UseUrlTriggersProps) => {
  const hasHandledUrlTrigger = useRef(false);
  const dbNotes = useDbStore(state => state.notes);
  const dbLinks = useDbStore(state => state.links);
  const dbSnippets = useDbStore(state => state.snippets);
  const dbAutomations = useDbStore(state => state.automations);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasTrigger =
      urlParams.get('focus_sheet_ui_first_column') === 'true' ||
      urlParams.get('force_board_view') === 'true' ||
      urlParams.get('open_create') === 'true' ||
      urlParams.get('open_sheet') !== null ||
      urlParams.get('create_automation') === 'true' ||
      urlParams.get('create_link') === 'true' ||
      urlParams.get('session_mode') === 'true' ||
      urlParams.get('create_note') === 'true' ||
      urlParams.get('create_snippet') === 'true' ||
      urlParams.get('create_todo') === 'true' ||
      urlParams.get('omnibox') === 'true';

    if (hasTrigger) {
      hasHandledUrlTrigger.current = true;
    }

    if (urlParams.get('focus_sheet_ui_first_column') === 'true') {
      openSpreadsheetView();
      useSpreadsheetStore.getState().setSelectedCell({ rowIndex: 1, colIndex: 0 });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('force_board_view') === 'true') {
      handleAltSInitialization(true);
      setTimeout(() => {
        searchbarRef.current?.focus();
      }, 50);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('open_create') === 'true') {
      dismissAllViews('SHORTCUT_CREATE_MENU');
      setIsGlobalCreateMenuOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const sheetAction = urlParams.get('open_sheet');
    const isEmbedded = urlParams.get('embed') === 'true';

    if (sheetAction) {
      if (isEmbedded) {
        if (sheetAction === 'createnotes') {
          useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'note' } });
        } else if (sheetAction === 'createsnippet') {
          useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'snippet' } });
        } else if (sheetAction === 'createtodo') {
          useUIStore.getState().openEditor({ type: 'todo', id: 'new' });
        } else if (sheetAction === 'createlinks') {
          const activeTabUrl = urlParams.get('active_tab_url') || '';
          const activeTabTitle = urlParams.get('active_tab_title') || '';
          useUIStore.getState().openEditor({ type: 'link', id: 'new' });
          useUIStore.getState().setLinkEditPrefill({ key: activeTabTitle, value: activeTabUrl, category: 'link' } as any);
        } else if (sheetAction === 'createsession') {
          useUIStore.getState().openEditor({ type: 'session', id: 'new' });
        }
      } else {
        if (sheetAction === 'todo') {
          useUIStore.getState().setSidebar('todoSidebar', { open: true });
        } else if (sheetAction === 'collections') {
          openSpreadsheetView('collections');
        } else if (sheetAction === 'saved-automation') {
          openSpreadsheetView('saved-automation');
        } else {
          const executeSheetAction = () => {
            if (searchbarRef.current) {
              searchbarRef.current.clear();
              setTimeout(() => {
                const mode = sheetAction === 'store' || sheetAction === 'ai' ? 'lock' : 'execute';
                searchbarRef.current?.executeCommand(sheetAction as any, { mode });
                searchbarRef.current?.focus();
              }, 10);
            } else {
              setTimeout(executeSheetAction, 100);
            }
          };
          executeSheetAction();
        }
      }

      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('open_sheet');
      newParams.delete('active_tab_url');
      newParams.delete('active_tab_title');
      const newSearch = newParams.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newUrl);
      return;
    }

    if (urlParams.get('create_automation') === 'true') {
      useUIStore.getState().openEditor({ type: 'agent', id: 'new', isNew: true, props: { editMode: false, automation: null } });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('create_link') === 'true') {
      useUIStore.getState().openEditor({ type: 'link', id: 'new' });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('session_mode') === 'true') {
      const sessionId = urlParams.get('session_id') || '';
      const sessionName = decodeURIComponent(urlParams.get('session_name') || '');
      console.log('[SessionFlow][useUrlTriggers] session_mode=true detected → opening session editor', { sessionId, sessionName });
      // Open the session editor — useLinkSessionManager inside it will pick up
      // the sessionId from the pending_session_prefill written by handleStartSession
      useUIStore.getState().openEditor({ type: 'session', id: 'new' });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('create_note') === 'true') {
      useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'note' } });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('create_snippet') === 'true') {
      useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'snippet' } });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('create_todo') === 'true') {
      useUIStore.getState().openEditor({ type: 'todo', id: 'new' });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('omnibox') === 'true') {
      const type = urlParams.get('type');
      const query = normalizeText(urlParams.get('query') || '');
      if (!type || !query) {
        hasHandledUrlTrigger.current = true;
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      let cancelled = false;
      let attempts = 0;
      const maxAttempts = 80;
      const retryDelayMs = 100;

      const tryHandleOmnibox = () => {
        if (cancelled) return;
        const currentIsLoggedIn = userId !== '';
        if (!searchbarRef.current || (!currentIsLoggedIn && attempts < 30)) {
          if (attempts++ < maxAttempts) {
            window.setTimeout(tryHandleOmnibox, retryDelayMs);
          }
          return;
        }

        const noteCandidates = [...dbNotes, ...dbSnippets];
        const linkCandidates = [...dbLinks];

        if (type === 'note') {
          const foundNote = noteCandidates.find(item => includesQuery(item.title, query));
          if (foundNote) {
            openNoteById(String(foundNote.id));
          } else {
            useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'note' } });
          }
        } else if (type === 'link') {
          const foundLink = linkCandidates.find(item => includesQuery(getLinkSearchText(item), query));
          if (foundLink && searchbarRef.current?.executeSnippet) {
            searchbarRef.current.executeSnippet(foundLink);
          } else {
            useUIStore.getState().openEditor({ type: 'link', id: 'new', props: { category: 'link' } });
          }
        } else if (type === 'command') {
          const commandId = urlParams.get('id');
          if (commandId) {
            if (query) {
              searchbarRef.current.setValue(query);
            }
            setTimeout(() => {
              searchbarRef.current?.executeCommand(commandId as any, { mode: query ? 'execute' : 'lock' });
            }, 50);
          }
        }

        hasHandledUrlTrigger.current = true;
        window.history.replaceState({}, '', window.location.pathname);
      };

      tryHandleOmnibox();
      return () => {
        cancelled = true;
      };
    }

    if (urlParams.get('trigger_hotkey') !== 'true') return;

    const type = urlParams.get('type');
    const rawId = urlParams.get('id');
    if (!rawId) {
      console.warn('[App] [HOTKEY_TRIGGER] Trigger detected but missing ID parameter');
      return;
    }
    
    // Import extractSnippetIdFromCompoundId
    // (Assuming it's available or we can just implement the fallback directly)

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 80;
    const retryDelayMs = 100;

    const findById = (records: any[], id: string) => records.find(record => String(record?.id) === id);
    const findByCompoundId = (records: any[], containerId: string, snippetId: string) =>
      records.find(record => String(record?.id) === snippetId && (String(record?.workspaceId) === containerId || String(record?.folderId || '') === containerId));

    const tryHandle = () => {
      if (cancelled) return;
      const currentIsLoggedIn = userId !== '';
      if (!searchbarRef.current || (!currentIsLoggedIn && attempts < 30)) {
        if (attempts++ < maxAttempts) {
          window.setTimeout(tryHandle, retryDelayMs);
        }
        return;
      }

      let normalizedId = rawId.startsWith('/') ? rawId.substring(1) : rawId;
      normalizedId = normalizedId.replace(/^automation-/, '').replace(/^agent-/, '');

      if (type === 'command') {
        searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
        if (!searchbarRef.current.isLocked) searchbarRef.current.focus();
        return;
      }

      if (type === 'module') {
        searchbarRef.current.executeModule(normalizedId);
        return;
      }

      if (type === 'automation' || type === 'agent' || type === 'chat_agent') {
        let foundAuto = findById(dbAutomations, normalizedId);
        if (!foundAuto) {
          foundAuto = dbAutomations.find(auto => includesQuery(auto.name, normalizedId));
        }
        if (foundAuto) {
          searchbarRef.current.activateAutomation(foundAuto);
          return;
        }
        searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
        if (!searchbarRef.current.isLocked) searchbarRef.current.focus();
        return;
      }

      if (type === 'link' || type === 'note' || type === 'snippet') {
        // Use the centralized ID extraction function
        const actualItemId = extractSnippetIdFromCompoundId(normalizedId);
        
        let foundItem: any =
          type === 'link'
            ? findById(dbLinks, actualItemId) || findById(dbSnippets, actualItemId)
            : type === 'note'
              ? findById(dbNotes, actualItemId) || findById(dbSnippets, actualItemId)
              : findById(dbSnippets, actualItemId) || findById(dbNotes, actualItemId);

        if (foundItem && type === 'link') {
          if (searchbarRef.current?.executeSnippet) {
            searchbarRef.current.executeSnippet(foundItem);
          } else {
            useUIStore.getState().openEditor({ type: 'link', id: 'new', props: { category: 'link' } });
          }
        } else if (foundItem) {
          openNoteById(String(foundItem.id));
        } else {
          console.warn(`[App] ${type} not found for ID: ${normalizedId}. Falling back to command execution.`);
          searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
          if (!searchbarRef.current.isLocked) searchbarRef.current.focus();
        }
        return;
      }
    };

    tryHandle();
    return () => {
      cancelled = true;
    };
  }, [
    dbAutomations,
    dbLinks,
    dbNotes,
    dbSnippets,
    dismissAllViews,
    handleAltSInitialization,
    openSpreadsheetView,
    searchbarRef,
    setIsGlobalCreateMenuOpen,
    userId,
  ]);

  // On every page load (including refresh with no URL params), check if this Chrome window
  // has an active session. If yes, auto-open the session editor so the pinned tab recovers.
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.windows || !chromeAny?.storage?.local) return;

    // Only activate if the URL doesn't already have session_mode (that case is handled above)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('session_mode') === 'true') return;

    chromeAny.windows.getCurrent((currentWindow: any) => {
      if (!currentWindow?.id) return;
      chromeAny.storage.local.get('active_sessions', (result: any) => {
        const sessions: { sessionId: string; sessionName: string; windowId: number }[] = result.active_sessions || [];
        const matchedSession = sessions.find((s) => s.windowId === currentWindow.id);
        if (matchedSession) {
          console.log('[SessionFlow][useUrlTriggers] Active session found for this window on load/refresh:', matchedSession.sessionId, '— opening session editor');
          useUIStore.getState().openEditor({ type: 'session', id: 'new' });
        } else {
          console.log('[SessionFlow][useUrlTriggers] No active session for this window (normal tab load). windowId:', currentWindow.id);
        }
      });
    });
  }, []);
};
