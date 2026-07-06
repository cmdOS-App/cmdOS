import React from 'react';
import AutomationStatusIndicator from '../../../../allObjectFolder/src/createObject/automationBeta/ui/automationStatusIndicator';
import NotificationContainer from '../../../../shared-components/notifications/NotificationContainer';
import CreateWorkspacePanel from '../../../../settings/allWorkspaceManager/workspaces/ui/CreateWorkspacePanel';
import { GlobalAltCPopup } from '../../../../allObjectFolder/src/altcPopup/globalAltCPopup';
import { useUIStore } from '../../../../shared-components/uiStateManager';

interface AppModalsProps {
  createWorkspaceModal: any;
  setCreateWorkspaceModal: any;
  backgroundRefresh: () => void;
  isGlobalCreateMenuOpen: boolean;
  setIsGlobalCreateMenuOpen: (v: boolean) => void;
  openSpreadsheetView: (mode: string) => void;
  searchbarRef: React.RefObject<any>;
}

export const AppModals: React.FC<AppModalsProps> = ({
  createWorkspaceModal,
  setCreateWorkspaceModal,
  backgroundRefresh,
  isGlobalCreateMenuOpen,
  setIsGlobalCreateMenuOpen,
  openSpreadsheetView,
  searchbarRef
}) => {
  return (
    <>
      <AutomationStatusIndicator />
      <NotificationContainer />

      {createWorkspaceModal.isOpen && (
        <div className="fixed inset-0 bg-black/20 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div
            style={{ backgroundColor: 'var(--color-editorBg)' }}
            className="rounded-xl shadow-xl border border-[var(--color-borderDefault)] overflow-hidden w-[500px]"
          >
            <CreateWorkspacePanel onClose={() => setCreateWorkspaceModal((prev: any) => ({ ...prev, isOpen: false }))} />
          </div>
        </div>
      )}

      <GlobalAltCPopup
        isOpen={isGlobalCreateMenuOpen}
        onClose={() => setIsGlobalCreateMenuOpen(false)}
        onCommandSelect={commandId => {
          if (commandId === 'collections') {
            openSpreadsheetView('collections');
            return;
          }
          if (commandId === 'saved-automation') {
            openSpreadsheetView('saved-automation');
            return;
          }
          if (commandId === 'createtodo') {
            useUIStore.getState().openEditor({ type: 'todo', id: 'todo-create', props: { prefill: { isCreateModalOnly: true } } });
            return;
          }
          if (commandId === 'ai') {
            useUIStore.getState().openEditor({ type: 'aiPrompt', id: 'new', props: {} });
            return;
          }
          if (searchbarRef.current) {
            searchbarRef.current.clear();
            setTimeout(() => {
              const mode = commandId === 'store' ? 'lock' : 'execute';
              searchbarRef.current?.executeCommand(commandId as any, { mode });
              searchbarRef.current?.focus();
            }, 10);
          }
        }}
      />

      
    </>
  );
};
