import { getLocalCommandDefinitions } from '../../../../../../../shared-components/commands';
import { useDbStore } from '../../../../../../../storage/store/useDbStore';

export type LocalCommandId =
  | 'rename_project'
  | 'delete_project'
  | 'rename_folder'
  | 'delete_folder'
  | 'createnotes'
  | 'createlinks'
  | 'createsession'
  | 'agent'
  | 'dashboard'
  | 'tutorials'
  | 'createWorkspace'
  | 'delete_snippet'
  | 'delete_link'
  | 'store'
  | 'shortcuts'
  | 'profile'
  | 'calendar'
  | 'showallprompts'
  | 'show_all_links'
  | 'expand_all_folders'

  | 'refresh'
  | 'toggle-dark-mode'
  | 'upload_drive'
  | 'saved-automation';

export type LocalCommandScope = 'workspace' | 'folder' | 'snippet' | 'bookmark';
export type LocalCommandAction = 'rename' | 'delete';
export type LocalCommandBehavior = 'entity' | 'instant' | 'locked';

export interface LocalCommandDefinition {
  id: string; // Changed from LocalCommandId to string to allow newly registered commands
  label: string;
  prefix: string; // e.g., '/rename_project'
  behavior: LocalCommandBehavior;
  keywords?: string[]; // Search keywords for fuzzy matching
  // entity-selection behavior
  scope?: LocalCommandScope;
  action?: LocalCommandAction;
  // instant behavior identifier; consumers can route by this id
  executeId?: string;
  url?: string; // optional: open this URL directly for instant commands
  getDynamicLabel?: (context: any) => string;
  hotkey?: string; // User-defined hotkey (optional)
  icon?: React.ReactNode | React.ComponentType<{ className?: string; size?: number }>;
  showInDashboard?: boolean;
  category?: string;
  isAvailable?: (webContext?: any) => boolean;
}

const BASE_LOCAL_COMMANDS_BY_ID = new Map<string, LocalCommandDefinition>(
  (getLocalCommandDefinitions() as unknown as LocalCommandDefinition[]).map(cmd => [cmd.id, cmd]),
);

const ALL_LOCAL_COMMANDS_INTERNAL: LocalCommandDefinition[] = [];
const LOCAL_COMMANDS_INTERNAL: LocalCommandDefinition[] = [];

export const ALL_LOCAL_COMMANDS: LocalCommandDefinition[] = ALL_LOCAL_COMMANDS_INTERNAL;
export const LOCAL_COMMANDS: LocalCommandDefinition[] = LOCAL_COMMANDS_INTERNAL;

const syncLocalCommandCaches = () => {
  const records = useDbStore.getState().commands || [];
  const all = records.map(record => {
    const base = BASE_LOCAL_COMMANDS_BY_ID.get(record.id);
    return {
      ...(base || {}),
      id: record.id,
      label: record.label || base?.label || record.id,
      prefix: record.prefix || base?.prefix || `/${record.id}`,
      behavior: (base?.behavior || 'instant') as LocalCommandBehavior,
      keywords: base?.keywords || [record.id, record.label, record.prefix].filter(Boolean) as string[],
      hotkey: (record as any).hotkey || base?.hotkey,
      icon: record.icon || base?.icon,
      showInDashboard: base?.showInDashboard,
      category: record.category || base?.category,
      isAvailable: base?.isAvailable,
      scope: base?.scope,
      action: base?.action,
      executeId: base?.executeId,
      url: (record as any).urlTemplate || base?.url,
    } as LocalCommandDefinition;
  });

  ALL_LOCAL_COMMANDS_INTERNAL.splice(0, ALL_LOCAL_COMMANDS_INTERNAL.length, ...all);
  LOCAL_COMMANDS_INTERNAL.splice(0, LOCAL_COMMANDS_INTERNAL.length, ...all.filter(cmd => {
    const record = records.find(r => r.id === cmd.id);
    return record?.surface !== 'website';
  }));
};

syncLocalCommandCaches();
useDbStore.subscribe(() => {
  syncLocalCommandCaches();
});
/**
 * Get local commands with user customizations applied
 * (Synchronous version using the Dexie-backed command table)
 */
export const getLocalCommandsSync = async (): Promise<LocalCommandDefinition[]> => {
  return LOCAL_COMMANDS;
};

export const filterLocalCommands = (query: string): LocalCommandDefinition[] => {
  const core = query.replace(/^\//, '').toLowerCase();
  if (!core) return LOCAL_COMMANDS;
  return LOCAL_COMMANDS.filter(
    c => c.id.includes(core) || c.label.toLowerCase().includes(core) || c.prefix.includes(core),
  );
};


export const isLocalCommandId = (id: string | null | undefined): id is LocalCommandId => {
  if (!id) return false;
  return (LOCAL_COMMANDS as LocalCommandDefinition[]).some(c => c.id === id);
};
