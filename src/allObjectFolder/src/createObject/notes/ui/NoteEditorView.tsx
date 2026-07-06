import React, { useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { useNoteEditor } from '../useNoteEditor';
import { normalizeNoteBody } from '../noteHelpers';
import TextEditor from '../../../../../shared-components/TextEditor';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import DeleteConfirmation from '../../../../../shared-components/modals/deleteDialog';
import UnsavedChangesDialog from '../../../../../shared-components/modals/unsavedChangesDialog';
import { FaCheckCircle, FaTimes } from 'react-icons/fa';
import type { SharedProperties } from '../../../../../shared-components/editorToolbar/types';
import { createTodo } from '../../todos/todoData';
import { useRelativeSavedTime } from '../../../../../shared-components/utils';
export interface NoteEditorViewProps {
  noteId?: string | null;
  onBack?: () => void;
  initialDraftKey?: string;
  initialDraftContent?: string;
  isFullScreenMode?: boolean;
}

export function NoteEditorView(props: NoteEditorViewProps) {
  const { isFullScreenMode = false } = props;
  const [isForceCreateNew, setIsForceCreateNew] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const editorProps = React.useMemo(() => {
    if (isForceCreateNew) {
      return { ...props, noteId: null };
    }
    return props;
  }, [props, isForceCreateNew]);

  const state = useNoteEditor(editorProps);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarIdRef = React.useRef(`note-toolbar-${Math.random().toString(36).slice(2, 10)}`);
  const defaultToolbarNameRef = React.useRef(state.noteTitle);
  const toolbarSelector = `#${toolbarIdRef.current}`;

  const isFocusMode = useUIStore((s: any) => s.isFocusMode);
  const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';

  const lastSavedMessage = useRelativeSavedTime(state.lastSavedAt);

  const tagIdsKey = React.useMemo(() => [...state.tagIds].sort().join('|'), [state.tagIds]);
  const initialProperties = React.useMemo(() => {
    return {
      id: state.activeNoteId,
      title: state.noteTitle,
      workspaceId: state.workspaceId,
      folderId: state.folderId,
      tags: [...state.tagIds].sort().map((id: string) => ({ tag_id: id, name: '' })),
    };
  }, [state.activeNoteId, state.noteTitle, state.workspaceId, state.folderId, tagIdsKey]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (state.titleInputRef.current) {
        state.titleInputRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [state.titleInputRef]);

  React.useEffect(() => {
    if (!defaultToolbarNameRef.current && state.noteTitle.trim()) {
      defaultToolbarNameRef.current = state.noteTitle;
    }
  }, [state.noteTitle]);

  const handleCreateNew = useCallback(async () => {
    // Save current note before creating new
    await state.handleSave();

    setIsForceCreateNew(true);
    state.setNoteTitle('');
    state.setNoteBody('');
    defaultToolbarNameRef.current = '';
    if (state.titleInputRef.current) {
      state.titleInputRef.current.focus();
    }
  }, [state]);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      // Create New Shortcut strictly on Ctrl+Shift+Enter
      if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
        event.preventDefault();
        if (state.activeNoteId) {
          handleCreateNew();
        }
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [state.activeNoteId, handleCreateNew]);

  const handleDeleteClick = React.useCallback(() => {
    state.setIsDeleteDialogOpen(true);
  }, [state.setIsDeleteDialogOpen]);

  const onDeleteProp = state.activeNoteId ? handleDeleteClick : undefined;

  if (state.activeNoteId && state.liveNote === undefined && !state.isNoteDeleted) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-[var(--color-editorBg)] text-neutral-900 dark:text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[var(--color-borderDefault)] border-t-neutral-900 dark:border-t-white rounded-full animate-spin" />
          <p className="text-lg font-medium">Loading note...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <EditorContainer
        ref={containerRef}
        className={`w-full h-full flex flex-col gap-1 text-left text-neutral-900 dark:text-white bg-transparent ${isFullScreenMode || isEmbedded ? '' : 'px-4 md:px-8 lg:px-12 py-6 md:py-10'
          }`}
        innerClassName={`flex-1 flex-shrink-0 flex flex-col relative overflow-visible ${isFullScreenMode
            ? 'w-full rounded-none'
            : 'w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto rounded-xl -translate-x-6'
          } bg-[var(--color-editorBg)] ${isFocusMode || isFullScreenMode ? 'border-none' : 'border border-black/5 dark:border-white/10'
          }`}
      >
        {state.isNoteDeleted ? (
          <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-10">
            <div className="max-w-md w-full rounded-2xl border border-red-200/70 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-6 text-center shadow-sm">
              <div className="text-lg font-semibold text-red-700 dark:text-red-300">This note was deleted in another tab.</div>
              <div className="mt-2 text-sm text-red-600/90 dark:text-red-200/80">
                The editor is disabled to avoid saving stale content.
              </div>
              <button
                type="button"
                onClick={state.handleClose}
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex overflow-visible flex-col bg-transparent text-neutral-900 dark:text-white">
            <div className="flex-1 flex min-h-0 relative">
              {isFullScreenMode && <div className="h-20 flex-shrink-0" />}

              <div className="flex-1 flex flex-col min-h-0 relative">
                <div className="absolute top-4 right-4 md:top-5 md:right-5 z-50 flex items-center gap-3">
                  <div className="transition-opacity duration-300">
                    {state.saveStatus !== 'idle' && (
                      <>
                        {state.saveStatus === 'saving' && (
                          <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap">
                            Saving...
                          </span>
                        )}

                        {state.saveStatus === 'saved' && (
                          <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap">
                            {lastSavedMessage} <FaCheckCircle className="opacity-70 text-xs text-emerald-500" />
                          </span>
                        )}

                        {state.saveStatus === 'error' && (
                          <span className="text-sm font-medium text-red-500 dark:text-red-400 flex items-center gap-1 whitespace-nowrap">
                            Save Failed <FaTimes className="opacity-70 text-xs" />
                          </span>
                        )}

                        {state.saveStatus === 'conflict' && (
                          <span className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 whitespace-nowrap">
                            Conflict <FaTimes className="opacity-70 text-xs" />
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {state.conflictNote && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100">
                      <div className="font-semibold">This note changed in another tab.</div>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={state.resolveConflictWithRemote}
                          className="rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-50 dark:hover:bg-amber-900"
                        >
                          Use latest
                        </button>
                        <button
                          type="button"
                          onClick={state.keepLocalVersion}
                          className="rounded-md bg-white px-2 py-1 font-medium text-amber-900 hover:bg-amber-100 dark:bg-neutral-800 dark:text-amber-50 dark:hover:bg-neutral-700"
                        >
                          Keep mine and overwrite latest version
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={state.handleClose}
                    className="p-2 opacity-50 hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-all focus:outline-none focus:ring-1 focus:ring-red-400"
                    title="Close"
                  >
                    <FaTimes size={16} />
                  </button>
                </div>

                <div className="w-full flex-1 flex flex-col min-h-0 px-6 md:px-12 py-6">
                  <div className={`flex items-center gap-2 flex-shrink-0 relative z-10 ${isFullScreenMode ? 'py-8 pr-6' : 'py-4'}`}>
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <input
                        ref={state.titleInputRef}
                        value={state.noteTitle}
                        onChange={e => state.setNoteTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            state.editorRef.current?.focus();
                          }
                        }}
                        type="text"
                        placeholder="Untitled note"
                        style={{ pointerEvents: 'auto' }}
                        className={`w-full text-[28px] font-semibold text-black dark:text-white placeholder-[var(--color-textPlaceholder)]/70 bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 ${isFullScreenMode ? 'pl-8' : ''}`}
                      />
                    </div>
                    <div className="flex-1" />
                  </div>

                  <div className={`flex-1 min-h-0 font-sans overflow-hidden flex flex-col text-neutral-900 dark:text-white ${isFullScreenMode ? 'pl-8 pr-6 pt-1' : 'pb-3'}`}>
                    <div className="flex-1 min-h-0 overflow-hidden relative">
                      <TextEditor
                        ref={state.editorRef}
                        value={state.noteBody}
                        onChange={state.setNoteBody}
                        placeholder="Start writing your note..."
                        readOnly={false}
                        onUpArrowAtStart={() => state.titleInputRef.current?.focus()}
                        showToolbar={true}
                        toolbarSelector={toolbarSelector}
                        isFocusMode={isFullScreenMode}
                        onDelete={onDeleteProp}
                        normalizeHtml={normalizeNoteBody}
                        syncRevision={state.syncRevision}
                      />
                    </div>
                  </div>
                </div>

                <div className="absolute left-full top-1/2 -translate-y-1/2 z-50 select-none flex flex-col items-center gap-1 p-1 rounded-r-2xl rounded-l-none bg-[var(--color-editorBg)] border border-l-0 border-black/10 dark:border-white/15 shadow-lg">
                  <SharedPropertiesToolbar
                    initialSnippet={initialProperties}
                    compoundId={state.activeNoteId ? `${state.workspaceId || ''}-${state.folderId || ''}-${state.activeNoteId}` : ''}
                    defaultName={defaultToolbarNameRef.current}
                    onChange={state.handlePropertiesChange}
                    showTodo={true}
                    todoStatus={'idle'}
                    openPopupsToLeft={true}
                    onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
                      if (!state.activeNoteId) return;
                      const scheduleTime = deadlineVal ? new Date(deadlineVal).getTime() : Date.now();
                      try {
                        const newTodo = await createTodo(
                          state.noteTitle || 'Untitled Note',
                          [{ type: 'note', id: state.activeNoteId }],
                          isRecurring ? 'recurring' : 'one-time',
                          scheduleTime,
                          isRecurring ? recurringCycle as any : undefined
                        );

                        const chromeAny = (window as any).chrome;
                        if (chromeAny?.runtime?.sendMessage) {
                          chromeAny.runtime.sendMessage({
                            action: 'schedule_newtodo_alarm',
                            todoId: newTodo.id,
                            scheduleTime: scheduleTime
                          });
                        }
                      } catch (err) {
                        console.error('Failed to create and schedule note todo', err);
                      }
                    }}
                    snippetBreadCrum={null}
                  />
                </div>
              </div>
            </div>

            <div className="relative z-50 mt-auto flex-shrink-0 border-t border-black/10 dark:border-white/10 bg-[var(--color-editorBg)] rounded-b-xl">
              <div className="relative flex items-center justify-between gap-3 px-6 py-3 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={state.handleClose}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <span className="text-neutral-600 dark:text-neutral-300">Back</span>
                    <span className="flex items-center rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                      Esc
                    </span>
                  </button>
                </div>

                <div className="flex-1 flex items-center justify-center gap-2">
                  <div id={toolbarIdRef.current} className="flex items-center justify-center empty:hidden !border-none !p-0"></div>
                </div>

                <div className="w-[120px] flex justify-end">
                  {state.activeNoteId && (
                    <button
                      type="button"
                      onClick={handleCreateNew}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipPos({
                          top: rect.top + window.scrollY - 46,
                          left: rect.left + window.scrollX - 40,
                        });
                        setShowTooltip(true);
                      }}
                      onMouseLeave={() => setShowTooltip(false)}
                      className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold shadow-sm transition-all active:scale-95 border-black/10 dark:border-white/20 bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-white/90 hover:bg-neutral-200 dark:hover:bg-white/20 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                    >
                      <span>Create new</span>
                    </button>
                  )}

                  {showTooltip && ReactDOM.createPortal(
                    <div
                      style={{
                        position: 'absolute',
                        top: `${tooltipPos.top}px`,
                        left: `${tooltipPos.left}px`,
                      }}
                      className="bg-[#1c1d27] border border-[#2f3142] rounded-xl px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-[999999] flex items-center gap-3 text-[12px] font-sans text-white pointer-events-none"
                    >
                      <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Ctrl</kbd>
                        <span className="text-[10px] text-neutral-400 font-bold">+</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Shift</kbd>
                        <span className="text-[10px] text-neutral-400 font-bold">+</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Enter</kbd>
                      </div>
                      <span className="text-neutral-400 text-left whitespace-nowrap">to save and create new</span>
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </EditorContainer>

      <DeleteConfirmation
        isOpen={state.isDeleteDialogOpen}
        onClose={() => state.setIsDeleteDialogOpen(false)}
        onConfirm={state.handleDelete}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        zIndex={100005}
      />

      <UnsavedChangesDialog
        isOpen={state.isUnsavedChangesDialogOpen}
        onDiscard={() => {
          state.setIsUnsavedChangesDialogOpen(false);
          if (props.onBack) props.onBack();
        }}
        onSave={async () => {
          const saved = await state.handleSave();
          if (saved) {
            state.setIsUnsavedChangesDialogOpen(false);
            if (props.onBack) props.onBack();
          }
          return saved;
        }}
        onClose={() => state.setIsUnsavedChangesDialogOpen(false)}
      />
    </>
  );
}
