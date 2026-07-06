import { saveUserShortcut, deleteUserShortcutByReference } from './shortcutDbData';
import { extractSnippetIdFromCompoundId } from '../../hotkeys/utils/hotkeyUtils';

export type ShortcutItemType = 'link' | 'note' | 'snippet' |  'automation' | 'module' | 'command';
export type StorageMode = 'local' | 'cloud';

const syncShortcutToChromeStorage = async (snippetId: string, compoundId: string, shortcut: string | null, itemType: string) => {
  const chromeAny = (window as any)?.chrome;
  if (!chromeAny?.storage?.local) return;

  const storageKey = itemType === 'link' ? 'link_commands' : 'note_commands';

  return new Promise<void>(resolve => {
    chromeAny.storage.local.get([storageKey], (res: any) => {
      const map = res[storageKey] || {};
      if (shortcut) {
        const entry = map[compoundId] || {};
        entry.shortcut = shortcut;
        entry.snippetId = snippetId || extractSnippetIdFromCompoundId(compoundId) || compoundId;
        map[compoundId] = entry;
      } else {
        delete map[compoundId];
      }
      chromeAny.storage.local.set({ [storageKey]: map }, () => resolve());
    });
  });
};

export async function saveShortcut(
  snippetId: any,
  compoundId: string,
  shortcut: string,
  itemName: string,
  itemType: ShortcutItemType = 'note',
  _storageMode?: any,
  _skipCloud?: any
) {
  if (shortcut) {
    await saveUserShortcut(shortcut, compoundId, itemType as any);
  } else {
    await deleteUserShortcutByReference(compoundId);
  }
  
  await syncShortcutToChromeStorage(snippetId, compoundId, shortcut || null, itemType);
  return null;
}

/**
 * Universally clears a shortcut from IndexedDB.
 */
export async function clearShortcut(
  snippetId: any,
  compoundId: string,
  itemType: ShortcutItemType = 'note',
  _storageMode?: any,
  _skipCloud?: any
) {
  await deleteUserShortcutByReference(compoundId);
  await syncShortcutToChromeStorage(snippetId, compoundId, null, itemType);
}
