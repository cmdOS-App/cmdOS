import { db } from '../../storage/indexDB/dbConfig';
import { generateEntityId } from '../utils';
import type { FavoriteRecord } from './favoriteTypes';

export async function addFavoriteRecord(
  userId: string,
  referenceId: string,
  referenceType: string,
  label?: string
): Promise<FavoriteRecord> {
  const existing = await db.favorites.where('[user_id+reference_id]').equals([userId, referenceId]).first();
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const id = generateEntityId('fav');
  const record: FavoriteRecord = {
    id,
    favourite_id: '',
    user_id: userId,
    reference_id: referenceId,
    reference_type: referenceType,
    label,
    updatedAt: now,
  };

  await db.favorites.add(record);
  return record;
}

export async function removeFavoriteRecord(userId: string, referenceId: string): Promise<void> {
  const record = await db.favorites.where('[user_id+reference_id]').equals([userId, referenceId]).first();
  if (record) {
    await db.favorites.delete(record.id);
  }
}

export async function toggleFavoriteRecord(
  userId: string,
  referenceId: string,
  referenceType: string,
  label?: string
): Promise<boolean> {
  const existing = await db.favorites.where('[user_id+reference_id]').equals([userId, referenceId]).first();
  if (existing) {
    await db.favorites.delete(existing.id);
    return false; // Not favorited anymore
  } else {
    await addFavoriteRecord(userId, referenceId, referenceType, label);
    return true; // Is favorited now
  }
}
