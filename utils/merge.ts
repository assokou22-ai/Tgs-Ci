import { EntityType, RepairTicket, HistoryEntry } from '../types.ts';

// Helper pour fusionner et dédoublonner des tableaux d'objets par une clé unique (ex: timestamp)
const mergeArrayByKey = <T extends Record<string, any>>(a: T[], b: T[], key: keyof T): T[] => {
    const map = new Map<any, T>();
    // On charge le premier tableau
    (a || []).forEach(item => map.set(item[key], item));
    // On fusionne avec le deuxième (les doublons de clé seront écrasés par 'b')
    (b || []).forEach(item => map.set(item[key], item));
    return Array.from(map.values());
};

const mergeRepairTicket = (local: RepairTicket, remote: RepairTicket): RepairTicket => {
    const localDate = new Date(local.updatedAt || 0).getTime();
    const remoteDate = new Date(remote.updatedAt || 0).getTime();

    // La version la plus récente sert de base structurelle
    const newest = remoteDate > localDate ? remote : local;
    const oldest = remoteDate > localDate ? local : remote;

    // FUSION DE L'HISTORIQUE : On combine tout et on trie par date
    const combinedHistory = mergeArrayByKey<HistoryEntry>(local.history || [], remote.history || [], 'timestamp')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const merged: RepairTicket = {
        ...newest,
        history: combinedHistory,
        // On garde les données techniques les plus complètes si l'un des deux est vide
        diagnosticSheetB: newest.diagnosticSheetB || oldest.diagnosticSheetB,
        diagnosticReport: (newest.diagnosticReport?.length || 0) >= (oldest.diagnosticReport?.length || 0) 
            ? newest.diagnosticReport 
            : oldest.diagnosticReport,
        clientSignature: newest.clientSignature || oldest.clientSignature,
    };

    // FUSION INTELLIGENTE DES NOTES TECHNIQUES
    const localNotes = (local.technicianNotes || "").trim();
    const remoteNotes = (remote.technicianNotes || "").trim();
    
    if (localNotes !== remoteNotes && localNotes && remoteNotes) {
        // Si les deux versions ont des notes différentes, on les concatène pour ne rien perdre
        // mais seulement si l'une ne contient pas déjà l'autre
        if (!localNotes.includes(remoteNotes) && !remoteNotes.includes(localNotes)) {
            merged.technicianNotes = `[NOTE LOCALE]:\n${localNotes}\n\n[NOTE IMPORTÉE]:\n${remoteNotes}`;
        } else {
            merged.technicianNotes = localNotes.length >= remoteNotes.length ? localNotes : remoteNotes;
        }
    } else {
        merged.technicianNotes = localNotes || remoteNotes;
    }

    // Fusion des champs personnalisés pour ne pas perdre de métadonnées spécifiques
    merged.customFields = { ...(oldest.customFields || {}), ...(newest.customFields || {}) };
    merged.client.customFields = { ...(oldest.client.customFields || {}), ...(newest.client.customFields || {}) };

    return merged;
};

/**
 * Fusionne intelligemment les mises à jour d'une source (fichier ou serveur) avec les données locales.
 */
export const mergeUpdates = (entity: EntityType, local: any, remote: any): any => {
    if (!local) return remote; 
    if (!remote) return local; 

    // Logique ultra-précise pour les fiches clients
    if (entity === 'ticket') {
        return mergeRepairTicket(local as RepairTicket, remote as RepairTicket);
    }
    
    // Pour les autres entités (Stock, Services), on utilise la date de modification
    if (local.updatedAt && remote.updatedAt) {
        const localDate = new Date(local.updatedAt).getTime();
        const remoteDate = new Date(remote.updatedAt).getTime();
        return remoteDate >= localDate ? remote : local;
    }
    
    return remote;
};