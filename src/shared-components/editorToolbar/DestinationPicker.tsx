import React, { useState, useRef, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { FaFolder, FaSearch, FaBriefcase, FaCheck } from 'react-icons/fa';
import { useDestination, DestinationGroup } from './hooks/useDestination';

interface DestinationPickerProps {
  selectedWorkspaceId?: string | null;
  selectedFolderId?: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
  onSelectFolder: (workspaceId: string, folderId: string) => void;
  onClose: () => void;
  className?: string;
}

export const DestinationPicker: React.FC<DestinationPickerProps> = ({
  selectedWorkspaceId,
  selectedFolderId,
  onSelectWorkspace,
  onSelectFolder,
  onClose,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  
  const { destinations } = useDestination();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Focus input on mount
  useEffect(() => {
    const timeout = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(timeout);
  }, []);

  // Filter based on search query
  const filteredDestinations = useMemo(() => {
    if (!query.trim()) return destinations;
    
    const lowerQuery = query.toLowerCase();
    
    return destinations.map(group => {
      const workspaceMatches = group.workspace.workspaceName?.toLowerCase().includes(lowerQuery);
      
      const matchedFolders = group.folders.filter(f => 
        f.folderName?.toLowerCase().includes(lowerQuery)
      );

      // Include group if workspace matches OR any folders match
      if (workspaceMatches || matchedFolders.length > 0) {
        return {
          ...group,
          folders: workspaceMatches ? group.folders : matchedFolders // if WS matches, show all folders? Or only matched? Usually if WS matches, we show all, but here we can just show matched to be clean, or all. Let's just show matched folders plus workspace. 
          // Actually, if WS matches, let's show all folders so they see context.
        } as DestinationGroup;
      }
      return null;
    }).filter(Boolean) as DestinationGroup[];
  }, [destinations, query]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        "w-[260px] rounded-xl shadow-xl border p-2 space-y-2",
        "border-[var(--color-borderDefault)] bg-[var(--color-containerBg)]",
        className
      )}
    >
      <div className="relative px-1">
        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={12} />
        <input
          ref={searchInputRef}
          className={clsx(
            "w-full pl-8 pr-3 py-1.5 text-[13px] font-medium rounded-lg focus:outline-none transition-all",
            "text-[var(--color-textPrimary)] bg-[var(--color-editorBg)] focus:ring-1 focus:ring-neutral-400/30 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-transparent focus:border-[var(--color-borderDefault)]" 
          )}
          placeholder="Find workspace or folder..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="max-h-[300px] overflow-y-auto custom-scrollbar px-1 pb-1">
        {filteredDestinations.length === 0 ? (
          <div className="text-xs px-2 py-6 text-center text-[var(--color-textSecondary)]">
            No destinations found.
          </div>
        ) : (
          filteredDestinations.map((group) => (
            <div key={group.workspace.id} className="mb-1.5 last:mb-0">
              
              {/* Workspace Header (Selectable) */}
              <button
                type="button"
                onClick={() => {
                  onSelectWorkspace(group.workspace.id);
                  onClose();
                }}
                className={clsx(
                  "w-full group flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left",
                  selectedWorkspaceId === group.workspace.id && !selectedFolderId
                    ? "bg-[var(--color-activeBg)] text-white"
                    : "hover:bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]"
                )}
              >
                <div className={clsx(
                  "w-5 h-5 flex items-center justify-center rounded shrink-0",
                  selectedWorkspaceId === group.workspace.id && !selectedFolderId
                    ? "bg-white/20 text-white"
                    : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                )}>
                  <FaBriefcase size={10} />
                </div>
                <span className="text-[13px] font-semibold flex-1 truncate">
                  {group.workspace.workspaceName}
                </span>
                {selectedWorkspaceId === group.workspace.id && !selectedFolderId && (
                  <FaCheck size={12} className="text-white shrink-0 ml-2" />
                )}
              </button>

              {/* Folders List (Indented) */}
              {group.folders.length > 0 && (
                <div className="mt-0.5 ml-[11px] pl-4 border-l border-[var(--color-borderDefault)] flex flex-col gap-0.5">
                  {group.folders.map(folder => {
                    const isSelected = selectedFolderId === folder.id;
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => {
                          onSelectFolder(group.workspace.id, folder.id);
                          onClose();
                        }}
                        className={clsx(
                          "w-full group relative flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left",
                          isSelected
                            ? "bg-[var(--color-activeBg)] text-white"
                            : "hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]"
                        )}
                      >
                        <FaFolder size={11} className={clsx(
                          "transition-colors shrink-0",
                          isSelected ? "text-white" : "text-neutral-400 group-hover:text-blue-500"
                        )} />
                        <span className="text-[12px] font-medium flex-1 truncate">
                          {folder.folderName}
                        </span>
                        {isSelected && (
                          <FaCheck size={12} className="text-white shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
