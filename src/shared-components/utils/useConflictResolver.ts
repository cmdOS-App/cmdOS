import { useCallback } from 'react';
import { useDbStore } from '../../storage/store/useDbStore';
import { findCommandByAnyId } from '../commands';

export const useConflictResolver = () => {
  const commands = useDbStore(state => state.commands);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const snippets = useDbStore(state => state.snippets);

  const findConflictingItemName = useCallback(
    (conflictingId: string) => {
      // 1. Check commands
      const cmd = findCommandByAnyId(commands, conflictingId);
      if (cmd) return cmd.label;

      // 2. Check local workspace/folder/snippet records
      for (const workspace of workspaces) {
        const workspaceId = String((workspace as any).workspaceId ?? workspace.id);
        if (workspaceId === conflictingId) {
          return String((workspace as any).workspaceName ?? (workspace as any).name ?? 'Workspace');
        }
      }

      for (const folder of folders) {
        const folderId = String((folder as any).folderId ?? folder.id);
        if (folderId === conflictingId) {
          return String((folder as any).folderName ?? (folder as any).name ?? 'Folder');
        }
      }

      for (const snippet of snippets) {
        const snippetId = String((snippet as any).snippet_id ?? snippet.id);
        const compound = `${String((snippet as any).workspaceId ?? '')}-${String((snippet as any).folderId ?? '')}-${snippetId}`;
        if (compound === conflictingId || snippetId === conflictingId) {
          return String((snippet as any).key ?? (snippet as any).title ?? 'Snippet');
        }
      }
      return null;
    },
    [commands, folders, snippets, workspaces],
  );

  return { findConflictingItemName };
};
