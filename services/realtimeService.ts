import { getDB } from './dbService.ts';
import { mergeUpdates } from '../utils/merge.ts';
import { SyncQueueItem, EntityType } from '../types.ts';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase.ts';
import { reportRealtimeSyncSuccess } from './syncService.ts';


// Helper for deep stable JSON stringification to prevent key-order mismatch issues
const stableStringify = (obj: unknown): string => {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return '[' + obj.map(stableStringify).join(',') + ']';
    }
    const typedObj = obj as Record<string, unknown>;
    const keys = Object.keys(typedObj).sort();
    return '{' + keys.map(key => JSON.stringify(key) + ':' + stableStringify(typedObj[key])).join(',') + '}';
};

// --- Firestore Real-time Sync List ---
const collectionsToListen: { entity: EntityType; collectionName: string; storeName: string }[] = [
    { entity: 'ticket', collectionName: 'tickets', storeName: 'tickets' },
    { entity: 'stock', collectionName: 'stock', storeName: 'stock' },
    { entity: 'stockUsage', collectionName: 'stockUsage', storeName: 'stockUsage' },
    { entity: 'externalPurchase', collectionName: 'externalPurchases', storeName: 'externalPurchases' },
    { entity: 'service', collectionName: 'services', storeName: 'services' },
    { entity: 'facture', collectionName: 'factures', storeName: 'factures' },
    { entity: 'proforma', collectionName: 'proformas', storeName: 'proformas' },
    { entity: 'commande', collectionName: 'commandes', storeName: 'commandes' },
    { entity: 'appointment', collectionName: 'appointments', storeName: 'appointments' },
    { entity: 'simpleDocument', collectionName: 'simpleDocuments', storeName: 'simpleDocuments' },
    { entity: 'storedDocument', collectionName: 'storedDocuments', storeName: 'knowledge_files' },
    { entity: 'suggestions', collectionName: 'suggestions', storeName: 'suggestions' },
    { entity: 'engagementSav', collectionName: 'engagementsSav', storeName: 'engagementsSav' },
    { entity: 'mouvementStock', collectionName: 'mouvementsStock', storeName: 'mouvementsStock' }
];

const unsubscribeList: (() => void)[] = [];

export const startFirebaseRealtimeSync = () => {
    // Unsubscribe existing listeners
    while (unsubscribeList.length > 0) {
        const unsub = unsubscribeList.pop();
        if (unsub) unsub();
    }

    if (!auth.currentUser) {
        console.log("Firebase Real-time Sync: Deferring initialization (User not authenticated).");
        return;
    }

    console.log("Firebase Real-time Sync: Initializing onSnapshot listeners with transaction batching...");

    collectionsToListen.forEach((colSpec) => {
        try {
            const unsub = onSnapshot(collection(db, colSpec.collectionName), async (snapshot) => {
                try {
                    const docChanges = snapshot.docChanges();
                    if (docChanges.length === 0) return;

                    // Filter out pending local writes to avoid processing acknowledged changes or empty updates
                    const validChanges = docChanges.filter(c => !c.doc.metadata.hasPendingWrites);
                    if (validChanges.length === 0) return;

                    const changesToProcess: SyncQueueItem[] = [];
                    const dbInstance = await getDB();

                    for (const docChange of validChanges) {
                        try {
                            const docId = docChange.doc.id;
                            const docData = docChange.doc.data();

                            if (!docData.id) {
                                docData.id = docId;
                            }
                            if (colSpec.storeName === 'suggestions') {
                                docData.category = docId;
                            }

                            const itemKey = colSpec.storeName === 'suggestions' ? docData.category : docData.id;

                            if (docChange.type === 'added' || docChange.type === 'modified') {
                                console.log(`[Sync temps réel] Traitement de la modification pour ${colSpec.collectionName}/${docId}...`);
                                const localItem = await dbInstance.get(colSpec.storeName, itemKey);
                                if (localItem) {
                                    const mergedItem = mergeUpdates(colSpec.entity, localItem, docData);
                                    if (stableStringify(localItem) !== stableStringify(mergedItem)) {
                                        await dbInstance.put(colSpec.storeName, mergedItem);
                                        console.log(`[Sync temps réel] Mise à jour de ${colSpec.collectionName}/${docId} dans la base locale.`);
                                        changesToProcess.push({
                                            id: Date.now() + Math.random(),
                                            timestamp: Date.now(),
                                            entity: colSpec.entity,
                                            entityId: itemKey,
                                            operation: 'put',
                                            payload: mergedItem
                                        });
                                    }
                                } else {
                                    await dbInstance.put(colSpec.storeName, docData);
                                    console.log(`[Sync temps réel] Nouvel item ${colSpec.collectionName}/${docId} enregistré localement.`);
                                    changesToProcess.push({
                                        id: Date.now() + Math.random(),
                                        timestamp: Date.now(),
                                        entity: colSpec.entity,
                                        entityId: itemKey,
                                        operation: 'put',
                                        payload: docData
                                    });
                                }
                            } else if (docChange.type === 'removed') {
                                console.log(`[Sync temps réel] Traitement de la suppression pour ${colSpec.collectionName}/${docId}...`);
                                const localItem = await dbInstance.get(colSpec.storeName, docId);
                                if (localItem) {
                                    await dbInstance.delete(colSpec.storeName, docId);
                                    console.log(`[Sync temps réel] Suppression de ${colSpec.collectionName}/${docId} de la base locale.`);
                                    changesToProcess.push({
                                        id: Date.now() + Math.random(),
                                        timestamp: Date.now(),
                                        entity: colSpec.entity,
                                        entityId: docId,
                                        operation: 'delete'
                                    });
                                }
                            }
                        } catch (itemErr) {
                            console.error(`Error processing real-time change for ${colSpec.collectionName}/${docChange.doc.id}:`, itemErr);
                        }
                    }

                    if (changesToProcess.length > 0) {
                        window.dispatchEvent(new CustomEvent('datareceived', { detail: changesToProcess }));
                        try {
                            reportRealtimeSyncSuccess(changesToProcess.length);
                        } catch (err) {
                            console.error("Failed to report real-time sync success:", err);
                        }
                    }
                } catch (snapshotErr) {
                    console.error(`Fatal error in snapshot callback for ${colSpec.collectionName}:`, snapshotErr);
                }
            }, (error) => {
                console.warn(`onSnapshot error for ${colSpec.collectionName}:`, error);
                const errMsg = error instanceof Error ? error.message : String(error);
                if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('autoris') || errMsg.toLowerCase().includes('insufficient')) {
                    window.dispatchEvent(new CustomEvent('syncerror', { 
                        detail: { 
                            message: `Synchronisation en temps réel (${colSpec.collectionName}) : Connexion Google requise ou session expirée.` 
                        } 
                    }));
                }
            });

            unsubscribeList.push(unsub);
        } catch (err) {
            console.error(`Failed to register onSnapshot for ${colSpec.collectionName}:`, err);
        }
    });
};

export const initializeRealtimeSync = () => {
    // Initialize Firestore onSnapshot for real-time sync across devices/browsers
    startFirebaseRealtimeSync();
};

