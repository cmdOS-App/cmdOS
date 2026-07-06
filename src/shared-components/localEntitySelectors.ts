import { useDbStore } from '../storage/store/useDbStore';
import { useUIStore } from './uiStateManager';

export const useSelectedWorkspaceId = () => useUIStore(state => state.selectedWorkspaceId);
export const useSelectedFolderId = () => useUIStore(state => state.selectedFolderId);
export const useSelectedSnippetId = () => useUIStore(state => state.selectedSnippetId);

export const useWorkspaceById = (workspaceId: string | null | undefined) =>
  useDbStore(state => (workspaceId ? state.workspaces.find(workspace => workspace.id === workspaceId) ?? null : null));

export const useFolderById = (folderId: string | null | undefined) =>
  useDbStore(state => (folderId ? state.folders.find(folder => folder.id === folderId) ?? null : null));

export const useSnippetById = (snippetId: string | null | undefined) =>
  useDbStore(state => (snippetId ? state.snippets.find(snippet => snippet.id === snippetId) ?? null : null));

export const useNoteById = (noteId: string | null | undefined) =>
  useDbStore(state => (noteId ? state.notes.find(note => note.id === noteId) ?? null : null));

export const useLinkById = (linkId: string | null | undefined) =>
  useDbStore(state => (linkId ? state.links.find(link => link.id === linkId) ?? null : null));

export const useSelectedWorkspace = () => {
  const workspaceId = useSelectedWorkspaceId();
  return useWorkspaceById(workspaceId);
};

export const useSelectedFolder = () => {
  const folderId = useSelectedFolderId();
  return useFolderById(folderId);
};

export const useSelectedSnippet = () => {
  const snippetId = useSelectedSnippetId();
  return useSnippetById(snippetId);
};

