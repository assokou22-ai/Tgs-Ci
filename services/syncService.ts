
import { 
    dbGetSyncQueue, 
    dbPutSyncQueueItem,
    dbDeleteSyncQueueItems,
    dbGetTickets, 
    dbGetStock, 
    dbGetServices, 
    dbGetSuggestions, 
    dbGetAppointments, 
    dbGetFactures, 
    dbGetProformas, 
    dbGetCommandes,
    dbGetSimpleDocuments, 
    dbGetStoredDocuments, 
    dbGetStockUsage, 
    dbGetExternalPurchases,
    dbGetEngagementsSav,
    dbGetMouvementsStock,
    getDB
} from './dbService.ts';
import { SyncQueueItem, EntityType, RepairTicket } from '../types.ts';
import { pushEntityToCloud } from './cloudWrite.ts';
import { optimizeTicketForFirestore } from '../utils/imageCompression.ts';
import { dehydrateForCloud, hydrateFromCloudBestEffort, mergeUnresolvedMediaFallback, hasMediaRefs, warmMediaCacheFromRecord } from './cloudMedia.ts';
import { resolveIncrementalSince, advanceCollectionWatermark } from './syncWatermark.ts';

// --- State Management ---
// A simple event emitter to notify UI components of state changes.
const emitter = new EventTarget();

interface SyncState {
    pendingChanges: number;
    isSyncing: boolean;
    lastSync: Date | null;
    needsAnotherRun?: boolean;
    lastError?: string | null;
    isQuotaExceeded?: boolean;
}

let syncState: SyncState = {
    pendingChanges: 0,
    isSyncing: false,
    lastSync: null,
    needsAnotherRun: false,
    lastError: null,
    isQuotaExceeded: false,
};

// Update the shared state and notify listeners
const updateState = (newState: Partial<SyncState>) => {
    syncState = { ...syncState, ...newState };
    emitter.dispatchEvent(new CustomEvent('syncstatechange', { detail: { ...syncState } }));
};

// Exported for hooks to get initial state and subscribe to changes
export const getSyncState = () => ({ ...syncState });
export const syncStateEmitter = emitter;


// --- Core Sync Logic ---
import { doc, getDoc, getDocFromServer, collection, getDocs, setDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import { db, auth, isQuotaCooldownActive, isQuotaExceededError, reportQuotaExceeded, clearQuotaCooldown, getQuotaStatus } from './firebase.ts';
import { bulkPut, dbGet } from './dbService.ts';
import { addSyncLog } from '../utils/syncLogHelper.ts';
import { mergeUpdates } from '../utils/merge.ts';

let quotaRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

if (typeof window !== 'undefined') {
    window.addEventListener('syncquotaexceeded', (e: Event) => {
        const detail = e instanceof CustomEvent ? (e.detail as { message?: string; until?: number } | undefined) : undefined;
        const msg = detail?.message
            ? String(detail.message)
            : 'Quota journalier Cloud Firestore atteint.';
        updateState({ isQuotaExceeded: true, lastError: msg });

        const delayMs = detail?.until ? Math.max(5_000, detail.until - Date.now() + 1_000) : 5 * 60_000 + 1_000;
        if (quotaRecoveryTimer) clearTimeout(quotaRecoveryTimer);
        quotaRecoveryTimer = setTimeout(() => {
            quotaRecoveryTimer = null;
            if (!isQuotaCooldownActive() && syncState.isQuotaExceeded) {
                updateState({ isQuotaExceeded: false, lastError: null });
            }
        }, delayMs);
    });
}

const collectionMap: Record<EntityType, string> = {
    'ticket': 'tickets',
    'stock': 'stock',
    'stockUsage': 'stockUsage',
    'externalPurchase': 'externalPurchases',
    'service': 'services',
    'facture': 'factures',
    'proforma': 'proformas',
    'commande': 'commandes',
    'appointment': 'appointments',
    'simpleDocument': 'simpleDocuments',
    'storedDocument': 'storedDocuments',
    'suggestions': 'suggestions',
    'deviceSession': 'deviceSessions',
    'engagementSav': 'engagementsSav',
    'mouvementStock': 'mouvementsStock'
};

const getEntityTypeFromStore = (storeName: string): EntityType | null => {
    switch (storeName) {
        case 'tickets': return 'ticket';
        case 'stock': return 'stock';
        case 'stockUsage': return 'stockUsage';
        case 'externalPurchases': return 'externalPurchase';
        case 'services': return 'service';
        case 'factures': return 'facture';
        case 'proformas': return 'proforma';
        case 'commandes': return 'commande';
        case 'appointments': return 'appointment';
        case 'simpleDocuments': return 'simpleDocument';
        case 'knowledge_files': return 'storedDocument';
        case 'suggestions': return 'suggestions';
        case 'engagementsSav': return 'engagementSav';
        case 'mouvementsStock': return 'mouvementStock';
        default: return null;
    }
};

/**
 * Returns a priority level for each entity type.
 * High values are synchronized first (e.g., tickets).
 * Low values are synchronized last (e.g., deviceSession / session logs).
 */
export const getEntityPriority = (entity: EntityType): number => {
    switch (entity) {
        case 'ticket':
            return 100; // Priority 1: Tickets are the most critical business information
        case 'facture':
        case 'proforma':
        case 'commande':
        case 'engagementSav':
        case 'appointment':
            return 50;  // Priority 2: Invoices, orders, SAV actions and appointments
        case 'stock':
        case 'stockUsage':
        case 'externalPurchase':
        case 'service':
            return 40;  // Priority 3: Stock management and references
        case 'deviceSession':
            return 10;  // Priority 4 (Low): Session logs
        case 'suggestions':
        case 'simpleDocument':
        case 'storedDocument':
        case 'mouvementStock':
        default:
            return 20;  // Priority 5 (Medium-Low): Other entities / non-critical data
    }
};

interface SyncBatchResult {
    syncedIds: number[];
    quotaHit: boolean;
    errorMessage: string | null;
}

const NON_CRITICAL_ENTITIES = new Set<EntityType>(['deviceSession', 'suggestions']);

/**
 * Sends a batch of changes to Firestore.
 * Protects business records in queue (never silently discards tickets/invoices/orders on quota or permission errors).
 */
const syncWithCloud = async (items: SyncQueueItem[]): Promise<SyncBatchResult> => {
    console.log('SYNCING WITH CLOUD (Firestore):', items);
    const successfullySyncedIds: number[] = [];
    let quotaHit = false;
    let errorMessage: string | null = null;

    if (isQuotaCooldownActive()) {
        return {
            syncedIds: [],
            quotaHit: true,
            errorMessage: getQuotaStatus().message || 'Quota journalier Cloud Firestore temporairement atteint.'
        };
    }

    for (const item of items) {
        const collectionName = collectionMap[item.entity];
        if (!collectionName) {
            console.warn(`No collection mapping found for entity: ${item.entity}`);
            successfullySyncedIds.push(item.id);
            continue;
        }

        const docRef = doc(db, collectionName, item.entityId);

        try {
            if (item.operation === 'put') {
                await pushEntityToCloud(item.entity, collectionName, item.entityId, item.payload);
            } else if (item.operation === 'delete') {
                await deleteDoc(docRef);
            }
            successfullySyncedIds.push(item.id);
        } catch (error) {
            console.error(`Error syncing item ${item.id} of entity ${item.entity}:`, error);

            if (!navigator.onLine) {
                errorMessage = 'Connexion Internet interrompue.';
                break;
            }

            const errMsg = error instanceof Error ? error.message : String(error);

            // 1) Quota Firestore dépassé : ne JAMAIS supprimer de la file, arrêter immédiatement la vague
            if (isQuotaExceededError(error)) {
                reportQuotaExceeded(error);
                quotaHit = true;
                errorMessage = "Quota journalier Cloud Firestore atteint (lectures). Envoi mis en pause automatiquement sans perte de données.";
                item.lastError = errorMessage;
                await dbPutSyncQueueItem(item);
                break;
            }

            // 2) Erreur de permission : garder les données métier intactes en file d'attente
            if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('insufficient')) {
                if (!auth.currentUser) {
                    errorMessage = 'Connexion Google requise pour synchroniser.';
                    break;
                }

                const retries = (item.retries || 0) + 1;
                if (NON_CRITICAL_ENTITIES.has(item.entity) && retries >= 5) {
                    successfullySyncedIds.push(item.id);
                    continue;
                }

                item.retries = retries;
                item.lastError = errMsg;
                await dbPutSyncQueueItem(item);
                errorMessage = `Permission refusée par Firestore pour ${auth.currentUser.email || 'ce compte'}.`;

                addSyncLog(
                    'Cloud Realtime',
                    'Flux Temps Réel',
                    'error',
                    auth.currentUser?.email || 'Opérateur Local',
                    `Envoi #${item.entityId} (${item.entity}) en attente : permission Firestore refusée (${errMsg}).`
                );
                break;
            }

            // 3) Autres erreurs (réseau, timeout, format) : uniquement purger les logs non critiques, JAMAIS les fiches/factures/stocks
            const retries = (item.retries || 0) + 1;
            if (NON_CRITICAL_ENTITIES.has(item.entity) && retries >= 15) {
                successfullySyncedIds.push(item.id);
                continue;
            }

            item.retries = retries;
            item.lastError = errMsg;
            await dbPutSyncQueueItem(item);
            errorMessage = errMsg;
            // On continue pour ne pas bloquer les autres fiches valides derrière une fiche en erreur isolée
        }
    }

    return { syncedIds: successfullySyncedIds, quotaHit, errorMessage };
};

/**
 * Réindexe dans la file d'attente les dossiers locaux récents (ex: créés ou modifiés aujourd'hui)
 * qui ne sont pas déjà présents dans syncQueue, afin de garantir qu'aucune fiche n'est oubliée.
 */
export const requeueRecentLocalRecords = async (sinceHours = 48): Promise<number> => {
    const cutoff = sinceHours > 0 ? Date.now() - sinceHours * 3600_000 : 0;
    const existingQueue = await dbGetSyncQueue();
    const queuedKeys = new Set(existingQueue.map(q => `${q.entity}:${q.entityId}`));

    const sources: Array<{ entity: EntityType; load: () => Promise<unknown[]>; dateFields?: string[] }> = [
        { entity: 'ticket', load: dbGetTickets, dateFields: ['updatedAt', 'createdAt'] },
        { entity: 'facture', load: dbGetFactures, dateFields: ['updatedAt', 'date', 'createdAt'] },
        { entity: 'proforma', load: dbGetProformas, dateFields: ['updatedAt', 'date', 'createdAt'] },
        { entity: 'commande', load: dbGetCommandes, dateFields: ['updatedAt', 'date', 'createdAt'] },
        { entity: 'appointment', load: dbGetAppointments, dateFields: ['updatedAt', 'date', 'createdAt'] },
        { entity: 'engagementSav', load: dbGetEngagementsSav, dateFields: ['updatedAt', 'date', 'createdAt'] },
        { entity: 'stock', load: dbGetStock, dateFields: ['updatedAt', 'createdAt'] },
        { entity: 'stockUsage', load: dbGetStockUsage, dateFields: ['updatedAt', 'date'] },
        { entity: 'externalPurchase', load: dbGetExternalPurchases, dateFields: ['updatedAt', 'date'] },
        { entity: 'mouvementStock', load: dbGetMouvementsStock, dateFields: ['updatedAt', 'date'] },
    ];

    let requeued = 0;
    for (const src of sources) {
        let rows: unknown[] = [];
        try {
            rows = await src.load();
        } catch {
            continue;
        }
        for (const row of rows) {
            if (!row || typeof row !== 'object') continue;
            const rec = row as Record<string, unknown>;
            const id = rec.id ? String(rec.id) : '';
            if (!id) continue;
            if (queuedKeys.has(`${src.entity}:${id}`)) continue;

            if (cutoff > 0) {
                let latestTs = 0;
                for (const df of src.dateFields || ['updatedAt', 'createdAt']) {
                    const raw = rec[df];
                    if (raw) {
                        const parsed = typeof raw === 'number' ? raw : Date.parse(String(raw));
                        if (Number.isFinite(parsed) && parsed > latestTs) latestTs = parsed;
                    }
                }
                if (latestTs < cutoff) continue;
            }

            const newItem: Omit<SyncQueueItem, 'id'> = {
                timestamp: Date.now(),
                entity: src.entity,
                entityId: id,
                operation: 'put',
                payload: JSON.parse(JSON.stringify(rec)),
            };
            await dbPutSyncQueueItem(newItem as SyncQueueItem);
            queuedKeys.add(`${src.entity}:${id}`);
            requeued++;
        }
    }

    if (requeued > 0) {
        const updatedQueue = await dbGetSyncQueue();
        updateState({ pendingChanges: updatedQueue.length });
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('datachanged'));
        }
    }
    return requeued;
};

/**
 * Pulls all collection data from firestore and updates the local IndexedDB.
 */
export const syncFromCloud = async (manual = false, fullRescan = false) => {
    if (!navigator.onLine) {
        console.log("Offline: Skipping Firestore pull.");
        if (manual) throw new Error("Appareil hors ligne : connexion Internet requise.");
        return;
    }

    if (!auth.currentUser) {
        console.log("Not authenticated in Firebase: Skipping Firestore pull.");
        if (manual) throw new Error("Connexion Google requise pour récupérer les fiches depuis le Cloud.");
        return;
    }

    if (manual) {
        clearQuotaCooldown();
        updateState({ isQuotaExceeded: false, lastError: null });
    } else if (isQuotaCooldownActive()) {
        console.warn("Quota cooldown active: skipping automatic Firestore pull.");
        return;
    }

    console.log(fullRescan ? 'PULLING FULL DATA FROM CLOUD (Firestore)...' : 'PULLING INCREMENTAL DATA FROM CLOUD (Firestore)...');

    const collectionsToSync: { storeName: string; collectionName: string }[] = [
        { storeName: 'tickets', collectionName: 'tickets' },
        { storeName: 'stock', collectionName: 'stock' },
        { storeName: 'stockUsage', collectionName: 'stockUsage' },
        { storeName: 'externalPurchases', collectionName: 'externalPurchases' },
        { storeName: 'services', collectionName: 'services' },
        { storeName: 'factures', collectionName: 'factures' },
        { storeName: 'proformas', collectionName: 'proformas' },
        { storeName: 'commandes', collectionName: 'commandes' },
        { storeName: 'appointments', collectionName: 'appointments' },
        { storeName: 'simpleDocuments', collectionName: 'simpleDocuments' },
        { storeName: 'knowledge_files', collectionName: 'storedDocuments' },
        { storeName: 'suggestions', collectionName: 'suggestions' },
        { storeName: 'engagementsSav', collectionName: 'engagementsSav' },
        { storeName: 'mouvementsStock', collectionName: 'mouvementsStock' }
    ];

    let hasChanges = false;
    let quotaHit = false;
    let firstError: string | null = null;
    const idb = await getDB();

    for (const item of collectionsToSync) {
        if (quotaHit || (!manual && isQuotaCooldownActive())) break;

        try {
            let pullTarget = collection(db, item.collectionName) as ReturnType<typeof collection> | ReturnType<typeof query>;
            if (!fullRescan) {
                try {
                    const localItems = await idb.getAll(item.storeName);
                    const since = resolveIncrementalSince(item.collectionName, localItems);
                    if (since) {
                        pullTarget = query(collection(db, item.collectionName), where('updatedAt', '>', since));
                    }
                } catch {
                    /* repli collection complète */
                }
            }

            const pullStartedAt = new Date().toISOString();
            const querySnapshot = await getDocs(pullTarget);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fetchedItems: any[] = [];
            querySnapshot.forEach((docSnap) => {
                const d = { ...(docSnap.data() as Record<string, unknown>) };
                if (!d.id) d.id = docSnap.id;
                if (item.storeName === 'suggestions') d.category = docSnap.id;
                fetchedItems.push(d);
            });

            if (item.storeName === 'tickets') {
                for (let i = 0; i < fetchedItems.length; i++) {
                    const t = fetchedItems[i];
                    if (t.id === 'RM-fallback-1789484260343' || t.id === 'RM-FALLBACK-1789484260343') {
                        t.id = '26-RM-0672';
                        try {
                            await deleteDoc(doc(db, 'tickets', 'RM-fallback-1789484260343'));
                            await setDoc(doc(db, 'tickets', '26-RM-0672'), t, { merge: true });
                        } catch (e) {
                            console.warn("Could not auto-heal fallback ticket on Firestore:", e);
                        }
                    }
                }
            }

            if (fetchedItems.length > 0) {
                const entityType = getEntityTypeFromStore(item.storeName);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mergedItemsToPut: any[] = [];
                for (const rawItem of fetchedItems) {
                    const itemKey = item.storeName === 'suggestions' ? rawItem.category : rawItem.id;
                    const localItem = await dbGet(item.storeName, itemKey);
                    if (localItem && hasMediaRefs(rawItem)) {
                        await warmMediaCacheFromRecord(localItem);
                    }
                    const hydrated = await hydrateFromCloudBestEffort(rawItem, !quotaHit);
                    if (hydrated.quotaHit) quotaHit = true;
                    const fetchedItem = hydrated.data;
                    const safeRemote = localItem && hydrated.unresolvedRefs > 0
                        ? mergeUnresolvedMediaFallback(localItem, fetchedItem)
                        : fetchedItem;

                    if (localItem && entityType) {
                        const merged = mergeUpdates(entityType, localItem, safeRemote);
                        mergedItemsToPut.push(merged);
                    } else {
                        mergedItemsToPut.push(safeRemote);
                    }
                }
                if (mergedItemsToPut.length > 0) {
                    await bulkPut(item.storeName, mergedItemsToPut);
                    hasChanges = true;
                }
            }

            advanceCollectionWatermark(item.collectionName, fetchedItems, pullStartedAt);
        } catch (error) {
            console.warn(`Could not pull collection ${item.collectionName}:`, error);
            if (isQuotaExceededError(error)) {
                reportQuotaExceeded(error);
                quotaHit = true;
                firstError = "Quota journalier Cloud Firestore atteint (lectures épuisées). Les fiches déjà sur le serveur ne peuvent être téléchargées qu'après réinitialisation du quota ou passage au niveau payant.";
                updateState({ isQuotaExceeded: true, lastError: firstError });
                break;
            }
            if (!firstError) {
                firstError = error instanceof Error ? error.message : String(error);
            }
        }
    }

    if (hasChanges) {
        window.dispatchEvent(new CustomEvent('datareceived'));
    }

    if (firstError) {
        updateState({ lastError: firstError });
        if (manual) throw new Error(firstError);
        return;
    }

    updateState({
        lastSync: new Date(),
        lastError: null,
        isQuotaExceeded: false,
    });
};

export interface ProcessQueueResult {
    ok: boolean;
    processed: number;
    pending: number;
    quotaExceeded?: boolean;
    error?: string;
}

/**
 * Processes the entire sync queue. It fetches pending items, sends them to the cloud,
 * and upon success, removes them from the local queue.
 */
export const processSyncQueue = async (manual = false): Promise<ProcessQueueResult> => {
    if (syncState.isSyncing) {
        console.log('Sync already in progress. Queueing another run.');
        updateState({ needsAnotherRun: true });
        return { ok: true, processed: 0, pending: syncState.pendingChanges };
    }

    if (!navigator.onLine) {
        console.log('Cannot sync, app is offline.');
        const pendingItems = await dbGetSyncQueue();
        updateState({ pendingChanges: pendingItems.length });
        return { ok: false, processed: 0, pending: pendingItems.length, error: 'Appareil hors ligne.' };
    }

    if (!auth.currentUser) {
        console.log('Cannot sync, user is not authenticated in Firebase.');
        const pendingItems = await dbGetSyncQueue();
        updateState({ pendingChanges: pendingItems.length });
        return { ok: false, processed: 0, pending: pendingItems.length, error: 'Connexion Google requise.' };
    }

    if (manual) {
        clearQuotaCooldown();
        updateState({ isQuotaExceeded: false, lastError: null });
    } else if (isQuotaCooldownActive()) {
        const pendingItems = await dbGetSyncQueue();
        const quotaMsg = getQuotaStatus().message || 'Quota journalier Cloud Firestore atteint.';
        updateState({ pendingChanges: pendingItems.length, isQuotaExceeded: true, lastError: quotaMsg });
        return { ok: false, processed: 0, pending: pendingItems.length, quotaExceeded: true, error: quotaMsg };
    }

    updateState({ isSyncing: true });
    let runAgain = false;
    let totalProcessed = 0;
    let hasError = false;
    let quotaHit = false;
    let lastErrorMsg = '';

    try {
        let hasMore = true;

        while (hasMore) {
            updateState({ needsAnotherRun: false });

            const allItems = await dbGetSyncQueue();
            if (allItems.length === 0) {
                break;
            }

            // Priorité métier, puis éléments sans erreur d'abord (pour qu'un élément bloqué ne ralentisse jamais les nouveaux)
            const sortedItems = [...allItems].sort((a, b) => {
                const priorityA = getEntityPriority(a.entity);
                const priorityB = getEntityPriority(b.entity);
                if (priorityA !== priorityB) {
                    return priorityB - priorityA;
                }
                const retriesA = a.retries || 0;
                const retriesB = b.retries || 0;
                if (retriesA !== retriesB) {
                    return retriesA - retriesB;
                }
                return a.id - b.id;
            });

            const itemsToSync = sortedItems.slice(0, 25);

            console.log(`Processing sync queue batch of size: ${itemsToSync.length} (total remaining: ${allItems.length})`);
            const batchResult = await syncWithCloud(itemsToSync);
            totalProcessed += batchResult.syncedIds.length;

            if (batchResult.syncedIds.length > 0) {
                await dbDeleteSyncQueueItems(batchResult.syncedIds);
                console.log(`Successfully removed ${batchResult.syncedIds.length} synced items from the queue.`);
            }

            if (batchResult.quotaHit) {
                quotaHit = true;
                hasError = true;
                lastErrorMsg = batchResult.errorMessage || 'Quota journalier Cloud Firestore atteint.';
                hasMore = false;
            } else if (batchResult.syncedIds.length < itemsToSync.length) {
                hasError = true;
                lastErrorMsg = batchResult.errorMessage || "Certains items de la file d'attente ont échoué au transfert.";
                hasMore = false;
            } else {
                const remainingInQueue = await dbGetSyncQueue();
                if (remainingInQueue.length === 0 && !syncState.needsAnotherRun) {
                    hasMore = false;
                } else if (!navigator.onLine) {
                    hasMore = false;
                }
            }
        }

        const finalPending = await dbGetSyncQueue();
        runAgain = Boolean(syncState.needsAnotherRun && !hasError && !quotaHit);
        updateState({
            pendingChanges: finalPending.length,
            isSyncing: false,
            lastSync: (!hasError && !quotaHit) ? new Date() : syncState.lastSync,
            lastError: hasError ? lastErrorMsg : null,
            isQuotaExceeded: quotaHit,
            needsAnotherRun: false
        });

        if (totalProcessed > 0 || hasError) {
            if (hasError) {
                addSyncLog(
                    'Cloud Realtime',
                    'Flux Temps Réel',
                    'error',
                    auth.currentUser?.email || 'Opérateur Local',
                    totalProcessed > 0
                        ? `Synchronisation partielle (${totalProcessed} envoyés). Problème: ${lastErrorMsg}`
                        : `Synchronisation en pause : ${lastErrorMsg}`
                );
                if (!quotaHit) {
                    window.dispatchEvent(new CustomEvent('syncerror', {
                        detail: { message: `Synchronisation partielle : ${lastErrorMsg}` }
                    }));
                }
            } else if (totalProcessed > 0) {
                addSyncLog(
                    'Cloud Realtime',
                    'Flux Temps Réel',
                    'success',
                    auth.currentUser?.email || 'Opérateur Local',
                    `Sauvegarde temps réel réussie (${totalProcessed} modifications synchronisées avec Firestore).`
                );
                window.dispatchEvent(new CustomEvent('syncsuccess', {
                    detail: { message: `Synchronisation automatique réussie (${totalProcessed} modifications enregistrées).` }
                }));
            }
        }

        return {
            ok: !hasError && !quotaHit,
            processed: totalProcessed,
            pending: finalPending.length,
            quotaExceeded: quotaHit,
            error: lastErrorMsg || undefined,
        };
    } catch (error) {
        console.error('Failed to process sync queue:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        const isQuota = isQuotaExceededError(error);
        if (isQuota) reportQuotaExceeded(error);

        addSyncLog(
            'Cloud Realtime',
            'Flux Temps Réel',
            'error',
            auth.currentUser?.email || 'Opérateur Local',
            `Échec du transfert de la file d'attente : ${errMsg}`
        );

        if (!isQuota) {
            window.dispatchEvent(new CustomEvent('syncerror', {
                detail: { message: `Échec de la synchronisation de données : ${errMsg}` }
            }));
        }

        const pendingItems = await dbGetSyncQueue();
        runAgain = false;
        updateState({
            isSyncing: false,
            pendingChanges: pendingItems.length,
            lastError: errMsg,
            isQuotaExceeded: isQuota,
            needsAnotherRun: false
        });

        return {
            ok: false,
            processed: totalProcessed,
            pending: pendingItems.length,
            quotaExceeded: isQuota,
            error: errMsg,
        };
    } finally {
        if (runAgain && navigator.onLine && !isQuotaCooldownActive()) {
            setTimeout(() => {
                processSyncQueue().catch(console.error);
            }, 300);
        }
    }
};

/**
 * Synchronisation intégrale de tout le contenu de l'application
 */
export const synchronizeAll = async (onProgress?: (msg: string) => void) => {
    if (!navigator.onLine) {
        throw new Error("Vous devez être connecté à Internet de l'appareil pour effectuer une synchronisation ONLINE.");
    }
    
    updateState({ isSyncing: true });
    try {
        await synchronizeOnlineExport((msg) => onProgress?.(msg));
        await synchronizeOnlineImport((msg) => onProgress?.(msg));
    } catch (err) {
        updateState({ isSyncing: false });
        throw err;
    }
};

/**
 * Expédie l'intégralité des données de l'Atelier vers le Cloud Réel Firestore
 * de manière optimisée avec un suivi de pourcentage de 0% à 100%.
 */
export const synchronizeOnlineExport = async (onProgress?: (msg: string, percent: number) => void) => {
    if (!navigator.onLine) {
        throw new Error("Vous devez être connecté à Internet de l'appareil pour effectuer l'exportation ONLINE.");
    }

    if (!auth.currentUser) {
        throw new Error("Vous devez être authentifié avec votre compte Google pour effectuer l'exportation ONLINE.");
    }
    
    updateState({ isSyncing: true });
    clearQuotaCooldown();
    try {
        onProgress?.("Établissement du canal sécurisé...", 5);
        try {
            await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (e) {
            if (isQuotaExceededError(e)) {
                reportQuotaExceeded(e);
                throw new Error("Quota journalier Cloud Firestore atteint (lectures). Export impossible tant que le quota n'est pas réinitialisé.");
            }
            console.warn("Liaison Cloud établie, reprise du flux...", e);
        }

        onProgress?.("Analyse des tables transactionnelles et dossiers...", 12);
        const [
            tickets, stock, services, suggestions, 
            appointments, factures, proformas, commandes, 
            simpleDocs, storedDocs, stockUsage, externalPurchases,
            engagementsSav, mouvementsStock
        ] = await Promise.all([
            dbGetTickets(), dbGetStock(), dbGetServices(), dbGetSuggestions(),
            dbGetAppointments(), dbGetFactures(), dbGetProformas(), dbGetCommandes(),
            dbGetSimpleDocuments(), dbGetStoredDocuments(), dbGetStockUsage(), dbGetExternalPurchases(),
            dbGetEngagementsSav(), dbGetMouvementsStock()
        ]);

        const listsToSync = [
            { name: 'tickets', items: tickets, idKey: 'id', title: 'Fiches de réparation', isLarge: false },
            { name: 'stock', items: stock, idKey: 'id', title: 'Articles de stock', isLarge: false },
            { name: 'services', items: services, idKey: 'id', title: 'Prestations de service', isLarge: false },
            { name: 'suggestions', items: suggestions, idKey: 'category', title: 'Données expertises', isLarge: false },
            { name: 'appointments', items: appointments, idKey: 'id', title: 'Rendez-vous clients', isLarge: false },
            { name: 'factures', items: factures, idKey: 'id', title: 'Facturation finale', isLarge: false },
            { name: 'proformas', items: proformas, idKey: 'id', title: 'Devis proformas', isLarge: false },
            { name: 'commandes', items: commandes, idKey: 'id', title: 'Bons de commandes', isLarge: false },
            { name: 'simpleDocuments', items: simpleDocs, idKey: 'id', title: 'Documents simples', isLarge: false },
            { name: 'storedDocuments', items: storedDocs, idKey: 'id', title: 'Diagnostics et fiches PDF', isLarge: true },
            { name: 'stockUsage', items: stockUsage, idKey: 'id', title: 'Consommations de pièces', isLarge: false },
            { name: 'externalPurchases', items: externalPurchases, idKey: 'id', title: 'Achats fournisseurs', isLarge: false },
            { name: 'engagementsSav', items: engagementsSav, idKey: 'id', title: 'Engagements SAV', isLarge: false },
            { name: 'mouvementsStock', items: mouvementsStock, idKey: 'id', title: 'Mouvements de stock', isLarge: false }
        ];

        let count = 0;
        let failedCount = 0;
        let firstExportError: string | null = null;

        interface DocToWrite {
            collectionName: string;
            docId: string;
            payload: Record<string, unknown>;
            title: string;
        }

        const standardDocs: DocToWrite[] = [];
        const largeDocs: DocToWrite[] = [];

        // Lecture préalable incrémentale des versions Cloud récentes pour fusionner sans relire tout l'historique
        const serverMaps: Record<string, Map<string, Record<string, unknown>>> = {};
        for (const list of listsToSync) {
            if (!list.items || list.items.length === 0) continue;
            try {
                const since = resolveIncrementalSince(list.name, list.items);
                const preReadTarget = since
                    ? query(collection(db, list.name), where('updatedAt', '>', since))
                    : collection(db, list.name);
                const snap = await getDocs(preReadTarget);
                const m = new Map<string, Record<string, unknown>>();
                snap.forEach(d => m.set(d.id, d.data() as Record<string, unknown>));
                serverMaps[list.name] = m;
            } catch (readErr) {
                if (isQuotaExceededError(readErr)) {
                    reportQuotaExceeded(readErr);
                    console.warn(`Quota lecture atteint pendant pré-lecture de ${list.name} : export avec fusion serveur limitée.`);
                    break;
                }
                console.warn(`Lecture Cloud impossible pour ${list.name} avant export :`, readErr);
            }
        }

        for (const list of listsToSync) {
            if (list.items && list.items.length > 0) {
                const castedItems = list.items as Record<string, unknown>[];
                for (const item of castedItems) {
                    const docId = item[list.idKey];
                    if (!docId) continue;

                    const normalizedId = String(docId);
                    const sanitizedPayload = JSON.parse(JSON.stringify(item || {})) as Record<string, unknown>;

                    if (sanitizedPayload && typeof sanitizedPayload === 'object') {
                        if (sanitizedPayload.id !== undefined && sanitizedPayload.id !== null) {
                            sanitizedPayload.id = String(sanitizedPayload.id);
                        }
                    }

                    // Photos et fichiers lourds envoyés à part (la copie locale reste intacte)
                    let cloudPayload: Record<string, unknown> = sanitizedPayload;
                    try {
                        cloudPayload = JSON.parse(JSON.stringify(await dehydrateForCloud(sanitizedPayload)));
                    } catch (mediaErr) {
                        console.warn('Envoi des médias impossible, repli compressé pour le Cloud :', mediaErr);
                        if (list.name === 'tickets') {
                            try { cloudPayload = JSON.parse(JSON.stringify(await optimizeTicketForFirestore(sanitizedPayload as unknown as RepairTicket))); } catch { /* garde brut */ }
                        }
                    }
                    // Fusion avec la version déjà présente dans le Cloud (aucun écrasement aveugle)
                    const serverVersion = serverMaps[list.name]?.get(normalizedId);
                    const entityType = getEntityTypeFromStore(list.name === 'storedDocuments' ? 'knowledge_files' : list.name);
                    if (serverVersion && entityType) {
                        cloudPayload = JSON.parse(JSON.stringify(mergeUpdates(entityType, serverVersion, cloudPayload) || {}));
                    }

                    const docInfo: DocToWrite = {
                        collectionName: list.name === 'storedDocuments' ? 'storedDocuments' : list.name,
                        docId: normalizedId,
                        payload: cloudPayload,
                        title: list.title
                    };

                    if (list.isLarge) {
                        largeDocs.push(docInfo);
                    } else {
                        standardDocs.push(docInfo);
                    }
                }
            }
        }

        const totalItems = standardDocs.length + largeDocs.length;

        const CHUNK_SIZE = 200;
        for (let idx = 0; idx < standardDocs.length; idx += CHUNK_SIZE) {
            const chunk = standardDocs.slice(idx, idx + CHUNK_SIZE);
            const batch = writeBatch(db);

            for (const docInfo of chunk) {
                const docRef = doc(db, docInfo.collectionName, docInfo.docId);
                batch.set(docRef, docInfo.payload, { merge: true });
            }

            const baseProgress = 15 + Math.round((idx / Math.max(1, totalItems)) * 70);
            const currentTitle = chunk[0]?.title || 'données';
            onProgress?.(`Transfert rapide de : ${currentTitle} (${idx} / ${totalItems})`, baseProgress);

            try {
                await batch.commit();
                count += chunk.length;
            } catch (chunkError) {
                if (isQuotaExceededError(chunkError)) {
                    reportQuotaExceeded(chunkError);
                    throw new Error("Quota journalier Cloud Firestore atteint pendant l'exportation. Vos modifications restent conservées en file d'attente.");
                }
                console.warn(`Batch write failed for chunk starting at idx ${idx}. Falling back to individual writes...`, chunkError);
                for (const docInfo of chunk) {
                    try {
                        const docRef = doc(db, docInfo.collectionName, docInfo.docId);
                        await setDoc(docRef, docInfo.payload, { merge: true });
                        count++;
                    } catch (singleDocError) {
                        failedCount++;
                        const errorMsg = singleDocError instanceof Error ? singleDocError.message : String(singleDocError);
                        if (!firstExportError) firstExportError = errorMsg;
                        if (isQuotaExceededError(singleDocError)) {
                            reportQuotaExceeded(singleDocError);
                            throw new Error("Quota journalier Cloud Firestore atteint pendant l'exportation. Vos modifications restent conservées en file d'attente.");
                        }
                        console.error(`Persistent upload failure for document ${docInfo.docId} in collection ${docInfo.collectionName}:`, singleDocError);
                        addSyncLog(
                            'Cloud Realtime',
                            `Échec doc standard: ${docInfo.collectionName}/${docInfo.docId}`,
                            'error',
                            auth.currentUser?.email || 'Administrateur',
                            `Erreur lors du transfert du document de ${docInfo.title} : ${errorMsg}`
                        );
                    }
                }
            }
        }

        for (let idx = 0; idx < largeDocs.length; idx++) {
            const docInfo = largeDocs[idx];
            const baseProgress = 15 + Math.round(((standardDocs.length + idx) / Math.max(1, totalItems)) * 70);
            onProgress?.(`Téléversement de fichier lourd : ${String(docInfo.payload.name || docInfo.docId)} (${standardDocs.length + idx + 1}/${totalItems})`, baseProgress);

            try {
                const docRef = doc(db, docInfo.collectionName, docInfo.docId);
                await setDoc(docRef, docInfo.payload, { merge: true });
                count++;
            } catch (singleDocError) {
                failedCount++;
                const errorMsg = singleDocError instanceof Error ? singleDocError.message : String(singleDocError);
                if (!firstExportError) firstExportError = errorMsg;
                if (isQuotaExceededError(singleDocError)) {
                    reportQuotaExceeded(singleDocError);
                    throw new Error("Quota journalier Cloud Firestore atteint pendant l'exportation.");
                }
                console.error(`Persistent upload failure for heavy document ${docInfo.docId} in collection ${docInfo.collectionName}:`, singleDocError);
                addSyncLog(
                    'Cloud Realtime',
                    `Échec fichier lourd: ${docInfo.collectionName}/${docInfo.docId}`,
                    'error',
                    auth.currentUser?.email || 'Administrateur',
                    `Erreur lors de l'envoi du fichier lourd ${String(docInfo.payload.name || docInfo.docId)} : ${errorMsg}`
                );
            }
        }

        onProgress?.("Sauvegarde de la configuration de l'atelier...", 88);
        const storedSettings = localStorage.getItem('mac-repair-app-appSettings');
        if (storedSettings) {
            try {
                const parsed = JSON.parse(storedSettings);
                const settingsDocRef = doc(db, 'settings', 'appSettings');
                await setDoc(settingsDocRef, {
                    id: 'appSettings',
                    updatedAt: new Date().toISOString(),
                    ...parsed
                }, { merge: true });
            } catch (settingsError) {
                console.error("Échec envoi config :", settingsError);
            }
        }

        const pendingQueue = await dbGetSyncQueue();
        if (failedCount === 0) {
            onProgress?.("Nettoyage des jetons et index de synchronisation...", 95);
            if (pendingQueue.length > 0) {
                await dbDeleteSyncQueueItems(pendingQueue.map(q => q.id));
            }
            addSyncLog(
                'Cloud Realtime',
                'Export Synchro Online',
                'success',
                auth.currentUser?.email || 'Administrateur',
                `Exportation réussie de ${count} éléments locaux vers le Cloud.`
            );
            onProgress?.("Exportation ONLINE terminée avec succès !", 100);
            updateState({
                pendingChanges: 0,
                isSyncing: false,
                lastSync: new Date(),
                lastError: null,
                isQuotaExceeded: false,
            });
        } else {
            updateState({
                pendingChanges: pendingQueue.length,
                isSyncing: false,
                lastError: firstExportError || `${failedCount} éléments n'ont pas pu être transférés.`,
            });
            throw new Error(`Exportation partielle : ${count} envoyés, ${failedCount} échecs (${firstExportError || 'Erreur inconnue'}). Les éléments non envoyés restent en file d'attente.`);
        }
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const pendingQueue = await dbGetSyncQueue().catch(() => []);
        updateState({
            isSyncing: false,
            pendingChanges: pendingQueue.length,
            lastError: errMsg,
            isQuotaExceeded: isQuotaExceededError(error) || syncState.isQuotaExceeded,
        });
        throw error;
    }
};

/**
 * Importe l'intégralité des données du Cloud vers l'Atelier local
 * de manière optimisée avec un suivi de pourcentage de 0% à 100%.
 */
export const synchronizeOnlineImport = async (onProgress?: (msg: string, percent: number) => void) => {
    if (!navigator.onLine) {
        throw new Error("Vous devez être connecté à Internet de l'appareil pour effectuer l'importation ONLINE.");
    }

    if (!auth.currentUser) {
        throw new Error("Vous devez être authentifié avec votre compte Google pour effectuer l'importation ONLINE.");
    }

    updateState({ isSyncing: true });
    clearQuotaCooldown();
    try {
        onProgress?.("Initialisation de l'importateur sécurisé...", 5);
        try {
            await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (e) {
            if (isQuotaExceededError(e)) {
                reportQuotaExceeded(e);
                throw new Error("Quota journalier Cloud Firestore atteint (lectures). Importation impossible jusqu'à réinitialisation du quota.");
            }
            console.warn("Liaison Cloud établie, reprise du flux...", e);
        }

        onProgress?.("Chargement des profils d'administration...", 12);
        try {
            const settingsDocRef = doc(db, 'settings', 'appSettings');
            const settingsSnap = await getDoc(settingsDocRef);
            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                localStorage.setItem('mac-repair-app-appSettings', JSON.stringify(data));
                window.dispatchEvent(new Event('storage'));
            }
        } catch (settingsPullError) {
            if (isQuotaExceededError(settingsPullError)) {
                reportQuotaExceeded(settingsPullError);
                throw new Error("Quota journalier Cloud Firestore atteint (lectures). Importation impossible jusqu'à réinitialisation du quota.");
            }
            console.warn("Avertissement : Configurations distantes inaccessibles", settingsPullError);
        }

        onProgress?.("Extraction des collections Cloud...", 20);

        const collectionsToSync: { storeName: string; collectionName: string; title: string }[] = [
            { storeName: 'tickets', collectionName: 'tickets', title: 'Fiches' },
            { storeName: 'stock', collectionName: 'stock', title: 'Articles' },
            { storeName: 'stockUsage', collectionName: 'stockUsage', title: 'Consommations' },
            { storeName: 'externalPurchases', collectionName: 'externalPurchases', title: 'Achats' },
            { storeName: 'services', collectionName: 'services', title: 'Services' },
            { storeName: 'factures', collectionName: 'factures', title: 'Factures' },
            { storeName: 'proformas', collectionName: 'proformas', title: 'Proformas' },
            { storeName: 'commandes', collectionName: 'commandes', title: 'Commandes' },
            { storeName: 'appointments', collectionName: 'appointments', title: 'Rendez-vous' },
            { storeName: 'simpleDocuments', collectionName: 'simpleDocuments', title: 'Documents' },
            { storeName: 'knowledge_files', collectionName: 'storedDocuments', title: 'Fichiers' },
            { storeName: 'suggestions', collectionName: 'suggestions', title: 'Pre-ajustements' },
            { storeName: 'engagementsSav', collectionName: 'engagementsSav', title: 'Engagements SAV' },
            { storeName: 'mouvementsStock', collectionName: 'mouvementsStock', title: 'Mouvements Stock' }
        ];

        let hasDocs = false;
        let itemsCount = 0;
        let quotaHit = false;
        let firstError: string | null = null;
        const totalColls = collectionsToSync.length;

        for (let i = 0; i < totalColls; i++) {
            const item = collectionsToSync[i];
            const progress = 25 + Math.round((i / totalColls) * 65);
            onProgress?.(`Importation de : ${item.title}...`, progress);

            try {
                const importStartedAt = new Date().toISOString();
                const querySnapshot = await getDocs(collection(db, item.collectionName));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fetchedItems: any[] = [];
                querySnapshot.forEach((docSnap) => {
                    const d = { ...docSnap.data() };
                    if (!d.id) d.id = docSnap.id;
                    if (item.storeName === 'suggestions') d.category = docSnap.id;
                    fetchedItems.push(d);
                });

                if (fetchedItems.length > 0) {
                    const entityType = getEntityTypeFromStore(item.storeName);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const mergedItemsToPut: any[] = [];
                    for (const rawItem of fetchedItems) {
                        const itemKey = item.storeName === 'suggestions' ? rawItem.category : rawItem.id;
                        const localItem = await dbGet(item.storeName, itemKey);
                        if (localItem && hasMediaRefs(rawItem)) {
                            await warmMediaCacheFromRecord(localItem);
                        }
                        const hydrated = await hydrateFromCloudBestEffort(rawItem, !quotaHit);
                        if (hydrated.quotaHit) quotaHit = true;
                        const fetchedItem = hydrated.data;
                        const safeRemote = localItem && hydrated.unresolvedRefs > 0
                            ? mergeUnresolvedMediaFallback(localItem, fetchedItem)
                            : fetchedItem;

                        if (localItem && entityType) {
                            const merged = mergeUpdates(entityType, localItem, safeRemote);
                            mergedItemsToPut.push(merged);
                        } else {
                            mergedItemsToPut.push(safeRemote);
                        }
                    }
                    if (mergedItemsToPut.length > 0) await bulkPut(item.storeName, mergedItemsToPut);
                    itemsCount += mergedItemsToPut.length;
                    hasDocs = true;
                }
                advanceCollectionWatermark(item.collectionName, fetchedItems, importStartedAt);
            } catch (error) {
                console.warn(`Erreur de téléchargement pour ${item.collectionName}:`, error);
                if (isQuotaExceededError(error)) {
                    reportQuotaExceeded(error);
                    throw new Error("Quota journalier Cloud Firestore atteint (lectures épuisées). Importation interrompue.");
                }
                if (!firstError) firstError = error instanceof Error ? error.message : String(error);
            }
        }

        if (hasDocs) {
            window.dispatchEvent(new CustomEvent('datareceived'));
        }

        if (firstError && itemsCount === 0) {
            throw new Error(firstError);
        }

        onProgress?.("Reconstruction des index et fiches...", 95);
        addSyncLog(
            'Cloud Realtime',
            'Import Synchro Online',
            'success',
            auth.currentUser?.email || 'Administrateur',
            `Importation réussie de ${itemsCount} dossiers à partir du Cloud.`
        );

        onProgress?.("Importation ONLINE terminée avec succès !", 100);
        const pendingQueue = await dbGetSyncQueue().catch(() => []);
        updateState({
            pendingChanges: pendingQueue.length,
            isSyncing: false,
            lastSync: new Date(),
            lastError: null,
            isQuotaExceeded: false,
        });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        updateState({
            isSyncing: false,
            lastError: errMsg,
            isQuotaExceeded: isQuotaExceededError(error) || syncState.isQuotaExceeded,
        });
        throw error;
    }
};

// --- Startup Initialization ---
let initPromise: Promise<void> | null = null;
let connectionTested = false;

/**
 * Initializes the sync service: recovers any recent unqueued local records once,
 * verifies Firestore connectivity once on boot, and flushes pending queue.
 */
export const initializeSyncService = async (): Promise<void> => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            // Récupération unique des fiches locales des dernières 72h dont l'entrée syncQueue aurait été perdue
            if (typeof localStorage !== 'undefined' && !localStorage.getItem('tgs_requeue_recent_v1')) {
                try {
                    const recovered = await requeueRecentLocalRecords(72);
                    localStorage.setItem('tgs_requeue_recent_v1', new Date().toISOString());
                    if (recovered > 0) {
                        console.log(`[SyncRecovery] ${recovered} modification(s) récente(s) replacée(s) en file d'attente.`);
                    }
                } catch (recErr) {
                    console.warn('[SyncRecovery] Récupération récente non bloquante:', recErr);
                }
            }

            const pendingItems = await dbGetSyncQueue();
            updateState({ pendingChanges: pendingItems.length });

            if (!auth.currentUser) {
                console.log("Firestore sync initialization deferred: User not authenticated.");
                return;
            }

            if (!connectionTested && !isQuotaCooldownActive()) {
                connectionTested = true;
                try {
                    await getDocFromServer(doc(db, 'test', 'connection'));
                } catch (error) {
                    if (isQuotaExceededError(error)) {
                        reportQuotaExceeded(error);
                        updateState({
                            isQuotaExceeded: true,
                            lastError: getQuotaStatus().message,
                        });
                    } else {
                        const errMsg = error instanceof Error ? error.message : String(error);
                        if (errMsg.includes('the client is offline')) {
                            console.log("Firestore connection status: Offline mode (Firebase is configured but client is offline).");
                        } else {
                            console.log(`Firestore connection status check details: ${errMsg}`);
                        }
                    }
                }
            }

            if (pendingItems.length > 0 && !isQuotaCooldownActive()) {
                await processSyncQueue();
            }
        } finally {
            initPromise = null;
        }
    })();

    return initPromise;
};

/**
 * Reports real-time synchronization successes from other devices.
 * Updates the global lastSync time and registers a success audit log.
 */
export const reportRealtimeSyncSuccess = (receivedCount: number) => {
    updateState({
        lastSync: new Date(),
        lastError: null,
        isQuotaExceeded: false,
    });
    addSyncLog(
        'Cloud Realtime',
        'Flux Temps Réel',
        'success',
        auth.currentUser?.email || 'Système',
        `Réception temps réel réussie (${receivedCount} modifications synchronisées depuis le Cloud).`
    );
};
