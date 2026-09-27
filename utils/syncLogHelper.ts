export interface SyncLogEntry {
    id: string;
    timestamp: string;
    type: 'Google Drive' | 'Email' | 'Offline JSON' | 'Cloud Realtime';
    action: 'Téléversement (Backup)' | 'Restauration (Import)' | 'Envoi Email' | 'Fichier Local' | 'Flux Temps Réel';
    status: 'success' | 'error';
    operator: string;
    details: string;
}

export const getSyncLogs = (): SyncLogEntry[] => {
    try {
        const raw = localStorage.getItem('tgs_sync_logs') || '[]';
        return JSON.parse(raw);
    } catch (e) {
        console.error("Failed to read sync logs", e);
        return [];
    }
};

export const addSyncLog = (
    type: 'Google Drive' | 'Email' | 'Offline JSON' | 'Cloud Realtime',
    action: 'Téléversement (Backup)' | 'Restauration (Import)' | 'Envoi Email' | 'Fichier Local' | 'Flux Temps Réel',
    status: 'success' | 'error',
    operator: string,
    details: string
) => {
    try {
        const logs = getSyncLogs();
        const newEntry: SyncLogEntry = {
            id: `synclog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            type,
            action,
            status,
            operator,
            details
        };
        logs.unshift(newEntry);
        // Retain last 200 items for robust auditing without bloating localStorage
        localStorage.setItem('tgs_sync_logs', JSON.stringify(logs.slice(0, 200)));
        window.dispatchEvent(new CustomEvent('synclogs_updated'));
    } catch (e) {
        console.error("Failed to append sync log", e);
    }
};

export const clearSyncLogs = () => {
    try {
        localStorage.setItem('tgs_sync_logs', '[]');
        window.dispatchEvent(new CustomEvent('synclogs_updated'));
    } catch (e) {
        console.error("Failed to clear sync logs", e);
    }
};
