

// ============================================================================
// DICTIONARY PARSING UTILITIES
// ============================================================================

/**
 * Parse dictionary string into Map
 * Input: "user_123:/leave_mail, user_456:/vacation"
 * Output: Map { "user_123" => "/leave_mail", "user_456" => "/vacation" }
 */
export function parseDictionaryString(dictString: string | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!dictString) return map;

  const entries = dictString
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const colonIndex = entry.indexOf(':');
    if (colonIndex > 0) {
      const key = entry.substring(0, colonIndex).trim();
      const value = entry.substring(colonIndex + 1).trim();
      if (key && value) {
        map.set(key, value);
      }
    }
  }
  return map;
}

/**
 * Serialize Map back to dictionary string
 * Input: Map { "user_123" => "/leave_mail", "user_456" => "/vacation" }
 * Output: "user_123:/leave_mail, user_456:/vacation"
 */
export function serializeDictionaryToString(map: Map<string, string>): string {
  return Array.from(map.entries())
    .map(([key, value]) => `${key}:${value}`)
    .join(', ');
}

// ============================================================================
// LOCAL STORAGE SYNC UTILITIES
// These transform cloud data to local storage format for faster access
// ============================================================================

const chromeAny = typeof window !== 'undefined' ? (window as any)?.chrome : null;

export interface LinkCommandMap {
  [commandId: string]: {
    shortcut?: string;
    keywords?: string[];
    snippetId?: string;
    label?: string;
    url?: string;
    urls?: string[];
    iconHost?: string | null;
    type?: 'link' | 'tabgroup';
  };
}

export interface NoteCommandMap {
  [commandId: string]: {
    shortcut?: string;
    keywords?: string[];
    snippetId?: string;
    label?: string;
  };
}

export interface HotkeysMap {
  commands: Record<string, string>;
  links: Record<string, string>;
  notes: Record<string, string>;
}

/**
 * Transform cloud shortcuts/hotkeys data from API response into local storage format
 * This should be called after fetching allData from the API
 *
 * @param teams - The teams array from API response
 * @param userId - Current user's ID from accessToken
 */
export async function syncCloudDataToLocalStorage(teams: any[], userId: string): Promise<void> {
  if (!chromeAny?.storage?.local || !userId) return;

  const linkCommands: LinkCommandMap = {};
  const noteCommands: NoteCommandMap = {};
  const linkHotkeys: Record<string, string> = {};
  const noteHotkeys: Record<string, string> = {};

  for (const team of teams || []) {
    for (const ws of team.workspaces || []) {
      // Process workspace-level snippets
      for (const snippet of ws.workspace_snippets || []) {
        const snippetId = snippet.snippet_id || snippet.id;
        if (!snippetId) continue;

        const commandId = `${ws.workspace_id}-${snippetId}`;
        const category = (snippet.category || '').toLowerCase();

        const userShortcut = parseDictionaryString(snippet.shortcuts).get(userId) || '';
        const userHotkey = parseDictionaryString(snippet.hotkeys).get(userId) || '';

        if (category === 'link') {
          // Link/TabGroup
          if (userShortcut || userHotkey) {
            linkCommands[commandId] = {
              shortcut: userShortcut || undefined,
              snippetId: snippetId,
              label: snippet.key,
              type: 'link',
            };
          }
          if (userHotkey) {
            linkHotkeys[commandId] = userHotkey;
          }
        } else if (category === 'snippet' || category === 'note') {
          // Note/Snippet
          if (userShortcut || userHotkey) {
            noteCommands[commandId] = {
              shortcut: userShortcut || undefined,
              snippetId: snippetId,
              label: snippet.key,
            };
          }
          if (userHotkey) {
            noteHotkeys[commandId] = userHotkey;
          }
        }
      }

      // Process folder snippets
      for (const folder of ws.folders || []) {
        for (const snippet of folder.snippets || []) {
          const snippetId = snippet.snippet_id || snippet.id;
          if (!snippetId) continue;

          const commandId = `${folder.folder_id}-${snippetId}`;
          const category = (snippet.category || '').toLowerCase();

          // Get user-specific shortcut and hotkey from cloud data
          const userShortcut = parseDictionaryString(snippet.shortcuts).get(userId) || '';
          const userHotkey = parseDictionaryString(snippet.hotkeys).get(userId) || '';

          if (category === 'link') {
            // Link/TabGroup
            if (userShortcut || userHotkey) {
              linkCommands[commandId] = {
                shortcut: userShortcut || undefined,
                snippetId: snippetId,
                label: snippet.key,
                type: 'link',
              };
            }
            if (userHotkey) {
              linkHotkeys[commandId] = userHotkey;
            }
          } else if (category === 'snippet' || category === 'note') {
            // Note/Snippet
            if (userShortcut || userHotkey) {
              noteCommands[commandId] = {
                shortcut: userShortcut || undefined,
                snippetId: snippetId,
                label: snippet.key,
              };
            }
            if (userHotkey) {
              noteHotkeys[commandId] = userHotkey;
            }
          }
        }
      }
    }
  }

  // Write to local storage for fast access - MERGING with existing data to prevent overwrite of local-only changes
  await new Promise<void>(resolve => {
    chromeAny.storage.local.get(
      ['link_commands', 'note_commands', 'alts_link_hotkeys', 'alts_note_hotkeys'],
      (result: any) => {
        const existingLinkCommands = result.link_commands || {};
        const existingNoteCommands = result.note_commands || {};
        const existingLinkHotkeys = result.alts_link_hotkeys || {};
        const existingNoteHotkeys = result.alts_note_hotkeys || {};

        const mergedLinkCommands = { ...existingLinkCommands, ...linkCommands };
        const mergedNoteCommands = { ...existingNoteCommands, ...noteCommands };
        const mergedLinkHotkeys = { ...existingLinkHotkeys, ...linkHotkeys };
        const mergedNoteHotkeys = { ...existingNoteHotkeys, ...noteHotkeys };

        chromeAny.storage.local.set(
          {
            link_commands: mergedLinkCommands,
            note_commands: mergedNoteCommands,
            alts_link_hotkeys: mergedLinkHotkeys,
            alts_note_hotkeys: mergedNoteHotkeys,
          },
          () => resolve(),
        );
      },
    );
  });

  // ─── Sync automation hotkeys/shortcuts ─────────────────────────────────────
  // Automations use direct scalar values (not per-user dict strings).
  // Key: automation_id (string). Value: the hotkey/shortcut string.
  const automationHotkeys: Record<string, string> = {};
  const automationShortcuts: Record<string, string> = {};

  for (const team of teams || []) {
    for (const ws of team.workspaces || []) {
      // Workspace-level automations
      for (const auto of ws.workspace_automations || []) {
        const id = String(auto.id || auto.automation_id || '');
        if (!id) continue;
        if (auto.hotkeys) automationHotkeys[id] = auto.hotkeys;
        if (auto.shortcuts) automationShortcuts[id] = auto.shortcuts;
      }
      // Folder-level automations
      for (const folder of ws.folders || []) {
        for (const auto of folder.automations || []) {
          const id = String(auto.id || auto.automation_id || '');
          if (!id) continue;
          if (auto.hotkeys) automationHotkeys[id] = auto.hotkeys;
          if (auto.shortcuts) automationShortcuts[id] = auto.shortcuts;
        }
      }
    }
  }

  if (Object.keys(automationHotkeys).length > 0 || Object.keys(automationShortcuts).length > 0) {
    await new Promise<void>(resolve => {
      chromeAny.storage.local.get(['alts_automation_hotkeys', 'alts_automation_shortcuts'], (existing: any) => {
        chromeAny.storage.local.set(
          {
            alts_automation_hotkeys: { ...(existing.alts_automation_hotkeys || {}), ...automationHotkeys },
            alts_automation_shortcuts: { ...(existing.alts_automation_shortcuts || {}), ...automationShortcuts },
          },
          () => resolve(),
        );
      });
    });
  }
}

/**
 * Get current user ID from local storage
 */
export async function getCurrentUserId(): Promise<string> {
  if (!chromeAny?.storage?.local) return '';

  return new Promise<string>(resolve => {
    chromeAny.storage.local.get('accessToken', (result: { accessToken?: string }) => {
      resolve(result.accessToken || '');
    });
  });
}

/**
 * Extract snippet ID from commandId
 * commandId format: "${containerId}-${snippetId}"
 */
export function extractSnippetIdFromCommandId(commandId: string): string {
  const parts = commandId.split('-');
  // The snippet ID is everything after the first hyphen
  return parts.slice(1).join('-');
}
