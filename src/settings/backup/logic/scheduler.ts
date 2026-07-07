import { executeDriveBackup } from './driveApi';

const ALARM_NAME = 'cmdos-drive-backup-alarm';
const PERIOD_IN_MINUTES = 8 * 60; // 8 hours

export const enableAutoBackup = () => {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      console.log(`[Backup Scheduler] Setting up backup alarm every ${PERIOD_IN_MINUTES} minutes.`);
      chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: PERIOD_IN_MINUTES
      });
    }
  });
};

export const disableAutoBackup = () => {
  chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
    if (wasCleared) {
      console.log('[Backup Scheduler] Auto backup alarm disabled.');
    }
  });
};
// This needs to be called inside your background script/service worker
export const handleBackupAlarm = async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[Backup Scheduler] Alarm triggered. Executing Drive backup...');
    try {
      // For automated backups, we can just increment or rely on drive API to manage versions.
      // We will pass 1 here, but ideally we'd fetch the latest version number from local storage.
      await executeDriveBackup(1);
    } catch (err) {
      console.error('[Backup Scheduler] Automated Drive backup failed:', err);
    }
  }
};
