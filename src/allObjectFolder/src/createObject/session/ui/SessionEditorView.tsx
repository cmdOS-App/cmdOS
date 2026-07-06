import { createTodo } from '../../todos/todoData';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';

import { generateEntityId } from '../../../../../shared-components/utils/idGenerator';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FaPlus,
  FaTrash,
  FaChevronDown,
  FaChevronRight,
  FaSave,
  FaTimes,
  FaArrowRight,
  FaLongArrowAltRight,
  FaCheckCircle,
  FaCheck,
  FaAt,
  FaFileAlt,
  FaPen,
  FaLink,
  FaSearch,
  FaHistory,
  FaBookmark,
  FaFolder,
  FaEllipsisV,
  FaGlobe,
  FaLock,
  FaUsers,
  FaStar,
  FaRobot,
  FaList,
  FaCopy,
  FaDirections,
  FaLayerGroup,
} from 'react-icons/fa';
import { FiStar, FiChevronLeft, FiChevronRight, FiTag, FiSettings } from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { formatDistanceToNow } from 'date-fns';

import { saveHotkey as apiSaveHotkey, clearHotkey as apiClearHotkey } from '../../../../../shared-components/hotkeys';
import { saveShortcut as apiSaveShortcut, clearShortcut as apiClearShortcut } from '../../../../../shared-components/shortcuts';

import type { WorkspaceData } from '../../../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../../../../settings/allWorkspaceManager/folders/folderTypes';
import type { SnippetRecord } from '../../snippets/snippetTypes';

import { getFaviconUrl } from '../../../../../pages/AltS_search_newtab/src/components/searchSystemComponents/searchBarMain/utilityFunctions/utils';
import UnsavedChangesDialog from '../../../../../shared-components/modals/unsavedChangesDialog';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { clsx } from 'clsx';
import { formatSaveDestinationPath, getDestinationPathDetails } from '../../../../../shared-components/pathUtils';
import { readAllHotkeys, readAllShortcuts, getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import { HotkeyAssignButton } from '../../../../../shared-components/hotkeys';
import { ShortcutAssignButton } from '../../../../../shared-components/shortcuts';
import { getUserId } from '../../../../../storage/_private/API/core/api';
import { deleteUserHotkeyByReference } from '../../../../../shared-components/hotkeys/core/hotkeyDbData';
import { deleteUserShortcutByReference } from '../../../../../shared-components/shortcuts/core/shortcutDbData';

import type { BrowserTab, SelectedLink, ContentTab } from '../../links/linkTypes';
import { useChromeTabs } from '../../links/ui/hooks/useChromeTabs';
import { useLinkSessionManager } from '../useSessionManager';
import { TabButton } from '../../links/ui/components/TabButton';
import { HighlightedInput } from '../../links/ui/components/HighlightedInput';
import { useSessionEditor } from '../useSessionEditor';
import {
  type SessionOpenSettings,
  DEFAULT_SESSION_SETTINGS,
  loadSessionSettings,
  saveSessionSettings,
} from '../sessionSettings';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { nowUtc, useRelativeSavedTime } from '../../../../../shared-components/utils';

interface SessionEditorViewProps {
  isOpen: boolean;
  onClose: () => void;
  session: any | null;
  prefill?: any | null;
  reload: () => void; // Kept for compatibility, though we use optimistic updates
}


const EMPTY_INITIAL_URLS: any[] = [];

const SessionEditorView: React.FC<SessionEditorViewProps> = ({
  isOpen,
  onClose,
  session: initialSessionProp,
  prefill,
  reload,
}) => {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('session-sidebar-portal-target'));
  }, [isOpen]);

  const handleTabCaptured = useCallback((newLink: SelectedLink) => {
    setSelectedLinks((prev: SelectedLink[]) => {
      if (prev.some((l: SelectedLink) => l.url === newLink.url)) return prev;
      return [...prev, newLink];
    });
  }, []);
  const {
    activeSessionId,
    setActiveSessionId,
    sessionName,
    setSessionName,
    sessionError,
    setSessionError,
    isStartingSession,
    setIsStartingSession
  } = useLinkSessionManager(handleTabCaptured);
  const [localSessionOverride, setLocalSessionOverride] = useState<any | null>(null);
  const [isForceCreateNew, setIsForceCreateNew] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const hasUserModifiedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setLocalSessionOverride(null);
      setIsForceCreateNew(false);
      hasPrefilledEditModeRef.current = false;
      hasUserModifiedRef.current = false;
    } else {
      hasUserModifiedRef.current = false;
      if (!initialSessionProp) {
        
      }
    }
  }, [isOpen, initialSessionProp]);

  const sessions = useDbStore(state => state.sessions);
  const snippets = useDbStore(state => state.snippets);
  const automations = useDbStore(state => state.automations);
  const resolvedActiveSession = useMemo(() => {
    if (!activeSessionId) return null;
    const found = sessions.find(
      session => String(session.id) === String(activeSessionId)
    );
    return found || null;
  }, [activeSessionId, sessions]);

  const initialSession = isForceCreateNew ? null : localSessionOverride || initialSessionProp || resolvedActiveSession;
  const currentSessionId = initialSession?.id || (initialSession as any)?.snippet_id || activeSessionId || null;
  const isMac = navigator.userAgent.includes('Mac');

  // Legacy Redux team state removed - now using Dexie directly

  // const triggerNotification = useNotification(); // Removed toast usage

  // Legacy orgTeam logic removed

  const hasInitializedPrefill = useRef(false);
  const hasFetchedWorkspaces = useRef(false);



  const {
    sessionTitle: title,
    setSessionTitle: setTitle,
    sessionUrls: selectedLinks,
    setSessionUrls: setSelectedLinks,
    saveStatus,
    saveError,
    isDirty: hasUnsavedChanges,
    lastSavedAt,
    handleSave: executeSave,
    activeSessionId: liveSessionId,
  } = useSessionEditor({ sessionId: currentSessionId || undefined, initialDraftKey: prefill?.key || '', initialDraftUrls: EMPTY_INITIAL_URLS });

  // Determine mode based on whether a snippet is passed or has been saved
  const isEditMode = !!initialSession || !!liveSessionId;

  const { tabsByWindow, allTabs, currentWindowId, collapsedWindows, setCollapsedWindows, hasFetchedTabs, fetchTabs } = useChromeTabs(isOpen);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [hasAutoPinned, setHasAutoPinned] = useState(false);

  // Pin the tab automatically when a new session is saved for the first time
  useEffect(() => {
    if (!initialSession && saveStatus === 'saved' && !hasAutoPinned) {
      setHasAutoPinned(true);
      try {
        if ((window as any).chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'pin_extension_tab' });
        }
      } catch (e) {
        console.error('Failed to auto-pin extension tab:', e);
      }
    }
  }, [saveStatus, initialSession, hasAutoPinned]);

  // Session open-behavior settings state
  const [isSettingsPopupOpen, setIsSettingsPopupOpen] = useState(false);
  const [sessionOpenSettings, setSessionOpenSettings] = useState<SessionOpenSettings>(DEFAULT_SESSION_SETTINGS);
  const settingsPopupRef = useRef<HTMLDivElement | null>(null);

  // Load session settings on mount or when liveSessionId loads
  useEffect(() => {
    const liveSess = useDbStore.getState().getSessionById(liveSessionId);
    if (liveSess?.sessionOpenSettings) {
      setSessionOpenSettings(liveSess.sessionOpenSettings);
    } else if (!isEditMode) {
      loadSessionSettings().then(setSessionOpenSettings);
    }
  }, [liveSessionId, isEditMode]);

  // Persist settings whenever they change (skip initial load)
  const hasLoadedSettingsRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedSettingsRef.current) {
      hasLoadedSettingsRef.current = true;
      return;
    }
    saveSessionSettings(sessionOpenSettings);
  }, [sessionOpenSettings]);

  const hasPrefilledEditModeRef = useRef(false);

  useEffect(() => {
    const trimmedName = sessionName.trim();
    if (!trimmedName) {
      setSessionError(null);
      return;
    }

    // 1. Check duplicate session names in local snippet records
    const exists = sessions.some((s: any) => (s.title || '').trim().toLowerCase() === trimmedName.toLowerCase());

    if (exists) {
      setSessionError('A tab group with this name already exists.');
      return;
    }

    // 2. Check duplicate session names in active sessions stored in local storage
    const checkActiveSessions = async () => {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.get('active_sessions', (res: any) => {
          const activeSessions = res.active_sessions || [];
          const duplicateActive = activeSessions.some((s: any) => s.sessionName?.toLowerCase() === trimmedName.toLowerCase());
          if (duplicateActive) {
            setSessionError('A tab group with this name is currently active.');
          } else {
            setSessionError(null);
          }
        });
      } else {
        setSessionError(null);
      }
    };

    checkActiveSessions();
  }, [sessionName, snippets]);

  const lastSyncTimeRef = useRef<string | null>(null);
  const [conflictModalData, setConflictModalData] = useState<{
    cloudSnippet: any;
    localData: {
      title: string;
      selectedLinks: SelectedLink[];
    };
  } | null>(null);

  useEffect(() => {
    if (initialSession && initialSession.updatedAt) {
      lastSyncTimeRef.current = initialSession.updatedAt;
    }
  }, [initialSession]);

  const handleOverwriteHotkey = async (conflictId: string, newValue: string) => {
    try {
      await deleteUserHotkeyByReference(conflictId);
      await handleHotkeyChange(newValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
    }
  };

  const handleOverwriteShortcut = async (conflictId: string, newValue: string) => {
    try {
      await deleteUserShortcutByReference(conflictId);
      await handleShortcutChange(newValue);
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
    }
  };

  const [isTitleManuallyModified, setIsTitleManuallyModified] = useState(false);




  // Load already-captured links from storage on session start/refresh
  useEffect(() => {
    
    if (!activeSessionId) return;

    chrome.storage.local.get('active_sessions', (result) => {
      const data = result.active_sessions || [];
      
      const session = data.find((s: any) => s.sessionId === activeSessionId);
      
      if (session) {
        if (Array.isArray(session.capturedUrls) && Array.isArray(session.capturedNames)) {
          const preloaded: SelectedLink[] = session.capturedUrls.map((url: string, index: number) => ({
            id: String(Date.now() + index + Math.random()),
            name: session.capturedNames[index] || url,
            url: url,
            source: 'tab',
            favIconUrl: getFaviconUrl(getHostname(url))
          }));
          setSelectedLinks(prev => {
            if (prev.length === 0) return preloaded;
            return prev;
          });
        }

        // Legacy cloud team mapping removed - no longer needed with local Dexie storage
      }
    });
  }, [activeSessionId]);

  const getBackupKey = useCallback(() => {
    const currentSessionId = (initialSession as any)?.id || (initialSession as any)?.snippet_id;
    return currentSessionId 
      ? `unsaved_session_backup_${currentSessionId}` 
      : 'unsaved_session_backup_new';
  }, [initialSession]);

  const clearStashedBackup = useCallback(() => {
    localStorage.removeItem(getBackupKey());
  }, [getBackupKey]);





  // Handle prefill data (e.g. from history/bookmarks/session)
  useEffect(() => {
    if (isOpen && !isEditMode && prefill && !hasInitializedPrefill.current) {
      setTitle(prefill.key || '');
      const prefillId = prefill.id || (prefill as any).snippet_id;
      if (prefillId && !prefill.searchtags) {
        chrome.storage.local.get('alts_searchtags_backup', result => {
          const backup = result.alts_searchtags_backup || {};
          if (backup[prefillId]) {
            // Note: Since we are in the outer parent state for 'prefill', we can't directly 
            // set (propertiesRef.current?.selectedTag) here. The real mapping happens in the internal useEffect around line 1150.
            // But we must remove setSearchtags since the state is gone.
          }
        });
      }

      if (prefill.category === 'TabGroup') {
        if (prefillId) {
          setActiveSessionId(prefillId);
        }
      } else {
        setSelectedLinks([
          {
            id: prefillId || `temp-${Date.now()}`,
            url: typeof prefill.value === 'string' ? prefill.value : '',
            name: prefill.key || '',
            source: 'link',
          },
        ]);
      }
      hasInitializedPrefill.current = true;
    } else if (!isOpen) {
      hasInitializedPrefill.current = false;
    }
  }, [isOpen, isEditMode, prefill]);

  const [footerStatus, setFooterStatus] = useState<{ type: 'idle' | 'saving' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [userId, setUserId] = useState('');
  const footerStatusTimeoutRef = useRef<number | null>(null);

  const showFooterStatus = useCallback((type: 'idle' | 'saving' | 'success' | 'error', message: string) => {
    if (footerStatusTimeoutRef.current) {
      window.clearTimeout(footerStatusTimeoutRef.current);
    }
    setFooterStatus({ type, message });
    
    if (type === 'success' || type === 'error') {
      footerStatusTimeoutRef.current = window.setTimeout(() => {
        setFooterStatus({ type: 'idle', message: '' });
      }, 3000);
    }
  }, []);

  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isAltEnterPickerOpen, setIsAltEnterPickerOpen] = useState(false);
  const [isCustomLinkFormOpen, setIsCustomLinkFormOpen] = useState(false);
  const [isLeftCustomLinkFormOpen, setIsLeftCustomLinkFormOpen] = useState(false);
  const [customLinkUrl, setCustomLinkUrl] = useState('');
  const [customLinkName, setCustomLinkName] = useState('');
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);

  // Hotkey assignment state (user: hotkey key-pair format)
  const propertiesRef = useRef<any>({});
  const initialFavRef = useRef<boolean>(false);

  // Reminder & Schedule states
          const [isCycleDropdownOpen, setIsCycleDropdownOpen] = useState(false);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isTodoPopupOpen, setIsTodoPopupOpen] = useState(false);
  const [linkTodoStatus, setLinkTodoStatus] = useState<'idle' | 'creating' | 'success'>('idle');
  const [pendingTodoData, setPendingTodoData] = useState<{
    deadlineVal: string;
    isRecurring: boolean;
    recurringCycle: string | null;
    isAnytime: boolean;
    taskTitle: string;
    tempId: string;
  } | null>(null);
  const cyclePopupRef = useRef<HTMLDivElement | null>(null);
  const timePopupRef = useRef<HTMLDivElement | null>(null);
  const sessionPopupRef = useRef<HTMLDivElement | null>(null);
  const todoPopupRef = useRef<HTMLDivElement | null>(null);
  const todoHoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cyclePopupRef.current && !cyclePopupRef.current.contains(event.target as Node)) {
        setIsCycleDropdownOpen(false);
      }
      if (timePopupRef.current && !timePopupRef.current.contains(event.target as Node)) {
        setIsTimeDropdownOpen(false);
      }
      if (todoPopupRef.current && !todoPopupRef.current.contains(event.target as Node)) {
        setIsTodoPopupOpen(false);
      }
      if (sessionPopupRef.current && !sessionPopupRef.current.contains(event.target as Node) && !(event.target as HTMLElement).closest('.session-btn')) {
        setSessionDialogOpen(false);
      }
      if (settingsPopupRef.current && !settingsPopupRef.current.contains(event.target as Node) && !(event.target as HTMLElement).closest('.settings-btn')) {
        setIsSettingsPopupOpen(false);
      }
      if (event.target instanceof Element && !event.target.closest('.three-dots-container')) {
        setActiveMenuLinkId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (locationHoverTimerRef.current) clearTimeout(locationHoverTimerRef.current);
      if (tagHoverTimerRef.current) clearTimeout(tagHoverTimerRef.current);
      if (todoHoverTimerRef.current) clearTimeout(todoHoverTimerRef.current);
    };
  }, []);

  // History and Bookmarks Search
  const [linkSuggestions, setLinkSuggestions] = useState<
    Array<{ title: string; url: string; source: 'history' | 'bookmark' }>
  >([]);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const favButtonRef = useRef<HTMLButtonElement>(null);
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const locationHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tagHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const customLinkUrlRef = useRef<HTMLInputElement>(null);
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [editingUrlValue, setEditingUrlValue] = useState<string>('');
  const editingUrlInputRef = useRef<HTMLInputElement>(null);
  const [activeMenuLinkId, setActiveMenuLinkId] = useState<string | null>(null);

  const tabItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasAutoSelectedRef = useRef(false);

  // Link edit popup state
  const [editingPopupLinkId, setEditingPopupLinkId] = useState<string | null>(null);
  const [editingUrlParts, setEditingUrlParts] = useState<{
    protocol: string;
    domain: string;
    paths: string[];
    search: string;
  } | null>(null);

  // Local state for the URL input to allow editing
  const [localUrlValue, setLocalUrlValue] = useState('');
  // Local state for the link name (display name) editing
  const [editingLinkName, setEditingLinkName] = useState('');
  const urlNameInputRef = useRef<HTMLInputElement>(null);
  const linkNameInputRef = useRef<HTMLInputElement>(null);
  const domainInputRef = useRef<HTMLInputElement>(null);

  const parseUrlParts = useCallback((url: string) => {
    try {
      let normalized = url.trim();
      if (normalized && !/^https?:\/\//i.test(normalized)) {
        normalized = `https://${normalized}`;
      }
      const u = new URL(normalized);
      const paths = u.pathname.split('/').filter(Boolean);
      const cleanDomain = u.host.replace(/^www\./i, '');
      return { protocol: u.protocol.replace(':', ''), domain: cleanDomain, paths, search: u.search };
    } catch {
      return null;
    }
  }, []);

  const assembleUrl = useCallback((parts: { protocol: string; domain: string; paths: string[]; search: string }) => {
    const pathStr = parts.paths.length > 0 ? '/' + parts.paths.join('/') : '';
    const protocol = parts.protocol || 'https';
    return `${protocol}://${parts.domain}${pathStr}${parts.search}`;
  }, []);

  const duplicateLink = useCallback((link: SelectedLink) => {
    setSelectedLinks(prev => {
      const newId = `duplicate-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return [
        ...prev,
        {
          ...link,
          id: newId,
          name: `${link.name} (Copy)`
        }
      ];
    });
  }, []);

  const openLinkEditPopup = useCallback(
    (link: SelectedLink) => {
      const parts = parseUrlParts(link.url);
      setEditingPopupLinkId(link.id);
      setEditingUrlParts(parts);
      setLocalUrlValue(link.url.replace(/^https?:\/\/(www\.)?/i, ''));
      setEditingLinkName(link.name || '');
    },
    [parseUrlParts],
  );

  const closeLinkEditPopup = useCallback(() => {
    setEditingPopupLinkId(null);
    setEditingUrlParts(null);
    setLocalUrlValue('');
    setEditingLinkName('');
  }, []);

  const saveLinkEditPopup = useCallback(() => {
    if (!editingPopupLinkId) return;
    let newUrl = editingUrlParts ? assembleUrl(editingUrlParts) : localUrlValue;
    
    newUrl = newUrl.trim();
    if (newUrl && !/^https?:\/\//i.test(newUrl)) {
      newUrl = `https://${newUrl}`;
    }

    setSelectedLinks(prev =>
      prev.map(link =>
        link.id === editingPopupLinkId ? { ...link, url: newUrl, name: editingLinkName || link.name } : link,
      ),
    );
    closeLinkEditPopup();
  }, [editingPopupLinkId, editingUrlParts, editingLinkName, localUrlValue, assembleUrl, closeLinkEditPopup]);

  // Track which path input is focused for inserting variables
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedInputRef = useRef<HTMLInputElement | null>(null);
  const [focusedPathIndex, setFocusedPathIndex] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<'domain' | 'path' | null>(null);
  const [showPathQueryDropdown, setShowPathQueryDropdown] = useState(false);

  // Sync editingUrlParts to localUrlValue when parts change (if not editing manualy)
  useEffect(() => {
    if (!editingUrlParts) return;
    if (document.activeElement === urlNameInputRef.current) return;

    const assembled = assembleUrl(editingUrlParts);
    setLocalUrlValue(assembled.replace(/^https?:\/\/(www\.)?/i, ''));
  }, [editingUrlParts, assembleUrl]);

  // Content bar state (from BuildView)
  const [activeContentTab, setActiveContentTab] = useState<ContentTab>('Current Tabs');
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [availableItems, setAvailableItems] = useState<SelectedLink[]>([]);

  // Fallback to Current Tabs if selected links are cleared
  useEffect(() => {
    if (selectedLinks.length === 0 && activeContentTab === 'Selected tabs') {
      setActiveContentTab('Current Tabs');
    }
  }, [selectedLinks.length, activeContentTab]);

  // "All saved files" inline search state
  const [isSavedFilesSearchOpen, setIsSavedFilesSearchOpen] = useState(false);
  const [savedFilesSearchQuery, setSavedFilesSearchQuery] = useState('');
  const [focusedSavedFileIndex, setFocusedSavedFileIndex] = useState(-1);
  const savedFilesInputRef = useRef<HTMLInputElement>(null);

  const savedFileSuggestions = useMemo(() => {
    if (savedFilesSearchQuery.trim().length < 3) return [];
    const q = savedFilesSearchQuery.toLowerCase();
    return availableItems.filter(i => String(i.name || "").toLowerCase().includes(q) || (i.url || '').toLowerCase().includes(q)).slice(0, 10);
  }, [availableItems, savedFilesSearchQuery]);
  const listContainerRef = useRef<HTMLDivElement>(null);


  const seenAutoSelectedTabsRef = useRef<Set<string>>(new Set());

  // Auto-select ALL browser tabs when opening in create mode for a Session
  useEffect(() => {
    if (isOpen && !isEditMode && !prefill && availableItems.length > 0) {
      const allTabsItems = availableItems.filter(item => item.source === 'tab');
      let addedAny = false;
      
      // Use functional state update to avoid dependency cycle
      setSelectedLinks(prevLinks => {
        const newLinks = [...prevLinks];
        for (const tab of allTabsItems) {
          const tabId = tab.originalData?.id || tab.url;
          if (tabId && !seenAutoSelectedTabsRef.current.has(String(tabId))) {
            seenAutoSelectedTabsRef.current.add(String(tabId));
            if (!newLinks.some(l => l.url === tab.url)) {
              newLinks.push(tab);
              addedAny = true;
            }
          }
        }
        return addedAny ? newLinks : prevLinks;
      });
    }
    if (!isOpen) {
      seenAutoSelectedTabsRef.current.clear();
    }
  }, [isOpen, isEditMode, prefill, availableItems, isTitleManuallyModified]);

  // Live-tracking: sync selectedLinks with currently open tabs (add opened, remove closed)
  const previousOpenTabsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      previousOpenTabsRef.current = null;
      return;
    }
    
    const allTabsItems = availableItems.filter(item => item.source === 'tab');
    const currentOpenUrls = new Set(allTabsItems.map(t => t.url));
    
    if (previousOpenTabsRef.current === null) {
      previousOpenTabsRef.current = currentOpenUrls;
      return;
    }

    const previousOpenUrls = previousOpenTabsRef.current;
    const addedUrls = [...currentOpenUrls].filter(url => !previousOpenUrls.has(url));
    const removedUrls = [...previousOpenUrls].filter(url => !currentOpenUrls.has(url));

    if (addedUrls.length > 0 || removedUrls.length > 0) {
      setSelectedLinks(prevLinks => {
        let newLinks = [...prevLinks];
        let changed = false;

        if (removedUrls.length > 0) {
          const beforeCount = newLinks.length;
          newLinks = newLinks.filter(link => !removedUrls.includes(link.url));
          if (newLinks.length !== beforeCount) changed = true;
        }

        for (const url of addedUrls) {
          if (!newLinks.some(l => l.url === url)) {
            const tabItem = allTabsItems.find(t => t.url === url);
            if (tabItem) {
              newLinks.push(tabItem);
              changed = true;
            }
          }
        }

        return changed ? newLinks : prevLinks;
      });
    }

    previousOpenTabsRef.current = currentOpenUrls;
  }, [isOpen, availableItems]);

  useEffect(() => {
    if (showPathQueryDropdown) {
      setTimeout(() => {
        dropdownButtonRef.current?.focus();
      }, 0);
    }
  }, [showPathQueryDropdown]);

  // Manual location overrides (for changing folder via picker)
  const [manualWorkspaceId, setManualWorkspaceId] = useState<string | null>(null);
  const [manualFolderId, setManualFolderId] = useState<string | null>(null);

  // If manualWorkspaceId is set, it means the user explicitly used the picker.
  // We should trust the manual state fully (even if folder is null) to allow moving to root.
  const isManualOverride = manualWorkspaceId !== null;

  const hasDestination = true;
  const needsDestinationSelection = false;

  const isDuplicateName = useCallback(
    (newName: string) => {
      // Duplicate checks in Redux are disabled as Dexie handles it natively
      return false;
    },
    [initialSession],
  );

  const isDuplicateTitle = useMemo(() => {
    return isDuplicateName(title);
  }, [title, isDuplicateName]);

  // Load user ID on mount
  useEffect(() => {
    const fetchUserId = async () => {
      const id = await getUserId();
      setUserId(id);
    };
    fetchUserId();
  }, []);

  // Sync Favorite, Hotkey and Shortcut state using unified utilities for 100% parity
  useEffect(() => {
    const syncData = async () => {
      if (!isOpen) return;

      if (!initialSession) {
        setPendingTodoData(null);
      }
    };

    syncData();
  }, [initialSession, isOpen, userId]);


  const { toggleFavorite } = useFavorites();

  const toggleFavoriteLocal = async (item: any) => {
    if (!userId) return;
    try {
      const targetId = item.id || (item as any).snippet_id;
      const category = (item.category || '').toLowerCase();
      const type = category.includes('link') || category.includes('tabgroup') ? 'link' : 'note';
      await toggleFavorite(targetId, type, item.key);
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  const handleToggleFavorite = () => {
    if (initialSession) {
      toggleFavoriteLocal(initialSession);
    } else {
      
    }
  };

  const handleCreateTodoFromLink = async () => {
    // Cloud snippet-to-todo logic has been removed as it's dead code.
    setLinkTodoStatus('idle');
  };

  const handleHotkeyChange = async (newHotkey: string) => {
    

    if (initialSession?.id && !String(initialSession.id).startsWith('temp-')) {
      try {
        const folderId = (initialSession as any).folder_id;
        const workspaceId = (initialSession as any).workspace_id;
        const compoundId = `${folderId || workspaceId || propertiesRef.current?.workspaceId || ''}-${initialSession.id}`;
        
        if (!newHotkey) {
          await apiClearHotkey(initialSession.id, compoundId, 'link');
        } else {
          await apiSaveHotkey(initialSession.id, compoundId, newHotkey, 'link');
        }
        showFooterStatus('success', newHotkey ? 'Hotkey updated' : 'Hotkey cleared');
      } catch (error) {
        console.error('Failed to update hotkey:', error);
        showFooterStatus('error', 'Failed to update hotkey');
      }
    }
  };

  const handleShortcutChange = async (newShortcut: string) => {
    

    if (initialSession?.id && !String(initialSession.id).startsWith('temp-')) {
      try {
        const folderId = (initialSession as any).folder_id;
        const workspaceId = (initialSession as any).workspace_id;
        const compoundId = `${folderId || workspaceId || propertiesRef.current?.workspaceId || ''}-${initialSession.id}`;

        if (!newShortcut) {
          await apiClearShortcut(initialSession.id, compoundId, 'link');
        } else {
          await apiSaveShortcut(
            initialSession.id,
            compoundId,
            newShortcut,
            title.trim() || initialSession.title || '',
            'link',
          );
        }
        showFooterStatus('success', 'Shortcut updated');
      } catch (error) {
        console.error('Failed to update shortcut:', error);
        showFooterStatus('error', 'Failed to update shortcut');
      }
    }
  };

  useEffect(() => {
    if (showPathQueryDropdown) {
      setTimeout(() => {
        dropdownButtonRef.current?.focus();
      }, 0);
    }
  }, [showPathQueryDropdown]);

  const insertCustomVariable = useCallback(() => {
    if (!editingUrlParts) return;

    if (focusedField === 'domain') {
      setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '/{query}' } : prev));
    } else if (focusedField === 'path' && focusedPathIndex !== null) {
      const newPaths = [...editingUrlParts.paths];
      // Append /{query} to the selected path component
      newPaths[focusedPathIndex] = (newPaths[focusedPathIndex] || '') + '/{query}';
      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
    } else if (editingUrlParts.paths.length > 0) {
      // Default: append to last path
      const newPaths = [...editingUrlParts.paths];
      newPaths[newPaths.length - 1] = newPaths[newPaths.length - 1] + '/{query}';
      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
    } else {
      // No paths, add to domain
      setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '/{query}' } : prev));
    }
  }, [editingUrlParts, focusedField, focusedPathIndex]);

  const teamId = '';

  const getHostname = useCallback((url: string) => {
    try {
      if (!url) return '';
      // Ensure protocol
      const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      return new URL(safeUrl).hostname;
    } catch (error) {
      return url;
    }
  }, []);


  useEffect(() => {
    if (!isLeftCustomLinkFormOpen || !customLinkUrl.trim()) {
      setLinkSuggestions([]);
      setFocusedSuggestionIndex(-1);
      return;
    }

    const query = customLinkUrl.trim();
    if (query.length < 1) return;

    const performSearch = async () => {
      const results: Array<{ title: string; url: string; source: 'history' | 'bookmark' }> = [];
      const chromeAny = (window as any).chrome;

      const searchBookmarks = (): Promise<any[]> => {
        return new Promise(resolve => {
          if (chromeAny?.bookmarks?.search) {
            chromeAny.bookmarks.search(query, (res: any[]) => resolve(res || []));
          } else {
            resolve([]);
          }
        });
      };

      const searchHistory = (): Promise<any[]> => {
        return new Promise(resolve => {
          if (chromeAny?.history?.search) {
            chromeAny.history.search({ text: query, maxResults: 10 }, (res: any[]) => resolve(res || []));
          } else {
            resolve([]);
          }
        });
      };

      try {
        const [bookmarks, history] = await Promise.all([searchBookmarks(), searchHistory()]);

        bookmarks.forEach((b: any) => {
          if (b.url) results.push({ title: b.title, url: b.url, source: 'bookmark' });
        });
        history.forEach((h: any) => {
          if (h.url) results.push({ title: h.title || getHostname(h.url), url: h.url, source: 'history' });
        });

        // Deduplicate by URL
        const unique = new Map();
        results.forEach(r => {
          if (!unique.has(r.url)) unique.set(r.url, r);
        });

        const finalResults = Array.from(unique.values()).slice(0, 5);
        
        setLinkSuggestions(finalResults);
        setFocusedSuggestionIndex(finalResults.length > 0 ? 0 : -1);
      } catch (e) {
        console.error('[LinkEditModal] Search failed:', e);
      }
    };

    performSearch();
  }, [customLinkUrl, isLeftCustomLinkFormOpen, getHostname]);

  const handleTodoPopupToggle = () => {
    setIsTodoPopupOpen(prev => !prev);
    setIsLocationPickerOpen(false);
  };

  const rawSearchTagsRef = useRef<Record<string, string[]> | string>({});
  const lastPrefilledSnippetIdRef = useRef<string | null>(null);

  // Prefill fields when editing an existing session is now natively handled by useSessionEditor's liveSession sync.

  useEffect(() => {
    if (!isCustomLinkFormOpen) return;
    const timeout = window.setTimeout(() => customLinkUrlRef.current?.focus(), 60);
    return () => window.clearTimeout(timeout);
  }, [isCustomLinkFormOpen]);

  useEffect(() => {
    if (!isLeftCustomLinkFormOpen) return;
    const timeout = window.setTimeout(() => customLinkUrlRef.current?.focus(), 60);
    return () => window.clearTimeout(timeout);
  }, [isLeftCustomLinkFormOpen]);

  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasAutoOpenedRef.current = false;
    }
  }, [isOpen]);

  // Auto-open custom link input if there are no open browser tabs on Current Tabs
  useEffect(() => {
    if (isOpen && activeContentTab === 'Current Tabs' && hasFetchedTabs && !hasAutoOpenedRef.current && !activeSessionId) {
      const hasTabs = Object.values(tabsByWindow).some(group => group.length > 0);
      if (!hasTabs) {
        setIsLeftCustomLinkFormOpen(true);
      }
      hasAutoOpenedRef.current = true;
    }
  }, [isOpen, activeContentTab, tabsByWindow, hasFetchedTabs, activeSessionId]);

  useEffect(() => {
    if (!isOpen) return;
    fetchTabs();
    const interval = window.setInterval(fetchTabs, 5000);
    return () => window.clearInterval(interval);
  }, [isOpen, fetchTabs]);

  useEffect(() => {
    if (!editingUrlId) return;
    const t = window.setTimeout(() => editingUrlInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [editingUrlId]);

  // Load items for content bar (from BuildView)
  useEffect(() => {
    if (!isOpen) return;

    const loadItems = async () => {
      const items: SelectedLink[] = [];

      // 1. Current Tabs from tabsByWindow
      const seenNormalizedUrls = new Set<string>();
      Object.entries(tabsByWindow).forEach(([windowIdStr, tabs]) => {
        const winId = Number(windowIdStr);
        // If we are in an active session, skip showing tabs from the session window itself under 'Current Tabs'
        if (activeSessionId && currentWindowId !== null && winId === currentWindowId) {
          return;
        }

        tabs.forEach(t => {
          if (t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://')) {
            const norm = String(t.url || "").toLowerCase().trim().replace(/\/$/, '');
            if (seenNormalizedUrls.has(norm)) {
              return; // Skip duplicate tab in "Current Tabs" UI list
            }
            seenNormalizedUrls.add(norm);

            items.push({
              id: `tab-${t.id}`,
              url: t.url,
              name: t.title || 'Untitled Tab',
              favIconUrl: t.favIconUrl || getFaviconUrl(getHostname(t.url)),

              source: 'tab',
              originalData: t,
            });
          }
        });
      });

      // 2. Links & Notes from Redux (allData)
      // Helper to process snippets into list items
      const processSnippet = (s: any) => {
        const category = String(s.category || "").toLowerCase();

        const isTabGroup = category === 'link' || category === 'link';
        const isLink = category === 'link';
        const isNote = category === 'snippet';

        if (!isLink && !isNote) return;

        let subtitle = '';
        if (isLink) {
          try {
            if (typeof s.value === 'string') {
              if (s.value.trim().startsWith('{')) {
                const parsed = JSON.parse(s.value);
                if (parsed.urls && Array.isArray(parsed.urls) && parsed.urls.length > 0) {
                  subtitle = parsed.urls[0];
                } else if (parsed.url) {
                  subtitle = parsed.url;
                } else {
                  subtitle = s.value;
                }
              } else {
                subtitle = s.value;
              }
            }
          } catch {
            subtitle = '';
          }
        } else {
          subtitle = 'Note';
        }

        items.push({
          id: s.id || s.snippet_id || `snip-${Math.random()}`,
          url: isNote ? `note:${s.id || s.snippet_id}` : subtitle,
          name: s.key || 'Untitled',
          source: isLink ? 'link' : 'note',
          favIconUrl: (isLink && subtitle) ? getFaviconUrl(getHostname(subtitle)) : undefined,
          originalData: s,
        });
      };

      const processAutomation = (auto: any) => {
        if (!auto) return;
        const steps = auto.automation_steps || auto.steps;
        const isAi =
          Array.isArray(steps) &&
          steps.some(
            (s: any) =>
              String(s.module_id || s.moduleId) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
          );
        if (!isAi) return;

        if (items.some(existing => String(existing.id) === String(auto.id || auto.automation_id))) return;

        items.push({
          id: auto.id || auto.automation_id || `agent-${Math.random()}`,
          url: 'agent_chat',
          name: auto.name || auto.title || 'AI Agent',
          source: 'link',
          originalData: auto,
        });
      };

      // Fetch local automations
      try {
        const localData = await new Promise<any>(resolve => {
          chrome.storage.local.get(['automations', 'saved_automations'], resolve);
        });
        const toAutomationArray = (value: any): any[] => {
          if (Array.isArray(value)) return value;
          if (value && typeof value === 'object') return Object.values(value);
          return [];
        };
        const syncedAutomations = toAutomationArray(localData?.automations);
        const legacyAutomations = toAutomationArray(localData?.saved_automations);
        const localAutos = syncedAutomations.length > 0 ? syncedAutomations : legacyAutomations;

        localAutos.forEach(processAutomation);
      } catch (e) {
        console.warn('[LinkEditModal] Failed to load local automations:', e);
      }

      // Load all local DB items so Recent and cross-workspace items stay visible.
      snippets.forEach(processSnippet);
      automations.forEach(processAutomation);

      // Sort items by updated_at or created_at (descending) to show recent items first
      // Note: originalData might not always have updated_at depending on source, fallback to created_at or 0
      items.sort((a, b) => {
        const tA = a.originalData?.updated_at || a.originalData?.created_at || 0;
        const tB = b.originalData?.updated_at || b.originalData?.created_at || 0;
        // Handle ISO strings or timestamps
        const timeA = new Date(tA).getTime();
        const timeB = new Date(tB).getTime();
        return timeB - timeA;
      });

      setAvailableItems(items);
    };

    loadItems();
  }, [isOpen, snippets, automations, tabsByWindow, currentWindowId, activeSessionId]);

  // Scroll to top when active tab changes
  useEffect(() => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeContentTab]);

  // Filter items based on active tab and search query
  const filteredItems = useMemo(() => {
    if (activeContentTab === 'Selected tabs') {
      return selectedLinks;
    }

    let list = availableItems;

    // Tab Filter
    if (activeContentTab === 'Current Tabs') {
      const addedLinks = selectedLinks;
      const notAddedCurrentTabs = availableItems.filter(item => {
        if (item.source !== 'tab') return false;
        return !selectedLinks.some(selected => {
          if (selected.source === 'tab' && selected.originalData?.id === item.originalData?.id) return true;
          return selected.url === item.url;
        });
      });
      list = notAddedCurrentTabs;
    } else if (contentSearchQuery.trim() && activeContentTab === 'All saved files') {
      const q = contentSearchQuery.toLowerCase();
      list = list.filter(i => String(i.name || i.title || "").toLowerCase().includes(q) || String(i.url || "").toLowerCase().includes(q));
    }

    return list;
  }, [availableItems, activeContentTab, contentSearchQuery, selectedLinks]);

  const checkIsAdded = useCallback((item: SelectedLink) => {
    return selectedLinks.some(selected => {
      if (item.source === selected.source && item.originalData && selected.originalData) {
        const id1 = selected.originalData?.id || selected.originalData?.snippet_id;
        const id2 = item.originalData?.id || item.originalData?.snippet_id;
        return id1 && id2 && id1 === id2;
      }
      return selected.url === item.url;
    });
  }, [selectedLinks]);

  const allRenderedItems = useMemo(() => {
    const renderedSelected = selectedLinks.map(item => ({
      item,
      isAdded: true,
    }));

    const renderedActive = (activeContentTab === 'Selected tabs')
      ? []
      : filteredItems.filter(item => !checkIsAdded(item)).map(item => ({
          item,
          isAdded: false,
        }));

    return [...renderedSelected, ...renderedActive];
  }, [selectedLinks, filteredItems, activeContentTab, checkIsAdded]);

  const handleWorkspaceDestination = useCallback(
    (workspace: any, isPersonal?: boolean) => {
      // Switch team if personal workspace selected
      hasUserModifiedRef.current = true;

      // Update local override
      setManualWorkspaceId(workspace.workspace_id || null);
      setManualFolderId(null);
      setIsLocationPickerOpen(false);
    },
    [],
  );

  const handleFolderDestination = useCallback(
    (workspace: any, folder: any, isPersonal?: boolean) => {
      // Switch team if personal workspace selected
      hasUserModifiedRef.current = true;

      // Update local override
      setManualWorkspaceId(workspace.workspace_id || null);
      setManualFolderId(folder.folder_id || null);
      setIsLocationPickerOpen(false);
    },
    [],
  );

  const addLink = useCallback(
    (tab: BrowserTab) => {
      hasUserModifiedRef.current = true;
      const linkName = tab.title || getHostname(tab.url);

      setSelectedLinks(prev => {
        const linkId = `tab-${tab.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return [
          ...prev,
          {
            id: linkId,
            url: tab.url,
            name: linkName,
            favIconUrl: tab.favIconUrl,
            windowId: tab.windowId,
            source: 'tab' as const,
          },
        ];
      });

      if (activeSessionId) {
        chrome.runtime.sendMessage({
          action: 'open_tab_in_session',
          sessionId: activeSessionId,
          url: tab.url
        }).catch(() => {});
      }
    },
    [getHostname, isTitleManuallyModified, activeSessionId],
  );

  const removeLink = useCallback((linkId: string) => {
    hasUserModifiedRef.current = true;
    setSelectedLinks(prev => prev.filter(link => link.id !== linkId));
  }, []);

  // Add item from content bar (handles tabs, links, notes)
  const addItemFromContentBar = useCallback(
    (item: SelectedLink) => {
      hasUserModifiedRef.current = true;
      if (item.url === 'agent_chat') {
        const agentId = item.id || item.originalData?.id || item.originalData?.snippet_id;

        setSelectedLinks(prev => {
          const agentUrl = `agent_chat?id=${agentId}`;
          if (prev.some(existing => existing.url === agentUrl)) return prev;

          const newId = `agent-${agentId}-${Date.now()}`;
          return [
            ...prev,
            {
              ...item,
              id: newId,
              url: agentUrl,
              name: `${item.name} (AI Agent)`,
              source: 'custom',
              favIconUrl: 'https://chatgpt.com/favicon.ico', // Indicator for AI
            },
          ];
        });
        return;
      }

      setSelectedLinks(prev => {
        const newId = `${item.source}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return [
          ...prev,
          {
            ...item,
            id: newId,
          },
        ];
      });

      if (activeSessionId && item.url) {
        chrome.runtime.sendMessage({
          action: 'open_tab_in_session',
          sessionId: activeSessionId,
          url: item.url
        }).catch(() => {});
      }
    },
    [isTitleManuallyModified, activeSessionId],
  );

  const updateLinkName = useCallback((linkId: string, name: string) => {
    hasUserModifiedRef.current = true;
    setSelectedLinks(prev => prev.map(link => (link.id === linkId ? { ...link, name: name || link.url } : link)));
  }, []);

  const handleAddCustomLink = useCallback(() => {
    hasUserModifiedRef.current = true;
    const rawUrl = customLinkUrl.trim();
    if (!rawUrl) {
      showFooterStatus('error', 'Enter a URL to add.');
      return;
    }

    let normalizedUrl = rawUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      // Validate URL

      new URL(normalizedUrl);
    } catch (error) {
      showFooterStatus('error', 'Enter a valid URL.');
      return;
    }

    const name = customLinkName.trim() || getHostname(normalizedUrl);
    const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setSelectedLinks(prev => [
      ...prev,
      {
        id,
        url: normalizedUrl,
        name,
        source: 'custom',
        favIconUrl: getFaviconUrl(getHostname(normalizedUrl)),
      },
    ]);

    if (activeSessionId) {
      chrome.runtime.sendMessage({
        action: 'open_tab_in_session',
        sessionId: activeSessionId,
        url: normalizedUrl
      }).catch(() => {});
    }

    setCustomLinkName('');
    setIsCustomLinkFormOpen(false);
    setIsLeftCustomLinkFormOpen(false);
    setActiveContentTab('Current Tabs');
  }, [customLinkName, customLinkUrl, getHostname, activeSessionId]);

  const toggleWindowCollapse = useCallback((windowId: number) => {
    setCollapsedWindows(prev => ({
      ...prev,
      [windowId]: !prev[windowId],
    }));
  }, []);

  const handleCreateSession = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setIsStartingSession(true);
    setSessionError(null);

    try {
      // 1. Check duplicate session names in local snippet records
      let exists = false;
      const currentSessionIdLocal = (initialSession as any)?.id || (initialSession as any)?.snippet_id;
      exists = sessions.some((s: any) =>
        s.title?.trim().toLowerCase() === trimmedName.toLowerCase() &&
        String(s.id) !== String(currentSessionIdLocal) &&
        String((s as any).snippet_id) !== String(currentSessionIdLocal)
      );

      if (exists) {
        showFooterStatus('error', 'A tab group with this name already exists.');
        setIsStartingSession(false);
        return;
      }

      // 2. Check duplicate session names in active sessions stored in local storage
      const activeSessionsResult = await new Promise<any[]>((resolve) => {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.get('active_sessions', (res: any) => resolve(res.active_sessions || []));
        } else {
          resolve([]);
        }
      });
      const duplicateActive = activeSessionsResult.some((s: any) => s.sessionName?.toLowerCase() === trimmedName.toLowerCase());
      if (duplicateActive) {
        showFooterStatus('error', 'A tab group with this name is currently active.');
        setIsStartingSession(false);
        return;
      }

      const sessionId = isEditMode && initialSession
        ? (initialSession.id || (initialSession as any).snippet_id)
        : generateEntityId('session');

      // Pin the extension tab immediately when a session is started
      try {
        if ((window as any).chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'pin_extension_tab' });
        }
      } catch (e) {
        console.error('Failed to pin extension tab:', e);
      }

      const initialUrls = selectedLinks.map(l => l.url);
      const initialNames = selectedLinks.map(l => l.name);

      // Save prefill to local storage
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({
          pending_session_prefill: {
            title: name.trim(),
            sessionId: sessionId,
          }
        }, () => resolve());
      });

      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'start_session',
          sessionId,
          sessionName: name.trim(),
          workspaceId: propertiesRef.current?.workspaceId || null,
          folderId: propertiesRef.current?.folderId || null,
          teamId,
          storageMode: 'local',
          initialUrls,
          initialNames,
          openSettings: sessionOpenSettings,
        }, (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            reject(new Error(response?.error || 'Failed to start session'));
          } else {
            resolve();
          }
        });
      });
      setSessionDialogOpen(false);
      setSessionName('');
      showFooterStatus('success', 'Tab group started!');
      onClose(); // Return to home view since session is running in a separate window
    } catch (e: any) {
      showFooterStatus('error', e.message || 'Failed to start session');
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleSave = useCallback(
    async (isAutoSave: boolean = false, overrideLinks?: SelectedLink[], overrideTitle?: string) => {
      if (overrideTitle !== undefined) setTitle(overrideTitle);
      if (overrideLinks !== undefined) setSelectedLinks(overrideLinks);

      const saved = await executeSave(isAutoSave, { 
        openSettings: sessionOpenSettings,
        workspaceId: propertiesRef.current?.workspaceId,
        folderId: propertiesRef.current?.folderId,
        tagIds: propertiesRef.current?.tagIds,
      });
      if (saved && !isAutoSave) {
        setTimeout(() => onClose(), 1500);
      }
    }, [executeSave, setTitle, setSelectedLinks, onClose, sessionOpenSettings]);

  useEffect(() => {
    if (!hasUnsavedChanges || !isOpen) return;
    const timer = setTimeout(() => {
      void handleSave(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, handleSave, isOpen]);

  const parseSnippetValue = useCallback((value: string): SelectedLink[] => {
    if (!value) return [];
    try {
      if (value.startsWith('{') || value.startsWith('[')) {
        const parsed = JSON.parse(value);
        if (parsed && Array.isArray(parsed.urls)) {
          return parsed.urls.map((url: string, index: number) => ({
            id: `cloud-${index}-${Date.now()}`,
            url,
            name: parsed.names?.[index] || getHostname(url),
            source: 'link' as const,
          }));
        }
      }
    } catch (e) {
      console.warn('[LinkEditModal] Failed to parse snippet value:', e);
    }
    return [{
      id: `cloud-single-${Date.now()}`,
      url: value,
      name: '',
      source: 'link' as const,
    }];
  }, [getHostname]);

  const handleResolveConflictOverwrite = useCallback(async () => {
    if (!conflictModalData) return;
    const { cloudSnippet, localData } = conflictModalData;
    
    // Set sync baseline to cloud timestamp so retry bypasses comparison check
    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);
    
    // Retry saving
    await handleSave(false, localData.selectedLinks, localData.title);
  }, [conflictModalData, handleSave]);

  const handleResolveConflictMerge = useCallback(() => {
    if (!conflictModalData) return;
    const { cloudSnippet, localData } = conflictModalData;
    const cloudLinks = parseSnippetValue(cloudSnippet.value);
    
    const merged = [...localData.selectedLinks];
    cloudLinks.forEach(cl => {
      if (!merged.some(l => l.url === cl.url)) {
        merged.push(cl);
      }
    });

    setTitle(cloudSnippet.key || localData.title);
    setSelectedLinks(merged);
    
    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);
    showFooterStatus('success', 'Merged local and cloud edits');
  }, [conflictModalData, parseSnippetValue, showFooterStatus]);

  const handleResolveConflictDiscard = useCallback(() => {
    if (!conflictModalData) return;
    const { cloudSnippet } = conflictModalData;
    
    setTitle(cloudSnippet.key || '');
    const cloudLinks = parseSnippetValue(cloudSnippet.value);
    setSelectedLinks(cloudLinks);
    
    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);
    showFooterStatus('success', 'Loaded cloud version');
  }, [conflictModalData, parseSnippetValue, showFooterStatus]);

  const hasSyncedInitialDataRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasSyncedInitialDataRef.current = false;
    }
  }, [isOpen]);


  // Unload event listener to stash unsaved edits
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasUnsavedChanges) {
        const backupData = {
          title,
          selectedLinks,
          activeSessionId,
          workspaceId: propertiesRef.current?.workspaceId || null,
          folderIdForSave: propertiesRef.current?.folderId || null,
          teamId,
          timestamp: Date.now()
        };
        localStorage.setItem(getBackupKey(), JSON.stringify(backupData));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, getBackupKey, title, selectedLinks, activeSessionId, teamId]);

  // Mount effect to restore stashed backup
  useEffect(() => {
    if (!isOpen) return;

    const rawBackup = localStorage.getItem(getBackupKey());
    if (rawBackup) {
      try {
        const backup = JSON.parse(rawBackup);
        if (backup && Date.now() - backup.timestamp < 24 * 60 * 60 * 1000) {
          
          setTitle(backup.title || '');
          setSelectedLinks(backup.selectedLinks || []);
          if (backup.activeSessionId) {
            setActiveSessionId(backup.activeSessionId);
          }
          if (backup.targetWorkspaceId) {
            setManualWorkspaceId(backup.targetWorkspaceId);
          }
          if (backup.folderIdForSave) {
            setManualFolderId(backup.folderIdForSave);
          }
          // Clear backup after successful restoration so it doesn't loop
          localStorage.removeItem(getBackupKey());
          showFooterStatus('success', 'Restored unsaved changes');
        }
      } catch (err) {
        console.error('[LinkEditModal] Failed to restore stashed backup:', err);
      }
    }
  }, [isOpen, getBackupKey]);

  const lastSavedMessage = useRelativeSavedTime(lastSavedAt);

  useEffect(() => {
    if (isEditMode && isOpen && !hasSyncedInitialDataRef.current) {
      if (title.trim() !== '' && selectedLinks.length > 0) {
        hasSyncedInitialDataRef.current = true;
      }
    }
  }, [
    isEditMode,
    isOpen,
    title,
    selectedLinks,
  ]);

  const handleCreateNew = useCallback(() => {
    setIsForceCreateNew(true);
    setTitle('');
    setSelectedLinks([]);
    setLocalSessionOverride(null);
    hasInitializedPrefill.current = false;
    hasSyncedInitialDataRef.current = false;
    
    
    
    
    
    
    
        
    setCustomLinkUrl('');
    setCustomLinkName('');
    setIsCustomLinkFormOpen(false);
    setIsLeftCustomLinkFormOpen(false);
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);

  const handleCloseAttempt = useCallback(async () => {
    const endSessionIfActive = () => {
      if (activeSessionId) {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.windows?.getCurrent) {
          chromeAny.windows.getCurrent({ populate: false }, (currentWindow: any) => {
            if (currentWindow?.id) {
              chromeAny.runtime.sendMessage({
                action: 'end_session',
                windowId: currentWindow.id
              }).catch((e: any) => console.error('[LinkEditModal] Failed to send end_session to background:', e));
            }
          });
        }
        setActiveSessionId(null);
      }
    };
    
    // Explicitly force a final save before closing.
    await handleSave(false);
    
    onClose();
    endSessionIfActive();
  }, [activeSessionId, handleSave, onClose]);

  // Register escape handler with uiStateManager
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => {
      if (isLeftCustomLinkFormOpen || isCustomLinkFormOpen || document.getElementById('hotkey-assignment-popup')) {
        return true; // we just let those handle it or block it
      }
      handleCloseAttempt();
      return true; // We intercepted the escape, don't let uiStateManager forcefully close
    };
    useUIStore.getState().setEditorEscapeHandler(handler);
    return () => useUIStore.getState().setEditorEscapeHandler(null);
  }, [isOpen, isLeftCustomLinkFormOpen, isCustomLinkFormOpen, handleCloseAttempt]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!isOpen) return;
      // Create New Shortcut strictly on Ctrl+Shift+Enter
      else if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
        event.preventDefault();
        if (isEditMode) {
          handleCreateNew();
        }
      }
      // Location Picker Shortcut: Alt+Enter (Win) -> Option+Enter (Mac)
      else if (
        event.altKey && // Option is also altKey on Mac
        event.key === 'Enter'
      ) {
        event.preventDefault();
        if (saveStatus === 'saving') return;
        if (false) {
          showFooterStatus('error', 'Create a workspace first');
          return;
        }
        setIsLocationPickerOpen(prev => !prev);
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        setIsCustomLinkFormOpen(true);
        setCustomLinkUrl(prev => (prev && prev.length > 0 ? prev : ''));
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [
    handleSave,
    saveStatus,
    needsDestinationSelection,
    onClose,

    isOpen,
    hasUnsavedChanges,
    title,
    selectedLinks,

    handleCloseAttempt,
    isMac,
    isEditMode,
    isLeftCustomLinkFormOpen,
    isCustomLinkFormOpen,
  ]);

  // Browser-level warning for unsaved changes commented out per request
  /*
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isOpen) return undefined;
      const hasUnsavedChanges = !isEditMode && (selectedLinks.length > 0 || title.trim().length > 0);

      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOpen, isEditMode, selectedLinks.length, title]);
  */


  const [focusedTabIndex, setFocusedTabIndex] = useState(0);

  // Reset focus index when changing tabs
  useEffect(() => {
    setFocusedTabIndex(0);
  }, [activeContentTab]);

  // Sync focus index when left custom link form is toggled
  useEffect(() => {
    if (isLeftCustomLinkFormOpen) {
      setFocusedTabIndex(allRenderedItems.length);
    }
  }, [isLeftCustomLinkFormOpen, allRenderedItems.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleNavigation = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Skip global "Enter to add link" if certain interactive elements are focused
      const focused = document.activeElement;
      const isHeaderElementFocused =
        focused === titleInputRef.current ||
        focused === favButtonRef.current ||
        (hotkeyButtonRef.current &&
          (focused === hotkeyButtonRef.current || hotkeyButtonRef.current.contains(focused as Node)));

      if (
        isCustomLinkFormOpen ||
        isLeftCustomLinkFormOpen ||
        isLocationPickerOpen ||
        isAltEnterPickerOpen ||
        editingUrlId
      )
        return;

      const totalNavigable = allRenderedItems.length + 1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedTabIndex(prev => (prev >= totalNavigable - 1 ? 0 : prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedTabIndex(prev => (prev <= 0 ? totalNavigable - 1 : prev - 1));
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        // Stop global Enter trigger if typing in any input/textarea (like Title input, Search Tags input, etc.)
        if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) {
          return;
        }
        // Trigger Add Link even when typing in the title input (keeping focus in title input)
        e.preventDefault();
        e.stopPropagation();
        if (focusedTabIndex === allRenderedItems.length) {
          setIsLeftCustomLinkFormOpen(true);
          setCustomLinkUrl('');
        } else if (allRenderedItems[focusedTabIndex]) {
          const { item, isAdded } = allRenderedItems[focusedTabIndex];

          if (isAdded) {
            removeLink(item.id);
          } else {
            addItemFromContentBar(item);
          }
        }
      }
    };

    window.addEventListener('keydown', handleNavigation);
    return () => window.removeEventListener('keydown', handleNavigation);
  }, [
    allRenderedItems,
    selectedLinks,
    focusedTabIndex,
    addLink,
    addItemFromContentBar,
    removeLink,
    editingUrlId,
    isAltEnterPickerOpen,
    isCustomLinkFormOpen,
    isLeftCustomLinkFormOpen,
    isLocationPickerOpen,
    isOpen,
  ]);

  // Auto-select first tab when opening in create mode - DISABLED per user request
  // useEffect(() => {
  //   if (isOpen && !isEditMode && !hasAutoSelectedRef.current && allTabs.length > 0) {
  //     addLink(allTabs[0]);
  //     hasAutoSelectedRef.current = true;
  //   }
  //   if (!isOpen) {
  //     hasAutoSelectedRef.current = false;
  //   }
  // }, [isOpen, isEditMode, allTabs, addLink]);

  useEffect(() => {
    const el = tabItemRefs.current[focusedTabIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedTabIndex]);

  if (!isOpen) return null;

  const globalTabRenderIndex = 0;

  return (
    <>
      <EditorContainer
        className="flex flex-row flex-1 h-full relative text-left w-full custom-scrollbar min-h-[450px]"
        innerClassName="flex flex-col gap-1 w-[500px] max-w-full flex-shrink h-full min-w-[350px] relative min-h-[450px]"
      >
          <div className={clsx(
            "flex-1 flex flex-col text-[#073642] dark:text-neutral-200 relative bg-transparent dark:bg-transparent border-none min-h-[450px]",
            ((isLeftCustomLinkFormOpen && linkSuggestions.length > 0) || isSettingsPopupOpen) ? "overflow-visible" : "overflow-hidden",
            isSettingsPopupOpen && "z-[60]"
          )}>
            {/* Main Content Area (Centered) */}
            <div className="w-full flex flex-col items-stretch justify-start flex-shrink-0">
              <div className="w-full flex items-center py-2.5 px-2 border-b border-white/50 dark:border-white/10">
                {/* Static Heading - Left */}
                <div className="flex items-center flex-1 min-w-0 relative">
                  <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-200 pl-2">Tab Group</h3>

                  {saveStatus === 'error' && saveError && (
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-[#ef4444] ml-4">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      {saveError}
                    </span>
                  )}
                </div>

                {/* Auto-save indicator */}
                {!saveError && (
                  <div className="flex items-center gap-1 ml-2 transition-opacity duration-300">
                    {(isEditMode || (title.trim().length > 0 && selectedLinks.length > 0)) && (
                      <>
                        {(saveStatus === 'saving' || (hasUnsavedChanges && saveStatus !== 'error')) && (
                          <span className="text-sm font-medium text-[#93a1a1] dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap opacity-70">
                            Saving...
                          </span>
                        )}

                        {saveStatus === 'saved' && !hasUnsavedChanges && (
                          <span className="text-sm font-medium text-[#93a1a1] dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap">
                            {lastSavedMessage} <FaCheckCircle className="opacity-70 text-xs text-emerald-500" />
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 ml-auto relative">
                  {isDuplicateTitle && (
                    <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                      Duplicate title exists
                    </span>
                  )}
                  {/* Settings Gear Button */}
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setIsSettingsPopupOpen(prev => !prev);
                      }}
                      className="p-2 transition-all rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none z-50 settings-btn"
                      title="Tab group settings">
                      <FiSettings size={14} />
                    </button>

                    {isSettingsPopupOpen && (
                      <div
                        ref={settingsPopupRef}
                        className="absolute left-0 top-full mt-2 bg-[var(--color-editorBg)] border border-black/10 dark:border-white/10 rounded-2xl p-5 shadow-2xl w-[320px] z-[100]"
                        onClick={e => e.stopPropagation()}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Tab group settings</span>
                          <button
                            type="button"
                            onClick={() => setIsSettingsPopupOpen(false)}
                            className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            <FaTimes size={10} />
                          </button>
                        </div>

                        {/* Open tabs in */}
                        <div className="mb-4">
                          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 block">Open tabs in</span>
                          <div className="flex flex-col gap-2">
                            {/* Same window */}
                            <label
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                sessionOpenSettings.openMode === 'same_window'
                                  ? 'border-[var(--color-primary,#6366f1)]/40 bg-[var(--color-primary,#6366f1)]/5 dark:bg-[var(--color-primary,#6366f1)]/10'
                                  : 'border-black/8 dark:border-white/8 hover:bg-black/3 dark:hover:bg-white/3'
                              }`}
                              onClick={() => setSessionOpenSettings(prev => ({ ...prev, openMode: 'same_window' }))}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                sessionOpenSettings.openMode === 'same_window'
                                  ? 'border-[var(--color-primary,#6366f1)]'
                                  : 'border-neutral-400 dark:border-neutral-500'
                              }`}>
                                {sessionOpenSettings.openMode === 'same_window' && (
                                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary,#6366f1)]" />
                                )}
                              </div>
                              <div className={`shrink-0 p-1.5 rounded-lg ${
                                sessionOpenSettings.openMode === 'same_window'
                                  ? 'bg-[var(--color-primary,#6366f1)]/15 text-[var(--color-primary,#6366f1)]'
                                  : 'bg-black/5 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
                              }`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                                  <line x1="3" y1="8" x2="21" y2="8"/>
                                </svg>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Same window</span>
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">Replace current tabs</span>
                              </div>
                            </label>

                            {/* New window */}
                            <label
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                sessionOpenSettings.openMode === 'new_window'
                                  ? 'border-[var(--color-primary,#6366f1)]/40 bg-[var(--color-primary,#6366f1)]/5 dark:bg-[var(--color-primary,#6366f1)]/10'
                                  : 'border-black/8 dark:border-white/8 hover:bg-black/3 dark:hover:bg-white/3'
                              }`}
                              onClick={() => setSessionOpenSettings(prev => ({ ...prev, openMode: 'new_window' }))}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                sessionOpenSettings.openMode === 'new_window'
                                  ? 'border-[var(--color-primary,#6366f1)]'
                                  : 'border-neutral-400 dark:border-neutral-500'
                              }`}>
                                {sessionOpenSettings.openMode === 'new_window' && (
                                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary,#6366f1)]" />
                                )}
                              </div>
                              <div className={`shrink-0 p-1.5 rounded-lg ${
                                sessionOpenSettings.openMode === 'new_window'
                                  ? 'bg-[var(--color-primary,#6366f1)]/15 text-[var(--color-primary,#6366f1)]'
                                  : 'bg-black/5 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
                              }`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                                  <line x1="3" y1="8" x2="21" y2="8"/>
                                  <line x1="9" y1="8" x2="9" y2="21"/>
                                </svg>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">New window</span>
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">Open in a new window</span>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Auto-save behavior */}
                        <div className="pt-3 border-t border-black/5 dark:border-white/5">
                          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 block">Auto-save behavior</span>
                          <div className="flex flex-col gap-2">
                            {/* Auto-save (Live Sync) */}
                            <label
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                sessionOpenSettings.autoSaveMode === 'auto_save'
                                  ? 'border-[var(--color-primary,#6366f1)]/40 bg-[var(--color-primary,#6366f1)]/5 dark:bg-[var(--color-primary,#6366f1)]/10'
                                  : 'border-black/8 dark:border-white/8 hover:bg-black/3 dark:hover:bg-white/3'
                              }`}
                              onClick={() => setSessionOpenSettings(prev => ({ ...prev, autoSaveMode: 'auto_save' }))}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                sessionOpenSettings.autoSaveMode === 'auto_save'
                                  ? 'border-[var(--color-primary,#6366f1)]'
                                  : 'border-neutral-400 dark:border-neutral-500'
                              }`}>
                                {sessionOpenSettings.autoSaveMode === 'auto_save' && (
                                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary,#6366f1)]" />
                                )}
                              </div>
                              <div className={`shrink-0 p-1.5 rounded-lg ${
                                sessionOpenSettings.autoSaveMode === 'auto_save'
                                  ? 'bg-[var(--color-primary,#6366f1)]/15 text-[var(--color-primary,#6366f1)]'
                                  : 'bg-black/5 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
                              }`}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
                                  <path d="M13 22a5 5 0 1 0-4.54-2.82" />
                                  <path d="M13 22v-4h4" />
                                </svg>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Auto-save</span>
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">Capture exact window state, remove closed tabs.</span>
                              </div>
                            </label>

                            {/* Don't auto-save */}
                            <label
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                sessionOpenSettings.autoSaveMode === 'dont_save'
                                  ? 'border-[var(--color-primary,#6366f1)]/40 bg-[var(--color-primary,#6366f1)]/5 dark:bg-[var(--color-primary,#6366f1)]/10'
                                  : 'border-black/8 dark:border-white/8 hover:bg-black/3 dark:hover:bg-white/3'
                              }`}
                              onClick={() => setSessionOpenSettings(prev => ({ ...prev, autoSaveMode: 'dont_save' }))}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                sessionOpenSettings.autoSaveMode === 'dont_save'
                                  ? 'border-[var(--color-primary,#6366f1)]'
                                  : 'border-neutral-400 dark:border-neutral-500'
                              }`}>
                                {sessionOpenSettings.autoSaveMode === 'dont_save' && (
                                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary,#6366f1)]" />
                                )}
                              </div>
                              <div className={`shrink-0 p-1.5 rounded-lg ${
                                sessionOpenSettings.autoSaveMode === 'dont_save'
                                  ? 'bg-[var(--color-primary,#6366f1)]/15 text-[var(--color-primary,#6366f1)]'
                                  : 'bg-black/5 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
                              }`}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3" />
                                  <line x1="2" x2="22" y1="2" y2="22" />
                                </svg>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Don't auto-save</span>
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">Add or remove tabs manually.</span>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    ref={closeButtonRef}
                    onClick={handleCloseAttempt}
                    onKeyDown={e => {
                      if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        if (titleInputRef.current) {
                          titleInputRef.current.focus();
                          titleInputRef.current.selectionStart = titleInputRef.current.value.length;
                          titleInputRef.current.selectionEnd = titleInputRef.current.value.length;
                        }
                      }
                    }}
                    className="p-2 transition-all rounded-lg text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none z-50"
                    title="Close (Esc)">
                    <FaTimes size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Floating Cards Container */}
            <div className="w-full flex-1 flex flex-col min-h-0 items-stretch px-5 pt-4">
              {/* Session Name Field */}
              <div className="flex flex-col gap-1.5 mb-6">
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Session name</h4>
                <div className="relative rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden px-4 py-2.5 flex items-center">
                  <input
                    ref={titleInputRef}
                    value={title}
                    onChange={event => {
                      setTitle(event.target.value);
                      setIsTitleManuallyModified(true);
                      hasUserModifiedRef.current = true;
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !activeSessionId) {
                        e.preventDefault();
                        const trimmedTitle = title.trim();
                        if (!trimmedTitle) {
                          setSessionError('Enter the title for this link collection');
                        } else {
                          setSessionError(null);
                          handleCreateSession(trimmedTitle);
                        }
                      } else if (e.key === 'ArrowRight') {
                        if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
                          e.preventDefault();
                          closeButtonRef.current?.focus();
                        }
                      }
                    }}
                    placeholder="Give your session a name..."
                    className="flex-1 text-sm font-medium text-black dark:text-white placeholder-[var(--color-textPlaceholder)]/70 bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0"
                  />
                </div>
              </div>

              {/* MAIN LIST: Content Bar Source */}
              <div className="w-full flex-1 flex flex-col min-w-0 relative">
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Tabs ({allRenderedItems.length})
                </h4>
                {/* List */}
                <div
                  ref={listContainerRef}
                  className={clsx(
                    "flex-1 min-h-0 w-full max-h-[min(480px,calc(100vh-280px))]",
                    "rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden",
                    (isLeftCustomLinkFormOpen && linkSuggestions.length > 0)
                      ? "overflow-visible"
                      : "overflow-y-auto custom-scrollbar"
                  )}>
                  <div className="flex flex-col w-full divide-y divide-black/5 dark:divide-white/5 pb-2">
                    {(() => {
                      const renderedSelected = allRenderedItems.filter(i => i.isAdded);
                      const renderedActive = allRenderedItems.filter(i => !i.isAdded);

                      const renderItem = (item: any, isAdded: boolean, idx: number, globalIdx: number) => {
                        const handleToggle = (e?: React.MouseEvent) => {
                          if (e) {
                            e.stopPropagation();
                            e.preventDefault();
                          }
                          if (isAdded) {
                            removeLink(item.id);
                          } else {
                            addItemFromContentBar(item);
                          }
                        };

                        const itemIcon = (() => {
                          if (item.url === 'agent_chat') {
                            const step = (item.originalData?.automation_steps || item.originalData?.steps)?.[0];
                            let urls: string[] = [];
                            if (step?.config?.allAiUrls) {
                              urls = Object.values(step.config.allAiUrls as Record<string, string>)
                                .map(u => String(u))
                                .filter(u => !u.includes('cmd_select_status=false'));
                            } else if (step?.config?.url) {
                              urls = [step.config.url].filter(u => !u.includes('cmd_select_status=false'));
                            }

                            if (urls.length > 0) {
                              return (
                                <div className="flex -space-x-1.5 items-center w-8">
                                  {urls.slice(0, 3).map((url, i) => (
                                    <div
                                      key={`agent-icon-${item.id}-${i}`}
                                      className="w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1E] overflow-hidden shadow-sm bg-white flex-shrink-0">
                                      <img
                                        src={getFaviconUrl(getHostname(url))}
                                        alt=""
                                        className="w-4 h-4 object-cover"
                                      />
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return (
                              <div className="w-5 h-5 rounded flex items-center justify-center bg-[#eee8d5] dark:bg-neutral-800 text-[#93a1a1]">
                                <FaRobot size={12} />
                              </div>
                            );
                          }

                          if (item.favIconUrl) {
                            return <img src={item.favIconUrl} className="w-5 h-5 object-contain" alt="" />;
                          }

                          return (
                            <div className="w-5 h-5 rounded flex items-center justify-center bg-[#eee8d5] dark:bg-neutral-800 text-[#93a1a1]">
                              {item.source === 'note' ? <FaFileAlt size={12} /> : <FaLink size={12} />}
                            </div>
                          );
                        })();

                        const itemLabel = (() => {
                          if (item.source === 'note' || item.url?.startsWith('note:')) {
                            return 'Note';
                          }
                          if (item.url === 'agent_chat') {
                            return 'AI Agent';
                          }
                          return (item.url || '').replace(/^https?:\/\/(www\.)?/i, '');
                        })();

                        return (
                          <div
                            key={item.id}
                            ref={el => {
                              tabItemRefs.current[globalIdx] = el;
                            }}
                            onClick={handleToggle}
                            onDoubleClick={e => {
                              e.stopPropagation();
                              e.preventDefault();
                              openLinkEditPopup(item);
                            }}
                            className={`group flex items-center gap-3 py-2 px-3 transition-all cursor-pointer focus:outline-none first:rounded-t-xl last:rounded-b-xl ${
                              focusedTabIndex === globalIdx
                                ? 'bg-white/10'
                                : 'hover:bg-white/5'
                            }`}>
                            <div className="flex-shrink-0 relative">{itemIcon}</div>

                            <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                              <div
                                className={clsx(
                                  "text-[13px] font-medium tracking-tight truncate flex-shrink-0 max-w-[65%]",
                                  isAdded ? "text-neutral-800 dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-400"
                                )}
                                style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
                                {item.name}
                              </div>
                              <div
                                className={clsx(
                                  'text-[11px] font-normal truncate transition-opacity duration-200 text-right min-w-0',
                                  focusedTabIndex === globalIdx ? 'opacity-100' : 'opacity-50 group-hover:opacity-100',
                                  'text-neutral-400 dark:text-neutral-500',
                                )}>
                                {itemLabel}
                              </div>
                            </div>

                            {/* Action Buttons & Add/Added indicator */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                               {/* Add / Added Text Visual Indicator */}
                               <div
                                 className={clsx(
                                   "text-[12px] font-semibold transition-all duration-200 select-none shrink-0 flex items-center justify-center min-w-[50px]",
                                   isAdded
                                     ? "text-emerald-500 dark:text-emerald-400"
                                     : "text-neutral-400 dark:text-neutral-500 group-hover:text-emerald-500 dark:group-hover:text-emerald-400"
                                 )}
                               >
                                 {isAdded ? 'Added' : '+ Add'}
                               </div>

                               {/* Three Vertical Dots Dropdown for Added Items */}
                               {isAdded && (
                                 <div 
                                   className="relative shrink-0 three-dots-container flex items-center"
                                 >
                                   <button
                                     type="button"
                                     onClick={e => {
                                       e.stopPropagation();
                                       e.preventDefault();
                                       setActiveMenuLinkId(prev => prev === item.id ? null : item.id);
                                     }}
                                     className={clsx(
                                       "p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center focus:outline-none transition-opacity duration-200",
                                       (activeMenuLinkId === item.id || focusedTabIndex === globalIdx)
                                         ? "opacity-100"
                                         : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                                     )}
                                     title="More options"
                                   >
                                     <FaEllipsisV size={11} />
                                   </button>
                                   
                                   {activeMenuLinkId === item.id && (
                                     <div 
                                       onClick={e => e.stopPropagation()}
                                       className="absolute right-0 top-full mt-1 bg-[#fdf6e3] dark:bg-neutral-900 border border-[#eee8d5] dark:border-neutral-700 rounded-xl shadow-2xl z-[999] py-1 flex flex-col w-32 overflow-hidden"
                                     >
                                       <button
                                         type="button"
                                         onClick={e => {
                                           e.stopPropagation();
                                           e.preventDefault();
                                           setActiveMenuLinkId(null);
                                           removeLink(item.id);
                                         }}
                                         className="flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors text-red-600 dark:text-red-400 hover:bg-[#eee8d5] dark:hover:bg-neutral-800"
                                       >
                                         <FaTrash size={10} className="opacity-70" />
                                         <span>Remove</span>
                                       </button>
                                       <button
                                         type="button"
                                         onClick={e => {
                                           e.stopPropagation();
                                           e.preventDefault();
                                           setActiveMenuLinkId(null);
                                           setIsLeftCustomLinkFormOpen(true);
                                           setCustomLinkUrl('');
                                         }}
                                         className="flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-800 hover:text-[#073642] dark:hover:text-white"
                                       >
                                         <FaPlus size={10} className="opacity-70" />
                                         <span>Add custom link</span>
                                       </button>
                                     </div>
                                   )}
                                 </div>
                               )}
                             </div>
                          </div>
                        );
                      };

                      return (
                        <>
                          {/* All Items */}
                          {allRenderedItems.map((wrap, idx) => renderItem(wrap.item, wrap.isAdded, idx, idx))}

                          {/* Custom link form appended inside the card wrapper when input form is open */}
                          {isLeftCustomLinkFormOpen ? (
                            <div
                              ref={el => {
                                tabItemRefs.current[allRenderedItems.length] = el as any;
                              }}
                              className="flex items-center gap-3 py-2 px-3 transition-all focus:outline-none bg-transparent relative z-50 last:rounded-b-xl">
                              
                              {/* Inline Text Input */}
                              <div className="flex-1 min-w-0 flex items-center gap-1.5 justify-start">
                                {(allRenderedItems.length === 0 && !customLinkUrl) && (
                                  <span className="text-red-500/50 text-[13.5px] font-bold select-none shrink-0">*</span>
                                )}
                                <input
                                  ref={customLinkUrlRef}
                                  value={customLinkUrl}
                                  onChange={event => setCustomLinkUrl(event.target.value)}
                                  onKeyDown={event => {
                                    if (
                                      linkSuggestions.length > 0 &&
                                      (event.key === 'ArrowDown' || event.key === 'ArrowUp')
                                    ) {
                                      event.preventDefault();
                                      if (event.key === 'ArrowDown') {
                                        setFocusedSuggestionIndex(prev =>
                                          Math.min(prev + 1, linkSuggestions.length - 1),
                                        );
                                      } else {
                                        setFocusedSuggestionIndex(prev => Math.max(prev - 1, -1));
                                      }
                                      return;
                                    }

                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      event.stopPropagation();

                                      if (focusedSuggestionIndex >= 0 && linkSuggestions[focusedSuggestionIndex]) {
                                        const item = linkSuggestions[focusedSuggestionIndex];
                                        setSelectedLinks(prev => [
                                          ...prev,
                                          {
                                            id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                                            url: item.url,
                                            name: item.title || getHostname(item.url),
                                            source: 'custom',
                                            favIconUrl: getFaviconUrl(getHostname(item.url)),
                                          },
                                        ]);
                                        setCustomLinkUrl('');
                                        setCustomLinkName('');
                                        setIsLeftCustomLinkFormOpen(false);
                                        setLinkSuggestions([]);
                                        setActiveContentTab('Current Tabs');
                                        return;
                                      }

                                      handleAddCustomLink();
                                    } else if (event.key === 'Escape') {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      setIsLeftCustomLinkFormOpen(false);
                                      setCustomLinkUrl('');
                                      setCustomLinkName('');
                                    }
                                  }}
                                  placeholder="Type or paste a URL..."
                                  autoFocus
                                  className="w-full bg-transparent border-none text-[13.5px] font-normal text-[#073642] dark:text-neutral-100 placeholder-[var(--color-textPlaceholder)]/50 focus:outline-none h-6"
                                  style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
                                />
                                {linkSuggestions.length > 0 && (
                                  <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-[#1C1C1E] border border-[#eee8d5] dark:border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[99] overflow-hidden max-h-[250px] flex flex-col">
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-[#93a1a1] dark:text-neutral-500 tracking-wider bg-[#fdf6e3]/50 dark:bg-black/20 border-b border-[#eee8d5] dark:border-white/5">
                                      Suggestions
                                    </div>
                                    <div className="overflow-y-auto custom-scrollbar">
                                      {linkSuggestions.map((suggestion, idx) => (
                                        <div
                                          key={idx}
                                          className={`px-3 py-2 cursor-pointer flex items-center gap-3 transition-colors ${
                                            focusedSuggestionIndex === idx
                                              ? 'bg-[#3B66AE] text-white'
                                              : 'hover:bg-[#fdf6e3] dark:hover:bg-white/5 text-[#073642] dark:text-neutral-200'
                                          }`}
                                          onClick={() => {
                                            const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                                            setSelectedLinks(prev => [
                                              ...prev,
                                              {
                                                id,
                                                url: suggestion.url,
                                                name: suggestion.title || getHostname(suggestion.url),
                                                source: 'custom',
                                                favIconUrl: getFaviconUrl(getHostname(suggestion.url)),
                                              },
                                            ]);
                                            setCustomLinkUrl('');
                                            setCustomLinkName('');
                                            setIsLeftCustomLinkFormOpen(false);
                                            setLinkSuggestions([]);
                                            setActiveContentTab('Current Tabs');
                                          }}>
                                          <div className="flex-shrink-0 relative">
                                            <img
                                              src={getFaviconUrl(getHostname(suggestion.url))}
                                              alt=""
                                              className="w-3.5 h-3.5 rounded-sm object-cover"
                                              onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                              }}
                                            />
                                            <div className="hidden w-3.5 h-3.5 rounded flex items-center justify-center text-[#93a1a1]">
                                              {suggestion.source === 'bookmark' ? <FaBookmark size={10} /> : <FaHistory size={10} />}
                                            </div>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div
                                              className={`font-medium truncate ${focusedSuggestionIndex === idx ? 'text-white' : 'text-[#586e75] dark:text-neutral-200'}`}>
                                              {suggestion.title}
                                            </div>
                                            <div
                                              className={`truncate opacity-80 text-[10px] ${focusedSuggestionIndex === idx ? 'text-white/70' : 'text-[#93a1a1]'}`}>
                                              {suggestion.url}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div 
                              onClick={() => {
                                setIsLeftCustomLinkFormOpen(true);
                                setCustomLinkUrl('');
                              }}
                              className="group flex items-center gap-3 py-3 px-3 transition-all cursor-pointer focus:outline-none hover:bg-white/5 last:rounded-b-xl"
                            >
                              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[var(--color-primary,#6366f1)] opacity-70 group-hover:opacity-100">
                                <FaPlus size={12} />
                              </div>
                              <span className="text-[13.5px] font-medium text-[var(--color-primary,#6366f1)] opacity-90 group-hover:opacity-100">Add current tab</span>
                            </div>
                          )}

                          {/* Empty State when no items are available */}
                          {allRenderedItems.length === 0 && !isLeftCustomLinkFormOpen && (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                              <div className="w-12 h-12 rounded-full bg-[var(--color-containerBg)] flex items-center justify-center text-neutral-400 dark:text-neutral-500 mb-3">
                                <FaLink size={20} />
                              </div>
                              <h4 className="text-sm font-semibold text-[var(--color-textPrimary)] mb-1">No tabs selected or open</h4>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[240px] mb-4">
                                Start opening tabs in your browser or add a custom link manually.
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>

         
          {/* Footer for Actions */}
          <div className="relative flex flex-col w-full flex-shrink-0">
            {/* Create New Floating Button */}
            {isEditMode && !activeSessionId && !hasUnsavedChanges && (
              <div className="w-full flex justify-end px-4 pb-4 pt-1 bg-transparent">
                <button
                  onClick={handleCreateNew}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPos({
                      top: rect.top + window.scrollY - 46,
                      left: rect.left + window.scrollX - 40,
                    });
                    setShowTooltip(true);
                  }}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-95 border-white/20 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white cursor-pointer">
                  Create new
                </button>

                {showTooltip && createPortal(
                  <div
                    style={{
                      position: 'absolute',
                      top: `${tooltipPos.top}px`,
                      left: `${tooltipPos.left}px`,
                    }}
                    className="bg-[#1c1d27] border border-[#2f3142] rounded-xl px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-[999999] flex items-center gap-3 text-[12px] font-sans text-white pointer-events-none"
                  >
                    <div className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Ctrl</kbd>
                      <span className="text-[10px] text-neutral-400 font-bold">+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Shift</kbd>
                      <span className="text-[10px] text-neutral-400 font-bold">+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Enter</kbd>
                    </div>
                    <span className="text-neutral-400 text-left whitespace-nowrap">to save and create new</span>
                  </div>,
                  document.body
                )}
              </div>
            )}
          </div>

          {/* FLOATING CAPSULE TOOLBAR */}
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 z-50 select-none flex flex-col items-center gap-1 p-1 rounded-2xl bg-[var(--color-editorBg)] border border-black/10 dark:border-white/15 shadow-lg">
            <SharedPropertiesToolbar
              initialSnippet={initialSessionProp}
              compoundId={activeSessionId || ''}
              defaultName={sessionName || 'New Link List'}
              onChange={(properties) => { propertiesRef.current = properties; }}
              showTodo={true}
              onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
                if (!activeSessionId) return;
                const scheduleTime = deadlineVal ? new Date(deadlineVal).getTime() : Date.now();
                try {
                  const references = selectedLinks.map(link => ({
                    type: (link as any).category || 'tab',
                    id: link.id || link.url
                  }));
                  
                  const newTodo = await createTodo(
                    sessionName || 'New Session',
                    references.length > 0 ? references : [{ type: 'session', id: activeSessionId }],
                    isRecurring ? 'recurring' : 'one-time',
                    scheduleTime,
                    isRecurring ? recurringCycle as any : undefined
                  );

                  const chromeAny = (window as any).chrome;
                  if (chromeAny?.runtime?.sendMessage) {
                    chromeAny.runtime.sendMessage({
                      action: 'schedule_newtodo_alarm',
                      todoId: newTodo.id,
                      scheduleTime: scheduleTime
                    });
                  }
                } catch (err) {
                  console.error('Failed to create and schedule session todo', err);
                }
              }}
              saveStatus={saveStatus}
              orgTeam={null}
              personalWorkspaces={[]}
            />
          </div>
      </EditorContainer>

      {/* Link Edit Popup */}
      {editingPopupLinkId && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onClick={closeLinkEditPopup}>
          <div
            className="bg-[var(--color-popupBg)] rounded-xl border border-[#eee8d5] dark:border-neutral-700 shadow-2xl p-4 min-w-[600px] max-w-[90%]"
            onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-[#073642] dark:text-neutral-200 mb-3">Edit Link</div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                  <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Link Name</td>
                  <td className="py-2">
                    <input
                      ref={linkNameInputRef}
                      value={editingLinkName}
                      onChange={e => setEditingLinkName(e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          urlNameInputRef.current?.focus();
                        }
                      }}
                      placeholder="Enter display name for the link"
                      className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                    />
                  </td>
                </tr>
                <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                  <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Full URL</td>
                  <td className="py-2">
                    <input
                      ref={urlNameInputRef}
                      value={localUrlValue}
                      onChange={e => {
                        const cleaned = e.target.value.replace(/^https?:\/\/(www\.)?/i, '');
                        setLocalUrlValue(cleaned);
                        const parts = parseUrlParts(e.target.value);
                        if (parts) {
                          setEditingUrlParts(parts);
                        }
                      }}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          domainInputRef.current?.focus();
                        }
                      }}
                      className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs truncate"
                    />
                  </td>
                </tr>
                {/* Only show Domain and Path fields if URL is parseable */}
                {editingUrlParts && (() => {
                  const parts = editingUrlParts;
                  return (
                    <>
                    <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                      <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Domain</td>
                      <td className="py-2 relative">
                        <HighlightedInput
                          ref={domainInputRef}
                          value={parts.domain}
                          onChange={(e: any) =>
                            setEditingUrlParts(prev => (prev ? { ...prev, domain: e.target.value } : prev))
                          }
                          onFocus={() => {
                            setFocusedField('domain');
                            setFocusedPathIndex(null);
                          }}
                          onBlur={(e: any) => {
                            if (e.relatedTarget === dropdownButtonRef.current) return;
                            setTimeout(() => setShowPathQueryDropdown(false), 150);
                          }}
                          onKeyDown={(e: any) => {
                            e.stopPropagation();
                            if (e.key === '@') {
                              e.preventDefault();
                              lastFocusedInputRef.current = e.currentTarget;
                              setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '@' } : prev));
                              setShowPathQueryDropdown(true);
                            } else if (showPathQueryDropdown) {
                              setShowPathQueryDropdown(false);
                            }
                          }}
                          className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                        />
                        {showPathQueryDropdown && focusedField === 'domain' && (
                          <div className="absolute left-0 top-full mt-1 w-56 bg-[#fdf6e3] dark:bg-neutral-900 rounded-lg border border-[#eee8d5] dark:border-neutral-700 shadow-lg z-[9999]">
                            <div className="px-3 py-1.5 text-[10px] text-[#93a1a1] dark:text-neutral-400 border-b border-[#eee8d5] dark:border-neutral-700">
                              Add Variable (Click to select)
                            </div>
                            <button
                              ref={dropdownButtonRef}
                              type="button"
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const newDomain = parts.domain.replace(
                                    /@$/,
                                    parts.domain.endsWith('/') ? '{query}' : '/{query}',
                                  );
                                  setEditingUrlParts(prev => (prev ? { ...prev, domain: newDomain } : prev));
                                  setShowPathQueryDropdown(false);
                                  lastFocusedInputRef.current?.focus();
                                } else if (e.key === 'Escape') {
                                  setShowPathQueryDropdown(false);
                                  lastFocusedInputRef.current?.focus();
                                }
                              }}
                              onClick={e => {
                                e.preventDefault();
                                const newDomain = parts.domain.replace(
                                  /@$/,
                                  parts.domain.endsWith('/') ? '{query}' : '/{query}',
                                );
                                setEditingUrlParts(prev => (prev ? { ...prev, domain: newDomain } : prev));
                                setShowPathQueryDropdown(false);
                                lastFocusedInputRef.current?.focus();
                              }}
                              className="w-full text-left px-3 py-2 text-xs bg-[#eee8d5] dark:bg-neutral-800 text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors focus:bg-[#eee8d5] dark:focus:bg-neutral-700 focus:outline-none">
                              Insert {'{query}'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {parts.paths.map((path, idx) => (
                      <tr key={idx} className="border-b border-[#eee8d5] dark:border-neutral-700">
                        <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Path {idx + 1}</td>
                        <td className="py-2 relative">
                          <HighlightedInput
                            value={path}
                            onChange={(e: any) => {
                              const newPaths = [...parts.paths];
                              newPaths[idx] = e.target.value;
                              setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                              if (showPathQueryDropdown) {
                                setShowPathQueryDropdown(false);
                              }
                            }}
                            onFocus={() => {
                              setFocusedField('path');
                              setFocusedPathIndex(idx);
                            }}
                            onBlur={(e: any) => {
                              if (e.relatedTarget === dropdownButtonRef.current) return;
                              setTimeout(() => setShowPathQueryDropdown(false), 150);
                            }}
                            onKeyDown={(e: any) => {
                              e.stopPropagation();
                              if (e.key === '@') {
                                e.preventDefault();
                                lastFocusedInputRef.current = e.currentTarget;
                                const newPaths = [...parts.paths];
                                newPaths[idx] = path + '@';
                                setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                setShowPathQueryDropdown(true);
                              } else if (showPathQueryDropdown) {
                                setShowPathQueryDropdown(false);
                              } else if (e.key === 'Enter' && !/{query}|\[query\]/i.test(path)) {
                                e.preventDefault();
                                const newPaths = [...parts.paths];
                                newPaths[idx] = path + '{query}';
                                setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                              }
                            }}
                            className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                          />
                          {showPathQueryDropdown && focusedPathIndex === idx && focusedField === 'path' && (
                            <div className="absolute left-0 top-full mt-1 w-56 bg-[#fdf6e3] dark:bg-neutral-900 rounded-lg border border-[#eee8d5] dark:border-neutral-700 shadow-lg z-[9999]">
                              <div className="px-3 py-1.5 text-[10px] text-[#93a1a1] dark:text-neutral-400 border-b border-[#eee8d5] dark:border-neutral-700">
                                Add Variable (Click to select)
                              </div>
                              <button
                                ref={dropdownButtonRef}
                                type="button"
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const newPaths = [...parts.paths];
                                    const suffix = path.endsWith('/') ? '{query}' : '/{query}';
                                    newPaths[idx] = path.replace(/@$/, suffix);
                                    setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                    setShowPathQueryDropdown(false);
                                    lastFocusedInputRef.current?.focus();
                                  } else if (e.key === 'Escape') {
                                    setShowPathQueryDropdown(false);
                                    lastFocusedInputRef.current?.focus();
                                  }
                                }}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  const newPaths = [...parts.paths];
                                  const suffix = path.endsWith('/') ? '{query}' : '/{query}';
                                  newPaths[idx] = path.replace(/@$/, suffix);
                                  setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                  setShowPathQueryDropdown(false);
                                  lastFocusedInputRef.current?.focus();
                                }}
                                className="w-full text-left px-3 py-2 text-xs bg-[#eee8d5] dark:bg-neutral-800 text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors focus:bg-[#eee8d5] dark:focus:bg-neutral-700 focus:outline-none">
                                Insert {'{query}'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                  );
                })()}
              </tbody>
            </table>
            <div className="flex justify-between items-center gap-2 mt-4">
              {editingUrlParts && (
                <button
                  type="button"
                  onClick={insertCustomVariable}
                  className="px-3 py-1 text-xs font-medium text-[#586e75] dark:text-neutral-300 bg-[#eee8d5] dark:bg-neutral-800 rounded-lg hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors">
                  {'{ }'} Insert Param{' '}
                  <span className="ml-1.5 px-1 rounded border border-[#eee8d5] dark:border-neutral-600 bg-[#fdf6e3] dark:bg-white/5 text-[9px] font-bold text-[#93a1a1] dark:text-neutral-400">
                    @
                  </span>
                </button>
              )}
              {!editingUrlParts && <div />}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeLinkEditPopup}
                  className="px-3 py-1 text-xs font-medium text-[#586e75] dark:text-neutral-300 bg-[#eee8d5] dark:bg-neutral-800 rounded-lg hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveLinkEditPopup}
                  className="px-3 py-1 text-xs font-medium text-white bg-neutral-600 rounded-lg hover:bg-neutral-700 transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {conflictModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
          <div className="bg-[var(--color-editorBg)] border border-black/10 dark:border-white/10 rounded-2xl p-6 shadow-2xl max-w-md w-full">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
              Sync Conflict Detected
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4 leading-relaxed">
              This tab group was modified on another device/window since you opened it. How would you like to resolve the conflict?
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleResolveConflictMerge}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all transform active:scale-95 flex items-center justify-center gap-2"
              >
                Merge Changes (Keep Both)
              </button>
              <button
                type="button"
                onClick={handleResolveConflictOverwrite}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-red-500/35 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all transform active:scale-95"
              >
                Overwrite Cloud (Keep Local)
              </button>
              <button
                type="button"
                onClick={handleResolveConflictDiscard}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-[var(--color-borderDefault)] bg-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all transform active:scale-95"
              >
                Reload Cloud Version (Discard Local)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Session Links Portal */}
      {portalTarget &&
        createPortal(
          <div className="flex flex-col gap-1.5 p-3 h-full overflow-y-auto custom-scrollbar">
            {selectedLinks.length > 0 ? (
              selectedLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 group relative"
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 rounded-md overflow-hidden bg-white/50 dark:bg-black/20 shadow-sm border border-black/5 dark:border-white/5 group-hover:scale-105 transition-transform">
                    {link.favIconUrl ? (
                      <img src={link.favIconUrl} className="w-3.5 h-3.5 object-contain" alt="" />
                    ) : (
                      <FaLink size={10} className="text-neutral-400 dark:text-neutral-500" />
                    )}
                  </div>
                  <span className="text-[12px] font-medium tracking-wide truncate flex-1 text-neutral-600 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                    {link.name || link.url}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                <FaLayerGroup size={24} className="text-neutral-400" />
                <span className="text-[11px] font-medium text-neutral-500">No links captured yet</span>
              </div>
            )}
          </div>,
          portalTarget!
        )}

    </>
  );
};

export default SessionEditorView;
