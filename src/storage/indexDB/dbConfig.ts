import Dexie, { type Table } from 'dexie';
import type { WorkspaceData } from '../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../settings/allWorkspaceManager/folders/folderTypes';
import type { NoteRecord } from '../../allObjectFolder/src/createObject/notes/noteTypes';
import type { LinkRecord } from '../../allObjectFolder/src/createObject/links/linkTypes';
import type { AutomationRecord } from '../../allObjectFolder/src/createObject/automationBeta/automationTypes';
import type { ChatAgentRecord } from '../../allObjectFolder/src/createObject/ChatAgent/chatAgentTypes';
import type { AiPromptRecord } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import type { SnippetRecord } from '../../allObjectFolder/src/createObject/snippets/snippetTypes';
import type { TodoRecord } from '../../allObjectFolder/src/createObject/todos/todoTypes';
import type { TagRecord } from '../../allObjectFolder/src/createObject/tags/tagTypes';

import type { UserHotkeyRecord } from '../../shared-components/hotkeys/core/hotkeyDbTypes';
import type { UserShortcutRecord } from '../../shared-components/shortcuts/core/shortcutDbTypes';
import type { FavoriteRecord } from '../../shared-components/favorites/favoriteTypes';
import type { CommandRecord } from '../../allObjectFolder/src/createObject/commands/commandTypes';
import type { SessionRecord } from '../../allObjectFolder/src/createObject/session/sessionTypes';

export class CmdOSDatabase extends Dexie {
  workspaces!: Table<WorkspaceData, string>;
  folders!: Table<FolderData, string>;
  notes!: Table<NoteRecord, string>;
  links!: Table<LinkRecord, string>;
  automations!: Table<AutomationRecord, string>;
  chatAgents!: Table<ChatAgentRecord, string>;
  aiPrompts!: Table<AiPromptRecord, string>;
  snippets!: Table<SnippetRecord, string>;
  todos!: Table<TodoRecord, string>;
  tags!: Table<TagRecord, string>;
  userHotkeys!: Table<UserHotkeyRecord, string>;
  userShortcuts!: Table<UserShortcutRecord, string>;
  favorites!: Table<FavoriteRecord, string>;
  commands!: Table<CommandRecord, string>;
  sessions!: Table<SessionRecord, string>;

  constructor() {
    super('cmdOS');

    this.version(1).stores({
      workspaces: 'id, workspaceName, updatedAt',
      folders: 'id, workspaceId, folderName, updatedAt',
      notes: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      links: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      automations: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      snippets: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      chatAgents: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      aiPrompts: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      todos: 'id, scheduleTime, updatedAt',
      tags: 'id, workspaceId, name, updatedAt, [workspaceId+updatedAt]',
      userHotkeys: 'id, userId, combination, referenceId, referenceType, updatedAt',
      userShortcuts: 'id, userId, trigger, referenceId, referenceType, updatedAt',
      favorites: 'id, user_id, reference_id, reference_type, updatedAt, [user_id+reference_id], [user_id+updatedAt]',
      commands: 'id, prefix, label, behavior, surface, enabled, updatedAt',
    });

    this.version(2).stores({
      notes: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId], [workspaceId+folderId+updatedAt]',
    });

    this.version(3).stores({
      sessions: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
    });
  }
}

export const db = new CmdOSDatabase();

// Open the database immediately so it creates the schema and is visible in Chrome DevTools
db.open().catch(err => {
  console.error('[Dexie] Failed to open database cmdOS:', err);
});
