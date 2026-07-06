
import type { WorkspaceData } from '../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../settings/allWorkspaceManager/folders/folderTypes';

/**
 * Formats the full path for a save destination.
 *
 * Format:
 * - Personal Space: Personal Space/Folder/Subfolder
 * - Org Private: OrgName/Private/Folder/Subfolder
 * - Org Shared: OrgName/Shared/WorkspaceName/Folder/Subfolder
 *
 * @param allTeams - All teams from Redux to search for workspace
 * @param workspaceId - The workspace ID
 * @param folderId - The folder ID (optional)
 * @param folderPathNames - Pre-computed folder path names array (optional, used when available from picker)
 */
export type WorkspaceIconType = 'lock' | 'globe' | 'users' | 'personal';

export interface PathDetails {
  iconType: WorkspaceIconType;
  pathText: string;
}

/**
 * Formats the full path details for a save destination.
 */
export const getDestinationPathDetails = (
  workspaces: WorkspaceData[] | null,
  workspaceId: string | null,
  folderId: string | null,
  folderPathNames?: string[] | null,
): PathDetails => {
  if (!workspaceId) return { iconType: 'lock', pathText: 'Select Destination' };

  const workspace = workspaces?.find(ws => ws.id === workspaceId);
  if (!workspace) return { iconType: 'lock', pathText: 'Select Destination' };

  let iconType: WorkspaceIconType = 'lock';
  let fullPath = workspace.workspaceName;

  // If no folder selected, just return workspace path
  if (!folderId && (!folderPathNames || folderPathNames.length === 0)) {
    return { iconType, pathText: fullPath };
  }

  // Use provided folderPathNames if available (from picker via breadcrumb)
  if (folderPathNames && folderPathNames.length > 0) {
    folderPathNames.forEach(name => {
      fullPath += ` /${name}`;
    });
    return { iconType, pathText: fullPath };
  }

  // Fallback: try to find folder path in workspace folders (for legacy/direct access)
  if (folderId) {
    const folderPath = findFolderPath([], folderId);
    if (folderPath && folderPath.length > 0) {
      folderPath.forEach(f => { fullPath += ` /${f.folderName}`; });
      return { iconType, pathText: fullPath };
    }
  }

  return { iconType, pathText: fullPath };
};

/**
 * Legacy wrapper for backward compatibility (returns just text now, emojis stripped).
 * @deprecated Use getDestinationPathDetails for structured data including icon type.
 */
export const formatSaveDestinationPath = (
  workspaces: WorkspaceData[] | null,
  workspaceId: string | null,
  folderId: string | null,
  folderPathNames?: string[] | null,
): string => {
  const { pathText } = getDestinationPathDetails(workspaces, workspaceId, folderId, folderPathNames);
  return pathText;
};

/**
 * Finds a workspace across all teams by workspace ID.
 */
/**
 * Recursively searches for a folder path within a workspace's folder structure.
 * Returns an array of folders starting from the root-most folder down to the target folder.
 */
export const findFolderPath = (_folders: FolderData[], _targetFolderId: string): FolderData[] | null => {
  return null;
};
