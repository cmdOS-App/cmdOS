import React, { useState, useMemo } from 'react';
import type { SortingState, ColumnSizingState } from '@tanstack/react-table';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { useUIStore } from '../../../../../../shared-components/uiStateManager';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { getSingleInitial } from '../../../../../../shared-components/utils/avatarColors';
import type { RowData, GridRow, AutomationModuleRow } from '../types/spreadsheetTypes';
import { columns } from '../logic/spreadsheetColumnDefinitions';
import SpreadsheetHeader from './spreadsheetHeader';
import { clsx } from 'clsx';

import { useSpreadsheetStore } from '../logic/spreadsheetStateStore';
import {
  FaPlus,
  FaTrash,
  FaLock,
  FaGlobe,
  FaUsers,
  FaUser,
  FaStar,
  FaLink,
  FaFileAlt,
  FaCode,
  FaTerminal,
  FaTrashAlt,
  FaCheck,
  FaRobot,
  FaBookmark,
} from 'react-icons/fa';

import { BsPersonFill, BsPeopleFill, BsHourglassSplit } from 'react-icons/bs';
import { MdLockOutline } from 'react-icons/md';
import {
  FiStar,
  FiCheck,
  FiGlobe,
  FiFilter,
  FiExternalLink,
  FiUsers,
  FiLock,
  FiPlus,
  FiLoader,
  FiChevronRight,
  FiChevronDown,
  FiBox,
  FiZap,
  FiSearch,
  FiTrash,
  FiFileText,
  FiLayout,
  FiMonitor,
  FiLink,
  FiFolder,
} from 'react-icons/fi';
import { SiGooglechrome } from 'react-icons/si';
import { TbBrandGithub, TbWorld, TbStack2 } from 'react-icons/tb';
import { FaUserCircle } from 'react-icons/fa';

import { LuSparkles, LuPlus } from 'react-icons/lu';
import { getFaviconUrl } from '../../searchSystemComponents/searchBarMain/utilityFunctions/utils';
import { motion, AnimatePresence } from 'framer-motion';
import NotesIcon from '../../../../../../shared-components/icons/notesIcon';
import StackedLinkIcon from '../../../../../../shared-components/icons/stackedLinkIcon';
import AutomationDynamicIcon from '../../../../../../shared-components/icons/automationDynamicIcon';
import { GridHotkeyInput, GridCommandInput } from './spreadsheetShortcutInputs';
import { SpreadsheetMultiLinkInput } from './spreadsheetMultiLinkInput';
import { DestinationPicker } from '../../../../../../shared-components/editorToolbar/DestinationPicker';
import { VisualKeyDisplay } from '../../../../../../shared-components/hotkeys';

import { getItemCompoundId, readAllHotkeys, readAllShortcuts } from '../../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { BsCalendarCheck } from 'react-icons/bs';

// Helper to resolve icon strings to emojis
const resolveIcon = (iconStr: string | null | undefined, defaultEmoji: string) => {
  if (!iconStr) return defaultEmoji;
  if (iconStr.startsWith('U+')) {
    try {
      return String.fromCodePoint(parseInt(iconStr.replace('U+', ''), 16));
    } catch (e) {
      return defaultEmoji;
    }
  }
  return defaultEmoji;
};

const getWorkspaceAndFolderLocation = (workspaceId: string | null, folderId: string | null) => {
  const dbState = useDbStore.getState();
  const workspace = workspaceId ? dbState.getWorkspaceById(workspaceId) : null;
  const folder = folderId ? dbState.getFolderById(folderId) : null;

  if (!workspace) return null;
  if (folder && folder.workspaceId !== workspace.id) return null;

  const wsIcon = workspace.workspaceName.includes('Personal Space') ? 'P' : getSingleInitial(workspace.workspaceName);
  const wsPath = `${wsIcon} ${workspace.workspaceName}`;
  const isPersonalSpace = workspace.workspaceName === 'Personal Space' || workspace.workspaceName.includes('Personal Space');

  let path = wsPath;
  let folderName: string | null = null;
  let visibilityType: 'lock' | 'globe' | 'users' | 'personal' = isPersonalSpace ? 'personal' : 'lock';

  if (folder) {
    folderName = folder.folderName;
    const fIcon = resolveIcon((folder as any).icon, '📂');
    path = `${wsPath} / ${fIcon} ${folder.folderName}`;
  }

  return {
    workspace,
    workspace_id: workspace.id,
    folder_id: folder?.id || null,
    folder: folderName || workspace.workspaceName,
    path,
    plainPath: path,
    visibilityType,
  };
};

// Helper component for Buffered Editing (Save on Enter, Discard on Escape)
const BufferedCellInput = ({
  initialValue,
  onSave,
  onCancel,
  placeholder,
  isReal,
}: {
  initialValue: string;
  onSave: (val: string) => void;
  onCancel: () => void;
  placeholder?: string;
  isReal: boolean;
}) => {
  const [localValue, setLocalValue] = React.useState(initialValue);

  return (
    <div className="relative w-full h-full flex items-center px-0.5">
      <input
        autoFocus
        value={localValue}
        placeholder={placeholder}
        className="w-full h-full outline-none bg-transparent"
        onChange={e => setLocalValue(e.target.value)}
        onBlur={() => onSave(localValue)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSave(localValue);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      {!localValue && !isReal && (
        <span className="absolute right-1 text-red-500 text-[10px] font-bold pointer-events-none">*</span>
      )}
    </div>
  );
};

interface SpreadsheetTableProps {
      onClose?: () => void;
  tutorialStep: number | null;
  setTutorialStep: (step: number | null) => void;
}

const SpreadsheetTable: React.FC<SpreadsheetTableProps> = ({
      onClose,
  tutorialStep,
  setTutorialStep,
}) => {
  const {
    tableData,
    selectedCell,
    setSelectedCell,
    editingCell,
    setEditingCell,
    addRow,
    removeRow,
    updateCellData,
    isPickerOpen,
    pickerRowIndex,
    closePicker,
    updateRowLocation,
    toggleFavorite,
    categoryFilter,
    visibilityFilter,
    searchTerm,
    columnFilters,
    collapsedSections,
    toggleSection,
    showFavoritesOnly,
    showHotkeysOnly,
    showShortcutsOnly,
    targetSection,
    setTargetSection,
    setQuickAddModal,
    spaceFilter,
    expandedEmptySections,
    toggleEmptySections,
    expandedCategories,
    toggleCategory,
    undoDelete,
  } = useSpreadsheetStore();

    
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);

  const filteredData = useMemo(() => {
    const sections: { title: string; rows: GridRow[] }[] = [];
    let current: { title: string; rows: GridRow[] } | null = null;

    const hasColumnFilters = Object.values(columnFilters).some(v => v.trim() !== '');
    const isGlobalFilterActive =
      showFavoritesOnly ||
      showHotkeysOnly ||
      showShortcutsOnly ||
      hasColumnFilters ||
      searchTerm.trim() !== '' ||
      !categoryFilter.includes('all') ||
      !visibilityFilter.includes('all') ||
      !spaceFilter.includes('all');

    const filterRow = (r: GridRow) => {
      if (r.type === 'data' || r.type === 'automationModule') {
        const term = String(searchTerm || '')
          .toLowerCase()
          .trim();

        // 1. Search term match
        const matchesSearch =
          !term ||
          String(r.name || '').toLowerCase().includes(term) ||
          String(r.url || '').toLowerCase().includes(term) ||
          (Array.isArray((r as any).urls) && (r as any).urls.some((u: any) => String(u || '').toLowerCase().includes(term))) ||
          String(r.value || '').toLowerCase().includes(term) ||
          String(r.path || '').toLowerCase().includes(term) ||
          String((r as any).folder || '').toLowerCase().includes(term) ||
          String(r.key || '').toLowerCase().includes(term) ||
          String((r as any).hotkey || '').toLowerCase().includes(term) ||
          String(r.command || '').toLowerCase().includes(term) ||
          String((r as any).shortcut || '').toLowerCase().includes(term) ||
          String((r as any).description || '').toLowerCase().includes(term) ||
          String((r as any).team_name || '').toLowerCase().includes(term) ||
          String((r as any).workspace_name || '').toLowerCase().includes(term) ||
          (r.category === 'module' && String((r as any).module_id || '').toLowerCase().includes(term));

        if (!matchesSearch) return false;

        // 3. Visibility filters
        if (!visibilityFilter.includes('all')) {
          const v = r.visibilityType || 'lock';
          const mappedV =
            v === 'lock' || v === 'personal'
              ? 'private'
              : v === 'globe'
                ? 'public'
                : v === 'users'
                  ? 'shared'
                  : 'private';
          if (!visibilityFilter.includes(mappedV)) return false;
        }

        // 4. Category filters
        if (!categoryFilter.includes('all')) {
          if (!categoryFilter.includes(r.category || 'note')) return false;
        }

        // 5. Global Rail Filters
        if (showFavoritesOnly && !r.fav) return false;
        if (showHotkeysOnly && !r.key) return false;
        if (showShortcutsOnly && !r.command) return false;

        // 6. Custom Column Filters
        const columnFilterMatch = Object.entries(columnFilters).every(([colId, filterVal]) => {
          const cleanedFilter = filterVal.toLowerCase().trim();
          if (!cleanedFilter) return true;

          let val = '';
          if (colId === 'name') {
            val = String(r.name || '');
          } else if (colId === 'url') {
            const rawVal = r.url || r.value || '';
            if (typeof rawVal === 'object' && rawVal && 'urls' in rawVal) {
              val = Array.isArray((rawVal as any).urls) ? (rawVal as any).urls.join(' ') : '';
            } else {
              val = String(rawVal);
            }
          } else if (colId === 'folder' || colId === 'path') {
            val = String(r.path || '');
          } else if (colId === 'key') {
            val = String(r.key || '');
          } else if (colId === 'command') {
            val = String(r.command || '');
          }

          return val.toLowerCase().includes(cleanedFilter);
        });

        if (!columnFilterMatch) return false;

        return true;
      }

      if (r.type === 'automationCategory') {
        // Only show category if its category type (module) is allowed
        if (!categoryFilter.includes('all') && !categoryFilter.includes('module')) return false;
        // The actual visibility of category depends on if it has children, which we handle in the second pass
        return true;
      }

      return false;
    };

    // First pass: Group and filter
    tableData.forEach(row => {
      if (row.type === 'section') {
        current = { title: row.title, rows: [] };
        sections.push(current);
      } else if (current && filterRow(row)) {
        current.rows.push(row);
      }
    });

    // Reorder: Active sections first, empty sections last
    const nonEmptySections = sections.filter(s => s.rows.length > 0);
    const emptySections = sections.filter(s => s.rows.length === 0);

    const sortedSections: typeof sections = [];
    sortedSections.push(...nonEmptySections);

    // If expanded or filtering, show empty sections (ONLY if NO global filter is active)
    if (!isGlobalFilterActive && expandedEmptySections) {
      sortedSections.push(...emptySections);
    }

    // Final pass: Flatten and handle expanded categories
    const result: GridRow[] = [];

    sortedSections.forEach(s => {
      // If filtering is active, hide empty sections entirely
      if (isGlobalFilterActive && s.rows.length === 0) return;

      // Special check for automation categories: only show them if they have visible children or if no filter is active
      const processedRows: GridRow[] = [];
      if (s.title === 'Installed Modules') {
        s.rows.forEach((row, idx) => {
          if (row.type === 'automationCategory') {
            const hasVisibleChildren = s.rows.some(
              (r, i) => i > idx && r.type === 'automationModule' && r.parentId === row.id,
            );
            if (!isGlobalFilterActive || hasVisibleChildren) {
              processedRows.push(row);
            }
          } else {
            processedRows.push(row);
          }
        });
      } else {
        processedRows.push(...s.rows);
      }

      // If after processing categories, we have no rows left in this section and filter is active, skip section
      if (isGlobalFilterActive && processedRows.length === 0) return;

      result.push({ type: 'section', title: s.title, count: processedRows.length } as GridRow);

      if (!collapsedSections.includes(s.title)) {
        processedRows.forEach(row => {
          if (row.type === 'automationModule') {
            if (expandedCategories.includes(row.parentId)) {
              result.push(row);
            }
          } else {
            result.push(row);
          }
        });
      }
    });

    if (targetSection) {
      result.push({ type: 'section', title: targetSection, count: 0 } as GridRow);
    }

    // If not expanded and not filtering, add the toggle row at the very end
    if (!expandedEmptySections && !isGlobalFilterActive && emptySections.length > 0) {
      result.push({ type: 'emptySectionsToggle', count: emptySections.length });
    }

    return result;
  }, [
    tableData,
    categoryFilter,
    visibilityFilter,
    searchTerm,
    columnFilters,
    collapsedSections,
    showFavoritesOnly,
    showHotkeysOnly,
    showShortcutsOnly,
    spaceFilter,
    targetSection,
    expandedCategories,
    expandedEmptySections,
  ]);

  // Use filtered data for navigation sync
  const dataRows = useMemo(
    () =>
      filteredData.filter(
        (r): r is RowData | AutomationModuleRow => r.type === 'data' || r.type === 'automationModule',
      ),
    [filteredData],
  );

  // 🚀 Keep selection in sync when filteredData changes (e.g. section collapse)
  const lastSelectedRowIdRef = React.useRef<string | null>(null);

  // Update the ref whenever selection or data changes
  React.useEffect(() => {
    if (selectedCell !== null) {
      if (selectedCell.rowIndex === -1) {
        lastSelectedRowIdRef.current = `header-col-${selectedCell.colIndex}`;
      } else {
        const row = filteredData[selectedCell.rowIndex];
        if (row) {
          if (row.type === 'section') {
            lastSelectedRowIdRef.current = `section-${row.title}`;
          } else {
            lastSelectedRowIdRef.current = (row as any).id || (row as any).name || (row as any).command || null;
          }
        }
      }
    }
  }, [selectedCell, filteredData]);

  // Sync rowIndex if the row moved or handle if it's gone
  React.useEffect(() => {
    if (lastSelectedRowIdRef.current && selectedCell !== null) {
      const targetId = lastSelectedRowIdRef.current;
      const currentIndex = filteredData.findIndex(r => {
        if (r.type === 'section') return `section-${r.title}` === targetId;
        const rId = (r as any).id || (r as any).name || (r as any).command;
        return rId === targetId;
      });

      // Special handling for header col persistence
      if (targetId.startsWith('header-col-')) {
        const colIdx = parseInt(targetId.replace('header-col-', ''), 10);
        if (selectedCell.rowIndex !== -1 || selectedCell.colIndex !== colIdx) {
          setSelectedCell({ rowIndex: -1, colIndex: colIdx });
        }
        return;
      }

      if (currentIndex !== -1 && currentIndex !== selectedCell.rowIndex) {
        // Selection shifted (e.g. a section above was collapsed/expanded)
        setSelectedCell({ ...selectedCell, rowIndex: currentIndex });
      } else if (currentIndex === -1) {
        // Selected row is no longer in filteredData (e.g. its section was collapsed)
        // Clear selection to prevent jumping to a different row that now has the same index
        setSelectedCell(null);
      }
    }
  }, [filteredData]);

  // Determine the active section (hovered or selected)
  const activeSectionTitle = useMemo(() => {
    if (hoveredSection) return hoveredSection;
    if (selectedCell !== null) {
      const row = filteredData[selectedCell.rowIndex];
      if (row) {
        return (row as any).title || (row as any).section;
      }
    }
    return null;
  }, [hoveredSection, selectedCell, filteredData]);

  const table = useReactTable({
    data: dataRows,
    columns,
    state: {
      columnSizing,
      sorting,
    },
    onColumnSizingChange: setColumnSizing,
    onSortingChange: setSorting,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // 🚀 Auto-scroll selection into view
  React.useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    if (selectedCell !== null) {
      // Small timeout to ensure DOM elements with data-row-index are rendered
      timer = setTimeout(() => {
        const rowElement = document.querySelector(`[data-row-index="${selectedCell.rowIndex}"]`);
        if (rowElement) {
          rowElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 50);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [selectedCell?.rowIndex]);

  // 🚀 Asynchronous navigation to target section (Deep Linking)
  React.useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    if (targetSection && filteredData.length > 0) {
      const index = filteredData.findIndex(r => r.type === 'section' && r.title === targetSection);
      if (index !== -1) {
        // We set to null briefly to ensure selecting the same index re-triggers scroll
        setSelectedCell(null);
        timer = setTimeout(() => {
          setSelectedCell({ rowIndex: index, colIndex: 0 });
          setTargetSection(null);
        }, 100);
      } else {
        setTargetSection(null);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [filteredData, targetSection, setSelectedCell, setTargetSection]);

  // 🚀 Auto-select first data record when data loads or search updates, keeping focus on search bar
  React.useEffect(() => {
    if (selectedCell === null && filteredData.length > 0) {
      const firstIndex = filteredData.findIndex(r => r.type === 'data' || r.type === 'automationModule');
      if (firstIndex !== -1) {
        setSelectedCell({ rowIndex: firstIndex, colIndex: 0 });
      }
    }
  }, [filteredData, selectedCell, setSelectedCell]);

  // 🚀 Synchronized Keyboard Navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useSpreadsheetStore.getState();
      const {
        selectedCell,
        setSelectedCell,
        editingCell,
        setEditingCell,
        columnCount,
        addRow,
        openPicker,
        isPickerOpen,
      } = state;

      const target = e.target as HTMLElement;
      const isSearchInput = target.tagName === 'INPUT' && (target as HTMLInputElement).id?.startsWith('sheet-search-');

      // 🚀 1. ESCAPE -> Cancel edit mode OR Close Sheet
      // Handle this at the very top to ensure it's never blocked
      if (e.key === 'Escape') {
        const isEditing = editingCell !== null;
        if (isEditing) {
          e.preventDefault();
          e.stopPropagation();
          setEditingCell(null);
          const mainSearch = document.getElementById('sheet-search-name');
          if (mainSearch) mainSearch.focus();
          return;
        }

        if (isPickerOpen) {
          e.preventDefault();
          e.stopPropagation();
          closePicker();
          return;
        }

        if (isSearchInput) {
          e.preventDefault();
          e.stopPropagation();
          onClose?.();
          return;
        }

        // If nothing else is active, close the sheet
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.defaultPrevented) return;

      // 🚀 2. Alt + A -> Focus first data row AND Name Search
      // Handle this early so it works even if no cell is selected
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        e.stopPropagation();

        const firstDataIndex = filteredData.findIndex(r => r.type === 'data' || r.type === 'automationModule');

        if (firstDataIndex !== -1) {
          setSelectedCell({ rowIndex: firstDataIndex, colIndex: 0 });
        }
        const nameSearch = document.getElementById('sheet-search-name');
        if (nameSearch) {
          (nameSearch as HTMLInputElement).focus();
          (nameSearch as HTMLInputElement).select();
        }
        return;
      }

      const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

      // 🚀 3. Handle initial navigation from Search Bar if nothing is selected
      if (isSearchInput && !selectedCell && (e.key === 'ArrowDown' || e.key === 'Tab')) {
        if (filteredData.length > 0) {
          e.preventDefault();
          setSelectedCell({ rowIndex: 0, colIndex: 0 });
          return;
        }
      }

      if (!selectedCell || isPickerOpen) return;

      const { rowIndex, colIndex } = selectedCell;
      const isEditing = editingCell !== null;

      const currentRow = filteredData[rowIndex];
      if (!currentRow) return;

      // 🚀 2. Restrict non-navigation keys when focused in an input (except search)
      if (
        !isSearchInput && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[data-ignore-grid-nav="true"]')
        )
      ) {
        return;
      }

      // If it IS a search input, only allow specific navigation keys to pass through
      const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'].includes(e.key);
      if (isSearchInput && !isNavKey) {
        return;
      }

      // 🚀 ESCAPE -> Cancel edit mode OR Close Sheet
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isEditing) {
          setEditingCell(null);
          const mainSearch = document.getElementById('sheet-search-name');
          if (mainSearch) mainSearch.focus();
        } else if (isSearchInput) {
          (target as HTMLInputElement).blur();
        } else {
          onClose?.();
        }
        return;
      }

      // Standard spreadsheet: arrows move cursor in input.
      if (isEditing && e.key !== 'Enter' && e.key !== 'Tab') {
        return;
      }

      // 🚀 ENTER -> Edit, Add Row, Open Picker, or Toggle Favorite
      if (e.key === 'Enter') {
        e.preventDefault();

        const isBookmark = (currentRow as any).category === 'bookmark';
        const isCommand = (currentRow as any).category === 'commands' || (currentRow as any).category === 'general_commands';

        if (isBookmark) {
          if (colIndex === 2) {
            useSpreadsheetStore.getState().removeRow((currentRow as any).id);
            return;
          }
          const dataRow = currentRow as RowData;
          if (dataRow.url) {
            window.open(dataRow.url, '_blank');
          }
          return;
        }

        if (isCommand) {
          const cmdId = String((currentRow as any).id || '').replace(/^cmd-/, '');
          if (cmdId) {
            useUIStore.getState().setPendingLockedCommand({ commandId: cmdId, mode: 'lock' });
          } else {
            onClose?.();
          }
          return;
        }

        // 0. If on Folder column (index 6) -> Trigger Picker
        if (colIndex === 6 && (currentRow?.type === 'data' || currentRow?.type === 'automationModule')) {
          const isBookmark =
            (currentRow as any).category === 'bookmark' || (currentRow as any).section === 'Bookmarks';
          const isBrowserCommand =
            (currentRow as any).category === 'commands' ||
            (currentRow as any).category === 'general_commands' ||
            (currentRow as any).section === 'Browser Commands';
          const isInstalledModule =
            (currentRow as any).category === 'module' || (currentRow as any).section === 'Installed Modules';

          if (!(isBookmark || isBrowserCommand || isInstalledModule)) {
            openPicker(currentRow.id);
          }
          return;
        }

        // 1. If on Favorite column (index 3) -> Toggle Favorite
        if (colIndex === 3 && (currentRow?.type === 'data' || currentRow?.type === 'automationModule')) {
          state.toggleFavorite(currentRow.id);
          return;
        }

        // 2. If on an "Add Row" button
        if (currentRow?.type === 'add_row') {
          addRow(currentRow.section);
          setEditingCell({ rowIndex: rowIndex, colIndex: 0 });
          return;
        }

        if (currentRow?.type === 'section') {
          toggleSection(currentRow.title);
          return;
        }
        if (currentRow?.type === 'automationCategory') {
          toggleCategory(currentRow.id);
          return;
        }
        if (currentRow?.type === 'emptySectionsToggle') {
          toggleEmptySections();
          return;
        }

        // 4. If on Delete column (index 2) -> Remove Row
        if (colIndex === 2 && (currentRow?.type === 'data' || currentRow?.type === 'automationModule')) {
          const isSpecial =
            currentRow.section === 'Installed Modules' ||
            (currentRow as any).category === 'commands' ||
            (currentRow as any).category === 'general_commands';

          if (!isSpecial) {
            useSpreadsheetStore.getState().removeRow(currentRow.id);
          }
          return;
        }

        // 5. Default Enter behavior
        if (!isEditing) {
          const isModule =
            (currentRow as any).category === 'module' || (currentRow as any).section === 'Installed Modules';
          const isAgent = (currentRow as any).category === 'agent' || (currentRow as any).section === 'Chat Agents';
          const isBookmark =
            (currentRow as any).category === 'bookmark' || (currentRow as any).section === 'Bookmarks';
          const isBrowserCommand =
            (currentRow as any).category === 'commands' ||
            (currentRow as any).category === 'general_commands' ||
            (currentRow as any).section === 'Browser Commands';
          const isInstalledModule =
            (currentRow as any).category === 'module' || (currentRow as any).section === 'Installed Modules';
          const isAutomation =
            (currentRow as any).category === 'automation' ||
            currentRow?.section === 'My Saved Automations' ||
            currentRow?.section === 'Automation Store' ||
            (currentRow as any).type === 'automationModule';

          const isCellBlocked =
            (colIndex === 0 && (isBookmark || isBrowserCommand || isInstalledModule)) ||
            (colIndex === 1 && (isBookmark || isBrowserCommand)) ||
            isAutomation;

          const isReadonlyCol = isModule
            ? colIndex === 0 || colIndex === 2 || colIndex === 6
            : colIndex === 0 || colIndex === 1 || colIndex === 2 || colIndex === 6;

          if (!isCellBlocked && !(isModule && isReadonlyCol) && !(isAgent && (colIndex === 0 || colIndex === 2 || colIndex === 6))) {
            setEditingCell(selectedCell);
          }
        } else if (isEditing) {
          setEditingCell(null);
          const mainSearch = document.getElementById('sheet-search-name');
          if (mainSearch) mainSearch.focus();
          const nextRow = rowIndex + 1;
          // In filtered data, if it exists, it is navigable
          if (nextRow < filteredData.length) {
            setSelectedCell({ rowIndex: nextRow, colIndex });
          }
        }
        return;
      }

      // 🚀 TAB & ARROWS -> Move Navigation
      const moveFocus = (rInc: number, cInc: number) => {
        const nRow = rowIndex + rInc;
        let nCol = colIndex + cInc;

        if (nRow >= 0 && nRow < filteredData.length) {
          if (nCol < 0) nCol = 0;
          if (nCol >= columnCount) nCol = columnCount - 1;
          setSelectedCell({ rowIndex: nRow, colIndex: nCol });
        }
      };

      if (isArrowKey) {
        if (isEditing) return;
        e.preventDefault();
      }

      if (e.key === 'ArrowUp') {
        if (rowIndex > 0) {
          moveFocus(-1, 0);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        moveFocus(1, 0);
        return;
      }
      if (e.key === 'ArrowLeft') {
        moveFocus(0, -1);
        return;
      }
      if (e.key === 'ArrowRight') {
        moveFocus(0, 1);
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (isEditing) setEditingCell(null);
        let nRow = rowIndex;
        let nCol = colIndex + (e.shiftKey ? -1 : 1);

        if (nCol >= columnCount) {
          nCol = 0;
          nRow++;
        } else if (nCol < 0) {
          nCol = columnCount - 1;
          nRow--;
        }

        if (nRow >= 0 && nRow < filteredData.length) {
          setSelectedCell({ rowIndex: nRow, colIndex: nCol });
        }
        return;
      }

      // Quick Type-to-Edit
      if (
        !isEditing &&
        (currentRow?.type === 'data' || currentRow?.type === 'automationModule') &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const isModule =
          (currentRow as any).category === 'module' || (currentRow as any).section === 'Installed Modules';
        const isAgent = (currentRow as any).category === 'agent' || (currentRow as any).section === 'Chat Agents';
        const isBookmark =
          (currentRow as any).category === 'bookmark' || (currentRow as any).section === 'Bookmarks';
        const isBrowserCommand =
          (currentRow as any).category === 'commands' ||
          (currentRow as any).category === 'general_commands' ||
          (currentRow as any).section === 'Browser Commands';
        const isInstalledModule =
          (currentRow as any).category === 'module' || (currentRow as any).section === 'Installed Modules';
        const isAutomation =
          (currentRow as any).category === 'automation' ||
          currentRow?.section === 'My Saved Automations' ||
          currentRow?.section === 'Automation Store' ||
          (currentRow as any).type === 'automationModule';

        const isCellBlocked =
          (colIndex === 0 && (isBookmark || isBrowserCommand || isInstalledModule)) ||
          (colIndex === 1 && (isBookmark || isBrowserCommand)) ||
          isAutomation;

        const isReadonlyCol = colIndex === 0 || colIndex === 1 || colIndex === 2 || colIndex === 6;
        const isAgentReadonlyCol = colIndex === 1; // Only Description for agents

        if (!isCellBlocked && !(isModule && isReadonlyCol) && !(isAgent && isAgentReadonlyCol) && !isBookmark) {
          setEditingCell(selectedCell);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredData, selectedCell, editingCell, setSelectedCell, setEditingCell, toggleSection, onClose]);

  const handleAddRow = async (section: string, visualIndex: number) => {
    const storageKey = section === 'Smart Links' ? 'lastLinkDestination' : 'lastNoteDestination';
    let initialLocation: Record<string, any> = {};
    const workspaces = useDbStore.getState().workspaces || [];
    if (workspaces.length > 0) {
      const result: any = await new Promise(res => chrome.storage.local.get(storageKey, res));
      const lastDest = result[storageKey];

      if (lastDest) {
        const lastLocation = getWorkspaceAndFolderLocation(lastDest.workspace_id || null, lastDest.folder_id || null);
        if (lastLocation) {
          initialLocation = lastLocation;
        }
      }

      if (Object.keys(initialLocation).length === 0 && workspaces.length > 0) {
        const firstWorkspace = workspaces[0];
        const fallbackLocation = getWorkspaceAndFolderLocation(firstWorkspace.id, null);
        if (fallbackLocation) {
          initialLocation = fallbackLocation;
        }
      }
    }

    addRow(section, initialLocation);
    // Expand the section if it was collapsed so the user can see the new row
    if (collapsedSections.includes(section)) {
      toggleSection(section);
    }
    // Select the newly added row (which is at visualIndex + 1 since addRow inserts at top)
    setTimeout(() => {
      setSelectedCell({ rowIndex: visualIndex + 1, colIndex: 0 });
      setEditingCell({ rowIndex: visualIndex + 1, colIndex: 0 });
    }, 50);
  };

  let dataIndex = 0;

  const sectionGroups: { key: string; items: { row: any; visualIndex: number }[] }[] = [];
  let currentGroup: { key: string; items: { row: any; visualIndex: number }[] } | null = null;

  filteredData.forEach((row, visualIndex) => {
    if (row.type === 'section') {
      currentGroup = { key: `section-${row.title}-${visualIndex}`, items: [] };
      sectionGroups.push(currentGroup);
    }
    if (!currentGroup) {
      currentGroup = { key: `default-${visualIndex}`, items: [] };
      sectionGroups.push(currentGroup);
    }
    currentGroup.items.push({ row, visualIndex });
  });

  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full">
        <table className={clsx('w-full border-collapse table-fixed', 'bg-transparent')}>
          <SpreadsheetHeader
            table={table}
            tutorialStep={tutorialStep}
            setTutorialStep={setTutorialStep}
            
          />
          {sectionGroups.map(group => (
            <tbody key={group.key} className="bg-transparent">
              {group.items.map(({ row, visualIndex }) => {
                if (row.type === 'section') {
                  const getIcon = (title: string) => {
                    switch (title) {
                      case 'Smart Links':
                        return (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                          </svg>
                        );
                      case 'Notes':
                        return (
                          <svg width="18" height="18" viewBox="0 0 24 24">
                            <rect x="2.5" y="3" width="19" height="18" rx="3.2" fill="#2B2B2B" />
                            <rect x="3.5" y="4" width="17" height="16" rx="2.8" fill="#FFFFFF" />
                            <rect x="3.5" y="18.4" width="17" height="1.6" rx="0.8" fill="#FFD84D" />
                            <path
                              d="M7 8.6 H17 M7 10.8 H16 M7 13 H15 M7 15.2 H14 M7 17.4 H13"
                              stroke="#BDBDBD"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                            />
                            <path d="M14.5 20 C17.6 18.1 19.2 16.6 20.8 14.5 L20.8 20 Z" fill="#E6C98A" />
                            <path d="M15.2 20 C17.4 18.4 18.6 17.2 20.4 15.2 L20.4 20 Z" fill="#E0E0E0" />
                            <path d="M16 20 C17.8 18.7 18.8 17.8 20 16 L20 20 Z" fill="#FFFFFF" />
                            <path
                              d="M7 4 C7 2.6 9 2.6 9 4 V5.6 C9 7 7 7 7 5.6 Z"
                              fill="#FFD84D"
                              stroke="#3A3A3A"
                              strokeWidth="0.9"
                            />
                            <path
                              d="M11 4 C11 2.6 13 2.6 13 4 V5.6 C13 7 11 7 11 5.6 Z"
                              fill="#FFD84D"
                              stroke="#3A3A3A"
                              strokeWidth="0.9"
                            />
                            <path
                              d="M15 4 C15 2.6 17 2.6 17 4 V5.6 C17 7 15 7 15 5.6 Z"
                              fill="#FFD84D"
                              stroke="#3A3A3A"
                              strokeWidth="0.9"
                            />
                          </svg>
                        );
                      case 'Saved Automations':
                        return <FiZap className="h-4 w-4 text-amber-500" />;
                      case 'Chat Agents':
                        return (
                          <StackedLinkIcon
                            urls={['chatgpt.com', 'gemini.google.com', 'claude.ai', 'perplexity.ai']}
                            size={14}
                            maxIcons={4}
                          />
                        );
                      case 'Installed Modules':
                        return <FaRobot className="h-4 w-4 text-purple-500" />;
                      case 'Bookmarks':
                        return <FaBookmark className="h-4 w-4 text-blue-500" />;
                      case 'Browser Commands':
                        return <FaTerminal className="h-4 w-4 text-[var(--color-iconDefault)]" />;
                      case 'Snippets':
                        return <FaCode className="h-4 w-4 text-emerald-500" />;
                      default:
                        return null;
                    }
                  };

                  const isSelectedSection = selectedCell?.rowIndex === visualIndex;
                  const isCollapsed = collapsedSections.includes(row.title);

                  return (
                    <tr
                      key={`section-${row.title}-${visualIndex}`}
                      data-row-index={visualIndex}
                      onClick={() => {
                        setSelectedCell({ rowIndex: visualIndex, colIndex: 0 });
                        toggleSection(row.title);
                      }}
                      onMouseEnter={() => setHoveredSection(row.title)}
                      onMouseLeave={() => setHoveredSection(null)}
                      className="cursor-pointer relative group/section-row select-none">
                      <td
                        colSpan={table.getAllLeafColumns().length}
                        className="p-0 text-sm font-normal tracking-tight bg-[var(--color-sheetBg)] z-[50]">
                        <div className="flex items-center -ml-6 relative pr-0 gap-1 bg-transparent">
                          <div
                            className={clsx(
                              'p-1 rounded-md transition-all duration-200 cursor-pointer w-5 h-5 flex items-center justify-center shrink-0 z-20 bg-transparent hover:bg-white/10 text-neutral-400',
                              isSelectedSection ? 'opacity-100' : 'opacity-0 group-hover/section-row:opacity-100',
                            )}
                            onClick={e => {
                              e.stopPropagation();
                              toggleSection(row.title);
                            }}>
                            {isCollapsed ? (
                              <FiChevronRight size={14} />
                            ) : (
                              <FiChevronDown size={14} />
                            )}
                          </div>

                          {/* Title Container (Gradient Box) */}
                          <div className={clsx(
                            "flex items-center flex-1 pl-2 pr-3 py-1 rounded-none transition-colors relative shadow-sm bg-gradient-to-r from-white/10 to-transparent text-white border-b border-white/5",
                            isSelectedSection ? 'ring-1 ring-white/20 ring-inset z-10' : ''
                          )}>
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-[var(--color-iconDefault)]">{getIcon(row.title)}</span>
                              <span className="flex items-center">
                                {row.title}
                                <span className="ml-2 text-[10px] font-bold text-neutral-400">
                                  {
                                    tableData.filter(
                                      r =>
                                        (r.type === 'data' ||
                                          r.type === 'automationCategory' ||
                                          r.type === 'automationModule') &&
                                        r.section === row.title,
                                    ).length
                                  }
                                </span>

                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'automationCategory') {
                  const isSelected = selectedCell?.rowIndex === visualIndex;
                  const isExpanded = useSpreadsheetStore.getState().expandedCategories.includes(row.id);

                  return (
                    <tr
                      key={`cat-${row.id}-${visualIndex}`}
                      data-row-index={visualIndex}
                      onClick={() => {
                        setSelectedCell({ rowIndex: visualIndex, colIndex: 0 });
                      }}
                      onDoubleClick={() => toggleCategory(row.id)}
                      onMouseEnter={() => setHoveredRowIndex(visualIndex)}
                      onMouseLeave={() => setHoveredRowIndex(null)}
                      className={clsx(
                        'cursor-pointer relative select-none transition-all duration-200 group',
                        isExpanded
                          ? 'bg-white/5 border-b border-white/5'
                          : 'bg-transparent border-b border-white/5 hover:bg-white/5',
                        isSelected ? 'ring-1 ring-white/60 ring-inset z-10' : '',
                      )}>
                      <td
                        colSpan={table.getAllLeafColumns().length}
                        className="pl-1 pr-0 py-1.5 border-white/10">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1">
                            <div
                              className={clsx(
                                'p-1 rounded-md transition-all duration-200 cursor-pointer w-5 h-5 flex items-center justify-center shrink-0 hover:bg-white/10',
                                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                              )}
                              onClick={e => {
                                e.stopPropagation();
                                toggleCategory(row.id);
                              }}>
                              {isExpanded ? (
                                <FiChevronDown className="text-[var(--color-iconDefault)]" size={14} />
                              ) : (
                                <FiChevronRight className="text-[var(--color-iconDefault)]" size={14} />
                              )}
                            </div>

                            {/* Icon & Name */}
                            <div className="flex items-center gap-2">
                              {row.iconHost ? (
                                <img
                                  src={getFaviconUrl(row.iconHost)}
                                  alt=""
                                  className="w-4 h-4 object-contain rounded-sm transition-all"
                                />
                              ) : (
                                <FiBox className="text-[var(--color-iconDefault)]" size={14} />
                              )}
                              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white">
                                {row.name}
                                <span className="ml-2 text-[10px] font-bold text-neutral-400">
                                  {row.moduleCount}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'emptySectionsToggle') {
                  const isSelected = selectedCell?.rowIndex === visualIndex;

                  return (
                    <tr
                      key="empty-sections-toggle"
                      data-row-index={visualIndex}
                      onClick={() => {
                        setSelectedCell({ rowIndex: visualIndex, colIndex: 0 });
                        toggleEmptySections();
                      }}
                      onMouseEnter={() => setHoveredRowIndex(visualIndex)}
                      onMouseLeave={() => setHoveredRowIndex(null)}
                      className="cursor-pointer select-none transition-colors bg-transparent hover:bg-white/5">
                      <td colSpan={table.getAllLeafColumns().length} className="pl-3 pr-0 py-1.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
                          <FiChevronRight size={11} className="text-[var(--color-iconDefault)]" />
                          Show {row.count} more sections
                        </span>
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'add_row') return null;

                // Normal data row
                const tableRow = table.getRowModel().rows[dataIndex++];
                if (!tableRow) return null;

                return (
                  <tr
                    key={tableRow.id}
                    data-row-index={visualIndex}
                    onMouseEnter={() => setHoveredSection(tableRow.original.section)}
                    onMouseLeave={() => setHoveredSection(null)}
                    className={clsx(
                      'group/row grow h-auto min-h-[44px] transition-all duration-300',
                      (tableRow.original as any).isDeleting
                        ? 'bg-red-900/20'
                        : 'bg-transparent hover:bg-white/5',
                    )}>
                    {tableRow.getVisibleCells().map((cell, index) => {
                      const isSelected = selectedCell?.rowIndex === visualIndex && selectedCell?.colIndex === index;
                      const isSelectedRow = selectedCell?.rowIndex === visualIndex;

                      const isEditing = editingCell?.rowIndex === visualIndex && editingCell?.colIndex === index;

                      const value = cell.getValue() as string;

                      return (
                        <td
                          key={cell.id}
                          onClick={() => {
                            setSelectedCell({ rowIndex: visualIndex, colIndex: index });
                            if (isSelected && !isEditing) {
                              const row = tableRow.original as any;
                              const isModule = row.category === 'module' || row.section === 'Installed Modules';
                              const isAgent = row.category === 'agent' || row.section === 'Chat Agents';
                              const isBookmark =
                                row.category === 'bookmark' || row.section === 'Bookmarks';
                              const isBrowserCommand =
                                row.category === 'commands' ||
                                row.category === 'general_commands' ||
                                row.section === 'Browser Commands';
                              const isInstalledModule =
                                row.category === 'module' || row.section === 'Installed Modules';
                              const isAutomation =
                                row.category === 'automation' ||
                                row.section === 'My Saved Automations' ||
                                row.section === 'Automation Store' ||
                                row.type === 'automationModule';

                              const isCellBlocked =
                                (index === 0 && (isBookmark || isBrowserCommand || isInstalledModule)) ||
                                (index === 1 && (isBookmark || isBrowserCommand)) ||
                                isAutomation;

                              // For modules and agents, the 2nd column (index 1) is now editable
                              const isReadonlyCol = isModule
                                ? index === 0 || index === 2
                                : index === 0 || index === 1 || index === 2;
                              const isAgentReadonlyCol = index === 1;

                              if (!isCellBlocked && !(isModule && isReadonlyCol) && !(isAgent && (index === 0 || index === 2))) {
                                setEditingCell({ rowIndex: visualIndex, colIndex: index });
                              }
                            }
                          }}
                          className={clsx(
                            'text-[11px] cursor-pointer transition-all relative border-none',
                            cell.column.id === 'id'
                              ? 'p-0 text-center align-middle'
                              : index === 4 || index === 5
                                ? 'px-1'
                                : cell.column.id === 'url' && isSelected
                                  ? 'px-[2px]'
                                  : 'px-2 py-1',
                            isSelected
                              ? 'text-white ring-1 ring-white/30 ring-inset rounded bg-white/5 z-[50] overflow-visible py-[2px]'
                              : 'text-white py-[1.5px]',
                            (tableRow.original as any).isDeleting && (cell.column.id !== 'id' ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'),
                          )}
                          style={{ width: cell.column.getSize() }}>
                          {cell.column.id === 'id' ? (
                            (tableRow.original as any).isDeleting ? (
                              <div className="flex items-center justify-center w-full h-full">
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    undoDelete(tableRow.original.id);
                                  }}
                                  className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black rounded transition-all hover:bg-red-700 active:scale-90 animate-pulse">
                                  UNDO
                                </button>
                              </div>
                            ) : tableRow.original.section !== 'Installed Modules' ? (
                              <div className="flex items-center justify-center w-full h-full min-h-[28px]">
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    useSpreadsheetStore.getState().removeRow(tableRow.original.id);
                                  }}
                                  className={clsx(
                                    'flex items-center justify-center w-7 h-7 rounded hover:text-red-500 transition-all',
                                    isSelectedRow ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
                                  )}>
                                  <FiTrash size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="p-1 h-6 w-6 opacity-0 pointer-events-none" aria-hidden="true" />
                            )
                          ) : isEditing ? (
                            index === 3 ? (
                              tableRow.original.section === 'Bookmarks' ? null : (
                                <div className="flex justify-center w-full">
                                  <button
                                    className="transition-colors"
                                    onClick={e => {
                                      e.stopPropagation();
                                      toggleFavorite(tableRow.original.id as string);
                                    }}>
                                    {tableRow.original.syncStatus === 'syncing' ? (
                                      <FiLoader className="animate-spin text-[var(--color-iconDefault)] text-xs" />
                                    ) : tableRow.original.fav ? (
                                      <FaStar className="text-amber-400 text-xs" />
                                    ) : (
                                      <FiStar className="text-[var(--color-iconDefault)] text-xs hover:opacity-80" />
                                    )}
                                  </button>
                                </div>
                              )
                            ) : index === 4 ? (
                              <GridHotkeyInput
                                itemId={tableRow.original.id}
                                initialValue={value || ''}
                                onSave={val => {
                                  updateCellData(tableRow.original.id, index, cell.column.id, val);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                                onOverwrite={(val, conflictId) => {
                                  useSpreadsheetStore
                                    .getState()
                                    .overwriteCellData(
                                      tableRow.original.id,
                                      index,
                                      cell.column.id,
                                      val,
                                      conflictId,
                                    );
                                  setEditingCell(null);
                                }}
                              />
                            ) : index === 5 ? (
                              <GridCommandInput
                                itemId={getItemCompoundId(tableRow.original)}
                                initialValue={value || ''}
                                onSave={val => {
                                  updateCellData(tableRow.original.id, index, cell.column.id, val);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                                onOverwrite={(val, conflictId) => {
                                  useSpreadsheetStore
                                    .getState()
                                    .overwriteCellData(
                                      tableRow.original.id,
                                      index,
                                      cell.column.id,
                                      val,
                                      conflictId,
                                    );
                                  setEditingCell(null);
                                }}
                              />
                            ) : index === 1 ? (
                              (() => {
                                const isAutomation =
                                  !!tableRow.original.automationData ||
                                  tableRow.original.section === 'My Saved Automations' ||
                                  tableRow.original.section === 'Chat Agents' ||
                                  tableRow.original.category === 'automation' ||
                                  tableRow.original.category === 'agent' ||
                                  (tableRow.original.itemType === 'agent' && !!tableRow.original.automationData);

                                if (isAutomation) {
                                  const steps =
                                    tableRow.original.automationData?.steps ||
                                    tableRow.original.automationData?.automation_steps ||
                                    tableRow.original.automationData?.execution_steps ||
                                    [];

                                  const getStepName = (mId: any) => {
                                    const id = String(mId || '');
                                    switch (id) {
                                      case 'open_tab':
                                      case 'open_url':
                                        return 'Open Link';
                                      case 'paste':
                                      case 'insert_text':
                                        return 'Fill Input';
                                      case 'wait':
                                      case 'wait_duration':
                                      case 'wait_for_navigation':
                                      case 'wait_for_element':
                                        return 'Wait';
                                      case 'clipboard_write':
                                        return 'Write Clipboard';
                                      case 'clipboard_paste':
                                        return 'Paste Clipboard';
                                      case 'agent':
                                        return 'Agent Step';
                                      case 'sub_automation':
                                        return 'Sub-Automation';
                                      default:
                                        return null;
                                    }
                                  };

                                  const stepNames = steps
                                    .map((s: any) => getStepName(s.moduleId || s.module_id || s.action))
                                    .filter(Boolean);

                                  const visibleSteps = stepNames.slice(0, 25).join(', ');
                                  const moreCount = stepNames.length - 25;

                                  return (
                                    <div className="flex items-center w-full text-[10px] overflow-hidden font-normal text-neutral-400">
                                      <span className="truncate flex-1">{visibleSteps || "No steps set"}</span>
                                      {moreCount > 0 && (
                                        <span className="ml-1 text-[9px] font-normal shrink-0 px-1.5 rounded whitespace-nowrap text-neutral-400 bg-neutral-800">
                                          +{moreCount} more
                                        </span>
                                      )}
                                    </div>
                                  );
                                }

                                if (
                                  tableRow.original.section === 'Notes' ||
                                  tableRow.original.section === 'Snippets'
                                ) {
                                  return (
                                    <BufferedCellInput
                                      initialValue={String(tableRow.original.value || '')
                                        .replace(/<[^>]*>?/gm, '')
                                        .replace(/&nbsp;/g, ' ')
                                        .trim()}
                                      placeholder="Enter description"
                                      isReal={!!tableRow.original.isReal}
                                      onSave={val => {
                                        updateCellData(
                                          tableRow.original.id,
                                          index,
                                          cell.column.id,
                                          val,
                                        );
                                        setEditingCell(null);
                                      }}
                                      onCancel={() => setEditingCell(null)}
                                    />
                                  );
                                }

                                return (
                                  <SpreadsheetMultiLinkInput
                                    initialUrls={tableRow.original.urls || []}
                                    onSave={val => {
                                      updateCellData(
                                        tableRow.original.id,
                                        index,
                                        cell.column.id,
                                        val,
                                      );
                                      setEditingCell(null);
                                    }}
                                    onCancel={() => setEditingCell(null)}
                                  />
                                );
                              })()
                            ) : (
                              <BufferedCellInput
                                initialValue={value || ''}
                                placeholder="Enter the title"
                                isReal={!!tableRow.original.isReal}
                                onSave={val => {
                                  updateCellData(tableRow.original.id, index, cell.column.id, val);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            )
                          ) : (
                            <div className={clsx('max-w-full flex items-center gap-2', 'truncate whitespace-nowrap')}>
                              {cell.column.id === 'fav' ? (
                                tableRow.original.section === 'Bookmarks' ? null : (
                                  <div className="flex justify-center w-full">
                                    <button
                                      className="transition-colors"
                                      onClick={e => {
                                        e.stopPropagation();
                                        toggleFavorite(tableRow.original.id as string);
                                      }}>
                                      {tableRow.original.syncStatus === 'syncing' ? (
                                        <FiLoader className="animate-spin text-[var(--color-iconDefault)] text-xs" />
                                      ) : tableRow.original.fav ? (
                                        <FaStar className="text-amber-400 text-xs" />
                                      ) : (
                                        <FiStar className="text-[var(--color-iconDefault)] text-xs hover:opacity-80" />
                                      )}
                                    </button>
                                  </div>
                                )
                              ) : (cell.column.id === 'folder' || cell.column.id === 'folder_id') &&
                                (tableRow.original.section === 'My Saved Automations' ||
                                  tableRow.original.section === 'Chat Agents') ? (
                                <div className="flex items-center justify-between gap-1 w-full h-full px-2 overflow-hidden">
                                  {tableRow.original.path && (
                                    <>
                                      <div className="truncate flex-1 min-w-0">
                                        <span
                                          className={clsx(
                                            'truncate whitespace-nowrap transition-all duration-200 text-white',
                                            isSelectedRow ? 'hidden' : 'group-hover/row:hidden'
                                          )}>
                                          {tableRow.original.plainPath || tableRow.original.path}
                                        </span>
                                        <span
                                          className={clsx(
                                            'truncate whitespace-nowrap transition-all duration-200 text-white',
                                            isSelectedRow ? 'inline' : 'hidden group-hover/row:inline'
                                          )}>
                                          {tableRow.original.path}
                                        </span>
                                      </div>
                                      <span
                                        className={clsx(
                                          'shrink-0 ml-1.5 flex items-center transition-opacity duration-200',
                                          isSelectedRow ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
                                        )}>
                                        {tableRow.original.visibilityType === 'lock' && (
                                          <MdLockOutline size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                        {tableRow.original.visibilityType === 'globe' && (
                                          <FiGlobe size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                        {tableRow.original.visibilityType === 'users' && (
                                          <BsPeopleFill size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                        {tableRow.original.visibilityType === 'personal' && (
                                          <BsPersonFill size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                      </span>
                                    </>
                                  )}
                                </div>
                              ) : (cell.column.id === 'folder' || cell.column.id === 'folder_id') &&
                                tableRow.original.section === 'Installed Modules' ? (
                                <div className="flex items-center justify-between gap-1 w-full h-full px-2 overflow-hidden">
                                  <span className="truncate whitespace-nowrap flex-1 min-w-0 text-white">Installed</span>
                                  <span
                                    className={clsx(
                                      'shrink-0 ml-1.5 flex items-center transition-opacity duration-200',
                                      isSelectedRow ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
                                    )}>
                                    <BsPersonFill size={11} className="text-[var(--color-iconDefault)]" />
                                  </span>
                                </div>
                              ) : cell.column.id === 'name' ? (
                                <div
                                  className={clsx(
                                    'flex items-center gap-2 truncate max-w-full pl-6',
                                    tableRow.original.type === 'automationModule' && 'ml-8',
                                  )}>
                                  {(() => {
                                    const rowItem = tableRow.original;
                                    const isLink = rowItem.itemType === 'link' || rowItem.category === 'bookmark';

                                    return (
                                      <>
                                        {isLink && rowItem.category !== 'commands' && rowItem.category !== 'general_commands' && (
                                          <StackedLinkIcon
                                            urls={rowItem.urls || []}
                                            size={14}
                                            fallback={
                                              rowItem.category === 'bookmark'
                                                ? 'link'
                                                : (rowItem.category || '').toLowerCase() === 'tabgroup' ||
                                                  (rowItem.category || '').toLowerCase() === 'tab group' ||
                                                  (rowItem.category || '').toLowerCase() === 'bulk_link'
                                                  ? 'tabgroup'
                                                  : 'link'
                                            }
                                            maxIcons={3}
                                          />
                                        )}
                                        {rowItem.itemType === 'note' && (
                                          <NotesIcon size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                        )}
                                        {rowItem.itemType === 'snippet' && (
                                          <FaCode size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                        )}
                                        {(rowItem.itemType === 'agent' || rowItem.category === 'module' || rowItem.category === 'commands' || rowItem.category === 'general_commands') ? (
                                          (typeof rowItem.icon_host === 'string' && rowItem.icon_host) ? (
                                            <img
                                              src={getFaviconUrl(rowItem.icon_host)}
                                              alt=""
                                              className="shrink-0 w-3.5 h-3.5 object-contain rounded-sm"
                                            />
                                          ) : (!isLink && rowItem.category !== 'commands' && rowItem.category !== 'general_commands') ? (
                                            <AutomationDynamicIcon
                                              automation={rowItem.automationData}
                                              size={14}
                                              className="shrink-0"
                                            />
                                          ) : null
                                        ) : null}
                                      </>
                                    );
                                  })()}
                                  <span className="truncate flex-1 font-normal flex items-center gap-1">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    {!cell.getValue() && !tableRow.original.isReal && (
                                      <span className="text-red-500 font-bold text-[10px]">*</span>
                                    )}
                                  </span>
                                  {(tableRow.original.section === 'Smart Links' || tableRow.original.category === 'bookmark' || tableRow.original.category === 'commands') && (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();

                                        const urls = tableRow.original.urls || [];
                                        if (urls.length > 0) {
                                          const finalUrls = urls
                                            .map((url: string) => {
                                              if (url.startsWith('note:')) {
                                                const sid = url.substring(5);
                                                return chrome.runtime.getURL(
                                                  `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(sid)}`,
                                                );
                                              }
                                              return url;
                                            })
                                            .filter(Boolean);

                                          if (finalUrls.length > 0) {
                                            finalUrls.slice(1).forEach((url: string) => {
                                              if (url.startsWith('agent_chat?id=')) {
                                                const agentId = url.split('id=')[1];
                                                const extensionUrl = chrome.runtime.getURL(
                                                  `AltS_search_newtab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
                                                );
                                                chrome.tabs.create({ url: extensionUrl, active: false });
                                              } else {
                                                chrome.tabs.create({ url, active: false });
                                              }
                                            });

                                            const firstUrl = finalUrls[0];
                                            if (firstUrl.startsWith('agent_chat?id=')) {
                                              const agentId = firstUrl.split('id=')[1];
                                              const extensionUrl = chrome.runtime.getURL(
                                                `AltS_search_newtab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
                                              );
                                              window.location.href = extensionUrl;
                                            } else if (firstUrl.startsWith('chrome://') || firstUrl.startsWith('edge://') || firstUrl.startsWith('brave://')) {
                                              chrome.tabs.update({ url: firstUrl });
                                            } else {
                                              window.location.href = firstUrl;
                                            }
                                          }
                                        }
                                      }}
                                      className={clsx(
                                        'p-0.5 rounded transition-all cursor-pointer mr-2 shrink-0 flex items-center justify-center hover:bg-white/10',
                                        isSelectedRow || isSelected
                                          ? 'opacity-100'
                                          : 'opacity-0 group-hover/row:opacity-100',
                                      )}
                                      title="Open Link">
                                      <FiExternalLink size={12} className="text-[var(--color-iconDefault)]" />
                                    </button>
                                  )}
                                  <AnimatePresence mode="popLayout">
                                    {tableRow.original.syncStatus === 'syncing' && (
                                      <motion.div
                                        key="syncing"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="shrink-0 ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md border bg-blue-500/20 border-blue-500/30 text-blue-300">
                                        <BsHourglassSplit className="text-[10px] animate-spin" />
                                        <span className="text-[9px] font-medium tracking-tight">
                                          Syncing...
                                        </span>
                                      </motion.div>
                                    )}
                                    {tableRow.original.syncStatus === 'deleting' && (
                                      <motion.div
                                        key="deleting"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="shrink-0 ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md border bg-red-500/20 border-red-500/30 text-red-300">
                                        <FiLoader className="text-[10px] animate-spin" />
                                        <span className="text-[9px] font-medium tracking-tight">
                                          Deleting...
                                        </span>
                                      </motion.div>
                                    )}
                                    {tableRow.original.syncStatus === 'saved' && (
                                      <div className="shrink-0 ml-1">
                                        <motion.div
                                          key="saved-check"
                                          initial={{ opacity: 0, scale: 0.5 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0 }}
                                          className="flex items-center">
                                          <FiCheck className="text-[10px] text-emerald-500 stroke-[3]" />
                                        </motion.div>
                                      </div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ) : cell.column.id === 'folder' ? (
                                <>
                                  <div
                                    className="flex items-center justify-between gap-1 cursor-pointer hover:text-blue-500 transition-colors w-full h-full pr-2"
                                    onClick={e => {
                                      e.stopPropagation();
                                      const row = tableRow.original as any;
                                      const isBookmark =
                                        row.category === 'bookmark' || row.section === 'Bookmarks';
                                      const isBrowserCommand =
                                        row.category === 'commands' ||
                                        row.category === 'general_commands' ||
                                        row.section === 'Browser Commands';
                                      const isInstalledModule =
                                        row.category === 'module' || row.section === 'Installed Modules';

                                      if (!(isBookmark || isBrowserCommand || isInstalledModule)) {
                                        useSpreadsheetStore.getState().openPicker(tableRow.original.id);
                                      }
                                    }}>
                                    {tableRow.original.path ? (
                                      <>
                                        <div className="truncate flex-1 min-w-0">
                                          <span
                                            className={clsx(
                                              'truncate whitespace-nowrap transition-all duration-200 text-white',
                                              isSelectedRow ? 'hidden' : 'group-hover/row:hidden'
                                            )}>
                                            {tableRow.original.plainPath || tableRow.original.path}
                                          </span>
                                          <span
                                            className={clsx(
                                              'truncate whitespace-nowrap transition-all duration-200 text-white',
                                              isSelectedRow ? 'inline' : 'hidden group-hover/row:inline'
                                            )}>
                                            {tableRow.original.path}
                                          </span>
                                        </div>
                                        <span
                                          className={clsx(
                                            'shrink-0 ml-1.5 flex items-center transition-opacity duration-200',
                                            isSelectedRow
                                              ? 'opacity-100 text-blue-400'
                                              : 'opacity-0 group-hover/row:opacity-100 group-hover/row:text-blue-400',
                                          )}>
                                          {tableRow.original.visibilityType === 'lock' && (
                                            <MdLockOutline size={11} className="text-[var(--color-iconDefault)]" />
                                          )}
                                          {tableRow.original.visibilityType === 'globe' && (
                                            <FiGlobe size={11} className="text-[var(--color-iconDefault)]" />
                                          )}
                                          {tableRow.original.visibilityType === 'users' && (
                                            <BsPeopleFill size={11} className="text-[var(--color-iconDefault)]" />
                                          )}
                                          {tableRow.original.visibilityType === 'personal' && (
                                            <BsPersonFill size={11} className="text-[var(--color-iconDefault)]" />
                                          )}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-blue-400/70 font-normal italic text-[10px] pl-2 group-hover/folder:text-blue-500 transition-colors flex items-center gap-1">
                                        +{' '}
                                        {tableRow.original.section === 'Notes'
                                          ? 'Select regarding'
                                          : 'Selector for destination'}
                                        {!tableRow.original.folder && !tableRow.original.isReal && (
                                          <span className="text-red-500 text-[10px]">*</span>
                                        )}
                                      </span>
                                    )}
                                  </div>

                                  {isPickerOpen && pickerRowIndex === visualIndex && (
                                    <div
                                      className={clsx(
                                        'absolute right-1 z-[9999] w-[320px] min-w-[320px] transform transition-all animate-in fade-in zoom-in duration-150',
                                        visualIndex > tableData.length * 0.7 ? 'bottom-full mb-2' : 'top-full mt-2',
                                      )}
                                      onClick={e => e.stopPropagation()}>
                                      <DestinationPicker
                                        className="!w-[320px] !min-w-[320px]"
                                        selectedWorkspaceId={tableRow.original.workspace_id}
                                        selectedFolderId={tableRow.original.folder_id ?? null}
                                        onSelectWorkspace={(workspaceId: string) => {
                                          updateRowLocation(
                                            tableRow.original.id,
                                            workspaceId,
                                            null
                                          );
                                        }}
                                        onSelectFolder={(workspaceId: string, folderId: string) => {
                                          updateRowLocation(
                                            tableRow.original.id,
                                            workspaceId,
                                            folderId
                                          );
                                        }}
                                        onClose={closePicker}
                                      />
                                    </div>
                                  )}
                                </>
                              ) : index === 4 ? (
                                <div className="flex justify-center w-full">
                                  {value && <VisualKeyDisplay hotkey={value} variant="text" />}
                                </div>
                              ) : index === 5 ? (
                                <div className="flex justify-center w-full">
                                  <span className={clsx("text-[11px] font-normal", value ? "text-white" : "text-white/20")}>
                                    {value || '-'}
                                  </span>
                                </div>
                              ) : cell.column.id === 'url' ? (
                                (() => {
                                  if (
                                    tableRow.original.section === 'Notes' ||
                                    tableRow.original.section === 'Snippets'
                                  ) {
                                    const urls = tableRow.original.urls || [];
                                    // If Note has URLs, show them like Links. If not, show plain text snippet content.
                                    if (urls.length > 0) {
                                      // Fall through to standard URL rendering logic below
                                    } else {
                                      return (
                                        <div className="flex-1 truncate text-[11px] leading-tight flex items-center gap-1 text-white">
                                          {tableRow.original.value ? (
                                            String(tableRow.original.value)
                                              .replace(/<[^>]*>?/gm, '')
                                              .replace(/&nbsp;/g, ' ')
                                              .trim()
                                          ) : (
                                            <>
                                              {!tableRow.original.isReal && (
                                                <span className="text-red-500 font-bold text-[10px]">*</span>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      );
                                    }
                                  }

                                  const isAutomation =
                                    tableRow.original.section === 'My Saved Automations' ||
                                    tableRow.original.section === 'Automation Store' ||
                                    tableRow.original.section === 'Installed Modules' ||
                                    tableRow.original.category === 'automation' ||
                                    tableRow.original.type === 'automationModule';

                                  const isAgent =
                                    tableRow.original.section === 'Chat Agents' || tableRow.original.category === 'agent';

                                  if (isAutomation) {
                                    const steps =
                                      tableRow.original.automationData?.steps ||
                                      tableRow.original.automationData?.automation_steps ||
                                      tableRow.original.automationData?.execution_steps ||
                                      [];

                                    // 🚀 Priority 2: Preview for rows with steps
                                    if (steps.length > 0) {
                                      const getStepName = (mId: any) => {
                                        const id = String(mId || '');
                                        switch (id) {
                                          case 'open_tab':
                                          case 'open_url':
                                            return 'Open Link';
                                          case 'paste':
                                          case 'insert_text':
                                            return 'Fill Input';
                                          case 'wait':
                                          case 'wait_duration':
                                          case 'wait_for_navigation':
                                          case 'wait_for_element':
                                            return 'Wait';
                                          case 'clipboard_write':
                                            return 'Write Clipboard';
                                          case 'clipboard_paste':
                                            return 'Paste Clipboard';
                                          case 'agent':
                                            return 'Agent Step';
                                          case 'sub_automation':
                                            return 'Sub-Automation';
                                          default:
                                            return null;
                                        }
                                      };

                                      const stepNames = steps
                                        .map((s: any) => getStepName(s.moduleId || s.module_id || s.action))
                                        .filter(Boolean);

                                      const visibleSteps = stepNames.slice(0, 25).join(', ');
                                      const moreCount = stepNames.length - 25;

                                      return (
                                        <div className="flex items-center w-full text-[10px] overflow-hidden font-normal text-neutral-400">
                                          <span className="truncate flex-1">{visibleSteps}</span>
                                          {moreCount > 0 && (
                                            <span className="ml-1 text-[9px] font-normal shrink-0 px-1.5 rounded whitespace-nowrap text-neutral-400 bg-neutral-800">
                                              +{moreCount} more
                                            </span>
                                          )}
                                        </div>
                                      );
                                    }

                                    // 🚀 Priority 3: Fallback to description for modules/automations without steps
                                    const rawVal = tableRow.original.url || tableRow.original.value || '';
                                    let decodedVal = rawVal.includes('%') ? decodeURIComponent(rawVal) : rawVal;

                                    // If decodedVal is just dots or very short, try to use mod name or a better placeholder
                                    if (decodedVal === '......' || !decodedVal) {
                                      decodedVal =
                                        tableRow.original.name !== 'Untitled Module'
                                          ? `Module: ${tableRow.original.name}`
                                          : '';
                                    }

                                    if (decodedVal) {
                                      return (
                                        <div className="text-slate-500 italic text-[10px] truncate h-full px-1">
                                          {decodedVal}
                                        </div>
                                      );
                                    }

                                    // 🚀 Priority 4: Placeholder for empty/new automation rows
                                    return (
                                      <div className="italic text-[10px] flex items-center gap-1.5 h-full px-1 text-neutral-500">
                                        <FiZap size={10} className="text-[var(--color-iconDefault)]" />
                                        No steps - press Enter to add
                                      </div>
                                    );
                                  }

                                  const urls = tableRow.original.urls || [];
                                  // Only show editor if SPECIFICALLY in edit mode
                                  if (isSelected && isEditing) {
                                    return (
                                      <SpreadsheetMultiLinkInput
                                        initialUrls={urls}
                                        onSave={val =>
                                          updateCellData(
                                            tableRow.original.id,
                                            index,
                                            cell.column.id,
                                            val,
                                          )
                                        }
                                        onCancel={() => setEditingCell(null)}
                                      />
                                    );
                                  }

                                  const displayUrls = urls.length > 0 ? urls : [value || ''];
                                  const domains = displayUrls.map((u: string) => {
                                    try {
                                      const hostname = new URL(u.startsWith('http') ? u : `https://${u}`).hostname;
                                      return hostname.replace('www.', '');
                                    } catch {
                                      return u;
                                    }
                                  });

                                  const topThree = domains.slice(0, 3).join(', ');
                                  const moreCount = domains.length - 3;

                                  return (
                                    <div className="group/url flex items-center w-full text-[10px] overflow-hidden font-normal relative h-full text-white">
                                      <div className="flex flex-col w-full group-hover/row:py-1">
                                        {/* Collapsed View */}
                                        <div
                                          className={clsx(
                                            'flex items-center w-full transition-opacity',
                                            isSelected ? 'hidden' : 'flex',
                                          )}>
                                          <span className="truncate flex-1">{topThree}</span>
                                          {moreCount > 0 && (
                                            <span className="ml-1 text-[9px] font-normal shrink-0 whitespace-nowrap transition-colors text-neutral-500 group-hover/row:text-blue-400">
                                              +{moreCount} more
                                            </span>
                                          )}
                                        </div>

                                        {/* Expanded View on Cell Selection */}
                                        <div className={clsx('flex-col gap-1.5 w-full', isSelected ? 'flex' : 'hidden')}>
                                          {urls.map((u, i) => (
                                            <div
                                              key={i}
                                              className="text-[10px] hover:text-blue-600 transition-colors break-all leading-tight border-b last:border-0 pb-1 text-white border-white/5">
                                              {u}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()
                              ) : (
                                flexRender(cell.column.columnDef.cell, cell.getContext())
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
};

export default SpreadsheetTable;
