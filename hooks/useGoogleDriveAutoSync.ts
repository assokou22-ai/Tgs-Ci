import { useEffect, useRef, useCallback } from 'react';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { compileFullBackupData } from '../services/backupService.ts';
import { uploadBackupToDrive } from '../services/googleWorkspaceService.ts';
import { addSyncLog } from '../utils/syncLogHelper.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { 
    saveDriveMetadata, 
    enqueueDriveOperation, 
    getDriveQueue, 
    clearDriveQueue, 
    withDriveSyncLock 
} from '../services/driveSyncDb.ts';

const DEBOUNCE_DELAY_MS = 6000; // 6 seconds debounce after data modifications
const PERIODIC_INTERVAL_MS = 8 * 60 * 1000; // 8 minutes background periodic sync

export const useGoogleDriveAutoSync = () => {
    const { 
        googleAccessToken, 
        user, 
        driveMetadata, 
        driveSyncStatus 
    } = useFirebase();
    const { showToast } = useToastContext();

    const isUploadingRef = useRef<boolean>(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialSyncDoneRef = useRef<boolean>(false);

    // Main sync executor protected by cross-tab lock and error resilience
    const runDriveSync = useCallback(async (
        type: 'initial' | 'data_change' | 'periodic' | 'manual',
        isManual: boolean = false
    ) => {
        if (isUploadingRef.current) {
            console.log(`[GoogleDriveAutoSync] Sync already in progress. Enqueueing ${type}.`);
            await enqueueDriveOperation(type);
            return;
        }

        // Check network connection
        if (!navigator.onLine) {
            console.log(`[GoogleDriveAutoSync] Offline detected. Queuing ${type} operation.`);
            await enqueueDriveOperation(type);
            await saveDriveMetadata({
                syncStatus: 'offline_pending',
                lastError: 'Connexion réseau absente. Données prêtes à être envoyées.',
            });
            if (isManual) {
                showToast("Mode hors ligne : opération mise en attente.", "warning");
            }
            return;
        }

        // Check if token is present
        if (!googleAccessToken) {
            if (driveMetadata.driveConnected) {
                await enqueueDriveOperation(type);
                await saveDriveMetadata({
                    syncStatus: 'action_required',
                    lastError: 'Session expirée (reconnexion requise)',
                });
            }
            if (isManual) {
                showToast("Compte Google non connecté. Veuillez vous reconnecter.", "warning");
            }
            return;
        }

        // Check autoSyncEnabled preference (manual bypasses this)
        if (!isManual && !driveMetadata.autoSyncEnabled) {
            console.log('[GoogleDriveAutoSync] Auto-sync is paused by user preference.');
            return;
        }

        await withDriveSyncLock(async () => {
            isUploadingRef.current = true;
            await saveDriveMetadata({ syncStatus: 'syncing' });
            window.dispatchEvent(new CustomEvent('gdrive-syncing-state', { detail: { syncing: true } }));

            if (isManual) {
                showToast("Sauvegarde vers Google Drive en cours...", "info");
            }

            try {
                const backupPayload = await compileFullBackupData();
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
                const device = (navigator.userAgent.match(/(Macintosh|Windows|iPhone|Android)/) || ['Atelier'])[0];
                
                const fileName = `${dateStr}_${timeStr}_TGS-CI_${type.toUpperCase()}_${device}.json`;

                // Upload to Google Drive
                await uploadBackupToDrive(googleAccessToken, backupPayload, fileName);

                // Update metadata and clear queue
                const nowIso = now.toISOString();
                await clearDriveQueue();
                await saveDriveMetadata({
                    lastSyncTime: nowIso,
                    syncStatus: 'synced',
                    lastError: null,
                    pendingCount: 0,
                });

                localStorage.setItem('tgs_last_gdrive_sync_time', nowIso);
                window.dispatchEvent(new CustomEvent('gdrive-last-sync-time', { detail: { time: now } }));

                addSyncLog(
                    'Google Drive',
                    isManual ? 'Sauvegarde Manuelle' : 'Auto-Synchronisation',
                    'success',
                    user?.email || driveMetadata.connectedEmail || 'Atelier',
                    `Archive envoyée avec succès sur Google Drive : "${fileName}" (${type})`
                );

                if (isManual) {
                    showToast("✅ Données synchronisées avec succès sur votre Google Drive !", "success");
                }
            } catch (err: unknown) {
                console.error("[GoogleDriveAutoSync] Backup failed:", err);
                const errMsg = err instanceof Error ? err.message : String(err);
                const isAuthError = errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('invalid_grant');

                if (isAuthError) {
                    await saveDriveMetadata({
                        syncStatus: 'action_required',
                        lastError: 'Session Google expirée. Veuillez réautoriser le compte.',
                    });
                    if (isManual) {
                        showToast("Session Google expirée. Reconnexion requise.", "warning");
                    }
                } else {
                    await enqueueDriveOperation(type);
                    await saveDriveMetadata({
                        syncStatus: 'offline_pending',
                        lastError: `En attente de connexion : ${errMsg.slice(0, 80)}`,
                    });
                    if (isManual) {
                        showToast(`Erreur réseau temporaire : ${errMsg.slice(0, 60)}`, "error");
                    }
                }

                addSyncLog(
                    'Google Drive',
                    isManual ? 'Sauvegarde Manuelle' : 'Auto-Synchronisation',
                    'error',
                    user?.email || driveMetadata.connectedEmail || 'Atelier',
                    `Échec archivage Drive : ${errMsg}`
                );
            } finally {
                isUploadingRef.current = false;
                window.dispatchEvent(new CustomEvent('gdrive-syncing-state', { detail: { syncing: false } }));
            }
        });
    }, [googleAccessToken, driveMetadata.driveConnected, driveMetadata.autoSyncEnabled, driveMetadata.connectedEmail, user, showToast]);

    // 1. Initial background sync when connected
    useEffect(() => {
        if (!googleAccessToken || initialSyncDoneRef.current) return;
        
        const initialTimer = setTimeout(() => {
            initialSyncDoneRef.current = true;
            runDriveSync('initial', false);
        }, 3500);

        return () => clearTimeout(initialTimer);
    }, [googleAccessToken, runDriveSync]);

    // 2. Debounced auto-sync on critical data modifications
    useEffect(() => {
        if (!googleAccessToken || !driveMetadata.autoSyncEnabled) return;

        const handleDataModified = () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = setTimeout(() => {
                runDriveSync('data_change', false);
            }, DEBOUNCE_DELAY_MS);
        };

        window.addEventListener('datachanged', handleDataModified);
        window.addEventListener('requestsync', handleDataModified);
        window.addEventListener('syncsuccess', handleDataModified);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            window.removeEventListener('datachanged', handleDataModified);
            window.removeEventListener('requestsync', handleDataModified);
            window.removeEventListener('syncsuccess', handleDataModified);
        };
    }, [googleAccessToken, driveMetadata.autoSyncEnabled, runDriveSync]);

    // 3. Periodic light sync every 8 minutes
    useEffect(() => {
        if (!googleAccessToken || !driveMetadata.autoSyncEnabled) return;

        const interval = setInterval(() => {
            runDriveSync('periodic', false);
        }, PERIODIC_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [googleAccessToken, driveMetadata.autoSyncEnabled, runDriveSync]);

    // 4. Online reconnection handler: drains queue automatically upon network return
    useEffect(() => {
        const handleOnline = async () => {
            console.log('[GoogleDriveAutoSync] Internet restored. Checking offline queue...');
            const queue = await getDriveQueue();
            if (queue.length > 0 || driveSyncStatus === 'offline_pending') {
                runDriveSync('data_change', false);
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [driveSyncStatus, runDriveSync]);

    // 5. Manual sync listener
    useEffect(() => {
        const handleManualRequested = () => {
            runDriveSync('manual', true);
        };

        window.addEventListener('manual-gdrive-sync', handleManualRequested);
        return () => window.removeEventListener('manual-gdrive-sync', handleManualRequested);
    }, [runDriveSync]);

    return {
        isSyncingDrive: isUploadingRef.current,
        driveSyncStatus,
        lastAutoBackupTime: driveMetadata.lastSyncTime ? new Date(driveMetadata.lastSyncTime) : null,
        pendingCount: driveMetadata.pendingCount,
    };
};
