import { useLiveQuery } from 'dexie-react-hooks';
import { getAllUserShortcuts, getUserShortcutByTrigger, getUserShortcutByReference } from '../core/shortcutDbData';

const DEFAULT_USER = 'local_user';

/**
 * Hook to subscribe to all user shortcuts.
 */
export function useUserShortcuts(userId: string = DEFAULT_USER) {
  const normUserId = userId.trim() || DEFAULT_USER;
  return useLiveQuery(() => getAllUserShortcuts(normUserId), [normUserId]);
}

/**
 * Hook to subscribe to a single shortcut by trigger.
 */
export function useUserShortcutByTrigger(trigger: string, userId: string = DEFAULT_USER) {
  const normUserId = userId.trim() || DEFAULT_USER;
  return useLiveQuery(() => getUserShortcutByTrigger(trigger, normUserId), [trigger, normUserId]);
}

/**
 * Hook to subscribe to a single shortcut by target reference ID.
 */
export function useUserShortcutByReference(referenceId: string, userId: string = DEFAULT_USER) {
  const normUserId = userId.trim() || DEFAULT_USER;
  return useLiveQuery(() => getUserShortcutByReference(referenceId, normUserId), [referenceId, normUserId]);
}
