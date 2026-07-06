import React, { useState, useRef, useEffect } from 'react';
import { FaStar, FaFolder } from 'react-icons/fa';
import { FiStar, FiTag } from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { useFavorites } from '../favorites';

import { HotkeyAssignButton, saveHotkey, clearHotkey } from '../hotkeys';
import { ShortcutAssignButton, saveShortcut, clearShortcut } from '../shortcuts';
import { DestinationPicker } from './DestinationPicker';
import InlineTimeInput from '../inputs/InlineTimeInput';
import CustomTimePicker from '../inputs/CustomTimePicker';
import { getItemCompoundId, readAllHotkeys, readAllShortcuts, extractSnippetIdFromCompoundId } from '../hotkeys/utils/hotkeyUtils';
import type { TagRecord } from '../../allObjectFolder/src/createObject/tags';
import type { WorkspaceData } from '../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../settings/allWorkspaceManager/folders/folderTypes';
import { useTags, createTag } from '../../allObjectFolder/src/createObject/tags';
import { useDbStore } from '../../storage/store/useDbStore';

import type { SharedPropertiesToolbarProps, SharedProperties } from './types';

export const SharedPropertiesToolbar = React.forwardRef<HTMLDivElement, SharedPropertiesToolbarProps>((props, ref) => {
  const {
    initialSnippet,
    compoundId,
    defaultName,
    onChange,
    showTodo = true,
    todoStatus,
    onCreateTodo,
    snippetBreadCrum,
    saveStatus,
    orgTeam,
    personalWorkspaces,
    orgTags = [],
    setOrgTags,
    openPopupsToLeft = false,
  } = props;

  const { isFavorite, toggleFavorite } = useFavorites();

  // --- Internally Managed State for Shared Properties ---
  const [isFav, setIsFav] = useState<boolean>(false);
  const [pendingHotkey, setPendingHotkey] = useState<string>('');
  const [pendingShortcut, setPendingShortcut] = useState<string>('');
  
  const [selectedTags, setSelectedTags] = useState<TagRecord[]>([]);
  const [availableTags, setAvailableTags] = useState<TagRecord[]>([]);

  const [reminderDate, setReminderDate] = useState<string>('');
  const [reminderTime, setReminderTime] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringCycle, setRecurringCycle] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);

  const dbTags = useTags(workspaceId || undefined) || [];
  
  const hotkeysMap = useDbStore(state => state.hotkeysMap);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);

  // Sync isFav with IndexedDB
  useEffect(() => {
    if (compoundId && compoundId !== 'new') {
      setIsFav(isFavorite(compoundId));
    }
  }, [compoundId, isFavorite]);

  const prevCompoundIdRef = useRef<string>(compoundId);
  const lastProcessedTagIdsStrRef = useRef<string>('');

  // Fetch Hotkey and Shortcut on mount or when compoundId changes
  useEffect(() => {
    if (!compoundId || compoundId === 'new') {
      prevCompoundIdRef.current = compoundId;
      return;
    }

    const wasUnsaved = !prevCompoundIdRef.current || prevCompoundIdRef.current === 'new';
    prevCompoundIdRef.current = compoundId;

    let isMounted = true;

    if (wasUnsaved) {
      // The item was just saved and received a valid compoundId!
      // If there are pending hotkey/shortcut entered by the user, save them now.
      const savePendingKeys = async () => {
        const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
        let itemType: any = 'note';
        if (initialSnippet?.urls || initialSnippet?.category === 'link') itemType = 'link';
        else if (initialSnippet?.category === 'snippet') itemType = 'snippet';
        else if (initialSnippet?.category === 'automation') itemType = 'automation';

        if (pendingHotkey && isMounted) {
          try {
            await saveHotkey(snippetId || compoundId, compoundId, pendingHotkey, itemType);
          } catch (err) {
            console.error('Failed to save pending hotkey on creation:', err);
          }
        }
        if (pendingShortcut && isMounted) {
          try {
            const itemName = initialSnippet?.title || initialSnippet?.name || defaultName || 'Untitled';
            await saveShortcut(snippetId || compoundId, compoundId, pendingShortcut, itemName, itemType);
          } catch (err) {
            console.error('Failed to save pending shortcut on creation:', err);
          }
        }
      };
      void savePendingKeys();
    } else {
      // Use reactive hotkeys from useDbStore
      const snippetIdPart = extractSnippetIdFromCompoundId(compoundId);
      const hotkey = hotkeysMap[compoundId] || (snippetIdPart !== compoundId ? hotkeysMap[snippetIdPart] : '') || '';
      const shortcut = shortcutsMap[compoundId] || (snippetIdPart !== compoundId ? shortcutsMap[snippetIdPart] : '') || '';
      setPendingHotkey(hotkey);
      setPendingShortcut(shortcut);
    }
    return () => {
      isMounted = false;
    };
  }, [compoundId, initialSnippet, defaultName, hotkeysMap, shortcutsMap]);

  // Initialize state from existing object
  useEffect(() => {
    if (initialSnippet) {
      const incomingTagIds = initialSnippet.tagIds || (initialSnippet.tags ? initialSnippet.tags.map((t: any) => t.id) : []);
      const incomingTagIdsStr = [...incomingTagIds].sort().join(',');

      const resolvedTags = incomingTagIds.map((id: string) => {
        const found = dbTags.find(t => t.id === id);
        return found ? { id: found.id, name: found.name } : { id: id, name: '...' };
      });
      
      const hasMissingNames = selectedTags.some((t: any) => t.name === '...');
      const canResolveNow = resolvedTags.some((rt: any) => {
        const st = selectedTags.find((s: any) => s.id === rt.id);
        return st?.name === '...' && rt.name !== '...';
      });
      
      if (incomingTagIdsStr !== lastProcessedTagIdsStrRef.current || (hasMissingNames && canResolveNow)) {
        lastProcessedTagIdsStrRef.current = incomingTagIdsStr;
        setSelectedTags(resolvedTags);
      }
      
      if (initialSnippet.event_deadline) {
        try {
          const dt = new Date(initialSnippet.event_deadline);
          const newDate = dt.toISOString().split('T')[0];
          const newTime = dt.toTimeString().substring(0, 5);
          if (reminderDate !== newDate) setReminderDate(newDate);
          if (reminderTime !== newTime) setReminderTime(newTime);
        } catch { /* ignore */ }
      }
      const newRecurring = !!initialSnippet.is_recurring;
      if (isRecurring !== newRecurring) setIsRecurring(newRecurring);
      
      const newCycle = initialSnippet.recurring_cycle || null;
      if (recurringCycle !== newCycle) setRecurringCycle(newCycle);
 
      const newWs = initialSnippet.workspaceId || initialSnippet.workspace_id || null;
      if (workspaceId !== newWs) setWorkspaceId(newWs);
      
      const newFolder = initialSnippet.folderId || initialSnippet.folder_id || null;
      if (folderId !== newFolder) setFolderId(newFolder);
    }
  }, [initialSnippet, dbTags]);

  const isFirstBubbleRef = useRef(true);

  // Bubble editable note properties up whenever they change.
  // Favorite state is handled separately so a star toggle does not trigger note autosave UI.
  useEffect(() => {
    if (isFirstBubbleRef.current) {
      isFirstBubbleRef.current = false;
      return;
    }
    if (onChange) {
      onChange({
        isFav,
        pendingHotkey,
        pendingShortcut,
        selectedTags,
        availableTags,
        reminderDate,
        reminderTime,
        isRecurring,
        recurringCycle,
        workspaceId,
        folderId
      });
    }
  }, [pendingHotkey, pendingShortcut, selectedTags, availableTags, reminderDate, reminderTime, isRecurring, recurringCycle, workspaceId, folderId, onChange]);

  const onToggleFavorite = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!compoundId || compoundId === 'new') return;

    let type = 'note';
    if (initialSnippet?.urls || initialSnippet?.category === 'link') type = 'link';
   
    else if (initialSnippet?.category === 'snippet') type = 'snippet';

    const label = initialSnippet?.title || initialSnippet?.name || defaultName || '';
    await toggleFavorite(compoundId, type, label);
  };
  
  const onHotkeyChange = async (hotkey: string) => {
    setPendingHotkey(hotkey);
    if (compoundId && compoundId !== 'new') {
      try {
        const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
        let itemType: any = 'note';
        if (initialSnippet?.urls || initialSnippet?.category === 'link') itemType = 'link';
       
        else if (initialSnippet?.category === 'snippet') itemType = 'snippet';
        else if (initialSnippet?.category === 'automation') itemType = 'automation';
        
        if (!hotkey) await clearHotkey(snippetId || compoundId, compoundId, itemType);
        else await saveHotkey(snippetId || compoundId, compoundId, hotkey, itemType);
      } catch (err) {
        console.error('Auto-save hotkey failed', err);
      }
    }
  };
  
  const onShortcutChange = async (shortcut: string) => {
    setPendingShortcut(shortcut);
    if (compoundId && compoundId !== 'new') {
      try {
        const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
        let itemType: any = 'note';
        if (initialSnippet?.urls || initialSnippet?.category === 'link') itemType = 'link';
        
        else if (initialSnippet?.category === 'snippet') itemType = 'snippet';
        else if (initialSnippet?.category === 'automation') itemType = 'automation';
        const itemName = initialSnippet?.title || initialSnippet?.name || defaultName || 'Untitled';

        if (!shortcut) await clearShortcut(snippetId || compoundId, compoundId, itemType);
        else await saveShortcut(snippetId || compoundId, compoundId, shortcut, itemName, itemType);
      } catch (err) {
        console.error('Auto-save shortcut failed', err);
      }
    }
  };
  const onTagSelect = (tag: any) => handleTagSelect(tag);


  // --- Hover & Popup State ---
  const [isTodoPopupOpen, setIsTodoPopupOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [tagPopupOpen, setTagPopupOpen] = useState(false);
  
  const todoHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const locationHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tagHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const todoPopupRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null); // Tag popup ref

  // --- Todo State ---
  const [isAnytime, setIsAnytime] = useState(false);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isCycleDropdownOpen, setIsCycleDropdownOpen] = useState(false);
  const timePopupRef = useRef<HTMLDivElement>(null);
  const cyclePopupRef = useRef<HTMLDivElement>(null);

  // --- Tags State ---
  const [newTagName, setNewTagName] = useState('');

  // Handlers
  const handleTodoPopupToggle = () => {
    setIsTodoPopupOpen(prev => !prev);
    setIsLocationPickerOpen(false);
    setTagPopupOpen(false);
  };

  const handleLocationPickerToggle = () => {
    setIsLocationPickerOpen(prev => !prev);
    setIsTodoPopupOpen(false);
    setTagPopupOpen(false);
  };

  const handleTagIconClick = () => {
    setTagPopupOpen(prev => !prev);
    setIsTodoPopupOpen(false);
    setIsLocationPickerOpen(false);
  };

  const handleCreateTodoFromNote = () => {
    if (onCreateTodo) {
      let deadlineVal = '';
      if (!isAnytime && reminderDate && reminderTime) {
        try {
          deadlineVal = new Date(reminderDate + "T" + reminderTime).toISOString();
        } catch (e) {
          deadlineVal = '';
        }
      }
      onCreateTodo(deadlineVal, isRecurring, recurringCycle || 'daily');
      setIsTodoPopupOpen(false);
    }
  };

  const handleWorkspaceDestination = (wsId: string) => {
    setWorkspaceId(wsId);
    setFolderId(null);
  };

  const handleFolderDestination = (wsId: string, folderId: string) => {
    setWorkspaceId(wsId);
    setFolderId(folderId);
  };

  const handleTagSelect = (tag: any) => {
    setSelectedTags(prev => {
      const exists = prev.find(t => t.id === tag.id);
      const nextTags = exists ? prev.filter(t => t.id !== tag.id) : [...prev, tag];
      lastProcessedTagIdsStrRef.current = nextTags.map(t => t.id).sort().join(',');
      return nextTags;
    });
  };

  return (
    <>
            <div className="flex flex-col items-center gap-1">
              {/* Favorites (Star) */}
              <button
                type="button"
                onClick={onToggleFavorite}
                disabled={!compoundId || compoundId === 'new'}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed"
                title={!compoundId || compoundId === 'new' ? "Save item first to favorite" : "Favorite"}
              >
                {isFav ? (
                  <FaStar size={20} className="text-yellow-500 fill-yellow-500" />
                ) : (
                  <FiStar size={20} />
                )}
              </button>

              {/* Hotkeys */}
              <div className="relative">
                <div className="flex flex-col items-center gap-1">
                  <HotkeyAssignButton
                    ref={hotkeyButtonRef}
                    itemId={compoundId}
                    currentHotkey={pendingHotkey}
                    onHotkeyChange={onHotkeyChange}
                    isFavorite={isFav}
                    onToggleFavorite={onToggleFavorite}
                    showFavorite={false}
                    disabled={!compoundId || compoundId === 'new'}
                    isFavLoading={false}
                    isHotkeyLoading={false}
                    sidebarMode={true}
                    openToLeft={openPopupsToLeft}
                    className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                  <ShortcutAssignButton
                    ref={hotkeyButtonRef}
                    itemId={compoundId}
                    currentShortcut={pendingShortcut}
                    onShortcutChange={(shortcut: string) => {
                      if (onShortcutChange) onShortcutChange(shortcut);
                    }}
                    defaultName={defaultName}
                    disabled={!compoundId || compoundId === 'new'}
                    isShortcutLoading={false}
                    sidebarMode={true}
                    openToLeft={openPopupsToLeft}
                    className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              {/* Create To-Do */}
              {showTodo && (
              <div
                className="relative"
                ref={todoPopupRef}
                onMouseEnter={() => {
                  if (todoHoverTimerRef.current) clearTimeout(todoHoverTimerRef.current);
                  todoHoverTimerRef.current = setTimeout(() => {
                    setIsTodoPopupOpen(true);
                    setIsLocationPickerOpen(false);
                    setTagPopupOpen(false);
                  }, 150);
                }}
                onMouseLeave={() => {
                  if (todoHoverTimerRef.current) clearTimeout(todoHoverTimerRef.current);
                  todoHoverTimerRef.current = setTimeout(() => {
                    setIsTodoPopupOpen(false);
                  }, 200);
                }}
              >
                <button
                  type="button"
                  disabled={!compoundId || compoundId === 'new'}
                  onClick={handleTodoPopupToggle}
                  className={`p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isTodoPopupOpen ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`}
                  title={!compoundId || compoundId === 'new' ? "Save item first to create a Todo" : "Create Todo"}
                >
                  <BsCalendarCheck size={20} />
                </button>
                {isTodoPopupOpen && (
                  <div className={`absolute ${openPopupsToLeft ? 'right-full top-0 mr-3' : 'left-full top-0 ml-3'} w-[270px] bg-[var(--color-editorBg)] border border-black/10 dark:border-white/10 rounded-xl p-3.5 shadow-xl z-50 flex flex-col gap-3`}>
                    <h3 className="text-[11px] font-semibold text-neutral-400 dark:text-white/40 uppercase tracking-wider px-1 pb-0.5 pt-0.5">
                      Reminder & Schedule
                    </h3>
                    <div className="flex p-0.5 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => { setIsRecurring(false); setIsAnytime(false); setIsTimeDropdownOpen(false); }}
                        className={`flex-1 text-xs font-medium py-1 rounded-md transition-colors ${!isRecurring ? 'bg-white shadow-sm dark:bg-white/10 text-neutral-900 dark:text-white/80' : 'text-neutral-500 dark:text-white/40 hover:text-neutral-900 dark:hover:text-white/70'}`}
                      >
                        One-Time
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsRecurring(true); setIsAnytime(true); setIsTimeDropdownOpen(true); setIsTimePickerOpen(false); }}
                        className={`flex-1 text-xs font-medium py-1 rounded-md transition-colors ${isRecurring ? 'bg-white shadow-sm dark:bg-white/10 text-neutral-900 dark:text-white/80' : 'text-neutral-500 dark:text-white/40 hover:text-neutral-900 dark:hover:text-white/70'}`}
                      >
                        Recurring
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="relative flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => {
                        if (isRecurring) {
                          setIsTimeDropdownOpen(prev => !prev);
                          setIsTimePickerOpen(false);
                        } else {
                          setIsTimePickerOpen(prev => !prev);
                          setIsTimeDropdownOpen(false);
                        }
                      }}>
                        <div className="flex items-center gap-2.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 dark:text-neutral-500"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                          <span className="text-[13px] font-medium text-neutral-600 dark:text-white/60">Time</span>
                        </div>

                        <div className="flex items-center" onClick={(e) => {
                          if (!isAnytime) {
                            e.stopPropagation();
                            setIsTimePickerOpen(prev => !prev);
                            setIsTimeDropdownOpen(false);
                          }
                        }}>
                          {(isRecurring && isAnytime) ? (
                            <span className="text-[13px] text-neutral-500 dark:text-neutral-400 font-medium">Anytime</span>
                          ) : (
                            <div className="px-1.5 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                              <InlineTimeInput
                                value={reminderTime}
                                onChange={setReminderTime}
                              />
                            </div>
                          )}
                        </div>

                        {(isRecurring && isTimeDropdownOpen) && (
                          <div ref={timePopupRef} className="absolute left-0 top-full mt-2 w-[160px] rounded-xl shadow-2xl z-[150] bg-[#1B1B1C] border border-[#2D2E30] overflow-hidden py-1">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setIsAnytime(true); setIsTimeDropdownOpen(false); setIsTimePickerOpen(false); }}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors text-left hover:bg-white/5 text-neutral-300 hover:text-white`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 dark:text-neutral-500"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                              <span className="font-medium">Anytime of the day</span>
                            </button>
                            <div className="h-px bg-[#2D2E30] my-0.5"></div>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setIsAnytime(false); setIsTimeDropdownOpen(false); setIsTimePickerOpen(true); }}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors text-left hover:bg-white/5 text-neutral-300 hover:text-white`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 dark:text-neutral-500"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                              <span className="font-medium">Specific Time</span>
                            </button>
                          </div>
                        )}

                        <CustomTimePicker
                          value={reminderTime}
                          onChange={setReminderTime}
                          isOpen={isTimePickerOpen && (!isRecurring || !isAnytime)}
                          setIsOpen={setIsTimePickerOpen}
                        />
                      </div>
                      <div
                        className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={(e) => {
                          const input = e.currentTarget.querySelector('input[type="date"]');
                          if (input) {
                            try {
                              (input as HTMLInputElement).showPicker();
                            } catch {
                              (input as HTMLInputElement).focus();
                            }
                          }
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 dark:text-neutral-500"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          <span className="text-[13px] font-medium text-neutral-600 dark:text-white/60">Date</span>
                        </div>
                        <input
                          type="date"
                          value={reminderDate}
                          onChange={(e) => setReminderDate(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-transparent border-none outline-none text-[13px] text-neutral-500 dark:text-white/50 p-0 text-right w-[105px] focus:ring-0 cursor-pointer dark:color-scheme-dark"
                        />
                      </div>
                      {isRecurring && (
                        <div
                          className="relative flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          ref={cyclePopupRef}
                          onClick={() => setIsCycleDropdownOpen(prev => !prev)}
                        >
                          <span className="text-[13px] font-medium text-neutral-600 dark:text-white/60">Cycle</span>
                          <button
                            type="button"
                            className="text-[13px] text-neutral-500 dark:text-white/50 font-medium hover:text-neutral-800 dark:hover:text-white/80 transition-colors flex items-center gap-1.5"
                          >
                            <span className="capitalize">{recurringCycle || 'daily'}</span>
                            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="w-3.5 h-3.5 opacity-60" height="1em" width="1em"><path d="M16.293 9.293 12 13.586 7.707 9.293l-1.414 1.414L12 16.414l5.707-5.707z"></path></svg>
                          </button>
                          {isCycleDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1 w-[110px] bg-[#141414] border border-white/10 rounded-xl p-1 shadow-lg z-50 flex flex-col gap-0.5">
                              {['daily', 'weekly', 'monthly'].map((cycle) => (
                                <button
                                  key={cycle}
                                  type="button"
                                  onClick={() => {
                                    setRecurringCycle(cycle);
                                    setIsCycleDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors capitalize ${recurringCycle === cycle ? 'bg-white/15 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                  {cycle}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleCreateTodoFromNote}
                        disabled={todoStatus === 'creating'}
                        className={`mt-2.5 ml-auto w-full flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-semibold rounded-xl border transition-all ${
                          todoStatus === 'success'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-default'
                            : todoStatus === 'creating'
                              ? 'border-white/5 bg-white/5 text-neutral-500 cursor-not-allowed opacity-70'
                              : 'border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-neutral-600 dark:text-white/50 hover:text-neutral-900 dark:hover:text-white/80 cursor-pointer'
                        }`}
                      >
                        {todoStatus === 'creating' ? (
                          <>
                            <svg className="animate-spin text-neutral-500" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                            <span>Creating…</span>
                          </>
                        ) : todoStatus === 'success' ? (
                          <>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-emerald-400"><polyline points="20 6 9 17 4 12" /></svg>
                            <span>Todo Created!</span>
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 dark:text-neutral-500"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"/></svg>
                            <span>Create Todo</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Location (Folder) */}
              <div
                className="relative"
                onMouseEnter={() => {
                  if (locationHoverTimerRef.current) clearTimeout(locationHoverTimerRef.current);
                  locationHoverTimerRef.current = setTimeout(() => {
                    setIsLocationPickerOpen(true);
                    setIsTodoPopupOpen(false);
                    setTagPopupOpen(false);
                  }, 150);
                }}
                onMouseLeave={() => {
                  if (locationHoverTimerRef.current) clearTimeout(locationHoverTimerRef.current);
                  locationHoverTimerRef.current = setTimeout(() => {
                    setIsLocationPickerOpen(false);
                  }, 200);
                }}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleLocationPickerToggle(); }}
                  disabled={saveStatus === 'saving'}
                  className={`p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer ${isLocationPickerOpen ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`}
                  title={snippetBreadCrum?.folder_name || snippetBreadCrum?.workspace_name || "Folders"}
                >
                  <FaFolder size={20} />
                </button>
                {isLocationPickerOpen && (
                  <div className={`absolute ${openPopupsToLeft ? 'right-full top-0 pr-3' : 'left-full top-0 pl-3'} z-[60] w-[260px]`}>
                    <DestinationPicker
                      selectedWorkspaceId={workspaceId}
                      selectedFolderId={folderId}
                      onSelectWorkspace={handleWorkspaceDestination}
                      onSelectFolder={handleFolderDestination}
                      onClose={() => setIsLocationPickerOpen(false)}
                    />
                  </div>
                )}
              </div>

              {/* Tags */}
              <div
                className="relative"
                ref={popupRef}
                onMouseEnter={() => {
                  if (tagHoverTimerRef.current) clearTimeout(tagHoverTimerRef.current);
                  tagHoverTimerRef.current = setTimeout(() => {
                    setTagPopupOpen(true);
                    setIsTodoPopupOpen(false);
                    setIsLocationPickerOpen(false);
                  }, 150);
                }}
                onMouseLeave={() => {
                  if (tagHoverTimerRef.current) clearTimeout(tagHoverTimerRef.current);
                  tagHoverTimerRef.current = setTimeout(() => {
                    setTagPopupOpen(false);
                  }, 200);
                }}
              >
                <button
                  type="button"
                  onClick={handleTagIconClick}
                  className={`p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer ${tagPopupOpen ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`}
                  title="Tags"
                >
                  <FiTag size={20} />
                </button>
                {tagPopupOpen && (
                  <div className={`absolute ${openPopupsToLeft ? 'right-full top-0 mr-3' : 'left-full top-0 ml-3'} w-[240px] bg-[var(--color-editorBg)] border border-black/10 dark:border-white/10 rounded-xl p-3 shadow-xl z-50 flex flex-col gap-2`}>
                    <div className="text-xs font-semibold text-neutral-400 mb-1 px-1">Select Tag</div>
                    <div className="max-h-[160px] overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                      {dbTags.map((tag, idx) => (
                        <button
                          key={tag.id || idx}
                          type="button"
                          onClick={() => {
                            handleTagSelect({ id: tag.id, name: tag.name });
                          }}
                          className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${selectedTags.some(t => t.id === tag.id) ? 'bg-black/5 dark:bg-white/10 text-neutral-900 dark:text-white font-medium' : 'text-neutral-500 hover:text-neutral-900 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
                        >
                          <span>{tag.name}</span>
                          {selectedTags.some(t => t.id === tag.id) && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-black/10 dark:border-white/10 pt-2 mt-1">
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!newTagName.trim()) return;
                          const trimmed = newTagName.trim();
                          const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
                          if (existing) {
                            handleTagSelect({ id: existing.id, name: existing.name });
                          } else {
                            if (workspaceId) {
                               const newTagRecord = await createTag(trimmed, workspaceId);
                               handleTagSelect({ id: newTagRecord.id, name: newTagRecord.name });
                            } else {
                               // Fallback if no workspace is selected
                               handleTagSelect({ id: '', name: trimmed });
                            }
                          }
                          setNewTagName('');
                        }}
                        className="flex gap-1"
                      >
                        <input
                          type="text"
                          placeholder="New tag..."
                          value={newTagName}
                          onChange={e => setNewTagName(e.target.value)}
                          className="flex-1 bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-black/20 dark:focus:border-white/20 text-neutral-900 dark:text-white placeholder-[var(--color-textPlaceholder)]"
                        />
                        <button
                          type="submit"
                          className="px-2 py-1 bg-black/5 dark:bg-[#2a2a2a] text-neutral-700 dark:text-white border border-black/10 dark:border-white/10 rounded-lg text-xs font-medium hover:bg-black/10 dark:hover:bg-[#3a3a3a]"
                        >
                          Add
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
    </>
  );
});

SharedPropertiesToolbar.displayName = 'SharedPropertiesToolbar';
