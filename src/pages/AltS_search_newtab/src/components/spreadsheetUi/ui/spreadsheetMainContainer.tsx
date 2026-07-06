import React, { useEffect, useMemo } from 'react';
import { useAppearance } from '@extension/ui';
import {
  FaSearch,
  FaTimes,
  FaFilter,
  FaCode,
  FaLink,
  FaBookmark,
  FaTerminal,
  FaRobot,
  FaGlobe,
  FaLock,
  FaUsers,
  FaCheck,
  FaRegStar
} from 'react-icons/fa';
import { FiFilter, FiSettings, FiZap } from 'react-icons/fi';
import { BsStarFill, BsKeyboard } from 'react-icons/bs';
import { MdOutlineShortcut } from 'react-icons/md';
import { LuArrowRightLeft } from 'react-icons/lu';
import NotesIcon from '../../../../../../shared-components/icons/notesIcon';
import StackedLinkIcon from '../../../../../../shared-components/icons/stackedLinkIcon';
import clsx from 'clsx';
import SpreadsheetTable from './spreadsheetTable';
import { useSpreadsheetStore } from '../logic/spreadsheetStateStore';
import { useDbStore } from '../../../../../../storage/store/useDbStore';

import { useUIStore } from '../../../../../../shared-components/uiStateManager';
import SpreadsheetToolbar from './spreadsheetToolbar';
import SpreadsheetQuickAddModal from './spreadsheetQuickAddModal';
import { TutorialCard, TutorialDashboard } from '../../../../../../welcomeGuide/TutorialCards';
import Branding from '../../../../../../shared-components/Branding';

interface SheetUIProps {
  onClose?: () => void;
  savedAutomations?: any[];
  savedAgents?: any[];
  installedModules?: any[];
  onCreateOrganization?: () => void;
  onOrganizationSettings?: (orgId: string, orgName: string) => void;
  onCreateWorkspace?: () => void;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  onBoardViewRedirect?: () => void;
}

const SpreadsheetMainContainer: React.FC<SheetUIProps> = ({
  onClose,
  savedAutomations = [],
  savedAgents = [],
  installedModules = [],
  onCreateOrganization,
  onOrganizationSettings,
  onCreateWorkspace,
  isLoggedIn,
  onRequireLogin,
  onBoardViewRedirect,
}) => {
  const syncRealNotes = useSpreadsheetStore(state => state.syncRealNotes);
  const { isPickerOpen, pickerRowIndex, closePicker, updateRowLocation, openPicker, searchTerm, setSearchTerm, setSelectedCell } = useSpreadsheetStore();
    const { theme } = useAppearance();
    const [bookmarks, setBookmarks] = React.useState<any[]>([]);
  const [tutorialStep, setTutorialStep] = React.useState<number | null>(null);
  const [cardPos, setCardPos] = React.useState<{ top: number; left: number; right?: number } | null>(null);

  React.useEffect(() => {
    if (tutorialStep === null) {
      setCardPos(null);
      return;
    }

    const updatePosition = () => {
      const ids = ['sheet-search-wrapper', 'sheet-toolbar-add-btn', 'sheet-toolbar-filter-btn'];
      const targetId = ids[tutorialStep];
      const el = document.getElementById(targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Focus the search input if step is 0
        if (tutorialStep === 0) {
          const inputEl = document.getElementById('sheet-search-name');
          if (inputEl instanceof HTMLElement) {
            inputEl.focus();
          }
        } else if (el instanceof HTMLElement) {
          el.focus();
        }

        const container = document.getElementById('sheet-ui-container');
        if (container) {
          const cRect = container.getBoundingClientRect();
          const computedZoom = window.getComputedStyle(container).zoom;
          const zoom = parseFloat(computedZoom) || 1;

          if (tutorialStep === 0) {
            // Pointing to Search Input (from top)
            // Center horizontally, position below the element
            setCardPos({
              top: (rect.bottom - cRect.top + 10) / zoom,
              left: (rect.left - cRect.left + rect.width / 2) / zoom,
            });
          } else {
            // Pointing to Toolbar buttons (from right)
            // Align vertically with center, position to the left of the element
            setCardPos({
              top: (rect.top - cRect.top + rect.height / 2) / zoom,
              left: (rect.left - cRect.left - 10) / zoom,
            });
          }
        }
      }
    };

    // Recalculate position on window resize for perfect alignment
    window.addEventListener('resize', updatePosition);

    // Stable delay to ensure render and layout are completely settled
    const timer = setTimeout(updatePosition, 250);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [tutorialStep]);

    const [userId, setUserId] = React.useState<string>('');
    // removed local hotkeys and shortcuts state

  const notes = useDbStore(state => state.notes);
  const links = useDbStore(state => state.links);
  const snippets = useDbStore(state => state.snippets);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const favorites = useDbStore(state => state.favorites);
  const hotkeysMap = useDbStore(state => state.hotkeysMap);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);


  

  // 1. Initial Load of Favorites, Hotkeys and Shortcuts
  useEffect(() => {
    
    // Moved loadKeys to a separate useEffect that depends on isLoggedIn

    // Fetch Bookmarks
    const flattenBookmarks = (nodes: chrome.bookmarks.BookmarkTreeNode[], result: any[] = []) => {
      nodes.forEach(node => {
        if (node.url) {
          result.push(node);
        }
        if (node.children) {
          flattenBookmarks(node.children, result);
        }
      });
      return result;
    };

    const loadBookmarks = () => {
      chrome.bookmarks?.getTree?.(tree => {
        const flattened = flattenBookmarks(tree);
        setBookmarks(flattened);
      });
    };

    loadBookmarks();

    if (chrome.bookmarks?.onRemoved) {
      chrome.bookmarks.onRemoved.addListener(loadBookmarks);
      chrome.bookmarks.onCreated.addListener(loadBookmarks);
      chrome.bookmarks.onChanged.addListener(loadBookmarks);
    }

    // 🚀 Handle click outside to clear all focus/selection
    const handleOutsideClick = (e: MouseEvent) => {
      const container = document.getElementById('sheet-ui-container');
      if (container && !container.contains(e.target as Node)) {
        const store = useSpreadsheetStore.getState();
        store.setSelectedCell(null);
        store.setEditingCell(null);

        // Force blur any active elements to ensure focus is truly gone
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener('mousedown', handleOutsideClick, true); // Use capture phase
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick, true);
    };
  }, []);

  // 3. Sync Logic
  useEffect(() => {
    syncRealNotes(
      notes,
      links,
      snippets,
      workspaces,
      folders,
      userId || 'local_user',
        favorites,
        hotkeysMap,
      shortcutsMap,
      savedAutomations,
      savedAgents,
      installedModules,
      bookmarks,
    );
  }, [
    notes,
    links,
    snippets,
    workspaces,
    folders,
    userId,
      favorites,
      hotkeysMap,
    shortcutsMap,
    syncRealNotes,
    savedAutomations,
    savedAgents,
    installedModules,
    bookmarks,
  ]);

  const pickerRow = pickerRowIndex !== null ? useSpreadsheetStore.getState().tableData[pickerRowIndex] : null;

  const handleOpenTutorial = async () => {
    window.dispatchEvent(new CustomEvent('openTutorial'));
  };

  const handleCloseTutorial = () => {
    setTutorialStep(null);
  };

  const handleNextStep = (step: number) => {
    if (step < 2) {
      setTutorialStep(step + 1);
    } else {
      handleCloseTutorial();
    }
  };

  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = React.useState(false);
  const [swapMenuOpen, setSwapMenuOpen] = React.useState<string | null>(null);

  const {
    categoryFilter,
    setCategoryFilter,
    visibilityFilter,
    setVisibilityFilter,
    showFavoritesOnly,
    setShowFavoritesOnly,
    showHotkeysOnly,
    setShowHotkeysOnly,
    showShortcutsOnly,
    setShowShortcutsOnly,
    spaceFilter,
    setSpaceFilter,
  } = useSpreadsheetStore();

  const filterOptions = React.useMemo(() => {
    return [
      // Spaces
      { type: 'space', id: 'all', label: 'All Spaces', icon: <FaFilter className="text-[10px]" /> },
      {
        type: 'space' as const,
        id: 'none_org',
        label: 'Personal Space',
        icon: (
          <div className="w-3.5 h-3.5 rounded-full bg-neutral-400 flex items-center justify-center font-bold text-[6px] text-white">N</div>
        )
      },
      // Categories
      { type: 'category' as const, id: 'all', label: 'All', icon: <FaFilter className="text-[10px]" /> },
      { type: 'category' as const, id: 'note', label: 'All Notes', icon: <NotesIcon size={14} /> },
      { type: 'category' as const, id: 'snippet', label: 'Snippets', icon: <FaCode className="text-[var(--color-iconDefault)]" size={14} /> },
      { type: 'category' as const, id: 'link', label: 'Smart Links', icon: <FaLink className="text-[var(--color-iconDefault)]" size={14} /> },
      { type: 'category' as const, id: 'bookmark', label: 'Bookmarks', icon: <FaBookmark className="text-blue-500" size={14} /> },
      { type: 'category' as const, id: 'general_commands', label: 'Commands', icon: <FaTerminal className="text-blue-400" size={14} /> },
      { type: 'category' as const, id: 'commands', label: 'Browser Commands', icon: <FaTerminal className="text-[var(--color-iconDefault)]" size={14} /> },
      {
        type: 'category' as const,
        id: 'automation',
        label: 'Saved Automations',
        icon: <FiZap className="text-amber-500" size={14} />,
      },
      {
        type: 'category' as const,
        id: 'agent',
        label: 'Chat Agents',
        icon: (
          <StackedLinkIcon
            urls={['chatgpt.com', 'gemini.google.com', 'claude.ai', 'perplexity.ai']}
            size={14}
            maxIcons={4}
          />
        ),
      },
      {
        type: 'category' as const,
        id: 'module',
        label: 'Installed Modules',
        icon: <FaRobot className="text-purple-500" size={14} />,
      },
      // Visibility
      { type: 'visibility' as const, id: 'all', label: 'All Scopes', icon: <FaGlobe className="text-[10px]" /> },
      { type: 'visibility' as const, id: 'private', label: 'Private', icon: <FaLock className="text-[10px]" /> },
      { type: 'visibility' as const, id: 'public', label: 'Public', icon: <FaGlobe className="text-[10px]" /> },
      { type: 'visibility' as const, id: 'shared', label: 'Shared', icon: <FaUsers className="text-[10px]" /> },
      // Features (Quick Filters)
      {
        type: 'feature' as const,
        id: 'favorites',
        label: 'Favorites',
        icon: <FaRegStar className="text-[11px]" />,
        activeIcon: <BsStarFill className="text-[11px]" />,
      },
      {
        type: 'feature' as const,
        id: 'hotkeys',
        label: 'Hotkeys',
        icon: <BsKeyboard className="text-[11px]" />,
      },
      {
        type: 'feature' as const,
        id: 'shortcuts',
        label: 'Shortcuts',
        icon: <MdOutlineShortcut className="text-[11px]" />,
      },
    ];
  }, []);

  const isSelected = (opt: any) => {
    if (opt.type === 'space') return spaceFilter.includes(opt.id!);
    if (opt.type === 'category') return categoryFilter.includes(opt.id!);
    if (opt.type === 'visibility') return visibilityFilter.includes(opt.id!);
    if (opt.type === 'feature') {
      if (opt.id === 'favorites') return showFavoritesOnly;
      if (opt.id === 'hotkeys') return showHotkeysOnly;
      if (opt.id === 'shortcuts') return showShortcutsOnly;
    }
    return false;
  };

  const handleSelect = (opt: any) => {
    if (opt.type === 'space') {
      if (opt.id === 'all') setSpaceFilter(['all']);
      else {
        let next = spaceFilter.filter(x => x !== 'all');
        if (next.includes(opt.id!)) {
          next = next.filter(x => x !== opt.id);
          if (next.length === 0) next = ['all'];
        } else {
          next.push(opt.id!);
        }
        setSpaceFilter(next);
      }
    } else if (opt.type === 'category') {
      if (opt.id === 'all') setCategoryFilter(['all']);
      else {
        let next = categoryFilter.filter(x => x !== 'all');
        if (next.includes(opt.id!)) {
          next = next.filter(x => x !== opt.id);
          if (next.length === 0) next = ['all'];
        } else {
          next.push(opt.id!);
        }
        setCategoryFilter(next);
      }
    } else if (opt.type === 'visibility') {
      if (opt.id === 'all') setVisibilityFilter(['all']);
      else {
        let next = visibilityFilter.filter(x => x !== 'all');
        if (next.includes(opt.id!)) {
          next = next.filter(x => x !== opt.id);
          if (next.length === 0) next = ['all'];
        } else {
          next.push(opt.id!);
        }
        setVisibilityFilter(next);
      }
    } else if (opt.type === 'feature') {
      if (opt.id === 'favorites') setShowFavoritesOnly(!showFavoritesOnly);
      if (opt.id === 'hotkeys') setShowHotkeysOnly(!showHotkeysOnly);
      if (opt.id === 'shortcuts') setShowShortcutsOnly(!showShortcutsOnly);
    }
  };

  const handleClearAll = () => {
    setCategoryFilter(['all']);
    setVisibilityFilter(['all']);
    setSpaceFilter(['all']);
    setShowFavoritesOnly(false);
    setShowHotkeysOnly(false);
    setShowShortcutsOnly(false);
  };

  const sidebarCategories = filterOptions.filter(o => o.type === 'category');

  return (
    <div
      id="sheet-ui-container"
      className="flex h-full w-full overflow-hidden border border-white/10 rounded-t-2xl border-b-0 relative flex-col min-[1600px]:[zoom:1.2] min-[1800px]:[zoom:1.28] bg-[var(--color-appBg)] text-white mb-0 shadow-2xl"
      style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Absolute positioned Toolbar at the top right */}
      <div className="absolute top-3 right-6 z-[200]">
        <SpreadsheetToolbar
          onClose={onClose}
          onCreateOrganization={onCreateOrganization}
          onOrganizationSettings={onOrganizationSettings}
          onCreateWorkspace={onCreateWorkspace}
          onOpenTutorial={handleOpenTutorial}
          tutorialStep={tutorialStep}
          setTutorialStep={setTutorialStep}
          isLoggedIn={isLoggedIn}
          onRequireLogin={onRequireLogin}
          onBoardViewRedirect={onBoardViewRedirect}
        />
      </div>

      {/* Standalone Search Bar centered */}
      <div className="w-full max-w-[1100px] mx-auto pt-[10vh] pb-4 pl-6 pr-3 flex-shrink-0 relative z-50">
        <div className="w-full max-w-[420px]">
          <div
            id="sheet-search-wrapper"
            className={clsx(
              "w-full flex flex-start px-3 gap-2.5 rounded-md border shadow-none transition-colors items-center",
              "min-h-[36px] min-[1680px]:min-h-[40px] min-[1880px]:min-h-[44px]",
              tutorialStep === 0
                ? "border-[#22c55e]"
                : "border-white/80",
              "bg-[var(--color-inputBg)] text-neutral-200"
            )}
          >
            <div className="flex items-center justify-center shrink-0">
              <FaSearch size={13} className="text-[var(--color-iconDefault)]" />
            </div>
            <input
              id="sheet-search-name"
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search "
              className={clsx(
                "flex-1 bg-transparent font-medium outline-none border-none",
                "text-[14px] min-[1680px]:text-[15px] min-[1880px]:text-[16px]",
                "text-neutral-200 placeholder:text-neutral-400"
              )}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className={clsx(
                  "p-1 rounded-md transition-colors",
                  "text-[var(--color-iconDefault)] hover:text-white hover:bg-white/10"
                )}
                title="Clear search"
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Combined Card Container: Sidebar + SpreadsheetTable */}
      <div className="flex-1 w-full max-w-[1100px] mx-auto overflow-hidden relative z-0 flex flex-row rounded-2xl shadow-lg bg-[var(--color-sheetBg)] border border-white/10 mb-6">
        
        {/* LEFT SIDEBAR (Inside Card) */}
        <div className="w-[180px] shrink-0 flex flex-col border-r border-white/10 relative overflow-visible bg-transparent">
          {/* Sidebar Header with Filter Icon */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 px-3 pt-4 shrink-0 relative overflow-visible">
            <span className="text-[13px] font-bold text-white tracking-tight">Categories</span>
            <div className="relative">
              <button
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className={clsx(
                  "p-1.5 rounded-md transition-all border cursor-pointer flex items-center justify-center",
                  !spaceFilter.includes('all') ||
                    !visibilityFilter.includes('all') ||
                    showFavoritesOnly ||
                    showHotkeysOnly ||
                    showShortcutsOnly
                    ? 'bg-blue-900/30 text-blue-400 border-blue-800'
                    : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
                )}
                title="Filter Options"
              >
                <FiFilter size={14} />
              </button>

              {/* Filter Dropdown Popover */}
              {isFilterDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[999]" onClick={() => setIsFilterDropdownOpen(false)} />
                  <div className="absolute left-full top-0 ml-2 w-[580px] border rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.3)] z-[1000] p-0.5 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150 bg-[var(--color-popupBg)] border-white/10">
                    <div className="flex gap-0.5 p-2 h-full bg-[var(--color-popupBg)]">
                      {/* Space Column */}
                      <div className="flex-[1.1] px-1.5">
                        <div className={clsx(
                          "px-1.5 pb-1.5 text-[11px] font-bold border-b mb-1.5", "text-neutral-500 border-white/5"
                        )}>
                          Spaces
                        </div>
                        <div className="space-y-0">
                          {filterOptions
                            .filter(o => o.type === 'space')
                            .map(opt => {
                              const active = isSelected(opt);
                              return (
                                <div
                                  key={`${opt.type}-${opt.id}`}
                                  onClick={() => handleSelect(opt)}
                                  className={clsx(
                                    'flex items-center gap-2 w-full px-1.5 py-1 text-[12px] rounded-md transition-all group relative cursor-pointer',
                                    active
                                      ? 'bg-blue-900/20 text-blue-400 font-semibold'
                                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-white',
                                  )}>
                                  <div
                                    className={clsx(
                                      'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all duration-200',
                                      active
                                        ? 'bg-blue-600 border-blue-600'
                                        : 'border-neutral-700 bg-neutral-900 group-hover:border-neutral-600',
                                    )}>
                                    {active && <FaCheck className="text-white text-[7px]" />}
                                  </div>
                                  <span
                                    className={clsx(
                                      'w-4.5 flex justify-center text-[13px]',
                                      active ? ('text-blue-400') : ('text-neutral-500 group-hover:text-neutral-400'),
                                    )}>
                                    {opt.icon}
                                  </span>
                                  <span className="truncate flex-1 text-left">{opt.label}</span>

                                  {opt.type === 'space' && opt.label !== 'All Spaces' && opt.id !== 'none_org' && (
                                    <div className="flex items-center ml-1 shrink-0 relative gap-0.5">
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (onOrganizationSettings && opt.id) {
                                            onClose?.();
                                            onOrganizationSettings(opt.id, opt.label || '');
                                            setIsFilterDropdownOpen(false);
                                          }
                                        }}
                                        className={clsx(
                                          "transition-colors shrink-0 cursor-pointer p-1 rounded hover:bg-black/5 dark:hover:bg-white/10", "text-neutral-500 hover:text-blue-400"
                                        )}
                                        title="Organization Settings"
                                      >
                                        <FiSettings size={13} />
                                      </button>

                                      <div
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSwapMenuOpen(swapMenuOpen === opt.id ? null : (opt.id ?? null));
                                        }}
                                        className={clsx(
                                          "transition-colors shrink-0 cursor-pointer p-1 rounded hover:bg-black/5 dark:hover:bg-white/10", "text-neutral-600 hover:text-blue-400"
                                        )}
                                        title="Swap Organization"
                                      >
                                        <LuArrowRightLeft size={13} />
                                      </div>

                                      {swapMenuOpen === opt.id && (
                                        <>
                                          <div className="fixed inset-0 z-[1001]" onClick={(e) => { e.stopPropagation(); setSwapMenuOpen(null); }} />
                                          <div className="absolute top-0 left-full ml-2 w-48 max-h-[300px] overflow-y-auto border rounded-lg shadow-xl z-[1002] p-1 flex flex-col gap-0.5 bg-[var(--color-popupBg)] border-white/10">
                                            <div className={clsx(
                                              "px-2 py-1 text-[9px] font-bold uppercase tracking-wider border-b mb-0.5", "text-neutral-500 border-white/5"
                                            )}>
                                              Switch Organization
                                            </div>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSwapMenuOpen(null);
                                              }}
                                              className={clsx(
                                                "flex items-center gap-2 w-full px-2 py-1.5 text-[11px] rounded-md transition-all text-left font-medium", "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                                              )}
                                            >
                                              <div className={clsx(
                                                "w-4 h-4 rounded-full flex items-center justify-center font-bold text-[8px]", "bg-neutral-800 text-neutral-400"
                                              )}>P</div>
                                              <span>Personal Space</span>
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      <div className={clsx("w-px my-1.5", "bg-[var(--color-borderDefault)]")} />

                      {/* Visibility Column */}
                      <div className="flex-[1.1] px-1.5">
                        <div className={clsx(
                          "px-1.5 pb-1.5 text-[11px] font-bold border-b mb-1.5", "text-neutral-500 border-white/5"
                        )}>
                          Visibility
                        </div>
                        <div className="space-y-0">
                          {filterOptions
                            .filter(o => o.type === 'visibility')
                            .map(opt => {
                              const active = isSelected(opt);
                              return (
                                <div
                                  key={`${opt.type}-${opt.id}`}
                                  onClick={() => handleSelect(opt)}
                                  className={clsx(
                                    'flex items-center gap-2 w-full px-1.5 py-1 text-[12px] rounded-md transition-all group relative cursor-pointer',
                                    active
                                      ? 'bg-blue-900/20 text-blue-400 font-semibold'
                                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-white',
                                  )}>
                                  <div
                                    className={clsx(
                                      'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all duration-200',
                                      active
                                        ? 'bg-blue-600 border-blue-600'
                                        : 'border-neutral-700 bg-neutral-900 group-hover:border-neutral-600',
                                    )}>
                                    {active && <FaCheck className="text-white text-[7px]" />}
                                  </div>
                                  <span
                                    className={clsx(
                                      'w-4.5 flex justify-center text-[13px]',
                                      active ? ('text-blue-400') : ('text-neutral-500 group-hover:text-neutral-400'),
                                    )}>
                                    {opt.icon}
                                  </span>
                                  <span className="whitespace-nowrap flex-1 text-left">{opt.label}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      <div className={clsx("w-px my-1.5", "bg-[var(--color-borderDefault)]")} />

                      {/* Quick Filters Column */}
                      <div className="flex-[1.2] px-1.5 relative">
                        <div className={clsx(
                          "px-1.5 pb-1.5 text-[11px] font-bold border-b mb-1.5 flex items-center justify-between", "text-neutral-500 border-white/5"
                        )}>
                          <span>Quick Filters</span>
                        </div>
                        <div className="space-y-0">
                          {filterOptions
                            .filter(o => o.type === 'feature')
                            .map(opt => {
                              const active = isSelected(opt);
                              return (
                                <div
                                  key={`${opt.type}-${opt.id}`}
                                  onClick={() => handleSelect(opt)}
                                  className={clsx(
                                    'flex items-center gap-2 w-full px-1.5 py-1 text-[12px] rounded-md transition-all group relative cursor-pointer',
                                    active
                                      ? 'bg-blue-900/20 text-blue-400 font-semibold'
                                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-white',
                                  )}>
                                  <div
                                    className={clsx(
                                      'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all duration-200',
                                      active
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'border-neutral-700 bg-neutral-900 group-hover:border-neutral-600',
                                    )}>
                                    {active && <FaCheck className="text-white text-[7px]" />}
                                  </div>
                                  <span
                                    className={clsx(
                                      'w-4.5 flex justify-center text-[13px]',
                                      active ? '' : ('text-neutral-500 group-hover:text-neutral-400'),
                                    )}>
                                    {active && opt.activeIcon ? opt.activeIcon : opt.icon}
                                  </span>
                                  <span className="whitespace-nowrap flex-1 text-left">{opt.label}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 border-t border-white/10 bg-[var(--color-popupBg)]">
                      <button
                        onClick={handleClearAll}
                        className={clsx(
                          "text-[11px] font-medium transition-colors px-2 py-1 rounded flex items-center gap-1.5 cursor-pointer", "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                        )}>
                        <FaTimes className="text-[9px]" />
                        Clear all
                      </button>
                      <div className={clsx(
                        "flex items-center gap-1.5 text-[11px] mr-1", "text-neutral-500"
                      )}>
                        <span>Press</span>
                        <kbd className={clsx(
                          "px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded border shadow-sm", "bg-neutral-800 border-neutral-700 text-neutral-300"
                        )}>ESC</kbd>
                        <span>to close</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Categories List Scrollable */}
          <div className="flex-1 overflow-y-auto hover-scrollbar px-3 pb-4 flex flex-col gap-0.5">
            {sidebarCategories.map(opt => {
              const active = isSelected(opt);
              return (
                <button
                  key={`${opt.type}-${opt.id}`}
                  onClick={() => {
                    // Sidebar category acts as a single-selection filter
                    setCategoryFilter([opt.id!]);
                  }}
                  className={clsx(
                    "flex items-center gap-2.5 px-2.5 py-2 text-[12px] font-medium rounded-xl transition-all cursor-pointer text-left w-full group",
                    active
                      ? "bg-white/10 text-white"
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className={clsx("w-4 flex justify-center shrink-0 text-[14px]", active ? "text-white" : "text-neutral-500 group-hover:text-neutral-300")}>
                    {opt.icon}
                  </span>
                  <span className="truncate flex-1 leading-tight">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SPREADSHEET TABLE AREA */}
        <div className="flex-1 overflow-auto custom-scrollbar dark-scrollbar relative">
          <SpreadsheetTable
                                    onClose={onClose}
            tutorialStep={tutorialStep}
            setTutorialStep={setTutorialStep}
          />
        </div>
      </div>

      <SpreadsheetQuickAddModal />

    </div>
  );
};

export default SpreadsheetMainContainer;
