import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useUIStore } from '../uiStateManager';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTerminal,
  FaFlag,
  FaLink,
  FaHistory,
  FaBookmark,
  FaRobot,
  FaSearch,
  FaGlobe,
  FaLayerGroup,
  FaFolder,
  FaFolderOpen,
  FaClock,
  FaCode,
  FaPlus,
  FaCheckCircle,
  FaRegCircle,
  FaCamera,
  FaExpand,
  FaImages,
  FaTable,
} from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { FiX } from 'react-icons/fi';
import { isSameDay, format } from 'date-fns';
import { resolveEntityById } from '../utils/entityResolver';
import { isLocalEntityId } from '../utils';
import NotesIcon from '../icons/notesIcon';
import type { SuggestionState, SuggestionListItem } from '../../pages/AltS_search_newtab/src/components/searchSystemComponents/searchBarMain/userInterfaceComponents/searchBar';
import { getFaviconUrl } from '../../pages/AltS_search_newtab/src/components/searchSystemComponents/searchBarMain/utilityFunctions/utils';
import { PAGE_ACTION_ITEMS } from '../../pages/AltS_search_websites/src/commands/pageActions';


import { useDbStore } from '../../storage/store/useDbStore';


import { UnifiedContextMenu } from '../ui/UnifiedContextMenu';
import { useKeystrokeRecording } from '../hotkeys';
import {
  getItemCompoundId,
  extractSnippetIdFromCompoundId,
} from '../hotkeys/utils/hotkeyUtils';

import { saveUserHotkey, deleteUserHotkeyByReference } from '../hotkeys/core/hotkeyDbData';
import { saveUserShortcut, deleteUserShortcutByReference } from '../shortcuts/core/shortcutDbData';
import { updateTodo } from '../../allObjectFolder/src/createObject/todos/todoData';
import { deleteAiPrompt } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { deleteSession } from '../../allObjectFolder/src/createObject/session/sessionData';
import { useFavorites } from '../favorites';
import { db } from '../../storage/indexDB/dbConfig';
import { isCommandId } from '../commands';

import { FiPlay, FiExternalLink, FiEdit2, FiTrash2, FiStar, FiZap } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import { BsKeyboard, BsCalendarCheck } from 'react-icons/bs';
import { MdOutlineShortcut } from 'react-icons/md';
import { saveShortcut as apiSaveShortcut } from '../shortcuts';

// Helper for query highlighting
const highlightMatch = (text: string, query: string) => {
  if (!text || !query) return text;
  const lowerText = String(text || "").toLowerCase();
  const lowerQuery = String(query || "").toLowerCase();
  const startIndex = lowerText.indexOf(lowerQuery);
  if (startIndex === -1) return text;
  const endIndex = startIndex + query.length;
  return (
    <>
      {text.substring(0, startIndex)}
      <span className="font-semibold text-neutral-900 dark:text-white">{text.substring(startIndex, endIndex)}</span>
      {text.substring(endIndex)}
    </>
  );
};

// ─── Slash Category Launcher (mirrors AltQ's @alias system) ──────────────────

/** Alias map: slash-alias (uppercase) → board group key */
const SLASH_SECTION_ALIASES: Record<string, string> = {
  A: 'all',
  T: 'todos',
  N: 'notes',
  S: 'snippets',
  L: 'links',
  SE: 'sessions',
  C: 'commands',
  B: 'bookmarks',
  AU: 'automations',
  CA: 'chat_agents',
};

/** Reverse map: group key → alias display string */
const SLASH_ALIAS_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SLASH_SECTION_ALIASES).map(([alias, section]) => [section, alias]),
);

const focusSearchbarInput = () => {
  const inputEl = document.getElementById('searchbar-input');
  if (inputEl) {
    inputEl.focus();
    try {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(inputEl);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch (e) {
      console.error('[BoardView] Failed to set cursor position:', e);
    }
  }
};

const getTodoDueLabel = (item: any): string => {
  if (!item.event_deadline) {
    if (item.is_anytime) return 'Anytime';
    return '';
  }

  const d = new Date(item.event_deadline.replace(' ', 'T'));
  if (isNaN(d.getTime())) {
    if (item.is_anytime) return 'Anytime';
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const isOverdue = !item.is_done && d.getTime() < now.getTime() && (dDate.getTime() < startOfToday.getTime() || (item.event_deadline && item.event_deadline.includes(':')));

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let dateStr = '';

  if (dDate.getTime() === startOfToday.getTime()) {
    dateStr = 'Today';
  } else if (dDate.getTime() === startOfTomorrow.getTime()) {
    dateStr = 'Tomorrow';
  } else if (d.getFullYear() >= 2035) {
    dateStr = 'Anytime';
  } else {
    dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const isRecurring = !!(item.is_recurring || item.recurring);
  const recurLabel = isRecurring ? ' • Recurring' : '';

  if (isOverdue) {
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHrs = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    let overdueText = '';
    if (diffMins < 60) overdueText = `${diffMins}m overdue`;
    else if (diffHrs < 24) overdueText = `${diffHrs}h overdue`;
    else overdueText = `${diffDays}d overdue`;

    return `${dateStr}, ${timeStr} (${overdueText})${recurLabel}`;
  }

  if (dateStr === 'Anytime') return `Anytime${recurLabel}`;
  return `${dateStr}, ${timeStr}${recurLabel}`;
};

interface SlashMode {
  slashDropdown: boolean; // show the category picker
  activeSection: string | null; // matched section key, or null
  searchQuery: string; // text after the alias for within-category filtering
}

/**
 * Parse a board search value that starts with '/'.
 * Matches only when the alias is followed by a space, allowing partial inputs to filter the dropdown.
 */
function parseSlashMode(value: string): SlashMode {
  const normalizedValue = value.replace(/\u00A0/g, ' ');
  if (!normalizedValue.startsWith('/')) {
    return { slashDropdown: false, activeSection: null, searchQuery: normalizedValue };
  }

  const textAfterSlash = normalizedValue.slice(1);

  // Find the longest matching alias
  let bestAlias = '';
  let activeSection: string | null = null;

  for (const [alias, section] of Object.entries(SLASH_SECTION_ALIASES)) {
    const upperText = textAfterSlash.toUpperCase();
    const upperAlias = alias.toUpperCase();

    // Active if matches exactly followed by a space
    const matchWithSpace = upperText.startsWith(upperAlias + ' ');

    if (matchWithSpace) {
      if (alias.length > bestAlias.length) {
        bestAlias = alias;
        activeSection = section;
      }
    }
  }

  if (activeSection) {
    let query = textAfterSlash.slice(bestAlias.length);
    if (query.startsWith(' ')) query = query.slice(1);
    return { slashDropdown: false, activeSection, searchQuery: query };
  }

  // No match → show the dropdown picker
  return { slashDropdown: true, activeSection: null, searchQuery: '' };
}

/** Metadata (icon + label) for each board group shown in the slash picker */
const SLASH_SECTION_META: Record<string, { title: string; icon: React.ReactNode }> = {
  all: {
    title: 'All',
    icon: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  todos: { title: 'Todos', icon: <BsCalendarCheck size={16} className="text-[var(--color-iconDefault)]" /> },
  notes: { title: 'Notes', icon: <NotesIcon className="w-4 h-4 shrink-0 text-amber-400" /> },
  snippets: { title: 'Snippets', icon: <FaCode size={16} className="text-[var(--color-iconDefault)]" /> },
  links: { title: 'Links', icon: <FaLink size={16} className="text-blue-400" /> },
  chat_agents: { title: 'Chat Agents', icon: <FaRobot size={16} className="text-indigo-400" /> },
  sessions: { title: 'Tab groups', icon: <FaLayerGroup size={16} className="text-purple-400" /> },
  commands: { title: 'Commands', icon: <FaTerminal size={16} className="text-[var(--color-iconDefault)]" /> },
  bookmarks: { title: 'Bookmarks', icon: <FaBookmark size={16} className="text-[var(--color-iconDefault)]" /> },
  automations: { title: 'Automations', icon: <FiZap size={16} className="text-amber-400" /> },
};
// ─────────────────────────────────────────────────────────────────────────────

interface BoardViewProps {
  state?: SuggestionState | null;
  searchValue?: string;
  unfilteredSuggestions?: SuggestionListItem[];
  onClose?: () => void;
  isLoggedIn?: boolean;
  extraGroups?: {
    title: string;
    items: SuggestionListItem[];
    icon: React.ReactNode;
  }[];
  onExecuteItem?: (item: any, e?: React.MouseEvent | KeyboardEvent) => boolean | void;
  hideCloseButton?: boolean;
  isEmbedded?: boolean;
  includeWebsitePageActions?: boolean;
}

const BoardView: React.FC<BoardViewProps> = ({
  state,
  searchValue = '',
  unfilteredSuggestions = [],
  onClose,
  isLoggedIn,
  extraGroups = [],
  onExecuteItem,
  hideCloseButton = false,
  isEmbedded = false,
  includeWebsitePageActions = false,
}) => {
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  const [selectedSidebarSection, setSelectedSidebarSection] = useState<string>('all');
  const [slashDropdownSelectedIndex, setSlashDropdownSelectedIndex] = useState(-1);
  const dbNotes = useDbStore(state => state.notes);
  const dbLinks = useDbStore(state => state.links);
  const dbSnippets = useDbStore(state => state.snippets);
  const dbSessions = useDbStore(state => state.sessions);
  const dbWorkspaces = useDbStore(state => state.workspaces);
  const dbFolders = useDbStore(state => state.folders);
  const dbAutomations = useDbStore(state => state.automations);
  const dbChatAgents = useDbStore(state => state.chatAgents);
  const dbAiPrompts = useDbStore(state => state.aiPrompts);
  const expandedWorkspaces = useUIStore(state => state.expandedWorkspaces);
  const commands = useDbStore(state => state.commands);

  // defaultWorkspaceId has been removed as it relied on the old architecture and is now dead code.

  const rawSearchValue = searchValue || state?.value || '';
  const prevSearchValueRef = useRef(rawSearchValue);
  const isSlashSelectedRef = useRef(false);
  const slashMode = useMemo(() => parseSlashMode(rawSearchValue), [rawSearchValue]);

  const effectiveSidebarSection = slashMode.slashDropdown
    ? 'all'
    : slashMode.activeSection && slashMode.activeSection !== 'all'
      ? slashMode.activeSection
      : selectedSidebarSection;

  // Favorites, hotkeys and shortcuts state

  const [userId, setUserId] = useState('');
  const hotkeysMap = useDbStore(state => state.hotkeysMap);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);

  const [todosList, setTodosList] = useState<any[]>([]);
  const [chromeBookmarks, setChromeBookmarks] = useState<any[]>([]);

  const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; item: any } | null>(null);
  const [editingHotkeyFor, setEditingHotkeyFor] = useState<string | null>(null);
  const [editingShortcutFor, setEditingShortcutFor] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUpdatingHotkey, setIsUpdatingHotkey] = useState<boolean>(false);
  const [isUpdatingShortcut, setIsUpdatingShortcut] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);

  const isMac = typeof navigator !== 'undefined' && (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac'));
  const todoCreatePrefill = useUIStore(state => state.activeEditor?.type === 'todo' ? state.activeEditor.props?.prefill : null);
  const { captureHotkey } = useKeystrokeRecording(editValue, isMac);

  const handleCancelEdit = () => {
    setEditingShortcutFor(null);
    setEditingHotkeyFor(null);
    setEditValue('');
    setSaveError(null);
    setConflictId(null);
  };

  useEffect(() => {
    const getUser = async () => {
      try {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.get(['user_id'], (result: any) => {
            setUserId(result?.user_id || 'local_user');
          });
        } else {
          setUserId('local_user');
        }
      } catch {
        setUserId('local_user');
      }
    };
    getUser();

    const flattenBookmarks = (nodes: any[], result: any[] = []) => {
      nodes.forEach(node => {
        if (node.url) {
          result.push({
            id: `bookmark-${node.id}`,
            _kind: 'bookmark',
            type: 'bookmark',
            title: node.title,
            url: node.url,
          });
        }
        if (node.children) {
          flattenBookmarks(node.children, result);
        }
      });
      return result;
    };

    const loadBookmarks = () => {
      const chromeAny = (window as any)?.chrome;
      chromeAny?.bookmarks?.getTree?.((tree: any) => {
        const flattened = flattenBookmarks(tree);
        setChromeBookmarks(flattened);
      });
    };

    const chromeAny = (window as any)?.chrome;
    loadBookmarks();

    if (chromeAny?.bookmarks?.onRemoved) {
      chromeAny.bookmarks.onRemoved.addListener(loadBookmarks);
      chromeAny.bookmarks.onCreated.addListener(loadBookmarks);
      chromeAny.bookmarks.onChanged.addListener(loadBookmarks);
    }

    const deduplicateAndSetTodos = (localTodos: any[], cachedTodos: any[]) => {

      const normalizeId = (t: any): string => {
        const raw = t.snippet_id || t.id || t.todo_id;
        if (raw !== undefined && raw !== null && String(raw) !== 'undefined') {
          return String(raw);
        }
        // Fallback: use key + deadline to create a synthetic id
        return `local-${t.key || t.title || ''}-${t.event_deadline || ''}`.replace(/\s+/g, '_');
      };
      const mappedLocal = localTodos.map((t: any) => ({
        ...t,
        snippet_id: normalizeId(t),
        is_recurring: !!(t.is_recurring || (t as any).recurring),
      }));
      const mappedCached = cachedTodos.map((t: any) => ({
        ...t,
        snippet_id: normalizeId(t),
        is_recurring: !!(t.is_recurring || (t as any).recurring),
      }));
      // local_todos takes priority: build map from local first, then add cached if not already present
      const finalMap = new Map<string, any>();
      mappedLocal.forEach(t => finalMap.set(t.snippet_id, t));
      mappedCached.forEach(t => {
        if (!finalMap.has(t.snippet_id)) {
          finalMap.set(t.snippet_id, t);
        }
      });
      const unique = Array.from(finalMap.values());

      setTodosList(unique);
    };

    if (chromeAny?.storage?.local) {
      // Use IndexedDB (via fetchCloudTodos) as the single source of truth for todos.
      // DO NOT read from chrome.storage.local cached_todos — those may be stale and will
      // re-populate deleted todos if used.
      fetchCloudTodosRef.current?.();

      const handleChange = (changes: any, areaName: string) => {
        if (areaName === 'local') {
          // Only reload bookmarks from storage changes, not todos.
          // Todos are managed exclusively via IndexedDB + todosUpdated event.
        }
      };

      const handleTodosUpdated = () => {
        fetchCloudTodosRef.current?.();
      };

      chromeAny.storage.onChanged.addListener(handleChange);
      window.addEventListener('todosUpdated', handleTodosUpdated);

      return () => {
        chromeAny.storage.onChanged.removeListener(handleChange);
        window.removeEventListener('todosUpdated', handleTodosUpdated);
        if (chromeAny?.bookmarks?.onRemoved) {
          chromeAny.bookmarks.onRemoved.removeListener(loadBookmarks);
          chromeAny.bookmarks.onCreated.removeListener(loadBookmarks);
          chromeAny.bookmarks.onChanged.removeListener(loadBookmarks);
        }
      };
    }
    return undefined;
  }, []);

  const convertibleItems = useMemo(() => {
    const items: any[] = [];

    // 1. Notes, Links, Snippets, Sessions from IndexedDB
    dbNotes.forEach((n: any) => items.push({ id: n.id, name: n.title || n.key, category: 'note', data: n }));
    dbLinks.forEach((l: any) => items.push({ id: l.id, name: l.title || l.key, category: 'link', _kind: 'link', data: l }));
    dbSnippets.forEach((s: any) => items.push({ id: s.id, name: s.title || s.key, category: 'snippet', data: s }));
    dbSessions.forEach((s: any) => items.push({ id: s.id, name: s.title || s.key, category: 'session', _kind: 'session', data: s }));

    // 2. Flat Dexie collections for workspaces, folders, automations, and agents
    dbWorkspaces.forEach((workspace: any) => {
      items.push({
        id: workspace.id || workspace.workspace_id,
        name: workspace.name || workspace.workspace_name || 'Workspace',
        category: 'workspace',
        data: workspace,
      });
    });

    dbFolders.forEach((folder: any) => {
      items.push({
        id: folder.id || folder.folder_id,
        name: folder.name || folder.folder_name || 'Folder',
        category: 'folder',
        data: folder,
      });
    });

    dbAutomations.forEach((auto: any) => {
      items.push({
        id: auto.id || auto.automation_id,
        name: auto.name || auto.title || 'Automation',
        category: 'automation',
        data: auto,
      });
    });

    dbChatAgents.forEach((agent: any) => {
      items.push({
        id: agent.id || agent.agent_id || agent.chat_agent_id,
        name: agent.name || agent.title || 'Agent',
        category: 'agent',
        data: agent,
      });
    });

    dbAiPrompts.forEach((prompt: any) => {
      items.push({
        id: prompt.id,
        name: prompt.title || 'Chat Agent',
        category: 'aiPrompt',
        data: prompt,
      });
    });

    // 2. Commands
    commands.forEach(cmd => {
      items.push({
        id: `cmd-${cmd.id}`,
        name: cmd.label,
        category: 'command',
        data: { ...cmd, key: cmd.label, value: cmd.id },
      });
    });

    // 3. Local Commands
    return items;
  }, [dbNotes, dbLinks, dbSnippets, dbWorkspaces, dbFolders, dbAutomations, dbChatAgents, dbAiPrompts, commands]);

  const [asyncItems, setAsyncItems] = useState<any[]>([]);
  useEffect(() => {
    const loadModules = async () => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.storage?.local) return;
      const storage: any = await new Promise(resolve => chromeAny.storage.local.get(['installed_modules'], resolve));
      const localModules = storage.installed_modules || [];

      const mapModules = (modules: any[]) =>
        modules.map((m: any) => ({
          id: `mod-${m.id || m.installation_id || m.module_id || m.installationId}`,
          name: m.name || m.module_name || m.label || 'Untitled Module',
          category: 'module',
          data: m,
        }));

      if (Array.isArray(localModules) && localModules.length > 0) {
        setAsyncItems(mapModules(localModules));
      }
    };

    loadModules();

    const listener = (changes: any) => {
      if (changes.installed_modules) {
        loadModules();
      }
    };
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.onChanged) {
      chromeAny.storage.onChanged.addListener(listener);
      return () => chromeAny.storage.onChanged.removeListener(listener);
    }
    return undefined;
  }, []);

  const finalConvertibleItems = useMemo(() => {
    return [...convertibleItems, ...asyncItems];
  }, [convertibleItems, asyncItems]);

  const fetchCloudTodosRef = useRef<any>(null);

  const fetchCloudTodos = useCallback(async (_forceCloud = false) => {
    // Todos are now read from IndexedDB only
    try {
      const allTodos = await db.todos.toArray();
      const mapped = allTodos.map(t => ({
        ...t,
        _kind: 'todo',
        type: 'todo',
        snippet_id: t.id,
        todo_id: t.id,
        key: t.name,
        title: t.name,
        is_done: t.isDone,
        is_todo_type: true,
        is_recurring: !!(t.recurringType),
        event_deadline: t.scheduleTime ? new Date(t.scheduleTime).toISOString() : null,
      }));
      setTodosList(mapped);
    } catch (err) {
      console.error('[BoardView] Failed to load todos from IndexedDB:', err);
    }
  }, []);

  useEffect(() => {
    fetchCloudTodosRef.current = fetchCloudTodos;
  }, [fetchCloudTodos]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchCloudTodos(false);
    }
  }, [isLoggedIn, fetchCloudTodos]);

  const { favorites: userFavorites } = useFavorites();
  const favoriteIdSet = useMemo(() => {
    const set = new Set<string>();
    userFavorites.forEach(fav => {
      set.add(String(fav.reference_id));
      const rawId = extractSnippetIdFromCompoundId(fav.reference_id);
      if (rawId) set.add(rawId);
    });
    return set;
  }, [userFavorites]);

  const saveHotkey = async (item: any, hotkeyValue: string, shouldClose = true) => {
    const itemId = getItemCompoundId(item);
    useUIStore.getState().setCommandStatus({
      status: 'loading',
      message: !hotkeyValue ? 'Clearing...' : isUpdatingHotkey ? 'Updating...' : 'Saving...',
    });
    setIsSaving(true);

    try {
      if (!hotkeyValue) {
        await deleteUserHotkeyByReference(itemId);
      } else {
        const kind = item._kind || item.type;
        const type = kind === 'command' ? 'command' : String(item.snippet?.category || '').toLowerCase() === 'link' ? 'link' : 'note';
        await saveUserHotkey(hotkeyValue, itemId, type as any);
      }

      useUIStore.getState().setCommandStatus({ status: 'success', message: !hotkeyValue ? 'Cleared' : 'Saved' });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
    } catch (error: any) {
      console.error('[BoardView] Failed to save/clear hotkey:', error);
      useUIStore.getState().setCommandStatus({ status: 'error', message: error.message || 'Failed to update hotkey' });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
    } finally {
      setIsSaving(false);
      if (shouldClose) {
        setEditingHotkeyFor(null);
        setEditValue('');
        setSaveError(null);
      } else {
        setEditValue(hotkeyValue);
        setSaveError(null);
      }
    }
  };

  const saveShortcut = async (item: any, shortcutValue: string) => {
    const itemId = getItemCompoundId(item);
    let normalized = String(shortcutValue || "").trim().toLowerCase();
    if (normalized && !normalized.startsWith('/')) normalized = `/${normalized}`;

    useUIStore.getState().setCommandStatus({
      status: 'loading',
      message: !normalized ? 'Clearing...' : isUpdatingShortcut ? 'Updating...' : 'Saving...',
    });
    setIsSaving(true);

    try {
      if (!normalized) {
        await deleteUserShortcutByReference(itemId);
      } else {
        const kind = item._kind || item.type;
        if (kind === 'command') {
          await apiSaveShortcut(itemId, itemId, normalized, getTitle(item), 'command');
        } else if (kind === 'aiPrompt' || kind === 'chat_agent') {
          await apiSaveShortcut(itemId, normalized, getTitle(item), 'aiPrompt' as any);
        } else {
          const type = kind === 'command' ? 'command' : String(item.snippet?.category || '').toLowerCase() === 'link' ? 'link' : 'note';
          await saveUserShortcut(normalized, itemId, type as any);
        }
      }

      useUIStore.getState().setCommandStatus({ status: 'success', message: !normalized ? 'Cleared' : 'Saved' });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
    } catch (error: any) {
      console.error('[BoardView] Failed to save/clear shortcut:', error);
      useUIStore.getState().setCommandStatus({ status: 'error', message: error.message || 'Failed to update shortcut' });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
    } finally {
      setIsSaving(false);
      setEditingShortcutFor(null);
      setEditValue('');
      setSaveError(null);
    }
  };

  const handleOverwriteHotkey = async (conflictId: string) => {
    if (!conflictId || !contextMenuState?.item) return;
    setIsSaving(true);
    useUIStore.getState().setCommandStatus({ status: 'loading', message: 'Overwriting existing hotkey...' });

    try {
      // Clear existing conflict using full compound ID — no ID stripping
      await deleteUserHotkeyByReference(conflictId);
      await saveHotkey(contextMenuState.item, editValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
      useUIStore.getState().setCommandStatus({ status: 'error', message: 'Overwrite failed' });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
      setIsSaving(false);
    }
  };

  const handleOverwriteShortcut = async (conflictId: string) => {
    if (!conflictId || !contextMenuState?.item) return;
    setIsSaving(true);
    useUIStore.getState().setCommandStatus({ status: 'loading', message: 'Overwriting existing shortcut...' });

    try {
      // Clear existing conflict using full compound ID — no ID stripping
      await deleteUserShortcutByReference(conflictId);
      await saveShortcut(contextMenuState.item, editValue);
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
      useUIStore.getState().setCommandStatus({ status: 'error', message: 'Overwrite failed' });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
      setIsSaving(false);
    }
  };

  const handleGoToConflict = () => {
    if (conflictId) {
      useUIStore.getState().setHighlightedCommandId(conflictId);
      setContextMenuState(null);
    }
  };

  const buildContextMenuActions = (item: any) => {
    const kind = item._kind || item.type;
    const isNote =
      kind === 'snippet' &&
      !['link', 'tabgroup', 'tab group', 'automation', 'agent'].includes(
        String(item.snippet?.category || "").toLowerCase(),
      );
    const isSession =
      kind === 'session' ||
      (kind === 'snippet' && ['session'].includes(String(item.snippet?.category || "").toLowerCase())) ||
      (item as any).category === 'session';
    const isLink =
      (kind === 'snippet' && ['link'].includes(String(item.snippet?.category || "").toLowerCase())) ||
      kind === 'link' ||
      kind === 'bookmark';
    const isTabGroup =
      kind === 'snippet' && ['tabgroup', 'tab group'].includes(String(item.snippet?.category || "").toLowerCase());
    const isTodo = kind === 'todo';
    const isCommand = kind === 'command' || kind === 'common_command';
    const isAutomation = kind === 'automation' || kind === 'agent' || (kind === 'snippet' && String(item.snippet?.category || "").toLowerCase() === 'automation');

    const isEditable = kind === 'snippet' || kind === 'link' || kind === 'session' || kind === 'bookmark' || isTodo || isAutomation;
    const isFavoriteable = isEditable || isCommand;
    const isShortcuttable = isEditable || isCommand;

    const actions: any[] = [];

    if (isNote) {
      actions.push({
        key: 'open-AltS_search_newtab',
        label: `Open in full screen ${isMac ? '(⌘+Enter)' : '(Ctrl+Enter)'}`,
        icon: <FiExternalLink size={14} />,
        onSelect: () => {
          const snippetId = item.snippet?.snippet_id || item.snippet?.id;
          if (snippetId && (window as any).chrome?.tabs?.create && (window as any).chrome?.runtime?.getURL) {
            (window as any).chrome.tabs.create({
              url: (window as any).chrome.runtime.getURL(
                `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
              ),
              active: true,
            });
          }
        },
      });
    }

    if (kind === 'snippet' || kind === 'aiPrompt' || kind === 'chat_agent' || isEditable) {
      const isChatAgent = kind === 'aiPrompt' || kind === 'chat_agent';
      const labelText = isChatAgent ? 'Edit Agent' : isTabGroup ? 'Edit routine' : isSession ? 'Edit tab group' : isLink ? 'Edit link' : 'Edit note';
      actions.push({
        key: 'edit',
        label: `${labelText} ${isMac ? '(⌘+Shift+E)' : '(Alt+Shift+E)'}`,
        icon: <FiEdit2 size={14} />,
        onSelect: () => {
          if (isChatAgent) {
            useUIStore.getState().openEditor({ type: 'aiPrompt', id: item.id || item.data?.id });
            return;
          }
          const actualSnippet = item.snippet || item.session || item.data || item;
          if (isTodo) {
            const prefill = {
              todo_id: actualSnippet.id || item.todo_id || item.id,
              snippet_id: actualSnippet.id || item.todo_id || item.id,
              is_todo_type: true,
              key: actualSnippet.name || actualSnippet.title || '',
              title: actualSnippet.name || actualSnippet.title || '',
              value: actualSnippet.description || actualSnippet.value || '',
              event_deadline: actualSnippet.scheduleTime ? new Date(actualSnippet.scheduleTime).toISOString() : (actualSnippet.event_deadline || null),
              is_recurring: actualSnippet.scheduleType === 'recurring' || !!actualSnippet.is_recurring,
              recurring_cycle: actualSnippet.recurringType || actualSnippet.recurring_cycle || null,
              is_anytime: actualSnippet.isAnytime || actualSnippet.is_anytime || false,
              is_done: actualSnippet.isDone || actualSnippet.is_done || false,
              config: actualSnippet.references ? {
                id: actualSnippet.references.map((r: any) => r.id),
                title: actualSnippet.name
              } : (actualSnippet.config || null)
            };
            useUIStore.getState().setTodoCreatePrefill(prefill);
            useUIStore.getState().openEditor({
              type: 'todo',
              id: prefill.todo_id,
            });
          } else if (isSession) {
            useUIStore.getState().openEditor({
              type: 'session',
              id: actualSnippet.id,
              props: { snippet: actualSnippet }
            });
          } else if (isLink || isTabGroup) {
            const wsId = item.workspace?.workspace_id || actualSnippet?.workspaceId || actualSnippet?.workspace_id;
            const fId = item.folder?.folder_id || actualSnippet?.folderId || actualSnippet?.folder_id;
            const suggestionPayload = {
              item: actualSnippet,
              workspace: item.workspace || (wsId ? { workspace_id: wsId } : null),
              folder: item.folder || (fId ? { folder_id: fId } : null),
            };
            if (state?.onRequestEditLink) {
              state.onRequestEditLink(suggestionPayload);
            } else {
              executeItem(item);
            }
          } else {
            executeItem(item);
          }
        },
      });

      if (!isTodo) {
        actions.push({
          key: 'create-todo',
          label: 'Create Todo',
          icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
          onSelect: () => {
            const actualSnippet = item.snippet || item.session || item.data || item;
            const snippetId = actualSnippet?.snippet_id || actualSnippet?.id || item.id;
            const snippetKey = actualSnippet?.key || actualSnippet?.title || actualSnippet?.name || getTitle(item);

            let snippetValue = '';
            if (actualSnippet?.value) {
              snippetValue = typeof actualSnippet.value === 'string' ? actualSnippet.value : JSON.stringify(actualSnippet.value);
            } else if (actualSnippet?.body) {
              snippetValue = actualSnippet.body;
            } else if (actualSnippet?.urls) {
              snippetValue = JSON.stringify({ urls: actualSnippet.urls.map((u: any) => u.url) });
            }

            useUIStore.getState().openEditor({
              type: 'todo',
              id: 'new',
              props: {
                prefill: {
                  snippet_id: snippetId,
                  key: snippetKey,
                  value: snippetValue,
                  category: actualSnippet?.category || item.kind,
                }
              }
            });
            useUIStore.getState().setSidebar('todoSidebar', { open: true });
          },
        });
      }

      actions.push({
        key: 'delete',
        label: 'Delete',
        icon: <FiTrash2 size={14} />,
        className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
        onSelect: () => {
          if (kind === 'aiPrompt' || kind === 'chat_agent') {
            if (confirm('Are you sure you want to delete this agent?')) {
              const id = item.id || item.data?.id;
              if (id) {
                deleteAiPrompt(id).catch(console.error);
              }
            }
            return;
          }
          if (isSession) {
            const actualSnippet = item.snippet || item.session || item.data || item;
            const snippetId = actualSnippet?.snippet_id || actualSnippet?.id || item.id;
            if (confirm('Are you sure you want to delete this tab group?')) {
              if (snippetId) {
                deleteSession(snippetId).catch(console.error);
              }
            }
            return;
          }
          if (state?.onRequestSnippetDelete) {
            const actualSnippet = item.snippet || item.session || item.data || item;
            const snippetId = actualSnippet?.snippet_id || actualSnippet?.id || item.todo_id || item.id;
            const isItemLink = isLink;
            let commandId: 'delete_snippet' | 'delete_link' | 'delete_folder' | 'delete_todo' = 'delete_snippet';
            if (isItemLink) commandId = 'delete_link';
            else if (isTodo) commandId = 'delete_todo';

            const wsId = item.workspace?.workspace_id || actualSnippet?.workspaceId || actualSnippet?.workspace_id;
            const fId = item.folder?.folder_id || actualSnippet?.folderId || actualSnippet?.folder_id;

            state.onRequestSnippetDelete({
              snippetId,
              id: snippetId,
              key: actualSnippet?.key || actualSnippet?.title || actualSnippet?.name || getTitle(item),
              category: actualSnippet?.category || (isItemLink ? 'link' : isTodo ? 'todo' : 'snippet'),
              workspaceId: wsId,
              folderId: fId,
              commandId,
            });
          }
        },
      });
    }

    if (kind === 'snippet' || kind === 'command' || kind === 'common_command' || kind === 'aiPrompt' || kind === 'chat_agent' || isFavoriteable) {
      actions.push({ key: `div-fav-0`, divider: true });

      const compoundId = getItemCompoundId(item);
      const isFav =
        favoriteIdSet.has(compoundId) || favoriteIdSet.has(String(item.snippet?.id || item.snippet?.snippet_id || item.todo_id || item.id || ''));

      actions.push({
        key: 'favorite',
        label: isFav ? 'Remove from favourites' : 'Mark as favourite',
        icon: isFav ? <FaStar size={14} className="text-yellow-500" /> : <FiStar size={14} />,
        closeOnExecute: false,
        onSelect: () => {
          if (state?.onToggleFavorite) {
            state.onToggleFavorite(item);
          }
        },
      });
    }

    if (kind === 'snippet' || kind === 'command' || kind === 'aiPrompt' || kind === 'chat_agent' || isShortcuttable) {
      actions.push({ key: `div-assign-0`, divider: true });

      const compoundId = getItemCompoundId(item);
      const currentShortcut = shortcutsMap[compoundId];

      if (currentShortcut) {
        actions.push({
          key: 'remove-shortcut',
          label: `Remove command`,
          shortcut: currentShortcut,
          icon: <FiTrash2 size={14} />,
          className: 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400',
          closeOnExecute: true,
          onSelect: async () => {
            await saveShortcut(item, '');
          },
        });
      }

      actions.push({
        key: 'assign-shortcut',
        label: currentShortcut ? 'Edit command' : 'Assign command',
        shortcut: currentShortcut,
        icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
        className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
        closeOnExecute: false,
        onSelect: async () => {
          setEditingShortcutFor(compoundId);
          setEditingHotkeyFor(null);
          const displayValue = currentShortcut ? currentShortcut.replace(/^\//, '') : '';
          setEditValue(displayValue);
          setIsUpdatingShortcut(!!currentShortcut);
          setSaveError(null);
        },
      });

      const currentHotkey = hotkeysMap[compoundId];

      if (currentHotkey) {
        actions.push({
          key: 'remove-hotkey',
          label: `Remove hotkey`,
          shortcut: currentHotkey,
          icon: <FiTrash2 size={14} />,
          className: 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400',
          closeOnExecute: true,
          onSelect: async () => {
            await saveHotkey(item, '', true);
          },
        });
      }

      actions.push({
        key: 'assign-hotkey',
        label: currentHotkey ? 'Edit hotkey' : 'Assign hotkey',
        shortcut: currentHotkey,
        icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
        className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
        closeOnExecute: false,
        onSelect: async () => {
          setEditingHotkeyFor(compoundId);
          setEditingShortcutFor(null);
          setEditValue(currentHotkey || '');
          setIsUpdatingHotkey(!!currentHotkey);
          setSaveError(null);
        },
      });
    }

    return actions;
  };

  const query = (rawSearchValue || '').trim();

  // When query is empty OR slash mode is active, build items directly from Dexie/current team.
  // Slash mode must bypass state.suggestions because the Searchbar filters suggestions
  // using the raw text (e.g. '/L'), which matches nothing and returns 0 results.
  const isSlashModeActive = query.startsWith('/');
  let sourceItems: SuggestionListItem[];
  if (query.length === 0 || isSlashModeActive) {
    // Build from Dexie/current team directly
    const boardItems: SuggestionListItem[] = [];
    // Add Dexie items (notes, links,snippets)
    dbNotes.forEach((n: any) => boardItems.push({ _kind: 'snippet', snippet: { ...n, category: n.category || 'note' }, workspace: n.workspaceId ? { workspace_id: n.workspaceId } : null, folder: n.folderId ? { folder_id: n.folderId } : null } as any));
    dbLinks.forEach((l: any) => boardItems.push({ _kind: 'snippet', snippet: { ...l, category: l.category || 'link' }, workspace: l.workspaceId ? { workspace_id: l.workspaceId } : null, folder: l.folderId ? { folder_id: l.folderId } : null } as any));
    dbSnippets.forEach((s: any) => boardItems.push({ _kind: 'snippet', snippet: { ...s, category: s.category || 'snippet' }, workspace: s.workspaceId ? { workspace_id: s.workspaceId } : null, folder: s.folderId ? { folder_id: s.folderId } : null } as any));
    dbSessions.forEach((s: any) => boardItems.push({ _kind: 'session', session: s, workspace: s.workspaceId ? { workspace_id: s.workspaceId } : null, folder: s.folderId ? { folder_id: s.folderId } : null } as any));
    dbAiPrompts.forEach((prompt: any) => boardItems.push({ _kind: 'aiPrompt', ...prompt } as any));

    // Add all commands from the central store
    commands.forEach((cmd: any) => {
      boardItems.push({
        _kind: 'command',
        commandType: 'remote',
        id: cmd.id,
        label: cmd.label,
        prefix: cmd.prefix,
        command: cmd,
      } as any);
    });

    // Add website-only page action commands only when explicitly enabled.
    if (includeWebsitePageActions) {
      PAGE_ACTION_ITEMS.forEach((cmd: any) => {
        boardItems.push({
          ...cmd,
          _kind: 'command',
          commandType: 'page_action',
          command: cmd,
        } as any);
      });
    }

    if (chromeBookmarks.length > 0) {
      boardItems.push(...chromeBookmarks);
    } else {
      const fallbackSuggestions = unfilteredSuggestions.length > 0 ? unfilteredSuggestions : (state?.suggestions || []);
      fallbackSuggestions.forEach((item: any) => {
        const kind = item._kind || item.type;
        if (kind === 'bookmark') {
          boardItems.push(item);
        }
      });
    }

    // Add todos — show ALL non-done todos in Board View so nothing is hidden

    const mappedTodos = todosList
      .filter(t => {
        if (t.is_done) {

          return false;
        }
        // Include the task — Board View shows everything (today, scheduled, anytime)

        return true;
      })
      .map(t => ({
        ...t,
        _kind: 'todo',
        type: 'todo',
        is_todo_type: true
      }));

    boardItems.push(...(mappedTodos as any));

    // If the board has data, use it; otherwise fall back to unfilteredSuggestions cache
    sourceItems = boardItems.length > 0 ? boardItems : (unfilteredSuggestions.length > 0 ? unfilteredSuggestions : (state?.suggestions || []));
  } else {
    // Filter chrome bookmarks by query
    const lowerQuery = String(query || "").toLowerCase();
    const filteredBookmarks = chromeBookmarks.filter(b =>
      (b.title && String(b.title).toLowerCase().includes(lowerQuery)) ||
      (b.url && String(b.url).toLowerCase().includes(lowerQuery))
    );
    sourceItems = [...(state?.suggestions || unfilteredSuggestions || []), ...filteredBookmarks];
  }

  const handleCreateItem = (groupKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    switch (groupKey) {
      case 'notes':
        useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'note' } });
        useUIStore.getState().openEditor({ type: 'note', id: 'new' });
        break;
      case 'snippets':
        useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'snippet' } });
        useUIStore.getState().openEditor({ type: 'note', id: 'new' });
      case 'links':
        useUIStore.getState().openEditor({ type: 'link', id: 'new' });
        useUIStore.getState().openEditor({ type: 'note', id: 'new' });
        break;
      case 'sessions':
        useUIStore.getState().openEditor({ type: 'session', id: 'new' });
        useUIStore.getState().openEditor({ type: 'note', id: 'new' });
        break;
      case 'todos':
        useUIStore.getState().openEditor({ type: 'todo', id: 'new', props: { prefill: { isCreateModalOnly: true } as any } });
        break;
    }
  };

  const filteredAllItems = sourceItems.filter(item => {
    const kind = (item as any)._kind || (item as any).type;
    return !['history', 'ai_history', 'automation', 'open_url'].includes(kind);
  });

  // Define our groups
  const groups = {
    todos: { title: 'Todos', items: [] as SuggestionListItem[], icon: <BsCalendarCheck size={16} className="text-[var(--color-iconDefault)]" /> },
    notes: { title: 'Notes', items: [] as SuggestionListItem[], icon: <NotesIcon className="w-4 h-4 shrink-0" /> },
    snippets: { title: 'Snippets', items: [] as SuggestionListItem[], icon: <FaCode size={16} /> },
    links: { title: 'Links', items: [] as SuggestionListItem[], icon: <FaLink size={16} /> },
    sessions: { title: 'Tab groups', items: [] as SuggestionListItem[], icon: <FaLayerGroup size={16} /> },
    chat_agents: { title: 'Chat Agents', items: [] as SuggestionListItem[], icon: <FaRobot size={16} className="text-indigo-400" /> },
    commands: { title: 'Commands', items: [] as SuggestionListItem[], icon: <FaTerminal size={16} /> },
    bookmarks: { title: 'Bookmarks', items: [] as SuggestionListItem[], icon: <FaBookmark size={16} /> },
    automations: { title: 'Automations', items: [] as SuggestionListItem[], icon: <FiZap size={16} className="text-amber-400" /> },
  };

  filteredAllItems.forEach(item => {
    const kind = (item as any)._kind || (item as any).type;
    if (kind === 'snippet') {
      const cat = String((item as any).snippet?.category || "").toLowerCase();
      if (['link'].includes(cat)) groups.links.items.push(item);
      else if (['session'].includes(cat)) groups.sessions.items.push(item);
      else if (cat === 'snippet') groups.snippets.items.push(item);
      else groups.notes.items.push(item);
    } else if (kind === 'aiPrompt' || kind === 'chat_agent') {
      groups.chat_agents.items.push(item);
    } else if (['command', 'agent_collection', 'common_command', 'module', 'aggregate'].includes(kind)) {
      groups.commands.items.push(item);
    } else if (kind === 'bookmark') {
      groups.bookmarks.items.push(item);
    } else if (kind === 'todo') {
      groups.todos.items.push(item);
    } else if (kind === 'automation' || kind === 'agent' || kind === 'module') {
      groups.automations.items.push(item);
    } else if (kind === 'link' || (item as any).category === 'link') {
      groups.links.items.push(item);
    } else if (kind === 'session' || (item as any).category === 'session') {
      groups.sessions.items.push(item);
    } else if (
      kind === 'history' ||
      kind === 'ai_history' ||
      kind === 'open_url' ||
      kind === 'math_result' ||
      kind === 'time_result'
    ) {
      // Intentionally empty: hide these from the Board View entirely
    } else if (['workspace', 'folder', 'folder_search'].includes(kind)) {
      groups.notes.items.push(item); // Folders make most sense in notes/snippets
    } else {
      groups.notes.items.push(item); // fallback
    }
  });

  // Sort commands inside the commands group to match the requested priority
  groups.commands.items.sort((a: any, b: any) => {
    const getCategoryPriority = (item: any) => {
      const cat = String(item.command?.category || item.category || '').toLowerCase();
      const cmdType = item.commandType;
      const id = item.id || item.command?.id || '';

      if (cmdType === 'page_action' || cat === 'page_action') return 1;
      if (cat === 'ai' && id !== 'ai') return 2;
      if (cat === 'browser') return 3;
      if (cat === 'thissite_action') return 5;
      return 4; // Local app commands and other global commands
    };

    return getCategoryPriority(a) - getCategoryPriority(b);
  });



  const getTitle = (item: any): string => {
    const kind = item._kind || (item as any).type;
    if (kind === 'todo') return item.key || item.title || item.name || 'Todo';
    if (kind === 'command' || kind === 'common_command') return item.label || item.command?.label || 'Command';
    if (kind === 'aggregate') return item.label || 'All AI Chat Agents';
    if (kind === 'snippet') return item.snippet?.key || item.snippet?.title || item.snippet?.name || 'Snippet';
    if (kind === 'session') return item.session?.key || item.session?.title || item.session?.name || item.data?.title || item.data?.key || item.title || 'Untitled Tab group';
    if (kind === 'bookmark') return item.title || item.url || 'Link';
    if (kind === 'open_url') return item.displayUrl || item.url || 'Open URL';
    if (kind === 'workspace') return item.workspace?.workspace_name || 'Workspace';
    if (kind === 'folder') return item.folder?.folder_name || 'Folder';
    if (kind === 'aiPrompt') return item.title || 'Chat Agent';
    if (kind === 'automation') return item.automation?.name || item.title || 'Automation';
    if (kind === 'module') return item.module?.name || item.module?.module_key || 'Module';
    if (kind === 'agent_collection') return item.title || 'Agent Collection';
    // Fallback for custom-shaped items (e.g. extraGroups items from AltS_search_websites)
    return item.label || item.name || item.title || item.key || 'Untitled';
  };

  const getSuggestionLabel = (item: any) => {
    const kind = item._kind || (item as any).type;
    if (kind === 'todo') return 'Todo';
    if (kind === 'command' || kind === 'aggregate' || kind === 'common_command') return 'Command';
    if (kind === 'snippet') {
      const cat = String(item.snippet?.category || "").toLowerCase();
      if (['link'].includes(cat)) return 'Links';
      if (['session'].includes(cat)) return 'Tab groups';
      if (cat === 'link' || cat === 'link') return 'Link Group';
      if (cat === 'note') return 'Snippet';
      return 'Notes';
    }
    if (kind === 'bookmark') return 'Bookmark';
    if (kind === 'automation') return 'Automation';
    if (kind === 'agent_collection') return 'Agent Collection';
    return 'Search';
  };

  const getDesc = (item: any): string => {
    const rawDesc = (() => {
      const kind = item._kind || (item as any).type;
      if (kind === 'todo') {
        const dueLabel = getTodoDueLabel(item);
        let val = '';
        if (typeof item.value === 'string') {
          val = item.value.replace(/<[^>]+>/g, '').trim();
        }
        if (dueLabel && val) {
          return `${dueLabel} • ${val}`;
        }
        return dueLabel || val || '';
      }
      if (kind === 'command' || kind === 'common_command') return item.description || '';
      if (kind === 'snippet') {
        const s = item.snippet;
        if (!s) return '';
        if (s.description) return s.description;
        if (s.body) return s.body.replace(/<[^>]+>/g, '').trim();
        if (s.code) return s.code;
        if (s.urls && Array.isArray(s.urls)) {
          return s.urls.map((u: any) => {
            if (typeof u === 'object' && u !== null && u.url) return String(u.url);
            return String(u);
          }).join(', ');
        }
        if (typeof s.value === 'string') return s.value.replace(/<[^>]+>/g, '').trim();
        return '';
      }
      if (kind === 'bookmark') return item.url || '';
      if (kind === 'aiPrompt') return item.prompt || item.body || '';
      if (kind === 'open_url') return item.url || '';
      if (kind === 'session') {
        const sessionUrls = item.session?.urls || item.data?.urls;
        if (sessionUrls && Array.isArray(sessionUrls)) {
          const count = sessionUrls.length;
          return `${count} tab${count !== 1 ? 's' : ''} saved`;
        }
      }
      if (item.description) return item.description;
      return '';
    })();

    const title = getTitle(item).trim();
    const finalDesc = rawDesc.trim();

    if (finalDesc === title) {
      return '';
    }
    return finalDesc;
  };

  const getSnippetAllUrls = (snippet: any): string[] => {
    if (!snippet) return [];
    let urls: any[] = [];
    if (typeof snippet.value === 'string') {
      const raw = snippet.value as string;
      try {
        const parsed = JSON.parse(raw || '{}');
        if (Array.isArray(parsed)) urls = parsed;
        else if (parsed && parsed.urls && Array.isArray(parsed.urls)) urls = parsed.urls;
        else if (raw.startsWith('http')) urls = [raw];
      } catch {
        if (raw.startsWith('http')) urls = [raw];
      }
    } else if (snippet && snippet.value && typeof snippet.value === 'object') {
      if (Array.isArray(snippet.value)) urls = snippet.value;
      else if ('urls' in (snippet.value as any)) urls = (snippet.value as any).urls || [];
    }
    if (snippet && snippet.urls && Array.isArray(snippet.urls)) {
      urls = [...urls, ...snippet.urls];
    }
    // log removed
    urls = urls.map((u: any) => {
      if (typeof u === 'object' && u !== null && u.url) return String(u.url);
      return String(u);
    });
    return urls;
  };

  const renderTodoMetadata = (item: any, isFocused: boolean) => {
    if (!item.event_deadline) {
      if (item.is_anytime) {
        return (
          <span className={clsx("text-[11px] font-medium transition-colors", isFocused ? "text-neutral-300" : "text-neutral-500")}>
            Anytime
          </span>
        );
      }
      const val = typeof item.value === 'string' ? item.value.replace(/<[^>]+>/g, '').trim() : '';
      if (!val) return null;
      return (
        <span className={clsx("text-[11px] truncate transition-colors", isFocused ? "text-neutral-300" : "text-neutral-500")}>
          {val}
        </span>
      );
    }

    const d = new Date(item.event_deadline.replace(' ', 'T'));
    if (isNaN(d.getTime())) {
      const val = typeof item.value === 'string' ? item.value.replace(/<[^>]+>/g, '').trim() : '';
      return (
        <span className={clsx("text-[11px] truncate transition-colors", isFocused ? "text-neutral-300" : "text-neutral-500")}>
          {item.is_anytime ? 'Anytime' : ''}{val ? ` • ${val}` : ''}
        </span>
      );
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const isOverdue = !item.is_done && d.getTime() < now.getTime() && (dDate.getTime() < startOfToday.getTime() || (item.event_deadline && item.event_deadline.includes(':')));

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    let dateStr = '';

    if (dDate.getTime() === startOfToday.getTime()) {
      dateStr = 'Today';
    } else if (dDate.getTime() === startOfTomorrow.getTime()) {
      dateStr = 'Tomorrow';
    } else if (d.getFullYear() >= 2035) {
      dateStr = 'Anytime';
    } else {
      dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    const isRecurring = !!(item.is_recurring || item.recurring);
    const val = typeof item.value === 'string' ? item.value.replace(/<[^>]+>/g, '').trim() : '';

    return (
      <div className="flex flex-col min-w-0 w-full text-[11px] leading-relaxed">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isOverdue ? (
            <span className={clsx("font-semibold", isFocused ? "text-neutral-300" : "text-neutral-500")}>
              {dateStr}, {timeStr} ({(() => {
                const diffMs = now.getTime() - d.getTime();
                const diffMins = Math.floor(diffMs / (60 * 1000));
                const diffHrs = Math.floor(diffMs / (60 * 60 * 1000));
                const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
                if (diffMins < 60) return `${diffMins}m overdue`;
                if (diffHrs < 24) return `${diffHrs}h overdue`;
                return `${diffDays}d overdue`;
              })()})
            </span>
          ) : (
            <span className={clsx("font-semibold", isFocused ? "text-neutral-300" : "text-neutral-500")}>
              {dateStr === 'Anytime' ? 'Anytime' : `${dateStr}, ${timeStr}`}
            </span>
          )}
          {isRecurring && (
            <span className="text-emerald-500 dark:text-emerald-400 font-medium">
              • Recurring
            </span>
          )}
        </div>
        {val && (
          <span className={clsx("truncate mt-0.5 transition-colors", isFocused ? "text-neutral-300" : "text-neutral-500")}>
            {val}
          </span>
        )}
      </div>
    );
  };

  const handleToggleTodo = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    const sid = String(item.id || item.snippet_id || item.todo_id);
    const newStatus = !item.is_done;
    const chromeAny = (window as any)?.chrome;

    // 1. Optimistic state update in BoardView
    setTodosList(prev => prev.map(t => {
      if (String(t.id || t.snippet_id || t.todo_id) === sid) {
        return { ...t, is_done: newStatus };
      }
      return t;
    }));

    // 2. Persist to IndexedDB
    try {
      await updateTodo(sid, newStatus);
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (err) {
      console.warn('[BoardView] Failed to toggle todo in IndexedDB:', err);
      // Revert optimistic update on error
      setTodosList(prev => prev.map(t => {
        if (String(t.id || t.snippet_id || t.todo_id) === sid) {
          return { ...t, is_done: !newStatus };
        }
        return t;
      }));
    }
  };

  const renderIcon = (item: any) => {
    if (item.icon && React.isValidElement(item.icon)) return item.icon;

    const kind = item._kind || (item as any).type;

    if (kind === 'todo') {
      return (
        <div
          className="w-full h-full cursor-pointer flex items-center justify-center transition-transform hover:scale-110"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleTodo(e, item);
          }}
        >
          {item.is_done ? (
            <FaCheckCircle className="text-emerald-500 w-[18px] h-[18px] drop-shadow-sm" />
          ) : (
            <FaRegCircle className="text-[var(--color-iconDefault)] w-[18px] h-[18px]" />
          )}
        </div>
      );
    }

    if (kind === 'command' || kind === 'common_command') {
      // Page-action commands get specific icons
      const cmdType = item.commandType;
      const cmdId = item.id || item.command?.id || '';
      if (cmdType === 'page_action') {
        if (cmdId === 'capture_screenshot') return <FaCamera className="text-sky-400" size={16} />;
        if (cmdId === 'capture_full_screenshot') return <FaExpand className="text-sky-400" size={16} />;
        if (cmdId === 'downloadallimages') return <FaImages className="text-emerald-400" size={16} />;
        if (cmdId === 'downloadalltables') return <FaTable className="text-amber-400" size={16} />;
      }
      const iconHost = item.command?.iconHost;
      if (iconHost)
        return (
          <img
            src={getFaviconUrl(iconHost)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      return <FaTerminal className="text-[var(--color-iconDefault)]" size={16} />;
    }
    if (kind === 'aggregate' || kind === 'agent_collection')
      return <FaLayerGroup className="text-[var(--color-iconDefault)]" size={16} />;

    if (kind === 'session') {
      const urls = getSnippetAllUrls(item.session || item);
      if (urls.length > 0) {
        return (
          <div className="flex -space-x-1.5 items-center w-8">
            {urls.slice(0, 3).map((url, i) => (
              <div
                key={`session-icon-${i}`}
                className="w-5 h-5 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1C] overflow-hidden shadow-sm bg-white">
                <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
              </div>
            ))}
          </div>
        );
      }
      return <FaLayerGroup className="text-purple-400" size={16} />;
    }

    if (kind === 'snippet') {
      const category = String(item.snippet?.category || "").toLowerCase();
      const isTodoItem = kind === 'todo' || category === 'todo';
      const isTabGroup = category === 'link';
      const urls = getSnippetAllUrls(item.snippet);

      if (isTabGroup && urls.length > 0) {
        return (
          <div className="flex -space-x-1.5 items-center w-8">
            {urls.slice(0, 3).map((url, i) => (
              <div
                key={`tabgroup-icon-${i}`}
                className="w-5 h-5 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1C] overflow-hidden shadow-sm bg-white">
                <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
              </div>
            ))}
          </div>
        );
      }

      const firstUrl = urls[0];
      if (firstUrl && ['link'].includes(category)) {
        return (
          <img
            src={getFaviconUrl(firstUrl)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      }

      if (['link'].includes(category))
        return <FaLink className="text-blue-400" size={16} />;
      return <NotesIcon className="text-amber-400" size={16} />;
    }

    if (kind === 'bookmark' || kind === 'open_url') {
      const targetUrl = kind === 'open_url' ? item.url?.split(',')[0] : item.url;
      if (targetUrl)
        return (
          <img
            src={getFaviconUrl(targetUrl)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      return <FaLink className="text-[var(--color-iconDefault)]" size={16} />;
    }

    if (kind === 'aiPrompt') {
      const urls = Object.values(item.modelUrls || {});
      if (urls.length > 0) {
        return (
          <div className="flex -space-x-1.5 items-center">
            {urls.slice(0, 3).map((url: any, i) => (
              <div
                key={`aiprompt-icon-${i}`}
                className="w-5 h-5 rounded-full flex items-center justify-center ring-1 ring-white/10 overflow-hidden bg-white/5 shadow-sm">
                <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
              </div>
            ))}
          </div>
        );
      }
      return <FaRobot className="text-indigo-400" size={16} />;
    }

    if (kind === 'automation') return <FaRobot className="text-purple-400" size={16} />;
    if (kind === 'module') {
      const iconHost = item.module?.icon_host || item.module?.parent_icon_host;
      if (iconHost)
        return (
          <img
            src={getFaviconUrl(iconHost)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      return <FaRobot className="text-purple-400" size={16} />;
    }

    return <FaSearch className="text-[var(--color-iconDefault)]" size={16} />;
  };

  // Define strict priority and default arrays
  const orderedKeys = ['todos', 'notes', 'links', 'sessions', 'chat_agents', 'commands', 'bookmarks', 'snippets', 'automations'] as const;
  const finalKeys = [...orderedKeys];
  const activeGroups = finalKeys.map(k => ({ ...(groups as any)[k], id: k }));

  const executeTodoItem = async (todo: any, e?: React.MouseEvent | KeyboardEvent) => {
    if (todo.is_done) return;

    const chromeAny = (window as any)?.chrome;
    const { category, value, snippet_id } = todo;
    const cat = String(category || (todo as any).snippet_category || "").toLowerCase();

    // Helper to extract URLs
    const extractUrls = (val: any) => {
      let rawUrls: any[] = [];
      try {
        if (typeof val === 'object' && val !== null) {
          if (Array.isArray(val)) rawUrls = val;
          else if (val.urls) rawUrls = val.urls;
          else if (val.url) rawUrls = [val.url];
        } else if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
          const parsed = JSON.parse(val || '{}');
          if (Array.isArray(parsed)) rawUrls = parsed;
          else rawUrls = parsed.urls || (val.startsWith('http') ? [val] : []);
        } else if (typeof val === 'string' && val.startsWith('http')) {
          rawUrls = [val];
        }
      } catch (err) {
        if (val && typeof val === 'string' && val.startsWith('http')) {
          rawUrls = [val];
        }
      }

      let finalUrls: string[] = [];
      if (Array.isArray(rawUrls)) {
        finalUrls = rawUrls.map(u => {
          if (typeof u === 'object' && u !== null && u.url) return String(u.url);
          return String(u);
        });
      }

      return finalUrls.filter(u => u && u.startsWith('http'));
    };

    let skipToggle = false;

    // A. Check if this is a config-based multi-item todo
    const configIds = todo.config?.id;
    if (Array.isArray(configIds) && configIds.length > 0) {
      for (const cid of configIds) {
        const cidStr = String(cid);
        const matched = finalConvertibleItems.find(item => {
          const itemIdStr = String(item.id);
          if (itemIdStr === cidStr) return true;
          const strippedItemId = itemIdStr.replace(/^(auto-|cmd-|mod-)/, '');
          const strippedCid = cidStr.replace(/^(auto-|cmd-|mod-)/, '');
          return strippedItemId === strippedCid;
        });

        if (matched) {
          const itemCat = String(matched.category || "").toLowerCase();
          const itemId = matched.id;
          const itemVal = matched.data?.value || matched.data?.url || matched.data?.link || '';
          if (['link', 'collection', 'agent_collection'].includes(itemCat)) {
            extractUrls(itemVal).forEach(url => chromeAny?.tabs?.create({ url }));
          } else if (['note', 'snippet', 'custom'].includes(itemCat)) {
            chromeAny?.tabs?.create({
              url: chromeAny.runtime.getURL(
                `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(itemId)}`,
              ),
            });
          } else if (['command', 'module', 'automation', 'install', 'agent', 'chat_agent'].includes(itemCat)) {
            chromeAny?.tabs?.create({
              url: chromeAny.runtime.getURL(
                `AltS_search_newtab/index.html?trigger_hotkey=true&type=${itemCat}&id=${encodeURIComponent(itemId)}`,
              ),
            });
          }
        }
      }
    } else if (['link', 'collection', 'agent_collection'].includes(cat)) {
      extractUrls(value).forEach(url => chromeAny?.tabs?.create({ url }));
    } else if (['note', 'snippet'].includes(cat)) {
      let matchedSnippetItem: { snippet: any; workspace: any } | null = null;
      if (snippet_id) {
        const flatSnippet = dbSnippets.find((s: any) => String(s.id || s.snippet_id) === String(snippet_id));
        if (flatSnippet) {
          matchedSnippetItem = { snippet: flatSnippet, workspace: null };
        }
      }
      if (matchedSnippetItem && state?.onSnippetSelect) {
        state.onSnippetSelect({
          snippet: matchedSnippetItem.snippet,
          workspace: matchedSnippetItem.workspace,
          folder: null
        } as any);
      } else if (chromeAny?.tabs?.create && chromeAny?.runtime?.getURL) {
        chromeAny.tabs.create({
          url: chromeAny.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(snippet_id)}`),
        });
      }
      skipToggle = true; // Don't toggle done when opening note/snippet editor
    } else if (['command', 'module', 'automation', 'install', 'agent', 'chat_agent', 'custom'].includes(cat)) {
      const triggerId = value || snippet_id;
      if (chromeAny?.tabs?.create && chromeAny?.runtime?.getURL) {
        if (cat === 'custom') {
          chromeAny.tabs.create({
            url: chromeAny.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(triggerId)}`),
          });
        } else {
          chromeAny.tabs.create({
            url: chromeAny.runtime.getURL(`AltS_search_newtab/index.html?trigger_hotkey=true&type=${cat}&id=${encodeURIComponent(triggerId)}`),
          });
        }
      }
    }

    if (!skipToggle) {
      const syntheticEvent = {
        stopPropagation: () => { },
        preventDefault: () => { },
      } as any;
      await handleToggleTodo(syntheticEvent, todo);
    }
  };

  const executeItem = (item: any, e?: React.MouseEvent | KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const kind = item._kind || (item as any).type;
    console.log('--- executeItem START ---', { kind, item });

    if (onExecuteItem) {
      const handled = onExecuteItem(item, e);
      if (handled) {
        return;
      }
    }

    const isCtrl = e && 'ctrlKey' in e && (e.ctrlKey || e.metaKey);
    const chromeAny = (window as any)?.chrome;

    if (kind === 'todo') {
      executeTodoItem(item, e);
      return;
    }

    if (kind === 'session') {
      handleStartSession(item, e as any);
      return;
    }

    if (kind === 'aiPrompt') {
      const MODEL_KIND: Record<string, string> = {
        gpt: 'chatgpt',
        claude: 'claude',
        gemini: 'gemini',
        perplexity: 'perplexity',
      };
      
      const cleanPrompt = String(item.prompt || '')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      const urls = Object.entries(item.modelUrls || {});
      
      urls.forEach(([modelId, targetUrl]) => {
        const autoKind = MODEL_KIND[modelId] || 'chatgpt';
        chromeAny?.runtime?.sendMessage({
          action: 'open_tab_with_auto_submit',
          url: targetUrl,
          autoSubmit: { kind: autoKind, prompt: cleanPrompt },
          forceNewTab: true,
        });
      });
      return;
    }

    if (kind === 'snippet') {
      const rawCategory = item.snippet?.category || item.category || (item.data && item.data.category) || '';
      const category = String(rawCategory).toLowerCase();
      const urls = getSnippetAllUrls(item.snippet || item.data || item);
      console.log('--- executeItem snippet ---', { category, item, urls });

      if (isCtrl) {
        if (urls.length > 0) {
          urls.forEach(url => {
            if (url.startsWith('note:')) {
              const sid = url.substring(5);
              if (chromeAny?.runtime?.getURL) {
                chromeAny.tabs.create({
                  url: chromeAny.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(sid)}`),
                  active: false,
                });
              }
            } else if (url.startsWith('agent_chat?id=')) {
              const agentId = url.split('id=')[1];
              if (chromeAny?.runtime?.getURL) {
                chromeAny.tabs.create({
                  url: chromeAny.runtime.getURL(
                    `AltS_search_newtab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
                  ),
                  active: false,
                });
              }
            } else {
              chromeAny?.tabs?.create({ url, active: false });
            }
          });
        } else {
          const sid = item.snippet?.snippet_id || item.snippet?.id;
          if (sid && chromeAny?.runtime?.getURL) {
            chromeAny.tabs.create({
              url: chromeAny.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(sid)}`),
              active: false,
            });
          }
        }
        return;
      }

      const actualSnippet = item.snippet || item.session || item.data || item;
      const actualId = String(actualSnippet.snippet_id || actualSnippet.id || item.id || '');

      let inferredCategory = category;
      if (!inferredCategory) {
        if (actualId.startsWith('note_')) inferredCategory = 'note';
        else if (actualId.startsWith('link_')) inferredCategory = 'link';
        else if (actualId.startsWith('snippet_')) inferredCategory = 'snippet';
        else if (actualId.startsWith('session_')) inferredCategory = 'session';
      }

      if (['snippet', 'note', 'session'].includes(inferredCategory) || inferredCategory === 'notes') {
        const actualType = inferredCategory === 'notes' ? 'note' : inferredCategory;

        useUIStore.getState().openEditor({
          type: actualType as 'note' | 'snippet' | 'session',
          id: actualId,
          props: {
            item: actualSnippet,
          }
        });
        return;
      }

      // Handle links, tabgroups, etc. by opening URLs directly
      // (bypassing state.onRequestOpenUrls which silently skips already-open URLs)
      if (urls.length > 0) {
        urls.forEach((url, i) => {
          if (chromeAny?.tabs?.create) {
            chromeAny.tabs.create({ url, active: i === 0 });
          } else {
            window.open(url, '_blank');
          }
        });
      } else if (state?.onSnippetSelect) {
        state.onSnippetSelect(item);
      }
    } else if (['workspace', 'folder', 'folder_search'].includes(kind)) {
      if (isCtrl) return;
      if (state?.onSnippetSelect) {
        state.onSnippetSelect(item);
      }
      if (onClose) onClose();
      return;
    } else if (kind === 'command' || kind === 'common_command' || kind === 'aggregate') {
      if (isCtrl) {
        if (chromeAny?.tabs?.create && chromeAny?.runtime?.getURL) {
          const extUrl = chromeAny.runtime.getURL(`AltS_search_newtab/index.html?lock_command=${encodeURIComponent(item.id)}`);
          chromeAny.tabs.create({ url: extUrl, active: false });
        }
        return;
      }

      // If the parent provided a command handler (e.g. newtab search bar), use it
      if (state?.onCommandMouseDown) {
        state.onCommandMouseDown(e as any, item.id);
        return;
      }

      // Standalone fallback: resolve the urlTemplate directly
      // item may be the raw CommandDefinition or wrapped as { command: ... }
      const cmdDef = item.command || item;
      const cmdId: string = cmdDef.id || item.id || '';
      const urlTemplate: string = cmdDef.urlTemplate || '';

      // ─── Local app commands — trigger in-app UI exactly like the create panel ───
      // These mirror the same calls in handleCreateItem and the left sidebar panels.
      const localResult = (() => {
        switch (cmdId) {
          case 'createnotes':
            useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'note' } });
            useUIStore.getState().openEditor({ type: 'note', id: 'new' });
            return true;
          case 'createsnippet':
            useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'snippet' } });
            useUIStore.getState().openEditor({ type: 'note', id: 'new' });
            return true;
          case 'createlinks':
            useUIStore.getState().openEditor({ type: 'link', id: 'new' });
            useUIStore.getState().openEditor({ type: 'note', id: 'new' });
            return true;
          case 'createsession':
            useUIStore.getState().openEditor({ type: 'session', id: 'new' });
            useUIStore.getState().openEditor({ type: 'note', id: 'new' });
            return true;

          case 'todo':
            useUIStore.getState().openEditor({ type: 'todo', id: 'new', props: { prefill: { isCreateModalOnly: true } as any } });
            return true;
          case 'agent':
            useUIStore.getState().setSidebar('agentSidebar' as any, { open: true });
            return true;
          case 'shortcuts':
            useUIStore.getState().setSidebar('commandListSidebar' as any, { open: true });
            return true;
          case 'bookmarks':
            setSelectedSidebarSection('bookmarks');
            return true;
          case 'profile':
            useUIStore.getState().setSidebar('settingsSidebar' as any, { open: true });
            return true;
          case 'store':
            useUIStore.getState().setSidebar('storeSidebar' as any, { open: true });
            return true;
          case 'saved-automation':
            useUIStore.getState().setSidebar('automationSidebar' as any, { open: true });
            return true;
          case 'dashboard':
            chromeAny?.tabs?.create({ url: 'https://app.cmdos.io' });
            return true;
          case 'tutorials':
            chromeAny?.tabs?.create({ url: 'https://docs.cmdos.io' });
            return true;
          case 'refresh':
            window.location.reload();
            return true;
          case 'toggle-dark-mode': {
            const root = document.documentElement;
            root.classList.toggle('dark');
            return true;
          }
          case 'calendar':
            chromeAny?.runtime?.sendMessage?.({
              action: 'open_tab_with_auto_submit',
              url: 'https://gemini.google.com/app',
              autoSubmit: { kind: 'gemini', prompt: 'Help me manage my calendar and schedule.' },
              forceNewTab: true,
            });
            return true;
          default:
            return false;
        }
      })();

      if (localResult) {
        onClose?.();
        return;
      }

      if (!urlTemplate) return;

      // Browser chrome:// pages (no query needed) — open immediately
      const needsQuery = urlTemplate.includes('{query}');
      const isAiCmd = cmdId === 'ai' || ['gpt', 'claude', 'perplexity', 'gemini'].includes(cmdId) || cmdDef.category === 'ai';
      
      if (!needsQuery && !isAiCmd) {
        chromeAny?.tabs?.create({ url: urlTemplate });
        onClose?.();
        return;
      }

      // Search commands: open the newtab and pre-lock the command so the user can type
      if (chromeAny?.tabs?.create && chromeAny?.runtime?.getURL) {
        const extUrl = chromeAny.runtime.getURL(
          `AltS_search_newtab/index.html?lock_command=${encodeURIComponent(item.id || cmdDef.id)}`,
        );
        chromeAny.tabs.create({ url: extUrl });
        onClose?.();
      }
    } else if (kind === 'bookmark' || kind === 'open_url') {
      const urlsToOpen = item.url ? item.url.split(',').filter(Boolean) : [];
      if (isCtrl) {
        urlsToOpen.forEach((url: string) => {
          chromeAny?.tabs?.create({ url, active: false });
        });
        return;
      }
      if (state?.onRequestOpenUrls) {
        if (urlsToOpen.length > 0) {
          state.onRequestOpenUrls(urlsToOpen, item.title || item.displayUrl);
        }
      } else if (urlsToOpen.length > 0) {
        // Standalone fallback: open directly
        chromeAny?.tabs?.create({ url: urlsToOpen[0] });
        onClose?.();
      }
    } else if (kind === 'automation' && state?.onAutomationSelect) {
      if (isCtrl) return;
      state.onAutomationSelect(item.automation);
    } else if (kind === 'module' && state?.onModuleSelect) {
      if (isCtrl) return;
      state.onModuleSelect(item.module);
    } else if (kind === 'agent_collection' && state?.onAgentCollectionSelect) {
      if (isCtrl) return;
      state.onAgentCollectionSelect(item);
    }
  };

  const handleStartSession = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const record = item.data || item.session || item.snippet;
    if (!record) return;

    const isActualSession = !!item.session || item._kind === 'session';
    const sessionId = isActualSession ? record.id : (record.snippet_id || record.id);
    const sessionName = isActualSession ? record.title : (record.key || record.name || record.title || 'Untitled Tab group');
    const workspaceId = isActualSession ? record.workspaceId : (record.workspace_id || null);
    const folderId = isActualSession ? record.folderId : (record.folder_id || null);

    let initialUrls: string[] = [];
    let initialNames: string[] = [];
    let openSettings = record.sessionOpenSettings || item.sessionOpenSettings;

    try {
      const resolved = await resolveEntityById(sessionId);
      const sessionRecord = resolved?.entity as any;
      if (sessionRecord) {
        openSettings = sessionRecord.sessionOpenSettings || openSettings;
        if (Array.isArray(sessionRecord.urls)) {
          initialUrls = sessionRecord.urls.map((u: any) => u.url);
          initialNames = sessionRecord.urls.map((u: any) => u.title || u.name || '');
        }
      }
    } catch (err) {}

    if (initialUrls.length === 0 && isActualSession) {
      initialUrls = record.urls?.map((l: any) => l.url) || [];
      initialNames = record.urls?.map((l: any) => l.name || l.title || '') || [];
    } else {
      try {
        const parsed = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
        if (Array.isArray(parsed)) {
          initialUrls = parsed.map((l: any) => l.url || l);
          initialNames = parsed.map((l: any) => l.name || '');
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.urls)) initialUrls = parsed.urls;
          if (Array.isArray(parsed.names)) initialNames = parsed.names;
        }
      } catch (err) { }
  
      if (initialUrls.length === 0) {
        initialUrls = getSnippetAllUrls(record);
      }
    }

    // Save prefill to local storage perfectly mimicking create session
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({
        pending_session_prefill: {
          title: sessionName,
          sessionId: sessionId,
          urls: initialUrls,
          names: initialNames,
        }
      }, () => resolve());
    });

    chrome.runtime.sendMessage({
      action: 'start_session',
      sessionId,
      sessionName,
      workspaceId,
      folderId: folderId || null,
      teamId: undefined,
      storageMode: 'cloud',
      initialUrls,
      initialNames,
      openSettings,
      isInlineCreation: true,
    }, (response) => {

      if (response?.ok && openSettings?.openMode === 'same_window') {
        const encodedName = encodeURIComponent(sessionName);
        window.history.replaceState(null, '', `?session_mode=true&session_id=${sessionId}&session_name=${encodedName}`);
        useUIStore.getState().openEditor({ type: 'session', id: 'new' });
      }
    });
  };



  // Click outside or ESC to close context menu
  useEffect(() => {
    if (!contextMenuState) return;

    const handleMouseDown = (event: MouseEvent) => {
      // Use composedPath to support portal-mounted menus
      const path = event.composedPath();
      const menuEl = document.querySelector('[data-unified-menu="true"]');
      if (menuEl && path.includes(menuEl)) return; // click was inside menu
      setContextMenuState(null);
    };
    document.addEventListener('mousedown', handleMouseDown, true);

    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      setContextMenuState(null);
      return true;
    });

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      unregister();
    };
  }, [contextMenuState]);

  useEffect(() => {
    if (focus[0] >= 0 && focus[1] >= 0) {
      const element = document.getElementById(`board-item-${focus[0]}-${focus[1]}`);
      if (element) {
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }, [focus]);

  // ── Slash mode integration ────────────────────────────────────────────────

  // Automatically insert space after valid slash shortcut typed
  useEffect(() => {
    const prevVal = prevSearchValueRef.current;
    prevSearchValueRef.current = rawSearchValue;

    if (!rawSearchValue.startsWith('/')) return;

    const isExactlyAlias = Object.keys(SLASH_SECTION_ALIASES).some(
      alias => rawSearchValue.toUpperCase() === `/${alias.toUpperCase()}`
    );

    if (isExactlyAlias) {
      const aliasMatch = rawSearchValue.slice(1).toUpperCase();
      const expectedPrev = `/${aliasMatch} `;
      if (prevVal.toUpperCase() !== expectedPrev) {
        state?.onQueryChange?.(`${rawSearchValue} `);
        requestAnimationFrame(() => {
          focusSearchbarInput();
        });
      }
    }
  }, [rawSearchValue, state]);

  // When a /alias matches, sync the sidebar to that section automatically.
  // Sidebar reflects the slash selection so the left nav stays in step.
  useEffect(() => {
    const prev = prevSearchValueRef.current;
    prevSearchValueRef.current = rawSearchValue;

    if (slashMode.activeSection && slashMode.activeSection !== 'all') {
      setSelectedSidebarSection(slashMode.activeSection);
      isSlashSelectedRef.current = true;
    } else if (slashMode.activeSection === 'all') {
      setSelectedSidebarSection('all');
      isSlashSelectedRef.current = true;
    }
    // When slash mode is exited, only reset to 'all' if it was selected by a slash command
    if (!slashMode.slashDropdown && !slashMode.activeSection) {
      if (prev.startsWith('/') && !rawSearchValue.startsWith('/')) {
        if (isSlashSelectedRef.current) {
          setSelectedSidebarSection('all');
          isSlashSelectedRef.current = false;
        }
      }
    }
  }, [slashMode.activeSection, slashMode.slashDropdown, rawSearchValue]);

  // Keyboard navigation for the slash dropdown
  useEffect(() => {
    if (!slashMode.slashDropdown) return;

    const filterText = String(rawSearchValue.slice(1) || "").toLowerCase();
    const visibleOptions = Object.keys(SLASH_SECTION_META).filter(name => {
      const alias = SLASH_ALIAS_DISPLAY[name] || '';
      return String(name).toLowerCase().includes(filterText) || String(alias).toLowerCase().includes(filterText);
    });

    const handleSlashKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSlashDropdownSelectedIndex(prev => Math.min(prev + 1, visibleOptions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSlashDropdownSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && slashDropdownSelectedIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        const chosen = visibleOptions[slashDropdownSelectedIndex];
        if (chosen) {
          const alias = SLASH_ALIAS_DISPLAY[chosen] || '';
          state?.onQueryChange?.(`/${alias} `);
          setSlashDropdownSelectedIndex(-1);
          requestAnimationFrame(() => {
            focusSearchbarInput();
          });
        }
      }
    };

    window.addEventListener('keydown', handleSlashKey, { capture: true });

    const unregister = slashMode.slashDropdown
      ? useUIStore.getState().registerEscapeInterceptor(() => {
        state?.onQueryChange?.('');
        setSlashDropdownSelectedIndex(-1);
        return true;
      })
      : () => { };

    return () => {
      window.removeEventListener('keydown', handleSlashKey, { capture: true });
      unregister();
    };
  }, [slashMode.slashDropdown, rawSearchValue, slashDropdownSelectedIndex, state]);

  // When slash mode is active, re-filter board items using the slash searchQuery
  // (e.g. /n google → filter notes by "google")
  const slashSearchQuery = slashMode.searchQuery;

  // Override the activeGroups items with slash search query filtering
  const finalGroupsBase = (() => {
    const combinedGroups = [...extraGroups, ...activeGroups];
    if (!slashSearchQuery.trim()) return combinedGroups;
    const lower = String(slashSearchQuery || "").toLowerCase();
    return combinedGroups.map(g => ({
      ...g,
      items: g.items.filter((item: any) => {
        const t = String(getTitle(item)).toLowerCase();
        const d = String(getDesc(item)).toLowerCase();
        return t.includes(lower) || d.includes(lower);
      }),
    }));
  })();

  // ESC to clear search globally when active, as long as context menus aren't open
  useEffect(() => {
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      if (todoCreatePrefill) return false;

      if (rawSearchValue) {
        state?.onQueryChange?.('');
        return true;
      } else if (onClose) {
        onClose();
        return true;
      }
      return false;
    });
    return unregister;
  }, [rawSearchValue, state, onClose, todoCreatePrefill]);

  // Filter the active groups based on the selected sidebar section.
  // Rules:
  //  - slashDropdown open (only '/' typed) → show ALL columns behind the picker
  //  - slash alias matched (e.g. '/L') → show only that column
  //  - normal sidebar click → use selectedSidebarSection


  // Normalize a group title to its sidebar ID for matching (e.g. "This Site" → "thissite")
  const toSidebarId = (title: string) => String(title).toLowerCase().replace(/\s+/g, '');

  const rawSearchVal = (rawSearchValue || '').trim();

  const finalGroups = (
    effectiveSidebarSection === 'all'
      ? finalGroupsBase
      : finalGroupsBase.filter(g =>
        // Built-in groups: match by their exact ID
        (g as any).id === effectiveSidebarSection ||
        // Built-in groups: match by their exact key (todos, notes, etc.)
        String(g.title).toLowerCase() === effectiveSidebarSection ||
        // Extra groups: match by sanitized ID (e.g. "This Site" → "thissite")
        toSidebarId(g.title) === effectiveSidebarSection
      )
  ).filter(g => {
    // If user is actively searching (with actual query text), hide columns that have 0 results
    if (slashMode.searchQuery.trim() !== '') {
      return g.items.length > 0;
    }
    return true;
  });

  // Automatically focus the first available result item when query changes or result set updates
  const groupItemCounts = useMemo(() => finalGroups.map(g => g.items.length).join(','), [finalGroups]);

  useEffect(() => {
    let firstValidCol = -1;
    for (let c = 0; c < finalGroups.length; c++) {
      if (finalGroups[c].items.length > 0) {
        firstValidCol = c;
        break;
      }
    }
    if (firstValidCol !== -1) {
      setFocus([firstValidCol, 0]);
    } else {
      setFocus([-1, -1]);
    }
  }, [rawSearchValue, groupItemCounts]);


  useEffect(() => {
    if (finalGroups.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        state?.isAtMenuOpen ||

        state?.isContextualPopupOpen ||
        state?.showAIHistoryPanel ||
        slashMode.slashDropdown
      ) {
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        let [col, row] = focus;

        if (col < 0 || col >= finalGroups.length) col = 0;
        if (row < 0 || row >= finalGroups[col].items.length) row = 0;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          row = Math.min(row + 1, finalGroups[col].items.length - 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          row = Math.max(row - 1, 0);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          col = Math.min(col + 1, finalGroups.length - 1);
          row = Math.min(row, finalGroups[col].items.length - 1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          col = Math.max(col - 1, 0);
          row = Math.min(row, finalGroups[col].items.length - 1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          const item = finalGroups[col].items[row];
          if (item) {
            executeItem(item, e);
          }
        }
        setFocus([col, row]);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [finalGroups, focus, state, slashMode.slashDropdown]);

  const totalItems = [...activeGroups, ...extraGroups].reduce((acc, g) => acc + (g?.items?.length ?? 0), 0);
  if (totalItems === 0) {
    return (
      <div className="mx-auto w-full max-w-sm h-full flex flex-col items-center justify-center bg-[var(--color-containerBg)] rounded-xl border border-[#eee8d5] dark:border-white/10 shadow-sm transition-all duration-300 ease-in-out">
        <FaSearch
          size={24}
          className="text-neutral-300 dark:text-neutral-700 mb-2 transition-transform duration-300 hover:scale-110"
        />
        <span className="text-sm font-medium text-neutral-400 dark:text-neutral-600">No suggestions</span>
      </div>
    );
  }

  const SIDEBAR_ITEMS = [
    {
      id: 'all',
      label: 'All',
      icon: (isSelected: boolean) => (
        <svg
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200',
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    ...extraGroups.map(eg => ({
      id: String(eg.title).toLowerCase().replace(/\s+/g, ''),
      label: eg.title,
      icon: (isSelected: boolean) => (
        <div className={clsx(
          'w-4 h-4 shrink-0 transition-colors flex items-center justify-center',
          isSelected ? 'text-white' : 'text-neutral-400'
        )}>
          {eg.icon}
        </div>
      )
    })),
    {
      id: 'todos',
      label: 'Todos',
      icon: (isSelected: boolean) => (
        <BsCalendarCheck
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-neutral-400' : 'text-neutral-400/70 group-hover:text-neutral-400',
          )}
        />
      ),
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: (isSelected: boolean) => (
        <NotesIcon
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-amber-400' : 'text-amber-400/70 group-hover:text-amber-400',
          )}
        />
      ),
    },
    {
      id: 'snippets',
      label: 'Snippets',
      icon: (isSelected: boolean) => (
        <FaCode
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200',
          )}
        />
      ),
    },

    {
      id: 'links',
      label: 'Links',
      icon: (isSelected: boolean) => (
        <FaLink
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-blue-400' : 'text-blue-400/70 group-hover:text-blue-400',
          )}
        />
      ),
    },
    {
      id: 'sessions',
      label: 'Tab groups',
      icon: (isSelected: boolean) => (
        <FaLayerGroup
          className={clsx(
            "w-4 h-4 shrink-0 transition-colors",
            isSelected ? "text-white" : "text-[var(--color-iconDefault)] group-hover:text-white"
          )}
        />
      ),
    },
    {
      id: 'chat_agents',
      label: 'Chat Agents',
      icon: (isSelected: boolean) => (
        <FaRobot
          className={clsx(
            "w-4 h-4 shrink-0 transition-colors",
            isSelected ? "text-white" : "text-[var(--color-iconDefault)] group-hover:text-white"
          )}
        />
      ),
    },
    {
      id: 'commands',
      label: 'Commands',
      icon: (isSelected: boolean) => (
        <FaTerminal
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200',
          )}
        />
      ),
    },
    {
      id: 'bookmarks',
      label: 'Bookmarks',
      icon: (isSelected: boolean) => (
        <FaBookmark
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200',
          )}
        />
      ),
    },
    {
      id: 'automations',
      label: 'Automations',
      icon: (isSelected: boolean) => (
        <FiZap
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-amber-400' : 'text-amber-400/70 group-hover:text-amber-400',
          )}
        />
      ),
    },
  ];

  // Slash picker visible options
  const slashPickerFilterText = String(rawSearchValue.slice(1) || "").toLowerCase();
  const slashPickerOptions = Object.keys(SLASH_SECTION_META).filter(name => {
    const alias = SLASH_ALIAS_DISPLAY[name] || '';
    return String(name).toLowerCase().includes(slashPickerFilterText) || String(alias).toLowerCase().includes(slashPickerFilterText);
  });



  return (
    <div
      className="mx-auto w-full max-w-[1400px] h-full relative"
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onClick={e => {
        // log removed
        e.stopPropagation();
      }}
    >
      {onClose && !slashMode.slashDropdown && !hideCloseButton && (
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 z-[60] p-2 flex items-center justify-center text-red-500 hover:text-red-400 transition-transform hover:scale-110 cursor-pointer"
          title="Close Board View (Esc)"
        >
          <FiX size={22} strokeWidth={2.5} />
        </button>
      )}
      <div className={clsx(
        "w-full h-full flex items-stretch overflow-hidden transition-all duration-300 ease-in-out relative",
        (slashMode.slashDropdown || isEmbedded) ? "bg-transparent border-transparent shadow-none" : "bg-[var(--color-containerBg)] rounded-none border border-white/10 shadow-sm"
      )}>
        {/* Left Sidebar */}
        {!slashMode.slashDropdown && (
          <div className="w-[150px] shrink-0 flex flex-col border-r border-white/5 py-4 px-3 overflow-y-auto hover-scrollbar">
            {SIDEBAR_ITEMS.map(item => {
              const isSelected = effectiveSidebarSection === item.id;
              return (
                <button
                  key={item.id}
                  onPointerDown={e => e.stopPropagation()}
                  onPointerUp={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                  onMouseUp={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation();
                    console.log('[BoardView] sidebar tab clicked:', item.id, '— switching section, preserving query');
                    isSlashSelectedRef.current = false;
                    if (state?.onQueryChange) {
                      let searchText = rawSearchValue;
                      if (searchText.startsWith('/')) {
                        const spaceIdx = searchText.indexOf(' ');
                        if (spaceIdx !== -1) {
                          searchText = searchText.slice(spaceIdx + 1);
                        } else {
                          searchText = '';
                        }
                      }

                      const alias = SLASH_ALIAS_DISPLAY[item.id];
                      let newQuery = searchText;
                      if (alias) {
                        newQuery = `/${alias} ${searchText}`;
                        if (!searchText) newQuery = `/${alias} `;
                      }

                      if (newQuery !== rawSearchValue) {
                        state.onQueryChange(newQuery);
                      }
                    }
                    setSelectedSidebarSection(item.id);
                    setFocus([0, 0]); // Reset focus when switching tabs
                  }}
                  className={clsx(
                    'flex items-center gap-3 px-2 py-1.5 rounded-xl text-[13px] font-medium transition-colors cursor-pointer w-full text-left mb-1 group',
                    isSelected ? 'text-white bg-white/10' : 'text-neutral-400 hover:text-white hover:bg-white/5',
                  )}>
                  <div className="shrink-0 w-[22px] h-[22px] flex items-center justify-center">
                    {item.icon(isSelected)}
                  </div>
                  <span className="flex-1 tracking-tight truncate leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Board Content */}
        {!slashMode.slashDropdown && (
          <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-stretch gap-0 board-scrollbar">
            {finalGroups.map((group, colIdx) => (
              <div
                key={group.title}
                className={clsx(
                  "flex flex-col items-start flex-1 min-w-[260px] max-w-[400px] bg-transparent pr-4 pl-4 pt-4 pb-4 box-border",
                  !isEmbedded && "border-r border-white/10 last:border-r-0"
                )}>
                {/* Header */}
                <div className="w-full pb-1 mb-1 justify-between min-h-[32px] shrink-0 flex items-center box-border">
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="text-white/80 shrink-0 mr-3 flex items-center justify-center">{group.icon}</div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <h2 className="text-[14px] font-medium text-[var(--color-textPrimary)] tracking-tight leading-tight capitalize truncate flex items-center gap-1.5">
                        {group.title}
                        <span className="text-neutral-500 font-normal">· {group.items.length}</span>
                      </h2>
                    </div>
                  </div>
                  {isLoggedIn && ['todos', 'notes', 'snippets', 'links', 'sessions'].includes(String(group.title).toLowerCase()) && (
                    <button
                      onClick={e => handleCreateItem(String(group.title).toLowerCase(), e)}
                      className="shrink-0 p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title={`Create new ${String(group.title).toLowerCase().slice(0, -1)}`}>
                      <FaPlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Cards Scrollable Area */}
                <div className="flex-1 min-w-0 flex py-1 scroll-smooth box-border flex-col items-center overflow-y-auto overflow-x-hidden w-full gap-0 hide-scrollbar">
                  {group.items.length === 0 ? null : (
                    group.items.map((item: any, idx: number) => {
                      const rawTitle = getTitle(item);
                      const desc = getDesc(item);
                      const isFocused = focus[0] === colIdx && focus[1] === idx;
                      const kind = item._kind || item.type;

                      return (
                        <div
                          key={idx}
                          id={`board-item-${colIdx}-${idx}`}
                          style={{ pointerEvents: 'all' }}
                          onPointerDown={e => {
                            if (e.button === 2) return; // Allow right click for context menu
                            e.stopPropagation();
                            e.preventDefault();
                            executeItem(item, e as any);
                          }}
                          onMouseDown={e => {
                            if (e.button === 2) return;
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          onContextMenu={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenuState({
                              x: e.clientX,
                              y: e.clientY,
                              item,
                            });
                          }}
                          className="shrink-0 flex flex-col group cursor-pointer box-border relative w-full h-auto min-h-[32px] py-0.5 items-center">
                          <div
                            className={clsx(
                              "rounded-xl transition-all duration-200 overflow-hidden box-border h-full py-2 px-3 w-full flex flex-col justify-center text-left",
                              isFocused
                                ? "bg-white/10 shadow-md border border-white/10"
                                : "bg-transparent hover:bg-white/5 border border-transparent"
                            )}>
                            <div className="flex items-center justify-between min-w-0 w-full gap-2">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="shrink-0 w-[22px] h-[22px] flex items-center justify-center">
                                  {renderIcon(item)}
                                </div>
                                <span
                                  className={clsx(
                                    "text-[13px] tracking-tight truncate leading-tight flex-1 min-w-0 font-medium transition-colors duration-200",
                                    isFocused ? "text-white" : "text-neutral-200 group-hover:text-white"
                                  )}>
                                  {highlightMatch(rawTitle, query)}
                                </span>
                              </div>
                              {(kind === 'aiPrompt' || kind === 'chat_agent') && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    useUIStore.getState().openEditor({ type: 'aiPrompt', id: item.id || item.data?.id });
                                  }}
                                  className="text-neutral-400 hover:text-white transition-colors duration-150 cursor-pointer z-20 opacity-0 group-hover:opacity-100 mr-1.5"
                                  title="Edit Chat Agent"
                                >
                                  <FiEdit2 size={12} />
                                </div>
                              )}
                              {group.title === 'All' && (
                                <div className="shrink-0 bg-white/10 px-1.5 py-0.5 rounded text-[9px] text-neutral-400 capitalize tracking-wider font-medium">
                                  {getSuggestionLabel(item)}
                                </div>
                              )}
                            </div>
                            {kind === 'todo' ? (
                              <div className="flex flex-col min-w-0 w-full pl-[34px] mt-0.5 gap-0.5">
                                {renderTodoMetadata(item, isFocused)}
                              </div>
                            ) : desc ? (
                              <div className="flex min-w-0 w-full pl-[34px] mt-0.5">
                                <span
                                  className={clsx(
                                    "text-[11px] truncate w-full leading-relaxed transition-colors duration-200",
                                    isFocused ? "text-neutral-300" : "text-neutral-500"
                                  )}>
                                  {desc}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {/* end Cards Scrollable Area */}
              </div>
            ))}
          </div>
        )}
        {/* end Main Board Content */}
      </div>
      {/* end inner overflow-hidden board */}

      {/* ── Slash Category Launcher Dropdown ─────────────────────────────────────
          Outside the overflow-hidden inner board, so it is NEVER clipped.
          left-[150px] skips the sidebar; centered max-w-2xl in the content area.
      ───────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {slashMode.slashDropdown && (
          <>
            {/* Dim backdrop (invisible but catches clicks to close) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="absolute inset-0 z-[65] bg-transparent rounded-xl"
              onClick={() => state?.onQueryChange?.('')}
            />
            {/* Dropdown panel */}
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-[-16px] left-0 right-0 z-[70] flex justify-center px-6 pt-0">
              <div className="w-full max-w-[480px] min-[1600px]:max-w-[540px] min-[1800px]:max-w-2xl max-[1480px]:max-w-[440px] max-[1370px]:max-w-[400px] max-[1270px]:max-w-[360px] bg-[var(--color-containerBg)] border border-white/10 rounded-b-xl rounded-t-none shadow-2xl overflow-hidden flex flex-col">

                {/* Options */}
                <div className="flex flex-col py-1.5">
                  {slashPickerOptions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-neutral-500">No matching categories</div>
                  ) : (
                    slashPickerOptions.map((optName, idx) => {
                      const meta = SLASH_SECTION_META[optName];
                      const alias = SLASH_ALIAS_DISPLAY[optName] || '';
                      const isSelected = slashDropdownSelectedIndex === idx;
                      return (
                        <div
                          key={optName}
                          onClick={() => {
                            state?.onQueryChange?.(`/${alias} `);
                            setSlashDropdownSelectedIndex(-1);
                            requestAnimationFrame(() => {
                              focusSearchbarInput();
                            });
                          }}
                          onMouseEnter={() => setSlashDropdownSelectedIndex(idx)}
                          className={clsx(
                            'mx-2 px-3 py-2 flex items-center justify-start gap-3 cursor-pointer transition-colors rounded-none',
                            isSelected ? 'bg-white/5 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white',
                          )}>
                          <div className="flex items-center gap-3 w-[140px] shrink-0">
                            <div className="shrink-0 w-[22px] h-[22px] flex items-center justify-center opacity-80">
                              {meta.icon}
                            </div>
                            <span className="text-[13px] font-medium tracking-tight">{meta.title}</span>
                          </div>
                          {alias && (
                            <span
                              className={clsx(
                                'text-[11px] font-mono px-2 py-0.5 rounded-md border font-semibold tracking-wider min-w-[34px] text-center',
                                isSelected
                                  ? 'border-white/20 bg-white/10 text-white'
                                  : 'border-white/10 bg-white/5 text-neutral-400',
                              )}>
                              /{alias}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* ─────────────────────────────────────────────────────────────────────── */}

      {contextMenuState && (
        <UnifiedContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          onClose={() => {
            setContextMenuState(null);
            handleCancelEdit();
          }}
          actions={buildContextMenuActions(contextMenuState.item)}
          showSearch={!!userId}
          itemId={getItemCompoundId(contextMenuState.item)}
          hotkeyInput={
            editingHotkeyFor && contextMenuState.item
              ? {
                value: editValue,
                onChange: (e: React.KeyboardEvent<HTMLInputElement>) => {
                  const result = captureHotkey(e);
                  if (!result) return;
                  if (result === 'CANCEL') {
                    handleCancelEdit();
                  } else if (result) {
                    setEditValue(result as string);
                    setSaveError(null);
                  }
                },
                onSave: () => saveHotkey(contextMenuState.item, editValue),
                onCancel: handleCancelEdit,
                onOverwrite: handleOverwriteHotkey,
                isSaving: isSaving,
                isUpdating: isUpdatingHotkey,
                onClear: () => {
                  setEditValue('');
                  saveHotkey(contextMenuState.item, '', false);
                },
              }
              : undefined
          }
          shortcutInput={
            editingShortcutFor && contextMenuState.item
              ? {
                value: editValue,
                onChange: setEditValue,
                onSave: () => saveShortcut(contextMenuState.item, editValue),
                onCancel: handleCancelEdit,
                onOverwrite: handleOverwriteShortcut,
                isSaving: isSaving,
                isUpdating: isUpdatingShortcut,
              }
              : undefined
          }
          onNavigateAlreadyAssigned={handleGoToConflict}
          error={saveError || undefined}
          conflictId={conflictId}
        />
      )}
    </div>
  );
};

export default BoardView;
