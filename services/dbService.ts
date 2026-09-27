
import { openDB, IDBPDatabase } from 'idb';
import { RepairTicket, StockItem, StockUsage, ExternalPurchase, RepairServiceItem, LogEntry, SuggestionRecord, SyncQueueItem, Facture, Proforma, Commande, Appointment, DeviceSession, EntityType, BackupData, SimpleDocument, StoredDocument, EngagementSav, MouvementStock } from '../types.ts';

const DB_NAME = 'MacRepairDB';
const DB_VERSION = 14; // Version incremented for mouvementsStock
const TICKET_STORE = 'tickets';
const STOCK_STORE = 'stock';
const STOCK_USAGE_STORE = 'stockUsage';
const EXTERNAL_PURCHASE_STORE = 'externalPurchases';
const SERVICES_STORE = 'services';
const SUGGESTIONS_STORE = 'suggestions';
const LOGS_STORE = 'logs';
const BACKUPS_STORE = 'backups';
const SYNC_QUEUE_STORE = 'syncQueue';
const FACTURES_STORE = 'factures';
const PROFORMAS_STORE = 'proformas';
const COMMANDES_STORE = 'commandes';
const APPOINTMENTS_STORE = 'appointments';
const DEVICE_SESSIONS_STORE = 'deviceSessions';
const SIMPLE_DOCUMENTS_STORE = 'simpleDocuments';
const KNOWLEDGE_FILES_STORE = 'knowledge_files';
const ENGAGEMENTS_SAV_STORE = 'engagementsSav';
const MOUVEMENT_STOCK_STORE = 'mouvementsStock';

let dbPromise: Promise<IDBPDatabase> | null = null;

export const getDB = (): Promise<IDBPDatabase> => {
    if (!dbPromise) {
        console.log("Opening IndexedDB connection...");
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const stores = [
                    TICKET_STORE, STOCK_STORE, STOCK_USAGE_STORE, EXTERNAL_PURCHASE_STORE, SERVICES_STORE, LOGS_STORE,
                    BACKUPS_STORE, SYNC_QUEUE_STORE, FACTURES_STORE,
                    PROFORMAS_STORE, COMMANDES_STORE, APPOINTMENTS_STORE,
                    DEVICE_SESSIONS_STORE, SIMPLE_DOCUMENTS_STORE, KNOWLEDGE_FILES_STORE,
                    SUGGESTIONS_STORE, ENGAGEMENTS_SAV_STORE, MOUVEMENT_STOCK_STORE
                ];
                stores.forEach(s => {
                    if (!db.objectStoreNames.contains(s)) {
                        db.createObjectStore(s, { 
                            keyPath: s === SUGGESTIONS_STORE ? 'category' : 'id',
                            autoIncrement: (s === BACKUPS_STORE || s === SYNC_QUEUE_STORE)
                        });
                    }
                });
            },
            blocked() {
                console.warn("IndexedDB open blocked by another tab/session holding a lock.");
            },
            blocking() {
                console.warn("IndexedDB is blocking an upgrade in another tab/session. Closing connection.");
                dbPromise?.then(db => {
                    db.close();
                }).catch(() => {});
                dbPromise = null;
            },
            terminated() {
                console.warn("IndexedDB connection abnormally terminated by the browser.");
                dbPromise = null;
            }
        }).then(db => {
            // Attach close event handler on native DB connection via proxy
            // When the database connection closes, we must reset the promise
            // so that any subsequent read/write request automatically opens a new connection
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (db as any).onclose = () => {
                    console.warn("Native IDBDatabase connection closed. Resetting dbPromise for reconnection.");
                    dbPromise = null;
                };
            } catch (err) {
                console.warn("Failed to attach onclose to wrapped IDBDatabase:", err);
            }
            return db;
        }).catch(err => {
            console.error("Failed to open IndexedDB database:", err);
            dbPromise = null;
            throw err;
        });
    }
    return dbPromise;
};

const addToSyncQueue = async (entity: EntityType, entityId: string, operation: 'put' | 'delete', payload?: unknown) => {
    try {
        const db = await getDB();
        const item: Omit<SyncQueueItem, 'id'> = {
            timestamp: Date.now(),
            entity,
            entityId,
            operation,
            payload: payload ? JSON.parse(JSON.stringify(payload)) : undefined 
        };
        await db.put(SYNC_QUEUE_STORE, item);
        window.dispatchEvent(new CustomEvent('datachanged', { detail: item }));
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (e) {
        console.error("Sync Queue Error:", e);
    }
};

export const dbGetEngagementsSav = async (): Promise<EngagementSav[]> => {
    const db = await getDB();
    return db.getAll(ENGAGEMENTS_SAV_STORE);
};

export const dbAddEngagementSav = async (item: EngagementSav) => {
    const db = await getDB();
    await db.put(ENGAGEMENTS_SAV_STORE, item);
    await addToSyncQueue('engagementSav', item.id, 'put', item);
};

export const dbUpdateEngagementSav = async (item: EngagementSav) => {
    const db = await getDB();
    await db.put(ENGAGEMENTS_SAV_STORE, item);
    await addToSyncQueue('engagementSav', item.id, 'put', item);
};

export const dbDeleteEngagementSav = async (id: string) => {
    const db = await getDB();
    await db.delete(ENGAGEMENTS_SAV_STORE, id);
    await addToSyncQueue('engagementSav', id, 'delete');
};

export const dbBulkPutEngagementsSav = async (items: EngagementSav[]) => {
    const db = await getDB();
    const tx = db.transaction(ENGAGEMENTS_SAV_STORE, 'readwrite');
    for (const item of items) await tx.store.put(item);
    await tx.done;
    
    // Add to sync queue for each item to push updates to Firebase
    for (const item of items) {
        await addToSyncQueue('engagementSav', item.id, 'put', item);
    }
};

export const dbGetTickets = async (): Promise<RepairTicket[]> => {
    const db = await getDB();
    return db.getAll(TICKET_STORE);
};

export const dbAddTicket = async (ticket: RepairTicket) => {
    const db = await getDB();
    await db.put(TICKET_STORE, ticket);
    await addToSyncQueue('ticket', ticket.id, 'put', ticket);
};

export const dbUpdateTicket = async (ticket: RepairTicket) => {
    const db = await getDB();
    await db.put(TICKET_STORE, ticket);
    await addToSyncQueue('ticket', ticket.id, 'put', ticket);
};

export const dbDeleteTicket = async (id: string) => {
    const db = await getDB();
    await db.delete(TICKET_STORE, id);
    await addToSyncQueue('ticket', id, 'delete');
};

export const dbBulkPutTickets = async (tickets: RepairTicket[]) => {
    const db = await getDB();
    const tx = db.transaction(TICKET_STORE, 'readwrite');
    for (const ticket of tickets) await tx.store.put(ticket);
    await tx.done;

    // Add to sync queue for each ticket to push updates to Firebase
    for (const ticket of tickets) {
        await addToSyncQueue('ticket', ticket.id, 'put', ticket);
    }
};

export const dbGetStock = async (): Promise<StockItem[]> => {
    const db = await getDB();
    return db.getAll(STOCK_STORE);
};

export const dbGetPaginatedStock = async ({ query, page, pageSize }: { query: string; page: number; pageSize: number }) => {
    const db = await getDB();
    const all = await db.getAll(STOCK_STORE);
    const filtered = all.filter(item => 
        item.name.toLowerCase().includes(query.toLowerCase()) || 
        (item.reference && item.reference.toLowerCase().includes(query.toLowerCase())) ||
        (item.compatibleModels && item.compatibleModels.some(m => m.toLowerCase().includes(query.toLowerCase())))
    );
    const start = (page - 1) * pageSize;
    return { items: filtered.slice(start, start + pageSize), totalCount: filtered.length };
};

export const dbAddStockItem = async (item: StockItem) => {
    const db = await getDB();
    await db.put(STOCK_STORE, item);
    await addToSyncQueue('stock', item.id, 'put', item);
};

export const dbUpdateStockItem = async (item: StockItem) => {
    const db = await getDB();
    await db.put(STOCK_STORE, item);
    await addToSyncQueue('stock', item.id, 'put', item);
};

export const dbDeleteStockItem = async (id: string) => {
    const db = await getDB();
    await db.delete(STOCK_STORE, id);
    await addToSyncQueue('stock', id, 'delete');
};

export const dbClearStock = async () => {
    const db = await getDB();
    await db.clear(STOCK_STORE);
};

export const dbGetStockUsage = async (): Promise<StockUsage[]> => {
    const db = await getDB();
    return db.getAll(STOCK_USAGE_STORE);
};

export const dbAddStockUsage = async (usage: StockUsage) => {
    const db = await getDB();
    await db.put(STOCK_USAGE_STORE, usage);
    await addToSyncQueue('stockUsage', usage.id, 'put', usage);
};

export const dbDeleteStockUsage = async (id: string) => {
    const db = await getDB();
    await db.delete(STOCK_USAGE_STORE, id);
    await addToSyncQueue('stockUsage', id, 'delete');
};

// MouvementStock operations
export const dbGetMouvementsStock = async (): Promise<MouvementStock[]> => {
    const db = await getDB();
    return db.getAll(MOUVEMENT_STOCK_STORE);
};

export const dbAddMouvementStock = async (mouvement: MouvementStock) => {
    const db = await getDB();
    await db.put(MOUVEMENT_STOCK_STORE, mouvement);
    await addToSyncQueue('mouvementStock', mouvement.id, 'put', mouvement);
};

export const dbDeleteMouvementStock = async (id: string) => {
    const db = await getDB();
    await db.delete(MOUVEMENT_STOCK_STORE, id);
    await addToSyncQueue('mouvementStock', id, 'delete');
};

// External Purchases (Collaborators)
export const dbGetExternalPurchases = async (): Promise<ExternalPurchase[]> => {
    const db = await getDB();
    return db.getAll(EXTERNAL_PURCHASE_STORE);
};

export const dbAddExternalPurchase = async (purchase: ExternalPurchase) => {
    const db = await getDB();
    await db.put(EXTERNAL_PURCHASE_STORE, purchase);
    await addToSyncQueue('externalPurchase', purchase.id, 'put', purchase);
};

export const dbDeleteExternalPurchase = async (id: string) => {
    const db = await getDB();
    await db.delete(EXTERNAL_PURCHASE_STORE, id);
    await addToSyncQueue('externalPurchase', id, 'delete');
};

export const dbGetServices = async (): Promise<RepairServiceItem[]> => {
    const db = await getDB();
    return db.getAll(SERVICES_STORE);
};

export const dbAddService = async (service: RepairServiceItem) => {
    const db = await getDB();
    await db.put(SERVICES_STORE, service);
    await addToSyncQueue('service', service.id, 'put', service);
};

export const dbUpdateService = async (service: RepairServiceItem) => {
    const db = await getDB();
    await db.put(SERVICES_STORE, service);
    await addToSyncQueue('service', service.id, 'put', service);
};

export const dbDeleteService = async (id: string) => {
    const db = await getDB();
    await db.delete(SERVICES_STORE, id);
    await addToSyncQueue('service', id, 'delete');
};

export const dbGetSuggestions = async (): Promise<SuggestionRecord[]> => {
    const db = await getDB();
    return db.getAll(SUGGESTIONS_STORE);
};

export const dbPutSuggestion = async (suggestion: SuggestionRecord) => {
    const db = await getDB();
    await db.put(SUGGESTIONS_STORE, suggestion);
    await addToSyncQueue('suggestions', suggestion.category, 'put', suggestion);
};

export const dbClearSuggestions = async () => {
    const db = await getDB();
    await db.clear(SUGGESTIONS_STORE);
};

export const dbGetLogs = async (): Promise<LogEntry[]> => {
    const db = await getDB();
    return db.getAll(LOGS_STORE);
};

export const dbAddLog = async (log: LogEntry) => {
    const db = await getDB();
    await db.put(LOGS_STORE, log);
};

export const dbGetSyncQueue = async (): Promise<SyncQueueItem[]> => {
    const db = await getDB();
    return db.getAll(SYNC_QUEUE_STORE);
};

export const dbPutSyncQueueItem = async (item: SyncQueueItem) => {
    const db = await getDB();
    await db.put(SYNC_QUEUE_STORE, item);
};

export const dbDeleteSyncQueueItems = async (ids: number[]) => {
    const db = await getDB();
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    for (const id of ids) await tx.store.delete(id);
    await tx.done;
};

export const dbGetFactures = async (): Promise<Facture[]> => {
    const db = await getDB();
    return db.getAll(FACTURES_STORE);
};

export const dbAddFacture = async (facture: Facture) => {
    const db = await getDB();
    await db.put(FACTURES_STORE, facture);
    await addToSyncQueue('facture', facture.id, 'put', facture);
};

export const dbUpdateFacture = async (facture: Facture) => {
    const db = await getDB();
    await db.put(FACTURES_STORE, facture);
    await addToSyncQueue('facture', facture.id, 'put', facture);
};

export const dbDeleteFacture = async (id: string) => {
    const db = await getDB();
    await db.delete(FACTURES_STORE, id);
    await addToSyncQueue('facture', id, 'delete');
};

export const dbGetProformas = async (): Promise<Proforma[]> => {
    const db = await getDB();
    return db.getAll(PROFORMAS_STORE);
};

export const dbAddProforma = async (proforma: Proforma) => {
    const db = await getDB();
    await db.put(PROFORMAS_STORE, proforma);
    await addToSyncQueue('proforma', proforma.id, 'put', proforma);
};

export const dbUpdateProforma = async (proforma: Proforma) => {
    const db = await getDB();
    await db.put(PROFORMAS_STORE, proforma);
    await addToSyncQueue('proforma', proforma.id, 'put', proforma);
};

export const dbDeleteProforma = async (id: string) => {
    const db = await getDB();
    await db.delete(PROFORMAS_STORE, id);
    await addToSyncQueue('proforma', id, 'delete');
};

export const dbGetCommandes = async (): Promise<Commande[]> => {
    const db = await getDB();
    return db.getAll(COMMANDES_STORE);
};

export const dbAddCommande = async (commande: Commande) => {
    const db = await getDB();
    await db.put(COMMANDES_STORE, commande);
    await addToSyncQueue('commande', commande.id, 'put', commande);
};

export const dbUpdateCommande = async (commande: Commande) => {
    const db = await getDB();
    await db.put(COMMANDES_STORE, commande);
    await addToSyncQueue('commande', commande.id, 'put', commande);
};

export const dbDeleteCommande = async (id: string) => {
    const db = await getDB();
    await db.delete(COMMANDES_STORE, id);
    await addToSyncQueue('commande', id, 'delete');
};

export const dbGetAppointments = async (): Promise<Appointment[]> => {
    const db = await getDB();
    return db.getAll(APPOINTMENTS_STORE);
};

export const dbAddAppointment = async (appointment: Appointment) => {
    const db = await getDB();
    await db.put(APPOINTMENTS_STORE, appointment);
    await addToSyncQueue('appointment', appointment.id, 'put', appointment);
};

export const dbUpdateAppointment = async (appointment: Appointment) => {
    const db = await getDB();
    await db.put(APPOINTMENTS_STORE, appointment);
    await addToSyncQueue('appointment', appointment.id, 'put', appointment);
};

export const dbDeleteAppointment = async (id: string) => {
    const db = await getDB();
    await db.delete(APPOINTMENTS_STORE, id);
    await addToSyncQueue('appointment', id, 'delete');
};

export const dbGetDeviceSessions = async (): Promise<DeviceSession[]> => {
    const db = await getDB();
    return db.getAll(DEVICE_SESSIONS_STORE);
};

export const dbAddDeviceSession = async (session: DeviceSession) => {
    const db = await getDB();
    await db.put(DEVICE_SESSIONS_STORE, session);
};

export const dbGetSimpleDocuments = async (): Promise<SimpleDocument[]> => {
    const db = await getDB();
    return db.getAll(SIMPLE_DOCUMENTS_STORE);
};

export const dbAddSimpleDocument = async (doc: SimpleDocument) => {
    const db = await getDB();
    await db.put(SIMPLE_DOCUMENTS_STORE, doc);
    await addToSyncQueue('simpleDocument', doc.id, 'put', doc);
};

export const dbUpdateSimpleDocument = async (doc: SimpleDocument) => {
    const db = await getDB();
    await db.put(SIMPLE_DOCUMENTS_STORE, doc);
    await addToSyncQueue('simpleDocument', doc.id, 'put', doc);
};

export const dbDeleteSimpleDocument = async (id: string) => {
    const db = await getDB();
    await db.delete(SIMPLE_DOCUMENTS_STORE, id);
    await addToSyncQueue('simpleDocument', id, 'delete');
};

export const dbGetStoredDocuments = async (): Promise<StoredDocument[]> => {
    const db = await getDB();
    return db.getAll(KNOWLEDGE_FILES_STORE);
};

export const dbAddStoredDocument = async (doc: StoredDocument) => {
    const db = await getDB();
    await db.put(KNOWLEDGE_FILES_STORE, doc);
    await addToSyncQueue('storedDocument', doc.id, 'put', doc);
};

export const dbDeleteStoredDocument = async (id: string) => {
    const db = await getDB();
    await db.delete(KNOWLEDGE_FILES_STORE, id);
    await addToSyncQueue('storedDocument', id, 'delete');
};

export const dbGet = async (storeName: string, id: string): Promise<Record<string, unknown> | null> => {
    try {
        const db = await getDB();
        const item = await db.get(storeName as 'tickets', id);
        return (item as Record<string, unknown>) || null;
    } catch (err) {
        console.warn(`dbGet error on store ${storeName}:`, err);
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.toLowerCase().includes('closed') || errMsg.toLowerCase().includes('connection') || errMsg.toLowerCase().includes('transaction')) {
            console.log("Closed database or transaction error detected. Resetting dbPromise and retrying dbGet...");
            dbPromise = null;
            const db = await getDB();
            const item = await db.get(storeName as 'tickets', id);
            return (item as Record<string, unknown>) || null;
        }
        throw err;
    }
};

export const dbPutDirect = async (storeName: string, item: unknown) => {
    try {
        const db = await getDB();
        await db.put(storeName, item);
    } catch (err) {
        console.warn(`dbPutDirect error on store ${storeName}:`, err);
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.toLowerCase().includes('closed') || errMsg.toLowerCase().includes('connection') || errMsg.toLowerCase().includes('transaction')) {
            console.log("Closed database or transaction error detected. Resetting dbPromise and retrying dbPutDirect...");
            dbPromise = null;
            const db = await getDB();
            await db.put(storeName, item);
            return;
        }
        throw err;
    }
};

export const dbDeleteDirect = async (storeName: string, id: string) => {
    try {
        const db = await getDB();
        await db.delete(storeName, id);
    } catch (err) {
        console.warn(`dbDeleteDirect error on store ${storeName}:`, err);
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.toLowerCase().includes('closed') || errMsg.toLowerCase().includes('connection') || errMsg.toLowerCase().includes('transaction')) {
            console.log("Closed database or transaction error detected. Resetting dbPromise and retrying dbDeleteDirect...");
            dbPromise = null;
            const db = await getDB();
            await db.delete(storeName, id);
            return;
        }
        throw err;
    }
};

export const bulkPut = async (storeName: string, items: unknown[]) => {
    try {
        const db = await getDB();
        const tx = db.transaction(storeName, 'readwrite');
        for (const item of items) await tx.store.put(item);
        await tx.done;
    } catch (err) {
        console.warn(`bulkPut error on store ${storeName}:`, err);
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.toLowerCase().includes('closed') || errMsg.toLowerCase().includes('connection') || errMsg.toLowerCase().includes('transaction')) {
            console.log("Closed database or transaction error detected. Resetting dbPromise and retrying bulkPut...");
            dbPromise = null;
            const db = await getDB();
            const tx = db.transaction(storeName, 'readwrite');
            for (const item of items) await tx.store.put(item);
            await tx.done;
            return;
        }
        throw err;
    }
};

export const dbClearSyncQueue = async () => {
    const db = await getDB();
    await db.clear(SYNC_QUEUE_STORE);
};

export const dbClearLogs = async () => {
    const db = await getDB();
    await db.clear(LOGS_STORE);
};

export const dbGetStorageEstimate = async () => {
    if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
            usage: estimate.usage || 0,
            quota: estimate.quota || 0,
            percent: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0
        };
    }
    return null;
};

export const dbRequestPersistentStorage = async () => {
    if (navigator.storage && navigator.storage.persist) {
        return await navigator.storage.persist();
    }
    return false;
};

export const dbGetAllStream = async <T>(storeName: string, callback: (item: T) => void): Promise<void> => {
    const db = await getDB();
    let cursor = await db.transaction(storeName).store.openCursor();
    while (cursor) {
        callback(cursor.value);
        cursor = await cursor.continue();
    }
};

export const dbRunRestoreTransaction = async (data: Partial<BackupData>, stores: { name: string; storeName: string; entityName: string }[], onProgress?: (msg: string) => void) => {
    const db = await getDB();
    for (const store of stores) {
        const items = (data as Record<string, unknown>)[store.name] as unknown[] || [];
        if (items.length > 0) {
            onProgress?.(`Restauration de : ${store.entityName}...`);
            await db.clear(store.storeName);
            const tx = db.transaction(store.storeName, 'readwrite');
            for (const item of items) await tx.store.put(item);
            await tx.done;
        }
    }
};
