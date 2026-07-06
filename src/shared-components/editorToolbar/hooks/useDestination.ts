import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../storage/indexDB/dbConfig';
import type { WorkspaceData } from '../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../../settings/allWorkspaceManager/folders/folderTypes';

export interface DestinationGroup {
  workspace: WorkspaceData;
  folders: FolderData[];
}

export function useDestination() {
  const destinationData = useLiveQuery(async () => {
    try {
      // 1. Fetch all workspaces, ordered by creation or update time (newest first)
      const workspaces = await db.workspaces.orderBy('updatedAt').reverse().toArray();
      
      // 2. Fetch all folders
      const folders = await db.folders.orderBy('updatedAt').reverse().toArray();

      // 3. Group folders by workspaceId
      const groups: DestinationGroup[] = workspaces.map(workspace => {
        const workspaceFolders = folders.filter(f => f.workspaceId === workspace.id);
        return {
          workspace,
          folders: workspaceFolders,
        };
      });

      return groups;
    } catch (error) {
      console.error('[useDestination] Failed to fetch destination data:', error);
      return [];
    }
  }, [], []);

  return {
    destinations: destinationData || [],
  };
}
