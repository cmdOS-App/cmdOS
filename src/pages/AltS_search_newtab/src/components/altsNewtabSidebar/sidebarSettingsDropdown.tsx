import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppearance } from '@extension/ui';
import { Reorder, useDragControls } from 'framer-motion';
import { FaCheck } from 'react-icons/fa';
import { FiMoreHorizontal } from 'react-icons/fi';
import { HiArrowsUpDown } from 'react-icons/hi2';

// ─── Drag Handle ────────────────────────────────────────────────────────────

const DragHandleIcon = () => (
  <svg
    width="8"
    height="12"
    viewBox="0 0 8 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="opacity-40 hover:opacity-100 transition-opacity"
  >
    <circle cx="2" cy="2" r="1" fill="currentColor" />
    <circle cx="2" cy="6" r="1" fill="currentColor" />
    <circle cx="2" cy="10" r="1" fill="currentColor" />
    <circle cx="6" cy="2" r="1" fill="currentColor" />
    <circle cx="6" cy="6" r="1" fill="currentColor" />
    <circle cx="6" cy="10" r="1" fill="currentColor" />
  </svg>
);

// ─── Toggle Switch ───────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  isOn: boolean;
  onToggle: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isOn, onToggle }) => (
  <div
    onClick={(e) => { e.stopPropagation(); onToggle(); }}
    className={`relative flex-shrink-0 w-7 h-4 rounded-full cursor-pointer transition-colors duration-200
      ${isOn ? 'bg-[#268bd2]' : 'bg-neutral-600'}`}
  >
    <div
      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200
        ${isOn ? 'translate-x-3.5' : 'translate-x-0.5'}`}
    />
  </div>
);

// ─── Sub-item row ────────────────────────────────────────────────────────────

interface DropdownReorderItemProps {
  option: { id: string; label: string };
  visibleItems: Record<string, boolean>;
  toggleItemVisibility: (id: string) => void;
  dragControls: any;
}

const DropdownReorderItem: React.FC<DropdownReorderItemProps> = ({
  option,
  visibleItems,
  toggleItemVisibility,
  dragControls,
}) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;

  return (
    <Reorder.Item
      key={option.id}
      value={option.id}
      className="list-none"
      dragListener={false}
      dragControls={dragControls}
    >
      <div
        className={`flex items-center justify-between px-2 py-0.5 rounded-md text-[12px] transition-colors duration-150 select-none
          ${isDark
            ? 'hover:bg-white/5 text-neutral-300 hover:text-white'
            : 'hover:bg-black/5 text-[#586e75] hover:text-[#073642]'
          }`}
      >
        <div className="flex items-center gap-1.5 flex-1">
          <div
            className="cursor-grab active:cursor-grabbing p-0.5 text-neutral-500 hover:text-neutral-300 dark:hover:text-neutral-200"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <DragHandleIcon />
          </div>
          <span
            className="font-medium cursor-pointer flex-1 py-0.5"
            onClick={() => toggleItemVisibility(option.id)}
          >
            {option.label}
          </span>
        </div>
        {/* Checkbox for sub-items */}
        <div
          className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all duration-150 shrink-0 cursor-pointer
            ${visibleItems[option.id]
              ? 'bg-[#268bd2] border-[#268bd2] text-white'
              : 'border-neutral-600 hover:border-neutral-400'
            }`}
          onClick={() => toggleItemVisibility(option.id)}
        >
          {visibleItems[option.id] && <FaCheck size={7} />}
        </div>
      </div>
    </Reorder.Item>
  );
};

// ─── Section header row ──────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  isOn: boolean;
  onToggle: () => void;
  dragControls: any;
  isDark: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ label, isOn, onToggle, dragControls, isDark }) => (
  <div className="flex items-center justify-between px-2 py-1 mb-0.5">
    <div className="flex items-center gap-1">
      <div
        className="cursor-grab active:cursor-grabbing p-0.5 text-neutral-500 hover:text-neutral-300"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <DragHandleIcon />
      </div>
      <span className={`text-[10px] font-bold tracking-wider uppercase ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
        {label}
      </span>
    </div>
    <ToggleSwitch isOn={isOn} onToggle={onToggle} />
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────────

interface SidebarSettingsDropdownProps {
  showFavoritesSection: boolean;
  onToggleFavoritesSection: (val: boolean) => void;
  showCreateSection: boolean;
  onToggleCreateSection: (val: boolean) => void;
  showViewSection: boolean;
  onToggleViewSection: (val: boolean) => void;
  sectionsOrder: string[];
  onSectionsReorder: (newOrder: string[]) => void;
  isHovered: boolean;
}

export const SidebarSettingsDropdown: React.FC<SidebarSettingsDropdownProps> = ({
  showFavoritesSection,
  onToggleFavoritesSection,
  showCreateSection,
  onToggleCreateSection,
  showViewSection,
  onToggleViewSection,
  sectionsOrder,
  onSectionsReorder,
  isHovered,
}) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [favoritesSortOrder, setFavoritesSortOrder] = useState<'hotkeys' | 'alphabetic' | 'custom' | 'type'>('hotkeys');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const [visibleCreateItems, setVisibleCreateItems] = useState<Record<string, boolean>>({
    createsession: true,
    createnotes: true,
    createtodo: true,
    createlinks: true,
    ai: true,
    createsnippet: true,
    agent: true,
    createfolder: false,
    createworkspace: false,
  });
  const [createItemsOrder, setCreateItemsOrder] = useState<string[]>([
    'createsession', 'createnotes', 'createtodo', 'createlinks', 'ai', 'createsnippet', 'agent', 'createfolder', 'createworkspace',
  ]);

  // ── View items state ──
  const [visibleViewItems, setVisibleViewItems] = useState<Record<string, boolean>>({
    all: true,
    sessions: true,
    notes: true,
    todos: true,
    links: true,
    chat_agents: true,
    snippets: true,
    automations: true,
  });
  const [viewItemsOrder, setViewItemsOrder] = useState<string[]>([
    'all',
    'sessions',
    'notes',
    'todos',
    'links',
    'chat_agents',
    'snippets',
    'automations',
  ]);

  // ── Drag controls — all created at top level (no hooks in loops) ──
  const createSectionDrag = useDragControls();
  const viewSectionDrag = useDragControls();
  const favoritesSectionDrag = useDragControls();

  const cItem1 = useDragControls();
  const cItem2 = useDragControls();
  const cItem3 = useDragControls();
  const cItem4 = useDragControls();
  const cItem5 = useDragControls();
  const cItem6 = useDragControls();
  const cItem7 = useDragControls();
  const cItem8 = useDragControls();
  const cItem9 = useDragControls();

  const vItem1 = useDragControls();
  const vItem2 = useDragControls();
  const vItem3 = useDragControls();
  const vItem4 = useDragControls();
  const vItem5 = useDragControls();
  const vItem6 = useDragControls();
  const vItem7 = useDragControls();
  const vItem8 = useDragControls();

  const createControls = useMemo<Record<string, any>>(() => ({
    createlinks: cItem1, createsession: cItem2, createnotes: cItem3,
    ai: cItem4, createtodo: cItem5, agent: cItem6, createsnippet: cItem7,
    createfolder: cItem8, createworkspace: cItem9,
  }), [cItem1, cItem2, cItem3, cItem4, cItem5, cItem6, cItem7, cItem8, cItem9]);

  const viewControls = useMemo<Record<string, any>>(() => ({
    all: vItem1,
    sessions: vItem2,
    notes: vItem3,
    todos: vItem4,
    links: vItem5,
    chat_agents: vItem6,
    snippets: vItem7,
    automations: vItem8,
  }), [vItem1, vItem2, vItem3, vItem4, vItem5, vItem6, vItem7, vItem8]);

  // ── Load from storage ──
  useEffect(() => {
    chrome.storage.local.get([
      'favorites_create_visible_items',
      'favorites_create_items_order',
      'sidebar_view_visible_items',
      'sidebar_view_items_order',
      'favoritesSortOrder',
    ], (result) => {
      if (result.favorites_create_visible_items) setVisibleCreateItems(result.favorites_create_visible_items);
      if (result.favorites_create_items_order) setCreateItemsOrder(result.favorites_create_items_order);
      if (result.favoritesSortOrder) setFavoritesSortOrder(result.favoritesSortOrder);

      if (result.sidebar_view_items_order && result.sidebar_view_items_order.length < 8) {
        const newOrder = [
          'all',
          'sessions',
          'notes',
          'todos',
          'links',
          'chat_agents',
          'snippets',
          'automations',
        ];
        setViewItemsOrder(newOrder);
        chrome.storage.local.set({ sidebar_view_items_order: newOrder });

        const newVisible = {
          ...result.sidebar_view_visible_items,
          sessions: true,
          chat_agents: true,
        };
        setVisibleViewItems(newVisible);
        chrome.storage.local.set({ sidebar_view_visible_items: newVisible });
      } else {
        if (result.sidebar_view_visible_items) setVisibleViewItems(result.sidebar_view_visible_items);
        if (result.sidebar_view_items_order) setViewItemsOrder(result.sidebar_view_items_order);
      }
    });

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.favoritesSortOrder) {
        setFavoritesSortOrder(changes.favoritesSortOrder.newValue);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // ── Close on outside click ──
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Handlers ──
  const toggleCreateItem = (id: string) => {
    const updated = { ...visibleCreateItems, [id]: !visibleCreateItems[id] };
    setVisibleCreateItems(updated);
    chrome.storage.local.set({ favorites_create_visible_items: updated });
  };

  const reorderCreateItems = (newOrder: string[]) => {
    setCreateItemsOrder(newOrder);
    chrome.storage.local.set({ favorites_create_items_order: newOrder });
  };

  const toggleViewItem = (id: string) => {
    const updated = { ...visibleViewItems, [id]: !visibleViewItems[id] };
    setVisibleViewItems(updated);
    chrome.storage.local.set({ sidebar_view_visible_items: updated });
  };

  const reorderViewItems = (newOrder: string[]) => {
    setViewItemsOrder(newOrder);
    chrome.storage.local.set({ sidebar_view_items_order: newOrder });
  };

  const handleSortChange = (newOrder: 'hotkeys' | 'alphabetic' | 'custom' | 'type') => {
    setFavoritesSortOrder(newOrder);
    chrome.storage.local.set({ favoritesSortOrder: newOrder });
    setShowSortMenu(false);
  };

  // ── Options ──
  const createOptions = useMemo(() => {
    const map: Record<string, { id: string; label: string }> = {
      createlinks: { id: 'createlinks', label: 'Link' },
      createsession: { id: 'createsession', label: 'Tab group' },
      createnotes: { id: 'createnotes', label: 'Note' },
      ai: { id: 'ai', label: 'Chat Agent' },
      createtodo: { id: 'createtodo', label: 'Todo' },
      agent: { id: 'agent', label: 'Automation' },
      createsnippet: { id: 'createsnippet', label: 'Snippet' },
      createfolder: { id: 'createfolder', label: 'Folder' },
      createworkspace: { id: 'createworkspace', label: 'Organization' },
    };
    return createItemsOrder.map(id => map[id]).filter(Boolean);
  }, [createItemsOrder]);

  const viewOptions = useMemo(() => {
    const map: Record<string, { id: string; label: string }> = {
      all: { id: 'all', label: 'All' },
      sessions: { id: 'sessions', label: 'Tab session' },
      notes: { id: 'notes', label: 'Notes' },
      todos: { id: 'todos', label: 'Todos' },
      links: { id: 'links', label: 'Links' },
      chat_agents: { id: 'chat_agents', label: 'Chat Agents' },
      snippets: { id: 'snippets', label: 'Snippets' },
      automations: { id: 'automations', label: 'Automations' },
    };
    return viewItemsOrder.map(id => map[id]).filter(Boolean);
  }, [viewItemsOrder]);

  // ── Ensure all sections always appear in sectionsOrder ──
  const normalizedOrder = useMemo(() => {
    const order = [...sectionsOrder];
    if (!order.includes('favorites')) order.splice(1, 0, 'favorites');
    if (!order.includes('create')) order.unshift('create');
    if (!order.includes('view')) order.push('view');
    return order;
  }, [sectionsOrder]);

  return (
    <div className="relative pointer-events-auto" ref={dropdownRef}>
      {/* Three-dots trigger */}
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-opacity duration-200 outline-none border-none cursor-pointer
          ${isHovered || isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <FiMoreHorizontal
          size={15}
          className={`transition-colors duration-150 text-[var(--color-iconDefault)]
            ${isDark ? 'hover:text-neutral-100' : 'hover:text-neutral-900'}`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className={`absolute left-full top-0 ml-2 z-[9999] w-52 p-2 rounded-lg border shadow-xl flex flex-col select-none overflow-visible
            ${isDark
              ? 'bg-[var(--color-popupBg)] border-white/10 text-neutral-400 shadow-black/80'
              : 'bg-[#fdf6e3] border-[#eee8d5] text-[#586e75] shadow-neutral-400/20'
            }`}
        >
          <Reorder.Group
            axis="y"
            values={normalizedOrder}
            onReorder={onSectionsReorder}
            className="flex flex-col gap-0"
          >
            {normalizedOrder.map((sectionId, idx) => {
              const isFirst = idx === 0;
              const sectionBorderClass = isFirst ? '' : 'pt-1.5 mt-1 border-t border-black/10 dark:border-white/10';

              if (sectionId === 'create') {
                return (
                  <Reorder.Item
                    key="create"
                    value="create"
                    dragListener={false}
                    dragControls={createSectionDrag}
                    className={`list-none flex flex-col pb-2 ${sectionBorderClass}`}
                  >
                    <SectionHeader
                      label="CREATE"
                      isOn={showCreateSection}
                      onToggle={() => onToggleCreateSection(!showCreateSection)}
                      dragControls={createSectionDrag}
                      isDark={isDark}
                    />
                    <Reorder.Group
                      axis="y"
                      values={createItemsOrder}
                      onReorder={reorderCreateItems}
                      className="flex flex-col gap-0 ml-1"
                    >
                      {createOptions.map((option) => (
                        <DropdownReorderItem
                          key={option.id}
                          option={option}
                          visibleItems={visibleCreateItems}
                          toggleItemVisibility={toggleCreateItem}
                          dragControls={createControls[option.id]}
                        />
                      ))}
                    </Reorder.Group>
                  </Reorder.Item>
                );
              }

              if (sectionId === 'view') {
                return (
                  <Reorder.Item
                    key="view"
                    value="view"
                    dragListener={false}
                    dragControls={viewSectionDrag}
                    className={`list-none flex flex-col pb-2 ${sectionBorderClass}`}
                  >
                    <SectionHeader
                      label="MY LIBRARY"
                      isOn={showViewSection}
                      onToggle={() => onToggleViewSection(!showViewSection)}
                      dragControls={viewSectionDrag}
                      isDark={isDark}
                    />
                    <Reorder.Group
                      axis="y"
                      values={viewItemsOrder}
                      onReorder={reorderViewItems}
                      className="flex flex-col gap-0 ml-1"
                    >
                      {viewOptions.map((option) => (
                        <DropdownReorderItem
                          key={option.id}
                          option={option}
                          visibleItems={visibleViewItems}
                          toggleItemVisibility={toggleViewItem}
                          dragControls={viewControls[option.id]}
                        />
                      ))}
                    </Reorder.Group>
                  </Reorder.Item>
                );
              }

              if (sectionId === 'favorites') {
                return (
                  <Reorder.Item
                    key="favorites"
                    value="favorites"
                    dragListener={false}
                    dragControls={favoritesSectionDrag}
                    className={`list-none flex flex-col pb-2 ${sectionBorderClass}`}
                  >
                    <SectionHeader
                      label="FAVORITES"
                      isOn={showFavoritesSection}
                      onToggle={() => onToggleFavoritesSection(!showFavoritesSection)}
                      dragControls={favoritesSectionDrag}
                      isDark={isDark}
                    />
                    <div className="flex items-center justify-between px-2 py-0.5 mt-0.5 rounded-md text-[12px] text-neutral-400 select-none relative" ref={sortMenuRef}>
                      <span className={`text-[12px] ${isDark ? 'text-neutral-300' : 'text-[#586e75]'}`}>
                        Sort by: <span className={`font-semibold capitalize ${isDark ? 'text-white' : 'text-[#073642]'}`}>{favoritesSortOrder === 'custom' ? 'Custom' : favoritesSortOrder}</span>
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowSortMenu(!showSortMenu); }}
                        className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center text-neutral-500 hover:text-neutral-300 dark:hover:text-neutral-200 cursor-pointer outline-none border-none bg-transparent"
                      >
                        <HiArrowsUpDown size={13} />
                      </button>

                      {showSortMenu && (
                        <div
                          className={`absolute left-full top-0 ml-2 w-44 rounded-lg border shadow-xl z-50 py-1 overflow-hidden
                          ${isDark ? 'bg-[var(--color-popupBg)] border-white/10 text-neutral-400 shadow-black/80' : 'bg-[#fdf6e3] border-[#eee8d5] text-[#586e75] shadow-neutral-400/20'}`}
                        >
                          {[
                            { id: 'hotkeys', label: 'Hotkeys' },
                            { id: 'alphabetic', label: 'Alphabetic' },
                            { id: 'type', label: 'Type' },
                            { id: 'custom', label: 'Custom (Drag and drop)' },
                          ].map(option => (
                            <button
                              key={option.id}
                              onClick={(e) => { e.stopPropagation(); handleSortChange(option.id as any); }}
                              className={`w-full text-left px-3 py-2 text-[12px] transition-colors flex items-center justify-between outline-none border-none cursor-pointer
                                ${
                                  favoritesSortOrder === option.id
                                    ? isDark
                                      ? 'bg-white/10 text-white font-medium'
                                      : 'bg-[#eee8d5] text-[#268bd2] font-medium'
                                    : isDark
                                      ? 'text-neutral-400 hover:bg-white/5 hover:text-white'
                                      : 'text-[#586e75] hover:bg-[#eee8d5]'
                                }`}
                            >
                              <span>{option.label}</span>
                              {favoritesSortOrder === option.id && (
                                <FaCheck size={9} className={isDark ? 'text-purple-400' : 'text-[#268bd2]'} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </Reorder.Item>
                );
              }

              return null;
            })}
          </Reorder.Group>
        </div>
      )}
    </div>
  );
};
