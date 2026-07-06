import { db } from '../../../storage/indexDB/dbConfig';
import { generateEntityId } from '../../utils';
import type { UserShortcutRecord, ShortcutReferenceType } from './shortcutDbTypes';

const DEFAULT_USER = 'local_user';

/**
 * Saves or updates a slash command trigger for a given reference (note, snippet, command, etc.)
 */
export async function saveUserShortcut(
  trigger: string,
  referenceId: string,
  referenceType: ShortcutReferenceType,
  userId: string = DEFAULT_USER
): Promise<UserShortcutRecord> {
  // Normalize trigger: trim, lowercase, ensure it starts with "/"
  let normTrigger = trigger.trim().toLowerCase();
  if (normTrigger && !normTrigger.startsWith('/')) {
    normTrigger = `/${normTrigger}`;
  }
  const normUserId = userId.trim() || DEFAULT_USER;
  const now = Date.now();

  // 0. Ensure it does not conflict with a global command
  const cleanAlias = normTrigger.replace('/', '');
  const conflictingCommand = await db.commands
    .filter(cmd => (cmd.prefix || '').toLowerCase() === normTrigger || (cmd.id || '').toLowerCase() === cleanAlias)
    .first();

  if (conflictingCommand) {
    throw new Error(`The shortcut "${normTrigger}" is reserved by a global command "${conflictingCommand.label}". You can't add this as a command.`);
  }

  try {
    // 1. Ensure no other shortcut has this same trigger for this user
    const existingTrigger = await db.userShortcuts
      .where('trigger')
      .equals(normTrigger)
      .and(rec => rec.userId === normUserId)
      .first();

    // 2. Ensure this referenceId doesn't already have another trigger assigned
    const existingRef = await db.userShortcuts
      .where('referenceId')
      .equals(referenceId)
      .and(rec => rec.userId === normUserId)
      .first();

    if (existingTrigger) {
      const updated: UserShortcutRecord = {
        ...existingTrigger,
        referenceId,
        referenceType,
        updatedAt: now,
      };
      await db.userShortcuts.put(updated);
      
      // Clean up the other trigger if the reference was bound elsewhere
      if (existingRef && existingRef.id !== existingTrigger.id) {
        await db.userShortcuts.delete(existingRef.id);
      }
      return updated;
    } else if (existingRef) {
      const updated: UserShortcutRecord = {
        ...existingRef,
        trigger: normTrigger,
        referenceType,
        updatedAt: now,
      };
      await db.userShortcuts.put(updated);
      return updated;
    } else {
      const record: UserShortcutRecord = {
        id: generateEntityId('shortcut'),
        userId: normUserId,
        trigger: normTrigger,
        referenceId,
        referenceType,
        updatedAt: now,
      };
      await db.userShortcuts.add(record);
      return record;
    }
  } catch (error) {
    console.error('[shortcutDbData.saveUserShortcut] Failed:', error);
    throw error;
  }
}

/**
 * Retrieves a shortcut record by trigger prefix.
 */
export async function getUserShortcutByTrigger(
  trigger: string,
  userId: string = DEFAULT_USER
): Promise<UserShortcutRecord | undefined> {
  let normTrigger = trigger.trim().toLowerCase();
  if (normTrigger && !normTrigger.startsWith('/')) {
    normTrigger = `/${normTrigger}`;
  }
  try {
    return await db.userShortcuts
      .where('trigger')
      .equals(normTrigger)
      .and(rec => rec.userId === (userId.trim() || DEFAULT_USER))
      .first();
  } catch (error) {
    console.error('[shortcutDbData.getUserShortcutByTrigger] Failed:', error);
    throw error;
  }
}

/**
 * Retrieves a shortcut record by target reference ID.
 */
export async function getUserShortcutByReference(
  referenceId: string,
  userId: string = DEFAULT_USER
): Promise<UserShortcutRecord | undefined> {
  try {
    return await db.userShortcuts
      .where('referenceId')
      .equals(referenceId)
      .and(rec => rec.userId === (userId.trim() || DEFAULT_USER))
      .first();
  } catch (error) {
    console.error('[shortcutDbData.getUserShortcutByReference] Failed:', error);
    throw error;
  }
}

/**
 * Deletes a shortcut by its unique record ID.
 */
export async function deleteUserShortcut(id: string): Promise<void> {
  try {
    await db.userShortcuts.delete(id);
  } catch (error) {
    console.error('[shortcutDbData.deleteUserShortcut] Failed:', error);
    throw error;
  }
}

/**
 * Deletes any shortcut mapping registered for a specific reference ID.
 */
export async function deleteUserShortcutByReference(
  referenceId: string,
  userId: string = DEFAULT_USER
): Promise<void> {
  try {
    const existing = await getUserShortcutByReference(referenceId, userId);
    if (existing) {
      await db.userShortcuts.delete(existing.id);
    }
  } catch (error) {
    console.error('[shortcutDbData.deleteUserShortcutByReference] Failed:', error);
    throw error;
  }
}

/**
 * Retrieves all user shortcut mappings.
 */
export async function getAllUserShortcuts(userId: string = DEFAULT_USER): Promise<UserShortcutRecord[]> {
  try {
    return await db.userShortcuts
      .where('userId')
      .equals(userId.trim() || DEFAULT_USER)
      .toArray();
  } catch (error) {
    console.error('[shortcutDbData.getAllUserShortcuts] Failed:', error);
    throw error;
  }
}
