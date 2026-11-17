
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
    dbQueuePut,
    getDB
} from './dbService.ts';
import { SyncQueueItem, EntityType, RepairTicket } from '../types.ts';
import { pushEntityToCloudDetailed } from './cloudWrite.ts';
import { optimizeTicketForFirestore } from '../utils/imageCompression.ts';
import { dehydrateForCloud, hydrateFromCloudBestEffort, mergeUnresolvedMediaFallback, hasMediaRefs, warmMediaCacheFromRecord } from './cloudMedia.ts';
import { resolveIncrementalSince, advanceCollectionWatermark } from './syncWatermark.ts';
import firebaseConfig from '../firebase-applet-config.json';
import {
    computeUnsyncedTickets,
    isSameTicket,
    resolveProvisionalAgainstCloud,
    type UnsyncedTicketSummary,
} from '../utils/ticketSyncLogic.ts';

export {
    computeUnsyncedTickets,
    isSameTicket,
    resolveProvisionalAgainstCloud,
    type UnsyncedTicketSummary,
};

// --- State Management ---
// A simple event emitter to notify UI components of state changes.
const emitter = new EventTarget();

export interface SyncState {
    pendingChanges: number;
    pendingTickets: number;
    unsyncedTickets: UnsyncedTicketSummary[];
    lastIntegrityCheckAt: Date | null;
    isSyncing: boolean;
    lastSync: Date | null;
    lastPushSucceeded: boolean;
    needsAnotherRun?: boolean;
    lastError?: string | null;
    isQuotaExceeded?: boolean;
}

const LAST_PUSH_STATUS_KEY = 'tgs_last_push_status_v1';
const PENDING_IMPORT_DIFF_KEY = 'tgs_pending_cloud_diff_ticket_ids';

const readPersistedPushFailure = (): { lastPushSucceeded: boolean; lastError: string | null } => {
    if (typeof localStorage === 'undefined') return { lastPushSucceeded: true, lastError: null };
    try {
        const raw = localStorage.getItem(LAST_PUSH_STATUS_KEY);
        if (!raw) return { lastPushSucceeded: true, lastError: null };
        const parsed = JSON.parse(raw) as { ok?: boolean; error?: string | null };
        return {
            lastPushSucceeded: parsed.ok !== false,
            lastError: parsed.error || null,
        };
    } catch {
        return { lastPushSucceeded: true, lastError: null };
    }
};

const persistPushStatus = (ok: boolean, error: string | null) => {
    if (typeof localStorage === 'undefined') return;
    try {
        if (ok) {
            localStorage.removeItem(LAST_PUSH_STATUS_KEY);
        } else {
            localStorage.setItem(LAST_PUSH_STATUS_KEY, JSON.stringify({ ok: false, error }));
        }
    } catch { /* ignore */ }
};

const initialPushStatus = readPersistedPushFailure();

let syncState: SyncState = {
    pendingChanges: 0,
    pendingTickets: 0,
    unsyncedTickets: [],
    lastIntegrityCheckAt: null,
    isSyncing: false,
    lastSync: null,
    lastPushSucceeded: initialPushStatus.lastPushSucceeded,
    needsAnotherRun: false,
    lastError: initialPushStatus.lastError,
    isQuotaExceeded: false,
};

let lastKnownCloudIds: Set<string> | null = null;

const computeCombinedPendingCounts = (
    queueItems: SyncQueueItem[],
    unsyncedTickets: UnsyncedTicketSummary[],
) => {
    const queuedTicketKeys = new Set(
        queueItems
            .filter(q => q.entity === 'ticket' && q.entityId)
            .map(q => q.entityId.trim().toUpperCase()),
    );
    const extraUnsynced = unsyncedTickets.filter(
        u => !queuedTicketKeys.has(u.id.trim().toUpperCase()),
    );
    const queueTicketCount = queueItems.filter(q => q.entity === 'ticket').length;
    return {
        pendingChanges: queueItems.length + extraUnsynced.length,
        pendingTickets: queueTicketCount + extraUnsynced.length,
    };
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
    renumberedPairs: Array<{ oldId: string; newId: string }>;
    quotaHit: boolean;
    errorMessage: string | null;
}

const NON_CRITICAL_ENTITIES = new Set<EntityType>(['deviceSession', 'suggestions']);

const formatFirestoreErrorDetail = (error: unknown, collectionName: string): string => {
    const raw = error instanceof Error ? error.message : String(error);
    const lower = raw.toLowerCase();
    if (lower.includes('permission') || lower.includes('insufficient')) {
        if (lower.includes('counters')) return `permission refusée sur counters (${raw})`;
        return `permission refusée sur ${collectionName} (${raw})`;
    }
    return raw;
};

/**
 * Sends a batch of changes to Firestore.
 * Protects ALL business records in queue (never discards tickets/invoices/orders/stock on quota, permission, or network errors).
 */
const syncWithCloud = async (items: SyncQueueItem[]): Promise<SyncBatchResult> => {
    console.log('SYNCING WITH CLOUD (Firestore):', items);
    const successfullySyncedIds: number[] = [];
    const renumberedPairs: Array<{ oldId: string; newId: string }> = [];
    let quotaHit = false;
    let errorMessage: string | null = null;

    if (isQuotaCooldownActive()) {
        return {
            syncedIds: [],
            renumberedPairs: [],
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
                const res = await pushEntityToCloudDetailed(item.entity, collectionName, item.entityId, item.payload);
                if (item.entity === 'ticket' && lastKnownCloudIds) {
                    lastKnownCloudIds.add(res.finalId.trim().toUpperCase());
                }
                if (res.renumberedFrom && res.finalId !== res.renumberedFrom) {
                    renumberedPairs.push({ oldId: res.renumberedFrom, newId: res.finalId });
                }
            } else if (item.operation === 'delete') {
                await deleteDoc(docRef);
                if (item.entity === 'ticket' && lastKnownCloudIds) {
                    lastKnownCloudIds.delete(item.entityId.trim().toUpperCase());
                }
            }
            successfullySyncedIds.push(item.id);
        } catch (error) {
            console.error(`Error syncing item ${item.id} of entity ${item.entity}:`, error);

            const detailedErr = formatFirestoreErrorDetail(error, collectionName);

            if (!navigator.onLine) {
                errorMessage = 'Connexion Internet interrompue.';
                item.lastError = errorMessage;
                await dbPutSyncQueueItem(item);
                addSyncLog(
                    'Cloud Realtime',
                    'Flux Temps Réel',
                    'error',
                    auth.currentUser?.email || 'Opérateur Local',
                    `Envoi #${item.entityId} (${item.entity}) en attente : ${errorMessage}`
                );
                break;
            }

            // 1) Quota Firestore dépassé : ne JAMAIS supprimer de la file, arrêter immédiatement la vague
            if (isQuotaExceededError(error)) {
                reportQuotaExceeded(error);
                quotaHit = true;
                errorMessage = `Quota journalier Cloud Firestore atteint sur ${collectionName} (${detailedErr}). Envoi mis en pause sans perte de données.`;
                item.retries = (item.retries || 0) + 1;
                item.lastError = errorMessage;
                await dbPutSyncQueueItem(item);
                addSyncLog(
                    'Cloud Realtime',
                    'Flux Temps Réel',
                    'error',
                    auth.currentUser?.email || 'Opérateur Local',
                    `Envoi #${item.entityId} (${item.entity}) suspendu : ${errorMessage}`
                );
                break;
            }

            // 2) Erreur de permission : garder les données métier intactes en file d'attente
            if (detailedErr.toLowerCase().includes('permission') || detailedErr.toLowerCase().includes('insufficient')) {
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
                item.lastError = detailedErr;
                await dbPutSyncQueueItem(item);
                errorMessage = detailedErr;

                addSyncLog(
                    'Cloud Realtime',
                    'Flux Temps Réel',
                    'error',
                    auth.currentUser?.email || 'Opérateur Local',
                    `Échec envoi #${item.entityId} (${item.entity}) : ${detailedErr}`
                );
                break;
            }

            // 3) Autres erreurs (réseau, timeout, format) : JAMAIS supprimer les données métier
            const retries = (item.retries || 0) + 1;
            if (NON_CRITICAL_ENTITIES.has(item.entity) && retries >= 15) {
                successfullySyncedIds.push(item.id);
                continue;
            }

            item.retries = retries;
            item.lastError = detailedErr;
            await dbPutSyncQueueItem(item);
            errorMessage = `#${item.entityId} : ${detailedErr}`;

            addSyncLog(
                'Cloud Realtime',
                'Flux Temps Réel',
                'error',
                auth.currentUser?.email || 'Opérateur Local',
                `Échec envoi #${item.entityId} (${item.entity}) — tentative ${retries} : ${detailedErr}`
            );
            // On continue pour ne pas bloquer les autres fiches valides derrière une fiche en erreur isolée
        }
    }

    return { syncedIds: successfullySyncedIds, renumberedPairs, quotaHit, errorMessage };
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
        updateState({
            pendingChanges: updatedQueue.length,
            pendingTickets: updatedQueue.filter(q => q.entity === 'ticket').length,
        });
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

    const preservePushError = syncState.pendingChanges > 0 || syncState.unsyncedTickets.length > 0 || !syncState.lastPushSucceeded;
    updateState({
        lastSync: new Date(),
        lastError: preservePushError ? syncState.lastError : null,
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

const BACKOFF_DELAYS_MS = [10_000, 20_000, 40_000, 80_000, 160_000, 300_000];
let retryAttemptCount = 0;
let backoffRetryTimer: ReturnType<typeof setTimeout> | null = null;
let onlineRetryRegistered = false;

const clearScheduledRetry = () => {
    if (backoffRetryTimer) {
        clearTimeout(backoffRetryTimer);
        backoffRetryTimer = null;
    }
};

const scheduleRetryWithBackoff = () => {
    clearScheduledRetry();
    if (typeof window === 'undefined' || !navigator.onLine || !auth.currentUser || isQuotaCooldownActive()) {
        return;
    }
    const idx = Math.min(retryAttemptCount, BACKOFF_DELAYS_MS.length - 1);
    const delayMs = BACKOFF_DELAYS_MS[idx];
    retryAttemptCount = Math.min(retryAttemptCount + 1, BACKOFF_DELAYS_MS.length);
    console.log(`[SyncBackoff] Nouvelle tentative planifiée dans ${Math.round(delayMs / 1000)}s (palier ${idx + 1}).`);
    backoffRetryTimer = setTimeout(() => {
        backoffRetryTimer = null;
        if (navigator.onLine && auth.currentUser && !isQuotaCooldownActive()) {
            processSyncQueue(false).catch(console.error);
        }
    }, delayMs);
};

/**
 * Résout la liste éventuelle des IDs de fiches importées depuis un JSON hors ligne
 * en mettant en file d'attente uniquement celles absentes du Cloud.
 */
export const resolvePendingImportedTicketChecks = async (): Promise<number> => {
    if (typeof localStorage === 'undefined' || !navigator.onLine || !auth.currentUser || isQuotaCooldownActive()) {
        return 0;
    }
    let pendingIds: string[] = [];
    try {
        const raw = localStorage.getItem(PENDING_IMPORT_DIFF_KEY);
        if (!raw) return 0;
        pendingIds = JSON.parse(raw) as string[];
        if (!Array.isArray(pendingIds) || pendingIds.length === 0) {
            localStorage.removeItem(PENDING_IMPORT_DIFF_KEY);
            return 0;
        }
    } catch {
        return 0;
    }

    try {
        const [localTickets, cloudIds, currentQueue] = await Promise.all([
            dbGetTickets(),
            fetchCloudTicketIdsMinimal(),
            dbGetSyncQueue(),
        ]);
        lastKnownCloudIds = cloudIds;
        const queuedTicketIds = new Set(
            currentQueue.filter(q => q.entity === 'ticket').map(q => q.entityId.trim().toUpperCase())
        );
        const pendingSet = new Set(pendingIds.map(id => String(id).trim().toUpperCase()));

        let added = 0;
        for (const t of localTickets) {
            if (!t?.id) continue;
            const norm = t.id.trim().toUpperCase();
            if (!pendingSet.has(norm)) continue;
            const isProvisional = Boolean((t as unknown as Record<string, unknown>)._provisionalNumber);
            if ((!cloudIds.has(norm) || isProvisional) && !queuedTicketIds.has(norm)) {
                await dbQueuePut('ticket', t.id, t);
                queuedTicketIds.add(norm);
                added++;
            }
        }
        localStorage.removeItem(PENDING_IMPORT_DIFF_KEY);
        const nextUnsynced = computeUnsyncedTickets(localTickets, cloudIds);
        const q = added > 0 ? await dbGetSyncQueue() : currentQueue;
        const counts = computeCombinedPendingCounts(q, nextUnsynced);
        updateState({
            unsyncedTickets: nextUnsynced,
            lastIntegrityCheckAt: new Date(),
            pendingChanges: counts.pendingChanges,
            pendingTickets: counts.pendingTickets,
        });
        return added;
    } catch (err) {
        console.warn('[ImportDiff] Vérification différée des fiches importées impossible :', err);
        return 0;
    }
};

/**
 * Processes the entire sync queue. It fetches pending items, sends them to the cloud,
 * and upon server confirmation only, removes them from the local queue.
 */
export const processSyncQueue = async (manual = false): Promise<ProcessQueueResult> => {
    if (syncState.isSyncing) {
        console.log('Sync already in progress. Queueing another run.');
        updateState({ needsAnotherRun: true });
        return { ok: true, processed: 0, pending: syncState.pendingChanges };
    }

    if (manual) {
        clearScheduledRetry();
        retryAttemptCount = 0;
    }

    if (!navigator.onLine) {
        console.log('Cannot sync, app is offline.');
        const pendingItems = await dbGetSyncQueue();
        updateState({
            pendingChanges: pendingItems.length,
            pendingTickets: pendingItems.filter(q => q.entity === 'ticket').length,
        });
        return { ok: false, processed: 0, pending: pendingItems.length, error: 'Appareil hors ligne.' };
    }

    if (!auth.currentUser) {
        console.log('Cannot sync, user is not authenticated in Firebase.');
        const pendingItems = await dbGetSyncQueue();
        updateState({
            pendingChanges: pendingItems.length,
            pendingTickets: pendingItems.filter(q => q.entity === 'ticket').length,
        });
        return { ok: false, processed: 0, pending: pendingItems.length, error: 'Connexion Google requise.' };
    }

    await resolvePendingImportedTicketChecks().catch(() => 0);

    if (manual) {
        clearQuotaCooldown();
        updateState({ isQuotaExceeded: false, lastError: null });
    } else if (isQuotaCooldownActive()) {
        const pendingItems = await dbGetSyncQueue();
        const quotaMsg = getQuotaStatus().message || 'Quota journalier Cloud Firestore atteint.';
        updateState({
            pendingChanges: pendingItems.length,
            pendingTickets: pendingItems.filter(q => q.entity === 'ticket').length,
            isQuotaExceeded: true,
            lastPushSucceeded: pendingItems.length === 0 ? syncState.lastPushSucceeded : false,
            lastError: quotaMsg,
        });
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

            const itemsToSync = sortedItems.slice(0, 15);

            console.log(`Processing sync queue batch of size: ${itemsToSync.length} (total remaining: ${allItems.length})`);
            const batchResult = await syncWithCloud(itemsToSync);
            totalProcessed += batchResult.syncedIds.length;

            if (batchResult.syncedIds.length > 0) {
                const idsToDelete = new Set(batchResult.syncedIds);
                // Si une fiche provisoire a été confirmée et renumérotée, nettoyer d'éventuels doublons obsolètes de son ancien ID provisoire
                if (batchResult.renumberedPairs.length > 0) {
                    const renumberedOldIds = new Set(batchResult.renumberedPairs.map(p => p.oldId));
                    const currentAll = await dbGetSyncQueue();
                    for (const q of currentAll) {
                        if (q.entity === 'ticket' && renumberedOldIds.has(q.entityId) && q.operation === 'put') {
                            idsToDelete.add(q.id);
                        }
                    }
                }
                await dbDeleteSyncQueueItems(Array.from(idsToDelete));
                console.log(`Successfully removed ${idsToDelete.size} synced items from the queue.`);
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
                } else {
                    await new Promise((r) => setTimeout(r, 150));
                }
            }
        }

        const [finalPending, localTicketsAfter] = await Promise.all([
            dbGetSyncQueue(),
            dbGetTickets().catch(() => [] as RepairTicket[]),
        ]);
        const nextUnsynced = lastKnownCloudIds
            ? computeUnsyncedTickets(localTicketsAfter, lastKnownCloudIds)
            : computeUnsyncedTickets(
                localTicketsAfter,
                new Set(localTicketsAfter.filter(t => t?.id && !(t as unknown as Record<string, unknown>)._provisionalNumber).map(t => t.id.trim().toUpperCase())),
            );
        const counts = computeCombinedPendingCounts(finalPending, nextUnsynced);
        const pushSucceeded = !hasError && !quotaHit && counts.pendingChanges === 0;
        if (pushSucceeded) {
            retryAttemptCount = 0;
            clearScheduledRetry();
            persistPushStatus(true, null);
        } else if (hasError || quotaHit) {
            persistPushStatus(false, lastErrorMsg || 'Envoi incomplet');
        }

        runAgain = Boolean(syncState.needsAnotherRun && !hasError && !quotaHit);
        updateState({
            pendingChanges: counts.pendingChanges,
            pendingTickets: counts.pendingTickets,
            unsyncedTickets: nextUnsynced,
            isSyncing: false,
            lastSync: (!hasError && !quotaHit) ? new Date() : syncState.lastSync,
            lastPushSucceeded: hasError || quotaHit ? false : counts.pendingChanges === 0,
            lastError: hasError ? lastErrorMsg : (counts.pendingChanges > 0 ? syncState.lastError : null),
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
                        ? `Synchronisation partielle (${totalProcessed} envoyés). Erreur : ${lastErrorMsg}`
                        : `Synchronisation en échec : ${lastErrorMsg}`
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

        if (finalPending.length > 0 && !quotaHit && !runAgain) {
            scheduleRetryWithBackoff();
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
        persistPushStatus(false, errMsg);

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
            pendingTickets: pendingItems.filter(q => q.entity === 'ticket').length,
            lastPushSucceeded: false,
            lastError: errMsg,
            isQuotaExceeded: isQuota,
            needsAnotherRun: false
        });

        if (pendingItems.length > 0 && !isQuota) {
            scheduleRetryWithBackoff();
        }

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
        const initialQueueSnapshot = await dbGetSyncQueue();
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

        if (failedCount === 0) {
            onProgress?.("Nettoyage des jetons et index de synchronisation...", 95);
            if (initialQueueSnapshot.length > 0) {
                await dbDeleteSyncQueueItems(initialQueueSnapshot.map(q => q.id));
            }
            const remainingQueue = await dbGetSyncQueue();
            persistPushStatus(true, null);
            addSyncLog(
                'Cloud Realtime',
                'Export Synchro Online',
                'success',
                auth.currentUser?.email || 'Administrateur',
                `Exportation réussie de ${count} éléments locaux vers le Cloud.`
            );
            onProgress?.("Exportation ONLINE terminée avec succès !", 100);
            updateState({
                pendingChanges: remainingQueue.length,
                pendingTickets: remainingQueue.filter(q => q.entity === 'ticket').length,
                isSyncing: false,
                lastSync: new Date(),
                lastPushSucceeded: remainingQueue.length === 0,
                lastError: null,
                isQuotaExceeded: false,
            });
        } else {
            const pendingQueue = await dbGetSyncQueue();
            const errSummary = firstExportError || `${failedCount} éléments n'ont pas pu être transférés.`;
            persistPushStatus(false, errSummary);
            updateState({
                pendingChanges: pendingQueue.length,
                pendingTickets: pendingQueue.filter(q => q.entity === 'ticket').length,
                isSyncing: false,
                lastPushSucceeded: false,
                lastError: errSummary,
            });
            throw new Error(`Exportation partielle : ${count} envoyés, ${failedCount} échecs (${firstExportError || 'Erreur inconnue'}). Les éléments non envoyés restent en file d'attente.`);
        }
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const pendingQueue = await dbGetSyncQueue().catch(() => []);
        persistPushStatus(false, errMsg);
        updateState({
            isSyncing: false,
            pendingChanges: pendingQueue.length,
            pendingTickets: pendingQueue.filter(q => q.entity === 'ticket').length,
            lastPushSucceeded: false,
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

        onProgress?.("Envoi automatique des fiches locales manquantes...", 97);
        const pendingQueue = await dbGetSyncQueue().catch(() => []);
        const preservePushErr = pendingQueue.length > 0 || syncState.unsyncedTickets.length > 0 || !syncState.lastPushSucceeded;
        updateState({
            pendingChanges: computeCombinedPendingCounts(pendingQueue, syncState.unsyncedTickets).pendingChanges,
            pendingTickets: computeCombinedPendingCounts(pendingQueue, syncState.unsyncedTickets).pendingTickets,
            isSyncing: false,
            lastSync: new Date(),
            lastError: preservePushErr ? syncState.lastError : null,
            isQuotaExceeded: false,
        });

        await triggerAutoCatchUpPush('import-online', (msg) => onProgress?.(msg, 98)).catch(console.error);
        onProgress?.("Importation ONLINE terminée avec succès !", 100);
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

export interface CatchUpTicketsReport {
    totalLocal: number;
    totalCloud: number;
    missingFound: number;
    sent: string[];
    renumbered: Array<{ oldId: string; newId: string }>;
    failed: Array<{ id: string; reason: string }>;
}

let catchUpInFlightPromise: Promise<CatchUpTicketsReport> | null = null;

/**
 * Requête légère sur les identifiants seuls (`__name__`) des fiches présentes sur Firestore
 * via l'API REST `runQuery` (sans télécharger les champs complets), avec repli automatique sur `getDocs`.
 */
export const fetchCloudTicketIdsMinimal = async (): Promise<Set<string>> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('Connexion Google requise pour interroger le Cloud.');
    }

    try {
        if (typeof fetch === 'function' && typeof currentUser.getIdToken === 'function') {
            const token = await currentUser.getIdToken();
            const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
            const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(dbId)}/documents:runQuery`;
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        structuredQuery: {
                            from: [{ collectionId: 'tickets' }],
                            select: { fields: [{ fieldPath: '__name__' }] },
                        },
                    }),
                    signal: controller?.signal,
                });
                if (resp.ok) {
                    const rows = (await resp.json()) as Array<{ document?: { name?: string } }>;
                    const ids = new Set<string>();
                    if (Array.isArray(rows)) {
                        for (const row of rows) {
                            const fullName = row?.document?.name;
                            if (typeof fullName === 'string' && fullName.includes('/')) {
                                const docId = fullName.split('/').pop();
                                if (docId) ids.add(decodeURIComponent(docId).trim().toUpperCase());
                            }
                        }
                    }
                    return ids;
                }
                if (resp.status === 429) {
                    const quotaErr = new Error('Quota exceeded (429 Too Many Requests)');
                    reportQuotaExceeded(quotaErr);
                    throw quotaErr;
                }
            } finally {
                if (timeout) clearTimeout(timeout);
            }
        }
    } catch (restErr) {
        if (isQuotaExceededError(restErr)) throw restErr;
        console.warn('[IntegrityCheck] Requête REST minimale indisponible, repli SDK Firestore :', restErr);
    }

    const cloudSnap = await getDocs(collection(db, 'tickets'));
    return new Set(cloudSnap.docs.map(d => d.id.trim().toUpperCase()));
};

/**
 * Compare les identifiants locaux (IndexedDB) avec le Cloud (requête légère `__name__`)
 * et met à jour l'état honnête (`unsyncedTickets`, `pendingChanges`, `lastPushSucceeded`).
 */
export const verifyLocalVsCloudTickets = async (): Promise<UnsyncedTicketSummary[]> => {
    const [localTickets, existingQueue] = await Promise.all([
        dbGetTickets().catch(() => [] as RepairTicket[]),
        dbGetSyncQueue().catch(() => [] as SyncQueueItem[]),
    ]);

    if (typeof navigator !== 'undefined' && (!navigator.onLine || !auth.currentUser || isQuotaCooldownActive())) {
        const provisionalOnly = lastKnownCloudIds
            ? computeUnsyncedTickets(localTickets, lastKnownCloudIds)
            : computeUnsyncedTickets(
                localTickets,
                new Set(localTickets.filter(t => t?.id && !(t as unknown as Record<string, unknown>)._provisionalNumber).map(t => t.id.trim().toUpperCase())),
            );
        const counts = computeCombinedPendingCounts(existingQueue, provisionalOnly);
        updateState({
            unsyncedTickets: provisionalOnly,
            pendingChanges: counts.pendingChanges,
            pendingTickets: counts.pendingTickets,
            lastPushSucceeded: counts.pendingChanges === 0 ? syncState.lastPushSucceeded : false,
        });
        return provisionalOnly;
    }

    try {
        const cloudIds = await fetchCloudTicketIdsMinimal();
        lastKnownCloudIds = cloudIds;
        const unsynced = computeUnsyncedTickets(localTickets, cloudIds);
        const counts = computeCombinedPendingCounts(existingQueue, unsynced);

        updateState({
            unsyncedTickets: unsynced,
            lastIntegrityCheckAt: new Date(),
            pendingChanges: counts.pendingChanges,
            pendingTickets: counts.pendingTickets,
            lastPushSucceeded: counts.pendingChanges === 0 ? syncState.lastPushSucceeded : false,
        });
        return unsynced;
    } catch (err) {
        if (isQuotaExceededError(err)) {
            reportQuotaExceeded(err);
        } else {
            console.warn('[IntegrityCheck] Comparaison locale vs Cloud impossible :', err);
        }
        return syncState.unsyncedTickets;
    }
};

/**
 * Bouton de rattrapage : compare toutes les fiches locales (y compris importées depuis JSON et `_provisionalNumber`)
 * avec les identifiants présents sur Firestore, envoie une par une les fiches manquantes/provisoires
 * selon le protocole anti-doublon (fusion si identique, renumérotation seulement si autre fiche),
 * protégé par un verrou anti-concurrence.
 */
export const pushMissingLocalTicketsToCloud = async (
    onProgress?: (msg: string) => void
): Promise<CatchUpTicketsReport> => {
    if (catchUpInFlightPromise) {
        return catchUpInFlightPromise;
    }

    if (!navigator.onLine) {
        throw new Error('Appareil hors ligne : connexion Internet requise pour envoyer les fiches en attente.');
    }
    if (!auth.currentUser) {
        throw new Error('Connexion Google requise pour comparer et envoyer les fiches vers le Cloud.');
    }

    const runner = async (): Promise<CatchUpTicketsReport> => {
        clearQuotaCooldown();
        updateState({ isSyncing: true, isQuotaExceeded: false });

        const sent: string[] = [];
        const renumbered: Array<{ oldId: string; newId: string }> = [];
        const failed: Array<{ id: string; reason: string }> = [];

        try {
            onProgress?.('Lecture de la base locale et comparaison avec le Cloud...');
            const [localTickets, cloudIds, existingQueue] = await Promise.all([
                dbGetTickets(),
                fetchCloudTicketIdsMinimal(),
                dbGetSyncQueue(),
            ]);

            lastKnownCloudIds = cloudIds;
            const unsyncedSummaries = computeUnsyncedTickets(localTickets, cloudIds);
            const ticketByNormId = new Map<string, RepairTicket>();
            for (const t of localTickets) {
                if (t?.id) ticketByNormId.set(t.id.trim().toUpperCase(), t);
            }
            const missingTickets = unsyncedSummaries
                .map(s => ticketByNormId.get(s.id.trim().toUpperCase()))
                .filter((t): t is RepairTicket => Boolean(t));

            const report: CatchUpTicketsReport = {
                totalLocal: localTickets.length,
                totalCloud: cloudIds.size,
                missingFound: missingTickets.length,
                sent,
                renumbered,
                failed,
            };

            if (missingTickets.length === 0) {
                const counts = computeCombinedPendingCounts(existingQueue, []);
                updateState({
                    isSyncing: false,
                    unsyncedTickets: [],
                    lastIntegrityCheckAt: new Date(),
                    pendingChanges: counts.pendingChanges,
                    pendingTickets: counts.pendingTickets,
                    lastSync: new Date(),
                    lastPushSucceeded: counts.pendingChanges === 0,
                    lastError: counts.pendingChanges > 0 ? syncState.lastError : null,
                });
                return report;
            }

            const queueByTicketId = new Map<string, number[]>();
            for (const q of existingQueue) {
                if (q.entity === 'ticket') {
                    const key = q.entityId.trim().toUpperCase();
                    const list = queueByTicketId.get(key) || [];
                    list.push(q.id);
                    queueByTicketId.set(key, list);
                }
            }

            for (let i = 0; i < missingTickets.length; i++) {
                const ticket = missingTickets[i];
                onProgress?.(`Envoi de la fiche #${ticket.id} (${i + 1}/${missingTickets.length})...`);
                try {
                    const res = await pushEntityToCloudDetailed('ticket', 'tickets', ticket.id, ticket);
                    sent.push(res.finalId);
                    cloudIds.add(res.finalId.trim().toUpperCase());
                    if (res.renumberedFrom && res.finalId !== res.renumberedFrom) {
                        renumbered.push({ oldId: res.renumberedFrom, newId: res.finalId });
                    }

                    // Supprimer uniquement les entrées syncQueue correspondantes une fois confirmé par le serveur
                    const matchedQueueIds = [
                        ...(queueByTicketId.get(ticket.id.trim().toUpperCase()) || []),
                        ...(queueByTicketId.get(res.finalId.trim().toUpperCase()) || []),
                    ];
                    if (matchedQueueIds.length > 0) {
                        await dbDeleteSyncQueueItems(matchedQueueIds);
                    }
                } catch (err) {
                    const reason = formatFirestoreErrorDetail(err, 'tickets');
                    failed.push({ id: ticket.id, reason });
                    addSyncLog(
                        'Cloud Realtime',
                        'Flux Temps Réel',
                        'error',
                        auth.currentUser?.email || 'Opérateur Local',
                        `Rattrapage fiche #${ticket.id} échoué : ${reason}`
                    );
                    if (!queueByTicketId.has(ticket.id.trim().toUpperCase())) {
                        await dbQueuePut('ticket', ticket.id, { ...ticket, lastError: reason });
                    }
                    if (isQuotaExceededError(err)) {
                        reportQuotaExceeded(err);
                        break;
                    }
                }
            }

            const [remainingQueue, updatedLocalTickets] = await Promise.all([
                dbGetSyncQueue(),
                dbGetTickets().catch(() => localTickets),
            ]);
            const remainingUnsynced = computeUnsyncedTickets(updatedLocalTickets, cloudIds);
            lastKnownCloudIds = cloudIds;
            const counts = computeCombinedPendingCounts(remainingQueue, remainingUnsynced);

            const ok = failed.length === 0 && counts.pendingChanges === 0;
            const errMsg = failed.length > 0
                ? `${failed.length} fiche(s) en échec (${failed[0].id} : ${failed[0].reason})`
                : null;

            if (ok) {
                persistPushStatus(true, null);
                addSyncLog(
                    'Cloud Realtime',
                    'Flux Temps Réel',
                    'success',
                    auth.currentUser?.email || 'Opérateur Local',
                    `Rattrapage réussi : ${sent.length} fiche(s) envoyée(s)${renumbered.length > 0 ? `, ${renumbered.length} renumérotée(s)` : ''}.`
                );
            } else if (errMsg) {
                persistPushStatus(false, errMsg);
            }

            updateState({
                isSyncing: false,
                unsyncedTickets: remainingUnsynced,
                lastIntegrityCheckAt: new Date(),
                pendingChanges: counts.pendingChanges,
                pendingTickets: counts.pendingTickets,
                lastSync: failed.length === 0 ? new Date() : syncState.lastSync,
                lastPushSucceeded: ok,
                lastError: errMsg ?? (counts.pendingChanges > 0 ? syncState.lastError : null),
            });

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('datareceived'));
                window.dispatchEvent(new CustomEvent('tickets-updated'));
            }
            return report;
        } catch (err) {
            const errMsg = formatFirestoreErrorDetail(err, 'tickets');
            const [pendingQueue, localTicketsErr] = await Promise.all([
                dbGetSyncQueue().catch(() => []),
                dbGetTickets().catch(() => []),
            ]);
            const unsyncedErr = lastKnownCloudIds
                ? computeUnsyncedTickets(localTicketsErr, lastKnownCloudIds)
                : syncState.unsyncedTickets;
            const counts = computeCombinedPendingCounts(pendingQueue, unsyncedErr);
            persistPushStatus(false, errMsg);
            updateState({
                isSyncing: false,
                unsyncedTickets: unsyncedErr,
                pendingChanges: counts.pendingChanges,
                pendingTickets: counts.pendingTickets,
                lastPushSucceeded: false,
                lastError: errMsg,
                isQuotaExceeded: isQuotaExceededError(err) || syncState.isQuotaExceeded,
            });
            throw err;
        }
    };

    catchUpInFlightPromise = runner().finally(() => {
        catchUpInFlightPromise = null;
    });
    return catchUpInFlightPromise;
};

/**
 * Déclencheur automatique du rattrapage Cloud (ouverture en ligne, reconnexion, import/fusion backup, synchro online).
 * Protégé contre toute exécution concurrente et émet une notification discrète uniquement s'il y a eu un envoi/incident.
 */
export const triggerAutoCatchUpPush = async (
    reason: 'startup' | 'online' | 'import-backup' | 'import-online' | 'auth-ready',
    onProgress?: (msg: string) => void,
): Promise<CatchUpTicketsReport | null> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await verifyLocalVsCloudTickets().catch(() => []);
        return null;
    }
    if (!auth.currentUser || isQuotaCooldownActive()) {
        await verifyLocalVsCloudTickets().catch(() => []);
        return null;
    }

    try {
        const report = await pushMissingLocalTicketsToCloud(onProgress);
        if (typeof window !== 'undefined') {
            if (report.sent.length > 0 && report.failed.length === 0) {
                window.dispatchEvent(new CustomEvent('syncsuccess', {
                    detail: {
                        reason,
                        message: `Synchro auto : ${report.sent.length} fiche(s) envoyée(s) vers le Cloud${report.renumbered.length > 0 ? ` (${report.renumbered.length} renumérotée(s))` : ''}.`,
                    },
                }));
            } else if (report.failed.length > 0) {
                window.dispatchEvent(new CustomEvent('syncerror', {
                    detail: {
                        reason,
                        message: `Synchro auto incomplète : ${report.sent.length} envoyée(s), ${report.failed.length} fiche(s) encore en attente (${report.failed[0].reason}).`,
                    },
                }));
            }
        }
        return report;
    } catch (err) {
        console.warn(`[AutoCatchUp:${reason}] Échec non bloquant :`, err);
        return null;
    }
};

/**
 * Après import/fusion d'une sauvegarde JSON locale, compare les fiches importées
 * avec le Cloud, met automatiquement en file d'envoi celles qui n'y figurent pas encore
 * (ou provisoires), puis déclenche l'envoi automatique avant de retourner.
 */
export const queueImportedTicketsMissingFromCloud = async (
    importedTickets: RepairTicket[],
    onProgress?: (msg: string) => void
): Promise<{ queued: number; deferredToOnline: boolean; report?: CatchUpTicketsReport | null }> => {
    if (!Array.isArray(importedTickets) || importedTickets.length === 0) {
        return { queued: 0, deferredToOnline: false, report: null };
    }

    const validIds = importedTickets.map(t => t?.id).filter((id): id is string => Boolean(id));
    if (validIds.length === 0) return { queued: 0, deferredToOnline: false, report: null };

    if (!navigator.onLine || !auth.currentUser || isQuotaCooldownActive()) {
        // Mémoriser les IDs importés pour vérification automatique dès le retour du réseau / connexion
        if (typeof localStorage !== 'undefined') {
            try {
                const prevRaw = localStorage.getItem(PENDING_IMPORT_DIFF_KEY);
                const prev = prevRaw ? (JSON.parse(prevRaw) as string[]) : [];
                const merged = Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...validIds]));
                localStorage.setItem(PENDING_IMPORT_DIFF_KEY, JSON.stringify(merged));
            } catch { /* ignore */ }
        }
        await verifyLocalVsCloudTickets().catch(() => []);
        return { queued: 0, deferredToOnline: true, report: null };
    }

    try {
        onProgress?.('Vérification des fiches importées absentes du Cloud...');
        const [cloudIds, existingQueue] = await Promise.all([
            fetchCloudTicketIdsMinimal(),
            dbGetSyncQueue(),
        ]);
        lastKnownCloudIds = cloudIds;
        const queuedKeys = new Set(
            existingQueue.filter(q => q.entity === 'ticket').map(q => q.entityId.trim().toUpperCase())
        );

        let queued = 0;
        for (const ticket of importedTickets) {
            if (!ticket?.id) continue;
            const norm = ticket.id.trim().toUpperCase();
            const isProvisional = Boolean((ticket as unknown as Record<string, unknown>)._provisionalNumber);
            if ((!cloudIds.has(norm) || isProvisional) && !queuedKeys.has(norm)) {
                await dbQueuePut('ticket', ticket.id, ticket);
                queuedKeys.add(norm);
                queued++;
            }
        }

        if (queued > 0) {
            const updatedQueue = await dbGetSyncQueue();
            const nextUnsynced = computeUnsyncedTickets(importedTickets, cloudIds);
            const counts = computeCombinedPendingCounts(updatedQueue, nextUnsynced);
            updateState({
                pendingChanges: counts.pendingChanges,
                pendingTickets: counts.pendingTickets,
                unsyncedTickets: nextUnsynced,
                lastPushSucceeded: false,
            });
            addSyncLog(
                'Offline JSON',
                'Restauration (Import)',
                'success',
                auth.currentUser?.email || 'Opérateur Local',
                `${queued} fiche(s) importée(s) absente(s) du Cloud placée(s) automatiquement en file d'envoi.`
            );
        }

        const report = await triggerAutoCatchUpPush('import-backup', onProgress);
        return { queued, deferredToOnline: false, report };
    } catch (err) {
        console.warn('[ImportSync] Comparaison Cloud après import JSON impossible, report au prochain cycle :', err);
        if (typeof localStorage !== 'undefined') {
            try {
                const prevRaw = localStorage.getItem(PENDING_IMPORT_DIFF_KEY);
                const prev = prevRaw ? (JSON.parse(prevRaw) as string[]) : [];
                const merged = Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...validIds]));
                localStorage.setItem(PENDING_IMPORT_DIFF_KEY, JSON.stringify(merged));
            } catch { /* ignore */ }
        }
        return { queued: 0, deferredToOnline: true, report: null };
    }
};

// --- Startup Initialization ---
let initPromise: Promise<void> | null = null;
let initializedForUid: string | null = null;

/**
 * Initializes the sync service: ensures pending queue is refreshed and flushed on every app open
 * and on every network reconnection.
 */
export const initializeSyncService = async (): Promise<void> => {
    if (typeof window !== 'undefined' && !onlineRetryRegistered) {
        onlineRetryRegistered = true;
        window.addEventListener('online', () => {
            retryAttemptCount = 0;
            clearScheduledRetry();
            if (auth.currentUser && !isQuotaCooldownActive()) {
                processSyncQueue(false)
                    .then(() => triggerAutoCatchUpPush('online'))
                    .catch(console.error);
            } else {
                verifyLocalVsCloudTickets().catch(console.error);
            }
        });
    }

    const currentUid = auth.currentUser?.uid || '__anon__';
    if (initializedForUid === currentUid && auth.currentUser) {
        // Vérifier quand même la file en attente sans ré-exécuter le scan complet
        const pendingNow = await dbGetSyncQueue().catch(() => []);
        const counts = computeCombinedPendingCounts(pendingNow, syncState.unsyncedTickets);
        updateState({
            pendingChanges: counts.pendingChanges,
            pendingTickets: counts.pendingTickets,
        });
        if (navigator.onLine && !isQuotaCooldownActive()) {
            if (pendingNow.length > 0) {
                await processSyncQueue(false).catch(console.error);
            }
            await triggerAutoCatchUpPush('auth-ready').catch(console.error);
        }
        return;
    }
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            // Récupération des fiches locales des dernières 72h dont l'entrée syncQueue aurait été perdue
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
            const failedItem = pendingItems.find(q => Boolean(q.lastError));
            const initialCounts = computeCombinedPendingCounts(pendingItems, syncState.unsyncedTickets);
            updateState({
                pendingChanges: initialCounts.pendingChanges,
                pendingTickets: initialCounts.pendingTickets,
                lastPushSucceeded: initialCounts.pendingChanges === 0 ? syncState.lastPushSucceeded : !failedItem,
                lastError: failedItem?.lastError || syncState.lastError,
            });

            if (!auth.currentUser) {
                console.log("Firestore sync initialization deferred: User not authenticated.");
                await verifyLocalVsCloudTickets().catch(() => []);
                return;
            }

            initializedForUid = auth.currentUser.uid;

            await resolvePendingImportedTicketChecks().catch(() => 0);
            const afterDiffPending = await dbGetSyncQueue();
            const afterCounts = computeCombinedPendingCounts(afterDiffPending, syncState.unsyncedTickets);
            updateState({
                pendingChanges: afterCounts.pendingChanges,
                pendingTickets: afterCounts.pendingTickets,
            });

            if (afterDiffPending.length > 0 && navigator.onLine && !isQuotaCooldownActive()) {
                await processSyncQueue();
            }

            if (navigator.onLine && !isQuotaCooldownActive()) {
                await triggerAutoCatchUpPush('startup');
            } else {
                await verifyLocalVsCloudTickets();
            }
        } finally {
            initPromise = null;
        }
    })();

    return initPromise;
};

/**
 * Reports real-time synchronization successes from other devices.
 * Never wipes push errors or pending queue status when items remain unsent.
 */
export const reportRealtimeSyncSuccess = (receivedCount: number) => {
    const preservePushError = syncState.pendingChanges > 0 || syncState.unsyncedTickets.length > 0 || !syncState.lastPushSucceeded;
    updateState({
        lastSync: new Date(),
        lastError: preservePushError ? syncState.lastError : null,
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
