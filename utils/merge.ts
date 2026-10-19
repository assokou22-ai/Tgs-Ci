
import { EntityType, RepairTicket, HistoryEntry, SuggestionRecord } from '../types.ts';

// Helper pour fusionner et dédoublonner des tableaux d'objets par une clé unique (ex: timestamp ou id)
const mergeArrayByKey = <T extends Record<string, unknown>>(a: T[], b: T[], key: keyof T): T[] => {
    const map = new Map<unknown, T>();
    (a || []).forEach(item => map.set(item[key], item));
    (b || []).forEach(item => map.set(item[key], item));
    return Array.from(map.values());
};

const mergeRepairTicket = (local: RepairTicket, remote: RepairTicket): RepairTicket => {
    const localDate = new Date(local.updatedAt || local.createdAt || 0).getTime();
    const remoteDate = new Date(remote.updatedAt || remote.createdAt || 0).getTime();

    // Vérifier si l'un des deux côtés contient un diagnostic actif alors que l'autre est vierge
    const remoteHasActiveDiag = Boolean(
        (remote.diagnosticReport && remote.diagnosticReport.length > 0) ||
        (remote.diagnosticSheetB && (
            remote.diagnosticSheetB.visualInspection || 
            (remote.diagnosticSheetB.tensionValues && remote.diagnosticSheetB.tensionValues.some(v => v.value)) ||
            (remote.diagnosticSheetB.diagnosticPoints && remote.diagnosticSheetB.diagnosticPoints.some(p => p.notes)) ||
            (remote.diagnosticSheetB.images && remote.diagnosticSheetB.images.length > 0)
        )) ||
        (remote.diagnosticImages && remote.diagnosticImages.length > 0)
    );
    const localHasActiveDiag = Boolean(
        (local.diagnosticReport && local.diagnosticReport.length > 0) ||
        (local.diagnosticSheetB && (
            local.diagnosticSheetB.visualInspection || 
            (local.diagnosticSheetB.tensionValues && local.diagnosticSheetB.tensionValues.some(v => v.value)) ||
            (local.diagnosticSheetB.diagnosticPoints && local.diagnosticSheetB.diagnosticPoints.some(p => p.notes)) ||
            (local.diagnosticSheetB.images && local.diagnosticSheetB.images.length > 0)
        )) ||
        (local.diagnosticImages && local.diagnosticImages.length > 0)
    );

    let newest = local;
    let oldest = remote;

    if (remoteDate > localDate) {
        newest = remote;
        oldest = local;
    } else if (localDate > remoteDate) {
        newest = local;
        oldest = remote;
    } else {
        // En cas d'égalité stricte des horodatages (ex: synchro initiale ou modifs quasi-simultanées)
        if (remoteHasActiveDiag && !localHasActiveDiag) {
            newest = remote;
            oldest = local;
        } else if (localHasActiveDiag && !remoteHasActiveDiag) {
            newest = local;
            oldest = remote;
        } else {
            const localLen = JSON.stringify(local).length;
            const remoteLen = JSON.stringify(remote).length;
            if (remoteLen >= localLen) {
                newest = remote;
                oldest = local;
            } else {
                newest = local;
                oldest = remote;
            }
        }
    }

    // Fusion de l'historique : On combine tout chronologiquement sans perte
    const combinedHistory = mergeArrayByKey<HistoryEntry>(local.history || [], remote.history || [], 'timestamp')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Diagnostic Sheet B : fusion intelligente en conservant les données les plus fraîches et complètes
    let mergedSheetB = newest.diagnosticSheetB;
    if (newest.diagnosticSheetB && oldest.diagnosticSheetB) {
        mergedSheetB = {
            ...oldest.diagnosticSheetB,
            ...newest.diagnosticSheetB,
            entryCondition: newest.diagnosticSheetB.entryCondition || oldest.diagnosticSheetB.entryCondition,
            testDuration: newest.diagnosticSheetB.testDuration || oldest.diagnosticSheetB.testDuration || '',
            repairDelay: newest.diagnosticSheetB.repairDelay || oldest.diagnosticSheetB.repairDelay || '',
            visualInspection: newest.diagnosticSheetB.visualInspection || oldest.diagnosticSheetB.visualInspection || '',
            tensionValues: (newest.diagnosticSheetB.tensionValues && newest.diagnosticSheetB.tensionValues.some(v => v.value))
                ? newest.diagnosticSheetB.tensionValues
                : (oldest.diagnosticSheetB.tensionValues || newest.diagnosticSheetB.tensionValues || []),
            diagnosticPoints: (newest.diagnosticSheetB.diagnosticPoints && newest.diagnosticSheetB.diagnosticPoints.some(p => p.notes))
                ? newest.diagnosticSheetB.diagnosticPoints
                : (oldest.diagnosticSheetB.diagnosticPoints || newest.diagnosticSheetB.diagnosticPoints || []),
            images: (newest.diagnosticSheetB.images && newest.diagnosticSheetB.images.length > 0)
                ? newest.diagnosticSheetB.images
                : (oldest.diagnosticSheetB.images || [])
        };
    } else if (!mergedSheetB) {
        mergedSheetB = oldest.diagnosticSheetB;
    }

    // Diagnostic Report : la version renseignée fait toujours autorité pour éviter d'écraser un diagnostic avec un rapport vide
    const mergedDiagnosticReport = (newest.diagnosticReport && newest.diagnosticReport.length > 0)
        ? newest.diagnosticReport
        : (oldest.diagnosticReport && oldest.diagnosticReport.length > 0 ? oldest.diagnosticReport : (newest.diagnosticReport || oldest.diagnosticReport || []));

    // Images diagnostiques et images de réception : priorité à la version active qui contient des photos
    const mergedDiagnosticImages = (newest.diagnosticImages && newest.diagnosticImages.length > 0)
        ? newest.diagnosticImages
        : (oldest.diagnosticImages && oldest.diagnosticImages.length > 0 ? oldest.diagnosticImages : []);

    const mergedIntakeImages = (newest.intakeImages && newest.intakeImages.length > 0)
        ? newest.intakeImages
        : (oldest.intakeImages && oldest.intakeImages.length > 0 ? oldest.intakeImages : []);

    const merged: RepairTicket = {
        ...newest,
        history: combinedHistory,
        diagnosticSheetB: mergedSheetB,
        diagnosticReport: mergedDiagnosticReport,
        diagnosticImages: mergedDiagnosticImages,
        intakeImages: mergedIntakeImages,
        printDiagnosticIntegrated: newest.printDiagnosticIntegrated || oldest.printDiagnosticIntegrated || Boolean(mergedDiagnosticReport.length > 0 || mergedDiagnosticImages.length > 0),
        showExpertiseB: newest.showExpertiseB || oldest.showExpertiseB || Boolean(mergedSheetB),
        clientSignature: newest.clientSignature || oldest.clientSignature,
        attachments: mergeArrayByKey(local.attachments || [], remote.attachments || [], 'id'),
        paymentsList: mergeArrayByKey(local.paymentsList || [], remote.paymentsList || [], 'id'),
        payments: mergeArrayByKey(local.payments || [], remote.payments || [], 'id'),
        ligneVentes: (newest.ligneVentes && newest.ligneVentes.length > 0) ? newest.ligneVentes : (oldest.ligneVentes || []),
        isReopenedAfterCancellation: newest.isReopenedAfterCancellation !== undefined ? newest.isReopenedAfterCancellation : oldest.isReopenedAfterCancellation,
        cancellationReturnDate: newest.cancellationReturnDate || oldest.cancellationReturnDate,
        cancellationReturnNotes: newest.cancellationReturnNotes || oldest.cancellationReturnNotes,
    };

    // Fusion intelligente des notes techniques pour éviter d'effacer des commentaires
    const localNotes = (local.technicianNotes || "").trim();
    const remoteNotes = (remote.technicianNotes || "").trim();
    
    if (localNotes !== remoteNotes && localNotes && remoteNotes) {
        if (!localNotes.includes(remoteNotes) && !remoteNotes.includes(localNotes)) {
            merged.technicianNotes = `[Dépôt local]:\n${localNotes}\n\n[Import distant]:\n${remoteNotes}`;
        } else {
            merged.technicianNotes = localNotes.length >= remoteNotes.length ? localNotes : remoteNotes;
        }
    }

    merged.customFields = { ...(oldest.customFields || {}), ...(newest.customFields || {}) };
    merged.client = {
        name: 'Client inconnu',
        phone: '',
        ...(oldest.client || {}),
        ...(newest.client || {}),
        customFields: { ...(oldest.client?.customFields || {}), ...(newest.client?.customFields || {}) }
    };

    return merged;
};

/**
 * Fusionne intelligemment les mises à jour en garantissant l'intégrité des données complexes.
 */
export const mergeUpdates = (entity: EntityType, local: unknown, remote: unknown): unknown => {
    if (!local) return remote; 
    if (!remote) return local; 

    if (entity === 'ticket') {
        return mergeRepairTicket(local as RepairTicket, remote as RepairTicket);
    }
    
    if (entity === 'suggestions') {
        const lS = local as SuggestionRecord;
        const rS = remote as SuggestionRecord;
        return {
            category: lS.category,
            // Union des suggestions sans doublons
            values: Array.from(new Set([
                ...(Array.isArray(lS.values) ? lS.values : []), 
                ...(Array.isArray(rS.values) ? rS.values : [])
            ])).sort()
        };
    }

    // Gestion des dates de modification pour les autres entités
    const localTyped = local as Record<string, unknown>;
    const remoteTyped = remote as Record<string, unknown>;

    const localTS = new Date((localTyped.updatedAt || localTyped.date || localTyped.uploadDate || 0) as string).getTime();
    const remoteTS = new Date((remoteTyped.updatedAt || remoteTyped.date || remoteTyped.uploadDate || 0) as string).getTime();

    // En cas d'égalité de date ou d'absence de date, on garde la version la plus "riche" en contenu
    if (localTS === remoteTS) {
        const localLen = JSON.stringify(local).length;
        const remoteLen = JSON.stringify(remote).length;
        return remoteLen >= localLen ? remote : local;
    }

    // Priorité à la donnée la plus récente (le "Delta" positif)
    return remoteTS > localTS ? remote : local;
};
