import type React from 'react';
import { useCallback, useEffect, useRef, useState, forwardRef } from 'react';
import { FaEllipsisV } from 'react-icons/fa';
import { useShortcutValidation } from '../hooks/useShortcutValidation';
import { UnifiedContextMenu } from '../../ui/UnifiedContextMenu';

export interface ShortcutAssignButtonProps {
  itemId?: string;
  currentShortcut?: string;
  onShortcutChange?: (shortcut: string) => void;
  disabled?: boolean;
  className?: string;
  onOverwriteShortcut?: (conflictId: string, newValue: string) => Promise<void>;
  defaultName?: string;
  isNewAgent?: boolean;
  useEllipsis?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  onClose?: () => void;
  isShortcutLoading?: boolean;
  sidebarMode?: boolean;
  openToLeft?: boolean;
}

export const ShortcutAssignButton = forwardRef<HTMLButtonElement, ShortcutAssignButtonProps>(
  ({
    itemId = '',
    currentShortcut = '',
    onShortcutChange,
    disabled = false,
    className = '',
    onOverwriteShortcut,
    defaultName = '',
    isNewAgent = false,
    useEllipsis = false,
    onKeyDown,
    onClose,
    isShortcutLoading = false,
    sidebarMode = false,
    openToLeft = false,
  }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [shortcutValue, setShortcutValue] = useState(currentShortcut);
    const [isSaving, setIsSaving] = useState(false);
    const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [conflictId, setConflictId] = useState<string | null>(null);

    const internalButtonRef = useRef<HTMLButtonElement>(null);
    const wasOpenRef = useRef(false);
    const openTimerRef = useRef<NodeJS.Timeout | null>(null);
    const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const prevDefaultNameRef = useRef(defaultName);
    const lastIntendedShortcutRef = useRef(currentShortcut);

    const { validateShortcut } = useShortcutValidation();

    // Cleanup timers on unmount
    useEffect(() => () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    }, []);

    // Compute popup position based on sidebarMode
    const computePosition = useCallback(() => {
      const rect = (ref as any)?.current?.getBoundingClientRect() ?? internalButtonRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return sidebarMode
        ? { x: openToLeft ? rect.left - 244 : rect.right + 12, y: rect.top }
        : { x: rect.left, y: rect.bottom + 4 };
    }, [ref, sidebarMode]);

    const openMenu = useCallback(() => {
      if (disabled) return;
      setShortcutValue(currentShortcut);
      setSaveError(null);
      setConflictId(null);
      setPopupPosition(computePosition());
      setIsOpen(true);
    }, [disabled, currentShortcut, computePosition]);

    const closeMenu = useCallback(() => setIsOpen(false), []);

    const handleMouseEnter = () => {
      if (disabled) return;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      openTimerRef.current = setTimeout(() => {
        openMenu();
      }, 150);
    };

    const handleMouseLeave = () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        closeMenu();
      }, 200);
    };


    // Keep lastIntendedShortcutRef in sync with external prop
    useEffect(() => { lastIntendedShortcutRef.current = currentShortcut; }, [currentShortcut]);

    // Auto-sync shortcut with title (for automations)
    useEffect(() => {
      if (isNewAgent || !onShortcutChange || defaultName === prevDefaultNameRef.current) return;
      const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const isUntitled = !defaultName.trim() || defaultName.toLowerCase().includes('untitled automation');
      const wasInSync = normalize(lastIntendedShortcutRef.current) === normalize(prevDefaultNameRef.current);
      const shouldInitialSync = !normalize(lastIntendedShortcutRef.current) && !isUntitled && normalize(defaultName).length > 2;

      if (!isUntitled && (wasInSync || shouldInitialSync)) {
        const newShortcut = defaultName.trim().replace(/[^a-zA-Z0-9 ]/g, '');
        if (normalize(newShortcut) !== normalize(lastIntendedShortcutRef.current)) {
          lastIntendedShortcutRef.current = newShortcut;
          validateShortcut(newShortcut, itemId).then(res => {
            if (!res.errorMessage) { setShortcutValue(newShortcut); onShortcutChange(newShortcut); }
          });
        }
      }
      prevDefaultNameRef.current = defaultName;
    }, [defaultName, itemId, isNewAgent, onShortcutChange, validateShortcut]);

    // Reset state on close, fire onClose callback
    useEffect(() => {
      if (!isOpen) {
        setShortcutValue(currentShortcut);
        setSaveError(null);
        setConflictId(null);
        if (wasOpenRef.current) onClose?.();
      }
      wasOpenRef.current = isOpen;
    }, [isOpen, currentShortcut, onClose]);

    // Real-time validation when popup is open (300ms debounce)
    useEffect(() => {
      if (!isOpen) return;
      const timer = setTimeout(async () => {
        let error: string | null = null;
        let conflict: string | null = null;
        
        if (shortcutValue && shortcutValue !== currentShortcut) {
          const res = await validateShortcut(shortcutValue, itemId);
          if (res.errorMessage) { error = res.errorMessage; conflict = res.conflictId; }
        }
        
        setSaveError(error);
        setConflictId(conflict);
      }, 300);
      return () => clearTimeout(timer);
    }, [isOpen, shortcutValue, itemId, currentShortcut, validateShortcut]);

    const handleSaveShortcut = useCallback(() => {
      if (saveError) return;
      onShortcutChange?.(shortcutValue.trim().replace(/^\//, ''));
      closeMenu();
    }, [shortcutValue, onShortcutChange, saveError, closeMenu]);

    const handleClearShortcut = useCallback(() => {
      setShortcutValue('');
      onShortcutChange?.('');
      closeMenu();
    }, [onShortcutChange, closeMenu]);

    const handleOverwriteShortcut = useCallback(async (cId: string) => {
      if (!onOverwriteShortcut) return;
      setIsSaving(true);
      try { await onOverwriteShortcut(cId, shortcutValue.trim().replace(/^\//, '')); closeMenu(); }
      catch (e) { console.error('Failed to overwrite shortcut:', e); }
      finally { setIsSaving(false); }
    }, [onOverwriteShortcut, shortcutValue, closeMenu]);

    // Shared popup props
    const popupProps = {
      shortcutInput: {
        value: shortcutValue,
        onChange: setShortcutValue,
        onSave: handleSaveShortcut,
        onCancel: closeMenu,
        isSaving,
        isUpdating: !!currentShortcut,
        onClear: handleClearShortcut,
        onOverwrite: conflictId ? handleOverwriteShortcut : undefined,
        showSuccess: null,
      },
      error: saveError ?? undefined,
      conflictId: conflictId ?? undefined,
    };

    const isLoading = isShortcutLoading;

    // Button inner content
    const buttonContent = sidebarMode ? (
      <div className="flex items-center justify-center relative">
        {isLoading
          ? <div className="w-3.5 h-3.5 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          : <span className="font-mono text-xl font-bold">/</span>}
      </div>
    ) : useEllipsis ? (
      <FaEllipsisV size={11} />
    ) : currentShortcut ? (
      <div className="flex items-center divide-x border-[var(--color-borderDefault)] relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[var(--color-panelBg)]/50 flex items-center justify-center rounded-lg z-10">
            <div className="w-3 h-3 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          </div>
        )}
        <div className="flex items-center divide-x border-[var(--color-borderDefault)]">
          <span className="text-[10px] font-mono font-bold px-1.5 whitespace-nowrap text-[var(--color-accent)]">/{currentShortcut}</span>
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-center relative min-w-[20px] px-1.5">
        {isLoading
          ? <div className="w-3.5 h-3.5 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          : <span className="text-[10px] font-mono font-bold whitespace-nowrap text-[var(--color-textSecondary)] hover:text-[var(--color-accent)] transition-colors">/ cmd</span>}
      </div>
    );

    const buttonClassName = sidebarMode ? className : `flex items-center justify-center transition-all ${
      useEllipsis
        ? 'p-1 bg-transparent border-none text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]'
        : currentShortcut
          ? 'p-1.5 rounded-lg border bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]'
          : 'p-1.5 rounded-lg border bg-[var(--color-containerBg)] border-[var(--color-borderDefault)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : !useEllipsis ? 'hover:border-[var(--color-accent)] cursor-pointer' : 'cursor-pointer'} ${className}`;

    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative flex items-center justify-center"
      >
        <button
          ref={ref || internalButtonRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); openMenu(); }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          title={sidebarMode ? '' : currentShortcut ? `Shortcut: /${currentShortcut}` : 'Assign a Text Command'}
          className={buttonClassName}
        >
          {buttonContent}
        </button>

        {isOpen && popupPosition && (
          <UnifiedContextMenu
            x={popupPosition.x}
            y={popupPosition.y}
            onClose={closeMenu}
            {...popupProps}
          />
        )}
      </div>
    );
  },
);

ShortcutAssignButton.displayName = 'ShortcutAssignButton';
