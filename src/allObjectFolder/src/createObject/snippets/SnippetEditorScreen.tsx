import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { FaFolder, FaTimes, FaCheckCircle } from 'react-icons/fa';
import { FiStar, FiTag, FiChevronLeft, FiChevronRight, FiLoader } from 'react-icons/fi';
import type { SnippetRecord } from './snippetTypes';
import type { WorkspaceData } from '../../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../../../settings/allWorkspaceManager/folders/folderTypes';
import type { NewSnippetBreadCrum, Tag } from '../../../../pages/popup/types/popupType';
import type { TagRecord } from '../tags/tagTypes';

interface Folder {
  folder_id: string;
  folder_name: string;
  snippets: SnippetRecord[];
  automations: any[];
  folders: Folder[];
}

interface Workspace {
  workspace_id: string;
  workspace_name: string;
  folders: Folder[];
  workspace_snippets: SnippetRecord[];
  workspace_automations: any[];
}

type FooterStatus = { type: 'idle' | 'saving' | 'saved' | 'error'; message: string };

import { useUIStore } from '../../../../shared-components/uiStateManager';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { useSnippetEditor } from './useSnippetEditor';
import useNotification from '../../../../shared-components/notifications/useNotification';
import { useRelativeSavedTime } from '../../../../shared-components/utils';

/**
 * Helper to convert an AST JSON string into readable plain text.
 */
function astToPlainText(astString: string): string {
  try {
    const ast = JSON.parse(astString);
    let result = '';
    const traverse = (nodes: any[]) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node.type === 'text') {
          result += node.value || node.text || '';
        } else if (node.type === 'field' || node.type === 'dropdown' || node.type === 'toggle') {
          const config = node.config || {};
          const alias = config.label || node.alias || node.id || 'Field';
          result += `{{${alias}}}`;
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    };
    traverse(ast);
    return result;
  } catch (e) {
    return astString;
  }
}

import DeleteConfirmation from '../../../../shared-components/modals/deleteDialog';
import UnsavedChangesDialog from '../../../../shared-components/modals/unsavedChangesDialog';

import { SnippetBuilderMainViewProvider, SnippetBuilderMainViewEditor, SnippetBuilderMainViewSnippetFormattingToolbar } from './AdvancedSnippetEditor/SnippetBuilderMainView';
import VariableDropdown from '../../../../shared-components/inputs/VariableDropdown';
/**
 * Fallback tags to display if the organization has no tags.
 */
const generalTags: Tag[] = [
  { tag_id: '', name: 'Important' },
  { tag_id: '', name: 'Work' },
  { tag_id: '', name: 'Urgent' },
  { tag_id: '', name: 'Personal' },
];

interface EditSnippetScreenProps {
  selectedSnippet: SnippetRecord | null;
  isCreatingNew: boolean;
  snippetBreadCrum: NewSnippetBreadCrum | null;
  snippets?: SnippetRecord[];
  showFolderStructure?: boolean;
  reload: () => void;
  favoritesMapping: { [teamId: string]: SnippetRecord[] };
  setFavoritesMapping: (data: { [teamId: string]: SnippetRecord[] }) => void;
  onBack?: () => void;
  initialDraftKey?: string;
  initialDraftContent?: string;
  isFullScreenMode?: boolean; // True when rendered in FullScreenNoteView
  category?: string; // 'note' or 'snippet'
}

const EditSnippetScreenComponent: React.FC<EditSnippetScreenProps> = ({
  snippetBreadCrum,
  selectedSnippet,
  isCreatingNew,
  reload,
  favoritesMapping,
  setFavoritesMapping,
  onBack,
  initialDraftKey = '',
  initialDraftContent = '',
  isFullScreenMode = false,
  category,
}) => {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const snippets = useDbStore(state => state.snippets);
  const workspaces = useDbStore(state => state.workspaces);

  const triggerNotification = useNotification();
  const {
    snippetTitle,
    snippetConfig,
    activeSnippetId,
    workspaceId,
    folderId,
    tagIds,
    saveStatus,
    lastSavedAt,
    isDirty,
    setSnippetTitle,
    setSnippetConfig,
    handleSave,
    handleDelete,
    handleClose,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isUnsavedChangesDialogOpen,
    setIsUnsavedChangesDialogOpen,
    handlePropertiesChange,
  } = useSnippetEditor({
    snippetId: selectedSnippet?.id || (selectedSnippet as any)?.snippet_id,
    onBack,
    initialDraftKey,
    initialDraftConfig: initialDraftContent,
  });

  const lastSavedMessage = useRelativeSavedTime(lastSavedAt);

  const [showToolbar, setShowToolbar] = useState(true);
  const isUserKeyManuallySetRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null); // Quill instance ref
  const quillToolbarRef = useRef<HTMLElement | null>(null);

  const isFocusMode = useUIStore((s: any) => s.isFocusMode);
  const isLinkEditModalOpen = useUIStore((s: any) => s.activeEditor?.type === 'link');

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(category !== 'snippet');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarBtnRef = useRef<HTMLButtonElement>(null);
  const fullscreenBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [footerStatus, setFooterStatus] = useState<FooterStatus>({ type: 'idle', message: '' });
  const [searchtags, setSearchtags] = useState('');
  const rawSearchTagsRef = useRef<Record<string, string[]>>({});

  const isDuplicateTitle = useMemo(() => {
    const trimmedTitle = snippetTitle.trim().toLowerCase();
    if (!trimmedTitle) return false;
    return snippets.some(s => {
      const snippetId = s.id;
      if (snippetId === activeSnippetId) return false;
      return String(s.title || '').trim().toLowerCase() === trimmedTitle;
    });
  }, [snippetTitle, snippets, activeSnippetId]);

  const showFooterStatus = (type: FooterStatus['type'], message: string) => {
    setFooterStatus({ type, message });
    if (type !== 'idle' && type !== 'saving') {
      setTimeout(() => {
        setFooterStatus({ type: 'idle', message: '' });
      }, 3000);
    }
  };

  useEffect(() => {
    if (isCreatingNew) {
      // If we have an initial draft key (from expand to full-screen),
      // treat it as manually set to prevent auto-generation
      isUserKeyManuallySetRef.current = !!initialDraftKey;
    }
  }, [isCreatingNew, initialDraftKey]);

  // Formatting state
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
  });

  const handleFormatToggle = (format: keyof typeof formatState) => {
    const newState = { ...formatState, [format]: !formatState[format] };
    setFormatState(newState);
  };



  // Track if we've already focused for the current note
  const hasFocusedRef = useRef<string | null>(null);

  // Focus the editor (description area) only once when a note is first opened
  useEffect(() => {
    // Create a unique key for the current note
    const noteKey = selectedSnippet?.id || (isCreatingNew ? 'new-note' : null);

    // Only focus if this is a different note than the last one we focused
    if (noteKey && hasFocusedRef.current !== noteKey) {
      hasFocusedRef.current = noteKey;

      // Wait a bit for the editor to be ready and content to be loaded
      const focusTimeout = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      }, 100); // Short timeout to ensure render

      return () => clearTimeout(focusTimeout);
    }

    // Reset the focus ref when note is closed
    if (!noteKey) {
      hasFocusedRef.current = null;
    }

    return undefined;
  }, [selectedSnippet?.id, isCreatingNew, selectedSnippet, snippetConfig]);

  // Control Quill toolbar visibility
  useEffect(() => {
    const updateToolbarVisibility = () => {
      // Find the Quill toolbar within the container
      const toolbar = containerRef.current?.querySelector('.ql-toolbar') as HTMLElement | null;
      if (toolbar) {
        quillToolbarRef.current = toolbar;
        const variableButton = toolbar.querySelector('.ql-variable') as HTMLElement | null;
        const variableFormatGroup = variableButton?.closest('.ql-formats') as HTMLElement | null;

        if (!isToolbarVisible) {
          // Hide all formatting buttons but keep variable button visible
          const allButtons = toolbar.querySelectorAll('button');
          allButtons.forEach(btn => {
            if (!btn.classList.contains('ql-variable')) {
              (btn as HTMLElement).style.display = 'none';
            }
          });
          // Hide format groups that don't contain variable button
          const formatGroups = toolbar.querySelectorAll('.ql-formats');
          formatGroups.forEach(group => {
            if (group !== variableFormatGroup) {
              (group as HTMLElement).style.display = 'none';
            } else {
              // Ensure variable button's format group is visible
              (group as HTMLElement).style.display = '';
            }
          });
          // Ensure variable button is visible
          if (variableButton) {
            variableButton.style.display = 'flex';
          }
        } else {
          // Show all toolbar buttons and groups
          const allButtons = toolbar.querySelectorAll('button');
          allButtons.forEach(btn => {
            (btn as HTMLElement).style.display = '';
          });
          const formatGroups = toolbar.querySelectorAll('.ql-formats');
          formatGroups.forEach(group => {
            (group as HTMLElement).style.display = '';
          });
        }
      }
    };

    // Initial setup and watch for changes
    const timeout = setTimeout(updateToolbarVisibility, 100);
    // Use MutationObserver to watch for toolbar changes
    const observer = new MutationObserver(updateToolbarVisibility);
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [isToolbarVisible, selectedSnippet?.id, isCreatingNew]);





  const closeEditor = useCallback(() => {
    
    // Reset Focus Mode when leaving
    useUIStore.getState().toggleFocusMode(false);
    useUIStore.getState().setSelectedWorkspaceId(null);
    useUIStore.getState().setSelectedFolderId(null);
    useUIStore.getState().setSnippetBreadcrumb(null);
    useUIStore.getState().setSelectedSnippetId(null);

    if (onBack) {
      onBack();
    } else {
      useUIStore.getState().closeEditor();
    }
  }, [onBack]);

  const handleEscapeSaveAndClose = useCallback(() => {
    if (isDirty) {
      setIsUnsavedChangesDialogOpen(true);
      return true; // Indicate we intercepted the escape
    } else {
      // Don't closeEditor here, uiStateManager will do it if we return false
      return false; 
    }
  }, [isDirty, setIsUnsavedChangesDialogOpen]);

  // Register escape handler with uiStateManager
  useEffect(() => {
    const handler = () => {
      if (isFocusMode) {
        useUIStore.getState().toggleFocusMode(false);
        return true;
      }
      if (isUnsavedChangesDialogOpen || isLocationPickerOpen || isDeleteDialogOpen || isShareDialogOpen || isLinkEditModalOpen || document.getElementById('hotkey-assignment-popup')) {
        return true;
      }
      const handled = handleEscapeSaveAndClose();
      return handled;
    };
    useUIStore.getState().setEditorEscapeHandler(handler);
    return () => useUIStore.getState().setEditorEscapeHandler(null);
  }, [isFocusMode, isUnsavedChangesDialogOpen, isLocationPickerOpen, isDeleteDialogOpen, isShareDialogOpen, isLinkEditModalOpen, handleEscapeSaveAndClose]);

  const handleGoHome = useCallback(() => {
    closeEditor();
  }, [closeEditor]);



  // Shortcut listeners (Save + Escape)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {

      // Ctrl+Enter (Win) or Cmd+Enter (Mac) for Save
      const isSaveShortcut = (isMac ? event.metaKey : event.ctrlKey) && event.key === 'Enter';

      if (isSaveShortcut) {
        event.preventDefault();
        if (saveStatus === 'saving') return;

        handleSave(false);
      }

      // Alt+Enter to toggle Location Picker
      const isLocationPickerShortcut = event.altKey && event.key === 'Enter';
      

      if (isLocationPickerShortcut) {
        
        event.preventDefault();
        if (workspaces.length === 0) {
          triggerNotification('Create a workspace or folder before saving.', 'info');
          return;
        }
        
        setIsLocationPickerOpen(prev => !prev);
      }
    };

    // Use Capture phase (true) to ensure we catch Esc before the editor swallows it
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isLocationPickerOpen,
    isDeleteDialogOpen,
    isShareDialogOpen,
    saveStatus,
    snippetBreadCrum,
    workspaces,
    triggerNotification,
    isFocusMode,
    isMac,
    closeEditor,
    isUnsavedChangesDialogOpen,
    handleEscapeSaveAndClose,
    isLinkEditModalOpen,
  ]);

  // Browser-level warning for unsaved changes (e.g., closing tab/window)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Add state for folder structure dialog
  const [showFolderStructureDialog, setShowFolderStructureDialog] = useState(false);

  // Handle workspace and folder selection
  const handleWorkspaceSelect = (workspaceId: string, workspaceName: string) => {
    const workspaceObj = workspaces.find(ws => ws.id === workspaceId);
    if (!workspaceObj) return;

    // Create new bread crumb with the selected workspace
    const newBreadCrum = {
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      folder_id: null,
      folder_name: null,
    };

    // Update local UI state - Clear folder selection when selecting workspace
    useUIStore.getState().setSelectedWorkspaceId(workspaceObj.id);
    useUIStore.getState().setSelectedFolderId(null);
    useUIStore.getState().setSnippetBreadcrumb(newBreadCrum);

    // Logic to preserve content if editing existing note or active draft
    if (activeSnippetId) {
      // Existing note: Only location updated above. Content logic preserved.
    } else {
      // New Note / Draft
      const hasContent = snippetTitle.trim().length > 0 || (typeof snippetConfig === 'string' ? snippetConfig.trim().length > 0 : JSON.stringify(snippetConfig).trim().length > 0 && JSON.stringify(snippetConfig) !== '{}');

      if (!hasContent) {
        setSnippetTitle('');
        setSnippetConfig('');
      }

      useUIStore.getState().setSelectedSnippetId(null);
      /* setIsCreatingNewItem removed */;
    }

    // Close the dialog
    setShowFolderStructureDialog(false);
  };

  const handleFolderSelect = (
    workspaceId: string,
    workspaceName: string,
    folderId: string,
    folderName: string,
    folderPathNames?: string[],
  ) => {
    const workspaceObj = workspaces.find(ws => ws.id === workspaceId);
    if (!workspaceObj) return;

    // Create new bread crumb with the selected workspace, folder, and folder path
    const newBreadCrum: any = {
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      folder_id: folderId,
      folder_name: folderName,
    };

    // Add folder path names if provided (for full hierarchy display)
    if (folderPathNames && folderPathNames.length > 0) {
      newBreadCrum.folder_path_names = folderPathNames;
    }

    // Update Redux state - IMPORTANT: Set both workspace AND folder
    useUIStore.getState().setSelectedWorkspaceId(workspaceObj.id);
    // Note: selectedFolder might not be found for nested folders, that's OK
    useUIStore.getState().setSnippetBreadcrumb(newBreadCrum);

    // Logic to preserve content if editing existing note or active draft
    if (activeSnippetId) {
      // Existing note: Only location updated above. Content logic preserved.
    } else {
      // New Note / Draft
      const hasContent = snippetTitle.trim().length > 0 || (typeof snippetConfig === 'string' ? snippetConfig.trim().length > 0 : JSON.stringify(snippetConfig).trim().length > 0 && JSON.stringify(snippetConfig) !== '{}');

      if (!hasContent) {
        setSnippetTitle('');
        setSnippetConfig('');
      }

      useUIStore.getState().setSelectedSnippetId(null);
      /* setIsCreatingNewItem removed */;
    }

    // Close the dialog
    setShowFolderStructureDialog(false);
  };

  // Destination helpers
  const handleWorkspaceDestination = (workspace: Workspace, isPersonal?: boolean) => {
    handleWorkspaceSelect(workspace.workspace_id, workspace.workspace_name);

    // Save as last used destination
    chrome.storage.local.set({
      lastNoteDestination: {
        workspace_id: workspace.workspace_id,
        folder_id: null,
      },
    });

    setIsLocationPickerOpen(false); // Close the location picker
  };

  const handleFolderDestination = (
    workspace: Workspace,
    folder: Folder,
    isPersonal?: boolean,
    folderPath?: Folder[],
  ) => {
    // Extract folder names from path for display
    const folderPathNames = folderPath?.map(f => f.folder_name) || [folder.folder_name];
    handleFolderSelect(
      workspace.workspace_id,
      workspace.workspace_name,
      folder.folder_id,
      folder.folder_name,
      folderPathNames,
    );

    // Save as last used destination
    chrome.storage.local.set({
      lastNoteDestination: {
        workspace_id: workspace.workspace_id,
        folder_id: folder.folder_id,
      },
    });

    setIsLocationPickerOpen(false); // Close the location picker
  };

  // Determine placeholder based on category
  const titlePlaceholder = 'Enter the title for Snippet';

  const editorContentNode = (
    <div
      className={`w-full h-full flex flex-col gap-1 text-left text-neutral-900 dark:text-white bg-transparent ${isFullScreenMode ? '' : 'px-6 md:px-12 lg:px-24 py-6 md:py-10'}`}>
      <div
        className={`flex-1 flex flex-col relative ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-hidden'} ${isFullScreenMode ? 'w-full rounded-none' : 'w-full max-w-[1300px] mx-auto rounded-xl'} bg-[var(--color-editorBg)] ${isFocusMode || isFullScreenMode ? 'border-none' : 'border border-black/5 dark:border-white/10'}`}>
        <div
          className={`flex-1 min-h-0 flex ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-hidden'} flex-col gap-3 bg-transparent text-neutral-900 dark:text-white`}>

          {/* Main Area */}
          <div className="flex-1 flex min-h-0 relative">

            {/* Wrapper for Title + Content */}
            <div
              className={`flex-1 flex flex-col min-h-0 relative`}>

              {/* Absolute Close Button */}
              <div className="absolute top-4 right-4 md:top-5 md:right-5 z-50 flex items-center gap-3">
                {isDuplicateTitle && (
                  <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                    Duplicate title exists
                  </span>
                )}
                {/* Auto-save indicator */}
                <div className="transition-opacity duration-300">
                  {isDirty && (
                    <>
                      {saveStatus === 'saving' && (
                        <span className="text-[10px] font-medium text-neutral-400 flex items-center gap-1 whitespace-nowrap">
                          <FiLoader className="animate-spin" /> Saving...
                        </span>
                      )}
                      {saveStatus !== 'saving' && (
                        <span className="text-[10px] font-medium text-neutral-400 flex items-center gap-1 whitespace-nowrap opacity-70">
                          Saving...
                        </span>
                      )}
                    </>
                  )}
                  {!isDirty && activeSnippetId && (
                    <span className="text-[10px] font-medium text-emerald-500 flex items-center gap-1 whitespace-nowrap">
                      <FaCheckCircle className="opacity-90 text-[9px]" /> {lastSavedMessage}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => isDirty ? setIsUnsavedChangesDialogOpen(true) : closeEditor()}
                  className="p-2 opacity-50 hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-all focus:outline-none focus:ring-1 focus:ring-red-400"
                  title="Close">
                  <FaTimes size={16} />
                </button>
              </div>

              <div className="w-full flex-1 flex flex-col min-h-0 px-6 md:px-12 py-6">
                {/* Title Input Row */}
                <div
                  className={`flex items-center gap-2 flex-shrink-0 relative z-10 ${isFullScreenMode ? 'py-8 pr-6' : 'py-4'}`}>
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <input
                      ref={titleInputRef}
                      value={snippetTitle}
                      onChange={e => {
                        setSnippetTitle(e.target.value);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          editorRef.current?.focus();
                        }
                      }}
                      type="text"
                      placeholder="Title"
                      className={`w-full text-[28px] font-semibold text-black dark:text-white placeholder-[var(--color-textPlaceholder)]/70 bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 ${isFullScreenMode ? 'pl-8' : ''}`}
                    />
                  </div>

                  <div className="flex-1" />
                </div>

                {/* Editor Area */}
                <div
                  className={`flex-1 min-h-0 font-sans overflow-hidden flex flex-col text-neutral-900 dark:text-white ${isFullScreenMode ? 'pl-8 pr-6 pt-1' : 'pb-3'}`}>
                  <div
                    className="flex-1 min-h-0 overflow-hidden relative"
                    ref={containerRef}
                    onBlurCapture={() => {
                      if (isDirty) {
                        void handleSave();
                      }
                    }}
                  >
                    <SnippetBuilderMainViewEditor />
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Divider Line with Floating Collapse Toggle Button Centered */}
            <div className="relative flex-shrink-0 w-px bg-black/10 dark:bg-white/10">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(prev => !prev)}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-40 w-8 h-8 rounded-full bg-[var(--color-containerBg)] border border-black/10 dark:border-white/15 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all shadow-sm focus:outline-none"
                style={{ left: '50%' }}
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
              </button>
            </div>

            {/* RIGHT COLUMN - Snippet Options */}
            <div
              className={`flex-shrink-0 flex flex-col bg-[var(--color-editorBg)] overflow-y-auto custom-scrollbar ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-[340px] border-l border-black/10 dark:border-white/20'}`}
              style={{
                width: isSidebarCollapsed ? '0px' : '340px',
                minWidth: isSidebarCollapsed ? '0px' : '340px',
              }}
            >
              {/* Sidebar Content - hidden when collapsed */}
              {!isSidebarCollapsed && (
                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col gap-3">
                  {category === 'snippet' ? (
                    <SnippetBuilderMainViewSnippetFormattingToolbar 
                      activeSnippetId={activeSnippetId}
                      snippet={selectedSnippet}
                      workspaceId={workspaceId}
                      folderId={folderId}
                      snippetTitle={snippetTitle}
                    />
                  ) : null}
                 
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-50 mt-auto flex-shrink-0 border-t border-black/10 dark:border-white/10 bg-[var(--color-editorBg)] rounded-b-xl">
          <div className="relative flex items-center justify-between gap-3 px-6 py-3 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
            {/* Left: Back Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onBack) onBack();
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <span className="text-neutral-600 dark:text-neutral-300">Back</span>
                <span className="flex items-center rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                  Esc
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmation
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => {
          void handleDelete();
          setIsDeleteDialogOpen(false);
        }}
        title={snippetTitle ? `Delete "${snippetTitle}"?` : 'Delete this snippet?'}
        description="Are you sure you want to delete this snippet? This action cannot be undone."
        zIndex={isFullScreenMode ? 200000 : 50}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={isUnsavedChangesDialogOpen}
        onClose={() => setIsUnsavedChangesDialogOpen(false)}
        onSave={async () => {
          const saved = await handleSave(false);
          if (saved) {
            setIsUnsavedChangesDialogOpen(false);
            closeEditor();
          }
          return saved;
        }}
        onDiscard={() => {
          setIsUnsavedChangesDialogOpen(false);
          closeEditor();
        }}
        zIndex={isFullScreenMode ? 200000 : 9999}
      />
    </div>
  );

  return (
    <SnippetBuilderMainViewProvider key={selectedSnippet?.id || 'new'} initialContent={snippetConfig as any} onChange={(content: any) => {
      setSnippetConfig(content);
    }}>
      {editorContentNode}
    </SnippetBuilderMainViewProvider>
  );
};

export const EditSnippetScreen = React.memo(EditSnippetScreenComponent);
export default EditSnippetScreen;
