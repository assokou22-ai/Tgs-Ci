import { getDB, dbQueuePut, dbGetSyncQueue } from './dbService.ts';
import { hydrateFromCloudBestEffort, mergeUnresolvedMediaFallback, hasMediaRefs, warmMediaCacheFromRecord } from './cloudMedia.ts';
import { calibrateServerClock } from './syncClock.ts';
import { mergeUpdates } from '../utils/merge.ts';
import { stableStringify } from '../utils/fieldMerge.ts';
import { SyncQueueItem, EntityType } from '../types.ts';
import { collection, onSnapshot, getDocs, query, where, limit, Query, DocumentData } from 'firebase/firestore';
import { db, auth, isQuotaCooldownActive, isQuotaExceededError, reportQuotaExceeded } from './firebase.ts';
import { reportRealtimeSyncSuccess } from './syncService.ts';
import { resolveIncrementalSince, advanceCollectionWatermark } from './syncWatermark.ts';


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
const pendingMediaRetry = new Set<string>();
const lastRepush = new Map<string, number>();
let activeUid: string | null = null;
let startingUid: string | null = null;
let startSeq = 0;
let lifecycleInitialized = false;

/** Arrête proprement tous les écouteurs Firestore en cours. */
export const stopFirebaseRealtimeSync = () => {
    startSeq++;
    startingUid = null;
    while (unsubscribeList.length > 0) {
        const unsub = unsubscribeList.pop();
        if (unsub) {
            try { unsub(); } catch { /* ignore */ }
        }
    }
    activeUid = null;
};

/** Renvoie au Cloud une fiche locale plus complète (garde-fou anti-boucle : 1 fois / 60 s / fiche). */
const scheduleRepush = async (entity: EntityType, id: string, payload: unknown) => {
    const key = `${entity}/${id}`;
    const now = Date.now();
    if ((lastRepush.get(key) || 0) > now - 60_000) return;
    try {
        const queue = await dbGetSyncQueue();
        if (queue.some(q => q.entity === entity && q.entityId === id)) return;
    } catch { /* ignore */ }
    lastRepush.set(key, now);
    await dbQueuePut(entity, id, payload);
};


export const startFirebaseRealtimeSync = (forceRestart = false) => {
    if (!auth.currentUser) {
        stopFirebaseRealtimeSync();
        console.log("Firebase Real-time Sync: Deferring initialization (User not authenticated).");
        return;
    }

    if (isQuotaCooldownActive()) {
        console.warn("Firebase Real-time Sync: Paused temporarily (Firestore quota cooldown active).");
        return;
    }

    const currentUid = auth.currentUser.uid;
    // Ne pas détruire/recréer inutilement les écouteurs si déjà actifs ou en cours de démarrage pour cet utilisateur
    if (!forceRestart && ((unsubscribeList.length > 0 && activeUid === currentUid) || startingUid === currentUid)) {
        return;
    }

    stopFirebaseRealtimeSync();
    const mySeq = ++startSeq;
    activeUid = currentUid;
    startingUid = currentUid;

    console.log("Firebase Real-time Sync: Initializing watermarked onSnapshot listeners...");
    calibrateServerClock().catch(() => { /* non bloquant */ });

    (async () => {
        let dbInstance;
        try {
            dbInstance = await getDB();
        } catch (err) {
            console.error("Failed to open IndexedDB for realtime sync:", err);
            if (mySeq === startSeq) startingUid = null;
            return;
        }
        if (mySeq !== startSeq || !auth.currentUser || auth.currentUser.uid !== currentUid) {
            return;
        }

        for (const colSpec of collectionsToListen) {
            if (mySeq !== startSeq || isQuotaCooldownActive()) break;
            try {
                let listenerTarget: Query<DocumentData> = collection(db, colSpec.collectionName);
                try {
                    const localItems = await dbInstance.getAll(colSpec.storeName);
                    const since = resolveIncrementalSince(colSpec.collectionName, localItems);
                    if (since) {
                        listenerTarget = query(collection(db, colSpec.collectionName), where('updatedAt', '>', since));
                    }
                } catch {
                    /* repli collection complète si lecture locale indisponible */
                }

                if (mySeq !== startSeq) break;

                const unsub = onSnapshot(listenerTarget, async (snapshot) => {
                    try {
                        const docChanges = snapshot.docChanges();
                        if (docChanges.length === 0) {
                            if (!snapshot.metadata.fromCache) {
                                advanceCollectionWatermark(colSpec.collectionName, [], new Date().toISOString());
                            }
                            return;
                        }

                        // Cache Firestore persistant : au démarrage, si la base locale contient déjà des données
                        // et que l'instantané vient uniquement du cache local sans suppression, on l'ignore.
                        if (snapshot.metadata.fromCache) {
                            if (docChanges.some(c => c.type === 'removed')) return;
                            try {
                                const localCount = await (await getDB()).count(colSpec.storeName as never);
                                if (localCount > 0) return;
                            } catch { /* on traite normalement */ }
                        }

                        // Filter out pending local writes to avoid processing acknowledged changes or empty updates
                        const validChanges = docChanges.filter(c => !c.doc.metadata.hasPendingWrites);
                        if (validChanges.length === 0) {
                            if (!snapshot.metadata.fromCache) {
                                advanceCollectionWatermark(colSpec.collectionName, [], new Date().toISOString());
                            }
                            return;
                        }

                        const changesToProcess: SyncQueueItem[] = [];
                        const serverDocsForWm: unknown[] = [];
                        const liveDb = await getDB();

                        for (const docChange of validChanges) {
                            try {
                                const docId = docChange.doc.id;
                                let docData = docChange.doc.data();
                                if (!docData.id) {
                                    docData.id = docId;
                                }
                                if (colSpec.storeName === 'suggestions') {
                                    docData.category = docId;
                                }
                                if (docChange.type !== 'removed') {
                                    serverDocsForWm.push(docData);
                                }

                                const itemKey = colSpec.storeName === 'suggestions' ? docData.category : docData.id;
                                const localItem = docChange.type !== 'removed'
                                    ? await liveDb.get(colSpec.storeName, itemKey)
                                    : await liveDb.get(colSpec.storeName, docId);

                                let unresolvedRefs = 0;
                                if (docChange.type !== 'removed') {
                                    if (localItem && hasMediaRefs(docData)) {
                                        await warmMediaCacheFromRecord(localItem);
                                    }
                                    // Rapatrie les photos/fichiers stockés séparément sans JAMAIS jeter la fiche
                                    const hydrated = await hydrateFromCloudBestEffort(docData, !isQuotaCooldownActive());
                                    docData = hydrated.data;
                                    unresolvedRefs = hydrated.unresolvedRefs;
                                    if (unresolvedRefs > 0) {
                                        pendingMediaRetry.add(`${colSpec.collectionName}/${docId}`);
                                    } else {
                                        pendingMediaRetry.delete(`${colSpec.collectionName}/${docId}`);
                                    }
                                }

                            if (docChange.type === 'added' || docChange.type === 'modified') {
                                // Protège les photos locales si un média distant n'a pas pu être hydraté
                                const safeRemoteDoc = localItem && unresolvedRefs > 0
                                    ? mergeUnresolvedMediaFallback(localItem, docData)
                                    : docData;

                                if (localItem) {
                                    const mergedItem = mergeUpdates(colSpec.entity, localItem, safeRemoteDoc);
                                    // L'appareil possède des modifications plus récentes que le Cloud : on les renvoie (sauf si média incomplet)
                                    if (
                                        unresolvedRefs === 0 &&
                                        colSpec.entity !== 'suggestions' &&
                                        stableStringify(mergedItem) !== stableStringify(safeRemoteDoc)
                                    ) {
                                        await scheduleRepush(colSpec.entity, String(itemKey), mergedItem);
                                    }
                                    if (stableStringify(localItem) !== stableStringify(mergedItem)) {
                                        await liveDb.put(colSpec.storeName, mergedItem);
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
                                    await liveDb.put(colSpec.storeName, safeRemoteDoc);
                                    changesToProcess.push({
                                        id: Date.now() + Math.random(),
                                        timestamp: Date.now(),
                                        entity: colSpec.entity,
                                        entityId: itemKey,
                                        operation: 'put',
                                        payload: safeRemoteDoc
                                    });
                                }
                            } else if (docChange.type === 'removed') {
                                if (localItem) {
                                    await liveDb.delete(colSpec.storeName, docId);
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

                    if (!snapshot.metadata.fromCache) {
                        advanceCollectionWatermark(colSpec.collectionName, serverDocsForWm, new Date().toISOString());
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
                if (isQuotaExceededError(error)) {
                    reportQuotaExceeded(error);
                    stopFirebaseRealtimeSync();
                    return;
                }
                const errMsg = error instanceof Error ? error.message : String(error);
                if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('autoris') || errMsg.toLowerCase().includes('insufficient')) {
                    window.dispatchEvent(new CustomEvent('syncerror', { 
                        detail: { 
                            message: auth.currentUser?.email
                                ? `Votre compte ${auth.currentUser.email} n'est pas autorisé à accéder aux données de l'atelier. Demandez à un administrateur de l'ajouter dans Paramètres > Modularité Super-Admin > Équipe autorisée.`
                                : `Synchronisation en temps réel (${colSpec.collectionName}) : connexion Google requise ou session expirée.` 
                        } 
                    }));
                }
            });

            unsubscribeList.push(unsub);
        } catch (err) {
            console.error(`Failed to register onSnapshot for ${colSpec.collectionName}:`, err);
        }
    }
    if (mySeq === startSeq) startingUid = null;
    })();
};

let lastWakeupCatchUp = 0;
const NORMAL_WAKEUP_INTERVAL_MS = 5 * 60_000; // 5 minutes minimum entre deux rattrapages sur focus/visibilité
const FORCED_WAKEUP_INTERVAL_MS = 15_000;     // 15 secondes minimum même sur reconnexion forcée

/**
 * Déclenche un rattrapage léger et borné des fiches modifiées récemment
 * lors de la sortie de veille ou du retour réseau (sans détruire les écouteurs actifs).
 */
export const triggerDeviceWakeupCatchUp = async (force = false) => {
    const now = Date.now();
    const minInterval = force ? FORCED_WAKEUP_INTERVAL_MS : NORMAL_WAKEUP_INTERVAL_MS;
    if (now - lastWakeupCatchUp < minInterval) return;

    if (typeof window === 'undefined' || !navigator.onLine || !auth.currentUser || isQuotaCooldownActive()) return;
    lastWakeupCatchUp = now;

    const hadActiveListeners = unsubscribeList.length > 0 && activeUid === auth.currentUser.uid;
    if (!hadActiveListeners) {
        startFirebaseRealtimeSync(false);
    }

    // Si les écouteurs temps réel sont déjà actifs et qu'il ne s'agit pas d'un retour réseau explicite,
    // inutile de refaire une lecture getDocs supplémentaire sur tickets à chaque changement d'onglet.
    if (hadActiveListeners && !force) {
        return;
    }

    // 2. Rattrapage borné des fiches modifiées depuis le dernier jalon (max 100 docs, jamais de scan total non borné)
    try {
        const WM_KEY = 'tgs_wakeup_watermark_tickets';
        const watermark = localStorage.getItem(WM_KEY);
        const startedAt = new Date().toISOString();
        const defaultSince = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
        const since = watermark
            ? new Date(Date.parse(watermark) - 10 * 60_000).toISOString()
            : defaultSince;

        const snap = await getDocs(
            query(collection(db, 'tickets'), where('updatedAt', '>', since), limit(100))
        );
        const dbInstance = await getDB();
        let newOrUpdated = 0;

        for (const docSnap of snap.docs) {
            let data = docSnap.data();
            if (!data.id) data.id = docSnap.id;

            const local = await dbInstance.get('tickets', data.id);
            if (local && hasMediaRefs(data)) {
                await warmMediaCacheFromRecord(local);
            }
            const hydrated = await hydrateFromCloudBestEffort(data, !isQuotaCooldownActive());
            data = hydrated.data;

            const safeRemote = local && hydrated.unresolvedRefs > 0
                ? mergeUnresolvedMediaFallback(local, data)
                : data;

            const merged = local ? mergeUpdates('ticket', local, safeRemote) : safeRemote;
            if (!local || stableStringify(local) !== stableStringify(merged)) {
                await dbInstance.put('tickets', merged);
                newOrUpdated++;
            }
            if (
                local &&
                hydrated.unresolvedRefs === 0 &&
                stableStringify(merged) !== stableStringify(safeRemote)
            ) {
                await scheduleRepush('ticket', String(data.id), merged);
            }
        }

        // Toujours avancer le watermark pour éviter une boucle de re-scan permanente
        localStorage.setItem(WM_KEY, startedAt);
        advanceCollectionWatermark('tickets', snap.docs.map(d => d.data()), startedAt);

        if (newOrUpdated > 0) {
            console.log(`[Wakeup] Rattrapage terminé : ${newOrUpdated} fiches actualisées.`);
            window.dispatchEvent(new CustomEvent('datareceived'));
            window.dispatchEvent(new CustomEvent('tickets-updated'));
        }
    } catch (err) {
        if (isQuotaExceededError(err)) {
            reportQuotaExceeded(err);
        } else {
            console.warn("[Wakeup] Rattrapage Cloud non bloquant :", err);
        }
    }
};

export const initializeRealtimeSync = () => {
    startFirebaseRealtimeSync(false);

    if (typeof window !== 'undefined' && !lifecycleInitialized) {
        lifecycleInitialized = true;

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                triggerDeviceWakeupCatchUp(false);
            }
        };

        const handleFocus = () => {
            triggerDeviceWakeupCatchUp(false);
        };

        const handleOnline = () => {
            triggerDeviceWakeupCatchUp(true);
            window.dispatchEvent(new CustomEvent('requestsync'));
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('online', handleOnline);
    }
};
