import React, { forwardRef, useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { AnimatePresence, motion } from 'framer-motion';


import { AI_GROUP, type CommandId } from '../../components/searchSystemComponents/searchBarMain/commandConfigurations/commands';
import { getCommandKeywords } from '../../components/searchSystemComponents/searchBarMain/commandConfigurations/commandKeywords';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
type Folder = any; type Workspace = any;
type Snippet = any;
import DefaultContainer, {
  type CommandInteractiveItem,
  type DefaultContainerHandle,
  type DefaultContainerProps,
  type InteractiveSection,
  type SnippetInteractiveItem,
  type InteractiveItem,
} from './defaultContainer';
import { 
  buildSnippetSuggestion,
  buildSuggestionKey,
  extractUrlsFromSnippet,
  getSnippetPreview,
    isLinkCategory,
  isNoteCategory,
  isTabGroupCategory,
  resolveSnippetIcon,
 } from '../../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import type {  SnippetActionDetail, SnippetSuggestion  } from '../../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import type { LocalCommandId } from '../../components/searchSystemComponents/searchBarMain/commandConfigurations/localCommands';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { findCommandByAnyId } from '../../../../../shared-components/commands';
import type { CommandRecord } from '../../../../../allObjectFolder/src/createObject/commands/commandTypes';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';

import { useChromeStorage } from '@extension/shared/lib/hooks';
import {
  FaRegFolder,
  FaFolderOpen,
  FaHistory,
  FaDownload,
  FaCog,
  FaPuzzlePiece,
  FaBookmark,
  FaFlag,
  FaCode,
  FaTag,
  FaInfoCircle,
  FaMemory,
  FaMicrochip,
  FaGamepad,
  FaKey,
  FaQuestionCircle,
} from 'react-icons/fa';
import { isSameDay } from 'date-fns';
import { BsCalendarCheck } from 'react-icons/bs';

interface HomeViewProps {
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
  onCommandPreview?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections' | null) => void;
  onSnippetSelect: (item: SnippetSuggestion) => void;
  onRequestSnippetDelete: (detail: SnippetActionDetail) => void;
  onRequestFocusSearch?: () => void;
  onRequestOpenUrls?: (urls: string[], title?: string) => void;
  onRequestLinkEdit?: (suggestion: SnippetSuggestion) => void;
  onHighlightChange?: (item: InteractiveItem | null) => void;
  inlineNotification?: { message: string; type: 'success' | 'error' | 'info' | 'warning' } | null;
  isCommandLocked?: boolean;
  isPromptMenuOpen?: boolean;
  isAtMenuOpen?: boolean;
  isSuggestionVisible?: boolean;
  onNavigateToListView?: (category: 'commands', section?: string) => void;
  isLoggedIn: boolean;
}

export type HomeViewHandle = DefaultContainerHandle;

// Match AltS DefaultMainView: include local create-note/create-link commands as well
const COMMAND_SHORTLIST: Array<CommandId | LocalCommandId | 'ai' | 'collections'> = [
  'ai',
  // 'todo',
  'collections',
];
const NOTE_LIMIT = 6;
const LINK_LIMIT = 6;
const FAV_LIMIT = 6;

const COMMAND_DESCRIPTIONS: Partial<Record<string, string>> = {
  gpt: 'Jump straight into a new ChatGPT conversation.',
  perplexity: 'Search with Perplexity AI assistant.',
  ai: 'Search across all AI assistants at once.',
  google: 'Search the web with Google.',
  event: 'Create a Google Calendar event quickly.',
  createnotes: 'Capture a reusable snippet right from search.',
  createlinks: 'Group your go-to websites and launch in a click.',
  createsession: 'Save and manage multiple tabs in a tab group.',
  agent: 'Open the AI agent interface.',
  todo: 'Manage your personal tasks and reminders.',
  collections: 'Access all your saved collections and snippets.',
} as const;

const useHomeSnippets = () => {
  const selectedFolderId = useUIStore((s: any) => s.selectedFolderId);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const snippets = useDbStore(state => state.snippets);

  return useMemo(() => {
    const folderById = new Map(folders.map(folder => [folder.id, folder]));
    const workspaceById = new Map(workspaces.map(workspace => [workspace.id, workspace]));
    const visibleSnippets = selectedFolderId
      ? snippets.filter(snippet => String(snippet.folderId ?? '') === String(selectedFolderId))
      : snippets;

    return visibleSnippets
      .map(snippet => {
        const workspaceRecord = workspaceById.get(snippet.workspaceId);
        if (!workspaceRecord) return null;

        const folderRecord = snippet.folderId ? folderById.get(snippet.folderId) ?? null : null;
        const snippetDate = new Date(snippet.updatedAt || snippet.createdAt || Date.now()).toISOString();
        return {
          workspace: {
            workspace_id: workspaceRecord.id,
            workspace_name: workspaceRecord.workspaceName,
            folders: [],
            workspace_snippets: [],
            workspace_automations: [],
          } as Workspace,
          folder: folderRecord
            ? ({
                folder_id: folderRecord.id,
                folder_name: folderRecord.folderName,
                snippets: [],
                automations: [],
                folders: [],
              } as Folder)
            : null,
          snippet: {
            id: snippet.id,
            key: snippet.title,
            value: snippet.config,
            category: 'snippet',
            user_id: '',
            first_name: '',
            last_name: null,
            created_at: snippetDate,
            updated_at: snippetDate,
            tags: null,
            snippet_id: snippet.id,
            workspaceId: snippet.workspaceId,
            folderId: snippet.folderId,
            title: snippet.title,
            config: snippet.config,
            tagIds: snippet.tagIds,
          } as Snippet,
        };
      })
      .filter(Boolean) as Array<{ workspace: Workspace; folder: Folder | null; snippet: Snippet }>;
  }, [selectedFolderId, workspaces, folders, snippets]);
};

const HomeView = React.memo(
  forwardRef<HomeViewHandle, HomeViewProps>(
    (
      {
        onQuickCommandSelect,
        onCommandPreview,
        onSnippetSelect,
        onRequestSnippetDelete,
        onRequestFocusSearch,
        onRequestOpenUrls,
        onRequestLinkEdit,
        onHighlightChange,
        inlineNotification,
        isCommandLocked,
        isAtMenuOpen,
        isSuggestionVisible,
        onNavigateToListView,
        isLoggedIn,
      },
      ref,
    ) => {
      const teamSnippets = useHomeSnippets();
      const selectedFolderId = useUIStore((s: any) => s.selectedFolderId);
      const commandStatus = useUIStore((s: any) => s.commandStatus);
      const selectedFolderRecord = useDbStore(state =>
        selectedFolderId ? state.folders.find(folder => folder.id === selectedFolderId) ?? null : null,
      );

      const [todoCounts, setTodoCounts] = useState<{ overdue: number; done: number; total: number }>({
        overdue: 0,
        done: 0,
        total: 0,
      });

      // Helper to parse task dates safely
      const parseTaskDate = (d: string | undefined) => {
        if (!d) return new Date(0);
        return new Date(String(d).replace(' ', 'T'));
      };

      // Unified Todo Synchronization for HomeView (matches SideBar)
      useEffect(() => {
        const chromeAny = (window as any).chrome;

        const updateTodoMetrics = async () => {
          if (!chromeAny?.storage?.local) return;

          try {
            const result = await new Promise<any>(resolve =>
              chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve),
            );
            const allTasks = [...(result.cached_todos || []), ...(result.local_todos || [])];

            // 1. Deduplicate by ID
            const uniqueTasks = Array.from(new Map(allTasks.map(t => [String(t.id || t.snippet_id), t])).values());
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

            // 2. Calculate Counts & Stats
            const metrics = uniqueTasks.reduce(
              (acc: any, t: any) => {
                const deadline = parseTaskDate(t.event_deadline);
                if (isNaN(deadline.getTime())) return acc;

                const isAnytime = !!(t.is_anytime || (t.event_deadline && String(t.event_deadline).substring(0, 4) >= '2035'));
                const isFutureDay = !isSameDay(deadline, now) && deadline > now;

                const isActiveToday = !t.is_done && !isFutureDay && (isSameDay(deadline, now) || deadline < now || isAnytime);
                const isDoneToday = t.is_done && isSameDay(deadline, now);
                const isPast = deadline < now && !isAnytime;

                if (isActiveToday || isDoneToday) {
                  acc.todayTotal++;
                  if (t.is_done) {
                    acc.todayDone++;
                  } else if (isPast) {
                    acc.overdue++;
                  }
                } else if (!t.is_done && deadline < startOfToday && !isAnytime) {
                  acc.overdue++;
                }
                return acc;
              },
              { overdue: 0, todayTotal: 0, todayDone: 0 },
            );

            setTodoCounts({ overdue: metrics.overdue, done: metrics.todayDone, total: metrics.todayTotal });
          } catch (e) {
            console.error('[HomeView] Failed to update todo metrics:', e);
          }
        };

        updateTodoMetrics();
        window.addEventListener('todosUpdated', updateTodoMetrics);

        const handleStorageChange = (changes: any, area: string) => {
          if (area === 'local' && (changes.local_todos || changes.cached_todos)) {
            updateTodoMetrics();
          }
        };
        chromeAny.storage.onChanged.addListener(handleStorageChange);

        return () => {
          window.removeEventListener('todosUpdated', updateTodoMetrics);
          chromeAny.storage.onChanged.removeListener(handleStorageChange);
        };
      }, []);

      const { favorites, toggleFavorite } = useFavorites();
      const commands = useDbStore(state => state.commands);

      const userCommandsMap = useMemo(() => {
        const map: Record<string, CommandRecord> = {};
        commands.forEach(c => {
          map[c.id] = c;
        });
        return map;
      }, [commands]);

      const favoriteIdSet = useMemo(() => {
        const set = new Set<string>();
        favorites.forEach(fav => {
          if (fav.reference_id) set.add(fav.reference_id);
        });
        return set;
      }, [favorites]);

      const sortedSnippets = useMemo(() => {
        return [...teamSnippets].sort((a, b) => {
          const aTime = new Date(a.snippet.updated_at || a.snippet.created_at || 0).getTime();
          const bTime = new Date(b.snippet.updated_at || b.snippet.created_at || 0).getTime();
          return bTime - aTime;
        });
      }, [teamSnippets]);

      const noteItems = useMemo<SnippetInteractiveItem[]>(() => {
        return sortedSnippets
          .filter(entry => !isLinkCategory(entry.snippet.category))
          .slice(0, NOTE_LIMIT)
          .map((entry, index) => {
            const id = buildSuggestionKey(entry.workspace, entry.folder, entry.snippet, index);
            const snippetId = entry.snippet.id || entry.snippet.snippet_id || '';
            const context = entry.folder
              ? `${entry.workspace.workspace_name} • ${entry.folder.folder_name}`
              : entry.workspace.workspace_name;

            const category = entry.snippet.category;
            let kind: 'note' | 'link' = 'note';
            if (isLinkCategory(category)) kind = 'link';

            return {
              context,
              kind,
              id,
              title:
                entry.snippet.key ||
                (kind === 'link' ? 'Untitled link' : 'Untitled note'),
              preview: getSnippetPreview(entry.snippet),
              icon: resolveSnippetIcon(category),
              suggestion: buildSnippetSuggestion(entry.workspace, entry.folder, entry.snippet),
              isFavorite: snippetId ? favoriteIdSet.has(snippetId) : false,
            };
          });
      }, [sortedSnippets, favoriteIdSet]);

      const linkItems = useMemo<SnippetInteractiveItem[]>(() => {
        return sortedSnippets
          .filter(entry => isLinkCategory(entry.snippet.category))
          .slice(0, LINK_LIMIT)
          .map((entry, index) => {
            const id = buildSuggestionKey(entry.workspace, entry.folder, entry.snippet, index);
            const snippetId = entry.snippet.id || entry.snippet.snippet_id || '';
            const context = entry.folder
              ? `${entry.workspace.workspace_name} • ${entry.folder.folder_name}`
              : entry.workspace.workspace_name;

            const category = entry.snippet.category;
            return {
              kind: 'link' as const,
              id,
              title: entry.snippet.key || 'Untitled link',
              context,
              preview: getSnippetPreview(entry.snippet) || (isTabGroupCategory(category) ? 'Multiple URLs saved' : ''),
              icon: resolveSnippetIcon(category),
              suggestion: buildSnippetSuggestion(entry.workspace, entry.folder, entry.snippet),
              isFavorite: snippetId ? favoriteIdSet.has(snippetId) : false,
              urls: extractUrlsFromSnippet(entry.snippet),
            };
          });
      }, [sortedSnippets, favoriteIdSet]);

      // AI selection state for dynamic icons (Migrated to chrome.storage.local)
      const [selectedAIs, setSelectedAIs] = useChromeStorage<string[]>('selectedAIs', AI_GROUP.members);

      const handleToggleAI = useCallback(
        (aiId: string) => {
          setSelectedAIs(prev => {
            const newSelection = prev.includes(aiId) ? prev.filter(id => id !== aiId) : [...prev, aiId];
            return newSelection;
          });
        },
        [setSelectedAIs],
      );

      const commandItems = useMemo<CommandInteractiveItem[]>(() => {
        return COMMAND_SHORTLIST.map(id => {
          if (id === 'ai') {
            // Use fixed AI_GROUP.members for static icon stack
            const targetAIs = AI_GROUP.members;

            return {
              kind: 'command' as const,
              id: `command-${id}`,
              commandId: id,
              label: AI_GROUP.label,
              description: COMMAND_DESCRIPTIONS[id] ?? 'Run this command.',
              iconHosts: targetAIs
                .map(memberId => findCommandByAnyId(commands, memberId)?.iconHost)
                .filter((host): host is string => Boolean(host)),
              keywords: ['ai', 'assistants', 'all ai'],
              iconStack: true,
              isFavorite: favoriteIdSet.has(id),
              shortcut: undefined,
            };
          }

          // Local commands (createnotes / createlinks)
          const localDef = findCommandByAnyId(commands, id);
          if (localDef && localDef.surface !== 'website') {

            const stored = userCommandsMap[id];
            const shortcut = stored ? stored.prefix : localDef.prefix.replace(/^\//, '');

            return {
              kind: 'command' as const,
              id: `command-${id}`,
              commandId: id as LocalCommandId,
              label: localDef.label,
              description: COMMAND_DESCRIPTIONS[id] ?? `Run ${localDef.label}.`,
              iconHosts: [], // indicates local command; DefaultContainer will use TerminalIcon
              icon: localDef.icon,
              keywords: [localDef.prefix.replace('/', ''), localDef.label.toLowerCase()],
              iconStack: false,
              isFavorite: favoriteIdSet.has(id),
              shortcut: stored ? stored.prefix : undefined,
            };
          }

          const def = findCommandByAnyId(commands, id);
          if (!def && id !== 'collections') return null;

          const stored = userCommandsMap[id];

          // Try to find the specific BROWSER_ICON for this command if it's a browser command
          let customIcon = def?.icon;
          if (!customIcon && id === 'todo') customIcon = BsCalendarCheck;
          else if (!customIcon && id === 'collections') customIcon = FaRegFolder;
          else if (!customIcon && def?.category === 'browser') {

            const iconMap: Record<string, React.ReactNode> = {
              history: <FaHistory size={14} className="text-[var(--color-iconDefault)]" />,
              downloads: <FaDownload size={14} className="text-[var(--color-iconDefault)]" />,
              settings: <FaCog size={14} className="text-[var(--color-iconDefault)]" />,
              extensions: <FaPuzzlePiece size={14} className="text-[var(--color-iconDefault)]" />,
              bookmarks: <FaBookmark size={14} className="text-[var(--color-iconDefault)]" />,
              flags: <FaFlag size={14} className="text-[var(--color-iconDefault)]" />,
              inspect: <FaCode size={14} className="text-[var(--color-iconDefault)]" />,
              version: <FaTag size={14} className="text-[var(--color-iconDefault)]" />,
              about: <FaInfoCircle size={14} className="text-[var(--color-iconDefault)]" />,
              tasks: <FaMemory size={14} className="text-[var(--color-iconDefault)]" />,
              gpu: <FaMicrochip size={14} className="text-[var(--color-iconDefault)]" />,
              dino: <FaGamepad size={14} className="text-[var(--color-iconDefault)]" />,
              passwords: <FaKey size={14} className="text-[var(--color-iconDefault)]" />,
              help: <FaQuestionCircle size={14} className="text-[var(--color-iconDefault)]" />,
            };
            customIcon = iconMap[id];
          }

          return {
            kind: 'command' as const,
            id: `command-${id}`,
            commandId: id,
            label: id === 'todo' ? 'My To-Do' : id === 'collections' ? 'All Shortcuts' : def?.label || '',
            description: COMMAND_DESCRIPTIONS[id] ?? `Open ${def?.label || ''}.`,
            iconHosts: id === 'collections' ? [] : [def?.iconHost].filter(Boolean),
            icon: customIcon,
            keywords: id === 'collections' ? ['collections', 'all', 'folders'] : getCommandKeywords(id as CommandId),
            iconStack: false,
            isFavorite: favoriteIdSet.has(id),
            shortcut: id === 'collections' ? undefined : id === 'todo' ? 'Alt+C' : (stored ? stored.prefix : undefined),
          };
        }).filter(Boolean) as CommandInteractiveItem[];
      }, [selectedAIs, favoriteIdSet, userCommandsMap]);

      const favoriteItems = useMemo<SnippetInteractiveItem[]>(() => {
        if (!favoriteIdSet.size) return [];
        return sortedSnippets
          .filter(entry => {
            const id = entry.snippet.id || entry.snippet.snippet_id || '';
            return Boolean(id) && favoriteIdSet.has(id);
          })
          .slice(0, FAV_LIMIT)
          .map((entry, index) => {
            const baseId = buildSuggestionKey(entry.workspace, entry.folder, entry.snippet, index);
            const id = `favorite-${baseId}`;
            const context = entry.folder
              ? `${entry.workspace.workspace_name} • ${entry.folder.folder_name}`
              : entry.workspace.workspace_name;

            const category = entry.snippet.category;
            const isLink = isLinkCategory(category);

            let kind: 'note' | 'link' = 'note';
            if (isLink) kind = 'link';

            return {
              context,
              kind,
              id,
              title:
                entry.snippet.key ||
                (kind === 'link' ? 'Untitled link' : 'Untitled note'),
              preview: getSnippetPreview(entry.snippet) || (isTabGroupCategory(category) ? 'Multiple URLs saved' : ''),
              icon: resolveSnippetIcon(category),
              suggestion: buildSnippetSuggestion(entry.workspace, entry.folder, entry.snippet),
              isFavorite: true,
              urls: isLink ? extractUrlsFromSnippet(entry.snippet) : undefined,
            };
          });
      }, [sortedSnippets, favoriteIdSet]);

      // ... inside toggleFavoriteForItem ...

      // ... inside component ...

      const toggleFavoriteForItem = useCallback(
        async (item: InteractiveItem) => {
          try {
            function showToast(msg: string) {
              useUIStore.getState().setCommandStatus({ status: 'success', message: msg });
              setTimeout(() => {
                useUIStore.getState().setCommandStatus({ status: 'idle', message: '' });
              }, 2000);
            }

            try {
              let itemId: string;
              let itemType: string;

              if (item.kind === 'command') {
                itemType = 'command';
                itemId = item.commandId;
              } else {
                const snippet: any = (item.suggestion as any).item || (item.suggestion as any).snippet;
                itemType = snippet.category || 'snippet';
                itemId = snippet?.id || snippet?.snippet_id;
              }

              const isNowFav = !favoriteIdSet.has(itemId);
              await toggleFavorite(itemId, itemType, item.kind === 'command' ? item.label : ((item.suggestion as any).item?.title || (item.suggestion as any).snippet?.key));
              
              if (isNowFav) {
                showToast(`Added to favorites`);
              } else {
                showToast(`Removed from favorites`);
              }
            } catch (err) {
              console.error('[HomeView] Toggle Error', err);
            }
          } catch (outerErr) {
            console.error(outerErr);
          }
        },
        [favoriteIdSet, toggleFavorite],
      );

      const sections = useMemo<InteractiveSection[]>(() => {
        const list: InteractiveSection[] = [];

        // Recommended section - combines commands, notes and links (like AltS)
        const recommendedItems: InteractiveItem[] = [];
        recommendedItems.push(...commandItems);
        // only homeview allow 3 options remaining not sending uncomment to send it

        // recommendedItems.push(...noteItems.slice(0, 4));
        // recommendedItems.push(...linkItems.slice(0, 4));
        if (recommendedItems.length > 0) {
          list.push({
            key: 'recommended',
            title: '',
            items: recommendedItems,
            emptyMessage: 'No suggestions yet. Try creating or saving items.',
          });
        }

        // Empty state if no items
        if (!list.length) {
          list.push({
            key: 'empty',
            title: 'Results',
            items: [],
            emptyMessage: 'Nothing here yet. Try creating a note or saving a link.',
          });
        }

        return list;
      }, [commandItems, noteItems, linkItems]);

      // Track focused item kind for dynamic label
      const [focusedItemKind, setFocusedItemKind] = useState<
        'link' | 'note' | 'command' | 'folder' | 'tabgroup' | null
      >(null);
      const handleHighlightChange = useCallback(
        (item: InteractiveItem | null) => {
          if (onHighlightChange) {
            onHighlightChange(item);
          }
          if (item) {
            setFocusedItemKind(item.kind);
          } else {
            setFocusedItemKind(null);
          }
        },
        [onHighlightChange],
      );

      const handleSnippetOpen = useCallback(
        (item: SnippetSuggestion) => {
          const snippet: any = (item as any).item || (item as any).snippet;
          const category = (snippet?.category || '').toLowerCase();
          const snippetId = snippet?.snippet_id || snippet?.id || '';

          if (isLinkCategory(category)) {
            const urls = extractUrlsFromSnippet(snippet);
            
          } else {
            
          }

          onSnippetSelect(item);
        },
        [onSnippetSelect],
      );

      const handleOpenUrls = useCallback(
        (urls: string[], title?: string) => {
          if (urls?.length) {
            
          }
          onRequestOpenUrls?.(urls, title);
        },
        [onRequestOpenUrls],
      );

      const getDynamicActionLabel = () => {
        return 'Options';
      };

      if (isCommandLocked || isAtMenuOpen) {
        return null;
      }

      return (
        <div className="max-h-[70%] h-fit w-full flex flex-col relative">
          <DefaultContainer
            ref={ref}
            sections={sections}
            todoCounts={todoCounts}
            onQuickCommandSelect={onQuickCommandSelect}
            onCommandPreview={onCommandPreview}
            onSnippetSelect={handleSnippetOpen}
            onRequestSnippetDelete={onRequestSnippetDelete}
            onRequestFocusSearch={onRequestFocusSearch}
            onHighlightChange={handleHighlightChange}
            actionsButtonLabel={getDynamicActionLabel()}
            onToggleFavorite={toggleFavoriteForItem}
            onRequestEditLink={onRequestLinkEdit}
            selectedAIs={selectedAIs}
            onToggleAI={handleToggleAI}
            inlineNotification={inlineNotification}
            isCommandLocked={isCommandLocked}
            isAtMenuOpen={isAtMenuOpen}
            isSuggestionVisible={isSuggestionVisible}
            onNavigateToListView={onNavigateToListView}
            isLoggedIn={isLoggedIn}
            status={commandStatus}
            onRequestOpenUrls={handleOpenUrls} // Pass it down
            folderInfo={selectedFolderRecord ? {
              name: selectedFolderRecord.folderName,
              notesCount: teamSnippets.filter(s => !isLinkCategory(s.snippet.category)).length,
              linksCount: teamSnippets.filter(s => isLinkCategory(s.snippet.category)).length,
            } : null}
          />
        </div>
      );
    },
  ),
);

HomeView.displayName = 'HomeView';

export default HomeView;
