import React, { useState, useEffect, useMemo } from 'react';
import { useAppearance } from '@extension/ui';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import {
  FiZap,
} from 'react-icons/fi';
import { FaCode, FaLink, FaRobot, FaLayerGroup } from 'react-icons/fa';
import { BsCalendarCheck } from 'react-icons/bs';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';

interface ViewMenuPanelProps {
  searchbarRef?: React.RefObject<any>;
}

export const ViewMenuPanel: React.FC<ViewMenuPanelProps> = ({ searchbarRef }) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;

  const [visibleViewItems, setVisibleViewItems] = useState<Record<string, boolean>>({
    all: true,
    notes: true,
    snippets: true,
    links: true,
    chat_agents: true,
    todos: true,
    automations: true,
    sessions: true,
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

  // Load preferences from local storage and listen to changes
  useEffect(() => {
    const loadPreferences = () => {
      chrome.storage.local.get(['sidebar_view_visible_items', 'sidebar_view_items_order'], (result) => {
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
          if (result.sidebar_view_visible_items) {
            setVisibleViewItems(result.sidebar_view_visible_items);
          }
          if (result.sidebar_view_items_order) {
            setViewItemsOrder(result.sidebar_view_items_order);
          }
        }
      });
    };

    loadPreferences();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.sidebar_view_visible_items) {
        setVisibleViewItems(changes.sidebar_view_visible_items.newValue);
      }
      if (changes.sidebar_view_items_order) {
        setViewItemsOrder(changes.sidebar_view_items_order.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const [isViewExpanded, setIsViewExpanded] = useState<boolean>(false);

  const rawOptions = useMemo(() => [
    {
      id: 'all',
      label: 'All',
      slash: '/a ',
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault)] ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    },
    { id: 'notes', label: 'Notes', slash: '/n ', icon: <NotesIcon size={14} className="shrink-0 text-amber-400 ml-0.5" /> },
    { id: 'snippets', label: 'Snippets', slash: '/s ', icon: <FaCode size={14} className="text-[var(--color-iconDefault)] shrink-0 ml-0.5" /> },
    { id: 'links', label: 'Links', slash: '/l ', icon: <FaLink size={14} className="text-blue-400 shrink-0 ml-0.5" /> },
    { id: 'chat_agents', label: 'Chat Agents', slash: '/ca ', icon: <FaRobot size={14} className="text-indigo-400 shrink-0 ml-0.5" /> },
    { id: 'todos', label: 'Todos', slash: '/t ', icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)] shrink-0 ml-0.5" /> },
    { id: 'automations', label: 'Automations', slash: '/au ', icon: <FiZap size={14} className="text-amber-400 shrink-0 ml-0.5" /> },
    { id: 'sessions', label: 'Tab groups', slash: '/se ', icon: <FaLayerGroup size={14} className="text-purple-400 shrink-0 ml-0.5" /> },
  ], []);

  const mainItems = useMemo(() => {
    return viewItemsOrder
      .filter((id) => visibleViewItems[id])
      .map((id) => rawOptions.find((o) => o.id === id))
      .filter(Boolean) as any[];
  }, [viewItemsOrder, visibleViewItems, rawOptions]);

  const collapsedItems = useMemo(() => {
    return viewItemsOrder
      .filter((id) => !visibleViewItems[id])
      .map((id) => rawOptions.find((o) => o.id === id))
      .filter(Boolean) as any[];
  }, [viewItemsOrder, visibleViewItems, rawOptions]);

  const handleViewClick = (slash: string) => {
    useUIStore.getState().closeEditor();

    // Clear workspace and folder filter so clicking "All" or other views resets to global search results
    useUIStore.getState().setSelectedWorkspaceId(null);
    useUIStore.getState().setSelectedFolderId(null);

    // Redirect to board view (same pattern as onShortcutBoardView in AppMainContent)
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
    }

    if (searchbarRef?.current) {
      searchbarRef.current.setValue(slash);
      setTimeout(() => {
        searchbarRef.current?.focus();
      }, 50);
    }
  };

  const renderViewOptionItem = (opt: any) => {
    return (
      <div
        key={opt.id}
        className="flex items-center cursor-pointer group py-[4px] pl-[12px] gap-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150"
        onClick={(e) => {
          e.stopPropagation();
          handleViewClick(opt.slash);
        }}
      >
        {opt.icon}
        <span
          className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${isDark
              ? 'text-neutral-400 group-hover:text-neutral-200'
              : 'text-neutral-500 group-hover:text-neutral-800'
            }`}
        >
          {opt.label}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col select-none">
      {/* Header */}
      <div className="px-3 pt-2.5 pb-0 flex items-center justify-between gap-2 group/header relative">
        <div className="flex-1 flex items-center gap-2 pr-[56px]">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[12px] font-bold tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}
            >
              VIEW
            </span>
          </div>
          <div
            className={`flex-1 border-t ${isDark ? 'border-white/10' : 'border-[#eee8d5]'
              }`}
          />
        </div>
      </div>

      {/* Items list */}
      <div className="flex flex-col px-3 pt-1 pb-2 gap-0.5">
        {mainItems.map((opt) => renderViewOptionItem(opt))}

        {isViewExpanded && collapsedItems.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {collapsedItems.map((opt) => renderViewOptionItem(opt))}
          </div>
        )}

        {collapsedItems.length > 0 && (
          <div
            className="flex items-center justify-center cursor-pointer py-1 px-1.5 group select-none relative"
            onClick={(e) => {
              e.stopPropagation();
              setIsViewExpanded(!isViewExpanded);
            }}
          >
            <div className="shrink-0 transition-colors text-[var(--color-iconDefault)] hover:text-neutral-300 dark:hover:text-neutral-600">
              {isViewExpanded ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewMenuPanel;

