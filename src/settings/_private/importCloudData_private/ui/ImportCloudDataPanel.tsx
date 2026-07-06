import React from 'react';
import { motion } from 'framer-motion';
import { FiCloud, FiAlertCircle } from 'react-icons/fi';

export const ImportCloudDataPanel: React.FC = () => {
  return (
    <div className="space-y-6 px-6 pb-6 text-[var(--color-textPrimary)] select-none">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-[var(--color-textPrimary)]">Import Cloud Data</h2>
        <p className="text-xs text-[var(--color-textSecondary)]">
          Here you can import data from your cloud storage.
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card border border-white/10 rounded-xl p-8 flex flex-col items-center text-center bg-neutral-900/30 backdrop-blur-md"
      >
        <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400 animate-pulse">
          <FiCloud size={24} />
        </div>
        <h3 className="text-sm font-bold text-white mb-2">Coming Soon</h3>
        <p className="text-xs text-[var(--color-textSecondary)] mb-4 max-w-sm">
          This feature is currently under development. You will soon be able to import your database directly from cloud providers.
        </p>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/5 border border-blue-500/10 rounded-lg text-[10px] text-blue-400 font-medium">
          <FiAlertCircle size={12} />
          <span>Under active development</span>
        </div>
      </motion.div>
    </div>
  );
};
