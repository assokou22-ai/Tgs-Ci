import { useEffect, useRef, useCallback } from 'react';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { compileFullBackupData, mergeDatabaseFromFile } from '../services/backupService.ts';
import { uploadBackupToDrive, listBackupsFromDrive, downloadBackupFromDrive } from '../services/googleWorkspaceService.ts';
import { addSyncLog } from '../utils/syncLogHelper.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { 
    saveDriveMetadata, 
    enqueueDriveOperation, 
    getDriveQueue, 
    clearDriveQueue, 
    withDriveSyncLock 
} from '../services/driveSyncDb.ts';

const DEBOUNCE_DELAY_MS = 4000; // 4 seconds debounce after data modifications
const PERIODIC_INTERVAL_MS = 45 * 1000; // 45 seconds periodic check for fast real-time sync across devices

export const useGoogleDriveAutoSync = () => {
    const { 
        googleAccessToken, 
        user, 
        driveMetadata, 
        driveSyncStatus 
    } = useFirebase();
    const { showToast } = useToastContext();

    const isSyncingRef = useRef<boolean>(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialSyncDoneRef = useRef<boolean>(false);
    const lastUploadedFileIdRef = useRef<string | null>(null);

    // Fonction de récupération et fusion des données créées ou modifiées par d'autres appareils connectés au même Drive
    const pullLatestFromDrive = useCallback(async (token: string, silent: boolean = true) => {
        try {
            const backups = await listBackupsFromDrive(token);
            if (!backups || backups.length === 0) return false;

            const latest = backups[0];
            const lastImportedId = localStorage.getItem('tgs_last_imported_drive_file_id');
            const lastSyncTimeStr = localStorage.getItem('tgs_last_gdrive_sync_time');
            const lastSyncTime = lastSyncTimeStr ? new Date(lastSyncTimeStr).getTime() : 0;
            const remoteFileTime = new Date(latest.createdTime).getTime();

            // Si le fichier le plus récent sur Drive a été téléversé par CETTE session précise, pas besoin de réimporter
            if (latest.id === lastUploadedFileIdRef.current) {
                return false;
            }

            // Si c'est un nouveau fichier créé par un autre poste ou plus récent que notre dernier sync
            const isNewerFile = latest.id !== lastImportedId && (remoteFileTime > lastSyncTime || !lastImportedId);

            if (isNewerFile) {
                console.log(`[GoogleDriveAutoSync] Fichier distant plus récent détecté sur Drive (${latest.name}, créé le ${latest.createdTime}). Synchronisation descendante...`);
                if (!silent) {
                    showToast("Synchronisation des modifications reçues du Drive...", "info");
                }

                const remoteData = await downloadBackupFromDrive(token, latest.id);
                if (remoteData) {
                    await mergeDatabaseFromFile(remoteData);
                    localStorage.setItem('tgs_last_imported_drive_file_id', latest.id);
                    localStorage.setItem('tgs_last_gdrive_sync_time', latest.createdTime);

                    // Notifier l'ensemble de l'interface et les hooks de tickets en temps réel
                    window.dispatchEvent(new CustomEvent('datareceived'));
                    window.dispatchEvent(new CustomEvent('tickets-updated'));
                    window.dispatchEvent(new CustomEvent('datachanged'));
                    window.dispatchEvent(new CustomEvent('syncsuccess'));

                    // Diffusion inter-onglets/fenêtres locales
                    try {
                        const channel = new BroadcastChannel('tgs_realtime_sync');
                        channel.postMessage({ type: 'drive_sync_received', fileId: latest.id });
                        channel.close();
                    } catch {
                        // BroadcastChannel optionnel
                    }

                    addSyncLog(
                        'Google Drive',
                        'Mise à jour multi-appareils',
                        'success',
                        user?.email || driveMetadata.connectedEmail || 'Atelier',
                        `Données fusionnées en temps réel depuis l'appareil distant : "${latest.name}"`
                    );

                    if (!silent) {
                        showToast("✅ Données synchronisées en temps réel avec les autres appareils !", "success");
                    }
                    return true;
                }
            }
        } catch (err) {
            console.warn("[GoogleDriveAutoSync] Échec de la vérification descendante depuis Drive:", err);
        }
        return false;
    }, [user, driveMetadata.connectedEmail, showToast]);

    // Main sync executor protected by cross-tab lock and error resilience
    const runDriveSync = useCallback(async (
        type: 'initial' | 'data_change' | 'periodic' | 'manual',
        isManual: boolean = false
    ) => {
        if (isSyncingRef.current) {
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
            isSyncingRef.current = true;
            await saveDriveMetadata({ syncStatus: 'syncing' });
            window.dispatchEvent(new CustomEvent('gdrive-syncing-state', { detail: { syncing: true } }));

            if (isManual) {
                showToast("Synchronisation avec Google Drive en cours...", "info");
            }

            try {
                // 1. Toujours vérifier d'abord les mises à jour distantes déposées par les autres postes
                await pullLatestFromDrive(googleAccessToken, !isManual);

                // 2. Si c'est une modification locale ou une synchronisation manuelle, on compile et envoie l'état consolidé
                if (type === 'data_change' || type === 'manual' || type === 'initial') {
                    const backupPayload = await compileFullBackupData();
                    const now = new Date();
                    const dateStr = now.toISOString().split('T')[0];
                    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
                    const device = (navigator.userAgent.match(/(Macintosh|Windows|iPhone|Android)/) || ['Atelier'])[0];
                    
                    const fileName = `${dateStr}_${timeStr}_TGS-CI_${type.toUpperCase()}_${device}.json`;

                    // Upload to Google Drive
                    const uploadedId = await uploadBackupToDrive(googleAccessToken, backupPayload, fileName);
                    lastUploadedFileIdRef.current = uploadedId;
                    localStorage.setItem('tgs_last_imported_drive_file_id', uploadedId);

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
                } else {
                    // Pour un cycle périodique simple : mettre à jour le statut en 'synced'
                    await saveDriveMetadata({
                        syncStatus: 'synced',
                        lastError: null,
                        pendingCount: 0,
                    });
                }
            } catch (err: unknown) {
                console.error("[GoogleDriveAutoSync] Sync failed:", err);
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
                    `Échec synchronisation Drive : ${errMsg}`
                );
            } finally {
                isSyncingRef.current = false;
                window.dispatchEvent(new CustomEvent('gdrive-syncing-state', { detail: { syncing: false } }));
            }
        });
    }, [googleAccessToken, driveMetadata.driveConnected, driveMetadata.autoSyncEnabled, driveMetadata.connectedEmail, user, showToast, pullLatestFromDrive]);

    // 1. Initial background sync when connected (PULL first, then PUSH)
    useEffect(() => {
        if (!googleAccessToken || initialSyncDoneRef.current) return;
        
        const initialTimer = setTimeout(() => {
            initialSyncDoneRef.current = true;
            runDriveSync('initial', false);
        }, 2000);

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

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            window.removeEventListener('datachanged', handleDataModified);
            window.removeEventListener('requestsync', handleDataModified);
        };
    }, [googleAccessToken, driveMetadata.autoSyncEnabled, runDriveSync]);

    // 3. Periodic real-time poll across all devices connected to Drive (every 3 minutes)
    useEffect(() => {
        if (!googleAccessToken || !driveMetadata.autoSyncEnabled) return;

        const interval = setInterval(() => {
            runDriveSync('periodic', false);
        }, PERIODIC_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [googleAccessToken, driveMetadata.autoSyncEnabled, runDriveSync]);

    // 4. Poll immediately when user switches tabs or returns to the application window
    useEffect(() => {
        if (!googleAccessToken || !driveMetadata.autoSyncEnabled) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                pullLatestFromDrive(googleAccessToken, true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleVisibilityChange);
        };
    }, [googleAccessToken, driveMetadata.autoSyncEnabled, pullLatestFromDrive]);

    // 5. Online reconnection handler: drains queue automatically upon network return
    useEffect(() => {
        const handleOnline = async () => {
            console.log('[GoogleDriveAutoSync] Internet restored. Checking offline queue...');
            const queue = await getDriveQueue();
            if (queue.length > 0 || driveSyncStatus === 'offline_pending') {
                runDriveSync('data_change', false);
            } else if (googleAccessToken) {
                pullLatestFromDrive(googleAccessToken, true);
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [driveSyncStatus, googleAccessToken, runDriveSync, pullLatestFromDrive]);

    // 6. Manual sync listener
    useEffect(() => {
        const handleManualRequested = () => {
            runDriveSync('manual', true);
        };

        window.addEventListener('manual-gdrive-sync', handleManualRequested);
        return () => window.removeEventListener('manual-gdrive-sync', handleManualRequested);
    }, [runDriveSync]);

    return {
        isSyncingDrive: isSyncingRef.current,
        driveSyncStatus,
        lastAutoBackupTime: driveMetadata.lastSyncTime ? new Date(driveMetadata.lastSyncTime) : null,
        pendingCount: driveMetadata.pendingCount,
    };
};
