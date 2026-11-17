import { BackupData, RepairTicket } from '../types.ts';

export type RestorePeriodSelection = 'all' | 2 | 3 | 4 | 5;

export interface BackupCoverageSummary {
    oldestDateIso: string | null;
    oldestTicketId: string | null;
    newestDateIso: string | null;
    newestTicketId: string | null;
    backupDateIso: string;
    coverageLabel: string;
    totalTickets: number;
    totalFactures: number;
    totalCommandes: number;
    totalStock: number;
    totalServices: number;
}

export interface PeriodFilterOptions {
    months: RestorePeriodSelection;
    includeReferenceData?: boolean; // stock, services, suggestions, appSettings
    onlyTicketIds?: string[];       // restauration ciblée d'un ou plusieurs dossiers (ex. client d'il y a 7 mois)
    referenceDate?: Date;
}

export interface FilteredBackupResult {
    filteredData: Partial<BackupData>;
    cutoffIso: string | null;
    counts: {
        tickets: number;
        factures: number;
        proformas: number;
        commandes: number;
        appointments: number;
        engagementsSav: number;
        stockUsage: number;
        externalPurchases: number;
        mouvementsStock: number;
        simpleDocuments: number;
        storedDocuments: number;
        stock: number;
        services: number;
    };
}

const DATE_KEYS = ['createdAt', 'date', 'date_mouvement', 'uploadDate', 'datePromesse', 'updatedAt'] as const;

export const parseRecordDateMs = (rec: unknown, preferCreated = false): number => {
    if (!rec || typeof rec !== 'object') return 0;
    const obj = rec as Record<string, unknown>;

    const keys = preferCreated
        ? ['createdAt', 'date', 'date_mouvement', 'uploadDate', 'datePromesse', 'updatedAt']
        : ['updatedAt', 'createdAt', 'date', 'date_mouvement', 'uploadDate', 'datePromesse'];

    for (const k of keys) {
        const val = obj[k];
        if (!val) continue;
        const ms = typeof val === 'number' ? val : Date.parse(String(val));
        if (Number.isFinite(ms) && ms > 946684800000) { // > 2000-01-01
            return ms;
        }
    }
    return 0;
};

export const formatFrenchDate = (isoOrMs: string | number | null | undefined): string => {
    if (!isoOrMs) return '—';
    const d = new Date(isoOrMs);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Normalise les structures V4 ou legacy en objet BackupData homogène (sans modifier les données source).
 */
export const extractNormalizedBackupData = (rawInput: unknown): Partial<BackupData> => {
    if (!rawInput || typeof rawInput !== 'object') return {};
    const raw = rawInput as Record<string, unknown>;
    if (raw.identite_export) {
        const reg = (raw.registre_technique || {}) as Record<string, unknown>;
        const comp = (raw.comptabilite_flux || {}) as Record<string, unknown>;
        const inv = (raw.inventaire_materiel || {}) as Record<string, unknown>;
        const arch = (raw.archives_et_memoire || {}) as Record<string, unknown>;
        return {
            tickets: (reg.fiches_reparation as BackupData['tickets']) || [],
            engagementsSav: (reg.engagements_sav as BackupData['engagementsSav']) || (raw.engagementsSav as BackupData['engagementsSav']) || [],
            stock: (inv.catalogue_stock as BackupData['stock']) || [],
            stockUsage: (inv.historique_sorties as BackupData['stockUsage']) || [],
            mouvementsStock: (inv.mouvements_stock as BackupData['mouvementsStock']) || (raw.mouvementsStock as BackupData['mouvementsStock']) || [],
            services: (inv.prestations_services as BackupData['services']) || [],
            factures: (comp.factures_clients as BackupData['factures']) || [],
            proformas: (comp.devis_proforma as BackupData['proformas']) || [],
            commandes: (comp.bons_commande as BackupData['commandes']) || [],
            externalPurchases: (comp.achats_confreres_1h as BackupData['externalPurchases']) || [],
            simpleDocuments: (arch.courriers_generes as BackupData['simpleDocuments']) || [],
            storedDocuments: (arch.base_connaissance_fichiers as BackupData['storedDocuments']) || [],
            appointments: (arch.rendez_vous as BackupData['appointments']) || [],
            suggestions: (arch.lexique_ia as BackupData['suggestions']) || [],
            appSettings: arch.configuration_interface as BackupData['appSettings'],
        };
    }
    return rawInput as Partial<BackupData>;
};

/**
 * Calcule la date du plus ancien dossier et la plage couverte par une archive ou la base locale.
 */
export const computeBackupCoverage = (
    data: Partial<BackupData>,
    backupDateIso?: string
): BackupCoverageSummary => {
    const rawAny = data as Record<string, unknown>;
    const ident = (rawAny?.identite_export || {}) as Record<string, unknown>;
    const normalized = rawAny?.identite_export ? extractNormalizedBackupData(rawAny) : data;
    const effectiveBackupIso =
        backupDateIso ||
        (typeof ident.date_generation === 'string' ? ident.date_generation : new Date().toISOString());

    let oldestMs = Infinity;
    let oldestTicketId: string | null = null;
    let newestMs = 0;
    let newestTicketId: string | null = null;

    const tickets = Array.isArray(normalized.tickets) ? normalized.tickets : [];
    for (const t of tickets) {
        const ms = parseRecordDateMs(t, true);
        if (ms > 0) {
            if (ms < oldestMs) {
                oldestMs = ms;
                oldestTicketId = t?.id || null;
            }
            if (ms > newestMs) {
                newestMs = ms;
                newestTicketId = t?.id || null;
            }
        }
    }

    // Compléter avec factures / commandes / RDV / SAV si pas de ticket plus ancien
    const secondaryCollections: Array<unknown[] | undefined> = [
        normalized.factures,
        normalized.proformas,
        normalized.commandes,
        normalized.appointments,
        normalized.engagementsSav,
        normalized.stockUsage,
        normalized.externalPurchases,
        normalized.mouvementsStock,
        normalized.simpleDocuments,
        normalized.storedDocuments,
    ];
    for (const col of secondaryCollections) {
        if (!Array.isArray(col)) continue;
        for (const item of col) {
            const ms = parseRecordDateMs(item, true);
            if (ms > 0) {
                if (ms < oldestMs) oldestMs = ms;
                if (ms > newestMs) newestMs = ms;
            }
        }
    }

    const oldestDateIso = Number.isFinite(oldestMs) ? new Date(oldestMs).toISOString() : null;
    const newestDateIso = newestMs > 0 ? new Date(newestMs).toISOString() : null;

    const fromStr = oldestDateIso ? formatFrenchDate(oldestDateIso) : null;
    const toStr = formatFrenchDate(effectiveBackupIso);
    const coverageLabel = fromStr
        ? `Du ${oldestTicketId ? `#${oldestTicketId} (${fromStr})` : fromStr} au ${toStr}`
        : `Au ${toStr}`;

    return {
        oldestDateIso,
        oldestTicketId,
        newestDateIso,
        newestTicketId,
        backupDateIso: effectiveBackupIso,
        coverageLabel,
        totalTickets: tickets.length,
        totalFactures: Array.isArray(normalized.factures) ? normalized.factures.length : 0,
        totalCommandes: Array.isArray(normalized.commandes) ? normalized.commandes.length : 0,
        totalStock: Array.isArray(normalized.stock) ? normalized.stock.length : 0,
        totalServices: Array.isArray(normalized.services) ? normalized.services.length : 0,
    };
};

export const subtractMonthsIso = (months: number, referenceDate = new Date()): string => {
    const d = new Date(referenceDate);
    d.setMonth(d.getMonth() - months);
    return d.toISOString();
};

/**
 * Filtre un backup selon une période (2, 3, 4, 5 mois ou complet) ou selon des fiches ciblées (ex: client d'il y a 7 mois).
 * Conserve automatiquement les documents liés (commandes, RDV, SAV, sorties stock, achats, factures) et, si demandé,
 * le catalogue Stock / Prestations / Tarifs / Paramètres.
 */
export const filterBackupByPeriod = (
    rawInput: unknown,
    options: PeriodFilterOptions
): FilteredBackupResult => {
    const data = extractNormalizedBackupData(rawInput);
    const includeRef = options.includeReferenceData !== false;
    const refDate = options.referenceDate || new Date();

    const allTickets = Array.isArray(data.tickets) ? data.tickets : [];
    const allFactures = Array.isArray(data.factures) ? data.factures : [];
    const allProformas = Array.isArray(data.proformas) ? data.proformas : [];
    const allCommandes = Array.isArray(data.commandes) ? data.commandes : [];
    const allAppointments = Array.isArray(data.appointments) ? data.appointments : [];
    const allSav = Array.isArray(data.engagementsSav) ? data.engagementsSav : [];
    const allStockUsage = Array.isArray(data.stockUsage) ? data.stockUsage : [];
    const allExternalPurchases = Array.isArray(data.externalPurchases) ? data.externalPurchases : [];
    const allMouvements = Array.isArray(data.mouvementsStock) ? data.mouvementsStock : [];
    const allSimpleDocs = Array.isArray(data.simpleDocuments) ? data.simpleDocuments : [];
    const allStoredDocs = Array.isArray(data.storedDocuments) ? data.storedDocuments : [];
    const allStock = Array.isArray(data.stock) ? data.stock : [];
    const allServices = Array.isArray(data.services) ? data.services : [];
    const allSuggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

    // Cas 1 : Restauration ciblée de fiche(s) précise(s) (ex. client d'il y a 7 mois)
    if (options.onlyTicketIds && options.onlyTicketIds.length > 0) {
        const targetSet = new Set(options.onlyTicketIds.map((id) => id.trim().toUpperCase()));
        const tickets = allTickets.filter((t) => t?.id && targetSet.has(t.id.trim().toUpperCase()));
        const clientPhones = new Set(tickets.map((t) => (t.client?.phone || '').trim()).filter(Boolean));
        const clientNames = new Set(tickets.map((t) => (t.client?.name || '').trim().toLowerCase()).filter(Boolean));

        const matchesClient = (name?: string, phone?: string) => {
            const p = (phone || '').trim();
            const n = (name || '').trim().toLowerCase();
            return (p && clientPhones.has(p)) || (n && clientNames.has(n));
        };

        const commandes = allCommandes.filter((c) => c?.linkedTicketId && targetSet.has(c.linkedTicketId.trim().toUpperCase()));
        const appointments = allAppointments.filter((a) => a?.ticketId && targetSet.has(a.ticketId.trim().toUpperCase()));
        const engagementsSav = allSav.filter((s) => s?.numeroFicheOrigine && targetSet.has(s.numeroFicheOrigine.trim().toUpperCase()));
        const stockUsage = allStockUsage.filter((u) => u?.ticket_id && targetSet.has(u.ticket_id.trim().toUpperCase()));
        const externalPurchases = allExternalPurchases.filter((e) => e?.ticket_id && targetSet.has(e.ticket_id.trim().toUpperCase()));
        const mouvementsStock = allMouvements.filter((m) => m?.fiche_id && targetSet.has(m.fiche_id.trim().toUpperCase()));
        const factures = allFactures.filter((f) => matchesClient(f.clientName, f.clientPhone));
        const proformas = allProformas.filter((p) => matchesClient(p.clientName, p.clientPhone));

        return {
            cutoffIso: null,
            filteredData: {
                tickets,
                factures,
                proformas,
                commandes,
                appointments,
                engagementsSav,
                stockUsage,
                externalPurchases,
                mouvementsStock,
                simpleDocuments: [],
                storedDocuments: [],
                stock: includeRef ? allStock : [],
                services: includeRef ? allServices : [],
                suggestions: includeRef ? allSuggestions : [],
                appSettings: includeRef ? data.appSettings : undefined,
            },
            counts: {
                tickets: tickets.length,
                factures: factures.length,
                proformas: proformas.length,
                commandes: commandes.length,
                appointments: appointments.length,
                engagementsSav: engagementsSav.length,
                stockUsage: stockUsage.length,
                externalPurchases: externalPurchases.length,
                mouvementsStock: mouvementsStock.length,
                simpleDocuments: 0,
                storedDocuments: 0,
                stock: includeRef ? allStock.length : 0,
                services: includeRef ? allServices.length : 0,
            },
        };
    }

    // Cas 2 : Historique complet ('all')
    if (options.months === 'all') {
        return {
            cutoffIso: null,
            filteredData: {
                ...data,
                stock: includeRef ? allStock : [],
                services: includeRef ? allServices : [],
                suggestions: includeRef ? allSuggestions : [],
                appSettings: includeRef ? data.appSettings : undefined,
            },
            counts: {
                tickets: allTickets.length,
                factures: allFactures.length,
                proformas: allProformas.length,
                commandes: allCommandes.length,
                appointments: allAppointments.length,
                engagementsSav: allSav.length,
                stockUsage: allStockUsage.length,
                externalPurchases: allExternalPurchases.length,
                mouvementsStock: allMouvements.length,
                simpleDocuments: allSimpleDocs.length,
                storedDocuments: allStoredDocs.length,
                stock: includeRef ? allStock.length : 0,
                services: includeRef ? allServices.length : 0,
            },
        };
    }

    // Cas 3 : Filtrage par période (2, 3, 4 ou 5 derniers mois)
    const cutoffIso = subtractMonthsIso(options.months, refDate);
    const cutoffMs = Date.parse(cutoffIso);

    const isInPeriod = (rec: unknown): boolean => {
        const ms = parseRecordDateMs(rec, false);
        // Si une fiche ancienne a été mise à jour ou créée après cutoffMs, on la garde.
        // Si aucune date lisible n'existe (ms === 0), on conserve par prudence pour ne jamais perdre une donnée.
        return ms === 0 || ms >= cutoffMs;
    };

    const tickets = allTickets.filter(isInPeriod);
    const keptTicketIds = new Set(tickets.map((t) => (t?.id || '').trim().toUpperCase()).filter(Boolean));
    const keptCommandeIds = new Set<string>();

    const commandes = allCommandes.filter((c) => {
        const linked = c?.linkedTicketId && keptTicketIds.has(c.linkedTicketId.trim().toUpperCase());
        const keep = isInPeriod(c) || Boolean(linked);
        if (keep && c?.id) keptCommandeIds.add(c.id.trim().toUpperCase());
        return keep;
    });

    const factures = allFactures.filter(isInPeriod);
    const proformas = allProformas.filter(isInPeriod);
    const appointments = allAppointments.filter(
        (a) => isInPeriod(a) || Boolean(a?.ticketId && keptTicketIds.has(a.ticketId.trim().toUpperCase()))
    );
    const engagementsSav = allSav.filter(
        (s) =>
            isInPeriod(s) ||
            Boolean(s?.numeroFicheOrigine && keptTicketIds.has(s.numeroFicheOrigine.trim().toUpperCase())) ||
            Boolean(s?.numeroCommandeOrigine && keptCommandeIds.has(s.numeroCommandeOrigine.trim().toUpperCase()))
    );
    const stockUsage = allStockUsage.filter(
        (u) => isInPeriod(u) || Boolean(u?.ticket_id && keptTicketIds.has(u.ticket_id.trim().toUpperCase()))
    );
    const externalPurchases = allExternalPurchases.filter(
        (e) => isInPeriod(e) || Boolean(e?.ticket_id && keptTicketIds.has(e.ticket_id.trim().toUpperCase()))
    );
    const mouvementsStock = allMouvements.filter(
        (m) => isInPeriod(m) || Boolean(m?.fiche_id && keptTicketIds.has(m.fiche_id.trim().toUpperCase()))
    );
    const simpleDocuments = allSimpleDocs.filter(isInPeriod);
    const storedDocuments = allStoredDocs.filter(isInPeriod);

    return {
        cutoffIso,
        filteredData: {
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
            stock: includeRef ? allStock : [],
            services: includeRef ? allServices : [],
            suggestions: includeRef ? allSuggestions : [],
            appSettings: includeRef ? data.appSettings : undefined,
        },
        counts: {
            tickets: tickets.length,
            factures: factures.length,
            proformas: proformas.length,
            commandes: commandes.length,
            appointments: appointments.length,
            engagementsSav: engagementsSav.length,
            stockUsage: stockUsage.length,
            externalPurchases: externalPurchases.length,
            mouvementsStock: mouvementsStock.length,
            simpleDocuments: simpleDocuments.length,
            storedDocuments: storedDocuments.length,
            stock: includeRef ? allStock.length : 0,
            services: includeRef ? allServices.length : 0,
        },
    };
};

/**
 * Recherche directe dans un fichier backup (sans l'importer) pour retrouver un client/dossier ancien (ex. venu il y a 7 mois).
 */
export const searchTicketsInBackup = (rawInput: unknown, searchText: string, maxResults = 25): RepairTicket[] => {
    const q = searchText.trim().toLowerCase();
    if (!q) return [];
    const data = extractNormalizedBackupData(rawInput);
    const tickets = Array.isArray(data.tickets) ? data.tickets : [];

    const matches = tickets.filter((t) => {
        if (!t) return false;
        const haystack = [
            t.id,
            t.client?.name,
            t.client?.phone,
            t.client?.secondaryPhone,
            t.macModel,
            t.serialNumber,
            t.problemDescription,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return haystack.includes(q);
    });

    return matches
        .sort((a, b) => parseRecordDateMs(b, true) - parseRecordDateMs(a, true))
        .slice(0, maxResults);
};

// Assurer que DATE_KEYS reste référencé proprement pour les imports TS
export const BACKUP_DATE_FIELD_ORDER = DATE_KEYS;
