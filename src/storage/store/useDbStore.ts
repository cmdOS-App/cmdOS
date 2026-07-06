import { create } from 'zustand';
import { liveQuery } from 'dexie';
import { db } from '../indexDB/dbConfig';

// Import Types
import { NoteRecord } from '../../allObjectFolder/src/createObject/notes/noteTypes';
import { LinkRecord } from '../../allObjectFolder/src/createObject/links/linkTypes';

import { SnippetRecord } from '../../allObjectFolder/src/createObject/snippets/snippetTypes';
import { CommandRecord } from '../../allObjectFolder/src/createObject/commands/commandTypes';
import { TagRecord } from '../../allObjectFolder/src/createObject/tags/tagTypes';
import { TodoRecord } from '../../allObjectFolder/src/createObject/todos/todoTypes';
import { AutomationRecord } from '../../allObjectFolder/src/createObject/automationBeta/automationTypes';
import { ChatAgentRecord } from '../../allObjectFolder/src/createObject/ChatAgent/chatAgentTypes';
import { AiPromptRecord } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import { UserHotkeyRecord } from '../../shared-components/hotkeys/core/hotkeyDbTypes';
import { UserShortcutRecord } from '../../shared-components/shortcuts/core/shortcutDbTypes';
import { WorkspaceData } from '../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import { FolderData } from '../../settings/allWorkspaceManager/folders/folderTypes';
import { FavoriteRecord } from '../../shared-components/favorites/favoriteTypes';
import { syncCommandsFromSource } from '../../allObjectFolder/src/createObject/commands/commandData';
import type { UpdateCommandInput } from '../../allObjectFolder/src/createObject/commands/commandTypes';
import { storageDebug } from '../../shared-components/utils/storageDebugLogger';
import { SessionRecord } from '../../allObjectFolder/src/createObject/session/sessionTypes';

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

interface DbStoreState {
  notes: NoteRecord[];
  links: LinkRecord[];
  tags: TagRecord[];

  snippets: SnippetRecord[];
  commands: CommandRecord[];
  todos: TodoRecord[];
  automations: AutomationRecord[];
  chatAgents: ChatAgentRecord[];
  aiPrompts: AiPromptRecord[];
  workspaces: WorkspaceData[];
  folders: FolderData[];
  userHotkeys: UserHotkeyRecord[];
  userShortcuts: UserShortcutRecord[];
  favorites: FavoriteRecord[];
  hotkeysMap: Record<string, string>;
  shortcutsMap: Record<string, string>;
  isInitialized: boolean;
  
  // Method to start listening to the database
  initDbSync: () => void;

  // Flat lookup helpers for the local-first entity model
  getWorkspaceById: (workspaceId: string | null | undefined) => WorkspaceData | null;
  getFolderById: (folderId: string | null | undefined) => FolderData | null;
  getNoteById: (noteId: string | null | undefined) => NoteRecord | null;
  getLinkById: (linkId: string | null | undefined) => LinkRecord | null;
  getSnippetById: (snippetId: string | null | undefined) => SnippetRecord | null;
  getCommandById: (commandId: string | null | undefined) => CommandRecord | null;
  getSessionById: (sessionId: string | null | undefined) => SessionRecord | null;
  getFoldersByWorkspaceId: (workspaceId: string | null | undefined) => FolderData[];
  getSnippetsByWorkspaceId: (workspaceId: string | null | undefined) => SnippetRecord[];
  getNotesByWorkspaceId: (workspaceId: string | null | undefined) => NoteRecord[];
  getLinksByWorkspaceId: (workspaceId: string | null | undefined) => LinkRecord[];
  getSessionsByWorkspaceId: (workspaceId: string | null | undefined) => SessionRecord[];
  updateCommandRecord: (commandId: string, input: UpdateCommandInput & { hotkey?: string | null; keywords?: string[] | null }) => Promise<CommandRecord>;
  sessions: SessionRecord[];
}

export const useDbStore = create<DbStoreState>((set, get) => ({
  notes: [],
  links: [],
  tags: [],

  snippets: [],
  commands: [],
  todos: [],
  automations: [],
  chatAgents: [],
  aiPrompts: [],
  workspaces: [],
  folders: [],
  userHotkeys: [],
  userShortcuts: [],
  favorites: [],
  sessions: [],
  hotkeysMap: {},
  shortcutsMap: {},
  isInitialized: false,

  getWorkspaceById: workspaceId => {
    if (!workspaceId) return null;
    return get().workspaces.find(workspace => workspace.id === workspaceId) ?? null;
  },

  getFolderById: folderId => {
    if (!folderId) return null;
    return get().folders.find(folder => folder.id === folderId) ?? null;
  },

  getNoteById: noteId => {
    if (!noteId) return null;
    return get().notes.find(note => note.id === noteId) ?? null;
  },

  getLinkById: linkId => {
    if (!linkId) return null;
    return get().links.find(link => link.id === linkId) ?? null;
  },

  getSnippetById: snippetId => {
    if (!snippetId) return null;
    return get().snippets.find(snippet => snippet.id === snippetId) ?? null;
  },

  getSessionById: sessionId => {
    if (!sessionId) return null;
    return get().sessions.find(session => session.id === sessionId) ?? null;
  },

  getCommandById: commandId => {
    if (!commandId) return null;
    return get().commands.find(command => command.id === commandId) ?? null;
  },

  getFoldersByWorkspaceId: workspaceId => {
    if (!workspaceId) return [];
    return get().folders.filter(folder => folder.workspaceId === workspaceId);
  },

  getSnippetsByWorkspaceId: workspaceId => {
    if (!workspaceId) return [];
    return get().snippets.filter(snippet => snippet.workspaceId === workspaceId);
  },

  getNotesByWorkspaceId: workspaceId => {
    if (!workspaceId) return [];
    return get().notes.filter(note => note.workspaceId === workspaceId);
  },

  getLinksByWorkspaceId: workspaceId => {
    if (!workspaceId) return [];
    return get().links.filter(link => link.workspaceId === workspaceId);
  },

  getSessionsByWorkspaceId: workspaceId => {
    if (!workspaceId) return [];
    return get().sessions.filter(session => session.workspaceId === workspaceId);
  },

  updateCommandRecord: async (commandId, input) => {
    let existing = await db.commands.get(commandId);
    if (!existing) {
      await syncCommandsFromSource();
      existing = await db.commands.get(commandId);
    }

    if (!existing) {
      throw new Error(`Command ${commandId} not found.`);
    }

    const nextRecord: CommandRecord = {
      ...existing,
      label: input.label !== undefined ? input.label.trim() : existing.label,
      prefix: input.prefix !== undefined ? input.prefix.trim() : existing.prefix,
      behavior: input.behavior ?? existing.behavior,
      surface: input.surface !== undefined ? input.surface : existing.surface,
      site: input.site !== undefined ? input.site : existing.site,
      pageType: input.pageType !== undefined ? input.pageType : existing.pageType,
      iconHost: input.iconHost !== undefined ? input.iconHost : existing.iconHost,
      icon: input.icon !== undefined ? input.icon : existing.icon,
      category: input.category !== undefined ? input.category : existing.category,
      type: input.type !== undefined ? input.type : existing.type,
      urlTemplate: input.urlTemplate !== undefined ? input.urlTemplate : existing.urlTemplate,
      enabled: input.enabled ?? existing.enabled,
      updatedAt: Date.now(),
      ...(input.hotkey !== undefined ? { hotkey: input.hotkey } : {}),
      ...(input.keywords !== undefined ? { keywords: input.keywords } : {}),
    } as any;

    await db.commands.put(nextRecord as any);
    return nextRecord;
  },

  initDbSync: () => {
    if (get().isInitialized) {
      storageDebug.log('useDbStore.initDbSync', 'Skipped because DB sync is already initialized');
      return;
    }
    
    set({ isInitialized: true });
    storageDebug.log('useDbStore.initDbSync', 'Starting Dexie liveQuery subscriptions');

    syncCommandsFromSource().catch(err => {
      console.error('Failed to sync commands to Dexie:', err);
      storageDebug.error('useDbStore.syncCommandsFromSource', 'Failed to sync commands to Dexie', err);
    });

    // Subscribe to Dexie changes and push them to Zustand
    liveQuery(() => db.notes.toArray()).subscribe((notes) => {
      storageDebug.log('useDbStore.liveQuery.notes', 'Dexie emitted notes', { count: notes.length });
      set(state => (sameJson(state.notes, notes) ? state : { notes }));
    });
    liveQuery(() => db.links.toArray()).subscribe((links) => {
      storageDebug.log('useDbStore.liveQuery.links', 'Dexie emitted links', { count: links.length });
      set(state => (sameJson(state.links, links) ? state : { links }));
    });
    liveQuery(() => db.tags.toArray()).subscribe((tags) => {
      storageDebug.log('useDbStore.liveQuery.tags', 'Dexie emitted tags', { count: tags.length });
      set(state => (sameJson(state.tags, tags) ? state : { tags }));
    });

    liveQuery(() => db.snippets.toArray()).subscribe((snippets) => {
      storageDebug.log('useDbStore.liveQuery.snippets', 'Dexie emitted snippets', { count: snippets.length });
      set(state => (sameJson(state.snippets, snippets) ? state : { snippets }));
      try {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.storage?.local) {
          const localAstsRecord: Record<string, any> = {};
          snippets.forEach(s => {
            localAstsRecord[s.id] = {
              snippet_id: s.id,
              key: s.title,
              value: typeof s.config === 'string' ? s.config : JSON.stringify(s.config),
              config: s.config,
              tags: s.tagIds,
              category: 'snippet'
            };
          });
          chromeAny.storage.local.get(['local_ast_snippets'], (result: { local_ast_snippets?: Record<string, any> }) => {
            if (!sameJson(result.local_ast_snippets ?? {}, localAstsRecord)) {
              chromeAny.storage.local.set({ local_ast_snippets: localAstsRecord });
            }
          });
        }
      } catch (e) {
        console.error('Failed to sync snippets to chrome.storage.local:', e);
        storageDebug.error('useDbStore.liveQuery.snippets', 'Failed to mirror snippets into chrome.storage.local', e);
      }
    });
    liveQuery(() => db.commands.toArray()).subscribe((commands) => {
      storageDebug.log('useDbStore.liveQuery.commands', 'Dexie emitted commands', { count: commands.length });
      set(state => (sameJson(state.commands, commands) ? state : { commands }));
    });
    liveQuery(() => db.todos.toArray()).subscribe((todos) => {
      storageDebug.log('useDbStore.liveQuery.todos', 'Dexie emitted todos', { count: todos.length });
      set(state => (sameJson(state.todos, todos) ? state : { todos }));
    });
    liveQuery(() => db.automations.toArray()).subscribe((automations) => {
      storageDebug.log('useDbStore.liveQuery.automations', 'Dexie emitted automations', { count: automations.length });
      set(state => (sameJson(state.automations, automations) ? state : { automations }));
    });
    liveQuery(() => db.chatAgents.toArray()).subscribe((chatAgents) => {
      storageDebug.log('useDbStore.liveQuery.chatAgents', 'Dexie emitted chat agents', { count: chatAgents.length });
      set(state => (sameJson(state.chatAgents, chatAgents) ? state : { chatAgents }));
    });
    liveQuery(() => db.aiPrompts.toArray()).subscribe((aiPrompts) => {
      storageDebug.log('useDbStore.liveQuery.aiPrompts', 'Dexie emitted AI prompts', { count: aiPrompts.length });
      set(state => (sameJson(state.aiPrompts, aiPrompts) ? state : { aiPrompts }));
    });
    liveQuery(() => db.workspaces.toArray()).subscribe((workspaces) => {
      storageDebug.log('useDbStore.liveQuery.workspaces', 'Dexie emitted workspaces', {
        count: workspaces.length,
        ids: workspaces.map(workspace => workspace.id),
      });
      set(state => (sameJson(state.workspaces, workspaces) ? state : { workspaces }));
    });
    liveQuery(() => db.folders.toArray()).subscribe((folders) => {
      storageDebug.log('useDbStore.liveQuery.folders', 'Dexie emitted folders', {
        count: folders.length,
        ids: folders.map(folder => folder.id),
        workspaceIds: Array.from(new Set(folders.map(folder => folder.workspaceId))),
      });
      set(state => (sameJson(state.folders, folders) ? state : { folders }));
    });
    liveQuery(() => db.favorites.toArray()).subscribe((favorites) => {
      storageDebug.log('useDbStore.liveQuery.favorites', 'Dexie emitted favorites', { count: favorites.length });
      set(state => (sameJson(state.favorites, favorites) ? state : { favorites }));
    });
    liveQuery(() => db.userHotkeys.toArray()).subscribe((userHotkeys) => {
      storageDebug.log('useDbStore.liveQuery.userHotkeys', 'Dexie emitted user hotkeys', { count: userHotkeys.length });
      const map: Record<string, string> = {};
      userHotkeys.forEach(hk => {
        map[hk.referenceId] = hk.combination;
      });
      set(state =>
        sameJson(state.userHotkeys, userHotkeys) && sameJson(state.hotkeysMap, map)
          ? state
          : { userHotkeys, hotkeysMap: map },
      );
    });
    
    liveQuery(() => db.userShortcuts.toArray()).subscribe((userShortcuts) => {
      storageDebug.log('useDbStore.liveQuery.userShortcuts', 'Dexie emitted user shortcuts', { count: userShortcuts.length });
      const map: Record<string, string> = {};
      userShortcuts.forEach(sc => {
        map[sc.referenceId] = sc.trigger;
      });
      set(state =>
        sameJson(state.userShortcuts, userShortcuts) && sameJson(state.shortcutsMap, map)
          ? state
          : { userShortcuts, shortcutsMap: map },
      );
    });

    liveQuery(() => db.sessions.toArray()).subscribe((sessions) => {
      storageDebug.log('useDbStore.liveQuery.sessions', 'Dexie emitted sessions', { count: sessions.length });
      set(state => (sameJson(state.sessions, sessions) ? state : { sessions }));
    });
  }
}));
