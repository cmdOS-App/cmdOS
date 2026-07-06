import { createTodo } from '../../todos/todoData';
import { useRelativeSavedTime } from '../../../../../shared-components/utils';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
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
import { FiStar, FiChevronLeft, FiChevronRight, FiTag } from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { formatDistanceToNow } from 'date-fns';
import { saveHotkey as apiSaveHotkey, clearHotkey as apiClearHotkey } from '../../../../../shared-components/hotkeys';
import { saveShortcut as apiSaveShortcut, clearShortcut as apiClearShortcut } from '../../../../../shared-components/shortcuts';
import { getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';

import { getFaviconUrl } from '../../../../../pages/AltS_search_newtab/src/components/searchSystemComponents/searchBarMain/utilityFunctions/utils';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { clsx } from 'clsx';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import { getUserId } from '../../../../../storage/_private/API/core/api';
import { deleteUserHotkeyByReference } from '../../../../../shared-components/hotkeys/core/hotkeyDbData';
import { deleteUserShortcutByReference } from '../../../../../shared-components/shortcuts/core/shortcutDbData';
import type { BrowserTab, SelectedLink, ContentTab } from '../linkTypes';
import { useChromeTabs } from './hooks/useChromeTabs';
import { HighlightedInput } from './components/HighlightedInput';
import { useLinkEditor } from '../useLinkEditor';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import type { SnippetRecord } from '../../../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import { nowUtc } from '../../../../../shared-components/utils';

interface LinkEditorViewProps {
  isOpen: boolean;
  onClose: () => void;
  link: any | null;
  prefill?: any | null;
  reload: () => void; // Kept for compatibility, though we use optimistic updates
}


const EMPTY_INITIAL_URLS: any[] = [];

const LinkEditorView: React.FC<LinkEditorViewProps> = ({
  isOpen,
  onClose,
  link: initialLinkProp,
  prefill,
  reload,
}) => {
  useEffect(() => {
    // Portal target for session sidebar removed
  }, []);

  const [localLinkOverride, setLocalLinkOverride] = useState<any | null>(null);
  const [isForceCreateNew, setIsForceCreateNew] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const hasUserModifiedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setLocalLinkOverride(null);
      setIsForceCreateNew(false);
      hasPrefilledEditModeRef.current = false;
      hasUserModifiedRef.current = false;
    } else {
      hasUserModifiedRef.current = false;
      if (!initialLinkProp) {
        
      }
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, initialLinkProp]);

  const initialLink = isForceCreateNew ? null : localLinkOverride || initialLinkProp;
  const linkId = initialLink?.id || (initialLink as any)?.snippet_id || null;
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const snippets = useDbStore(state => state.snippets);
  const automations = useDbStore(state => state.automations);

  // Legacy Redux team state removed - now using Dexie directly

  // const triggerNotification = useNotification(); // Removed toast usage

  // Legacy orgTeam logic removed

  const hasInitializedPrefill = useRef(false);
  const hasFetchedWorkspaces = useRef(false);



  const {
    linkTitle: title,
    setLinkTitle: setTitle,
    linkUrls: selectedLinks,
    setLinkUrls: setSelectedLinks,
    saveStatus,
    saveError,
    isDirty: hasUnsavedChanges,
    lastSavedAt,
    handleSave: executeSave,
    activeLinkId,
    liveLink,
    handlePropertiesChange,
    workspaceId,
    folderId,
    isLinkDeleted,
    conflictLink,
    resolveConflictWithRemote,
    keepLocalVersion,
  } = useLinkEditor({ linkId, initialDraftKey: prefill?.key, initialDraftUrls: EMPTY_INITIAL_URLS });

  // Determine mode based on whether a snippet is passed or has been saved
  const isEditMode = !!initialLink || !!activeLinkId;

  const compoundId = useMemo(() => {
    if (!activeLinkId) return '';
    return getItemCompoundId({
      id: activeLinkId,
      workspace_id: workspaceId,
      folder_id: folderId,
      snippet: { id: activeLinkId, category: 'link' }
    });
  }, [activeLinkId, workspaceId, folderId]);
  const { tabsByWindow, allTabs, currentWindowId, collapsedWindows, setCollapsedWindows, hasFetchedTabs, fetchTabs } = useChromeTabs(isOpen);
  const hasPrefilledEditModeRef = useRef(false);

  const lastSyncTimeRef = useRef<string | null>(null);
  const [conflictModalData, setConflictModalData] = useState<{
    cloudSnippet: any;
    localData: {
      title: string;
      selectedLinks: SelectedLink[];
    };
  } | null>(null);

  useEffect(() => {
    if (initialLink && initialLink.updated_at) {
      lastSyncTimeRef.current = initialLink.updated_at;
    }
  }, [initialLink]);

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






  const getBackupKey = useCallback(() => {
    const currentSnippetId = (initialLink as any)?.id || (initialLink as any)?.snippet_id;
    return currentSnippetId 
      ? `unsaved_session_backup_${currentSnippetId}` 
      : 'unsaved_session_backup_new';
  }, [initialLink]);

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
          // session logic removed
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
  const userId = 'local_user';
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
  // Session popup logic removed
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
      // Session click outside handler removed
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


  // Auto-select highlighted browser tabs when opening in create mode
  useEffect(() => {
    if (isOpen && !isEditMode && !prefill && !hasAutoSelectedRef.current && availableItems.length > 0) {
      const highlighted = availableItems.filter(
        item =>
          item.source === 'tab' && (item.originalData?.highlighted === true || item.originalData?.active === true),
      );
      if (highlighted.length > 0) {
        setSelectedLinks(highlighted);
        const activeTab = highlighted.find(h => h.originalData?.active === true) || highlighted[0];
      }
      hasAutoSelectedRef.current = true;
    }
    if (!isOpen) {
      hasAutoSelectedRef.current = false;
    }
  }, [isOpen, isEditMode, prefill, availableItems, isTitleManuallyModified]);

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

  const resolvedLocation = useMemo(() => {
    if (!isEditMode || !initialLink || (initialLink as any).workspace_id) return null;

    const snipId = initialLink.id || (initialLink as any).snippet_id;
    if (!snipId) return null;

    const match = snippets.find(
      (s: SnippetRecord) => String(s.id) === String(snipId) || String((s as any).snippet_id) === String(snipId),
    );
    if (!match) return null;

    return { workspace_id: match.workspaceId, folder_id: match.folderId ?? undefined };
  }, [isEditMode, initialLink, snippets]);

  const hasDestination = true;
  const needsDestinationSelection = false;

  const isDuplicateName = useCallback(
    (newName: string) => {
      // Duplicate checks in Redux are disabled as Dexie handles it natively
      return false;
    },
    [initialLink],
  );

  const isDuplicateTitle = useMemo(() => {
    return isDuplicateName(title);
  }, [title, isDuplicateName]);

  // Removed dead userId fetch effect

  // Sync Favorite, Hotkey and Shortcut state using unified utilities for 100% parity
  useEffect(() => {
    const syncData = async () => {
      if (!isOpen) return;

      if (!initialLink) {
        setPendingTodoData(null);
      }
    };

    syncData();
  }, [initialLink, isOpen]);


  const { toggleFavorite } = useFavorites();

  const toggleFavoriteLocal = async (item: any) => {
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
    if (initialLink) {
      toggleFavoriteLocal(initialLink);
    } else {
      
    }
  };

  const handleCreateTodoFromLink = async () => {
    // Cloud snippet-to-todo logic has been removed as it's dead code.
    setLinkTodoStatus('idle');
  };

  const handleHotkeyChange = async (newHotkey: string) => {
    

    if (initialLink?.id && !String(initialLink.id).startsWith('temp-')) {
      try {
        const folderId = (initialLink as any).folder_id;
        const workspaceId = (initialLink as any).workspace_id;
        const compoundId = `${folderId || workspaceId || propertiesRef.current?.workspaceId || ''}-${initialLink.id}`;
        
        if (!newHotkey) {
          await apiClearHotkey(initialLink.id, compoundId, 'link');
        } else {
          await apiSaveHotkey(initialLink.id, compoundId, newHotkey, 'link');
        }
        showFooterStatus('success', newHotkey ? 'Hotkey updated' : 'Hotkey cleared');
      } catch (error) {
        console.error('Failed to update hotkey:', error);
        showFooterStatus('error', 'Failed to update hotkey');
      }
    }
  };

  const handleShortcutChange = async (newShortcut: string) => {
    

    if (initialLink?.id && !String(initialLink.id).startsWith('temp-')) {
      try {
        const folderId = (initialLink as any).folder_id;
        const workspaceId = (initialLink as any).workspace_id;
        const compoundId = `${folderId || workspaceId || propertiesRef.current?.workspaceId || ''}-${initialLink.id}`;

        if (!newShortcut) {
          await apiClearShortcut(initialLink.id, compoundId, 'link');
        } else {
          await apiSaveShortcut(
            initialLink.id,
            compoundId,
            newShortcut,
            title.trim() || initialLink.key || '',
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

  // Prefill fields when editing an existing link/tabgroup
  useEffect(() => {
    const currentId = initialLink?.id || (initialLink as any)?.snippet_id;
    if (!isOpen || !isEditMode || !initialLink) return;
    if (hasPrefilledEditModeRef.current && lastPrefilledSnippetIdRef.current === currentId) return;
    
    hasPrefilledEditModeRef.current = true;
    lastPrefilledSnippetIdRef.current = currentId;
    try {
      setTitle(initialLink.title || initialLink.key || initialLink.name || '');
      
      if (initialLink.tags && initialLink.tags.length > 0) {
        
      } else if (initialLink.searchtags) {
        const rawTags = initialLink.searchtags;
        rawSearchTagsRef.current = rawTags;
        let firstTag = '';
        if (typeof rawTags === 'object' && rawTags !== null) {
          const myTags = (rawTags as Record<string, string[]>)[userId] || [];
          if (myTags.length > 0) firstTag = myTags[0];
        } else if (typeof rawTags === 'string') {
          firstTag = rawTags.split(',')[0].trim();
        }
        if (firstTag) {
          
        }
      } else {
        // Local storage backup fallback for searchtags
        const snipId = initialLink.id || (initialLink as any).snippet_id;
        if (snipId) {
          chrome.storage.local.get('alts_searchtags_backup', result => {
            const backup = result.alts_searchtags_backup || {};
            if (backup[snipId]) {
              const bTag = backup[snipId];
              let firstTag = '';
              if (typeof bTag === 'object' && bTag !== null) {
                const myTags = bTag[userId] || [];
                if (myTags.length > 0) firstTag = myTags[0];
              } else if (typeof bTag === 'string') {
                firstTag = bTag.split(',')[0].trim();
              }
              if (firstTag) {
                
              }
            }
          });
        }
      }
      
      const category = String(initialLink.category || initialLink.kind || "link").toLowerCase();

      const isGroup = category === 'link' || category === 'snippet' || category === 'tabgroup';

      if (isGroup) {
        // Handle new LinkRecord format directly
        if (initialLink.urls && Array.isArray(initialLink.urls)) {
          // Check if urls are string array or LinkItem array
          if (initialLink.urls.length > 0 && typeof initialLink.urls[0] === 'string') {
             setSelectedLinks(initialLink.urls.map((u: string) => ({
                url: u,
                title: '',
                id: (window as any).crypto?.randomUUID ? crypto.randomUUID() : `link-${Date.now()}`
             })));
          } else {
             setSelectedLinks(initialLink.urls);
          }
        } else {
          // Handle legacy snippet format (JSON value string)
          let urls: string[] = [];
          let names: string[] = [];
          if (typeof initialLink.value === 'string') {
            try {
              // Try explicit JSON parse first
              if (initialLink.value.trim().startsWith('{')) {
                const parsed = JSON.parse(initialLink.value);
                urls = Array.isArray((parsed as any)?.urls) ? (parsed as any).urls : [];
                names = Array.isArray((parsed as any)?.names) ? (parsed as any).names : [];
              } else {
                // Fallback for plain string that wasn't JSON
                urls = [initialLink.value];
              }
            } catch {
              // If parse fails
              if (initialLink.value) {
                urls = [initialLink.value];
                names = [initialLink.key || initialLink.title || initialLink.value];
              }
            }
          } else if (initialLink.value && typeof initialLink.value === 'object') {
            const val = initialLink.value as any;
            urls = Array.isArray(val?.urls) ? val.urls : [];
            names = Array.isArray(val?.names) ? val.names : [];
          }

          if (urls.length === 0 && initialLink.value && typeof initialLink.value === 'string') {
            // Ultimate fallback if parsing returned empty but we have a value
            urls = [initialLink.value];
            names = [initialLink.key || initialLink.title || initialLink.value];
          }

          setSelectedLinks(
            urls.map((u, idx) => {
              const isNote = u.startsWith('note:');
              return {
                url: u,
                title: names[idx] || (isNote ? 'Note snippet' : ''),
                name: names[idx] || (isNote ? 'Note snippet' : ''),
                id: (window as any).crypto?.randomUUID ? crypto.randomUUID() : `link-${Date.now()}-${idx}`
              };
            })
          );
        }
      } else {
        // Single link fallback for legacy non-group categories
        let urlVal = '';
        if (typeof initialLink.value === 'string') {
          if (initialLink.value.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(initialLink.value);
              urlVal = parsed.url || parsed.urls?.[0] || initialLink.value;
            } catch {
              urlVal = initialLink.value;
            }
          } else {
            urlVal = initialLink.value;
          }
        } else if (initialLink.urls && Array.isArray(initialLink.urls) && initialLink.urls.length > 0) {
          urlVal = typeof initialLink.urls[0] === 'string' ? initialLink.urls[0] : (initialLink.urls[0] as any).url || '';
        } else {
          urlVal = String((initialLink.value as any) || '');
        }

        setSelectedLinks([
          {
            id: `prefill-0`,
            url: urlVal,
            title: initialLink.title || initialLink.key || urlVal,
            name: initialLink.title || initialLink.key || urlVal,
          },
        ]);
      }
    } catch {
      // ignore prefill errors
    }
  }, [isOpen, isEditMode, initialLink, getHostname]);

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
    if (isOpen && activeContentTab === 'Current Tabs' && hasFetchedTabs && !hasAutoOpenedRef.current) {
      const hasTabs = Object.values(tabsByWindow).some(group => group.length > 0);
      if (!hasTabs) {
        setIsLeftCustomLinkFormOpen(true);
      }
      hasAutoOpenedRef.current = true;
    }
  }, [isOpen, activeContentTab, tabsByWindow, hasFetchedTabs]);

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

      // Links-only architecture: snippets in this view are link records.
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
  }, [isOpen, snippets, automations, tabsByWindow, currentWindowId]);

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
      setManualWorkspaceId(workspace.workspace_id);
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
      setManualWorkspaceId(workspace.workspace_id);
      setManualFolderId(folder.folder_id);
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
            source: 'tab' as const,
          },
        ];
      });
    },
    [getHostname, isTitleManuallyModified],
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
    },
    [isTitleManuallyModified],
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

    setCustomLinkUrl('');
    setCustomLinkName('');
    setTimeout(() => {
      customLinkUrlRef.current?.focus();
    }, 50);
  }, [customLinkName, customLinkUrl, getHostname]);

  const toggleWindowCollapse = useCallback((windowId: number) => {
    setCollapsedWindows(prev => ({
      ...prev,
      [windowId]: !prev[windowId],
    }));
  }, []);



  const handleSave = useCallback(
    async (isAutoSave: boolean = false, overrideLinks?: SelectedLink[], overrideTitle?: string) => {
      if (overrideTitle !== undefined) setTitle(overrideTitle);
      if (overrideLinks !== undefined) setSelectedLinks(overrideLinks);

      const saved = await executeSave(isAutoSave);
      if (saved && !isAutoSave) {
        setTimeout(() => onClose(), 1500);
      }
    }, [executeSave, setTitle, setSelectedLinks, onClose]);

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
  }, [hasUnsavedChanges, getBackupKey, title, selectedLinks, teamId]);

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
    setLocalLinkOverride(null);
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
    // Explicitly force a final save before closing.
    await handleSave(false);
    
    onClose();
  }, [handleSave, onClose]);

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
        innerClassName="flex flex-col gap-1 w-[800px] max-w-full flex-shrink h-full min-w-[350px] relative min-h-[450px]"
      >
          <div className={clsx(
            "flex-1 flex flex-col text-[#073642] dark:text-neutral-200 relative bg-transparent dark:bg-transparent border-none min-h-[450px]",
            (isLeftCustomLinkFormOpen && linkSuggestions.length > 0) ? "overflow-visible" : "overflow-hidden"
          )}>
            
            {/* Link Deleted Banner */}
            {isLinkDeleted && (
              <div className="w-full flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-800/50 flex items-center justify-center text-red-600 dark:text-red-400">
                    <FaTrash size={14} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">This link collection was deleted</h3>
                    <p className="text-xs text-red-600 dark:text-red-400/80">
                      Another tab or user deleted this link collection. You can copy your links below or create a new collection.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Conflict Banner */}
            {saveStatus === 'conflict' && conflictLink && (
              <div className="w-full flex flex-col gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Conflict Detected</h3>
                    <p className="text-xs text-amber-600 dark:text-amber-400/80">
                      This link collection was modified in another tab. Merging failed because you both edited the same fields.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 ml-11">
                  <button
                    onClick={resolveConflictWithRemote}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-200 dark:bg-amber-700/50 text-amber-800 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-600/50 transition-colors"
                  >
                    Discard mine, use latest
                  </button>
                  <button
                    onClick={keepLocalVersion}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-white dark:bg-neutral-800 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 hover:bg-amber-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Keep mine & overwrite
                  </button>
                </div>
              </div>
            )}
            
            {/* Loading Overlay */}
            {activeLinkId && !liveLink && !isLinkDeleted && (
               <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                 <div className="flex flex-col items-center gap-3">
                   <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                   <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Loading collection...</div>
                 </div>
               </div>
            )}

            {/* Main Content Area (Centered) */}
            <div className="w-full flex flex-col items-stretch justify-start flex-shrink-0">
              <div className="w-full flex items-center py-2.5 px-2 border-b border-white/50 dark:border-white/10">
                {/* Title Input - Left */}
                <div className="flex items-center flex-1 min-w-0 relative">
                  {!title && <span className="text-red-500/50 text-xl font-bold select-none shrink-0 ml-2">*</span>}
                  <input
                    ref={titleInputRef}
                    value={title}
                    onChange={event => {
                      setTitle(event.target.value);
                      setIsTitleManuallyModified(true);
                      hasUserModifiedRef.current = true;
                    }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowRight') {
                        if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
                          e.preventDefault();
                          closeButtonRef.current?.focus();
                        }
                      }
                    }}
                    placeholder="Collection Title"
                    className="flex-1 text-2xl font-semibold text-[#073642] dark:text-neutral-200 placeholder-[var(--color-textPlaceholder)] bg-transparent outline-none border-none transition-all min-w-0 pl-1"
                  />

                  {saveStatus === 'error' && saveError && (
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-[#ef4444]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      {saveError}
                    </span>
                  )}
                </div>

                {/* Auto-save indicator */}
                {!saveError && (
                  <div className="flex items-center gap-1 ml-2 transition-opacity duration-300">
                    {(isEditMode || title.trim().length > 0) && (
                      <>
                        {saveStatus === 'saving' && (
                          <span className="text-sm font-medium text-[#93a1a1] dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap">
                            Saving...
                          </span>
                        )}

                        {saveStatus === 'saved' && (
                          <span className="text-sm font-medium text-[#93a1a1] dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap">
                            {lastSavedMessage} <FaCheckCircle className="opacity-70 text-xs text-emerald-500" />
                          </span>
                        )}

                        {saveStatus === 'conflict' && (
                          <span className="text-sm font-medium text-amber-600 dark:text-amber-500 flex items-center gap-1 whitespace-nowrap">
                            Conflict
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
            <div className="w-full flex-1 flex min-h-0 items-stretch">
              {/* MAIN LIST: Content Bar Source */}
              <div className="w-full flex-1 flex flex-col min-w-0 relative">
                {/* List */}
                <div
                  ref={listContainerRef}
                  className={clsx(
                    "flex-1 min-h-0 bg-transparent w-full max-h-[min(480px,calc(100vh-280px))]",
                    (isLeftCustomLinkFormOpen && linkSuggestions.length > 0)
                      ? "overflow-visible"
                      : "overflow-y-auto custom-scrollbar"
                  )}>
                  <div className="flex flex-col w-full px-3 mt-2 pb-8">
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

                            <div className="flex-1 min-w-0 flex items-baseline gap-2">
                              <div
                                className={`text-[13.5px] font-normal tracking-tight truncate flex-shrink-0 max-w-[65%] ${
                                  isAdded
                                    ? 'text-white'
                                    : 'text-[#F5F5F5]'
                                }`}
                                style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
                                {item.name}
                              </div>
                              <div
                                className={clsx(
                                  'text-[10.5px] font-normal truncate flex-1 min-w-0 transition-opacity duration-200',
                                  focusedTabIndex === globalIdx ? 'opacity-100' : 'opacity-40 group-hover:opacity-100',
                                  'text-neutral-400',
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
                                           openLinkEditPopup(item);
                                         }}
                                         className="flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-800 hover:text-[#073642] dark:hover:text-white"
                                       >
                                         <FaLink size={10} className="opacity-70" />
                                         <span>Params</span>
                                       </button>
                                       <button
                                         type="button"
                                         onClick={e => {
                                           e.stopPropagation();
                                           e.preventDefault();
                                           setActiveMenuLinkId(null);
                                           duplicateLink(item);
                                         }}
                                         className="flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-800 hover:text-[#073642] dark:hover:text-white"
                                       >
                                         <FaCopy size={10} className="opacity-70" />
                                         <span>Duplicate</span>
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
                        <div className="flex flex-col gap-2">
                          {/* Selected Section */}
                          {(renderedSelected.length > 0 || (activeContentTab === 'Current Tabs' && isLeftCustomLinkFormOpen)) && (
                            <div className="flex flex-col">
                              <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-500 tracking-wider text-left bg-transparent pt-1 pb-1.5 flex items-center mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span>Selected tabs</span>
                                  {renderedSelected.length > 0 && (
                                    <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500">
                                      ({renderedSelected.length})
                                    </span>
                                  )}
                                </div>
                              </h3>
                              
                              <div className={clsx(
                                "flex flex-col border border-[#eee8d5] dark:border-white/10 rounded-xl divide-y divide-[#eee8d5] dark:divide-white/10 bg-[#fdf6e3]/10 dark:bg-white/[0.02]",
                                (!isLeftCustomLinkFormOpen && activeContentTab === 'Current Tabs' && renderedSelected.length > 0) ? "mb-2" : "mb-3"
                              )}>
                                {/* Selected Items */}
                                {renderedSelected.length > 0 && (
                                  renderedSelected.map((wrap, idx) => renderItem(wrap.item, wrap.isAdded, idx, idx))
                                )}

                                {/* Custom link form appended inside the card wrapper when input form is open */}
                                {activeContentTab === 'Current Tabs' && isLeftCustomLinkFormOpen && (
                                  <div
                                    ref={el => {
                                      tabItemRefs.current[allRenderedItems.length] = el as any;
                                    }}
                                    className="flex items-center gap-3 py-2 px-3 transition-all focus:outline-none bg-transparent relative z-50 last:rounded-b-xl">
                                    
                                    {/* Inline Text Input */}
                                    <div className="flex-1 min-w-0 flex items-center gap-1.5 justify-start">
                                      {(renderedSelected.length === 0 && !customLinkUrl) && (
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
                                              setLinkSuggestions([]);
                                              setTimeout(() => {
                                                customLinkUrlRef.current?.focus();
                                              }, 50);
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
                                        placeholder="Add a link URL..."
                                        autoFocus
                                        className="w-full bg-transparent border-none text-[13.5px] font-normal text-[#073642] dark:text-neutral-100 placeholder-[var(--color-textPlaceholder)]/50 focus:outline-none h-6"
                                        style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
                                      />
                                      {linkSuggestions.length > 0 && (
                                        <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-[#1C1C1E] border border-[#eee8d5] dark:border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[99] overflow-hidden max-h-[250px] flex flex-col">
                                          <div className="px-3 py-1.5 text-[10px] font-bold text-[#93a1a1] dark:text-neutral-500  tracking-wider bg-[#fdf6e3]/50 dark:bg-black/20 border-b border-[#eee8d5] dark:border-white/5">
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
                                                  setLinkSuggestions([]);
                                                  setTimeout(() => {
                                                    customLinkUrlRef.current?.focus();
                                                  }, 50);
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
                                )}
                              </div>

                              {!isLeftCustomLinkFormOpen && activeContentTab === 'Current Tabs' && renderedSelected.length > 0 && (
                                <div className="flex justify-center w-full mb-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsLeftCustomLinkFormOpen(true);
                                      setCustomLinkUrl('');
                                    }}
                                    className="p-2 rounded-full border border-[var(--color-borderDefault)] hover:bg-[#eee8d5] dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors flex items-center justify-center"
                                    title="Add Custom Link"
                                  >
                                    <FaPlus size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Active Tabs Section */}
                          {renderedActive.length > 0 && (
                            <div className="flex flex-col">
                              <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-500 tracking-wider text-left bg-transparent pt-1 pb-1.5 flex items-center mb-1">
                                <span>{activeContentTab === 'All saved files' ? 'Saved files' : 'Current tabs'}</span>
                                <span className="ml-1 text-xs font-bold text-neutral-400 dark:text-neutral-500">
                                  ({renderedActive.length})
                                </span>
                              </h3>
                              <div className="flex flex-col border border-[#eee8d5] dark:border-white/10 rounded-xl overflow-hidden divide-y divide-[#eee8d5] dark:divide-white/10 bg-[#fdf6e3]/10 dark:bg-white/[0.02]">
                                {renderedActive.map((wrap, idx) => renderItem(wrap.item, wrap.isAdded, idx, renderedSelected.length + idx))}
                              </div>
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
                              <button
                                type="button"
                                onClick={() => {
                                  setIsLeftCustomLinkFormOpen(true);
                                  setCustomLinkUrl('');
                                }}
                                className="px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-white/10 transition-all active:scale-95"
                              >
                                Add a custom link
                              </button>
                            </div>
                          )}
                        </div>
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
            {isEditMode && !hasUnsavedChanges && (
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
          <div className="absolute left-full top-1/2 -translate-y-1/2 z-50 select-none flex flex-col items-center gap-1 p-1 rounded-r-2xl rounded-l-none bg-[var(--color-editorBg)] border border-l-0 border-black/10 dark:border-white/15 shadow-lg">
              <SharedPropertiesToolbar
                initialSnippet={liveLink || initialLinkProp || { workspaceId, folderId }}
                compoundId={compoundId}
                defaultName={title || 'New Link List'}
                onChange={handlePropertiesChange}
                showTodo={true}
                onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
                  if (!activeLinkId) return;
                  const scheduleTime = deadlineVal ? new Date(deadlineVal).getTime() : Date.now();
                  try {
                    const newTodo = await createTodo(
                      title || 'New Link List',
                      [{ type: 'link', id: activeLinkId }],
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
                    console.error('Failed to create and schedule link todo', err);
                  }
                }}
                saveStatus={saveStatus}
                orgTeam={null}
                personalWorkspaces={[]}
                openPopupsToLeft={true}
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
                          setLinkTodoStatus('idle');
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
              This session was modified on another device/window since you opened it. How would you like to resolve the conflict?
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
      {/* Legacy Session Links Portal Removed */}

    </>
  );
};

export default LinkEditorView;
