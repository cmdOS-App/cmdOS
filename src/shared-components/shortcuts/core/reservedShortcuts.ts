export interface ReservedShortcut {
  shortcut: string;
  reason: string;
  category: 'system' | 'navigation' | 'settings';
}

// These are text-based shortcuts (e.g., "/settings") that we want to reserve
// so users don't accidentally override critical extension commands.
export const reservedShortcuts: ReservedShortcut[] = [
  { shortcut: '/help', reason: 'Open help and documentation', category: 'system' },
  { shortcut: '/settings', reason: 'Open extension settings', category: 'settings' },
  { shortcut: '/home', reason: 'Navigate to dashboard/home', category: 'navigation' },
  { shortcut: '/search', reason: 'Trigger global search', category: 'system' },
];

/**
 * Checks if a typed shortcut (e.g., "/settings") matches any reserved system commands.
 * Returns an object with the conflict details if a match is found.
 */
export const checkReservedShortcut = (shortcutText: string): { isReserved: boolean; conflictReason: string | null } => {
  if (!shortcutText) {
    return { isReserved: false, conflictReason: null };
  }

  // Ensure it starts with '/' for consistent comparison
  let normalized = shortcutText.trim().toLowerCase();
  if (normalized && !normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  const match = reservedShortcuts.find(r => r.shortcut === normalized);

  if (match) {
    return {
      isReserved: true,
      conflictReason: `Reserved: ${match.reason}`,
    };
  }

  return { isReserved: false, conflictReason: null };
};
