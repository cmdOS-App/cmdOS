import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { getAvatarColor, getSingleInitial } from '../../../../shared-components/utils/avatarColors';
import { createWorkspace } from '../workspaceData';
import { useUIStore } from '../../../../shared-components/uiStateManager';

interface CreateWorkspacePanelProps {
  onClose?: () => void;
  onSuccess?: (workspaceId: string, workspaceName: string) => void;
}

const CreateWorkspacePanel: React.FC<CreateWorkspacePanelProps> = ({ onClose, onSuccess }) => {
  const [workspaceName, setWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        handleCreate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      if (onClose) {
        onClose();
        return true;
      }
      return false;
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unregister();
    };
  }, [onClose, workspaceName]);

  const handleCreate = async () => {
    if (!workspaceName.trim()) {
      setError('Please enter a workspace name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const data = await createWorkspace(workspaceName.trim());
      if (onSuccess) {
        onSuccess(data.id, data.workspaceName);
      }
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Failed to create workspace:', err);
      setError(err?.message || 'Failed to create workspace');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      style={{ backgroundColor: 'var(--color-editorBg)' }}
      className="relative flex h-full w-full flex-col overflow-hidden outline-none backdrop-blur-md rounded-xl border border-[var(--color-borderDefault)] shadow-2xl text-[var(--color-textPrimary)] select-none"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1 rounded-md text-[var(--color-textSecondary)] hover:text-[var(--color-textError)] hover:bg-red-500/10 transition-colors z-20"
      >
        <FaTimes size={16} />
      </button>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar w-full">
          <div className="flex items-center gap-3 mb-6">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${getAvatarColor(workspaceName || 'W')} text-base font-bold text-white shadow-md transition-colors duration-300`}
            >
              {getSingleInitial(workspaceName || 'W')}
            </div>
            <h2 className="text-lg font-bold text-[var(--color-textPrimary)]">Workspace Details</h2>
          </div>

          <div className="mb-4 w-full">
            <label className="block text-[10px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase mb-2">Workspace Name</label>
            <input
              type="text"
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              placeholder="Enter workspace name"
              className="w-full text-sm font-medium text-[var(--color-textPrimary)] bg-[var(--color-inputBg)]/60 border border-[var(--color-borderDefault)] rounded-lg px-4 py-2.5 outline-none focus:border-[var(--color-borderActive)] placeholder:text-[var(--color-textMuted)] transition-colors duration-150"
              autoFocus
            />
          </div>

          {error && <p className="text-xs text-[var(--color-textError)] mt-2 font-semibold">{error}</p>}
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3 px-6 py-4 
                border-t border-[var(--color-borderDefault)]
                bg-black/10 
                text-xs text-[var(--color-textSecondary)] flex-shrink-0"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-1.5 cursor-pointer hover:text-[var(--color-textPrimary)] transition-colors"
            onClick={onClose}
          >
            <span className="px-1.5 py-0.5 rounded bg-[var(--color-selectedBg)] border border-[var(--color-borderDefault)] text-[9px] font-bold">Esc</span>
            <span className="text-[var(--color-textSecondary)] font-medium">Back</span>
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={isCreating || !workspaceName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accentHover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md border-none cursor-pointer"
        >
          {isCreating ? 'Creating...' : 'Create'}
          <span className="px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-bold">Alt+Enter</span>
        </button>
      </div>
    </div>
  );
};

export default CreateWorkspacePanel;
