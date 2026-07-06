import { generateEntityId } from '../../../shared-components/utils';
import type { FolderData } from './folderTypes';
import { db } from '../../../storage/indexDB/dbConfig';

/**
 * Creates a new Folder inside a specific Workspace and saves it to Dexie.
 */
export async function createFolder(workspaceId: string, folderName: string): Promise<FolderData> {
  try {
    const newFolder: FolderData = {
      id: generateEntityId('folder'),
      workspaceId,
      folderName,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Save to Dexie store
    await db.folders.put(newFolder);
    
    return newFolder;
  } catch (error: any) {
    console.error('[folderData.createFolder] Error:', error);
    throw new Error(error?.message || 'An error occurred while creating folder.');
  }
}

/**
 * Retrieves all Folders that belong to a specific Workspace, sorted by updatedAt.
 */
export async function getFoldersForWorkspace(workspaceId: string): Promise<FolderData[]> {
  try {
    // We use the workspaceId index to fetch only folders for this workspace, 
    // then sort them in memory by updatedAt to show the newest ones first.
    const folders = await db.folders.where({ workspaceId }).toArray();
    return folders.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error: any) {
    console.error(`[folderData.getFoldersForWorkspace] Error for workspace ${workspaceId}:`, error);
    return [];
  }
}

/**
 * Retrieves a single Folder by its ID.
 */
export async function getFolder(id: string): Promise<FolderData | undefined> {
  try {
    return await db.folders.get(id);
  } catch (error: any) {
    console.error(`[folderData.getFolder] Error for id ${id}:`, error);
    return undefined;
  }
}

/**
 * Updates an existing Folder with partial data.
 */
export async function updateFolder(id: string, updates: Partial<FolderData>): Promise<void> {
  try {
    const changes = {
      ...updates,
      updatedAt: Date.now() // Always bump updatedAt when a change is made
    };
    
    await db.folders.update(id, changes);
  } catch (error: any) {
    console.error(`[folderData.updateFolder] Error for id ${id}:`, error);
    throw new Error('An error occurred while updating folder.');
  }
}

/**
 * Deletes a Folder from the local Dexie store.
 * NOTE: This should ideally also delete child notes inside this folder.
 */
export async function deleteFolder(id: string): Promise<void> {
  try {
    await db.folders.delete(id);
  } catch (error: any) {
    console.error(`[folderData.deleteFolder] Error for id ${id}:`, error);
    throw new Error('An error occurred while deleting folder.');
  }
}
