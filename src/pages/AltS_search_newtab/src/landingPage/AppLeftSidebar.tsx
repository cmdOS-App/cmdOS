import React from 'react';
import { AppSidebar } from './AppSidebar/AppSidebar';
import { useUIStore } from '../../../../shared-components/uiStateManager';

interface AppLeftSidebarProps {
  showSidebarColumn: boolean;
  hasActivePopup: boolean;
  backgroundRefresh: () => void;

  openSpreadsheetView: (mode: string) => void;
  searchbarRef: React.RefObject<any>;
  setIsSpreadsheetViewOpen: (v: boolean) => void;
  savedAgentById: Map<string, any>;
  handleNavigateToListView: (type: 'notes' | 'links' | 'commands', section?: string) => void;
  handleFavoriteLinkEdit: (suggestion: any) => void;
}

export const AppLeftSidebar: React.FC<AppLeftSidebarProps> = ({
  showSidebarColumn,
  hasActivePopup,
  backgroundRefresh,

  openSpreadsheetView,
  searchbarRef,
  setIsSpreadsheetViewOpen,
  savedAgentById,
  handleNavigateToListView,
  handleFavoriteLinkEdit
}) => {


  const activeView = useUIStore(s => s.activeView);
  const isSettings = activeView?.type === 'settings';

  return (
    <>
      {/* Left Sidebar: AppSidebar (Favorites / Notes / Links) */}
        {showSidebarColumn && (
          <div
            className={`h-full shrink-0 flex flex-col pt-[56px] border-r border-neutral-200 dark:border-white/10 shadow-2xl z-30
              bg-[var(--color-sidebarBg)]
            `}
            style={{
              width: '280px',
            }}>
            <AppSidebar
              searchbarRef={searchbarRef}
              reload={backgroundRefresh}
              isSidebar={true}
              onCommandSelect={commandId => {
                const isOrgOrBillingView =
                  activeView?.type === 'subscriptions' ||
                  activeView?.type === 'manageSubscription' ||
                  activeView?.type === 'organizationSettings';
                if (commandId === 'collections') {
                  if (isOrgOrBillingView) {
                    useUIStore.getState().setView({ type: 'home' });
                  }
                  openSpreadsheetView('collections');
                  return;
                }
                // 'todo' opens the left-side todo panel, not the searchbar
                if (commandId === 'todo') {
                  if (isOrgOrBillingView) {
                    useUIStore.getState().setView({ type: 'home' });
                  }
                  useUIStore.getState().setSidebar('todoSidebar', { open: true });
                  return;
                }
                if (commandId === 'createtodo') {
                  if (isOrgOrBillingView) {
                    useUIStore.getState().setView({ type: 'home' });
                  }
                  useUIStore.getState().setTodoCreatePrefill({ isCreateModalOnly: true } as any);
                  useUIStore.getState().openEditor({ type: 'todo', id: 'todo-create', props: { prefill: { isCreateModalOnly: true } } });
                  return;
                }
                if (commandId === 'createfolder') {
                  useUIStore.getState().setView({ type: 'createFolder' });
                  return;
                }
                if (commandId === 'createworkspace') {
                  useUIStore.getState().setView({ type: 'createWorkspace' });
                  return;
                }
                if (commandId === 'ai') {
                  if (isOrgOrBillingView) {
                    useUIStore.getState().setView({ type: 'home' });
                  }
                  useUIStore.getState().openEditor({ type: 'aiPrompt', id: 'new', props: {} });
                  return;
                }
                const mode =
                  commandId === 'saved-automation' || commandId === 'store' ? 'lock' : 'execute';
                if (isOrgOrBillingView) {
                  useUIStore.getState().setView({ type: 'home' });
                  useUIStore.getState().setPendingLockedCommand({ commandId, mode });
                } else if (searchbarRef.current) {
                  searchbarRef.current.clear();
                  setTimeout(() => {
                    searchbarRef.current?.executeCommand(commandId as any, { mode });
                    searchbarRef.current?.focus();
                  }, 10);
                }
              }}
              onAutomationSelect={automation => {
                const isOrgOrBillingView =
                  activeView?.type === 'subscriptions' ||
                  activeView?.type === 'manageSubscription' ||
                  activeView?.type === 'organizationSettings';
                setIsSpreadsheetViewOpen(false);
                if (isOrgOrBillingView) {
                  useUIStore.getState().setView({ type: 'home' });
                  useUIStore.getState().setPendingAutomation(automation);
                } else if (searchbarRef.current) {
                  searchbarRef.current.clear();
                  setTimeout(() => {
                    searchbarRef.current?.activateAutomation(automation);
                    searchbarRef.current?.focus();
                  }, 10);
                }
              }}
              onSelectSavedAgent={agent => {
                const isOrgOrBillingView =
                  activeView?.type === 'subscriptions' ||
                  activeView?.type === 'manageSubscription' ||
                  activeView?.type === 'organizationSettings' ||
                  false;
                setIsSpreadsheetViewOpen(false);

                const candidateIds = [
                  agent?.id,
                  agent?.automation_id,
                  agent?.automation?.id,
                  agent?.automation?.automation_id,
                ]
                  .map(val => String(val || ''))
                  .filter(Boolean);

                const resolvedAgent = candidateIds.map(id => savedAgentById.get(id)).find(Boolean) || agent;

                if (isOrgOrBillingView) {
                  useUIStore.getState().setView({ type: 'home' });
                  useUIStore.getState().setPendingAgent(resolvedAgent);
                } else if (searchbarRef.current) {
                  setTimeout(() => {
                    searchbarRef.current?.selectSavedAgent(resolvedAgent);
                    searchbarRef.current?.focus();
                  }, 10);
                }
              }}
              onNavigateToListView={(type, section) => {
                const isOrgOrBillingView =
                  activeView?.type === 'subscriptions' ||
                  activeView?.type === 'manageSubscription' ||
                  activeView?.type === 'organizationSettings' ||
                  false;
                if (isOrgOrBillingView) {
                  useUIStore.getState().setView({ type: 'home' });
                }
                handleNavigateToListView(type, section);
              }}
              onRequestEditLink={handleFavoriteLinkEdit}
            />
          </div>
        )}
    </>
  );
};
