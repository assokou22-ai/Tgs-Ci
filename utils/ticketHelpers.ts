import { RepairTicket, RepairServiceItem, LigneVenteFiche, RepairStatus } from '../types.ts';

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

export interface TicketFinancialSummary {
    diagnosticCost: number;
    repairCost: number;
    servicesCost: number;
    lignesVenteCost: number;
    totalBilled: number;
    advanceReceived: number;
    balanceDue: number;
    isFullyPaid: boolean;
    // Règle comptable : Fiches annulées déclarées infacturables (aucun fond intégrable au point)
    isInfacturable: boolean;
    infacturableNotice?: string;
    isSubcontractor: boolean;
    rawDiagnosticCost: number;
    rawRepairCost: number;
    rawTotalBilled: number;
    rawAdvanceReceived: number;
    rawBalanceDue: number;
    wasPreviouslyPaidOrAdvanced: boolean;
}

/**
 * Helper to check if a ticket is canceled / infacturable.
 */
export const isTicketInfacturable = (
    ticket: Partial<RepairTicket> | undefined | null
): boolean => {
    if (!ticket) return false;
    return ticket.status === RepairStatus.ANNULE || 
           ticket.status === 'Annulé' || 
           ticket.isInfacturable === true;
};

/**
 * Universal financial calculator for all repair tickets (historical legacy and modern).
 * Recovers exact values without modifying database records:
 * - totalBilled = diagnostic + repair (where repair is ticket.costs.repair or sum of services, never both)
 * - advanceReceived = costs.advance
 * - balanceDue = Math.max(0, totalBilled - advanceReceived)
 * 
 * RÈGLE COMPTABLE ATELIER TGS-CI :
 * Lorsqu'une fiche est annulée, si une avance a été versée ou si le dossier est totalement soldé,
 * elle est AUTOMATIQUEMENT mentionnée comme INFACTURABLE.
 * En conséquence, AUCUN FOND N'EST INTÉGRABLE DANS NOTRE POINT (point de caisse, trésorerie, bilan, CA).
 * totalBilled, advanceReceived et balanceDue retournent STRICTEMENT 0.
 */
export const getTicketFinancialSummary = (
    ticket: Partial<RepairTicket> | undefined | null
): TicketFinancialSummary => {
    if (!ticket) {
        return {
            diagnosticCost: 0,
            repairCost: 0,
            servicesCost: 0,
            lignesVenteCost: 0,
            totalBilled: 0,
            advanceReceived: 0,
            balanceDue: 0,
            isFullyPaid: false,
            isInfacturable: false,
            isSubcontractor: false,
            rawDiagnosticCost: 0,
            rawRepairCost: 0,
            rawTotalBilled: 0,
            rawAdvanceReceived: 0,
            rawBalanceDue: 0,
            wasPreviouslyPaidOrAdvanced: false,
        };
    }

    // Règle tarifaire Sous-traitance :
    // Les fiches des sous-traitants sont traitées de manière spécifique avec des réductions dédiées :
    // Les frais de diagnostic ne sont PAS appliqués aux sous-traitants (0 F CFA au lieu de 5 000 F CFA).
    const isSubcontractor = ticket.client?.clientType === 'subcontractor';
    const diag = isSubcontractor ? 0 : (Number(ticket.costs?.diagnostic) || 0);
    const rep = Number(ticket.costs?.repair) || 0;
    const servicesSum = Array.isArray(ticket.services)
        ? ticket.services.reduce((acc, s) => acc + (Number(s.price) || 0), 0)
        : 0;

    // Règle comptable atelier TGS-CI :
    // 1. Si ticket.services contient des prestations chiffrées (servicesSum > 0) :
    //    On prend servicesSum qui correspond au détail exact des lignes de devis.
    // 2. Si ticket.services est vide ou égal à 0, mais ticket.costs.repair > 0 :
    //    On prend ticket.costs.repair (valeur historique ou forfait global).
    // 3. En AUCUN CAS on n'additionne ticket.costs.repair et ticket.services !
    let repairCost = 0;
    if (servicesSum > 0) {
        repairCost = servicesSum;
    } else if (rep > 0) {
        repairCost = rep;
    }

    // Montant brut historique / chiffré
    const rawTotalBilled = diag + repairCost;
    const rawAdvanceReceived = Number(ticket.costs?.advance) || 0;
    const rawBalanceDue = Math.max(0, rawTotalBilled - rawAdvanceReceived);
    const wasPreviouslyPaidOrAdvanced = (rawAdvanceReceived > 0) || (rawTotalBilled > 0 && rawBalanceDue === 0);

    const isCanceled = isTicketInfacturable(ticket);

    // Lorsqu'une fiche est annulée :
    // Automatiquement mentionnée comme INFACTURABLE -> AUCUN FOND INTÉGRABLE DANS NOTRE POINT
    if (isCanceled) {
        let infacturableNotice = "Fiche annulée — mentionnée comme INFACTURABLE : aucun fond intégrable dans notre point.";
        if (rawAdvanceReceived > 0) {
            infacturableNotice = `Fiche annulée — INFACTURABLE : avance versée de ${rawAdvanceReceived.toLocaleString('fr-FR')} F CFA exclue de notre point (aucun fond intégrable).`;
        } else if (rawTotalBilled > 0 && rawBalanceDue === 0) {
            infacturableNotice = `Fiche annulée — INFACTURABLE : dossier soldé (${rawTotalBilled.toLocaleString('fr-FR')} F CFA) exclu de notre point (aucun fond intégrable).`;
        }

        return {
            diagnosticCost: 0,
            repairCost: 0,
            servicesCost: 0,
            lignesVenteCost: 0,
            totalBilled: 0,
            advanceReceived: 0,
            balanceDue: 0,
            isFullyPaid: false,
            isInfacturable: true,
            infacturableNotice,
            isSubcontractor,
            rawDiagnosticCost: diag,
            rawRepairCost: repairCost,
            rawTotalBilled,
            rawAdvanceReceived,
            rawBalanceDue,
            wasPreviouslyPaidOrAdvanced,
        };
    }

    // Fiche normale active : montants standards
    const totalBilled = rawTotalBilled;
    const advanceReceived = rawAdvanceReceived;
    const balanceDue = rawBalanceDue;
    const isFullyPaid = totalBilled > 0 ? balanceDue === 0 : (advanceReceived > 0);

    return {
        diagnosticCost: diag,
        repairCost,
        servicesCost: servicesSum,
        lignesVenteCost: 0,
        totalBilled,
        advanceReceived,
        balanceDue,
        isFullyPaid,
        isInfacturable: false,
        isSubcontractor,
        rawDiagnosticCost: diag,
        rawRepairCost: repairCost,
        rawTotalBilled,
        rawAdvanceReceived,
        rawBalanceDue,
        wasPreviouslyPaidOrAdvanced,
    };
};
