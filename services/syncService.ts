
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
    dbGetMouvementsStock
} from './dbService.ts';
import { SyncQueueItem, EntityType, RepairTicket } from '../types.ts';
import { optimizeTicketForFirestore } from '../utils/imageCompression.ts';

// --- State Management ---
// A simple event emitter to notify UI components of state changes.
const emitter = new EventTarget();

interface SyncState {
    pendingChanges: number;
    isSyncing: boolean;
    lastSync: Date | null;
    needsAnotherRun?: boolean;
}

let syncState: SyncState = {
    pendingChanges: 0,
    isSyncing: false,
    lastSync: null,
    needsAnotherRun: false,
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
import { doc, getDoc, getDocFromServer, collection, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase.ts';
import { bulkPut, dbGet, dbPutDirect } from './dbService.ts';
import { addSyncLog } from '../utils/syncLogHelper.ts';
import { auth } from './firebase.ts';
import { mergeUpdates } from '../utils/merge.ts';

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

/**
 * Sends a batch of changes to Firestore.
 * Handles failure per-item to prevent a corrupted/denied item from deadlocking the queue.
 * @param items The items from the sync queue to process.
 * @returns Array of item IDs that were successfully processed or handled.
 */
const syncWithCloud = async (items: SyncQueueItem[]): Promise<number[]> => {
    console.log('SYNCING WITH CLOUD (Firestore):', items);
    const successfullySyncedIds: number[] = [];
    
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
                // Ensure payload doesn't contain undefined fields which firestore rejects
                const sanitizedPayload = JSON.parse(JSON.stringify(item.payload || {}));
                
                // Keep payload ID schema safe for Firestore rules by normalizing to string
                if (sanitizedPayload && typeof sanitizedPayload === 'object') {
                    if (sanitizedPayload.id !== undefined && sanitizedPayload.id !== null) {
                        sanitizedPayload.id = String(sanitizedPayload.id);
                    }
                    if (sanitizedPayload.ticketId !== undefined && sanitizedPayload.ticketId !== null) {
                        sanitizedPayload.ticketId = String(sanitizedPayload.ticketId);
                    }
                }

                if (item.entity === 'ticket' && sanitizedPayload) {
                    try {
                        const compressed = await optimizeTicketForFirestore(sanitizedPayload as unknown as RepairTicket);
                        Object.assign(sanitizedPayload, compressed);
                        // Also update local DB to persist the smaller, compressed images directly without re-queueing
                        await dbPutDirect('tickets', compressed);
                    } catch (compressErr) {
                        console.warn("Could not compress ticket on sync-queue upload:", compressErr);
                    }
                }

                // Smart conflict resolution (latest-wins with field-merging)
                let payloadToSet = sanitizedPayload;
                try {
                    const serverDoc = await getDoc(docRef);
                    if (serverDoc.exists()) {
                        const serverData = serverDoc.data();
                        const merged = mergeUpdates(item.entity, serverData, sanitizedPayload);
                        payloadToSet = JSON.parse(JSON.stringify(merged || {}));
                        
                        // Sync local IndexedDB immediately with the merged data
                        const storeNameMap: Record<EntityType, string> = {
                            'ticket': 'tickets', 'stock': 'stock', 'service': 'services',
                            'facture': 'factures', 'proforma': 'proformas', 'commande': 'commandes',
                            'appointment': 'appointments', 'deviceSession': 'deviceSessions',
                            'simpleDocument': 'simpleDocuments', 'storedDocument': 'knowledge_files',
                            'suggestions': 'suggestions', 'stockUsage': 'stockUsage',
                            'externalPurchase': 'externalPurchases', 'engagementSav': 'engagementsSav',
                            'mouvementStock': 'mouvementsStock'
                        };
                        const storeName = storeNameMap[item.entity];
                        if (storeName) {
                            await dbPutDirect(storeName, payloadToSet);
                        }
                    }
                } catch (getDocErr) {
                    console.warn(`Could not fetch server doc for conflict check, proceeding with direct put:`, getDocErr);
                }
                
                await setDoc(docRef, payloadToSet);
            } else if (item.operation === 'delete') {
                await deleteDoc(docRef);
            }
            successfullySyncedIds.push(item.id);
        } catch (error) {
            console.error(`Error syncing item ${item.id} of entity ${item.entity}:`, error);
            
            if (!navigator.onLine) {
                // Network disconnect error: Break out of the loop to retry remaining items later
                break;
            }
            
            const errMsg = error instanceof Error ? error.message : String(error);

            // Handle lack of permission (unauthenticated, wrong account, or temporary permission denied):
            if (errMsg.toLowerCase().includes('permission')) {
                // If user is NOT signed in, it is a genuine authentication issue.
                // We must break out of the loop because we can't sync anything anyway.
                if (!auth.currentUser) {
                    console.log(`Permission error (User logged out) for item ${item.id} of entity ${item.entity}: keeping item in queue.`);
                    break;
                }
                
                // If user is signed in, this is likely a specific document/permission error.
                // It means the item failed security rules or validation constraints.
                // To avoid deadlocking the sync pipeline for all other valid items, we increment a retry count.
                const retries = (item.retries || 0) + 1;
                console.warn(`Permission error (User logged in) for item ${item.id} of entity ${item.entity} (retry ${retries}/5):`, error);
                
                if (retries >= 5) {
                    // Discard the item to unlock the queue and log a clear warning
                    console.error(`Discarding un-syncable queue item ${item.id} of entity ${item.entity} after 5 failed attempts to prevent deadlocks.`);
                    
                    addSyncLog(
                        'Cloud Realtime',
                        'Flux Temps Réel',
                        'error',
                        auth.currentUser?.email || 'Opérateur Local',
                        `Modification #${item.entityId} (${item.entity}) écartée de la file d'attente après 5 rejets par les règles de sécurité Firestore (Erreur: ${errMsg}).`
                    );
                    
                    successfullySyncedIds.push(item.id); // Mark as synced to delete it from the queue
                } else {
                    // Save the incremented retry count back to the DB and continue
                    item.retries = retries;
                    item.lastError = errMsg;
                    await dbPutSyncQueueItem(item);
                }
                
                // Continue to process other items in the batch so one bad item doesn't freeze the whole system!
                continue;
            }
            
            // For other persistent/terminal client or database errors (like invalid validation, missing tables/fields, or schema mismatches):
            if (errMsg.includes('invalid') || errMsg.includes('missing') || errMsg.includes('schema')) {
                console.warn(`Discarding un-syncable queue item ${item.id} due to structural error to avoid deadlocking the sync pipeline:`, error);
                successfullySyncedIds.push(item.id);
            } else {
                // General error (e.g. timeout, transient Firestore issue) - increment retry count as well
                const retries = (item.retries || 0) + 1;
                if (retries >= 5) {
                    console.warn(`Discarding queue item ${item.id} due to excessive general errors (${retries}/5):`, error);
                    addSyncLog(
                        'Cloud Realtime',
                        'Flux Temps Réel',
                        'error',
                        auth.currentUser?.email || 'Opérateur Local',
                        `Modification #${item.entityId} (${item.entity}) abandonnée après 5 erreurs générales (Erreur: ${errMsg}).`
                    );
                    successfullySyncedIds.push(item.id);
                } else {
                    item.retries = retries;
                    item.lastError = errMsg;
                    await dbPutSyncQueueItem(item);
                }
            }
        }
    }
    return successfullySyncedIds;
};

/**
 * Pulls all collection data from firestore and updates the local IndexedDB.
 */
export const syncFromCloud = async () => {
    if (!navigator.onLine) {
        console.log("Offline: Skipping Firestore pull.");
        return;
    }

    if (!auth.currentUser) {
        console.log("Not authenticated in Firebase: Skipping Firestore pull.");
        return;
    }

    console.log('PULLING DATA FROM CLOUD (Firestore)...');
    
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
    for (const item of collectionsToSync) {
        try {
            const querySnapshot = await getDocs(collection(db, item.collectionName));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fetchedItems: any[] = [];
            querySnapshot.forEach((doc) => {
                fetchedItems.push({ ...doc.data() });
                // Enforce IDs match Firestore document keys
                if (!fetchedItems[fetchedItems.length - 1].id) {
                    fetchedItems[fetchedItems.length - 1].id = doc.id;
                }
                if (item.storeName === 'suggestions') {
                    fetchedItems[fetchedItems.length - 1].category = doc.id;
                }
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
                for (const fetchedItem of fetchedItems) {
                    const localItem = await dbGet(item.storeName, fetchedItem.id);
                    if (localItem && entityType) {
                        const merged = mergeUpdates(entityType, localItem, fetchedItem);
                        mergedItemsToPut.push(merged);
                    } else {
                        mergedItemsToPut.push(fetchedItem);
                    }
                }
                await bulkPut(item.storeName, mergedItemsToPut);
                hasChanges = true;
            }
        } catch (error) {
            console.warn(`Could not pull collection ${item.collectionName}:`, error);
        }
    }
    
    if (hasChanges) {
        window.dispatchEvent(new CustomEvent('datareceived'));
    }
};

/**
 * Processes the entire sync queue. It fetches pending items, sends them to the cloud,
 * and upon success, removes them from the local queue.
 */
export const processSyncQueue = async () => {
    if (syncState.isSyncing) {
        console.log('Sync already in progress. Queueing another run.');
        updateState({ needsAnotherRun: true });
        return;
    }

    if (!navigator.onLine) {
        console.log('Cannot sync, app is offline.');
        const pendingItems = await dbGetSyncQueue();
        updateState({ pendingChanges: pendingItems.length });
        return;
    }

    if (!auth.currentUser) {
        console.log('Cannot sync, user is not authenticated in Firebase.');
        const pendingItems = await dbGetSyncQueue();
        updateState({ pendingChanges: pendingItems.length });
        return;
    }

    updateState({ isSyncing: true });
    let runAgain = false;

    try {
        let hasMore = true;
        let totalProcessed = 0;
        let hasError = false;
        let lastErrorMsg = '';

        while (hasMore) {
            updateState({ needsAnotherRun: false });
            
            const allItems = await dbGetSyncQueue();
            if (allItems.length === 0) {
                break;
            }

            // Sort items by priority (tickets first, then transactional data, then non-critical session logs)
            // If priorities are equal, preserve chronological order (by ID) to ensure sequential consistency.
            const sortedItems = [...allItems].sort((a, b) => {
                const priorityA = getEntityPriority(a.entity);
                const priorityB = getEntityPriority(b.entity);
                if (priorityA !== priorityB) {
                    return priorityB - priorityA; // Higher priority first
                }
                return a.id - b.id; // Chronological order
            });

            // Chunk to a maximum of 25 items per batch to keep sync lightweight and responsive
            const itemsToSync = sortedItems.slice(0, 25);

            console.log(`Processing sync queue batch of size: ${itemsToSync.length} (total remaining: ${allItems.length})`);
            const syncedIds = await syncWithCloud(itemsToSync);
            totalProcessed += syncedIds.length;
            
            if (syncedIds.length > 0) {
                await dbDeleteSyncQueueItems(syncedIds);
                console.log(`Successfully removed ${syncedIds.length} synced items from the queue.`);
            }

            if (syncedIds.length < itemsToSync.length) {
                hasError = true;
                lastErrorMsg = "Certains items de la file d'attente ont échoué au transfert.";
                hasMore = false; // Stop processing loop on failure to prevent infinite loop
            } else {
                const remainingInQueue = await dbGetSyncQueue();
                if (remainingInQueue.length === 0 && !syncState.needsAnotherRun) {
                    hasMore = false;
                } else if (!navigator.onLine) {
                    hasMore = false; // Stop the loop if connection is lost
                }
            }
        }

        const finalPending = await dbGetSyncQueue();
        runAgain = syncState.needsAnotherRun || (finalPending.length > 0 && !hasError);
        updateState({
            pendingChanges: finalPending.length,
            isSyncing: false,
            lastSync: new Date(),
            needsAnotherRun: false
        });

        if (totalProcessed > 0) {
            if (hasError) {
                addSyncLog(
                    'Cloud Realtime',
                    'Flux Temps Réel',
                    'error',
                    auth.currentUser?.email || 'Opérateur Local',
                    `Synchronisation partielle (${totalProcessed} envoyés). Problème: ${lastErrorMsg}`
                );
                window.dispatchEvent(new CustomEvent('syncerror', { 
                    detail: { message: `Synchronisation partielle : ${lastErrorMsg}` } 
                }));
            } else {
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

    } catch (error) {
        console.error('Failed to process sync queue:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        
        addSyncLog(
            'Cloud Realtime',
            'Flux Temps Réel',
            'error',
            auth.currentUser?.email || 'Opérateur Local',
            `Échec du transfert de la file d'attente : ${errMsg}`
        );

        window.dispatchEvent(new CustomEvent('syncerror', { 
            detail: { message: `Échec de la synchronisation de données : ${errMsg}` } 
        }));

        const pendingItems = await dbGetSyncQueue();
        runAgain = false; // Do not automatically retry on exception to prevent tight loops
        updateState({ 
            isSyncing: false, 
            pendingChanges: pendingItems.length,
            needsAnotherRun: false
        });
    } finally {
        if (runAgain && navigator.onLine) {
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
    try {
        onProgress?.("Établissement du canal sécurisé...", 5);
        try {
            await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (e) {
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
        
        // Let's divide into standard (small) and heavy (large) documents
        interface DocToWrite {
            collectionName: string;
            docId: string;
            payload: Record<string, unknown>;
            title: string;
        }

        const standardDocs: DocToWrite[] = [];
        const largeDocs: DocToWrite[] = [];

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

                    if (list.name === 'tickets') {
                        try {
                            const compressed = await optimizeTicketForFirestore(sanitizedPayload as unknown as RepairTicket);
                            Object.assign(sanitizedPayload, compressed);
                            // Persist back to local db directly without re-queueing
                            await dbPutDirect('tickets', compressed);
                        } catch (compressErr) {
                            console.warn("Could not compress ticket on force sync:", compressErr);
                        }
                    }

                    const docInfo: DocToWrite = {
                        collectionName: list.name === 'storedDocuments' ? 'storedDocuments' : list.name,
                        docId: normalizedId,
                        payload: sanitizedPayload,
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

        // 1. Process standard documents in batches of 200 for lightning speed
        const CHUNK_SIZE = 200;
        for (let idx = 0; idx < standardDocs.length; idx += CHUNK_SIZE) {
            const chunk = standardDocs.slice(idx, idx + CHUNK_SIZE);
            const batch = writeBatch(db);

            for (const docInfo of chunk) {
                const docRef = doc(db, docInfo.collectionName, docInfo.docId);
                batch.set(docRef, docInfo.payload);
            }

            const baseProgress = 15 + Math.round((idx / totalItems) * 70);
            const currentTitle = chunk[0]?.title || 'données';
            onProgress?.(`Transfert rapide de : ${currentTitle} (${idx} / ${totalItems})`, baseProgress);

            try {
                await batch.commit();
                count += chunk.length;
            } catch (chunkError) {
                console.warn(`Batch write failed for chunk starting at idx ${idx}. Falling back to individual writes...`, chunkError);
                // Fallback to individual writes if batch fail to ensure robust execution
                for (const docInfo of chunk) {
                    try {
                        const docRef = doc(db, docInfo.collectionName, docInfo.docId);
                        await setDoc(docRef, docInfo.payload);
                        count++;
                    } catch (singleDocError) {
                        console.error(`Persistent upload failure for document ${docInfo.docId} in collection ${docInfo.collectionName}:`, singleDocError);
                        
                        const errorMsg = singleDocError instanceof Error ? singleDocError.message : String(singleDocError);
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

        // 2. Process large/heavy documents individually (to avoid exceeding the 10MB Firestore batch limit)
        for (let idx = 0; idx < largeDocs.length; idx++) {
            const docInfo = largeDocs[idx];
            const baseProgress = 15 + Math.round(((standardDocs.length + idx) / totalItems) * 70);
            onProgress?.(`Téléversement de fichier lourd : ${String(docInfo.payload.name || docInfo.docId)} (${standardDocs.length + idx + 1}/${totalItems})`, baseProgress);

            try {
                const docRef = doc(db, docInfo.collectionName, docInfo.docId);
                await setDoc(docRef, docInfo.payload);
                count++;
            } catch (singleDocError) {
                console.error(`Persistent upload failure for heavy document ${docInfo.docId} in collection ${docInfo.collectionName}:`, singleDocError);
                
                const errorMsg = singleDocError instanceof Error ? singleDocError.message : String(singleDocError);
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
                });
            } catch (settingsError) {
                console.error("Échec envoi config :", settingsError);
            }
        }

        onProgress?.("Nettoyage des jetons et index de synchronisation...", 95);
        const pendingQueue = await dbGetSyncQueue();
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
        });
    } catch (error) {
        updateState({ isSyncing: false });
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
    try {
        onProgress?.("Initialisation de l'importateur sécurisé...", 5);
        try {
            await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (e) {
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
        const totalColls = collectionsToSync.length;

        for (let i = 0; i < totalColls; i++) {
            const item = collectionsToSync[i];
            // Progress percentage from 25% to 90%
            const progress = 25 + Math.round((i / totalColls) * 65);
            onProgress?.(`Importation de : ${item.title}...`, progress);
            
            try {
                const querySnapshot = await getDocs(collection(db, item.collectionName));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fetchedItems: any[] = [];
                querySnapshot.forEach((doc) => {
                    fetchedItems.push({ ...doc.data() });
                    if (!fetchedItems[fetchedItems.length - 1].id) {
                        fetchedItems[fetchedItems.length - 1].id = doc.id;
                    }
                    if (item.storeName === 'suggestions') {
                        fetchedItems[fetchedItems.length - 1].category = doc.id;
                    }
                });
                
                if (fetchedItems.length > 0) {
                    const entityType = getEntityTypeFromStore(item.storeName);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const mergedItemsToPut: any[] = [];
                    for (const fetchedItem of fetchedItems) {
                        const localItem = await dbGet(item.storeName, fetchedItem.id);
                        if (localItem && entityType) {
                            const merged = mergeUpdates(entityType, localItem, fetchedItem);
                            mergedItemsToPut.push(merged);
                        } else {
                            mergedItemsToPut.push(fetchedItem);
                        }
                    }
                    await bulkPut(item.storeName, mergedItemsToPut);
                    itemsCount += fetchedItems.length;
                    hasDocs = true;
                }
            } catch (error) {
                console.warn(`Erreur de téléchargement pour ${item.collectionName}:`, error);
            }
        }

        if (hasDocs) {
            window.dispatchEvent(new CustomEvent('datareceived'));
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
        updateState({
            pendingChanges: 0,
            isSyncing: false,
            lastSync: new Date(),
        });
    } catch (error) {
        updateState({ isSyncing: false });
        throw error;
    }
};

// --- Polling for Remote Changes ---

/**
 * Initializes the sync service by checking the queue size on startup.
 */
export const initializeSyncService = async () => {
    const pendingItems = await dbGetSyncQueue();
    updateState({ pendingChanges: pendingItems.length });
    
    if (!auth.currentUser) {
        console.log("Firestore sync initialization deferred: User not authenticated.");
        return;
    }
    
    // Test Connection according to requirements
    try {
        await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes('the client is offline')) {
            console.log("Firestore connection status: Offline mode (Firebase is configured but client is offline).");
        } else {
            console.log(`Firestore connection status check details: ${errMsg}`);
        }
    }

    // Run outgoing sync if any pending changes
    if (pendingItems.length > 0) {
        await processSyncQueue();
    }
};

/**
 * Reports real-time synchronization successes from other devices.
 * Updates the global lastSync time and registers a success audit log.
 */
export const reportRealtimeSyncSuccess = (receivedCount: number) => {
    updateState({
        lastSync: new Date(),
    });
    addSyncLog(
        'Cloud Realtime',
        'Flux Temps Réel',
        'success',
        auth.currentUser?.email || 'Système',
        `Réception temps réel réussie (${receivedCount} modifications synchronisées depuis le Cloud).`
    );
};

