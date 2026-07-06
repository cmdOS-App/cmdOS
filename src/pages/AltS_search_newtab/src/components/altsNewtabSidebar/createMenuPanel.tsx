import React, { useState, useEffect, useMemo } from 'react';
import { useAppearance } from '@extension/ui';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';


interface CreateMenuPanelProps {
  onCommandSelect: (id: string) => void;
}

export const CreateMenuPanel: React.FC<CreateMenuPanelProps> = ({ onCommandSelect }) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;

  const [isCreateExpanded, setIsCreateExpanded] = useState<boolean>(false);
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
    'createsession',
    'createnotes',
    'createtodo',
    'createlinks',
    'ai',
    'createsnippet',
    'agent',
    'createfolder',
    'createworkspace',
  ]);

  // Load preferences from local storage and listen to changes
  useEffect(() => {
    const loadPreferences = () => {
      chrome.storage.local.get([
        'favorites_create_visible_items',
        'favorites_create_items_order',
      ], (result) => {
        if (result.favorites_create_visible_items) {
          setVisibleCreateItems(result.favorites_create_visible_items);
        }
        if (result.favorites_create_items_order) {
          setCreateItemsOrder(result.favorites_create_items_order);
        }
      });
    };

    loadPreferences();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.favorites_create_visible_items) {
        setVisibleCreateItems(changes.favorites_create_visible_items.newValue);
      }
      if (changes.favorites_create_items_order) {
        setCreateItemsOrder(changes.favorites_create_items_order.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const mainItems = useMemo(() => {
    return createItemsOrder.filter((id) => visibleCreateItems[id]);
  }, [createItemsOrder, visibleCreateItems]);

  const collapsedItems = useMemo(() => {
    return createItemsOrder.filter((id) => !visibleCreateItems[id]);
  }, [createItemsOrder, visibleCreateItems]);

  const renderCreateItem = (id: string) => {
    switch (id) {
      case 'createlinks':
        return (
          <div
            key="createlinks"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={(e) => {
              e.stopPropagation();
              onCommandSelect('createlinks');
            }}
          >
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}
            >
              Link
            </span>
          </div>
        );
      case 'createsession':
        return (
          <div
            key="createsession"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={(e) => {
              e.stopPropagation();
              onCommandSelect('createsession');
            }}
          >
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}
            >
              Tab group
            </span>
          </div>
        );
      case 'createnotes':
        return (
          <div
            key="createnotes"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={(e) => {
              e.stopPropagation();
              onCommandSelect('createnotes');
            }}
          >
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}
            >
              Note
            </span>
          </div>
        );
      case 'ai':
        return (
          <div
            key="ai"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={(e) => {
              e.stopPropagation();
              onCommandSelect('ai');
            }}
          >
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}
            >
              Chat Agent
            </span>
          </div>
        );
      case 'createtodo':
        return (
          <div
            key="createtodo"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={(e) => {
              e.stopPropagation();
              onCommandSelect('createtodo');
            }}
          >
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}
            >
              Todo
            </span>
          </div>
        );
      case 'agent':
        return (
          <div
            key="agent"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={(e) => {
              e.stopPropagation();
              onCommandSelect('agent');
            }}
          >
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}
            >
              Automation (Beta)
            </span>
          </div>
        );
      case 'createsnippet':
        return (
          <div
            key="createsnippet"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={(e) => {
              e.stopPropagation();
              onCommandSelect('createsnippet');
            }}
          >
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}
            >
              Snippet
            </span>
          </div>
        );
      case 'createfolder':
        return (
          <div
            key="createfolder"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={(e) => {
              e.stopPropagation();
              onCommandSelect('createfolder');
            }}
          >
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}
            >
              Folder
            </span>
          </div>
        );
      case 'createworkspace':
        return (
          <div
            key="createworkspace"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={(e) => {
              e.stopPropagation();
              onCommandSelect('createworkspace');
            }}
          >
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${
                isDark
                  ? 'text-neutral-400 group-hover:text-neutral-200'
                  : 'text-neutral-500 group-hover:text-neutral-800'
              }`}
            >
              Organization
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col select-none">
      <div className="px-3 pt-2.5 pb-0 flex items-center justify-between gap-2 group/header relative">
        <div className="flex-1 flex items-center gap-2 pr-[56px]">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[12px] font-bold tracking-wider ${
                isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`}
            >
              CREATE
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCommandSelect('createlinks');
              }}
              title="Customize Create Items"
              className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-400 dark:hover:text-emerald-300 text-[18px] font-bold select-none leading-none flex items-center justify-center p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer outline-none border-none ml-1"
            >
              +
            </button>
          </div>
          <div
            className={`flex-1 border-t ${
              isDark ? 'border-white/10' : 'border-[#eee8d5]'
            }`}
          />
        </div>
      </div>

      <div className="flex flex-col px-3 pt-0.5 pb-2">
        {mainItems.map((id) => renderCreateItem(id))}

        {isCreateExpanded && collapsedItems.length > 0 && (
          <div className="flex flex-col">
            {collapsedItems.map((id) => renderCreateItem(id))}
          </div>
        )}

        {collapsedItems.length > 0 && (
          <div
            className="flex items-center justify-center cursor-pointer py-1 px-1.5 group select-none relative"
            onClick={(e) => {
              e.stopPropagation();
              setIsCreateExpanded(!isCreateExpanded);
            }}
          >
            <div
              className="shrink-0 transition-colors text-[var(--color-iconDefault)] hover:text-neutral-300 dark:hover:text-neutral-600"
            >
              {isCreateExpanded ? (
                <FiChevronUp size={14} />
              ) : (
                <FiChevronDown size={14} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateMenuPanel;
