import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useSpreadsheetStore } from '../logic/spreadsheetStateStore';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { FiHelpCircle, FiX, FiFilter, FiPlus, FiZap, FiSearch, FiSettings, FiLayout, FiList, FiGrid } from 'react-icons/fi';
import Branding from '../../../../../../shared-components/Branding';
import {
  FaFilter,
  FaLock,
  FaGlobe,
  FaUsers,
  FaChevronDown,
  FaRegStar,
  FaKeyboard,
  FaAt,
  FaTimes,
  FaCheck,
  FaRobot,
  FaLink,
  FaFolder,
  FaRegFolder,
  FaCode,
  FaTerminal,
  FaBookmark,
  FaHistory,
  FaWindowRestore,
} from 'react-icons/fa';
import { BsStarFill, BsChatDots, BsGrid } from 'react-icons/bs';
import NotesIcon from '../../../../../../shared-components/icons/notesIcon';
import StackedLinkIcon from '../../../../../../shared-components/icons/stackedLinkIcon';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import { TutorialCard } from '../../../../../../welcomeGuide/TutorialCards';
import { useUIStore } from '../../../../../../shared-components/uiStateManager';
import { LuArrowRightLeft } from 'react-icons/lu';
import useNotification from '../../../../../../shared-components/notifications/useNotification';
import { getAvatarColor, getSingleInitial } from '../../../../../../shared-components/utils/avatarColors';
import clsx from 'clsx';

interface SpreadsheetToolbarProps {
  onClose?: () => void;
  onCreateOrganization?: () => void;
  onOrganizationSettings?: (orgId: string, orgName: string) => void;
  onCreateWorkspace?: () => void;
  onOpenTutorial?: () => void;
  tutorialStep: number | null;
  setTutorialStep: (step: number | null) => void;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  onBoardViewRedirect?: () => void;
}

interface FilterOption {
  type: 'space' | 'category' | 'visibility' | 'feature' | 'separator';
  id?: string;
  label?: string;
  icon?: React.ReactNode;
  activeIcon?: React.ReactNode;
}

const SpreadsheetToolbar: React.FC<SpreadsheetToolbarProps> = ({
  onClose,
  onCreateOrganization,
  onOrganizationSettings,
  onCreateWorkspace,
  onOpenTutorial,
  tutorialStep,
  setTutorialStep,
  isLoggedIn,
  onRequireLogin,
  onBoardViewRedirect,
}) => {
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
    setQuickAddModal,
  } = useSpreadsheetStore();
    const [menuOpen, setMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [isFolderSubmenuOpen, setIsFolderSubmenuOpen] = useState(false);

  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isBoardHovered, setIsBoardHovered] = useState(false);
  const [isListHovered, setIsListHovered] = useState(false);
  const [isSheetHovered, setIsSheetHovered] = useState(false);
  const [autoTriggerDropdown, setAutoTriggerDropdown] = useChromeStorage<boolean>('rtq_focus_on', true);
  const [isBoardViewEnabled, setIsBoardViewEnabled] = useState(true);

  useEffect(() => {
    chrome.storage.local.get(['new_tab_is_board_view_enabled'], (res) => {
      if (res.new_tab_is_board_view_enabled !== undefined) {
        setIsBoardViewEnabled(res.new_tab_is_board_view_enabled);
      }
    });
  }, []);

  useEffect(() => {
    if (!isViewDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isViewDropdownOpen]);

  const workspaces = useDbStore((state) => state.workspaces);
  const triggerNotification = useNotification();

  const [swapMenuOpen, setSwapMenuOpen] = useState<string | null>(null);

  // Handle Escape key to close popups without closing the background Sheet UI
  useEffect(() => {
    const anyOpen = menuOpen || createMenuOpen || !!swapMenuOpen || isViewDropdownOpen;
    if (!anyOpen) return;

    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      // Close our local menus
      setMenuOpen(false);
      setCreateMenuOpen(false);
      setSwapMenuOpen(null);
      setIsFolderSubmenuOpen(false);
      setIsViewDropdownOpen(false);
      return true;
    });

    return unregister;
  }, [menuOpen, createMenuOpen, swapMenuOpen, isViewDropdownOpen]);

  const handleToggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleClearAll = () => {
    setCategoryFilter(['all']);
    setVisibilityFilter(['all']);
    setSpaceFilter(['all']);
    setShowFavoritesOnly(false);
    setShowHotkeysOnly(false);
    setShowShortcutsOnly(false);
  };

  const filterOptions: FilterOption[] = [
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
    ...workspaces.map((ws) => ({
      type: 'space' as const,
      id: ws.id,
      label: ws.workspaceName,
      icon: (
        <div className={`w-3.5 h-3.5 rounded-full ${getAvatarColor(ws.workspaceName)} flex items-center justify-center font-bold text-[6px] text-white`}>
          {getSingleInitial(ws.workspaceName)}
        </div>
      )
    })),
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
    // Separator
    { type: 'separator' },
    // Visibility
    { type: 'visibility' as const, id: 'all', label: 'All Scopes', icon: <FaGlobe className="text-[10px]" /> },
    { type: 'visibility' as const, id: 'private', label: 'Private', icon: <FaLock className="text-[10px]" /> },
    { type: 'visibility' as const, id: 'public', label: 'Public', icon: <FaGlobe className="text-[10px]" /> },
    { type: 'visibility' as const, id: 'shared', label: 'Shared', icon: <FaUsers className="text-[10px]" /> },
    // Separator
    { type: 'separator' },
    // Features (Quick Filters)
    {
      type: 'feature' as const,
      id: 'favorites',
      label: 'Favorites',
      icon: <FaRegStar className="text-[11px]" />,
      activeIcon: <BsStarFill className="text-[11px]" />,
    },
    { type: 'feature' as const, id: 'hotkeys', label: 'Hotkeys', icon: <FaKeyboard className="text-[11px]" /> },
    { type: 'feature' as const, id: 'shortcuts', label: 'Shortcuts', icon: <FaAt className="text-[11px]" /> },
  ];

  const getActiveLabel = () => {
    const activeCategories = categoryFilter.filter((c: string) => c !== 'all');
    const activeSpaces = spaceFilter.filter((s: string) => s !== 'all');
    const activeVisibilities = visibilityFilter.filter((v: string) => v !== 'all');

    if (activeCategories.length > 0) return `${activeCategories.length} Categories`;
    if (activeSpaces.length > 0) return `${activeSpaces.length} Spaces`;
    if (activeVisibilities.length > 0) return `${activeVisibilities.length} Visibility`;

    return 'All';
  };

  const isSelected = (opt: FilterOption) => {
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

  const selectedFilters = filterOptions.filter((opt: FilterOption) => {
    if (opt.type === 'space') return !spaceFilter.includes('all') && spaceFilter.includes(opt.id!);
    if (opt.type === 'category') return !categoryFilter.includes('all') && categoryFilter.includes(opt.id!);
    if (opt.type === 'visibility') return !visibilityFilter.includes('all') && visibilityFilter.includes(opt.id!);
    if (opt.type === 'feature') {
      if (opt.id === 'favorites') return showFavoritesOnly;
      if (opt.id === 'hotkeys') return showHotkeysOnly;
      if (opt.id === 'shortcuts') return showShortcutsOnly;
    }
    return false;
  });

  const clearFilter = (opt: FilterOption) => {
    if (opt.type === 'space') setSpaceFilter(['all']);
    if (opt.type === 'category') setCategoryFilter(['all']);
    if (opt.type === 'visibility') setVisibilityFilter(['all']);
    if (opt.type === 'feature') {
      if (opt.id === 'favorites') setShowFavoritesOnly(false);
      if (opt.id === 'hotkeys') setShowHotkeysOnly(false);
      if (opt.id === 'shortcuts') setShowShortcutsOnly(false);
    }
  };

  const handleSelect = (opt: FilterOption) => {
    const toggleArray = (current: string[], id: string) => {
      if (id === 'all') return ['all'];
      const next = current.includes('all')
        ? [id]
        : current.includes(id)
          ? current.filter(x => x !== id)
          : [...current, id];
      return next.length === 0 ? ['all'] : next;
    };

    if (opt.type === 'space') {
      setSpaceFilter(toggleArray(spaceFilter, opt.id!));
    } else if (opt.type === 'category') {
      setCategoryFilter(toggleArray(categoryFilter, opt.id!));
    } else if (opt.type === 'visibility') {
      setVisibilityFilter(toggleArray(visibilityFilter, opt.id!));
    } else if (opt.type === 'feature') {
      if (opt.id === 'favorites') setShowFavoritesOnly(!showFavoritesOnly);
      if (opt.id === 'hotkeys') setShowHotkeysOnly(!showHotkeysOnly);
      if (opt.id === 'shortcuts') setShowShortcutsOnly(!showShortcutsOnly);
    }
  };

  return (
    <div className="w-auto flex items-center py-1.5 px-0 z-[100] relative text-inherit">
      <div className="flex items-center justify-end gap-3 ml-auto">
        {selectedFilters.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap max-w-[440px]">
            {selectedFilters.map((opt: FilterOption) => (
              <button
                key={`chip-${opt.type}-${opt.id}`}
                onClick={() => {
                  clearFilter(opt);
                }}
                className={clsx(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-colors bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
                )}
                title={`Remove ${opt.label}`}>
                <FaTimes className="text-[8px] text-[var(--color-iconDefault)]" />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Close Button Section */}
        {onClose && (
          <div className="flex items-center gap-1.5 ml-0.5">
            <div className="h-4 w-px bg-[var(--color-borderDefault)] mx-1 shrink-0 self-center" />
            <button
              onClick={onOpenTutorial}
              className={clsx(
                "p-1.5 rounded-md transition-colors focus:outline-none flex items-center justify-center text-neutral-500 hover:text-blue-400 hover:bg-blue-400/10"
              )}
              aria-label="Help"
              title="Open Tutorial">
              <FiHelpCircle size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 hover:text-red-400 transition-colors focus:outline-none flex items-center justify-center"
              aria-label="Close"
              title="Close">
              <FiX size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpreadsheetToolbar;
