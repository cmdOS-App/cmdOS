import React, { useMemo } from 'react';
import { FiEdit2 } from 'react-icons/fi';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import {
  getEditorItemsId,
  getEditorItemsEmptyState,
  getEditorItemsLabel,
  getEditorItemsTitle,
  isInSelectedScope,
  resolveEditorItemsKindFromActiveEditor,
  type ActiveEditorLike,
  type EditorItemsRow,
  type EditorItemsKind,
} from './editorItemsPanelLogic';

interface EditorItemsPanelProps {
  activeEditor: ActiveEditorLike;
  onOpenUrls?: (urls: string[], title?: string) => void;
  onRequestEditLink?: (suggestion: { snippet: any; workspace: any; folder: any }) => void;
}

export const EditorItemsPanel: React.FC<EditorItemsPanelProps> = ({
  activeEditor,
  onOpenUrls,
  onRequestEditLink,
}) => {
  const panelType = resolveEditorItemsKindFromActiveEditor(activeEditor);
  const links = useDbStore(state => state.links);
  const sessions = useDbStore(state => state.sessions);
  const notes = useDbStore(state => state.notes);
  const snippets = useDbStore(state => state.snippets);
  const aiPrompts = useDbStore(state => state.aiPrompts);
  const selectedWorkspaceId = useUIStore(state => state.selectedWorkspaceId);
  const selectedFolderId = useUIStore(state => state.selectedFolderId);

  const items = useMemo(() => {
    const withKind = (list: any[], kind: EditorItemsKind) =>
      list.filter(item => isInSelectedScope(item, selectedWorkspaceId, selectedFolderId)).map(item => ({ item, kind }));

    if (panelType === 'link') return withKind(links, 'link');
    if (panelType === 'session') return withKind(sessions, 'session');
    if (panelType === 'note') return withKind(notes, 'note');
    if (panelType === 'snippet') return withKind(snippets, 'snippet');
    if (panelType === 'aiPrompt') return withKind(aiPrompts, 'aiPrompt');
    return [];
  }, [aiPrompts, links, notes, panelType, selectedFolderId, selectedWorkspaceId, sessions, snippets]);

  const triggerExistingItem = (item: any, kind: EditorItemsKind) => {
    const id = getEditorItemsId(item);
    if (!id) return;

    if (kind === 'link') {
      const urls = Array.isArray(item?.urls) ? item.urls.map((u: any) => u.url || u).filter(Boolean) : [];
      const title = getEditorItemsTitle(item);
      if (urls.length > 0) {
        if (onOpenUrls) {
          onOpenUrls(urls, title);
        } else {
          urls.forEach((url: string, index: number) => {
            const chromeAny = (window as any)?.chrome;
            if (chromeAny?.tabs?.create) {
              chromeAny.tabs.create({ url, active: index === 0 });
            } else {
              window.open(url, '_blank');
            }
          });
        }
        return;
      }
      useUIStore.getState().openEditor({ type: 'link', id, props: { snippet: item } });
      return;
    }

    if (kind === 'session') {
      useUIStore.getState().openEditor({ type: 'session', id, props: { snippet: item } });
      return;
    }

    if (kind === 'note') {
      useUIStore.getState().openEditor({ type: 'note', id, props: { snippet: item } });
      return;
    }

    if (kind === 'snippet') {
      useUIStore.getState().openEditor({ type: 'snippet', id, props: { snippet: item } });
      return;
    }

    if (kind === 'aiPrompt') {
      useUIStore.getState().openEditor({ type: 'aiPrompt', id, props: { snippet: item } });
    }
  };

  const editExistingItem = (item: any, kind: EditorItemsKind) => {
    const id = getEditorItemsId(item);
    if (!id) return;

    if (kind === 'link') {
      const workspace = item?.workspace || (item?.workspaceId || item?.workspace_id ? { workspace_id: item.workspaceId || item.workspace_id } : null);
      const folder = item?.folder || (item?.folderId || item?.folder_id ? { folder_id: item.folderId || item.folder_id } : null);
      const suggestionPayload = { snippet: item, workspace, folder };
      if (onRequestEditLink) {
        onRequestEditLink(suggestionPayload);
      } else {
        useUIStore.getState().setLinkEditPrefill({ snippet: item });
        useUIStore.getState().openEditor({ type: 'link', id, props: { editMode: true, snippet: item } });
      }
      return;
    }

    if (kind === 'session') {
      useUIStore.getState().openEditor({ type: 'session', id, props: { editMode: true, snippet: item } });
      return;
    }

    if (kind === 'note') {
      useUIStore.getState().openEditor({ type: 'note', id, props: { editMode: true, snippet: item } });
      return;
    }

    if (kind === 'snippet') {
      useUIStore.getState().openEditor({ type: 'snippet', id, props: { editMode: true, snippet: item } });
      return;
    }

    if (kind === 'aiPrompt') {
      useUIStore.getState().openEditor({ type: 'aiPrompt', id, props: { editMode: true, snippet: item } });
    }
  };

  if (!panelType) {
    return <div className="px-3 py-4 text-sm text-neutral-500">Open a link or session editor to see related items.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 relative">
        <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-neutral-500 dark:text-neutral-400">
          {getEditorItemsLabel(panelType)} ({items.length})
        </span>
        <div className="flex-1 border-t border-[#eee8d5] dark:border-white/10" />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {items.length === 0 ? (
          <div className="px-2 py-3 text-sm text-neutral-500">{getEditorItemsEmptyState(panelType)}</div>
        ) : (
          <div className="flex flex-col gap-1">
            {items.map(({ item, kind }: EditorItemsRow) => (
              <div
                key={`${kind}-${getEditorItemsId(item)}`}
                className="group flex items-center justify-between rounded-md px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5">
                <button
                  type="button"
                  onClick={() => triggerExistingItem(item, kind)}
                  className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[13px] font-medium text-neutral-800 dark:text-neutral-200">
                    {getEditorItemsTitle(item)}
                  </div>
                  <div className="truncate text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                    {kind}
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="Edit item"
                  onClick={e => {
                    e.stopPropagation();
                    editExistingItem(item, kind);
                  }}
                  className="ml-2 rounded p-1 text-neutral-500 opacity-80 hover:bg-black/5 hover:text-neutral-900 group-hover:opacity-100 dark:hover:bg-white/10 dark:hover:text-white">
                  <FiEdit2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorItemsPanel;
