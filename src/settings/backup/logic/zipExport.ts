import JSZip from 'jszip';
import { extractDatabaseToJSON } from './extractData';

export const exportLocalZipBackup = async (versionNumber: number = 1): Promise<void> => {
  try {
    const backupData = await extractDatabaseToJSON(versionNumber);
    const zip = new JSZip();

    // Add manifest to root
    zip.file('manifest.json', JSON.stringify(backupData.manifest, null, 2));

    // Add each table as a JSON file
    for (const [tableName, records] of Object.entries(backupData.tables)) {
      zip.file(`${tableName}.json`, JSON.stringify(records, null, 2));
    }

    // Generate zip blob
    const content = await zip.generateAsync({ type: 'blob' });

    // Trigger download
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cmdos-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[Backup Export] Failed to generate local ZIP backup:', error);
    throw error;
  }
};
