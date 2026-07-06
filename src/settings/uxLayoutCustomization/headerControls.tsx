import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { FiSettings } from 'react-icons/fi';
import { useUIStore } from '../../shared-components/uiStateManager';
import { getDefaultSettingsView } from './settingsLayout';

interface HeaderControlsProps {
  showFavorites: boolean;
  onToggleFavorites: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  isLoggedIn: boolean;
  direction?: 'up' | 'down';
  onOpenSubscriptions?: () => void;
  onOpenManageSubscription?: () => void;
  onCommandListCategoryChange?: (category: string) => void;
  commandListCategory?: string;
  onOpenOrganizationSettings?: (orgId: string, orgName: string) => void;
  onOpenGeneralSettings?: () => void;
}

const HeaderControls: React.FC<HeaderControlsProps> = ({
  isLoggedIn,
  direction = 'down',
}) => {
  return (
    <div className={`relative z-50 flex flex-col ${direction === 'up' ? 'items-end' : 'items-start'} gap-2`}>
      <div className="flex items-center gap-2">
        {/* Settings Icon - opens first tab dynamically */}
        <motion.button
          onClick={() => {
            const currentView = useUIStore.getState().activeView;
            if (currentView?.type === 'settings') {
              useUIStore.getState().setView({ type: 'home' });
            } else {
              useUIStore.getState().setView(getDefaultSettingsView(isLoggedIn));
            }
          }}
          className="p-1.5 bg-transparent border-0 text-[#073642] hover:text-black dark:text-[var(--color-iconDefault)] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors z-[60] flex items-center justify-center rounded-md"
          title="Settings"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}>
          <FiSettings size={20} />
        </motion.button>
      </div>
    </div>
  );
};

export default memo(HeaderControls);
