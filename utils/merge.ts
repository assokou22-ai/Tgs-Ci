
import { EntityType, RepairTicket, HistoryEntry, SuggestionRecord } from '../types.ts';

// Helper pour fusionner et dédoublonner des tableaux d'objets par une clé unique (ex: timestamp ou id)
const mergeArrayByKey = <T extends Record<string, unknown>>(a: T[], b: T[], key: keyof T): T[] => {
    const map = new Map<unknown, T>();
    (a || []).forEach(item => map.set(item[key], item));
    (b || []).forEach(item => map.set(item[key], item));
    return Array.from(map.values());
};

const mergeRepairTicket = (local: RepairTicket, remote: RepairTicket): RepairTicket => {
    const localDate = new Date(local.updatedAt || 0).getTime();
    const remoteDate = new Date(remote.updatedAt || 0).getTime();

    // La version la plus récente sert de base structurelle, avec un tie-breaker sur la richesse du contenu si les dates sont identiques
    let newest = local;
    let oldest = remote;
    if (remoteDate > localDate) {
        newest = remote;
        oldest = local;
    } else if (localDate > remoteDate) {
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

    // Fusion de l'historique : On combine tout chronologiquement sans perte
    const combinedHistory = mergeArrayByKey<HistoryEntry>(local.history || [], remote.history || [], 'timestamp')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const merged: RepairTicket = {
        ...newest,
        history: combinedHistory,
        // On conserve toujours les blocs de données les plus complets (si l'ancien a un diag et pas le nouveau)
        diagnosticSheetB: newest.diagnosticSheetB || oldest.diagnosticSheetB,
        diagnosticReport: (newest.diagnosticReport?.length || 0) >= (oldest.diagnosticReport?.length || 0) 
            ? newest.diagnosticReport 
            : oldest.diagnosticReport,
        diagnosticImages: (newest.diagnosticImages?.length || 0) >= (oldest.diagnosticImages?.length || 0)
            ? newest.diagnosticImages
            : oldest.diagnosticImages,
        clientSignature: newest.clientSignature || oldest.clientSignature,
        attachments: mergeArrayByKey(local.attachments || [], remote.attachments || [], 'id'),
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
    merged.client.customFields = { ...(oldest.client.customFields || {}), ...(newest.client.customFields || {}) };

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
