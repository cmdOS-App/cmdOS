import type { EditorType } from '../../../../../shared-components/uiStateManager/types';
import type { AiPromptRecord } from '../../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import type { LinkRecord } from '../../../../../allObjectFolder/src/createObject/links/linkTypes';
import type { NoteRecord } from '../../../../../allObjectFolder/src/createObject/notes/noteTypes';
import type { SessionRecord } from '../../../../../allObjectFolder/src/createObject/session/sessionTypes';
import type { SnippetRecord } from '../../../../../allObjectFolder/src/createObject/snippets/snippetTypes';

export type EditorItemsKind = 'link' | 'session' | 'note' | 'snippet' | 'aiPrompt';

export type EditorItemsRecord = LinkRecord | SessionRecord | NoteRecord | SnippetRecord | AiPromptRecord;

export type EditorItemsRow = {
  item: EditorItemsRecord;
  kind: EditorItemsKind;
};

export type ActiveEditorLike = {
  type: EditorType;
  id: string;
  isNew?: boolean;
  readOnly?: boolean;
  props?: any;
} | null;

const KIND_BY_EDITOR: Partial<Record<EditorType, EditorItemsKind>> = {
  link: 'link',
  session: 'session',
  note: 'note',
  snippet: 'snippet',
  aiPrompt: 'aiPrompt',
};

export const resolveEditorItemsKind = (editorType: EditorType | null | undefined): EditorItemsKind | null => {
  if (!editorType) return null;
  return KIND_BY_EDITOR[editorType] ?? null;
};

export const resolveEditorItemsKindFromActiveEditor = (activeEditor: ActiveEditorLike): EditorItemsKind | null =>
  resolveEditorItemsKind(activeEditor?.type ?? null);

export const getEditorItemsLabel = (kind: EditorItemsKind | null) => {
  if (kind === 'link') return 'Link';
  if (kind === 'session') return 'Session';
  if (kind === 'note') return 'Note';
  if (kind === 'snippet') return 'Snippet';
  if (kind === 'aiPrompt') return 'AI Prompt';
  return '';
};

export const getEditorItemsEmptyState = (kind: EditorItemsKind | null) => {
  if (kind === 'link') return 'No link items found.';
  if (kind === 'session') return 'No session items found.';
  if (kind === 'note') return 'No note items found.';
  if (kind === 'snippet') return 'No snippet items found.';
  if (kind === 'aiPrompt') return 'No AI prompt items found.';
  return 'No related items found.';
};

export const getEditorItemsId = (item: Partial<EditorItemsRecord> & { snippet_id?: string } | any) =>
  item?.id || item?.snippet_id || '';

export const getEditorItemsTitle = (item: Partial<EditorItemsRecord> | any) =>
  item?.title || item?.name || item?.label || item?.key || 'Untitled';

export const isInSelectedScope = (
  item: Partial<EditorItemsRecord> & { workspace_id?: string; folder_id?: string | null } | any,
  selectedWorkspaceId: string | null,
  selectedFolderId: string | null,
) => {
  const workspaceId = item?.workspaceId || item?.workspace_id || null;
  const folderId = item?.folderId || item?.folder_id || null;
  if (selectedWorkspaceId && workspaceId && workspaceId !== selectedWorkspaceId) return false;
  if (selectedFolderId && folderId && folderId !== selectedFolderId) return false;
  return true;
};
