import { dbGet, dbPutDirect, dbDeleteDirect } from './dbService.ts';
import { mergeUpdates } from '../utils/merge.ts';
import { SyncQueueItem, EntityType } from '../types.ts';

const CHANNEL_NAME = 'mac-repair-sync-channel';
let channel: BroadcastChannel | null = null;

let isApplyingRealtimeChange = false;
const realtimeChangeQueue: SyncQueueItem[] = [];

const processRealtimeQueue = async () => {
    if (isApplyingRealtimeChange || realtimeChangeQueue.length === 0) {
        return;
    }

    isApplyingRealtimeChange = true;
    const changesToApply = [...realtimeChangeQueue];
    realtimeChangeQueue.length = 0; // Clear the queue

    console.log(`Real-time: Applying batch of ${changesToApply.length} change(s) from another tab.`);

    try {
        const storeMap: Record<EntityType, string> = {
            'ticket': 'tickets', 'stock': 'stock', 'service': 'services',
            'facture': 'factures', 'proforma': 'proformas', 'commande': 'commandes',
            'appointment': 'appointments', 'deviceSession': 'deviceSessions',
            'simpleDocument': 'simpleDocuments',
            'storedDocument': 'knowledge_files'
        };

        for (const change of changesToApply) {
            const storeName = storeMap[change.entity];
            if (!storeName) continue;

            if (change.operation === 'put') {
                const localItem = await dbGet(storeName, change.entityId);
                const mergedItem = mergeUpdates(change.entity, localItem, change.payload);
                
                if (JSON.stringify(localItem) !== JSON.stringify(mergedItem)) {
                    await dbPutDirect(storeName, mergedItem);
                }
            } else if (change.operation === 'delete') {
                await dbDeleteDirect(storeName, change.entityId);
            }
        }

        if (changesToApply.length > 0) {
            // Notify the UI hooks to re-fetch data and update the view, once per batch.
            window.dispatchEvent(new CustomEvent('datareceived', { detail: changesToApply }));
        }
    } catch (error) {
        console.error("Error applying real-time changes from queue:", error);
    } finally {
        isApplyingRealtimeChange = false;
        // Process any new items that arrived while processing
        if (realtimeChangeQueue.length > 0) {
            processRealtimeQueue();
        }
    }
};

export const initializeRealtimeSync = () => {
    if ('BroadcastChannel' in window) {
        try {
            channel = new BroadcastChannel(CHANNEL_NAME);
            channel.onmessage = (event) => {
                // Handle both single items and arrays of items
                const changes = Array.isArray(event.data) ? event.data : [event.data];
                realtimeChangeQueue.push(...changes);
                processRealtimeQueue();
            };
            
            // Listen for local changes to broadcast them to other tabs
            const handleDataChangeForBroadcast = (event: Event) => {
                if (event instanceof CustomEvent && event.detail) {
                    broadcastChange(event.detail);
                }
            };
            window.addEventListener('datachanged', handleDataChangeForBroadcast);

            console.log("Real-time sync service initialized for inter-tab communication.");
        } catch (error) {
            console.error("Failed to initialize BroadcastChannel:", error);
        }
    } else {
        console.warn("BroadcastChannel API not supported. Real-time sync between tabs is disabled.");
    }
};

// This function is called from dbService to notify other tabs. It can handle a single change or an array.
export const broadcastChange = (change: Omit<SyncQueueItem, 'id' | 'timestamp'> | Omit<SyncQueueItem, 'id' | 'timestamp'>[]) => {
    if (channel) {
        channel.postMessage(change);
    }
};