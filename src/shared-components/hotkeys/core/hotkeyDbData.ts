import { db } from '../../../storage/indexDB/dbConfig';
import { generateEntityId } from '../../utils';
import type { UserHotkeyRecord, HotkeyReferenceType } from './hotkeyDbTypes';

const DEFAULT_USER = 'local_user';

/**
 * Saves or updates a hotkey combination for a given reference (note, snippet, command, etc.)
 */
export async function saveUserHotkey(
  combination: string,
  referenceId: string,
  referenceType: HotkeyReferenceType,
  userId: string = DEFAULT_USER
): Promise<UserHotkeyRecord> {
  const normCombo = combination.trim();
  const normUserId = userId.trim() || DEFAULT_USER;
  const now = Date.now();

  try {
    // 1. Ensure no other hotkey has this same combination for this user
    const existingCombo = await db.userHotkeys
      .where('combination')
      .equals(normCombo)
      .and(rec => rec.userId === normUserId)
      .first();

    // 2. Ensure this referenceId doesn't already have another combination assigned
    const existingRef = await db.userHotkeys
      .where('referenceId')
      .equals(referenceId)
      .and(rec => rec.userId === normUserId)
      .first();

    if (existingCombo) {
      const updated: UserHotkeyRecord = {
        ...existingCombo,
        referenceId,
        referenceType,
        updatedAt: now,
      };
      await db.userHotkeys.put(updated);
      
      // Clean up the other combination if the reference was bound elsewhere
      if (existingRef && existingRef.id !== existingCombo.id) {
        await db.userHotkeys.delete(existingRef.id);
      }
      return updated;
    } else if (existingRef) {
      const updated: UserHotkeyRecord = {
        ...existingRef,
        combination: normCombo,
        referenceType,
        updatedAt: now,
      };
      await db.userHotkeys.put(updated);
      return updated;
    } else {
      const record: UserHotkeyRecord = {
        id: generateEntityId('hotkey'),
        userId: normUserId,
        combination: normCombo,
        referenceId,
        referenceType,
        updatedAt: now,
      };
      await db.userHotkeys.add(record);
      return record;
    }
  } catch (error) {
    console.error('[hotkeyDbData.saveUserHotkey] Failed:', error);
    throw error;
  }
}

/**
 * Retrieves a hotkey record by key combination.
 */
export async function getUserHotkeyByCombination(
  combination: string,
  userId: string = DEFAULT_USER
): Promise<UserHotkeyRecord | undefined> {
  try {
    return await db.userHotkeys
      .where('combination')
      .equals(combination.trim())
      .and(rec => rec.userId === (userId.trim() || DEFAULT_USER))
      .first();
  } catch (error) {
    console.error('[hotkeyDbData.getUserHotkeyByCombination] Failed:', error);
    throw error;
  }
}

/**
 * Retrieves a hotkey record by target reference ID.
 */
export async function getUserHotkeyByReference(
  referenceId: string,
  userId: string = DEFAULT_USER
): Promise<UserHotkeyRecord | undefined> {
  try {
    return await db.userHotkeys
      .where('referenceId')
      .equals(referenceId)
      .and(rec => rec.userId === (userId.trim() || DEFAULT_USER))
      .first();
  } catch (error) {
    console.error('[hotkeyDbData.getUserHotkeyByReference] Failed:', error);
    throw error;
  }
}

/**
 * Deletes a hotkey by its unique record ID.
 */
export async function deleteUserHotkey(id: string): Promise<void> {
  try {
    await db.userHotkeys.delete(id);
  } catch (error) {
    console.error('[hotkeyDbData.deleteUserHotkey] Failed:', error);
    throw error;
  }
}

/**
 * Deletes any hotkey mapping registered for a specific reference ID.
 */
export async function deleteUserHotkeyByReference(
  referenceId: string,
  userId: string = DEFAULT_USER
): Promise<void> {
  try {
    const existing = await getUserHotkeyByReference(referenceId, userId);
    if (existing) {
      await db.userHotkeys.delete(existing.id);
    }
  } catch (error) {
    console.error('[hotkeyDbData.deleteUserHotkeyByReference] Failed:', error);
    throw error;
  }
}

/**
 * Retrieves all user hotkey mappings.
 */
export async function getAllUserHotkeys(userId: string = DEFAULT_USER): Promise<UserHotkeyRecord[]> {
  try {
    return await db.userHotkeys
      .where('userId')
      .equals(userId.trim() || DEFAULT_USER)
      .toArray();
  } catch (error) {
    console.error('[hotkeyDbData.getAllUserHotkeys] Failed:', error);
    throw error;
  }
}
