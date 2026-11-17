import { jsonToBlob } from '../utils/jsonBlob.ts';

import { BackupData, EntityType, RepairTicket, SerializedAppSettings } from '../types.ts';
import {
    dbGetTickets, dbGetStock, dbGetServices, dbGetSuggestions,
    dbGetAppointments, dbGetFactures, dbGetProformas, dbGetCommandes,
    dbGetSimpleDocuments, dbGetStoredDocuments, dbGetStockUsage, dbGetExternalPurchases,
    dbGetMouvementsStock,
    dbClearSyncQueue, dbClearLogs, dbRunRestoreTransaction, dbGet, dbPutDirect, dbGetEngagementsSav
} from './dbService.ts';
import { queueImportedTicketsMissingFromCloud, triggerAutoCatchUpPush } from './syncService.ts';
import { mergeUpdates } from '../utils/merge.ts';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase.ts';
import { getBackupAppIdentifier, formatBackupFileName } from '../utils/backupIdentifier.ts';
import {
    BackupCoverageSummary,
    PeriodFilterOptions,
    computeBackupCoverage,
    extractNormalizedBackupData,
    filterBackupByPeriod,
    formatFrenchDate,
} from '../utils/backupPeriod.ts';

const SETTINGS_LS_KEY = 'mac-repair-app-appSettings';

/**
 * Génère un nom de fichier classable commençant par l'identifiant distinctif de l'application (ex: RM_MACBOOK)
 */
export const generateSortableFileName = (type: 'FULL' | 'FINANCE' | 'TECH' = 'FULL', customIdentifier?: string): string => {
    return formatBackupFileName(type, customIdentifier);
};

/**
 * Compile les données dans une structure hiérarchique hautement organisée (V4),
 * en incluant automatiquement la date du plus ancien dossier jusqu'à la date du backup.
 */
export const compileFullBackupData = async (): Promise<Record<string, unknown>> => {
    const appIdentifier = getBackupAppIdentifier();
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

    let appSettings: SerializedAppSettings | undefined;
    const storedSettings = localStorage.getItem(SETTINGS_LS_KEY);
    if (storedSettings) {
        try { appSettings = JSON.parse(storedSettings); } catch { console.warn("Settings skipped."); }
    }

    const nowIso = new Date().toISOString();
    const coverage = computeBackupCoverage({
        tickets,
        factures,
        proformas,
        commandes,
        appointments,
        engagementsSav,
        stockUsage,
        externalPurchases,
        mouvementsStock,
        simpleDocuments: simpleDocs,
        storedDocuments: storedDocs,
        stock,
        services,
    }, nowIso);

    return {
        identite_export: {
            application_nom: appIdentifier,
            type_sauvegarde: `Sauvegarde ${appIdentifier}`,
            logiciel: `TGS-CI Repair Management Pro (${appIdentifier})`,
            version_schema: "4.0",
            date_generation: nowIso,
            origine_systeme: navigator.userAgent,
            encodage: "UTF-8",
            couverture_periode: {
                date_plus_ancien_dossier: coverage.oldestDateIso,
                id_plus_ancien_dossier: coverage.oldestTicketId,
                date_plus_recent_dossier: coverage.newestDateIso,
                id_plus_recent_dossier: coverage.newestTicketId,
                date_backup: nowIso,
                libelle: coverage.coverageLabel,
                total_fiches: coverage.totalTickets,
                total_factures: coverage.totalFactures,
                total_commandes: coverage.totalCommandes,
                total_stock: coverage.totalStock,
            }
        },
        registre_technique: {
            fiches_reparation: tickets || [],
            journal_interventions: (tickets || []).flatMap(t => ((t && t.history) || []).map(h => ({ ...h, ticket_id: t?.id || '' }))),
            expertises_electroniques: (tickets || []).filter(t => t && t.diagnosticSheetB).map(t => ({ ticket_id: t.id, ...t.diagnosticSheetB })),
            engagements_sav: engagementsSav || []
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
            mouvements_stock: mouvementsStock,
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
 * Retourne le résumé de couverture temporelle de la base locale actuelle.
 */
export const getLocalBackupCoverage = async (): Promise<BackupCoverageSummary> => {
    const [
        tickets, factures, proformas, commandes,
        appointments, engagementsSav, stockUsage, externalPurchases,
        mouvementsStock, simpleDocuments, storedDocuments, stock, services
    ] = await Promise.all([
        dbGetTickets(), dbGetFactures(), dbGetProformas(), dbGetCommandes(),
        dbGetAppointments(), dbGetEngagementsSav(), dbGetStockUsage(), dbGetExternalPurchases(),
        dbGetMouvementsStock(), dbGetSimpleDocuments(), dbGetStoredDocuments(), dbGetStock(), dbGetServices()
    ]);

    return computeBackupCoverage({
        tickets,
        factures,
        proformas,
        commandes,
        appointments,
        engagementsSav,
        stockUsage,
        externalPurchases,
        mouvementsStock,
        simpleDocuments,
        storedDocuments,
        stock,
        services,
    });
};

const triggerJsonDownload = (payload: unknown, fileName: string) => {
    const blob = jsonToBlob(payload);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Déclenche le téléchargement du fichier JSON (ancien système conservé intact, enrichi avec la plage de dates dans identite_export)
 */
export const backupData = async (type: 'FULL' | 'FINANCE' | 'TECH' = 'FULL') => {
    try {
        const fullStructuredData = await compileFullBackupData();
        const fileName = generateSortableFileName(type);
        triggerJsonDownload(fullStructuredData, fileName);
        return fullStructuredData;
    } catch (error) {
        console.error("Échec sauvegarde:", error);
        throw error;
    }
};

/**
 * Backup Unique Complet (Archive Maître datée du plus ancien dossier jusqu'à aujourd'hui)
 */
export const backupUniqueMasterArchive = async (): Promise<{
    data: Record<string, unknown>;
    fileName: string;
    coverage: BackupCoverageSummary;
}> => {
    const fullStructuredData = await compileFullBackupData();
    const ident = (fullStructuredData.identite_export || {}) as Record<string, unknown>;
    const covRaw = (ident.couverture_periode || {}) as Record<string, unknown>;
    const coverage = computeBackupCoverage(fullStructuredData, String(ident.date_generation || new Date().toISOString()));

    const appId = getBackupAppIdentifier();
    const oldestPart = covRaw.date_plus_ancien_dossier
        ? String(covRaw.date_plus_ancien_dossier).slice(0, 10)
        : 'ORIGINE';
    const todayPart = new Date().toISOString().slice(0, 10);
    const timePart = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const fileName = `${appId}_BACKUP_UNIQUE_DU_${oldestPart}_AU_${todayPart}_${timePart}_TGS-CI.json`;

    triggerJsonDownload(fullStructuredData, fileName);
    return { data: fullStructuredData, fileName, coverage };
};

/**
 * Normalise les données pour supporter l'ancien et le nouveau format (V4)
 */
const normalizeImportData = (rawInput: unknown): Partial<BackupData> => {
    return extractNormalizedBackupData(rawInput);
};

export interface BackupMergeHooks {
    dbGet?: (storeName: string, id: string) => Promise<unknown>;
    dbPutDirect?: (storeName: string, item: unknown) => Promise<unknown>;
    onAfterImportTickets?: (tickets: RepairTicket[], onProgress?: (msg: string) => void) => Promise<unknown>;
}

export const mergeNormalizedBackupData = async (
    data: Partial<BackupData>,
    onProgress?: (msg: string) => void,
    hooks?: BackupMergeHooks,
) => {
    const storeConfigs: { key: keyof BackupData; store: string; entity: EntityType; label: string; idField?: string }[] = [
        { key: 'tickets', store: 'tickets', entity: 'ticket', label: 'Fiches Techniques' },
        { key: 'stock', store: 'stock', entity: 'stock', label: 'Catalogue Stock' },
        { key: 'factures', store: 'factures', entity: 'facture', label: 'Facturations' },
        { key: 'proformas', store: 'proformas', entity: 'proforma', label: 'Devis Proforma' },
        { key: 'commandes', store: 'commandes', entity: 'commande', label: 'Bons de Commande' },
        { key: 'services', store: 'services', entity: 'service', label: 'Grille Tarifaire / Prestations' },
        { key: 'appointments', store: 'appointments', entity: 'appointment', label: 'Rendez-vous' },
        { key: 'simpleDocuments', store: 'simpleDocuments', entity: 'simpleDocument', label: 'Courriers' },
        { key: 'storedDocuments', store: 'knowledge_files', entity: 'storedDocument', label: 'Fichiers & Médias' },
        { key: 'stockUsage', store: 'stockUsage', entity: 'stockUsage', label: 'Sorties Stock' },
        { key: 'externalPurchases', store: 'externalPurchases', entity: 'externalPurchase', label: 'Achats Confrères' },
        { key: 'mouvementsStock', store: 'mouvementsStock', entity: 'mouvementStock', label: 'Mouvements Stock' },
        { key: 'engagementsSav', store: 'engagementsSav', entity: 'engagementSav', label: 'Engagements SAV' },
        { key: 'suggestions', store: 'suggestions', entity: 'suggestions', label: 'Suggestions', idField: 'category' },
    ];

    const readLocal = hooks?.dbGet || dbGet;
    const writeLocal = hooks?.dbPutDirect || dbPutDirect;

    for (const config of storeConfigs) {
        const items = data[config.key] as Array<Record<string, unknown>> | undefined;
        if (items && Array.isArray(items) && items.length > 0) {
            onProgress?.(`Fusion : ${config.label} (${items.length})...`);
            for (const item of items) {
                if (!item) continue;
                const keyVal = config.idField ? item[config.idField] : item.id;
                if (!keyVal) continue;
                const localItem = await readLocal(config.store, String(keyVal));
                const merged = mergeUpdates(config.entity, localItem, item);
                await writeLocal(config.store, merged);
            }
        }
    }

    if (typeof localStorage !== 'undefined' && data.appSettings && !localStorage.getItem(SETTINGS_LS_KEY)) {
        localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(data.appSettings));
    }

    const importedTickets = (Array.isArray(data.tickets) ? data.tickets : []) as RepairTicket[];
    if (hooks?.onAfterImportTickets) {
        await hooks.onAfterImportTickets(importedTickets, onProgress);
    } else if (importedTickets.length > 0) {
        await queueImportedTicketsMissingFromCloud(importedTickets, onProgress);
    } else {
        await triggerAutoCatchUpPush('import-backup', onProgress);
    }
};

/**
 * Fusion complémentaire : ajoute les éléments manquants et met à jour les existants si plus récents (ancien comportement complet conservé)
 */
export const mergeDatabaseFromFile = async (
    raw: unknown,
    onProgress?: (msg: string) => void,
    hooks?: BackupMergeHooks,
) => {
    const data = normalizeImportData(raw);
    await mergeNormalizedBackupData(data, onProgress, hooks);
};

/**
 * Fusion sélective par période (2, 3, 4, 5 mois, complet, ou un dossier précis ex. client d'il y a 7 mois)
 */
export const mergeDatabaseWithPeriodFilter = async (
    raw: unknown,
    options: PeriodFilterOptions,
    onProgress?: (msg: string) => void,
    hooks?: BackupMergeHooks,
) => {
    const { filteredData } = filterBackupByPeriod(raw, options);
    await mergeNormalizedBackupData(filteredData, onProgress, hooks);
};

const RESTORE_STORE_CONFIG = [
    { name: 'tickets', storeName: 'tickets', entityName: 'fiches' },
    { name: 'stock', storeName: 'stock', entityName: 'stock' },
    { name: 'services', storeName: 'services', entityName: 'tarifs' },
    { name: 'factures', storeName: 'factures', entityName: 'factures' },
    { name: 'proformas', storeName: 'proformas', entityName: 'devis' },
    { name: 'commandes', storeName: 'commandes', entityName: 'commandes' },
    { name: 'simpleDocuments', storeName: 'simpleDocuments', entityName: 'courriers' },
    { name: 'storedDocuments', storeName: 'knowledge_files', entityName: 'fichiers' },
    { name: 'appointments', storeName: 'appointments', entityName: 'RDV' },
    { name: 'stockUsage', storeName: 'stockUsage', entityName: 'sorties stock' },
    { name: 'externalPurchases', storeName: 'externalPurchases', entityName: 'achats confrères' },
    { name: 'mouvementsStock', storeName: 'mouvementsStock', entityName: 'mouvements stock' },
    { name: 'engagementsSav', storeName: 'engagementsSav', entityName: 'SAV' }
];

/**
 * Restauration totale (Écrase la base actuelle — ancien comportement conservé)
 */
export const restoreFullDatabase = async (raw: unknown, onProgress?: (message: string) => void) => {
    const data = normalizeImportData(raw);

    await dbClearSyncQueue();
    await dbClearLogs();

    await dbRunRestoreTransaction(data, RESTORE_STORE_CONFIG, onProgress);

    if (data.appSettings) {
        localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(data.appSettings));
    }

    if (Array.isArray(data.tickets) && data.tickets.length > 0) {
        await queueImportedTicketsMissingFromCloud(data.tickets as RepairTicket[], onProgress);
    } else {
        await triggerAutoCatchUpPush('import-backup', onProgress);
    }
};

/**
 * Restauration avec filtre de période (2, 3, 4, 5 mois ou complet)
 */
export const restoreDatabaseWithPeriodFilter = async (
    raw: unknown,
    options: PeriodFilterOptions,
    onProgress?: (message: string) => void
) => {
    const { filteredData } = filterBackupByPeriod(raw, options);

    await dbClearSyncQueue();
    await dbClearLogs();

    await dbRunRestoreTransaction(filteredData, RESTORE_STORE_CONFIG, onProgress);

    if (filteredData.appSettings) {
        localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(filteredData.appSettings));
    }

    if (Array.isArray(filteredData.tickets) && filteredData.tickets.length > 0) {
        await queueImportedTicketsMissingFromCloud(filteredData.tickets as RepairTicket[], onProgress);
    } else {
        await triggerAutoCatchUpPush('import-backup', onProgress);
    }
};

export const getDatabaseSummary = async () => {
    const raw = await compileFullBackupData();
    const data = normalizeImportData(raw);
    const coverage = computeBackupCoverage(raw);

    return {
        tickets: data.tickets?.length || 0,
        stock: data.stock?.length || 0,
        finance: (data.factures?.length || 0) + (data.commandes?.length || 0),
        documents: (data.simpleDocuments?.length || 0),
        v4: !!raw.identite_export,
        oldestDateLabel: coverage.oldestDateIso ? formatFrenchDate(coverage.oldestDateIso) : null,
        oldestTicketId: coverage.oldestTicketId,
        coverageLabel: coverage.coverageLabel,
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
        if (docSnap.exists()) {
            localStorage.setItem('tgs_last_auto_backup_checked', todayStr);
            console.log(`Auto Backup already exists in Firestore for today ${todayStr}.`);
            return false;
        }

        console.log(`Executing automatic closing-hour daily backup for: ${todayStr}`);
        const fullBackupPayload = await compileFullBackupData();

        // Les photos sont déjà stockées à part (collection media) : la sauvegarde ne contient que des références.
        // Le contenu complet est découpé en morceaux pour ne jamais dépasser la limite de 1 Mo par document.
        const { dehydrateForCloud, storeLargeText } = await import('./cloudMedia.ts');
        const lightPayload = await dehydrateForCloud(fullBackupPayload);
        const serialized = JSON.stringify(lightPayload);
        const payloadRef = await storeLargeText(serialized);

        await setDoc(docRef, {
            id: todayStr,
            date: todayStr,
            createdAt: now.toISOString(),
            format: 'tgs-backup-v2',
            size: serialized.length,
            payloadRef,
        });
        localStorage.setItem('tgs_last_auto_backup_checked', todayStr);

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
