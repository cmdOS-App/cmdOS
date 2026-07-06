/**
 * @file commandData.ts
 * @description Manages database logic (CRUD) for Command records in IndexedDB.
 * Handles synchronizing commands from the default command registry into the local database.
 * 
 * @usage
 * ```ts
 * import { syncCommandsFromSource, getAllCommands } from './commandData';
 * await syncCommandsFromSource();
 * ```
 */

import { db } from '../../../../storage/indexDB/dbConfig';

import { generateEntityId } from '../../../../shared-components/utils';
import { ALL_COMMANDS } from '../../../../shared-components/commands';
import type { CommandModule } from '../../../../shared-components/commands';
import type {
  CommandRecord,
  CreateCommandInput,
  UpdateCommandInput,
} from './commandTypes';

export async function createCommand(input: CreateCommandInput): Promise<CommandRecord> {
  const now = Date.now();
  const command: CommandRecord = {
    id: input.id || generateEntityId('command'),
    label: input.label.trim(),
    prefix: input.prefix.trim(),
    behavior: input.behavior,
    surface: input.surface,
    site: input.site,
    pageType: input.pageType,
    iconHost: input.iconHost,
    category: input.category,
    type: (input as any).type,
    urlTemplate: (input as any).urlTemplate,
    enabled: input.enabled ?? true,
    updatedAt: now,
  };

  await db.commands.put(command);
  return command;
}

export async function updateCommand(commandId: string, input: UpdateCommandInput): Promise<CommandRecord> {
  const existing = await db.commands.get(commandId);
  if (!existing) {
    throw new Error('Command not found.');
  }

  const updated: CommandRecord = {
    ...existing,
    label: input.label !== undefined ? input.label.trim() : existing.label,
    prefix: input.prefix !== undefined ? input.prefix.trim() : existing.prefix,
    behavior: input.behavior ?? existing.behavior,
    surface: input.surface !== undefined ? input.surface : existing.surface,
    site: input.site !== undefined ? input.site : existing.site,
    pageType: input.pageType !== undefined ? input.pageType : existing.pageType,
    iconHost: input.iconHost !== undefined ? input.iconHost : existing.iconHost,
    category: input.category !== undefined ? input.category : existing.category,
    type: (input as any).type !== undefined ? (input as any).type : existing.type,
    urlTemplate: (input as any).urlTemplate !== undefined ? (input as any).urlTemplate : existing.urlTemplate,
    enabled: input.enabled ?? existing.enabled,
    updatedAt: Date.now(),
  };

  await db.commands.put(updated);
  return updated;
}

export async function getCommand(id: string): Promise<CommandRecord | undefined> {
  return db.commands.get(id);
}

export async function getAllCommands(): Promise<CommandRecord[]> {
  return db.commands.orderBy('label').toArray();
}

export async function getCommandsBySurface(surface: CommandRecord['surface']): Promise<CommandRecord[]> {
  if (!surface) {
    return getAllCommands();
  }

  return db.commands.where('surface').anyOf(surface, 'both').toArray();
}

export async function deleteCommand(id: string): Promise<void> {
  await db.commands.delete(id);
}

function toCommandRecord(command: CommandModule): CommandRecord {
  const lowerId = String(command.id || '').toLowerCase();
  const isGithubCommand = lowerId.startsWith('github_');
  const site = isGithubCommand ? 'github' : undefined;
  const pageType =
    lowerId.includes('_org_') || lowerId.endsWith('_org_action')
      ? 'organization'
      : isGithubCommand
        ? 'repository'
        : undefined;

  return {
    id: command.id,
    label: command.label,
    prefix: command.prefix,
    behavior: command.behavior as CommandRecord['behavior'],
    surface: command.category === 'thissite_action' || typeof command.isAvailable === 'function' ? 'website' : 'both',
    site,
    pageType,
    iconHost: command.iconHost,
    category: command.category,
    type: (command as any).type,
    urlTemplate: (command as any).urlTemplate,
    enabled: true,
    updatedAt: Date.now(),
  };
}

export function getSeedCommands(): CommandRecord[] {
  return ALL_COMMANDS.map(toCommandRecord);
}

export async function syncCommandsFromSource(): Promise<CommandRecord[]> {
  const seedCommands = getSeedCommands();

  // The command catalog is source-of-truth data. Always upsert the full seed so
  // older partial tables get repaired and new commands are added automatically.
  //
  // Important: we intentionally do not persist React icon values here because
  // IndexedDB uses structured clone and cannot reliably store React elements or
  // component references. The UI hydrates icons from the in-memory registry.
  await db.commands.bulkPut(seedCommands);

  return db.commands.orderBy('label').toArray();
}

export const seedCommandsIfNeeded = syncCommandsFromSource;
