import { db } from '../indexDB/dbConfig';
import type { WorkspaceData } from '../../settings/allWorkspaceManager/workspaces/workspaceTypes';

const LAST_USED_WORKSPACE_KEY = 'lastUsedWorkspaceId';

/**
 * Saves the given workspace ID to chrome.storage.local as the last used workspace.
 */
export async function setLastUsedWorkspaceId(workspaceId: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [LAST_USED_WORKSPACE_KEY]: workspaceId });
  } else {
    // Fallback for non-extension environments (e.g. web tests)
    localStorage.setItem(LAST_USED_WORKSPACE_KEY, workspaceId);
  }
}

/**
 * Smartly retrieves the best workspace to use for new notes.
 * 1. Tries to get the last explicitly used workspace from local storage for maximum speed.
 * 2. If it doesn't exist, queries Dexie for the most recently updated workspace.
 * 3. Returns the WorkspaceData object.
 */
export async function getSmartDefaultWorkspace(): Promise<WorkspaceData | undefined> {
  try {
    let lastUsedId: string | null = null;
    
    // 1. FAST CACHE LOOKUP
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get([LAST_USED_WORKSPACE_KEY]);
      lastUsedId = data[LAST_USED_WORKSPACE_KEY];
    } else {
      lastUsedId = localStorage.getItem(LAST_USED_WORKSPACE_KEY);
    }

    // If we have a saved ID, quickly grab it from Dexie
    if (lastUsedId) {
      const workspace = await db.workspaces.get(lastUsedId);
      if (workspace) return workspace;
    }

    // 2. FALLBACK LOOKUP
    // If no saved ID (or the saved workspace was deleted),
    // grab the most recently updated workspace from Dexie.
    const allWorkspaces = await db.workspaces.orderBy('updatedAt').reverse().toArray();
    
    if (allWorkspaces.length > 0) {
      const fallbackWorkspace = allWorkspaces[0];
      // Automatically cache it so we don't have to query the full list next time
      await setLastUsedWorkspaceId(fallbackWorkspace.id);
      return fallbackWorkspace;
    }

    // No workspaces exist at all
    return undefined;
  } catch (error) {
    console.error('[lastUsedWorkspace] Error fetching smart default workspace:', error);
    return undefined;
  }
}
