/**
 * @file autoSave.tsx
 * @description Provides the AutoSaveIndicator component, which renders a visual status
 * representation (idle, saving, saved/success, error, or conflict) of the auto-save progress.
 * It shows dynamic relative time updates based on when the document/object was last saved.
 */

import React from 'react';
import { FaCheckCircle, FaTimes } from 'react-icons/fa';
import { FiLoader } from 'react-icons/fi';
import { useRelativeSavedTime } from '../utils';

export interface AutoSaveIndicatorProps {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'success';
  lastSavedAt: Date | null | undefined;
  saveError?: string | null;
  className?: string;
  isDirty?: boolean;
  activeId?: string | null;
}

export function AutoSaveIndicator({
  saveStatus,
  lastSavedAt,
  saveError,
  className = '',
  isDirty = false,
  activeId,
}: AutoSaveIndicatorProps) {
  const lastSavedMessage = useRelativeSavedTime(lastSavedAt);

  // If there's an error, prioritize showing it
  if (saveStatus === 'error') {
    return (
      <span className={`text-sm font-medium text-red-500 dark:text-red-400 flex items-center gap-1 whitespace-nowrap ${className}`}>
        {saveError || 'Save Failed'} <FaTimes className="opacity-70 text-xs" />
      </span>
    );
  }

  if (saveStatus === 'conflict') {
    return (
      <span className={`text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 whitespace-nowrap ${className}`}>
        Conflict <FaTimes className="opacity-70 text-xs" />
      </span>
    );
  }

  // Handle saving and dirty status
  if (saveStatus === 'saving' || isDirty) {
    return (
      <span className={`text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap ${className}`}>
        <FiLoader className="animate-spin text-xs opacity-70" /> Saving...
      </span>
    );
  }

  // Handle saved status
  if (saveStatus === 'saved' || saveStatus === 'success') {
    return (
      <span className={`text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap ${className}`}>
        {lastSavedMessage} <FaCheckCircle className="opacity-70 text-xs text-emerald-500" />
      </span>
    );
  }

  return null;
}
