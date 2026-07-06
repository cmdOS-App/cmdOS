import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppData } from '@src/hooks/useAppData';
import AutomationDynamicIcon from '../../../../shared-components/icons/automationDynamicIcon';
import {
  FiZap,
  FiPlus,
  FiSearch,
  FiX,
  FiFilter,
  FiLayers,
  FiSettings,
  FiPlay,
  FiStar,
  FiCommand,
  FiCheckSquare,
} from 'react-icons/fi';
import {
  FaCode,
  FaLink,
  FaCheckCircle,
  FaRegCircle,
  FaCheck,
  FaRegCalendarAlt,
  FaPaperclip,
  FaRegFileAlt,
  FaTerminal,
  FaBookmark,
  FaChevronDown,
  FaChevronUp,
  FaHistory,
  FaDownload,
  FaCog,
  FaPuzzlePiece,
  FaFlag,
  FaTag,
  FaInfoCircle,
  FaMemory,
  FaMicrochip,
  FaGamepad,
  FaKey,
  FaQuestionCircle,
  FaRobot,
  FaLayerGroup,
  FaGithub,
  FaCamera,
  FaExpand,
  FaImages,
  FaTable,
} from 'react-icons/fa';
import NotesIcon from '@src/components/NotesIcon';
import { getFaviconUrl } from '../../../AltS_search_newtab/src/components/searchSystemComponents/searchBarMain/utilityFunctions/utils';
import { extractUrlsFromSnippet } from '../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import { createSnippet as createLocalSnippet } from '../../../../allObjectFolder/src/createObject/snippets/snippetData';
import { getUserId } from '../../../../storage/_private/API/core/identity';
import { CMDOS_SIGN_UP_URL, CMDOS_SIGN_IN_URL } from '../../../../storage/_private/API/core/apiConfig';
import { buildUrl } from '../../../../shared-components/commands';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import cmdOSLogo from '../../../../shared-components/assets/tasklabs_logo.png';
import { TerminalIcon } from '../../../../shared-components/icons/terminalIcon';
import { UnifiedContextMenu, MenuAction } from '../../../../shared-components/ui/UnifiedContextMenu';
import { useUIStore } from '../../../../shared-components/uiStateManager';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { resolveEntityById } from '../../../../shared-components/utils/entityResolver';

import { BsKeyboard } from 'react-icons/bs';
import { LuSparkles } from 'react-icons/lu';
import { resolveWebPageContext } from '@src/utils/context';
import { PAGE_ACTION_ITEMS, executePageActionCommand, type AltQPageActionItem } from '@src/commands/pageActions';
import BoardView from '../../../../shared-components/BoardView/BoardView';

// Map command IDs to specific React Icons
const BROWSER_ICONS: Record<string, React.ReactNode> = {
  history: <FaHistory size={22} className="text-[#586e75] dark:text-neutral-400" />,
  downloads: <FaDownload size={22} className="text-[#586e75] dark:text-neutral-400" />,
  settings: <FaCog size={22} className="text-[#586e75] dark:text-neutral-400" />,
  extensions: <FaPuzzlePiece size={22} className="text-[#586e75] dark:text-neutral-400" />,
  bookmarks: <FaBookmark size={22} className="text-[#586e75] dark:text-neutral-400" />,
  flags: <FaFlag size={22} className="text-[#586e75] dark:text-neutral-400" />,
  inspect: <FaCode size={22} className="text-[#586e75] dark:text-neutral-400" />,
  version: <FaTag size={22} className="text-[#586e75] dark:text-neutral-400" />,
  about: <FaInfoCircle size={22} className="text-[#586e75] dark:text-neutral-400" />,
  tasks: <FaMemory size={22} className="text-[#586e75] dark:text-neutral-400" />,
  gpu: <FaMicrochip size={22} className="text-[#586e75] dark:text-neutral-400" />,
  dino: <FaGamepad size={22} className="text-[#586e75] dark:text-neutral-400" />,
  passwords: <FaKey size={22} className="text-[#586e75] dark:text-neutral-400" />,
  help: <FaQuestionCircle size={22} className="text-[#586e75] dark:text-neutral-400" />,
  ai: <FaRobot size={22} className="text-[#586e75] dark:text-neutral-400 object-contain" />,
};

// Icons for page-action commands (screenshot / download)
const PAGE_ACTION_ICONS: Record<string, React.ReactNode> = {
  capture_screenshot: <FaCamera size={14} className="text-sky-400" />,
  capture_full_screenshot: <FaExpand size={14} className="text-sky-400" />,
  downloadallimages: <FaImages size={14} className="text-emerald-400" />,
  downloadalltables: <FaTable size={14} className="text-amber-400" />,
};

// Alias map: alias (uppercase) → section name
const SECTION_ALIASES: Record<string, string> = {
  A: 'all',
  S: 'thissite',
  T: 'todos',
  C: 'commands',
  L: 'links',
  N: 'notes',
  AU: 'automations',
  B: 'bookmarks',
  SN: 'snippets',
  P: 'prompts',
};
// Reverse map: section name → alias display string
const SECTION_ALIAS_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SECTION_ALIASES).map(([alias, section]) => [section, alias]),
);

const mapFullNameToShortcut = (text: string): string => {
  const mapping: Record<string, string> = {
    '/all': '/a',
    '/todos': '/t',
    '/notes': '/n',
    '/automations': '/au',
    '/snippets': '/sn',
    '/prompts': '/p',
    '/links': '/l',
    '/commands': '/c',
    '/bookmarks': '/b',
  };
  const lower = text.toLowerCase();
  for (const [fullName, shortcut] of Object.entries(mapping)) {
    if (lower.startsWith(fullName)) {
      return shortcut + text.slice(fullName.length);
    }
  }
  return text;
};

// All valid filter shortcuts derived from SECTION_ALIASES (prefixed with /)
const FILTER_SHORTCUTS: string[] = Object.keys(SECTION_ALIASES).map(a => '/' + a.toLowerCase());

const FILTER_LABELS: Record<string, string> = {
  '/a': '/All',
  '/s': '/This Site',
  '/t': '/Todos',
  '/c': '/Commands',
  '/l': '/Links',
  '/n': '/Notes',
  '/au': '/Automations',
  '/b': '/Bookmarks',
  '/sn': '/Snippets',
  '/p': '/Prompts',
};

/** Returns tag label if current searchValue has an active tag, otherwise null */
function getActiveTagInfo(searchValue: string): { prefix: string; label: string; query: string } | null {
  const match = searchValue.match(/^\/[a-zA-Z]+/);
  if (!match) return null;
  const prefix = match[0];
  const rest = searchValue.slice(prefix.length);
  const lowerPrefix = prefix.toLowerCase();
  if (FILTER_SHORTCUTS.includes(lowerPrefix) && rest.startsWith(' ')) {
    return { prefix, label: FILTER_LABELS[lowerPrefix] || prefix, query: rest.slice(1) };
  }
  return null;
}

const normalizeUrl = (urlStr: unknown): string => {
  if (!urlStr || typeof urlStr !== 'string') return '';
  let target = urlStr.trim();
  if (!/^[a-zA-Z]+:\/\//.test(target)) {
    target = 'https://' + target;
  }
  try {
    const url = new URL(target);
    return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}${url.hash}`;
  } catch {
    return urlStr;
  }
};

const getDomain = (urlStr: string) => {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * Parse the current search value to determine the / mode state:
 *   - atDropdown: true when we show the category picker (no space yet)
 *   - activeSection: category activated by /ALIAS+Space, or null
 *   - searchQuery: text typed after the space for within-category search
 */
function parseAtMode(searchValue: string): {
  atDropdown: boolean;
  activeSection: string | null;
  searchQuery: string;
} {
  if (!searchValue.startsWith('/')) {
    return { atDropdown: false, activeSection: null, searchQuery: searchValue };
  }

  const textAfterAt = searchValue.slice(1);

  // Find longest matching alias prefix
  let bestAlias = '';
  let activeSection: string | null = null;

  for (const [alias, section] of Object.entries(SECTION_ALIASES)) {
    const upperText = textAfterAt.toUpperCase();
    const upperAlias = alias.toUpperCase();

    // Active if matches exactly followed by a space
    const matchWithSpace = upperText.startsWith(upperAlias + ' ');

    // Active if matches exactly with no space, but there is no longer alias starting with it
    const isPrefixOfLonger = Object.keys(SECTION_ALIASES).some(
      other => other.toUpperCase().startsWith(upperAlias) && other.length > alias.length,
    );
    const matchExactNoAmbiguity = upperText === upperAlias && !isPrefixOfLonger;

    if (matchWithSpace || matchExactNoAmbiguity) {
      if (alias.length > bestAlias.length) {
        bestAlias = alias;
        activeSection = section;
      }
    }
  }

  if (activeSection) {
    let query = textAfterAt.slice(bestAlias.length);
    if (query.startsWith(' ')) {
      query = query.slice(1);
    }
    return { atDropdown: false, activeSection, searchQuery: query };
  }

  return { atDropdown: true, activeSection: null, searchQuery: '' };
}

const SECTION_META: Record<string, { title: string; icon: React.ReactNode }> = {
  thissite: { title: 'This Site', icon: <FaRegFileAlt className="w-4 h-4 shrink-0" /> },
  todos: { title: 'Todos', icon: <FaCheckCircle className="w-4 h-4 shrink-0" /> },
  prompts: { title: 'Prompts', icon: <FaFlag className="w-4 h-4 shrink-0" /> },
  automations: { title: 'Automations', icon: <FiZap className="w-4 h-4 shrink-0" /> },
  notes: { title: 'Notes', icon: <NotesIcon className="w-4 h-4 shrink-0" /> },
  links: { title: 'Links', icon: <FaLink className="w-4 h-4 shrink-0" /> },
  snippets: { title: 'Snippets', icon: <FaCode className="w-4 h-4 shrink-0" /> },
  bookmarks: { title: 'Bookmarks', icon: <FaBookmark className="w-4 h-4 shrink-0" /> },
  commands: { title: 'Commands', icon: <FaTerminal className="w-4 h-4 shrink-0" /> },
};

const formatTodoDate = (deadlineStr?: string, isDone?: boolean) => {
  if (!deadlineStr) return { text: 'No due date', badge: 'Anytime', isToday: false };
  try {
    const date = new Date(deadlineStr.replace(' ', 'T'));
    if (isNaN(date.getTime())) return { text: deadlineStr, badge: 'Due', isToday: false };

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear();

    if (isDone) {
      return { text: `Completed · ${timeStr}`, badge: 'Done', isToday: false };
    }

    if (isToday) {
      return { text: `Due ${timeStr}`, badge: 'Today', isToday: true };
    } else if (isTomorrow) {
      return { text: `Due ${timeStr}`, badge: 'Tomorrow', isToday: false };
    } else {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = days[date.getDay()];
      return { text: `Due ${timeStr}`, badge: dayName, isToday: false };
    }
  } catch {
    return { text: 'No due date', badge: 'Anytime', isToday: false };
  }
};

const extractTodoMetadata = (item: any) => {
  let linkCount = 0;
  let autoCount = 0;
  let noteCount = 0;

  const urls = extractUrlsFromSnippet(item);
  if (urls && urls.length > 0) {
    linkCount = urls.length;
  }

  if (
    item.automation_id ||
    item.automation ||
    (item.automation_steps && item.automation_steps.length > 0) ||
    (item.steps && item.steps.length > 0)
  ) {
    autoCount = item.automation_steps?.length || item.steps?.length || 1;
  }

  if (
    item.category?.toLowerCase() === 'note' ||
    (typeof item.value === 'string' && item.value.length > 50 && !urls.length)
  ) {
    noteCount = 1;
  }

  return { linkCount, autoCount, noteCount };
};

interface AppProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}


const App: React.FC<AppProps> = ({ isOpen, onClose, theme }) => {
  const [searchValue, setSearchValue] = useState('');
  const [autoTriggerDropdown, setAutoTriggerDropdown] = useState(true);

  const updateSearchValueAndFocus = (val: string) => {
    setSearchValue(val);
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        const len = searchInputRef.current.value.length;
        searchInputRef.current.setSelectionRange(len, len);
      }
    }, 10);
  };

  // Load autoTriggerDropdown and view mode preference on mount
  useEffect(() => {
    chrome.storage.local.get(['rtq_focus_on', 'rtq_view_mode'], res => {
      if (res.rtq_focus_on !== undefined) {
        setAutoTriggerDropdown(res.rtq_focus_on);
      }
      if (res.rtq_view_mode !== undefined) {
      }
    });
  }, []);

  // Autofill search bar with '/' when opened if auto-trigger is enabled
  useEffect(() => {
    if (isOpen) {
      setGithubOrgSubAction(null); // Reset active Github Org flow on open
      if (autoTriggerDropdown) {
        setSearchValue('/');
        // Focus the input and position cursor at the end
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            const len = searchInputRef.current.value.length;
            searchInputRef.current.setSelectionRange(len, len);
          }
        }, 10);
      } else {
        setSearchValue('');
      }
    } else {
      setGithubOrgSubAction(null); // Reset active Github Org flow on close
    }
  }, [isOpen, autoTriggerDropdown]);

  const [showAllSections, setShowAllSections] = useState(false);
  const [dropdownSelectedIndex, setDropdownSelectedIndex] = useState(0);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [selectedSidebarSection, setSelectedSidebarSection] = useState<string>('all');
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement | null>(null);
  const [recordingState, setRecordingState] = useState<any>(null);
  const [draftStepsCount, setDraftStepsCount] = useState<number>(0);

  // Click outside listener for settings dropdown
  useEffect(() => {
    if (!isSettingsDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsDropdownRef.current) {
        const path = event.composedPath();
        if (!path.includes(settingsDropdownRef.current)) {
          setIsSettingsDropdownOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsDropdownOpen]);
  const [allBookmarks, setAllBookmarks] = useState<any[]>([]);
  const [showAddExistingModal, setShowAddExistingModal] = useState(false);
  const [addExistingUrl, setAddExistingUrl] = useState('');
  const [addExistingTitle, setAddExistingTitle] = useState('');

  const [activeTabUrl, setActiveTabUrl] = useState('');
  const [activeTabTitle, setActiveTabTitle] = useState('');

  // Track current GitHub Org subAction selection state
  // We use this to override search results with extracted repository options
  const [githubOrgSubAction, setGithubOrgSubAction] = useState<{
    orgName: string;
    subAction: 'open' | 'issue' | 'settings';
  } | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState('local_user');
  useEffect(() => {
    getUserId()
      .then(uid => setUserId(uid))
      .catch(() => setUserId(''));
  }, []);

  const selectedTeam = useUIStore((s: any) => s.selectedTeam) as any;
  const allWorkspaces = useDbStore(state => state.workspaces);

  // Derive the workspace to save new links into.
  // Prefer the selected team's first workspace, otherwise fall back to the first Dexie workspace.
  const defaultWorkspaceId = useMemo(() => {
    const selectedWorkspaceId = selectedTeam?.workspaces?.[0]?.workspace_id;
    if (selectedWorkspaceId) return selectedWorkspaceId;
    return allWorkspaces[0]?.id || null;
  }, [allWorkspaces, selectedTeam]);

  const [optimisticSavedUrls, setOptimisticSavedUrls] = useState<string[]>([]);
  const { automations, notes, snippets, todos, links, toggleTodoOptimistic } = useAppData();
  const globalCommands = useDbStore(state => state.commands);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const isBackspaceHandlingRef = useRef(false);

  const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; item: any; title: string } | null>(
    null,
  );

  // Fetch bookmarks from Chrome API when popup opens
  useEffect(() => {
    if (!isOpen) return;
    const chromeAny = (window as any)?.chrome;

    if (chromeAny?.bookmarks?.getTree) {
      chromeAny.bookmarks.getTree((tree: any) => {
        const list: any[] = [];
        const traverse = (nodes: any[]) => {
          nodes.forEach(node => {
            if (node.url) {
              list.push({
                id: node.id,
                name: node.title || node.url,
                url: node.url,
                isBookmark: true,
              });
            }
            if (node.children) {
              traverse(node.children);
            }
          });
        };
        traverse(tree);
        setAllBookmarks(list);
      });
      return;
    }

    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage({ action: 'bookmarks_get_tree' }, (response: any) => {
        if (chromeAny.runtime.lastError || !response?.ok || !Array.isArray(response.results)) {
          return;
        }
        const list = response.results.map((n: any) => ({
          id: n.id || String(Math.random()),
          name: (n.title || '').trim() || n.url,
          url: n.url,
          isBookmark: true,
        }));
        setAllBookmarks(list);
      });
    }

    try {
      const topUrl = (window.top as any)?.location?.href || window.location.href || '';
      const topTitle = (window.top as any)?.document?.title || document.title || 'Untitled Page';
      if (topUrl && !topUrl.startsWith('chrome-extension://')) {
        setActiveTabUrl(topUrl);
        setActiveTabTitle(topTitle);
      } else {
        throw new Error('Fallback');
      }
    } catch (_) {
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.runtime?.sendMessage) {
        chromeAny.runtime.sendMessage(
          { action: 'tabs_query', queryOptions: { active: true, currentWindow: true } },
          (response: any) => {
            const activeTab = response?.results?.[0];
            if (activeTab) {
              setActiveTabUrl(activeTab.url || '');
              setActiveTabTitle(activeTab.title || 'Untitled Page');
            }
          },
        );
      }
    }
  }, [isOpen]);

  useEffect(() => {
    chrome.storage.local.get(['accessToken'], res => {
      setIsLoggedIn(!!res.accessToken);
    });
    const listener = (changes: any, areaName: string) => {
      if (areaName === 'local') {
        if (changes.accessToken) {
          setIsLoggedIn(!!changes.accessToken.newValue);
        }
      }
    };
    const chromeAny = (window as any)?.chrome;
    chromeAny?.storage?.onChanged?.addListener(listener);
    return () => {
      chromeAny?.storage?.onChanged?.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['automation_recording_state', 'automation_draft_steps_count'], (res: any) => {
        setRecordingState(res.automation_recording_state || null);
        setDraftStepsCount(res.automation_draft_steps_count || 0);
      });
      const handleChange = (changes: any, area: string) => {
        if (area === 'local') {
          if (changes.automation_recording_state) {
            setRecordingState(changes.automation_recording_state.newValue || null);
          }
          if (changes.automation_draft_steps_count) {
            setDraftStepsCount(changes.automation_draft_steps_count.newValue || 0);
          }
        }
      };
      chromeAny.storage.onChanged.addListener(handleChange);
      return () => chromeAny.storage.onChanged.removeListener(handleChange);
    }
    return undefined;
  }, []);

  const safeList = (list: any) => (Array.isArray(list) ? list : []);

  const allCommands = useMemo(() => {
    const map = new Map();
    globalCommands.forEach(c => map.set(c.id, { ...c, isGlobal: true, name: c.label }));
    // Page-action commands (screenshot, download) — always available, run in current page context
    PAGE_ACTION_ITEMS.forEach(c => map.set(c.id, c));

    return Array.from(map.values());
  }, [globalCommands]);

  const filteredCommands = useMemo(() => {
    // Always separate page-action commands — they must never be sliced away
    const pageActionCmds = allCommands.filter(c => (c as any).category === 'page_action');
    const otherCmds = allCommands.filter(c => (c as any).category !== 'page_action');

    const effectiveSearchValue = searchValue.startsWith('/') ? '' : searchValue;

    const getCategoryPriority = (c: any) => {
      const cat = (c.category || '').toLowerCase();
      if (cat === 'page_action') return 1;
      if (cat === 'ai' && c.id !== 'ai') return 2;
      if (cat === 'browser') return 3;
      if (c.isGlobal === false) return 4; // Local app commands
      if (cat === 'thissite_action') return 5;
      return 6; // Other global commands
    };

    if (!effectiveSearchValue.trim()) {
      const sortedCmds = [...pageActionCmds, ...otherCmds].sort((a, b) => {
        return getCategoryPriority(a) - getCategoryPriority(b);
      });

      return sortedCmds.slice(0, 40);
    }

    const lower = effectiveSearchValue.toLowerCase();
    const core = lower.replace(/^\//, '');

    // Match page-action items against label, prefix, id AND keywords
    const matchedPageActions = pageActionCmds.filter(
      c =>
        c.label.toLowerCase().includes(core) ||
        c.prefix.toLowerCase().includes(core) ||
        String(c.id).toLowerCase().includes(core) ||
        ((c as any).keywords as string[] | undefined)?.some((kw: string) => kw.toLowerCase().includes(core)),
    );

    const matchedOthers = otherCmds.filter(
      c =>
        c.id !== 'ai' &&
        (c.label.toLowerCase().includes(core) ||
          c.prefix.toLowerCase().includes(core) ||
          String(c.id).toLowerCase().includes(core)),
    );

    const matchedAll = [...matchedPageActions, ...matchedOthers].sort((a, b) => {
      return getCategoryPriority(a) - getCategoryPriority(b);
    });

    return matchedAll.slice(0, 40);
  }, [allCommands, searchValue]);

  const filtered = useMemo(() => {
    const { atDropdown, activeSection, searchQuery } = parseAtMode(searchValue);

    // When a section is activated via /ALIAS+Space, use searchQuery for filtering
    // When normal search, use searchValue directly
    const effectiveSearchValue = atDropdown
      ? ''
      : activeSection !== null
        ? searchQuery
        : searchValue.startsWith('/')
          ? ''
          : searchValue;

    const filter = (list: any[]) => {
      if (!effectiveSearchValue.trim()) return list;
      const lower = effectiveSearchValue.toLowerCase();
      return list.filter(
        item =>
          (item.name || item.key || item.title || '').toLowerCase().includes(lower) ||
          (item.description || (typeof item.value === 'string' ? item.value : '') || '').toLowerCase().includes(lower),
      );
    };

    const allSnippets = safeList(snippets);
    const actualSnippets = allSnippets.filter(s => (s.category || '').toLowerCase() !== 'prompt');
    const actualPrompts = allSnippets.filter(s => (s.category || '').toLowerCase() === 'prompt');

    const activeDomain = getDomain(activeTabUrl);
    const activeNormalized = normalizeUrl(activeTabUrl);

    // Detect AI chat sites
    const isChatSite = activeDomain && ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'chat.openai.com', 'perplexity.ai'].some(domain => activeDomain.includes(domain));

    // Use raw links (not filtered) so saved-state is NEVER affected by search input.
    const allRawLinks = safeList(links);
    const filteredLinks = filter(allRawLinks);

    // isAlreadySaved is computed against the full raw link list, independent of search.
    const isAlreadySaved = !!(
      activeNormalized &&
      (optimisticSavedUrls.some(u => normalizeUrl(u) === activeNormalized) ||
        allRawLinks.some(link => {
          const urls = extractUrlsFromSnippet(link);
          return urls.some((u: string) => normalizeUrl(u) === activeNormalized);
        }))
    );

    const thisSiteItems: any[] = [];
    if (activeNormalized && activeDomain && !activeTabUrl.startsWith('chrome-extension://')) {
      if (isLoggedIn) {
        if (isAlreadySaved) {
          thisSiteItems.push({ 
            id: 'saved_indicator', 
            name: 'Already Saved', 
            category: 'thissite_indicator',
            icon: <FaCheck className="w-4 h-4 shrink-0 text-gray-400" />
          });
        } else {
          if (isChatSite) {
            thisSiteItems.push({ 
              id: 'save_chat', 
              name: 'Do you want to save the current chat? (Chatagent)', 
              category: 'thissite_action',
              icon: <FaLink className="w-4 h-4 shrink-0 text-gray-400" />
            });
          }
          thisSiteItems.push({ 
            id: 'save_link', 
            name: 'Save This Link', 
            category: 'thissite_action',
            icon: <FaLink className="w-4 h-4 shrink-0 text-gray-400" />
          });
        }
        thisSiteItems.push({ 
          id: 'add_to_existing', 
          name: 'Add to Existing', 
          category: 'thissite_action',
          icon: <FiPlus className="w-4 h-4 shrink-0 text-gray-400" />
        });
      }
      thisSiteItems.push({ 
        id: 'summarize_page', 
        name: 'Summarize This Page', 
        category: 'thissite_action',
        icon: <FaInfoCircle className="w-4 h-4 shrink-0 text-gray-400" />
      });

      if (recordingState?.active) {
        thisSiteItems.push({
          id: 'recording-action',
          name: 'Click the element to add in automations',
          category: 'thissite_action',
          centerBadge: 'Draft Automation',
          rightBadge: draftStepsCount,
          icon: <FaLayerGroup className="w-4 h-4 shrink-0 text-gray-400" />
        });
      }

      // Resolve webpage context (e.g., GitHub repo page details)
      const webContext = resolveWebPageContext(activeTabUrl, activeTabTitle);

      // Add custom GitHub actions if on any github.com page
      if (webContext.site === 'github') {
        const username = document.querySelector('meta[name="user-login"]')?.getAttribute('content') || '';
        thisSiteItems.push(
          {
            id: 'github_open_settings',
            name: 'Open Settings',
            category: 'thissite_action',
            url: 'https://github.com/settings',
          },
          {
            id: 'github_create_repo',
            name: 'Create Repository',
            category: 'thissite_action',
            url: 'https://github.com/new',
          },
          {
            id: 'github_open_profile',
            name: 'Open Profile',
            category: 'thissite_action',
            url: username ? `https://github.com/${username}` : 'https://github.com',
          },
          {
            id: 'github_create_org',
            name: 'Create an Organization',
            category: 'thissite_action',
            url: 'https://github.com/organizations/new',
          },
        );
      }

      // If we are on a recognized GitHub repository page, pull matching registered commands
      if (webContext.site === 'github' && webContext.pageType === 'repository') {
        const owner = webContext.metadata.owner;
        const repo = webContext.metadata.repo;
        const repoPath = `${owner}/${repo}`;

        const contextCmds = globalCommands.filter((cmd: any) => cmd.site === 'github' && cmd.pageType === 'repository');

        contextCmds.forEach(cmd => {
          let urlPattern = '';
          if (cmd.id === 'github_create_issue') {
            urlPattern = `https://github.com/${repoPath}/issues/new`;
          } else if (cmd.id === 'github_create_pr') {
            urlPattern = `https://github.com/${repoPath}/compare`;
          } else if (cmd.id === 'github_open_settings') {
            urlPattern = `https://github.com/${repoPath}/settings`;
          }

          if (urlPattern) {
            thisSiteItems.push({
              id: cmd.id,
              name: `${cmd.label} in ${repoPath}`,
              category: 'thissite_action',
              url: urlPattern,
              executeId: cmd.id,
            });
          }
        });
      }

      // If we are on a recognized GitHub organization page, add org repository search workflows
      if (webContext.site === 'github' && webContext.pageType === 'organization') {
        const orgName = webContext.metadata.organization;
        thisSiteItems.push(
          {
            id: 'github_org_open_repo',
            name: `Open Repository...`,
            category: 'thissite_action',
            executeId: 'github_org_action',
            orgName,
            subAction: 'open',
          },
          {
            id: 'github_org_create_issue',
            name: `Create Issue In...`,
            category: 'thissite_action',
            executeId: 'github_org_action',
            orgName,
            subAction: 'issue',
          },
          {
            id: 'github_org_open_settings',
            name: `Open Repository Settings...`,
            category: 'thissite_action',
            executeId: 'github_org_action',
            orgName,
            subAction: 'settings',
          },
        );
      }
    }

    // If user is inside a GitHub organization sub-action flow, we override
    // the returned data mapping so that only organization repositories show up
    if (githubOrgSubAction) {
      const webContext = resolveWebPageContext(activeTabUrl, activeTabTitle);
      const rawRepos = webContext.metadata.repositories || [];

      const filterText = (searchValue.startsWith('/') ? '' : searchValue).toLowerCase().trim();
      const matchedRepos = filterText ? rawRepos.filter(r => r.name.toLowerCase().includes(filterText)) : rawRepos;

      const mappedRepoActions = matchedRepos.map(repo => {
        let repoUrl = repo.url;
        if (githubOrgSubAction.subAction === 'issue') {
          repoUrl = `${repo.url}/issues/new`;
        } else if (githubOrgSubAction.subAction === 'settings') {
          repoUrl = `${repo.url}/settings`;
        }

        return {
          id: `gh_org_repo_${repo.name}`,
          name: repo.name,
          category: 'thissite_action',
          url: repoUrl,
        };
      });

      return {
        thissite: mappedRepoActions,
        automations: [],
        notes: [],
        todos: [],
        links: [],
        snippets: [],
        prompts: [],
        bookmarks: [],
        commands: [],
      };
    }

    return {
      thissite: thisSiteItems,
      automations: filter(safeList(automations)).slice(0, 30),
      notes: filter(safeList(notes)).slice(0, 30),
      todos: filter(safeList(todos).filter(t => !t.is_done)).slice(0, 30),
      links: filteredLinks.slice(0, 30),
      snippets: filter(actualSnippets).slice(0, 30),
      prompts: filter(actualPrompts).slice(0, 30),
      bookmarks: filter(safeList(allBookmarks)).slice(0, 30),
      commands: filteredCommands,
    };
  }, [
    automations,
    notes,
    snippets,
    todos,
    links,
    searchValue,
    allBookmarks,
    filteredCommands,
    activeTabUrl,
    optimisticSavedUrls,
    isLoggedIn,
    githubOrgSubAction,
  ]);

  const sections = useMemo(() => {
    let currentStart = 0;
    const result: { name: string; start: number; count: number }[] = [];
    const { atDropdown, activeSection, searchQuery } = parseAtMode(searchValue);
    const effectiveSearchValue = atDropdown
      ? ''
      : activeSection !== null
        ? searchQuery
        : searchValue.startsWith('/')
          ? ''
          : searchValue;

    const addSection = (name: string) => {
      if (result.some(s => s.name === name)) return;
      const itemsLength = filtered[name as keyof typeof filtered]?.length || 0;

      // During search: only show sections that have matching results.
      if (effectiveSearchValue.trim() && itemsLength === 0) {
        return;
      }

      const hasNewButton = name !== 'bookmarks' && name !== 'commands';
      // During search, don't add "new" button slot — only real items count
      const count = effectiveSearchValue.trim() ? itemsLength : itemsLength + (hasNewButton ? 1 : 0);

      if (count > 0) {
        result.push({ name, start: currentStart, count });
        currentStart += count;
      }
    };

    if (githubOrgSubAction) {
      // Show only 'thissite' repository list during github organization flows
      result.push({ name: 'thissite', start: 0, count: filtered.thissite.length });
      return result;
    }

    if (effectiveSearchValue.trim() || showAllSections || activeSection === 'all') {
      const allKeys = [
        'thissite',
        'todos',
        'commands',
        'links',
        'notes',
        'automations',
        'bookmarks',
        'snippets',
        'prompts',
      ];
      allKeys.forEach(name => {
        addSection(name);
      });
    } else if (activeSection && activeSection !== 'all') {
      // @ALIAS+Space activated — show only that section
      addSection(activeSection);
    } else {
      // 1. Show priority sections if they have data (or always for commands)
      const primary = ['thissite', 'todos', 'commands', 'links', 'notes', 'automations'];
      primary.forEach(name => {
        if (result.length >= 5) return;
        if (name === 'commands' || (filtered[name as keyof typeof filtered]?.length || 0) > 0) {
          addSection(name);
        }
      });

      // 2. Fill up to 5 slots with fallbacks
      const fillers = ['bookmarks', 'snippets', 'prompts'];
      fillers.forEach(name => {
        if (result.length >= 5) return;
        addSection(name);
      });
    }

    return result;
  }, [filtered, showAllSections, searchValue, githubOrgSubAction]);

  const dropdownOptions = useMemo(() => {
    const { atDropdown } = parseAtMode(searchValue);
    if (!atDropdown) return { thisSiteActions: [], categories: [], totalList: [] };

    const filterText = searchValue.slice(1).toLowerCase();

    // 1. "This Site" action items - Only show when input is exactly '/'
    const thisSiteActions =
      filterText !== ''
        ? []
        : (filtered.thissite || []).map((item: any) => ({
          type: 'action',
          id: item.id,
          name: item.name,
          item: item,
        }));

    // 2. Categories (excluding 'thissite' since it's displayed directly as actions)
    const categoryNames = [
      'all',
      'todos',
      'commands',
      'links',
      'notes',
      'automations',
      'bookmarks',
      'snippets',
      'prompts',
    ];
    const categories = categoryNames
      .filter(name => {
        if (!filterText) return true;
        const alias = SECTION_ALIAS_DISPLAY[name] || '';
        return name.toLowerCase().startsWith(filterText) || alias.toLowerCase().startsWith(filterText);
      })
      .map(name => ({
        type: 'category',
        id: name,
        name: name,
      }));

    return {
      thisSiteActions,
      categories,
      totalList: [...categories, ...thisSiteActions],
    };
  }, [searchValue, filtered.thissite]);



  // Reset dropdown selected index when search value changes so that it always starts at the first item (Categories)
  useEffect(() => {
    setDropdownSelectedIndex(0);
  }, [searchValue]);

  // Auto-scroll selected dropdown item into view when keyboard navigating
  useEffect(() => {
    if (dropdownSelectedIndex < 0) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`altq-dropdown-item-${dropdownSelectedIndex}`);
      if (el) {
        el.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
        });
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [dropdownSelectedIndex]);

  const handleCreateNew = (type: string) => {
    const typeMap: Record<string, string> = {
      link: 'createlinks',
      note: 'createnotes',
      snippet: 'createsnippet',

      todo: 'createtodo',
    };
    const mappedType = typeMap[type.toLowerCase()];
    if (!mappedType) return;
    chrome.runtime.sendMessage({ type: 'tasklabs:open-create-menu', creatorType: mappedType });
    onClose();
  };

  const handleStartSession = useCallback(
    async (item: any, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const sessionId = item.snippet_id || item.id;
      const sessionName = item.key || item.name || item.title || 'Untitled Tab group';
      const workspaceId = item.workspace_id || defaultWorkspaceId;
      const folderId = item.folder_id || null;

      let initialUrls: string[] = [];
      let initialNames: string[] = [];
      let openSettings = item.sessionOpenSettings;

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

      if (initialUrls.length === 0) {
        try {
          const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
          if (Array.isArray(parsed)) {
            initialUrls = parsed.map((l: any) => l.url || l);
            initialNames = parsed.map((l: any) => l.name || '');
          } else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.urls)) initialUrls = parsed.urls;
            if (Array.isArray(parsed.names)) initialNames = parsed.names;
          }
        } catch (err) { }
      }

      if (initialUrls.length === 0) {
        initialUrls = extractUrlsFromSnippet(item);
      }

      // Save prefill to local storage perfectly mimicking create session
      await new Promise<void>(resolve => {
        chrome.storage.local.set(
          {
            pending_session_prefill: {
              title: sessionName,
              sessionId: sessionId,
            },
          },
          () => resolve(),
        );
      });

      chrome.runtime.sendMessage(
        {
          action: 'start_session',
          sessionId,
          sessionName,
          workspaceId,
          folderId: folderId || null,
          teamId: selectedTeam?.team_id,
          storageMode: selectedTeam?.storageMode ?? 'cloud',
          initialUrls,
          initialNames,
          openSettings,
        },
        response => {
          // Show a toast
          const toastId = `altq-session-toast-${Date.now()}`;
          const toast = document.createElement('div');
          toast.id = toastId;
          const count = initialUrls.length;
          toast.textContent = `🚀 Tab group "${sessionName}" started with ${count} tab${count !== 1 ? 's' : ''}`;
          toast.style.cssText =
            'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:8px 20px;border-radius:20px;z-index:2147483647;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
          document.body.appendChild(toast);
          setTimeout(() => {
            toast.remove();
          }, 2500);
        },
      );

      onClose();
    },
    [defaultWorkspaceId, selectedTeam, onClose],
  );

  const handleExecute = (item: any, e?: React.MouseEvent | KeyboardEvent) => {
    e?.preventDefault();
    const isCtrl = e && 'ctrlKey' in e && (e.ctrlKey || e.metaKey);

    // ── Page-action commands (screenshot / download) ──────────────────────
    // These run directly on the current page via chrome.runtime.sendMessage.
    // They cannot be routed through AltS_search_newtab/index.html.
    if (item.category === 'page_action') {
      e?.stopPropagation();
      executePageActionCommand(item as AltQPageActionItem, onClose);
      return true;
    }

    if (item.category === 'thissite_indicator') {
      e?.stopPropagation();
      return;
    }

    if (item.category === 'thissite_action') {
      e?.stopPropagation();
      if (item.id === 'recording-action') {
        onClose();
        const chromeAny = (window as any).chrome;
        if (chromeAny?.runtime && chromeAny?.storage?.local) {
          chromeAny.runtime.sendMessage({ type: 'GET_TAB_ID' }, (tabId: any) => {
            chromeAny.storage.local.get(['automation_recording_state'], (res: any) => {
              const currentState = res.automation_recording_state;
              if (currentState) {
                chromeAny.storage.local.set({
                  automation_recording_state: {
                    ...currentState,
                    select_mode: true,
                    targetTabId: tabId,
                    timestamp: Date.now(),
                  },
                });
              }
            });
          });
        }
        return;
      }

      // Handle GitHub Org subaction selection workflow
      if (item.executeId === 'github_org_action' && item.subAction) {
        setGithubOrgSubAction({ orgName: item.orgName, subAction: item.subAction });
        setSearchValue(''); // Clear query to display the matching repos
        return;
      }

      let tabUrl = activeTabUrl;
      let tabTitle = activeTabTitle;

      if (!tabUrl) {
        try {
          tabUrl = (window.top as any)?.location?.href || window.location.href || '';
          tabTitle = (window.top as any)?.document?.title || document.title || 'Untitled Page';
        } catch (_) { }
      }

      const getFallbackWorkspaceId = (): string | null => defaultWorkspaceId || allWorkspaces[0]?.id || null;

      const proceed = async (url: string, title: string) => {
        if (item.url) {
          chrome.runtime.sendMessage({ action: 'open_tab', url: item.url, active: !isCtrl }, () => {
            if (chrome.runtime.lastError && !isCtrl) {
              window.open(item.url, '_blank');
            }
          });
          setGithubOrgSubAction(null); // Clear active flow
          onClose();
          return;
        }

        if (item.id === 'save_link' || item.id === 'save_chat') {
          try {
            setOptimisticSavedUrls(prev => [...prev, url]);
            let wsId = getFallbackWorkspaceId();
            await createLocalSnippet({
              workspaceId: wsId || undefined,
              title,
              config: JSON.stringify({ urls: [url] }),
              tagIds: [],
            });
            const toastId = `altq-toast-${Date.now()}`;
            const toast = document.createElement('div');
            toast.id = toastId;
            toast.textContent = item.id === 'save_chat' ? '💬 Chat saved successfully' : '🔖 Link saved to this site';
            toast.style.cssText =
              'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a73e8;color:white;padding:8px 20px;border-radius:20px;z-index:2147483647;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
            document.body.appendChild(toast);
            setTimeout(() => {
              toast.remove();
            }, 2500);
          } catch (err) {
            console.warn('[AltQ-Trigger] updateSnippetRealtime failed:', err);
          }
        } else if (item.id === 'add_to_existing') {
          setAddExistingUrl(url);
          setAddExistingTitle(title);
          setShowAddExistingModal(true);
        } else if (item.id === 'summarize_page') {
          // Perform full context scraping and AI dispatching
          const defaultPrompt = 'Summarize the main points, key takeaways, and outline of this page.';

          chrome.runtime.sendMessage({ action: 'scrape_page_content' }, (scrapeRes: any) => {
            const pageContent = scrapeRes?.ok && typeof scrapeRes.content === 'string' ? scrapeRes.content : '';

            const enhancedPrompt = pageContent
              ? `User Question: ${defaultPrompt}

I'm looking at a webpage titled "${title}" (${url}).

Here is the page content for context:
---
${pageContent}
---`
              : `Summarize this page for me: ${url}`;

            chrome.storage.local.get('selectedAIs', (result: any) => {
              const selection =
                result.selectedAIs && Array.isArray(result.selectedAIs) && result.selectedAIs.length > 0
                  ? result.selectedAIs
                  : ['gpt'];

              const finalIds = selection.filter((id: string) => id !== 'ai');

              const getBaseAIUrl = (kind?: string): string => {
                if (kind === 'chatgpt') return 'https://chatgpt.com/';
                if (kind === 'claude') return 'https://claude.ai/new';
                if (kind === 'gemini') return 'https://gemini.google.com/app';
                if (kind === 'perplexity') return 'https://www.perplexity.ai/';
                return '';
              };

              const links = finalIds
                .map((id: string) => globalCommands.find(c => c.id === id))
                .filter((cmd: any): cmd is any => Boolean(cmd))
                .map((cmd: any) => {
                  const targetUrl = cmd.autoSubmit
                    ? getBaseAIUrl(cmd.autoSubmit) || cmd.urlTemplate.replace('{query}', '')
                    : cmd.urlTemplate.replace('{query}', encodeURIComponent(enhancedPrompt));

                  if (cmd.autoSubmit) {
                    return {
                      url: targetUrl,
                      autoSubmit: {
                        kind: cmd.autoSubmit,
                        prompt: enhancedPrompt,
                      },
                    };
                  }
                  return { url: targetUrl };
                });

              if (links.length > 0) {
                const hasAutoSubmit = links.some((l: any) => Boolean(l.autoSubmit));
                const delay = hasAutoSubmit ? 1200 : 200;

                chrome.runtime.sendMessage({
                  action: 'open_multiple_links',
                  links,
                  delay,
                });
              } else {
                // Fallback to ChatGPT
                chrome.runtime.sendMessage({
                  action: 'open_tab_with_auto_submit',
                  url: 'https://chatgpt.com/',
                  autoSubmit: {
                    kind: 'chatgpt',
                    prompt: enhancedPrompt,
                  },
                  active: true,
                });
              }
            });
          });
          onClose();
        }
      };

      if (tabUrl) {
        proceed(tabUrl, tabTitle);
      } else {
        chrome.runtime.sendMessage(
          { action: 'tabs_query', queryOptions: { active: true, currentWindow: true } },
          response => {
            const activeTab = response?.results?.[0];
            proceed(activeTab?.url || '', activeTab?.title || 'Untitled Page');
          },
        );
      }
      return;
    }

    if (item.isNew) {
      handleCreateNew(item.section);
      return;
    }

    // ── BoardView command items (gpt, claude, gemini, perplexity, history, downloads, etc.) ──
    // These items have _kind: 'command' and store their full definition in item.command
    if (item._kind === 'command') {
      const cmdDef = item.command || item;
      const cmdId: string = cmdDef.id || item.id || '';
      const urlTemplate: string = cmdDef.urlTemplate || '';
      const cmdCategory: string = (cmdDef.category || '').toLowerCase();

      console.log('[handleExecute] BoardView command item clicked:', {
        cmdId,
        cmdCategory,
        urlTemplate,
        commandType: item.commandType,
        hasQueryPlaceholder: urlTemplate.includes('{query}'),
      });

      if (cmdCategory === 'browser' && urlTemplate && !urlTemplate.includes('{query}')) {
        // Browser chrome:// pages — open directly (history, downloads, extensions, etc.)
        console.log('[handleExecute] → Opening browser page directly:', urlTemplate);
        chrome.runtime.sendMessage({ action: 'open_tab', url: urlTemplate, active: !isCtrl }, () => {
          if (chrome.runtime.lastError && !isCtrl) window.open(urlTemplate, '_blank');
          if (!isCtrl) onClose();
        });
      } else if (urlTemplate && urlTemplate.includes('{query}')) {
        // Query-based command (gpt, claude, gemini, perplexity, google, youtube, etc.)
        // Open newtab with command locked so the user can type their query
        const lockUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?lock_command=${encodeURIComponent(cmdId)}`);
        console.log('[handleExecute] → Locking command in new tab:', lockUrl);
        chrome.runtime.sendMessage({ action: 'open_tab', url: lockUrl, active: !isCtrl }, () => {
          if (chrome.runtime.lastError && !isCtrl) window.open(lockUrl, '_blank');
          if (!isCtrl) onClose();
        });
      } else {
        // Local commands (createnotes, createlinks, agent, profile, etc.)
        console.log('[handleExecute] → Local command, opening newtab to trigger:', cmdId);
        const triggerUrl = chrome.runtime.getURL(
          `AltS_search_newtab/index.html?trigger_hotkey=true&type=command&id=${encodeURIComponent(cmdId)}`
        );
        chrome.runtime.sendMessage({ action: 'open_tab', url: triggerUrl, active: !isCtrl }, () => {
          if (chrome.runtime.lastError && !isCtrl) window.open(triggerUrl, '_blank');
          if (!isCtrl) onClose();
        });
      }
      /* removed sync onClose */
      return true;
    }

    if (item.is_todo_type || (item.category || '').toLowerCase() === 'todo') {
      const url = chrome.runtime.getURL('AltS_search_newtab/index.html?open_create=true');
      chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
        if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
        if (!isCtrl) onClose();
      });
      /* removed sync onClose */
      return;
    }

    let cat = (item.category || item.snippet_category || '').toLowerCase();

    if (item.isGlobal !== undefined && !cat) {
      cat = 'command';
    }

    if (!cat && item.url) {
      cat = 'bookmark';
    }
    if (cat === 'bookmark' || cat === 'open_url') {
      const urlsToOpen = item.url ? item.url.split(',').filter(Boolean) : [];
      if (urlsToOpen.length > 0) {
        urlsToOpen.forEach((url: string) => {
          chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
            if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
            if (!isCtrl) onClose();
          });
        });
      }
    } else if (
      ['link', 'collection', 'agent_collection'].includes(cat)
    ) {
      const urls = extractUrlsFromSnippet(item);
      if (urls && urls.length > 0) {
        urls.forEach((url: string) => {
          chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
            if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
            if (!isCtrl) onClose();
          });
        });
      }
    } else if (['note', 'snippet'].includes(cat)) {
      const snippetId = String(item.snippet_id || item.id || item.todo_id || '');
      const url = chrome.runtime.getURL(
        `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
      );
      chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
        if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
        if (!isCtrl) onClose();
      });
    } else if (
      ['command', 'module', 'automation', 'install', 'agent', 'chat_agent', 'custom', 'ai'].includes(cat) ||
      !!(item.automation_steps || item.steps || item.automation)
    ) {
      const triggerId = String(item.value || item.snippet_id || item.id || item.todo_id || '');
      const triggerType = cat === 'custom' || cat === 'ai' ? 'note' : cat || 'automation';
      // Preserve Global URL template commands (like /google)
      if (cat === 'command' && item.isGlobal && item.urlTemplate) {
        const url = buildUrl(item.urlTemplate, searchValue);
        if (url) {
          chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
            if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
            if (!isCtrl) onClose();
          });
        }
      } else if (cat === 'ai' || ['gpt', 'claude', 'gemini', 'perplexity'].includes(item.id)) {
        // Matches BoardView behavior for ChatGPT, Claude, etc.
        const url = chrome.runtime.getURL(`AltS_search_newtab/index.html?lock_command=${encodeURIComponent(item.id)}`);
        chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
          if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
          if (!isCtrl) onClose();
        });
      } else {
        const url = chrome.runtime.getURL(
          `AltS_search_newtab/index.html?trigger_hotkey=true&type=${triggerType}&id=${encodeURIComponent(triggerId)}`,
        );
        chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
          if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
          if (!isCtrl) onClose();
        });
      }
    } else {
      // Fallback
      const urls = extractUrlsFromSnippet(item);
      if (urls && urls.length > 0) {
        urls.forEach((url: string) => {
          chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
            if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
            if (!isCtrl) onClose();
          });
        });
      } else {
        const snippetId = String(item.snippet_id || item.id || item.todo_id || '');
        const url = chrome.runtime.getURL(
          `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
        );
        chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
          if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
          if (!isCtrl) onClose();
        });
      }
    }

    /* removed sync onClose */
    return true;
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, item: any, title: string) => {
    e.preventDefault();
    setContextMenuState({ x: e.clientX, y: e.clientY, item, title });
  }, []);

  const handleToggleTodo = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    const sid = String(item.id || item.snippet_id || item.todo_id);
    const newStatus = !item.is_done;
    toggleTodoOptimistic(sid, newStatus);
    try {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        const storage = await new Promise<any>(resolve =>
          chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve),
        );
        const updateTodoList = (list: any[] = []) =>
          list.map(todo => {
            const todoId = String(todo.id || todo.snippet_id || todo.todo_id);
            return todoId === sid ? { ...todo, is_done: newStatus } : todo;
          });

        await new Promise<void>(resolve =>
          chromeAny.storage.local.set(
            {
              local_todos: updateTodoList(storage.local_todos || []),
              cached_todos: updateTodoList(storage.cached_todos || []),
            },
            resolve,
          ),
        );
      }
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (err) {
      console.warn('[AltQ] Failed to toggle todo status:', err);
      toggleTodoOptimistic(sid, !newStatus);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSettingsDropdownOpen) {
          setIsSettingsDropdownOpen(false);
          e.stopPropagation();
          return;
        }
        onClose();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, isSettingsDropdownOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDropdownActive = parseAtMode(searchValue).atDropdown;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 flex items-center justify-center z-[2147483647] bg-black/60 backdrop-blur-[1px]">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          ref={mainContainerRef}
          initial={{ scale: 0.96, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 15 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="w-[75vw] min-w-[900px] max-w-[95vw] h-[85vh] flex flex-col bg-[#0B0C10] border border-[#2A2B33] rounded-none shadow-2xl overflow-hidden relative font-['Inter',_sans-serif] text-[14px] leading-normal text-left text-white antialiased box-border m-0 p-0 popup-main-container">
          {/* Top Left Branding */}
          <div className="absolute top-7 left-8 flex items-center z-50 select-none">
            <img src={cmdOSLogo} alt="cmdOS" className="h-6 w-auto" />
            <span className="text-lg font-bold text-white tracking-wide ml-2">cmdOS</span>
          </div>

          {/* Left Sidebar (Board View Only) */}
          {!isDropdownActive && false && (
            <div className="absolute left-0 top-20 bottom-0 w-[160px] flex flex-col px-4 z-40 border-r border-[#2A2B33] overflow-y-auto hover-scrollbar">
              <div className="flex flex-col space-y-1 mt-4 pb-8">
                {/* All Option */}
                <button
                  onClick={() => setSelectedSidebarSection('all')}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer',
                    selectedSidebarSection === 'all'
                      ? 'text-white bg-white/10 font-medium'
                      : 'text-[#A1A6B3] font-normal hover:text-white hover:bg-white/5',
                  )}>
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                  All
                </button>
                {[
                  'thissite',
                  'todos',
                  'commands',
                  'links',
                  'notes',
                  'automations',
                  'bookmarks',
                  'snippets',
                  'prompts',
                ].map(sectionName => {
                  const meta = SECTION_META[sectionName] || {
                    title: sectionName,
                    icon: <FaCheckCircle className="w-4 h-4 shrink-0" />,
                  };
                  const isSelected = selectedSidebarSection === sectionName;
                  return (
                    <button
                      key={sectionName}
                      onClick={() => setSelectedSidebarSection(sectionName)}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer',
                        isSelected
                          ? 'text-white bg-white/10 font-medium'
                          : 'text-[#A1A6B3] font-normal hover:text-white hover:bg-white/5',
                      )}>
                      {meta.icon}
                      {meta.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Right Action Buttons */}
          <div className="absolute top-6 right-6 flex items-center gap-1.5 z-[100]">

            {/* Settings Dropdown Button */}
            <div ref={settingsDropdownRef} className="relative">
              <button
                onClick={e => {
                  e.preventDefault();
                  setIsSettingsDropdownOpen(!isSettingsDropdownOpen);
                }}
                className={clsx(
                  'w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer focus:outline-none',
                  isSettingsDropdownOpen
                    ? 'bg-white/15 text-white'
                    : 'bg-transparent hover:bg-white/10 text-[#A1A6B3] hover:text-white',
                )}
                title="Settings">
                <FiSettings className="w-5 h-5" />
              </button>

              {isSettingsDropdownOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-[280px] rounded-xl shadow-2xl z-[9999] p-3 flex flex-col gap-3 border border-[#2A2B33] bg-[#171821] animate-in fade-in slide-in-from-top-1 zoom-in-95 duration-150 text-left">


                  <div className="flex flex-col gap-2 px-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">Command-first search</span>
                        <span className="text-[9px] font-medium bg-neutral-800 text-[#A1A6B3] px-1.5 py-0.5 rounded border border-[#2A2B33]">
                          Suggested
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          const newVal = !autoTriggerDropdown;
                          setAutoTriggerDropdown(newVal);
                          chrome.storage.local.set({ rtq_focus_on: newVal });
                        }}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer flex items-center ${autoTriggerDropdown ? 'bg-emerald-500' : 'bg-[#2A2B33]'
                          }`}>
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${autoTriggerDropdown ? 'translate-x-4' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-start gap-2 text-[10px] text-[#A1A6B3] leading-normal">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                      <div className="flex flex-col gap-1">
                        <span>Clicking search opens command-first results so you can narrow choices faster.</span>
                        <span className="text-[9px] text-[#8B8F9D]">Turn off to use normal search results.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center bg-transparent hover:bg-red-500/10 text-red-500 hover:text-red-400 transition-colors rounded-lg cursor-pointer focus:outline-none"
              title="Close (Esc)">
              <FiX className="w-5 h-5" />
            </button>
          </div>
          {/* Ultra-Compact Search Bar */}
          <div
            className={clsx(
              'px-8 pt-6 pb-4 shrink-0 flex justify-center relative',
              false && 'ml-[160px]',
            )}>
            <div className="relative flex items-center bg-[#0B0C10] border border-[#2A2B33] h-[52px] rounded-[16px] px-6 group w-full max-w-xl transition-colors shadow-2xl focus-within:border-white/30 z-[60]">
              <FiSearch className="w-4 h-4 text-[#A1A6B3] mr-3 shrink-0" />
              <div className="relative flex-1 h-full flex items-center">
                {/* Active Tag Pill — real DOM node so cursor positions correctly after it */}
                {(() => {
                  const tagInfo = getActiveTagInfo(searchValue);
                  if (!tagInfo) return null;
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(156, 163, 175, 0.15)',
                        border: '1.5px solid #9ca3af',
                        color: '#9ca3af',
                        borderRadius: '6px',
                        padding: '1px 6px',
                        fontWeight: 700,
                        marginRight: '6px',
                        fontFamily: 'sans-serif',
                        fontSize: '12px',
                        lineHeight: 1,
                        height: '20px',
                        flexShrink: 0,
                        userSelect: 'none',
                      }}>
                      {tagInfo.label}
                    </span>
                  );
                })()}

                {/* Highlight Overlay — only when no active tag (colours the /prefix text) */}
                {
                  !getActiveTagInfo(searchValue) &&
                  (() => {
                    const prefixMatch = searchValue.match(/^\/[a-zA-Z]+/);
                    return (
                      <div className="absolute inset-0 pointer-events-none select-none whitespace-pre flex items-center text-[15px] font-semibold text-transparent font-sans">
                        {prefixMatch ? (
                          <>
                            <span className="text-white align-middle font-bold">{prefixMatch[0]}</span>
                            <span className="text-white align-middle">{searchValue.slice(prefixMatch[0].length)}</span>
                          </>
                        ) : (
                          <span className="text-white align-middle">{searchValue}</span>
                        )}
                      </div>
                    );
                  })()}

                <input
                  ref={searchInputRef}
                  type="text"
                  value={getActiveTagInfo(searchValue)?.query ?? searchValue}
                  onChange={e => {
                    const tagInfo = getActiveTagInfo(searchValue);
                    if (tagInfo) {
                      // Tag is active — update only the query portion
                      setSearchValue(tagInfo.prefix + ' ' + e.target.value);
                      return;
                    }

                    let val = mapFullNameToShortcut(e.target.value);
                    const prevVal = searchValue;
                    let spaceAppended = false;

                    if (val.length > prevVal.length) {
                      const m = val.match(/^\/([a-zA-Z]+)$/);
                      if (m) {
                        const typedAlias = m[1].toUpperCase();
                        const isPrefixOfLongerAlias = Object.keys(SECTION_ALIASES).some(
                          otherAlias => otherAlias.startsWith(typedAlias) && otherAlias.length > typedAlias.length,
                        );
                        if (SECTION_ALIASES[typedAlias] && !isPrefixOfLongerAlias) {
                          val = val + ' ';
                          spaceAppended = true;
                        }
                      }
                    }

                    setSearchValue(val);

                    if (spaceAppended) {
                      setTimeout(() => {
                        if (searchInputRef.current) {
                          const len = searchInputRef.current.value.length;
                          searchInputRef.current.setSelectionRange(len, len);
                        }
                      }, 10);
                    }

                    if (val === '') {
                      setSelectedSidebarSection('all');
                    } else if (val === '/' && prevVal.startsWith('/') && prevVal.length > 1) {
                      setSelectedSidebarSection('all');
                    } else {
                      const { activeSection } = parseAtMode(val);
                      if (activeSection) {
                        setSelectedSidebarSection(activeSection);
                      }
                    }
                  }}
                  onKeyDown={e => {
                    e.stopPropagation();

                    const tagInfo = getActiveTagInfo(searchValue);
                    // Backspace on empty query → unlock tag back to its prefix (e.g. "/l")
                    if (e.key === 'Backspace' && tagInfo && tagInfo.query === '') {
                      e.preventDefault();
                      updateSearchValueAndFocus(tagInfo.prefix);
                      return;
                    }

                    const { atDropdown, activeSection, searchQuery } = parseAtMode(searchValue);

                    if (e.key === 'Enter' && activeSection && !searchQuery.trim()) {
                      e.preventDefault();
                      setSearchValue('');
                      return;
                    }

                    if (atDropdown) {
                      const totalList = dropdownOptions.totalList;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setDropdownSelectedIndex(prev => (prev + 1) % totalList.length);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setDropdownSelectedIndex(prev => (prev - 1 + totalList.length) % totalList.length);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (totalList.length > 0) {
                          const selectedIdx = Math.max(0, Math.min(dropdownSelectedIndex, totalList.length - 1));
                          const chosen = totalList[selectedIdx];
                          if (chosen.type === 'action') {
                            handleExecute((chosen as any).item);
                            setSearchValue('');
                            setDropdownSelectedIndex(-1);
                          } else {
                            const alias = SECTION_ALIAS_DISPLAY[chosen.id] || '';
                            updateSearchValueAndFocus(`/${alias} `);
                            setDropdownSelectedIndex(-1);
                          }
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setSearchValue('');
                        setDropdownSelectedIndex(-1);
                      }
                    }
                  }}
                  onKeyUp={e => e.stopPropagation()}
                  placeholder={searchValue ? '' : 'Search across spaces & apps'}
                  className={clsx(
                    'flex-1 min-w-0 bg-transparent border-none text-[15px] font-semibold caret-white placeholder-[#8B8F9D] focus:outline-none focus:ring-0 h-full z-10',
                    !!getActiveTagInfo(searchValue) ? 'text-white' : 'text-transparent',
                  )}
                />
              </div>
              {(
                <div className="relative group/dot shrink-0 ml-2">
                  {/* Small slash button */}
                  <button
                    onMouseEnter={() => setIsSettingsDropdownOpen(true)}
                    onClick={() => {
                      const newVal = !autoTriggerDropdown;
                      setAutoTriggerDropdown(newVal);
                      chrome.storage.local.set({ rtq_focus_on: newVal });
                    }}
                    className="relative w-7 h-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors text-sm font-semibold focus:outline-none">
                    <span>/</span>
                  </button>
                </div>
              )}
            </div>

            {/* At Command Dropdown — shown only when typing alias and no matching category yet */}
            {parseAtMode(searchValue).atDropdown && (
              <div className="absolute top-[80px] left-1/2 -translate-x-1/2 w-full max-w-xl bg-[#171821] border border-white/10 rounded-xl shadow-2xl z-[70] overflow-hidden flex flex-col pt-0 pb-2 backdrop-blur-xl max-h-[360px] overflow-y-auto custom-scrollbar">
                {(() => {
                  if (dropdownOptions.totalList.length === 0) {
                    return <div className="px-4 py-3 text-sm text-neutral-500">No matching categories or actions</div>;
                  }

                  return (
                    <>
                      {/* 1. "Categories" Heading and Category Options */}
                      {dropdownOptions.categories.length > 0 && (
                        <>
                          <div className="px-4 py-1 flex items-center justify-between border-b border-white/5 mb-1">
                            <span className="text-[10px] text-neutral-400 font-bold tracking-wide ">Categories</span>
                          </div>
                          {dropdownOptions.categories.map((opt, idx) => {
                            const globalIdx = idx;
                            const isSelected = dropdownSelectedIndex === globalIdx;
                            const optName = opt.name;
                            const isAll = optName === 'all';
                            const meta = isAll
                              ? {
                                title: 'All',
                                icon: (
                                  <svg
                                    className="w-4 h-4 shrink-0"
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
                              }
                              : SECTION_META[optName] || {
                                title: optName,
                                icon: <FaCheckCircle className="w-4 h-4 shrink-0" />,
                              };
                            const alias = SECTION_ALIAS_DISPLAY[optName] || '';

                            return (
                              <div
                                key={optName}
                                id={`altq-dropdown-item-${globalIdx}`}
                                onClick={() => {
                                  updateSearchValueAndFocus(`/${alias} `);
                                  setDropdownSelectedIndex(-1);
                                }}
                                onMouseEnter={() => setDropdownSelectedIndex(globalIdx)}
                                className={clsx(
                                  'px-4 py-2 flex items-center justify-between cursor-pointer transition-colors mx-2 rounded-lg font-medium',
                                  isSelected
                                    ? 'bg-white/5 text-white'
                                    : 'text-neutral-400 hover:bg-white/5 hover:text-white',
                                )}>
                                <div className="flex items-center gap-3">
                                  {meta.icon}
                                  <span className="text-sm font-medium">{meta.title}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {alias && (
                                    <span
                                      className={clsx(
                                        'text-[11px] font-mono px-2 py-0.5 rounded-md border font-semibold tracking-wider min-w-[28px] text-center',
                                        isSelected
                                          ? 'border-white/20 bg-white/10 text-white'
                                          : 'border-white/10 bg-white/5 text-neutral-400',
                                      )}>
                                      /{alias}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* 2. "This Section" Heading and Action Items */}
                      {dropdownOptions.thisSiteActions.length > 0 && (
                        <>
                          <div className="px-4 py-1 flex items-center justify-between border-b border-white/5 mb-1 mt-2">
                            <span className="text-[10px] text-neutral-400 font-bold tracking-wide ">This Section</span>
                          </div>
                          {dropdownOptions.thisSiteActions.map((opt, idx) => {
                            const globalIdx = dropdownOptions.categories.length + idx;
                            const isSelected = dropdownSelectedIndex === globalIdx;
                            const icon =
                              opt.id === 'save_link' ? (
                                <FaLink className="w-4 h-4 shrink-0 text-[#A1A6B3]" />
                              ) : opt.id === 'saved_indicator' ? (
                                <FaCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                              ) : opt.id === 'add_to_existing' ? (
                                <FaLink className="w-4 h-4 shrink-0 text-[#A1A6B3]" />
                              ) : opt.id === 'summarize_page' ? (
                                <LuSparkles className="w-4 h-4 shrink-0 text-purple-400" />
                              ) : (
                                <FaRegFileAlt className="w-4 h-4 shrink-0 text-neutral-400" />
                              );

                            return (
                              <div
                                key={opt.id}
                                id={`altq-dropdown-item-${globalIdx}`}
                                onClick={() => {
                                  handleExecute(opt.item);
                                  setSearchValue('');
                                  setDropdownSelectedIndex(-1);
                                }}
                                onMouseEnter={() => setDropdownSelectedIndex(globalIdx)}
                                className={clsx(
                                  'px-4 py-2 flex items-center justify-between cursor-pointer transition-colors mx-2 rounded-lg font-medium',
                                  isSelected
                                    ? 'bg-white/5 text-white'
                                    : 'text-neutral-400 hover:bg-white/5 hover:text-white',
                                )}>
                                <div className="flex items-center gap-3">
                                  {icon}
                                  <span className="text-sm font-medium">{opt.name}</span>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          {/* Scrollable Content Area */}
          {!parseAtMode(searchValue).atDropdown && (
            <BoardView
              hideCloseButton={true}
              isEmbedded={true}
              includeWebsitePageActions={true}
              searchValue={searchValue}
              unfilteredSuggestions={[]}
              isLoggedIn={isLoggedIn}
              onClose={onClose}
              onExecuteItem={handleExecute}
              state={{
                value: searchValue,
                isVisible: true,
                suggestions: [
                  ...filtered.todos.map(t => ({ ...t, _kind: 'todo', type: 'todo' })),
                  ...filtered.notes.map(n => ({ ...n, _kind: 'snippet', type: 'snippet', snippet: n })),
                  ...filtered.links.map(l => ({ ...l, _kind: 'bookmark', type: 'bookmark' })),
                  ...filtered.snippets.map(s => ({ ...s, _kind: 'snippet', type: 'snippet', snippet: s })),
                  ...filtered.commands.map(c => ({ ...c, _kind: 'command', command: c })),
                  ...filtered.automations.map(a => ({ ...a, _kind: 'automation', type: 'automation', snippet: a })),
                  ...filtered.bookmarks.map(b => ({ ...b, _kind: 'bookmark', type: 'bookmark' })),
                  ...filtered.prompts.map(p => ({ ...p, _kind: 'snippet', type: 'snippet', snippet: p })),
                ],
                highlightIndex: 0,
                mode: 'mixed',
                onQueryChange: (val: string) => {
                  const mapped = mapFullNameToShortcut(val);
                  updateSearchValueAndFocus(mapped);
                },
                onSnippetSelect: (item: any) => handleExecute(item),
                onCommonCommandSelect: (item: any) => handleExecute(item),
                onRequestOpenUrls: (urls: string[], title?: string) => {
                  if (urls && urls.length > 0) {
                    chrome.tabs.create({ url: urls[0] });
                    if (onClose) onClose();
                  }
                }
              } as any}
              extraGroups={[
                {
                  title: 'This Site',
                  items: filtered.thissite,
                  icon: <FaRegFileAlt className="w-4 h-4 shrink-0 text-sky-400" />,
                },
              ]}
            />
          )}

          {/* Footer Indications */}
          {!isDropdownActive && (
            <div
              className={clsx(
                'relative flex items-center justify-between gap-3 px-8 py-2.5 border-t border-[#2A2B33] bg-[#0E0F14]/85 backdrop-blur text-[10px] font-medium flex-shrink-0 text-[#8B8F9D]',
                'pl-[188px]',
              )}>
              {/* Left: Keyboard shortcuts */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#A1A6B3]">Navigate</span>
                  <span className="flex items-center gap-0.5">
                    <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                      ↑
                    </span>
                    <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                      ↓
                    </span>
                    <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                      ←
                    </span>
                    <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                      →
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#A1A6B3]">Select</span>
                  <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                    Enter
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#A1A6B3]">Close</span>
                  <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                    Esc
                  </span>
                </div>
              </div>

              {/* Right: Options */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#A1A6B3]">Options</span>
                <span className="flex items-center gap-0.5">
                  <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                    Right Click
                  </span>
                </span>
              </div>
            </div>
          )}
        </motion.div>



        <style
          dangerouslySetInnerHTML={{
            __html: `
          .no-scrollbar::-webkit-scrollbar { display: none !important; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          
          .custom-horizontal-scrollbar::-webkit-scrollbar {
            height: 8px;
            width: 0px;
          }
          .custom-horizontal-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-horizontal-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 9999px;
          }
          .custom-horizontal-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgba(255, 255, 255, 0.5);
          }
        `,
          }}
        />
      </motion.div>

      {contextMenuState && (
        <UnifiedContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          showSearch={true}
          portalContainer={(window as any).__ALTQ_PORTAL_HOST__ || document.body}
          onClose={() => setContextMenuState(null)}
          actions={[
            {
              key: 'run',
              label: 'Run command',
              icon: <FiPlay size={14} />,
              onSelect: () => handleExecute(contextMenuState.item),
            },
            { key: 'div-0', label: '', icon: null, onSelect: () => { }, divider: true },
            {
              key: 'favorite',
              label: 'Mark as favorite',
              icon: <FiStar size={14} />,
              onSelect: () => {
                // Implementation for toggle favorite via postMessage to parent
              },
            },
            { key: 'div-1', label: '', icon: null, onSelect: () => { }, divider: true },
            {
              key: 'assign-shortcut',
              label: 'Assign command',
              icon: <FiCommand size={14} className="text-green-600 dark:text-green-400" />,
              className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
              onSelect: () => { },
            },
            {
              key: 'assign-hotkey',
              label: 'Assign hotkey',
              icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
              className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
              onSelect: () => { },
            },
            {
              key: 'create-todo',
              label: 'Create Todo',
              icon: <FiCheckSquare size={14} className="text-neutral-500 dark:text-neutral-400" />,
              onSelect: () => { },
            },
          ]}
        />
      )}
    </AnimatePresence>
  );
};

export default App;
