import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCloud, 
  FiUpload, 
  FiCheck, 
  FiDatabase, 
  FiFolder, 
  FiRefreshCw,
  FiPlus,
  FiSettings,
  FiHardDrive,
  FiX,
  FiArrowRight
} from 'react-icons/fi';
import { 
  executeDriveBackup, 
  getDriveToken, 
  listBackupsFromDrive, 
  downloadBackupFromDrive,
  DriveFolder
} from '../logic/driveApi';
import { exportLocalZipBackup } from '../logic/zipExport';
import { extractDatabaseToJSON } from '../logic/extractData';
import { restoreDatabaseFromJSON } from '../logic/restoreData';
import { useDbStore } from '../../../storage/store/useDbStore';
import { useUIStore } from '../../../shared-components/uiStateManager';
import { getAvatarColor, getSingleInitial } from '../../../shared-components/utils/avatarColors';
import { useRelativeSavedTime } from '../../../shared-components/utils';

import CreateWorkspacePanel from '../../allWorkspaceManager/workspaces/ui/CreateWorkspacePanel';
import JSZip from 'jszip';

const GoogleDriveIcon: React.FC = () => (
  <svg className="w-12 h-12 shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M19.3496 14.6504L13.9996 4.3999L9.99961 4.3999L15.3496 14.6504H19.3496Z" fill="#FFC107" />
    <path d="M9.99961 4.3999L4.64961 14.6504L6.64961 18.1504L11.9996 7.8999L9.99961 4.3999Z" fill="#00E676" />
    <path d="M15.3496 14.6504L11.9996 18.1504L6.64961 18.1504L9.99961 14.6504L15.3496 14.6504Z" fill="#2196F3" />
  </svg>
);

interface BackupSettingsProps {
  onClose?: () => void;
}

export const BackupSettings: React.FC<BackupSettingsProps> = ({ onClose }) => {
  const workspaces = useDbStore(state => state.workspaces);
  const selectedWorkspaceId = useUIStore(state => state.selectedWorkspaceId);
  const setSelectedWorkspaceId = useUIStore(state => state.setSelectedWorkspaceId);

  const [backupMode, setBackupMode] = useState<'drive' | 'local'>('local');
  const [userEmail, setUserEmail] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [version, setVersion] = useState(1);
  const [backups, setBackups] = useState<DriveFolder[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const lastSyncedMessage = useRelativeSavedTime(lastSyncedAt);


  // Default to first workspace if none selected
  const activeWorkspace = workspaces.find(w => w.id === selectedWorkspaceId) || workspaces[0];

  // Load configuration and check auth on mount
  useEffect(() => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        setIsConnected(true);
        loadBackups();
        chrome.identity.getProfileUserInfo?.((userInfo) => {
          if (userInfo && userInfo.email) {
            setUserEmail(userInfo.email);
          }
        });
      }
    });

    chrome.storage.local.get(['user_email', 'email'], (res) => {
      if (res.user_email || res.email) {
        setUserEmail(res.user_email || res.email);
      }
    });
  }, []);

  // Sync mode key when active workspace changes
  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const modeKey = `backupMode_${activeWorkspace.id}`;
    const syncTimeKey = `lastSyncedAt_${activeWorkspace.id}`;
    chrome.storage.local.get([modeKey, syncTimeKey], (res) => {
      setBackupMode(res[modeKey] || 'local');
      if (res[syncTimeKey]) {
        setLastSyncedAt(new Date(res[syncTimeKey]));
      } else {
        setLastSyncedAt(null);
      }
    });
  }, [activeWorkspace?.id]);


  const handleConnect = async () => {
    try {
      await getDriveToken(); // triggers interactive OAuth
      setIsConnected(true);
      if (activeWorkspace?.id) {
        const modeKey = `backupMode_${activeWorkspace.id}`;
        setBackupMode('drive');
        chrome.storage.local.set({ [modeKey]: 'drive' });
      }
      await loadBackups();
      chrome.identity.getProfileUserInfo?.((userInfo) => {
        if (userInfo && userInfo.email) {
          setUserEmail(userInfo.email);
          chrome.storage.local.set({ user_email: userInfo.email });
        }
      });
    } catch (err) {
      console.error('Failed to connect to Google Drive', err);
      alert('Authentication failed.');
    }
  };

  const handleSwitchMode = (mode: 'drive' | 'local') => {
    if (!activeWorkspace?.id) return;
    const modeKey = `backupMode_${activeWorkspace.id}`;
    if (mode === 'drive' && !isConnected) {
      handleConnect();
    } else {
      setBackupMode(mode);
      chrome.storage.local.set({ [modeKey]: mode });
    }
  };

  const loadBackups = async () => {
    try {
      const list = await listBackupsFromDrive();
      setBackups(list);
    } catch (err) {
      console.error('Failed to load backups', err);
    }
  };

  const handleBackupNow = async () => {
    setIsSyncing(true);
    try {
      if (backupMode === 'drive') {
        await executeDriveBackup(version);
        setVersion(v => v + 1);
        await loadBackups();
        
        const now = new Date();
        setLastSyncedAt(now);
        if (activeWorkspace?.id) {
          chrome.storage.local.set({ [`lastSyncedAt_${activeWorkspace.id}`]: now.toISOString() });
        }

        alert('Backup completed successfully! Uploaded to Google Drive.');
      } else {
        await exportLocalZipBackup(version);
        setVersion(v => v + 1);
        alert('Backup completed successfully! Local ZIP file downloaded.');
      }
    } catch (err) {
      console.error(err);
      alert('Backup failed. Check console for details.');
    } finally {
      setIsSyncing(false);
    }
  };


  const handleRestoreFromDrive = async () => {
    if (backups.length === 0) {
      alert('No backups found in Google Drive to restore from.');
      return;
    }

    // Select the latest backup automatically or prompt
    const latestBackup = backups[0];
    const confirmed = window.confirm(`WARNING: This will completely erase your current local data and replace it with the selected backup: "${latestBackup.name}". Are you sure you want to proceed?`);
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const backupData = await downloadBackupFromDrive(latestBackup.id);
      await restoreDatabaseFromJSON(backupData);
      alert('Database successfully restored! Reloading application...');
      window.location.reload();
    } catch (err) {
      console.error('Failed to restore database', err);
      alert('Restoration failed. Check console.');
    } finally {
      setIsRestoring(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const confirmed = window.confirm("WARNING: This will completely erase your current local data and replace it with this local ZIP backup. Are you sure you want to proceed?");
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(file);
      
      const backupData: any = {
        manifest: null,
        tables: {}
      };

      // Extract manifest
      const manifestFile = unzipped.file('manifest.json');
      if (!manifestFile) throw new Error('Invalid backup ZIP: missing manifest.json');
      backupData.manifest = JSON.parse(await manifestFile.async('string'));

      // Extract tables
      for (const relativePath of Object.keys(unzipped.files)) {
        if (relativePath.endsWith('.json') && relativePath !== 'manifest.json') {
          const tableName = relativePath.replace('.json', '');
          const tableContent = await unzipped.file(relativePath)?.async('string');
          if (tableContent) {
            backupData.tables[tableName] = JSON.parse(tableContent);
          }
        }
      }

      await restoreDatabaseFromJSON(backupData);
      alert('Local Database successfully restored! Reloading application...');
      window.location.reload();
    } catch (err) {
      console.error('Failed to restore from local ZIP', err);
      alert('Local restoration failed. Please ensure you uploaded a valid backup ZIP.');
    } finally {
      setIsRestoring(false);
    }
  };

  const navigateToAllWorkspaces = () => {
    useUIStore.getState().setView({ type: 'settings', section: 'allWorkspaces' });
  };

  return (
    <div className="flex h-full w-full bg-[var(--color-appBg)] text-[var(--color-textPrimary)] select-none">
      {/* ── LEFT WORKSPACE LIST SIDEBAR ── */}
      <div className="w-[240px] shrink-0 border-r border-[var(--color-borderDefault)] flex flex-col justify-between p-4 bg-[var(--color-sidebarBg)]/30 backdrop-blur-md">
        <div className="space-y-4">
          <div className="px-2 text-[10px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase select-none opacity-80">
            Workspaces
          </div>
          <div className="space-y-1.5 overflow-y-auto max-h-[400px] custom-scrollbar pr-1">
            {workspaces.map(ws => {
              const isActive = activeWorkspace?.id === ws.id;
              return (
                <div
                  key={ws.id}
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer border-l-3 ${
                    isActive
                      ? 'border-blue-500 bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] shadow-sm'
                      : 'border-transparent text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
                  }`}
                >
                  <div className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold text-white shadow-sm ${getAvatarColor(ws.workspaceName)}`}>
                    {getSingleInitial(ws.workspaceName)}
                  </div>
                  <span className="truncate">{ws.workspaceName}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <button
            onClick={() => setShowCreateOrg(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] transition-all cursor-pointer border-none bg-transparent"
          >
            <FiPlus size={14} className="text-[var(--color-textMuted)]" />
            <span>Add workspace</span>
          </button>
          <button
            onClick={navigateToAllWorkspaces}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] transition-all cursor-pointer border-none bg-transparent"
          >
            <FiSettings size={14} className="text-[var(--color-textMuted)]" />
            <span>Workspace settings</span>
          </button>
        </div>
      </div>

      {/* ── RIGHT MAIN PANEL ── */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto custom-scrollbar relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-8 right-8 p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 z-10"
            title="Close"
          >
            <FiX size={16} />
          </button>
        )}
        <div className="space-y-1.5 mb-8">
          <h2 className="text-xl font-bold text-[var(--color-textPrimary)]">Workspace backup & restore</h2>
          <p className="text-xs text-[var(--color-textSecondary)]">
            Select how you want to back up or restore data for this workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 items-start max-w-4xl">
          {/* ── GOOGLE DRIVE CARD ── */}
          <div 
            className={`flex flex-col justify-between min-h-[380px] p-6 rounded-2xl bg-[var(--color-cardBg)]/60 border-2 transition-all ${
              backupMode === 'drive'
                ? 'border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                : 'border-[var(--color-borderDefault)]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <FiCloud size={18} className="text-[var(--color-textSecondary)]" />
                  <span className="text-sm font-bold text-white">Google Drive</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                  backupMode === 'drive'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {backupMode === 'drive' ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="flex flex-col items-center text-center mt-4 mb-6">
                <GoogleDriveIcon />
                <div className="flex items-center gap-1.5 mt-4">
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
                  <span className="text-xs font-bold text-white">
                    {isConnected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                {isConnected && userEmail && (
                  <span className="text-[10px] text-[var(--color-textMuted)] mt-1">{userEmail}</span>
                )}
                {isConnected && lastSyncedAt && (
                  <span className="text-[10px] text-emerald-400 mt-1">Synced {lastSyncedMessage}</span>
                )}
              </div>

              <p className="text-xs text-[var(--color-textSecondary)] text-center leading-relaxed px-4">
                {backupMode === 'drive'
                  ? 'Backups are automatically synced to Drive.'
                  : 'Backups are saved to Drive and can be accessed from anywhere.'}
              </p>
            </div>

            <div className="mt-8 space-y-2">
              {backupMode === 'drive' ? (
                <>
                  <button
                    onClick={handleBackupNow}
                    disabled={isSyncing || isRestoring || !isConnected}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md text-xs cursor-pointer border-none"
                  >
                    {isSyncing ? (
                      <>
                        <FiRefreshCw className="animate-spin" size={13} />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <FiCloud size={13} />
                        Backup now
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleRestoreFromDrive}
                    disabled={true}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-white font-semibold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
                  >
                    <FiRefreshCw size={13} />
                    Replace data
                  </button>
                  <button
                    onClick={() => handleSwitchMode('local')}
                    disabled={true}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-white font-semibold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
                  >
                    <FiDownloadBackupIcon />
                    Download backup
                  </button>



                </>
              ) : (
                <button
                  onClick={() => handleSwitchMode('drive')}
                  disabled={isSyncing || isRestoring}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-white font-bold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer"
                >
                  <span>Switch to Drive</span>
                  <FiArrowRight size={13} />
                </button>
              )}
            </div>
          </div>

          {/* ── LOCAL DATA CARD ── */}
          <div 
            className={`flex flex-col justify-between min-h-[380px] p-6 rounded-2xl bg-[var(--color-cardBg)]/60 border-2 transition-all ${
              backupMode === 'local'
                ? 'border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                : 'border-[var(--color-borderDefault)]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <FiHardDrive size={18} className="text-[var(--color-textSecondary)]" />
                  <span className="text-sm font-bold text-white">Local data</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                  backupMode === 'local'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {backupMode === 'local' ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="flex flex-col items-center text-center mt-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
                  <FiHardDrive size={24} />
                </div>
                <div className="flex items-center gap-1.5 mt-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-white">Stored on this device</span>
                </div>
              </div>

              <p className="text-xs text-[var(--color-textSecondary)] text-center leading-relaxed px-4">
                {backupMode === 'local'
                  ? 'Backups are saved locally on this device.'
                  : 'Backups are saved locally and are not synced to the cloud.'}
              </p>
            </div>

            <div className="mt-8 space-y-2">
              {backupMode === 'local' ? (
                <>
                  <button
                    onClick={handleBackupNow}
                    disabled={isSyncing || isRestoring}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md text-xs cursor-pointer border-none"
                  >
                    {isSyncing ? (
                      <>
                        <FiRefreshCw className="animate-spin" size={13} />
                        Backing up...
                      </>
                    ) : (
                      <>
                        <FiCloud size={13} />
                        Backup now
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSyncing || isRestoring}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-white font-semibold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
                  >
                    <FiRefreshCw size={13} />
                    Replace data
                  </button>
                  <button
                    onClick={handleBackupNow}
                    disabled={isSyncing || isRestoring}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-white font-semibold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
                  >
                    <FiDownloadBackupIcon />
                    Download backup
                  </button>

                </>
              ) : (
                <button
                  onClick={() => handleSwitchMode('local')}
                  disabled={isSyncing || isRestoring}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-white font-bold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer"
                >
                  <span>Switch to Local data</span>
                  <FiArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file selector for local backup restoration */}
      <input 
        type="file" 
        accept=".zip" 
        ref={fileInputRef}
        onChange={handleLocalRestore} 
        className="hidden" 
      />

      {/* ── CREATE WORKSPACE POPUP MODAL ── */}
      <AnimatePresence>
        {showCreateOrg && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/45"
            onClick={() => setShowCreateOrg(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-[480px] h-[320px] flex flex-col bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative"
            >
              <CreateWorkspacePanel
                onClose={() => setShowCreateOrg(false)}
                onSuccess={() => setShowCreateOrg(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FiDownloadBackupIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
