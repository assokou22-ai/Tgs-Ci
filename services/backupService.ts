
import { BackupData, EntityType, SerializedAppSettings } from '../types.ts';
import { 
    dbGetTickets, dbGetStock, dbGetServices, dbGetSuggestions, 
    dbGetAppointments, dbGetFactures, dbGetProformas, dbGetCommandes,
    dbGetSimpleDocuments, dbGetStoredDocuments, dbGetStockUsage, dbGetExternalPurchases,
    dbClearSyncQueue, dbClearLogs, dbRunRestoreTransaction, dbGet, dbPutDirect, dbGetEngagementsSav
} from './dbService.ts';
import { mergeUpdates } from '../utils/merge.ts';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase.ts';
import { getBackupAppIdentifier, formatBackupFileName } from '../utils/backupIdentifier.ts';

const SETTINGS_LS_KEY = 'mac-repair-app-appSettings';

/**
 * Génère un nom de fichier classable commençant par l'identifiant distinctif de l'application (ex: INVESTISSEMENT)
 */
export const generateSortableFileName = (type: 'FULL' | 'FINANCE' | 'TECH' = 'FULL', customIdentifier?: string): string => {
    return formatBackupFileName(type, customIdentifier);
};

/**
 * Compile les données dans une structure hiérarchique hautement organisée (V4)
 */
export const compileFullBackupData = async (): Promise<Record<string, unknown>> => {
    const appIdentifier = getBackupAppIdentifier();
    const [
        tickets, stock, services, suggestions, 
        appointments, factures, proformas, commandes, 
        simpleDocs, storedDocs, stockUsage, externalPurchases,
        engagementsSav
    ] = await Promise.all([
        dbGetTickets(), dbGetStock(), dbGetServices(), dbGetSuggestions(),
        dbGetAppointments(), dbGetFactures(), dbGetProformas(), dbGetCommandes(),
        dbGetSimpleDocuments(), dbGetStoredDocuments(), dbGetStockUsage(), dbGetExternalPurchases(),
        dbGetEngagementsSav()
    ]);

    let appSettings: SerializedAppSettings | undefined;
    const storedSettings = localStorage.getItem(SETTINGS_LS_KEY);
    if (storedSettings) {
        try { appSettings = JSON.parse(storedSettings); } catch { console.warn("Settings skipped."); }
    }

    return {
        identite_export: {
            application_nom: appIdentifier,
            type_sauvegarde: `Sauvegarde ${appIdentifier}`,
            logiciel: `TGS-CI Repair Management Pro (${appIdentifier})`,
            version_schema: "4.0",
            date_generation: new Date().toISOString(),
            origine_systeme: navigator.userAgent,
            encodage: "UTF-8"
        },
        registre_technique: {
            fiches_reparation: tickets,
            journal_interventions: tickets.flatMap(t => t.history.map(h => ({ ...h, ticket_id: t.id }))),
            expertises_electroniques: tickets.filter(t => t.diagnosticSheetB).map(t => ({ ticket_id: t.id, ...t.diagnosticSheetB })),
            engagements_sav: engagementsSav
        },
        comptabilite_flux: {
            factures_clients: factures,
            devis_proforma: proformas,
            bons_commande: commandes,
            achats_confreres_1h: externalPurchases
        },
        inventaire_materiel: {
            catalogue_stock: stock,
            historique_sorties: stockUsage,
            prestations_services: services
        },
        archives_et_memoire: {
            base_connaissance_fichiers: storedDocs,
            courriers_generes: simpleDocs,
            rendez_vous: appointments,
            lexique_ia: suggestions,
            configuration_interface: appSettings
        }
    };
};

/**
 * Déclenche le téléchargement du fichier JSON
 */
export const backupData = async (type: 'FULL' | 'FINANCE' | 'TECH' = 'FULL') => {
    try {
        const fullStructuredData = await compileFullBackupData();
        const fileName = generateSortableFileName(type);
        
        const dataStr = JSON.stringify(fullStructuredData, null, 2); 
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return fullStructuredData;
    } catch (error) {
        console.error("Échec sauvegarde:", error);
        throw error;
    }
};

interface V4Backup {
    identite_export: unknown;
    registre_technique?: {
        fiches_reparation?: unknown[];
    };
    inventaire_materiel?: {
        catalogue_stock?: unknown[];
        prestations_services?: unknown[];
    };
    comptabilite_flux?: {
        factures_clients?: unknown[];
        devis_proforma?: unknown[];
        bons_commande?: unknown[];
        achats_confreres_1h?: unknown[];
    };
    archives_et_memoire?: {
        courriers_generes?: unknown[];
        base_connaissance_fichiers?: unknown[];
        rendez_vous?: unknown[];
        lexique_ia?: unknown[];
        configuration_interface?: SerializedAppSettings;
    };
}

/**
 * Normalise les données pour supporter l'ancien et le nouveau format (V4)
 */
const normalizeImportData = (rawInput: unknown): Partial<BackupData> => {
    const raw = rawInput as V4Backup;
    if (raw && raw.identite_export) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawAny = raw as any;
        return {
            tickets: raw.registre_technique?.fiches_reparation || [],
            stock: raw.inventaire_materiel?.catalogue_stock || [],
            services: raw.inventaire_materiel?.prestations_services || [],
            factures: raw.comptabilite_flux?.factures_clients || [],
            proformas: raw.comptabilite_flux?.devis_proforma || [],
            commandes: raw.comptabilite_flux?.bons_commande || [],
            externalPurchases: raw.comptabilite_flux?.achats_confreres_1h || [],
            simpleDocuments: raw.archives_et_memoire?.courriers_generes || [],
            storedDocuments: raw.archives_et_memoire?.base_connaissance_fichiers || [],
            appointments: raw.archives_et_memoire?.rendez_vous || [],
            suggestions: raw.archives_et_memoire?.lexique_ia || [],
            appSettings: raw.archives_et_memoire?.configuration_interface,
            engagementsSav: raw.registre_technique?.engagements_sav || rawAny.engagementsSav || []
        };
    }
    return rawInput as Partial<BackupData>;
};

/**
 * Fusion complémentaire : ajoute les éléments manquants et met à jour les existants si plus récents
 */
export const mergeDatabaseFromFile = async (raw: unknown, onProgress?: (msg: string) => void) => {
    const data = normalizeImportData(raw);
    
    const storeConfigs: {key: keyof BackupData, store: string, label: string}[] = [
        {key: 'tickets', store: 'tickets', label: 'Fiches Techniques'},
        {key: 'stock', store: 'stock', label: 'Catalogue Stock'},
        {key: 'factures', store: 'factures', label: 'Facturations'},
        {key: 'commandes', store: 'commandes', label: 'Bons de Commande'},
        {key: 'services', store: 'services', label: 'Grille Tarifaire'},
        {key: 'appointments', store: 'appointments', label: 'Rendez-vous'},
        {key: 'simpleDocuments', store: 'simpleDocuments', label: 'Courriers'},
        {key: 'engagementsSav', store: 'engagementsSav', label: 'Engagements SAV'}
    ];

    for (const config of storeConfigs) {
        const items = data[config.key] as unknown[];
        if (items && Array.isArray(items)) {
            onProgress?.(`Fusion : ${config.label}...`);
            for (const item of items) {
                const localItem = await dbGet(config.store, item.id);
                // mergeUpdates compare les timestamps pour éviter de régresser
                const merged = mergeUpdates(config.key === 'tickets' ? 'ticket' : (config.key as EntityType), localItem, item);
                await dbPutDirect(config.store, merged);
            }
        }
    }
};

/**
 * Restauration totale (Écrase la base actuelle)
 */
export const restoreFullDatabase = async (raw: unknown, onProgress?: (message: string) => void) => {
    const data = normalizeImportData(raw);
    
    await dbClearSyncQueue();
    await dbClearLogs();
    
    const config = [
        { name: 'tickets', storeName: 'tickets', entityName: 'fiches' },
        { name: 'stock', storeName: 'stock', entityName: 'stock' },
        { name: 'services', storeName: 'services', entityName: 'tarifs' },
        { name: 'factures', storeName: 'factures', entityName: 'factures' },
        { name: 'proformas', storeName: 'proformas', entityName: 'devis' },
        { name: 'commandes', storeName: 'commandes', entityName: 'commandes' },
        { name: 'simpleDocuments', storeName: 'simpleDocuments', entityName: 'courriers' },
        { name: 'storedDocuments', storeName: 'knowledge_files', entityName: 'fichiers' },
        { name: 'appointments', storeName: 'appointments', entityName: 'RDV' },
        { name: 'externalPurchases', storeName: 'externalPurchases', entityName: 'achats_confrères' },
        { name: 'engagementsSav', storeName: 'engagementsSav', entityName: 'SAV' }
    ];

    await dbRunRestoreTransaction(data, config, onProgress);

    if (data.appSettings) {
        localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(data.appSettings));
    }
};

export const getDatabaseSummary = async () => {
    const raw = await compileFullBackupData();
    const data = normalizeImportData(raw);

    return {
        tickets: data.tickets?.length || 0,
        stock: data.stock?.length || 0,
        finance: (data.factures?.length || 0) + (data.commandes?.length || 0),
        documents: (data.simpleDocuments?.length || 0),
        v4: !!raw.identite_export
    };
};

export const validateBackupSchema = (data: unknown): { valid: boolean; errors: string[] } => {
    const raw = data as Record<string, unknown>;
    if (!raw) return { valid: false, errors: ['Fichier vide.'] };
    const errors: string[] = [];
    if (!raw.identite_export && !raw.tickets) errors.push("Format non reconnu.");
    return { valid: errors.length === 0, errors };
};

export const backupFinanceData = async () => backupData('FINANCE');
export const restoreFinanceDatabase = restoreFullDatabase;
export const mergeFinanceDatabaseFromFile = mergeDatabaseFromFile;

export const backupEditorData = async () => backupData('TECH');
export const restoreEditorDatabase = restoreFullDatabase;
export const mergeEditorDatabaseFromFile = mergeDatabaseFromFile;

/**
 * Automap and run a fully structured automatic daily backup to Firestore
 * after the designated closing hour (e.g. 18h00 / 6 PM).
 */
export const checkAndTriggerAutoDailyBackup = async (closingHour = 18): Promise<boolean> => {
    try {
        if (!navigator.onLine) {
            console.log("No connection: Skipping auto daily backup verification.");
            return false;
        }

        if (!auth.currentUser) {
            console.log("Not authenticated in Firebase: Skipping auto daily backup.");
            return false;
        }

        const now = new Date();
        const currentHour = now.getHours();

        if (currentHour < closingHour) {
            console.log(`Auto Backup skipped: current hour (${currentHour}h) is before the closing hour (${closingHour}h)`);
            return false;
        }

        const todayStr = now.toISOString().split('T')[0];

        // Cache daily check to avoid Firestore reads on every reload/refresh
        const cachedBackupCheck = localStorage.getItem('tgs_last_auto_backup_checked');
        if (cachedBackupCheck === todayStr) {
            console.log(`Auto Backup check skipped: already verified/created today (${todayStr}) in cache.`);
            return false;
        }

        const docRef = doc(db, 'dailyBackups', todayStr);

        const docSnap = await getDoc(docRef);
        localStorage.setItem('tgs_last_auto_backup_checked', todayStr);
        if (docSnap.exists()) {
            console.log(`Auto Backup already exists in Firestore for today ${todayStr}.`);
            return false;
        }

        console.log(`Executing automatic closing-hour daily backup for: ${todayStr}`);
        const fullBackupPayload = await compileFullBackupData();

        await setDoc(docRef, {
            id: todayStr,
            date: todayStr,
            createdAt: now.toISOString(),
            payload: JSON.stringify(fullBackupPayload)
        });

        console.log(`Successfully completed daily auto-backup for ${todayStr}.`);
        return true;
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('the client is offline') || errMsg.includes('offline')) {
            console.log(`Failed to verify or trigger automatic closing-hour backup (Client is Offline): ${errMsg}`);
        } else {
            console.error("Failed to verify or trigger automatic closing-hour backup:", err);
        }
        return false;
    }
};

