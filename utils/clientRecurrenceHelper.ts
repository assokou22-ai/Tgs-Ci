import { RepairTicket } from '../types.ts';

export interface UniqueClientMac {
    serialNumber: string;
    modelNumber: string;
    macModel: string;
    macColor?: string;
    lastTicketId: string;
    lastDate: string;
    ticketCount: number;
}

export interface ClientRecurrenceProfile {
    normalizedName: string;
    clientName: string;
    phone: string;
    secondaryPhone?: string;
    email?: string;
    clientType: 'direct' | 'subcontractor';
    isSubcontractor: boolean;
    ticketCount: number;
    tickets: RepairTicket[];
    uniqueMacs: UniqueClientMac[];
    isCandidateForSubcontractor: boolean; // ≥ 5 tickets & pas encore sous-traitant
    isEligibleForRecurrentPrompt: boolean; // ≥ 2 tickets
}

/**
 * Normalise un nom de client pour comparaison sans accent, majuscules et espaces superflus.
 */
export const normalizeClientKey = (name: string): string => {
    if (!name) return '';
    return name
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
};

/**
 * Nettoie un numéro de téléphone pour comparaison (chiffres uniquement).
 */
export const cleanPhoneDigits = (phone: string): string => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
};

/**
 * Agrège les profils récurrents des clients sur une liste de fiches données.
 */
export const getClientRecurrenceProfiles = (tickets: RepairTicket[]): Map<string, ClientRecurrenceProfile> => {
    const profiles = new Map<string, ClientRecurrenceProfile>();

    tickets.forEach(ticket => {
        const rawName = ticket.client?.name || '';
        const normKey = normalizeClientKey(rawName);
        if (!normKey || normKey.length < 2) return;

        const phone = ticket.client?.phone || '';
        const email = ticket.client?.email || '';
        const isSubcontractor = ticket.client?.clientType === 'subcontractor';

        if (!profiles.has(normKey)) {
            profiles.set(normKey, {
                normalizedName: normKey,
                clientName: rawName.trim().toUpperCase(),
                phone: phone.trim(),
                secondaryPhone: ticket.client?.secondaryPhone?.trim() || '',
                email: email.trim(),
                clientType: isSubcontractor ? 'subcontractor' : 'direct',
                isSubcontractor,
                ticketCount: 1,
                tickets: [ticket],
                uniqueMacs: [],
                isCandidateForSubcontractor: false,
                isEligibleForRecurrentPrompt: false
            });
        } else {
            const prof = profiles.get(normKey)!;
            prof.ticketCount += 1;
            prof.tickets.push(ticket);
            if (!prof.phone && phone) prof.phone = phone.trim();
            if (!prof.email && email) prof.email = email.trim();
            if (isSubcontractor) {
                prof.isSubcontractor = true;
                prof.clientType = 'subcontractor';
            }
        }
    });

    // Construire la liste des Macs uniques par profil et qualifier les statuts
    profiles.forEach(prof => {
        prof.isEligibleForRecurrentPrompt = prof.ticketCount >= 2;
        prof.isCandidateForSubcontractor = prof.ticketCount >= 5 && !prof.isSubcontractor;

        const macMap = new Map<string, UniqueClientMac>();

        prof.tickets.forEach(t => {
            const sn = (t.serialNumber || '').trim().toUpperCase();
            const modA = (t.modelNumber || t.customFields?.modelA || '').trim().toUpperCase();
            const macName = (t.macModel || '').trim();

            // Clé d'identification du Mac (S/N en priorité, sinon Modèle A)
            const macKey = sn.length >= 6 ? `SN_${sn}` : (modA ? `MOD_${modA}_${macName}` : `T_${t.id}`);

            if (!macMap.has(macKey)) {
                macMap.set(macKey, {
                    serialNumber: sn,
                    modelNumber: modA,
                    macModel: macName,
                    macColor: t.macColor || '',
                    lastTicketId: t.id,
                    lastDate: t.createdAt || t.updatedAt || '',
                    ticketCount: 1
                });
            } else {
                const existing = macMap.get(macKey)!;
                existing.ticketCount += 1;
                // Mettre à jour avec la date la plus récente
                if (new Date(t.createdAt).getTime() > new Date(existing.lastDate).getTime()) {
                    existing.lastDate = t.createdAt;
                    existing.lastTicketId = t.id;
                    if (t.macColor) existing.macColor = t.macColor;
                }
            }
        });

        prof.uniqueMacs = Array.from(macMap.values());
    });

    return profiles;
};

/**
 * Recherche des clients récurrents correspondant au nom ou au numéro tapé.
 * RÈGLE STRICTE UTILISATEUR : Ne concerne UNIQUEMENT que les clients enregistrés au moins 2 fois (ticketCount >= 2).
 */
export const findMatchingRecurrentClients = (
    query: string,
    tickets: RepairTicket[]
): ClientRecurrenceProfile[] => {
    if (!query || query.trim().length < 2) return [];

    const normQuery = normalizeClientKey(query);
    const phoneDigits = cleanPhoneDigits(query);
    const profiles = getClientRecurrenceProfiles(tickets);
    const matches: ClientRecurrenceProfile[] = [];

    profiles.forEach(prof => {
        // Filtrer strictement : au moins 2 dossiers enregistrés
        if (!prof.isEligibleForRecurrentPrompt) return;

        let matched = false;

        // Match sur le nom
        if (prof.normalizedName.includes(normQuery) || normQuery.includes(prof.normalizedName)) {
            matched = true;
        }

        // Match sur le numéro de téléphone si la recherche contient des chiffres
        if (!matched && phoneDigits.length >= 3) {
            const profDigits = cleanPhoneDigits(prof.phone);
            const profSecDigits = cleanPhoneDigits(prof.secondaryPhone || '');
            if (profDigits.includes(phoneDigits) || profSecDigits.includes(phoneDigits)) {
                matched = true;
            }
        }

        if (matched) {
            matches.push(prof);
        }
    });

    // Trier les correspondances par nombre de fiches décroissant
    return matches.sort((a, b) => b.ticketCount - a.ticketCount);
};

/**
 * Détecte les candidats au statut Sous-traitant (clients avec >= 5 fiches, non encore enregistrés comme sous-traitant).
 * Optionnellement filtré sur une année précise.
 */
export const detectSubcontractorCandidates = (
    tickets: RepairTicket[],
    targetYear?: number
): ClientRecurrenceProfile[] => {
    const relevantTickets = targetYear
        ? tickets.filter(t => {
            const dateStr = t.createdAt || t.updatedAt;
            if (!dateStr) return false;
            return new Date(dateStr).getFullYear() === targetYear;
        })
        : tickets;

    const profiles = getClientRecurrenceProfiles(relevantTickets);
    const candidates: ClientRecurrenceProfile[] = [];

    profiles.forEach(prof => {
        // A partir de 5 machines enregistrées et pas encore identifié comme sous-traitant
        if (prof.ticketCount >= 5 && !prof.isSubcontractor) {
            candidates.push(prof);
        }
    });

    return candidates.sort((a, b) => b.ticketCount - a.ticketCount);
};

/**
 * Harmonise toutes les fiches d'un client dans la base de données en tant que Sous-traitant :
 * - clientType = 'subcontractor'
 * - Frais de diagnostic = 0 (exonération sous-traitance)
 * - Traçabilité dans l'historique
 */
export const harmonizeClientAsSubcontractor = (
    clientNormKey: string,
    allTickets: RepairTicket[]
): { updatedTickets: RepairTicket[]; count: number } => {
    const normTarget = normalizeClientKey(clientNormKey);
    const updatedTickets: RepairTicket[] = [];

    const now = new Date().toISOString();

    allTickets.forEach(t => {
        const ticketNorm = normalizeClientKey(t.client?.name || '');
        if (ticketNorm === normTarget) {
            const oldDiag = Number(t.costs?.diagnostic) || 0;

            const updated: RepairTicket = {
                ...t,
                client: {
                    ...t.client,
                    clientType: 'subcontractor',
                    technicianName: t.client?.technicianName || t.client?.name || '',
                    technicianPhone: t.client?.technicianPhone || t.client?.phone || ''
                },
                costs: {
                    ...t.costs,
                    diagnostic: 0 // Frais de diagnostic offerts aux sous-traitants
                },
                updatedAt: now,
                history: [
                    ...(t.history || []),
                    {
                        timestamp: now,
                        user: 'Système',
                        action: `Harmonisation Sous-traitant validée (≥5 machines enregistrées). Statut Sous-traitant appliqué, frais de diagnostic exonérés (0 F CFA au lieu de ${oldDiag.toLocaleString('fr-FR')} F CFA).`
                    }
                ]
            };
            updatedTickets.push(updated);
        }
    });

    return {
        updatedTickets,
        count: updatedTickets.length
    };
};

/**
 * Vérifie si le Mac actuellement saisi correspond à une machine déjà passée chez nous pour ce client.
 * - Si même numéro de série : Réintervention confirmée.
 * - Si même modèle AXXXX et le client n'avait qu'un seul Mac : proposition de réintervention.
 */
export const checkIsSameMac = (
    currentMac: { serialNumber?: string; modelNumber?: string; macModel?: string },
    pastMacs: UniqueClientMac[]
): { isSameMac: boolean; matchedMac?: UniqueClientMac; reason?: string } => {
    if (!pastMacs || pastMacs.length === 0) {
        return { isSameMac: false };
    }

    const currentSn = (currentMac.serialNumber || '').trim().toUpperCase();
    const currentMod = (currentMac.modelNumber || '').trim().toUpperCase();

    // 1. Concordance exacte sur le Numéro de Série
    if (currentSn.length >= 6) {
        const snMatch = pastMacs.find(m => m.serialNumber && m.serialNumber === currentSn);
        if (snMatch) {
            return {
                isSameMac: true,
                matchedMac: snMatch,
                reason: `Numéro de série identique (S/N: ${snMatch.serialNumber}) lié au dossier #${snMatch.lastTicketId}.`
            };
        }
    }

    // 2. Concordance exacte sur le Modèle AXXXX si le client ne possède qu'une seule machine enregistrée
    if (currentMod && /^A\d{4}$/.test(currentMod) && pastMacs.length === 1) {
        const onlyMac = pastMacs[0];
        if (onlyMac.modelNumber === currentMod) {
            return {
                isSameMac: true,
                matchedMac: onlyMac,
                reason: `Modèle ${currentMod} correspondant à l'unique Mac précédemment déposé par ce client (dossier #${onlyMac.lastTicketId}).`
            };
        }
    }

    return { isSameMac: false };
};
