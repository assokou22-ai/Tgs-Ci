
import { BackupData, StoredBackup, RepairTicket, StockItem, RepairServiceItem, SuggestionRecord, Appointment, Facture, Proforma, Commande, EntityType, SimpleDocument, StoredDocument } from '../types.ts';
import { 
    dbGetTickets, dbGetStock, dbGetServices, dbGetSuggestions, 
    dbClearTickets, dbClearStock, dbClearServices, dbClearSuggestions,
    dbGetBackups, dbAddBackup, dbDeleteBackup, 
    dbGetAppointments, dbClearAppointments,
    bulkPut, dbClearSyncQueue,
    dbGetFactures, dbGetProformas, dbGetCommandes,
    dbClearFactures, dbClearProformas, dbClearCommandes, dbClearLogs,
    dbBulkPutTickets, dbBulkPutStock, dbBulkPutServices, dbBulkPutAppointments, dbBulkPutSuggestions, dbBulkPutFactures, dbBulkPutProformas, dbBulkPutCommandes, dbRunRestoreTransaction, dbGet,
    dbGetSimpleDocuments, dbGetStoredDocuments, dbClearSimpleDocuments, dbClearStoredDocuments, dbBulkPutSimpleDocuments, dbBulkPutStoredDocuments
} from './dbService.ts';
import { sanitizeTickets, sanitizeStock, sanitizeServices, sanitizeAppointments, sanitizeFactures, sanitizeProformas, sanitizeCommandes, sanitizeSuggestions, sanitizeSimpleDocuments, sanitizeStoredDocuments } from '../utils/sanitize.ts';
import { saveDataToServer } from './serverService.ts';
import { mergeUpdates } from '../utils/merge.ts';


export const compileFullBackupData = async (): Promise<BackupData> => {
    const tickets = await dbGetTickets();
    const stock = await dbGetStock();
    const services = await dbGetServices();
    const suggestions = await dbGetSuggestions();
    const appointments = await dbGetAppointments();
    const factures = await dbGetFactures();
    const proformas = await dbGetProformas();
    const commandes = await dbGetCommandes();
    const simpleDocuments = await dbGetSimpleDocuments();
    const storedDocuments = await dbGetStoredDocuments();
    return { tickets, stock, services, suggestions, appointments, factures, proformas, commandes, simpleDocuments, storedDocuments };
};


const createAndDownloadBackupFile = async (fileName: string) => {
    const data = await compileFullBackupData();
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', fileName);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);

    const totalCases = data.tickets.length;
    const totalStock = data.stock.length;
    const totalDocs = data.simpleDocuments.length + data.storedDocuments.length;
    
    setTimeout(() => {
        alert(`Exportation réussie !\n\nRésumé du contenu :\n- ${totalCases} Fiches clients\n- ${totalStock} Articles de stock\n- ${totalDocs} Documents et fichiers\n\nLe fichier "${fileName}" a été enregistré.`);
    }, 500);
};

export const backupData = async (fileName: string) => {
    try {
        await createAndDownloadBackupFile(fileName);
    } catch (error) {
        console.error("Failed to create backup file", error);
        alert("Erreur lors de la création du fichier de sauvegarde.");
    }
};

type StoreConfig = {
    name: keyof BackupData;
    storeName: string;
    entityName: string;
    sanitizer: (data: any[]) => any[];
    clearer: () => Promise<void>;
};

const storesToProcess: StoreConfig[] = [
    { name: 'tickets', storeName: 'tickets', entityName: 'fiches de réparation', sanitizer: sanitizeTickets, clearer: dbClearTickets },
    { name: 'stock', storeName: 'stock', entityName: 'stock', sanitizer: sanitizeStock, clearer: dbClearStock },
    { name: 'services', storeName: 'services', entityName: 'services', sanitizer: sanitizeServices, clearer: dbClearServices },
    { name: 'appointments', storeName: 'appointments', entityName: 'rendez-vous', sanitizer: sanitizeAppointments, clearer: dbClearAppointments },
    { name: 'suggestions', storeName: 'suggestions', entityName: 'suggestions', sanitizer: sanitizeSuggestions, clearer: dbClearSuggestions },
    { name: 'factures', storeName: 'factures', entityName: 'factures', sanitizer: sanitizeFactures, clearer: dbClearFactures },
    { name: 'proformas', storeName: 'proformas', entityName: 'proformas', sanitizer: sanitizeProformas, clearer: dbClearProformas },
    { name: 'commandes', storeName: 'commandes', entityName: 'commandes', sanitizer: sanitizeCommandes, clearer: dbClearCommandes },
    { name: 'simpleDocuments', storeName: 'simpleDocuments', entityName: 'courriers', sanitizer: sanitizeSimpleDocuments, clearer: dbClearSimpleDocuments },
    { name: 'storedDocuments', storeName: 'knowledge_files', entityName: 'base de fichiers', sanitizer: sanitizeStoredDocuments, clearer: dbClearStoredDocuments },
];

export const restoreFullDatabase = async (data: BackupData, onProgress?: (message: string) => void) => {
    const totalSteps = 2 + (storesToProcess.length * 2);
    let step = 0;
    const report = (msg: string) => {
        step++;
        onProgress && onProgress(`${msg} (${step}/${totalSteps})`);
    };

    try {
        report('Vidage de la file de synchronisation...');
        await dbClearSyncQueue();
        
        report('Vidage des journaux...');
        await dbClearLogs();
        
        await dbRunRestoreTransaction(data, storesToProcess, report);
        
        localStorage.setItem('mac-repair-app-lastRestoreDate', new Date().toISOString());

    } catch (error) {
        console.error("An error occurred during the database restore process:", error);
        throw new Error("La restauration a échoué. Veuillez vérifier le fichier et réessayer.");
    }
};

export const mergeDatabaseFromFile = async (data: BackupData, onProgress?: (message: string) => void) => {
    const totalSteps = storesToProcess.length;
    let step = 0;
    const report = (msg: string) => onProgress && onProgress(`${msg} (${++step}/${totalSteps})`);

    try {
        for (const store of storesToProcess) {
            const remoteItems = data[store.name] || [];
            
            if (!Array.isArray(remoteItems) || remoteItems.length === 0) {
                report(`Aucune donnée pour ${store.entityName} dans le fichier.`);
                continue;
            }

            report(`Fusion de ${remoteItems.length} entrées pour ${store.entityName}...`);
            const sanitizedRemoteItems = store.sanitizer(remoteItems);
            
            const itemsToPut = [];
            for (const remoteItem of sanitizedRemoteItems) {
                const keyPath = store.name === 'suggestions' ? 'category' : 'id';
                if (!remoteItem[keyPath]) continue;
                
                const localItem = await dbGet(store.storeName, remoteItem[keyPath]);
                const finalItem = mergeUpdates(store.name as EntityType, localItem, remoteItem);
                itemsToPut.push(finalItem);
            }

            if (itemsToPut.length > 0) {
                switch(store.name) {
                    case 'tickets': await dbBulkPutTickets(itemsToPut as RepairTicket[]); break;
                    case 'stock': await dbBulkPutStock(itemsToPut as StockItem[]); break;
                    case 'services': await dbBulkPutServices(itemsToPut as RepairServiceItem[]); break;
                    case 'appointments': await dbBulkPutAppointments(itemsToPut as Appointment[]); break;
                    case 'suggestions': await dbBulkPutSuggestions(itemsToPut as SuggestionRecord[]); break;
                    case 'factures': await dbBulkPutFactures(itemsToPut as Facture[]); break;
                    case 'proformas': await dbBulkPutProformas(itemsToPut as Proforma[]); break;
                    case 'commandes': await dbBulkPutCommandes(itemsToPut as Commande[]); break;
                    case 'simpleDocuments': await dbBulkPutSimpleDocuments(itemsToPut as SimpleDocument[]); break;
                    case 'storedDocuments': await dbBulkPutStoredDocuments(itemsToPut as StoredDocument[]); break;
                    default: await bulkPut(store.storeName, itemsToPut);
                }
            }
        }
        localStorage.setItem('mac-repair-app-lastRestoreDate', new Date().toISOString());
    } catch (error) {
        console.error("An error occurred during the database merge process:", error);
        throw new Error("La fusion des données a échoué.");
    }
}


export const restoreFromLocalBackup = async (backupId: number) => {
    if(window.confirm("Êtes-vous sûr de vouloir restaurer cette sauvegarde ? L'état actuel sera écrasé.")) {
        try {
            const backups = await dbGetBackups();
            const backupToRestore = backups.find(b => b.id === backupId);

            if (backupToRestore) {
                await restoreFullDatabase(backupToRestore.data);
                alert("Restauration terminée avec succès ! L'application va maintenant se recharger.");
                window.location.reload();
            } else {
                alert("La sauvegarde sélectionnée n'a pas pu être trouvée.");
            }
        } catch (error) {
            console.error("Failed to restore from local backup:", error);
            const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
            alert(`La restauration a échoué : ${errorMessage}`);
        }
    }
};

export const compileFinanceBackupData = async (): Promise<Partial<BackupData>> => {
    const factures = await dbGetFactures();
    const proformas = await dbGetProformas();
    const commandes = await dbGetCommandes();
    return { factures, proformas, commandes };
};

export const backupFinanceData = async (fileName: string) => {
    try {
        const data = await compileFinanceBackupData();
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', fileName);
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);
        alert(`Export Finance réussi : ${data.factures?.length} factures et ${data.commandes?.length} commandes.`);
    } catch (error) {
        console.error("Failed to backup finance data", error);
        alert("Erreur lors de la création du fichier de sauvegarde.");
    }
};

export const restoreFinanceDatabase = async (data: Partial<BackupData>, onProgress?: (message: string) => void) => {
    const financeStores = storesToProcess.filter(s => ['factures', 'proformas', 'commandes'].includes(s.name));
    await dbRunRestoreTransaction(data as BackupData, financeStores, onProgress);
};

export const mergeFinanceDatabaseFromFile = async (data: Partial<BackupData>, onProgress?: (message: string) => void) => {
    const financeStores = storesToProcess.filter(s => ['factures', 'proformas', 'commandes'].includes(s.name));
    const totalSteps = financeStores.length;
    let step = 0;
    const report = (msg: string) => onProgress && onProgress(`${msg} (${++step}/${totalSteps})`);

    try {
        for (const store of financeStores) {
            const remoteItems = data[store.name] || [];
            if (!Array.isArray(remoteItems) || remoteItems.length === 0) continue;

            const sanitizedRemoteItems = store.sanitizer(remoteItems);
            const itemsToPut = [];
            for (const remoteItem of sanitizedRemoteItems) {
                const localItem = await dbGet(store.storeName, remoteItem.id);
                const finalItem = mergeUpdates(store.name as EntityType, localItem, remoteItem);
                itemsToPut.push(finalItem);
            }

            if (itemsToPut.length > 0) {
                 switch(store.name) {
                    case 'factures': await dbBulkPutFactures(itemsToPut as Facture[]); break;
                    case 'proformas': await dbBulkPutProformas(itemsToPut as Proforma[]); break;
                    case 'commandes': await dbBulkPutCommandes(itemsToPut as Commande[]); break;
                }
            }
        }
    } catch (error) {
        console.error("Error merging finance data:", error);
        throw new Error("La fusion des données financières a échoué.");
    }
};

export const compileEditorBackupData = async (): Promise<Partial<BackupData>> => {
    const tickets = await dbGetTickets(); 
    const stock = await dbGetStock();
    const services = await dbGetServices();
    const suggestions = await dbGetSuggestions();
    return { tickets, stock, services, suggestions };
};

export const backupEditorData = async (fileName: string) => {
    try {
        const data = await compileEditorBackupData();
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', fileName);
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);
        alert(`Export Éditeur réussi : ${data.tickets?.length} fiches et ${data.stock?.length} articles de stock.`);
    } catch (error) {
        console.error("Failed to backup editor data", error);
        alert("Erreur lors de la création du fichier de sauvegarde.");
    }
};

export const restoreEditorDatabase = async (data: Partial<BackupData>, onProgress?: (message: string) => void) => {
    const editorStores = storesToProcess.filter(s => ['tickets', 'stock', 'services', 'suggestions'].includes(s.name));
    await dbRunRestoreTransaction(data as BackupData, editorStores, onProgress);
};

export const mergeEditorDatabaseFromFile = async (data: Partial<BackupData>, onProgress?: (message: string) => void) => {
    const editorStores = storesToProcess.filter(s => ['tickets', 'stock', 'services', 'suggestions'].includes(s.name));
    for (const store of editorStores) {
        const remoteItems = data[store.name] || [];
        if (!Array.isArray(remoteItems) || remoteItems.length === 0) continue;

        const sanitizedRemoteItems = store.sanitizer(remoteItems);
        const itemsToPut = [];
        for (const remoteItem of sanitizedRemoteItems) {
            const keyPath = store.name === 'suggestions' ? 'category' : 'id';
            const localItem = await dbGet(store.storeName, remoteItem[keyPath]);
            const finalItem = mergeUpdates(store.name as EntityType, localItem, remoteItem);
            itemsToPut.push(finalItem);
        }

        if (itemsToPut.length > 0) {
             switch(store.name) {
                case 'tickets': await dbBulkPutTickets(itemsToPut as RepairTicket[]); break;
                case 'stock': await dbBulkPutStock(itemsToPut as StockItem[]); break;
                case 'services': await dbBulkPutServices(itemsToPut as RepairServiceItem[]); break;
                case 'suggestions': await dbBulkPutSuggestions(itemsToPut as SuggestionRecord[]); break;
            }
        }
    }
};
