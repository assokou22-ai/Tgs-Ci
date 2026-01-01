import { dbGetSyncQueue, dbDeleteSyncQueueItems, dbGet, dbPutDirect, dbDeleteDirect, dbGetTickets } from './dbService.ts';
import { SyncQueueItem, EntityType, RepairTicket, RepairStatus } from '../types.ts';
import { mergeUpdates } from '../utils/merge.ts';

// --- State Management ---
// A simple event emitter to notify UI components of state changes.
const emitter = new EventTarget();

interface SyncState {
    pendingChanges: number;
    isSyncing: boolean;
    lastSync: Date | null;
}

let syncState: SyncState = {
    pendingChanges: 0,
    isSyncing: false,
    lastSync: null,
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

/**
 * Simulates sending a batch of changes to a cloud backend.
 * In a real application, this function would make a POST request to a server endpoint.
 * The server would then process the batch of operations transactionally.
 * @param items The items from the sync queue to process.
 * @returns A promise that resolves if the sync is successful, and rejects otherwise.
 */
const syncWithCloud = (items: SyncQueueItem[]): Promise<void> => {
    console.log('SYNCING WITH CLOUD (outgoing):', items);
    
    // --- !! REPLACE THIS WITH YOUR ACTUAL BACKEND API CALL !! ---
    // For now, we simulate a successful network request with a delay.
    return new Promise(resolve => setTimeout(resolve, 1500));
};


/**
 * Processes the entire sync queue. It fetches pending items, sends them to the cloud,
 * and upon success, removes them from the local queue.
 */
export const processSyncQueue = async () => {
    if (syncState.isSyncing) {
        console.log('Sync already in progress.');
        return;
    }

    if (!navigator.onLine) {
        console.log('Cannot sync, app is offline.');
        const pendingItems = await dbGetSyncQueue(); // Update count even if offline
        updateState({ pendingChanges: pendingItems.length });
        return;
    }

    updateState({ isSyncing: true });

    try {
        const itemsToSync = await dbGetSyncQueue();
        if (itemsToSync.length === 0) {
            console.log('Outgoing sync queue is empty.');
            updateState({ isSyncing: false, pendingChanges: 0 });
            return;
        }

        await syncWithCloud(itemsToSync);

        const syncedIds = itemsToSync.map(item => item.id);
        await dbDeleteSyncQueueItems(syncedIds);
        
        console.log(`Successfully synced ${itemsToSync.length} items.`);
        updateState({
            pendingChanges: 0,
            isSyncing: false,
            lastSync: new Date(),
        });

    } catch (error) {
        console.error('Failed to process sync queue:', error);
        const pendingItems = await dbGetSyncQueue(); // re-fetch count on error
        updateState({ isSyncing: false, pendingChanges: pendingItems.length });
    }
};


// --- Polling for Remote Changes ---

let _pollingIntervalId: number | undefined;
const POLLING_INTERVAL = 15000; // 15 seconds

/**
 * Simulates fetching updates from other clients via a central server.
 * In a real application, this would be an API call like `fetch('/api/changes?since=' + lastSyncTimestamp)`.
 */
const _fetchUpdatesFromCloud = async (): Promise<SyncQueueItem[]> => {
    // This is a simulation. It randomly decides to create a fake update
    // as if another user made a change on another device.
    if (Math.random() > 0.75) { // Roughly once a minute (15s * 4)
        const allTickets = await dbGetTickets();
        if (allTickets.length > 0) {
            const randomTicket = allTickets[Math.floor(Math.random() * allTickets.length)];
            const newStatus = randomTicket.status === RepairStatus.REPARATION_EN_COURS
                ? RepairStatus.TESTS_EN_COURS
                : RepairStatus.REPARATION_EN_COURS;
            
            console.log(`(SIMULÉ) Mise à jour distante pour la fiche ${randomTicket.id}. Nouveau statut: ${newStatus}`);
            
            const updatedTicket: RepairTicket = {
                ...randomTicket,
                status: newStatus,
                updatedAt: new Date().toISOString(), // This is crucial for conflict resolution
                history: [
                    ...randomTicket.history,
                    {
                        timestamp: new Date().toISOString(),
                        user: 'Technicien',
                        action: `(SIMULÉ) Statut changé à "${newStatus}"`,
                    }
                ]
            };

            const simulatedChange: SyncQueueItem = {
                id: Date.now(), // Fake ID for the queue item
                timestamp: Date.now(),
                entity: 'ticket',
                entityId: updatedTicket.id,
                operation: 'put',
                payload: updatedTicket
            };
            return [simulatedChange];
        }
    }
    return [];
};


/**
 * Applies a batch of changes received from the cloud to the local database,
 * handling potential conflicts by merging.
 * @param changes An array of SyncQueueItem objects from the server.
 */
const _applyRemoteChanges = async (changes: SyncQueueItem[]) => {
    console.log(`Application de ${changes.length} modification(s) distante(s).`);
    const storeMap: Record<EntityType, string> = {
        'ticket': 'tickets', 'stock': 'stock', 'service': 'services',
        'facture': 'factures', 'proforma': 'proformas', 'commande': 'commandes',
        'appointment': 'appointments', 'deviceSession': 'deviceSessions',
        'simpleDocument': 'simpleDocuments',
        'storedDocument': 'knowledge_files'
    };

    for (const change of changes) {
        const storeName = storeMap[change.entity];
        if (!storeName) continue;

        if (change.operation === 'put') {
            const localItem = await dbGet(storeName, change.entityId);
            const mergedItem = mergeUpdates(change.entity, localItem, change.payload);
            await dbPutDirect(storeName, mergedItem);
        } else if (change.operation === 'delete') {
            await dbDeleteDirect(storeName, change.entityId);
        }
    }

    // Notify the UI to re-fetch data
    window.dispatchEvent(new CustomEvent('datareceived'));
};

const _pollForChanges = async () => {
    if (!navigator.onLine || syncState.isSyncing) {
        return;
    }

    try {
        const changes = await _fetchUpdatesFromCloud();
        if (changes.length > 0) {
            await _applyRemoteChanges(changes);
        }
    } catch (error) {
        console.error("Polling for changes failed:", error);
    }
};

const startPolling = () => {
    if (_pollingIntervalId) {
        clearInterval(_pollingIntervalId);
    }
    // _pollingIntervalId = window.setInterval(_pollForChanges, POLLING_INTERVAL);
};


/**
 * Initializes the sync service by checking the queue size on startup,
 * setting up an event listener to trigger syncs on data changes, and
 * starting the polling mechanism for remote updates.
 */
export const initializeSyncService = async () => {
    const pendingItems = await dbGetSyncQueue();
    updateState({ pendingChanges: pendingItems.length });

    // The 'datachanged' event listener that triggered a redundant server sync has been removed.
    // The main sync logic is now handled by the debounced save in App.tsx.
    
    // Start polling for remote changes to simulate incoming sync
    startPolling();
};