import { useCallback } from 'react';
import { readAllShortcuts, extractSnippetIdFromCompoundId } from '../../hotkeys/utils/hotkeyUtils';
import { checkReservedShortcut } from '../core/reservedShortcuts';
import { useConflictResolver } from '../../utils/useConflictResolver';
import type { ValidationResult } from '../../hotkeys';

export const useShortcutValidation = () => {
  const { findConflictingItemName } = useConflictResolver();

  const validateShortcut = useCallback(
    async (shortcutValue: string, currentItemId: string): Promise<ValidationResult> => {
      if (!shortcutValue) {
        return { isValid: true, conflictId: null, errorMessage: null };
      }

      let normalized = shortcutValue.trim().toLowerCase();
      if (normalized && !normalized.startsWith('/')) {
        normalized = `/${normalized}`;
      }

      // 1. Check if it's a reserved system command
      const { isReserved, conflictReason } = checkReservedShortcut(normalized);
      if (isReserved) {
        return {
          isValid: false,
          conflictId: 'reserved',
          errorMessage: conflictReason || 'This is a reserved system shortcut',
        };
      }

      // 2. Check for duplicates
      const allShortcuts = await readAllShortcuts();
      const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalized && extractSnippetIdFromCompoundId(id) !== extractSnippetIdFromCompoundId(currentItemId || ''));

      if (existingEntry) {
        const conflictingId = existingEntry[0];
        const conflictName = findConflictingItemName(conflictingId);
        const msg = conflictName
          ? `Shortcut "${normalized}" is already assigned to "${conflictName}"`
          : `Shortcut "${normalized}" is already assigned`;

        return {
          isValid: false,
          conflictId: conflictingId,
          errorMessage: msg,
        };
      }

      return { isValid: true, conflictId: null, errorMessage: null };
    },
    [findConflictingItemName],
  );

  return { validateShortcut };
};
