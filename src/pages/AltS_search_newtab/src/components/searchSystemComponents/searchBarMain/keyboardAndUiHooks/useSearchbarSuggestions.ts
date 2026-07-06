import { useState, useRef, useEffect, useMemo } from 'react';
import type {
  SuggestionListItem,
  CommandSuggestionItem,
  CommonCommandSuggestionItem,
  HistorySuggestionItem,
  BookmarkSuggestionItem,
  OpenUrlSuggestionItem,
  WorkspaceItemSuggestion,
  AnyCommandId,
  Attachment,
} from '../utilityFunctions/types';
import type { CommandDefinition, CommandId } from '../commandConfigurations/commands';
import { AI_GROUP, AI_GROUP as commandsAI_GROUP } from '../commandConfigurations/commands';
import type { LocalCommandId, LocalCommandDefinition } from '../commandConfigurations/localCommands';
import { LOCAL_COMMANDS } from '../commandConfigurations/localCommands';
import type { SavedAutomation } from '../../../../../../../allObjectFolder/src/createObject/automationBeta/utilities/automation';

import type { WorkspaceData } from '../../../../../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { InstalledModule, UnifiedSearchResult } from '../searchLogicAndAlgorithms/searchEngine';
import {
  searchAll as fuseSearchAll,
  preIndexHistory,
} from '../searchLogicAndAlgorithms/searchEngine';
import { searchCommands } from '../searchLogicAndAlgorithms/commandSearch';
import { isBookmarksCommand, trimQuery } from '../utilityFunctions/promptHelpers';
import { getUrlsFromQuery } from '../utilityFunctions/urlHelpers';
import type { HistoryItem } from '../searchLogicAndAlgorithms/historyAlgo';
import type { CommonCommandEntry } from '../searchLogicAndAlgorithms/commonResults';

interface UseSearchbarSuggestionsProps {
  value: string;
  lockedCommand: AnyCommandId | null;
  lockedLocalDef: LocalCommandDefinition | null | undefined;
  selectedTeam: any | null;
  searchTeamLike: any | null;
  dbWorkspaces: WorkspaceData[];
  selectedFolder: any | null;
  isInitialAltSFocus: boolean;
  isFocused: boolean;
  isSearchFocusEnabled: boolean;
  selectedImages: Attachment[];
  commands: CommandDefinition[];
  commandIndex: any;
  matchingSnippets: WorkspaceItemSuggestion[];
  bookmarkSuggestions: BookmarkSuggestionItem[];
  commonCommandEntries: CommonCommandEntry[];
  automationSuggestions: SavedAutomation[];
  agentCollectionSuggestions: any[];
  moduleSuggestions: InstalledModule[];

  selectedAtCommand: string | null;
  activeSnippetCommandId: string | null;
  isSnippetCommand: boolean;
  activeCollection: any;
  showAIHistoryPanel: boolean;
}

export function useSearchbarSuggestions({
  value,
  lockedCommand,
  lockedLocalDef,
  selectedTeam,
  searchTeamLike,
  dbWorkspaces,
  selectedFolder,
  isInitialAltSFocus,
  isFocused,
  isSearchFocusEnabled,
  selectedImages,
  commands,
  commandIndex,
  matchingSnippets,
  bookmarkSuggestions,
  commonCommandEntries,
  automationSuggestions,
  agentCollectionSuggestions,
  moduleSuggestions,

  selectedAtCommand,
  activeSnippetCommandId,
  isSnippetCommand,
  activeCollection,
  showAIHistoryPanel,
}: UseSearchbarSuggestionsProps) {
  // History cache state
  const [historyItems, setHistoryItems] = useState<HistoryItem[] | null>(null);
  const isFetchingHistoryRef = useRef<boolean>(false);

  // Debounced search results
  const [debouncedFuseResults, setDebouncedFuseResults] = useState<SuggestionListItem[]>([]);
  const fuseSearchTimeoutRef = useRef<number | null>(null);

  // Effect to prefetch history when search focus is enabled
  useEffect(() => {
    if (!isSearchFocusEnabled) {
      setHistoryItems(null);
      isFetchingHistoryRef.current = false;
      return;
    }

    if (historyItems || isFetchingHistoryRef.current) return;

    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.runtime?.sendMessage) return;

    isFetchingHistoryRef.current = true;
    chromeAny.runtime.sendMessage(
      { action: 'history_search', query: '', maxResults: 2000, includeFrecency: true, halfLifeHours: 2 },
      (response: any) => {
        isFetchingHistoryRef.current = false;
        if (response?.ok && Array.isArray(response.results)) {
          const items: HistoryItem[] = response.results.map((item: any) => ({
            id: item.id || item.url,
            title: item.title || item.url || '',
            url: item.url || '',
            lastVisitTime: item.lastVisitTime || 0,
            visitCount: item.visitCount || 0,
            frecencyScore: typeof item.frecencyScore === 'number' ? item.frecencyScore : undefined,
          }));

          preIndexHistory(items);
          setHistoryItems(items);
        }
      },
    );
  }, [historyItems, isSearchFocusEnabled]);

  const commandQuery = useMemo(() => {
    if (value.startsWith('/')) {
      return value.slice(1);
    }
    return value;
  }, [value]);

  const snippetEntitySuggestions = useMemo(() => {
    if (!isSnippetCommand || !activeSnippetCommandId) return [];
    const allowedCategories =
      activeSnippetCommandId === 'delete_link'
        ? new Set(['link', 'links', 'tabgroup', 'tab group'])
        : new Set(['snippet']);
    return matchingSnippets
      .filter(item => allowedCategories.has(((item.item as any).category || '').toLowerCase()))
      .map(item => ({
        _kind: 'workspace_item' as const,
        item: item.item,
        workspace: item.workspace,
        folder: item.folder,
      }));
  }, [activeSnippetCommandId, isSnippetCommand, matchingSnippets]);

  const generalWorkspaceItemSuggestions = useMemo<SuggestionListItem[]>(() => {
    return matchingSnippets.map(item => ({
      _kind: 'workspace_item' as const,
      item: item.item,
      workspace: item.workspace,
      folder: item.folder,
      isPersonal: item.isPersonal,
      teamName: item.teamName,
    }));
  }, [matchingSnippets]);

  const commonCommandSuggestions = useMemo<CommonCommandSuggestionItem[]>(() => {
    const isShortcutQuery = value.startsWith('/');
    const trimmed = trimQuery(value);
    const searchQuery = isShortcutQuery ? trimmed.slice(1).trim() : trimmed;
    if ((!searchQuery && selectedImages.length === 0) || (lockedCommand && !isShortcutQuery)) return [];
    return commonCommandEntries.map(entry => ({
      _kind: 'common_command' as const,
      id: entry.command.id,
      label: entry.label,
      description: entry.description,
      command: entry.command,
      query: searchQuery,
    }));
  }, [commonCommandEntries, value, lockedCommand, selectedImages.length]);

  const commandSuggestions = useMemo<CommandSuggestionItem[]>(() => {
    if (lockedLocalDef || isBookmarksCommand(lockedCommand)) return [];

    const trimmedQuery = commandQuery.trim().toLowerCase();
    const results: any[] = [];

    if (trimmedQuery) {
      results.push(...searchCommands(commandIndex, commandQuery));
    } else if (value.startsWith('/')) {
      commandIndex.forEach((entry: any) => {
        results.push({
          kind: entry.kind,
          definition: entry.definition,
          score: 1,
          matchedTokens: [],
        });
      });
    }

    const filteredResults = results.filter(
      r => r.definition.id !== 'ai' && ((r.definition as any).category !== 'browser' || value.startsWith('/')),
    );

    const converted: CommandSuggestionItem[] = filteredResults.map(match => {
      if (match.kind === 'remote') {
        return {
          _kind: 'command' as const,
          commandType: 'remote' as const,
          id: match.definition.id,
          label: match.definition.label,
          prefix: match.definition.prefix,
          score: match.score,
          matchedTokens: match.matchedTokens,
          command: match.definition,
        };
      }
      return {
        _kind: 'command' as const,
        commandType: 'local' as const,
        id: match.definition.id as LocalCommandId,
        label: match.definition.label,
        prefix: match.definition.prefix,
        score: match.score,
        matchedTokens: match.matchedTokens,
        command: match.definition,
      };
    });

    const shouldIncludeAiAggregate = () => {
      if (lockedLocalDef || isBookmarksCommand(lockedCommand)) return false;
      if (converted.some(item => item.id === 'ai')) return false;
      if (!value.startsWith('/') && !trimmedQuery) return false;
      if (value.startsWith('/')) {
        return 'ai'.startsWith(trimmedQuery);
      }
      return trimmedQuery.includes('ai') || trimmedQuery.includes('assistant') || value.includes('@');
    };

    return shouldIncludeAiAggregate()
      ? [
          {
            _kind: 'command' as const,
            commandType: 'aggregate' as const,
            id: 'ai' as const,
            label: AI_GROUP.label,
            prefix: AI_GROUP.prefix,
            score: trimmedQuery ? 6 : 1,
            matchedTokens: trimmedQuery ? [trimmedQuery] : [],
          },
          ...converted,
        ]
      : converted;
  }, [commandQuery, lockedCommand, lockedLocalDef, value, commandIndex]);

  const localEntitySuggestions = useMemo(() => {
    if (!lockedLocalDef) return [];
    const q = value.trim().toLowerCase();
    if (lockedLocalDef.scope === 'workspace') {
      const action = lockedLocalDef.action;
      if (!action) return [];
      const items = dbWorkspaces.map(ws => ({
        _kind: 'workspace' as const,
        workspace: {
          id: ws.id,
          workspace_id: ws.id,
          workspace_name: ws.workspaceName,
          folders: [],
          workspace_snippets: [],
          workspace_automations: [],
        } as any,
        action,
      }));
      if (!q) return items;
      return items.filter(it => (it.workspace.workspace_name || '').toLowerCase().includes(q));
    }
    if (lockedLocalDef.scope === 'snippet') {
      return snippetEntitySuggestions;
    }
    return [];
  }, [dbWorkspaces, lockedLocalDef, snippetEntitySuggestions, value]);

  // Effect to run debounced Fuse.js search
  useEffect(() => {
    if (fuseSearchTimeoutRef.current) {
      window.clearTimeout(fuseSearchTimeoutRef.current);
      fuseSearchTimeoutRef.current = null;
    }

    const shouldSkip =
      isInitialAltSFocus || isFocused
        ? false
        : isBookmarksCommand(lockedCommand) ||
          lockedLocalDef ||
          value.startsWith('/') ||
          lockedCommand ||
          selectedAtCommand ||
          (lockedCommand !== 'calendar' && !value.trim() && selectedImages.length === 0);

    if (shouldSkip) {
      setDebouncedFuseResults([]);
      return;
    }

    fuseSearchTimeoutRef.current = window.setTimeout(async () => {
      const bookmarksForSearch = bookmarkSuggestions.map(b => ({
        id: b.id,
        title: b.title,
        url: b.url,
      }));

      const fuseResults = fuseSearchAll(value, {
        commands,
        localCommands: LOCAL_COMMANDS,
        historyItems: isSearchFocusEnabled ? historyItems : null,

        bookmarks: bookmarksForSearch,
        commonCommands: commonCommandEntries,
        automations: automationSuggestions,
        agents: agentCollectionSuggestions,
        modules: moduleSuggestions,
        lockedCommand: null,
        selectedFolder: selectedFolder ?? null,
        selectedTeam: searchTeamLike ?? selectedTeam ?? null,
        includeCommonIfEmpty: selectedImages.length > 0,
        returnAllIfEmpty: isInitialAltSFocus || !value.trim(),
      });

      const converted: SuggestionListItem[] = [];

      for (const result of fuseResults) {
        switch (result._kind) {
          case 'command':
            converted.push({
              _kind: 'command' as const,
              commandType: result.commandType,
              id: result.id,
              label: result.label,
              prefix: result.prefix,
              score: result.score,
              matchedTokens: [],
              command: result.command,
              description: result.description,
            } as CommandSuggestionItem);
            break;

          case 'history':
            converted.push({
              _kind: 'history' as const,
              id: result.id,
              title: result.title,
              url: result.url,
              lastVisitTime: result.lastVisitTime,
              visitCount: result.visitCount,
              frecencyScore: result.frecencyScore,
              isOtherResult: result.isOtherResult,
              commandId: result.commandId,
            } as HistorySuggestionItem);
            break;



          case 'bookmark':
            converted.push({
              _kind: 'bookmark' as const,
              id: result.id,
              title: result.title,
              url: result.url,
              commandId: result.commandId,
            } as BookmarkSuggestionItem);
            break;

          case 'common_command':
            converted.push({
              _kind: 'common_command' as const,
              id: result.id,
              label: result.label,
              description: result.description,
              command: result.command,
              query: result.query,
            } as CommonCommandSuggestionItem);
            break;


          case 'automation':
            converted.push({
              _kind: 'automation' as const,
              automation: result.automation,
            });
            break;
          case 'module':
            converted.push({
              _kind: 'module' as const,
              id: `module:${result.module.module_id}`,
              module: result.module,
            });
            break;
          case 'agent_collection':
            converted.push({
              _kind: 'agent_collection' as const,
              title: result.title,
              itemCount: result.itemCount,
            });
            break;
        }
      }

      // De-duplicate snippets
      const snippetIds = new Set();
      const finalResults = converted.filter(item => {
        if (item._kind === 'workspace_item') {
          const sid = item.item.id || (item.item as any).snippet_id || (item.item as any).title || '';
          if (snippetIds.has(sid)) return false;
          snippetIds.add(sid);
        }
        return true;
      });

      

      setDebouncedFuseResults(finalResults);
    }, 300);

    return () => {
      if (fuseSearchTimeoutRef.current) {
        window.clearTimeout(fuseSearchTimeoutRef.current);
      }
    };
  }, [
    value,
    lockedCommand,
    lockedLocalDef,
    commands,

    commonCommandEntries,
    bookmarkSuggestions,
    selectedFolder,
    selectedImages.length,
    historyItems,
    isSearchFocusEnabled,
    automationSuggestions,
    agentCollectionSuggestions,
    moduleSuggestions,
    isInitialAltSFocus,
    isFocused,
  ]);

  const openUrlSuggestion = useMemo<OpenUrlSuggestionItem | null>(() => {
    const trimmed = value.trim();
    if (!trimmed || value.startsWith('/') || lockedCommand) return null;
    const urls = getUrlsFromQuery(trimmed);
    if (urls.length > 0) {
      return {
        _kind: 'open_url',
        url: urls.join(','),
        displayUrl: trimmed,
      };
    }
    return null;
  }, [value, lockedCommand]);

  const allSuggestions = useMemo<SuggestionListItem[]>(() => {
    if (activeCollection) {
      return [];
    }

    if (selectedAtCommand) {
      return [];
    }

    if (isBookmarksCommand(lockedCommand)) {
      return bookmarkSuggestions;
    }

    if (lockedLocalDef && lockedCommand !== 'store') {
      return localEntitySuggestions;
    }

    if (showAIHistoryPanel) {
      return [];
    }

    if (lockedCommand === 'ai' || lockedCommand === 'store') {
      return [];
    }

    if (value.startsWith('/')) {
      const suggestions: SuggestionListItem[] = [
        ...commandSuggestions,
        ...generalWorkspaceItemSuggestions,
        ...bookmarkSuggestions,
        ...commonCommandSuggestions,
      ];

      return suggestions.filter(item => {
        if (item._kind === 'command') return !!item.label;
        if (item._kind === 'workspace_item') return !!(item.item as any).title;
        if (item._kind === 'bookmark') return !!item.title;
        if (item._kind === 'common_command') return !!item.label;
        return true;
      });
    }

    if (!lockedCommand && (value.trim() || selectedImages.length > 0 || isInitialAltSFocus)) {
      if (selectedImages.length > 0) {
        return commonCommandSuggestions.filter(s => AI_GROUP.members.includes(s.id as CommandId) || s.id === 'ai');
      }

      let results = debouncedFuseResults;
      if (openUrlSuggestion) {
        results = [openUrlSuggestion, ...results];
      }

      return results;
    }

    return [];
  }, [
    value,
    lockedCommand,
    commandSuggestions,
    lockedLocalDef,
    localEntitySuggestions,
    bookmarkSuggestions,
    openUrlSuggestion,
    selectedAtCommand,
    selectedImages,
    debouncedFuseResults,
    generalWorkspaceItemSuggestions,
    commonCommandSuggestions,
    showAIHistoryPanel,
    isInitialAltSFocus,
    activeCollection,
  ]);

  return {
    allSuggestions,
    historyItems,
    setHistoryItems,
    debouncedFuseResults,
    setDebouncedFuseResults,
    commandSuggestions,
    generalWorkspaceItemSuggestions,
    commonCommandSuggestions,
    openUrlSuggestion,
  };
}
