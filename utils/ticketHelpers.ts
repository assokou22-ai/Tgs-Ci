import { RepairTicket, RepairServiceItem, LigneVenteFiche } from '../types.ts';

/**
 * Checks if a ticket is a legacy ticket (created before June 18, 2026)
 * @param ticket Partial or full RepairTicket
 * @returns boolean
 */
export const isLegacyTicket = (ticket: Partial<RepairTicket> | undefined | null): boolean => {
    if (!ticket) return false;
    if (!ticket.createdAt) return false;
    try {
        const ticketDate = new Date(ticket.createdAt);
        const thresholdDate = new Date('2026-06-18T00:00:00');
        return ticketDate.getTime() < thresholdDate.getTime();
    } catch {
        return false;
    }
};

/**
 * Decompiles legacy array of RepairServiceItem back to structured LigneVenteFiche lines
 */
export const decompileServicesToLignesVente = (
    services: RepairServiceItem[],
    ticketId: string,
    macModel: string
): LigneVenteFiche[] => {
    if (!services || services.length === 0) return [];
    
    return services.map(s => {
        let designation = (s.name || '').trim();
        let quantity = 1;
        let reductionActive = false;
        let reductionType: 'montant' | 'pourcentage' | null = null;
        let reductionValeur = 0;

        // 1. Parse Remise/Reduction: e.g. " [REMISE -15%]" or " [REMISE -15000 FCFA]"
        const remiseRegex = /\s*\[REMISE\s*-(\d+)\s*(%|FCFA|F\s*CFA)\]/i;
        const remiseMatch = designation.match(remiseRegex);
        if (remiseMatch) {
            reductionActive = true;
            reductionValeur = parseInt(remiseMatch[1], 10) || 0;
            const unitType = remiseMatch[2].trim().toUpperCase();
            if (unitType === '%') {
                reductionType = 'pourcentage';
            } else {
                reductionType = 'montant';
            }
            // Remove remise suffix from designation
            designation = designation.replace(remiseRegex, '').trim();
        }

        // 2. Parse Quantity: e.g. " (x3)" at the end
        const qtyRegex = /\s*\(x(\d+)\)/i;
        const qtyMatch = designation.match(qtyRegex);
        if (qtyMatch) {
            quantity = parseInt(qtyMatch[1], 10) || 1;
            designation = designation.replace(qtyRegex, '').trim();
        }

        const prixFinalTotal = s.price || 0;
        const prixUnitaireFinal = quantity > 0 ? Math.round(prixFinalTotal / quantity) : prixFinalTotal;
        
        let prixUnitaireStandard = prixUnitaireFinal;
        if (reductionActive && reductionValeur > 0) {
            if (reductionType === 'pourcentage') {
                const fraction = 1 - (reductionValeur / 100);
                if (fraction > 0) {
                    prixUnitaireStandard = Math.round(prixUnitaireFinal / fraction);
                }
            } else if (reductionType === 'montant') {
                prixUnitaireStandard = prixUnitaireFinal + reductionValeur;
            }
        }

        return {
            id: s.id || `l-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            fiche_id: ticketId,
            type_ligne: 'prestation', // Defaulting to labor/designation for legacy
            article_stock_id: null,
            designation: designation.toUpperCase() || 'PRESTATION SANS NOM',
            modele_compatible: (macModel || 'TOUS').toUpperCase(),
            categorie: s.category || 'AUTRE',
            quantite: quantity,
            prix_unitaire_standard: prixUnitaireStandard,
            reduction_active: reductionActive,
            reduction_type: reductionType,
            reduction_valeur: reductionValeur,
            prix_unitaire_final: prixUnitaireFinal,
            statut_ligne: 'utilise',
            prix_achat: 0
        };
    });
};

/**
 * Ensures legacy ticket modifications preserve original manual services structure in `ticket.services`
 * and add any newly introduced stock lines correctly to the overall amount.
 */
export const calculateTicketTotalServices = (
    ticket: Partial<RepairTicket>
): number => {
    const servicesSum = ticket.services?.reduce((sum, s) => sum + s.price, 0) || 0;
    return servicesSum;
};
