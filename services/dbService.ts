
import { openDB, IDBPDatabase } from 'idb';
import { RepairTicket, StockItem, RepairServiceItem, RepairStatus, LogEntry, StoredBackup, SuggestionRecord, SyncQueueItem, Facture, Proforma, Commande, Appointment, HistoryEntry, DeviceSession, EntityType, BackupData, SimpleDocument, StoredDocument } from '../types.ts';


const DB_NAME = 'MacRepairDB';
const DB_VERSION = 10; 
const TICKET_STORE = 'tickets';
const STOCK_STORE = 'stock';
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


let dbPromise: Promise<IDBPDatabase> | null = null;

const createHistoryEntry = (user: HistoryEntry['user'], action: string): HistoryEntry => ({
    timestamp: new Date().toISOString(),
    user,
    action,
});

const initialTickets: RepairTicket[] = [
    {
      id: "RM-01",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      status: RepairStatus.A_DIAGNOSTIQUER,
      client: { name: "CAP SUD", phone: "0707550723", email: "", id: "CS-48" },
      macBrand: "APPLE",
      macModel: "A1534",
      problemDescription: "PROBLEME D'AFFICHAGE",
      technicianNotes: "",
      costs: { diagnostic: 5000, repair: 0, advance: 0 },
      powersOn: true, chargerIncluded: false, batteryFunctional: "yes",
      warrantyVoidAgreed: true,
      dataBackupAck: true,
      services: [],
      history: [createHistoryEntry('Accueil', 'Fiche créée')],
      diagnosticReport: [],
    },
];


const initDB = () => {
  if (dbPromise) return dbPromise;
  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(TICKET_STORE)) {
          const ticketStore = db.createObjectStore(TICKET_STORE, { keyPath: 'id' });
          initialTickets.forEach(ticket => ticketStore.put(ticket));
        }
        if (!db.objectStoreNames.contains(STOCK_STORE)) {
          db.createObjectStore(STOCK_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SERVICES_STORE)) {
          db.createObjectStore(SERVICES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SUGGESTIONS_STORE)) {
          db.createObjectStore(SUGGESTIONS_STORE, { keyPath: 'category' });
        }
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(LOGS_STORE)) {
          db.createObjectStore(LOGS_STORE, { keyPath: 'id' });
        }
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(BACKUPS_STORE)) {
          db.createObjectStore(BACKUPS_STORE, { keyPath: 'id' });
        }
      }
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        }
      }
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains(FACTURES_STORE)) {
          db.createObjectStore(FACTURES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PROFORMAS_STORE)) {
          db.createObjectStore(PROFORMAS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(COMMANDES_STORE)) {
          db.createObjectStore(COMMANDES_STORE, { keyPath: 'id' });
        }
      }
      if (oldVersion < 6) {
        if (!db.objectStoreNames.contains(APPOINTMENTS_STORE)) {
          db.createObjectStore(APPOINTMENTS_STORE, { keyPath: 'id' });
        }
      }
      if (oldVersion < 7) {
        if (!db.objectStoreNames.contains(DEVICE_SESSIONS_STORE)) {
          db.createObjectStore(DEVICE_SESSIONS_STORE, { keyPath: 'id' });
        }
      }
      if (oldVersion < 8) {
        const ticketStore = transaction.objectStore(TICKET_STORE);
        if (!ticketStore.indexNames.contains('by_status')) ticketStore.createIndex('by_status', 'status');
        if (!ticketStore.indexNames.contains('by_createdAt')) ticketStore.createIndex('by_createdAt', 'createdAt');
        
        const appointmentStore = transaction.objectStore(APPOINTMENTS_STORE);
        if (!appointmentStore.indexNames.contains('by_date')) appointmentStore.createIndex('by_date', 'date');
        if (!appointmentStore.indexNames.contains('by_ticketId')) appointmentStore.createIndex('by_ticketId', 'ticketId');

        const stockStore = transaction.objectStore(STOCK_STORE);
        if (!stockStore.indexNames.contains('by_name')) stockStore.createIndex('by_name', 'name');
        if (!stockStore.indexNames.contains('by_category')) stockStore.createIndex('by_category', 'category');
      }
      if (oldVersion < 9) {
          if (!db.objectStoreNames.contains(SIMPLE_DOCUMENTS_STORE)) {
              db.createObjectStore(SIMPLE_DOCUMENTS_STORE, { keyPath: 'id' });
          }
      }
      if (oldVersion < 10) {
          if (!db.objectStoreNames.contains(KNOWLEDGE_FILES_STORE)) {
              const store = db.createObjectStore(KNOWLEDGE_FILES_STORE, { keyPath: 'id' });
              store.createIndex('by_category', 'category');
          }
      }
    },
  });
  return dbPromise;
};

// --- Generic Read/Clear Functions ---
async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await initDB();
  return db.getAll(storeName);
}

export const dbGet = async (storeName: string, key: any) => {
    const db = await initDB();
    return db.get(storeName, key);
};

async function clearStore(storeName: string): Promise<void> {
    const db = await initDB();
    await db.clear(storeName);
}

export async function bulkPut<T>(storeName: string, items: T[]): Promise<void> {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    await Promise.all(items.map(item => tx.store.put(item)));
    await tx.done;
}

// --- Direct DB access for Realtime Sync (to avoid loops) ---
export async function dbPutDirect(storeName: string, item: any): Promise<void> {
    const db = await initDB();
    await db.put(storeName, item);
}

export async function dbDeleteDirect(storeName: string, id: string): Promise<void> {
    const db = await initDB();
    await db.delete(storeName, id);
}


// --- Atomic Operations for Sync ---
async function atomicPut<T extends { id: string }>(storeName: string, entity: EntityType, item: T): Promise<void> {
    const db = await initDB();
    const tx = db.transaction([storeName, SYNC_QUEUE_STORE], 'readwrite');
    const syncItem: Omit<SyncQueueItem, 'id' | 'timestamp'> = {
        entity: entity,
        entityId: item.id,
        operation: 'put',
        payload: item
    };
    await Promise.all([
        tx.objectStore(storeName).put(item),
        tx.objectStore(SYNC_QUEUE_STORE).add({ ...syncItem, timestamp: Date.now() })
    ]);
    await tx.done;
    window.dispatchEvent(new CustomEvent('datachanged', { detail: syncItem }));
}

async function atomicDelete(storeName: string, entity: EntityType, id: string): Promise<void> {
    const db = await initDB();
    const tx = db.transaction([storeName, SYNC_QUEUE_STORE], 'readwrite');
    const syncItem: Omit<SyncQueueItem, 'id' | 'timestamp'> = {
        entity: entity,
        entityId: id,
        operation: 'delete'
    };
    await Promise.all([
        tx.objectStore(storeName).delete(id),
        tx.objectStore(SYNC_QUEUE_STORE).add({ ...syncItem, timestamp: Date.now() })
    ]);
    await tx.done;
    window.dispatchEvent(new CustomEvent('datachanged', { detail: syncItem }));
}

async function atomicBulkPut<T extends { id: string }>(storeName: string, entity: EntityType, items: T[]): Promise<void> {
    if (items.length === 0) return;
    const db = await initDB();
    const tx = db.transaction([storeName, SYNC_QUEUE_STORE], 'readwrite');
    const promises: Promise<any>[] = [];
    const timestamp = Date.now();
    const changesToBroadcast: Omit<SyncQueueItem, 'id' | 'timestamp'>[] = [];

    items.forEach(item => {
        const syncItem: Omit<SyncQueueItem, 'id' | 'timestamp'> = {
            entity: entity,
            entityId: item.id,
            operation: 'put',
            payload: item
        };
        promises.push(tx.objectStore(storeName).put(item));
        promises.push(tx.objectStore(SYNC_QUEUE_STORE).add({ ...syncItem, timestamp }));
        changesToBroadcast.push(syncItem);
    });

    await Promise.all(promises);
    await tx.done;
    
    window.dispatchEvent(new CustomEvent('datachanged', { detail: changesToBroadcast }));
}


// --- Sync Queue ---
export const dbGetSyncQueue = () => getAll<SyncQueueItem>(SYNC_QUEUE_STORE);
export const dbDeleteSyncQueueItems = async (ids: number[]): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    await Promise.all(ids.map(id => tx.store.delete(id)));
    await tx.done;
};
export const dbClearSyncQueue = () => clearStore(SYNC_QUEUE_STORE);


// --- Tickets ---
export const dbGetTickets = () => getAll<RepairTicket>(TICKET_STORE);
export const dbAddTicket = (ticket: RepairTicket) => atomicPut(TICKET_STORE, 'ticket', ticket);
export const dbUpdateTicket = (ticket: RepairTicket) => atomicPut(TICKET_STORE, 'ticket', ticket);
export const dbDeleteTicket = (id: string) => atomicDelete(TICKET_STORE, 'ticket', id);
export const dbClearTickets = () => clearStore(TICKET_STORE);
export const dbBulkPutTickets = (tickets: RepairTicket[]) => atomicBulkPut(TICKET_STORE, 'ticket', tickets);
export const dbDeleteOldTickets = async (): Promise<void> => {
    const db = await initDB();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const tickets = await db.getAll(TICKET_STORE);
    const oldTickets = tickets.filter(t => new Date(t.createdAt) < oneYearAgo);

    if (oldTickets.length > 0) {
        for (const ticket of oldTickets) {
            await atomicDelete(TICKET_STORE, 'ticket', ticket.id);
        }
    }
};

// --- Stock ---
export const dbGetStock = () => getAll<StockItem>(STOCK_STORE);

export const dbGetPaginatedStock = async ({ query, page, pageSize }: { query: string; page: number; pageSize: number; }) => {
    const db = await initDB();
    const allItems = await db.getAll(STOCK_STORE);
    
    const lowerQuery = query.toLowerCase();
    let filteredItems = query
      ? allItems.filter(item =>
          item.name.toLowerCase().includes(lowerQuery) ||
          item.category.toLowerCase().includes(lowerQuery) ||
          item.reference?.toLowerCase().includes(lowerQuery)
        )
      : allItems;

    filteredItems.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const totalCount = filteredItems.length;
    const start = (page - 1) * pageSize;
    const items = filteredItems.slice(start, start + pageSize);
    
    return { items, totalCount };
};

export const dbAddStockItem = (item: StockItem) => atomicPut(STOCK_STORE, 'stock', item);
export const dbUpdateStockItem = (item: StockItem) => atomicPut(STOCK_STORE, 'stock', item);
export const dbDeleteStockItem = (id: string) => atomicDelete(STOCK_STORE, 'stock', id);
export const dbClearStock = () => clearStore(STOCK_STORE);
export const dbBulkPutStock = (items: StockItem[]) => atomicBulkPut(STOCK_STORE, 'stock', items);

// --- Services ---
export const dbGetServices = () => getAll<RepairServiceItem>(SERVICES_STORE);
export const dbAddService = (service: RepairServiceItem) => atomicPut(SERVICES_STORE, 'service', service);
export const dbUpdateService = (service: RepairServiceItem) => atomicPut(SERVICES_STORE, 'service', service);
export const dbDeleteService = (id: string) => atomicDelete(SERVICES_STORE, 'service', id);
export const dbClearServices = () => clearStore(SERVICES_STORE);
export const dbBulkPutServices = (services: RepairServiceItem[]) => atomicBulkPut(SERVICES_STORE, 'service', services);

// --- Suggestions (Not Synced) ---
export const dbGetSuggestions = () => getAll<SuggestionRecord>(SUGGESTIONS_STORE);
export const dbPutSuggestion = async (suggestion: SuggestionRecord) => {
    const db = await initDB();
    await db.put(SUGGESTIONS_STORE, suggestion);
};
export const dbClearSuggestions = () => clearStore(SUGGESTIONS_STORE);
export const dbBulkPutSuggestions = (suggestions: SuggestionRecord[]) => bulkPut(SUGGESTIONS_STORE, suggestions);

// --- Logs (Not Synced) ---
export const dbGetLogs = () => getAll<LogEntry>(LOGS_STORE);
export const dbAddLog = async (log: LogEntry) => {
    const db = await initDB();
    await db.add(LOGS_STORE, log);
};
export const dbClearLogs = () => clearStore(LOGS_STORE);

// --- Backups (Local Only) ---
export const dbGetBackups = () => getAll<StoredBackup>(BACKUPS_STORE);
export const dbAddBackup = async (backup: StoredBackup) => {
    const db = await initDB();
    await db.put(BACKUPS_STORE, backup);
};
export const dbDeleteBackup = async (id: number): Promise<void> => {
    const db = await initDB();
    await db.delete(BACKUPS_STORE, id);
};

// --- Factures ---
export const dbGetFactures = () => getAll<Facture>(FACTURES_STORE);
export const dbAddFacture = (facture: Facture) => atomicPut(FACTURES_STORE, 'facture', facture);
export const dbUpdateFacture = (facture: Facture) => atomicPut(FACTURES_STORE, 'facture', facture);
export const dbDeleteFacture = (id: string) => atomicDelete(FACTURES_STORE, 'facture', id);
export const dbClearFactures = () => clearStore(FACTURES_STORE);
export const dbBulkPutFactures = (factures: Facture[]) => atomicBulkPut(FACTURES_STORE, 'facture', factures);

// --- Proformas ---
export const dbGetProformas = () => getAll<Proforma>(PROFORMAS_STORE);
export const dbAddProforma = (proforma: Proforma) => atomicPut(PROFORMAS_STORE, 'proforma', proforma);
export const dbUpdateProforma = (proforma: Proforma) => atomicPut(PROFORMAS_STORE, 'proforma', proforma);
export const dbDeleteProforma = (id: string) => atomicDelete(PROFORMAS_STORE, 'proforma', id);
export const dbClearProformas = () => clearStore(PROFORMAS_STORE);
export const dbBulkPutProformas = (proformas: Proforma[]) => atomicBulkPut(PROFORMAS_STORE, 'proforma', proformas);

// --- Commandes ---
export const dbGetCommandes = () => getAll<Commande>(COMMANDES_STORE);
export const dbAddCommande = (commande: Commande) => atomicPut(COMMANDES_STORE, 'commande', commande);
export const dbUpdateCommande = (commande: Commande) => atomicPut(COMMANDES_STORE, 'commande', commande);
export const dbDeleteCommande = (id: string) => atomicDelete(COMMANDES_STORE, 'commande', id);
export const dbClearCommandes = () => clearStore(COMMANDES_STORE);
export const dbBulkPutCommandes = (commandes: Commande[]) => atomicBulkPut(COMMANDES_STORE, 'commande', commandes);

// --- Simple Documents (Courriers) ---
export const dbGetSimpleDocuments = () => getAll<SimpleDocument>(SIMPLE_DOCUMENTS_STORE);
export const dbAddSimpleDocument = (doc: SimpleDocument) => atomicPut(SIMPLE_DOCUMENTS_STORE, 'simpleDocument', doc);
export const dbUpdateSimpleDocument = (doc: SimpleDocument) => atomicPut(SIMPLE_DOCUMENTS_STORE, 'simpleDocument', doc);
export const dbDeleteSimpleDocument = (id: string) => atomicDelete(SIMPLE_DOCUMENTS_STORE, 'simpleDocument', id);
export const dbClearSimpleDocuments = () => clearStore(SIMPLE_DOCUMENTS_STORE);
export const dbBulkPutSimpleDocuments = (docs: SimpleDocument[]) => atomicBulkPut(SIMPLE_DOCUMENTS_STORE, 'simpleDocument', docs);

// --- Stored Documents (Knowledge Base) ---
export const dbGetStoredDocuments = () => getAll<StoredDocument>(KNOWLEDGE_FILES_STORE);
export const dbAddStoredDocument = async (doc: StoredDocument) => {
    const db = await initDB();
    await db.put(KNOWLEDGE_FILES_STORE, doc);
};
export const dbDeleteStoredDocument = async (id: string) => {
    const db = await initDB();
    await db.delete(KNOWLEDGE_FILES_STORE, id);
};
export const dbClearStoredDocuments = () => clearStore(KNOWLEDGE_FILES_STORE);
export const dbBulkPutStoredDocuments = (docs: StoredDocument[]) => bulkPut(KNOWLEDGE_FILES_STORE, docs);

// --- Appointments ---
export const dbGetAppointments = () => getAll<Appointment>(APPOINTMENTS_STORE);
export const dbAddAppointment = (appointment: Appointment) => atomicPut(APPOINTMENTS_STORE, 'appointment', appointment);
export const dbUpdateAppointment = (appointment: Appointment) => atomicPut(APPOINTMENTS_STORE, 'appointment', appointment);
export const dbDeleteAppointment = (id: string) => atomicDelete(APPOINTMENTS_STORE, 'appointment', id);
export const dbClearAppointments = () => clearStore(APPOINTMENTS_STORE);
export const dbBulkPutAppointments = (appointments: Appointment[]) => atomicBulkPut(APPOINTMENTS_STORE, 'appointment', appointments);

// --- Device Sessions (Synced) ---
export const dbGetDeviceSessions = () => getAll<DeviceSession>(DEVICE_SESSIONS_STORE);
export const dbAddDeviceSession = (session: DeviceSession) => atomicPut(DEVICE_SESSIONS_STORE, 'deviceSession', session);

// --- Full Restore Transaction ---
export const dbRunRestoreTransaction = async (
    data: Partial<BackupData>, 
    storesToProcess: { 
        name: keyof BackupData; 
        storeName: string; 
        entityName: string; 
        sanitizer: (data: any[]) => any[];
    }[], 
    onProgress?: (message: string) => void
) => {
    const db = await initDB();
    
    // On dédoublonne les noms de stores pour éviter une erreur d'initialisation de transaction
    const activeStoreNames = Array.from(new Set(storesToProcess.map(s => s.storeName)));
    
    const tx = db.transaction(activeStoreNames, 'readwrite');
    
    try {
        for (const storeConfig of storesToProcess) {
            const dataToRestore = (data as any)[storeConfig.name];
            if (Array.isArray(dataToRestore)) {
                onProgress?.(`Traitement de ${storeConfig.entityName}...`);
                
                await tx.objectStore(storeConfig.storeName).clear();
                
                if (dataToRestore.length > 0) {
                    onProgress?.(`Restauration de ${dataToRestore.length} éléments...`);
                    const sanitizedData = storeConfig.sanitizer(dataToRestore);
                    const store = tx.objectStore(storeConfig.storeName);
                    for (const item of sanitizedData) {
                        await store.put(item);
                    }
                }
            } else {
                 onProgress?.(`Passage de ${storeConfig.entityName} (données non présentes)`);
            }
        }
        await tx.done;
    } catch (error) {
        console.error('La transaction de restauration a échoué:', error);
        throw error;
    }
};
