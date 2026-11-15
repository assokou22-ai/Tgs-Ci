import {
    ActivityCategory,
    Commande,
    ExternalPurchase,
    Facture,
    FixedChargeItem,
    LigneVenteFiche,
    PartSupplySource,
    ProfitabilitySettings,
    RepairStatus,
    RepairTicket,
    StockItem,
    StockUsage,
} from '../types.ts';
import { decompileServicesToLignesVente, getTicketFinancialSummary } from './ticketHelpers.ts';

export const ACTIVITY_LABELS: Record<ActivityCategory, string> = {
    reparation: 'Réparation',
    vente_pieces: 'Vente de pièces',
    vente_macbook: 'Vente de MacBook',
};

export const ACTIVITY_SHORT_LABELS: Record<ActivityCategory, string> = {
    reparation: 'Réparation',
    vente_pieces: 'Pièces',
    vente_macbook: 'MacBook',
};

export const ACTIVITY_ORDER: ActivityCategory[] = ['reparation', 'vente_pieces', 'vente_macbook'];

export const PART_SOURCE_LABELS: Record<PartSupplySource, string> = {
    en_stock: 'En stock',
    a_commander: 'À commander',
    fourni_client: 'Fourni par le client',
};

export const PART_SOURCE_SHORT_LABELS: Record<PartSupplySource, string> = {
    en_stock: 'En stock',
    a_commander: 'À commander',
    fourni_client: 'Fourni client',
};

const normalizeText = (value?: string | null): string =>
    (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();

const REPAIR_KEYWORDS = [
    'REPARATION',
    'REMPLACEMENT',
    'DESOXYDATION',
    'SOUDURE',
    'MICRO-SOUDURE',
    'MICROSOUDURE',
    'DIAGNOSTIC',
    'EXPERTISE',
    'NETTOYAGE',
    'INSTALLATION',
    'DEPANNAGE',
    'LUMIERE',
    'RETROECLAIRAGE',
    "MAIN D'OEUVRE",
    'MAIN DOEUVRE',
    'RECUPERATION',
    'FORMATAGE',
    'REPROGRAMMATION',
    'INTERVENTION',
    'MONTAGE',
    'CHANGEMENT',
    'MAINTENANCE',
    'REFECTION',
    'REMISE EN ETAT',
    'RECONDITIONNEMENT',
    'DEBLOCAGE',
    'SAUVEGARDE',
];

const MACBOOK_UNIT_KEYWORDS = [
    'MACBOOK',
    'IMAC',
    'MAC MINI',
    'MAC STUDIO',
    'MAC PRO',
    'ORDINATEUR',
    'LAPTOP',
    'PC PORTABLE',
];

const PART_KEYWORDS = [
    'ECRAN',
    'BATTERIE',
    'CLAVIER',
    'TRACKPAD',
    'CARTE MERE',
    'CARTE_MERE',
    'CHARGEUR',
    'CABLE',
    'CONNECTEUR',
    'CONNECTIQUE',
    'NAPPE',
    'FLEX',
    'VENTILATEUR',
    'SSD',
    'RAM',
    'DISQUE',
    'MEMOIRE',
    'COQUE',
    'COUVRE',
    'TOUCHE',
    'CHARNIERE',
    'HAUT-PARLEUR',
    'WEBCAM',
    'ADAPTATEUR',
    'SOURIS',
    'BOITIER',
    'PIECE',
    'ACCESSOIRE',
    'HOUSSE',
    'MAGSAFE',
    'ALIMENTATION',
    'VITRE',
    'TOUCHBAR',
    'TOUCH BAR',
    'ANTENNE',
    'PUCE',
    'CHIP',
    'COMPOSANT',
    'PORT USB',
    'USB-C',
];

export interface CategorizableLineInput {
    activite?: ActivityCategory;
    designation?: string;
    categorie?: string;
    type_ligne?: string;
}

/**
 * Catégorise automatiquement une ligne en Réparation, Vente de pièces ou Vente de MacBook.
 * Respecte en priorité un éventuel choix explicite `line.activite`.
 */
export const categorizeLineActivity = (line: CategorizableLineInput): ActivityCategory => {
    if (
        line.activite === 'reparation' ||
        line.activite === 'vente_pieces' ||
        line.activite === 'vente_macbook'
    ) {
        return line.activite;
    }

    const des = normalizeText(line.designation);
    const cat = normalizeText(line.categorie);
    const typeLigne = line.type_ligne || '';

    // 1. Mentions explicites prioritaires
    if (
        cat === 'VENTE_MACBOOK' ||
        des.includes('VENTE MACBOOK') ||
        des.includes('VENTE DE MACBOOK') ||
        des.includes('VENTE MAC ') ||
        des.includes('VENTE IMAC') ||
        des.includes('VENTE MAC MINI') ||
        des.includes('ACHAT-REVENTE MAC')
    ) {
        return 'vente_macbook';
    }

    if (
        cat === 'VENTE_PIECES' ||
        des.includes('VENTE PIECE') ||
        des.includes('VENTE DE PIECE') ||
        des.includes('VENTE ACCESSOIRE')
    ) {
        return 'vente_pieces';
    }

    const hasRepairVerb = REPAIR_KEYWORDS.some((kw) => des.includes(kw) || cat.includes(kw));
    const hasMacUnit = MACBOOK_UNIT_KEYWORDS.some((kw) => des.includes(kw));
    const hasPartWord = PART_KEYWORDS.some((kw) => des.includes(kw) || cat.includes(kw));

    // 2. Vente de MacBook (machine complète sans verbe d'intervention ni nom de composant)
    if (!hasRepairVerb && hasMacUnit && !hasPartWord) {
        return 'vente_macbook';
    }

    // 3. Réparation (toute prestation avec verbe d'intervention ou catégorie logicielle/carte mère prestation)
    if (hasRepairVerb) {
        return 'reparation';
    }

    // 4. Vente de pièces (articles stock / hors stock ou mots-clés de pièces/accessoires)
    if (
        typeLigne === 'article_stock' ||
        typeLigne === 'article_hors_stock' ||
        hasPartWord
    ) {
        return 'vente_pieces';
    }

    // 5. Fallback par défaut : Réparation
    return 'reparation';
};

/**
 * Déduit de manière non destructive l'origine d'approvisionnement d'une ligne :
 * 'en_stock' | 'a_commander' | 'fourni_client' (ou null si prestation pure sans pièce).
 */
export const inferLinePartSource = (
    line: Partial<LigneVenteFiche>,
    ticket?: Partial<RepairTicket> | null
): PartSupplySource | null => {
    if (
        line.source_piece === 'en_stock' ||
        line.source_piece === 'a_commander' ||
        line.source_piece === 'fourni_client'
    ) {
        return line.source_piece;
    }

    const des = normalizeText(line.designation);
    if (
        des.includes('FOURNI PAR LE CLIENT') ||
        des.includes('FOURNI CLIENT') ||
        des.includes('PIECE CLIENT') ||
        des.includes('CLIENT FOURNIT')
    ) {
        return 'fourni_client';
    }

    if (line.type_ligne === 'article_stock') {
        if (
            line.statut_ligne === 'prevu' &&
            (ticket?.status === RepairStatus.EN_ATTENTE_DE_PIECES || ticket?.isWaitingForOrderedPart)
        ) {
            return 'a_commander';
        }
        return 'en_stock';
    }

    if (line.type_ligne === 'article_hors_stock') {
        return 'a_commander';
    }

    if ((Number(line.prix_achat) || 0) > 0) {
        return 'a_commander';
    }

    return null;
};

export type LineCostSource =
    | 'ligne_vente'
    | 'stock_catalog'
    | 'stock_usage'
    | 'external_purchase'
    | 'none';

export interface LineProfitability {
    id: string;
    designation: string;
    categorie: string;
    typeLigne: 'article_stock' | 'article_hors_stock' | 'prestation' | 'diagnostic' | 'forfait';
    activite: ActivityCategory;
    isManualActivity: boolean;
    sourcePiece: PartSupplySource | null;
    statutLigne: LigneVenteFiche['statut_ligne'];
    quantite: number;
    // Prévisionnel (sur montant facturé du dossier)
    ca: number;
    partCost: number;
    costSource: LineCostSource;
    taxProvision: number;
    grossMargin: number; // CA - Coût pièces (1x)
    netMargin: number; // CA - Coût pièces (1x) - Provision fiscale
    marginRate: number; // % sur CA
    // Réel (sur encaissements perçus et pièces réellement engagées)
    realCA: number;
    realPartCost: number;
    realTaxProvision: number;
    realGrossMargin: number;
    realNetMargin: number;
    realMarginRate: number;
    isPlannedOrderPending: boolean; // True si marqué 'a_commander' et encore en attente (prévu)
}

export interface ActivitySummary {
    activite: ActivityCategory;
    label: string;
    lineCount: number;
    ticketCount: number;
    // Prévisionnel
    ca: number;
    partCost: number;
    taxProvision: number;
    grossMargin: number;
    netMargin: number;
    marginRate: number;
    // Réel
    realCA: number;
    realPartCost: number;
    realTaxProvision: number;
    realGrossMargin: number;
    realNetMargin: number;
    realMarginRate: number;
}

export interface TicketProfitability {
    ticketId: string;
    isInfacturable: boolean;
    taxRate: number;
    collectionRatio: number;
    // Prévisionnel
    totalCA: number;
    totalPartCost: number;
    totalTaxProvision: number;
    grossMargin: number;
    netMargin: number;
    marginRate: number;
    // Réel
    realCA: number;
    realPartCost: number;
    realTaxProvision: number;
    realGrossMargin: number;
    realNetMargin: number;
    realMarginRate: number;
    // Suivi approvisionnement pièces
    plannedOrderCost: number;
    enStockCost: number;
    fourniClientCount: number;
    dominantActivity: ActivityCategory;
    activitiesPresent: ActivityCategory[];
    lines: LineProfitability[];
    byActivity: Record<ActivityCategory, ActivitySummary>;
}

export interface FixedChargePeriodLine {
    id: string;
    label: string;
    category?: string;
    frequency: FixedChargeItem['frequency'];
    baseAmount: number;
    proratedAmount: number;
    active: boolean;
    date?: string;
}

export interface PortfolioProfitabilityReport {
    taxRate: number;
    facturableTicketCount: number;
    infacturableTicketCount: number;
    // Prévisionnel
    totalCA: number;
    totalPartCost: number;
    totalTaxProvision: number;
    totalGrossMargin: number;
    totalNetMarginBeforeFixed: number;
    marginRateBeforeFixed: number;
    // Réel
    totalRealCA: number;
    totalRealPartCost: number;
    totalRealTaxProvision: number;
    totalRealGrossMargin: number;
    totalRealNetMarginBeforeFixed: number;
    realMarginRateBeforeFixed: number;
    // Approvisionnement pièces sur la période
    enStockPartCostTotal: number;
    aCommanderPartCostTotal: number;
    aCommanderPlannedCostTotal: number;
    fourniClientLineCount: number;
    byActivity: Record<ActivityCategory, ActivitySummary>;
    ticketResults: Map<string, TicketProfitability>;
    fixedChargesTotal: number;
    fixedChargesLines: FixedChargePeriodLine[];
    fixedChargesPeriodFactorLabel: string;
    operatingResultAfterFixed: number;
    operatingMarginRateAfterFixed: number;
    realOperatingResultAfterFixed: number;
    realOperatingMarginRateAfterFixed: number;
}

const createEmptyActivitySummary = (activite: ActivityCategory): ActivitySummary => ({
    activite,
    label: ACTIVITY_LABELS[activite],
    lineCount: 0,
    ticketCount: 0,
    ca: 0,
    partCost: 0,
    taxProvision: 0,
    grossMargin: 0,
    netMargin: 0,
    marginRate: 0,
    realCA: 0,
    realPartCost: 0,
    realTaxProvision: 0,
    realGrossMargin: 0,
    realNetMargin: 0,
    realMarginRate: 0,
});

export const createEmptyByActivityMap = (): Record<ActivityCategory, ActivitySummary> => ({
    reparation: createEmptyActivitySummary('reparation'),
    vente_pieces: createEmptyActivitySummary('vente_pieces'),
    vente_macbook: createEmptyActivitySummary('vente_macbook'),
});

export interface CalculateTicketProfitabilityOptions {
    stockMap?: Map<string, StockItem>;
    stockUsages?: StockUsage[];
    externalPurchases?: ExternalPurchase[];
    taxProvisionRate?: number;
}

/**
 * Calcule la rentabilité prévisionnelle et réelle d'une fiche
 * (par ligne, par activité et au total du dossier)
 * sans jamais modifier le ticket ni double-compter le coût des pièces.
 */
export const calculateTicketProfitability = (
    ticket: Partial<RepairTicket> | undefined | null,
    options: CalculateTicketProfitabilityOptions = {}
): TicketProfitability => {
    const emptyByActivity = createEmptyByActivityMap();
    const taxRate = Math.max(0, Number(options.taxProvisionRate) || 0);

    if (!ticket || !ticket.id) {
        return {
            ticketId: '',
            isInfacturable: false,
            taxRate,
            collectionRatio: 0,
            totalCA: 0,
            totalPartCost: 0,
            totalTaxProvision: 0,
            grossMargin: 0,
            netMargin: 0,
            marginRate: 0,
            realCA: 0,
            realPartCost: 0,
            realTaxProvision: 0,
            realGrossMargin: 0,
            realNetMargin: 0,
            realMarginRate: 0,
            plannedOrderCost: 0,
            enStockCost: 0,
            fourniClientCount: 0,
            dominantActivity: 'reparation',
            activitiesPresent: [],
            lines: [],
            byActivity: emptyByActivity,
        };
    }

    const fin = getTicketFinancialSummary(ticket);
    if (fin.isInfacturable) {
        return {
            ticketId: ticket.id,
            isInfacturable: true,
            taxRate,
            collectionRatio: 0,
            totalCA: 0,
            totalPartCost: 0,
            totalTaxProvision: 0,
            grossMargin: 0,
            netMargin: 0,
            marginRate: 0,
            realCA: 0,
            realPartCost: 0,
            realTaxProvision: 0,
            realGrossMargin: 0,
            realNetMargin: 0,
            realMarginRate: 0,
            plannedOrderCost: 0,
            enStockCost: 0,
            fourniClientCount: 0,
            dominantActivity: 'reparation',
            activitiesPresent: [],
            lines: [],
            byActivity: emptyByActivity,
        };
    }

    const stockMap = options.stockMap || new Map<string, StockItem>();
    const isTicketCompleted =
        ticket.status === RepairStatus.TERMINE || ticket.status === RepairStatus.RENDU;
    const hasLinkedCommande = Boolean(ticket.linkedCommandeId);

    const rawLines: Array<{
        id: string;
        designation: string;
        categorie: string;
        typeLigne: LineProfitability['typeLigne'];
        activite: ActivityCategory;
        isManualActivity: boolean;
        sourcePiece: PartSupplySource | null;
        statutLigne: LigneVenteFiche['statut_ligne'];
        quantite: number;
        ca: number;
        partCost: number;
        costSource: LineCostSource;
        articleStockId: string | null;
    }> = [];

    // 1. Ligne Frais de diagnostic (0 F pour les sous-traitants, déjà géré par getTicketFinancialSummary)
    if (fin.diagnosticCost > 0) {
        rawLines.push({
            id: '__diagnostic__',
            designation: 'FRAIS DE DIAGNOSTIC / EXPERTISE',
            categorie: 'DIAGNOSTIC',
            typeLigne: 'diagnostic',
            activite: 'reparation',
            isManualActivity: false,
            sourcePiece: null,
            statutLigne: 'utilise',
            quantite: 1,
            ca: fin.diagnosticCost,
            partCost: 0,
            costSource: 'none',
            articleStockId: null,
        });
    }

    // 2. Extraction des lignes facturées (réconciliation stricte avec fin.repairCost pour éviter tout écart)
    const activeLignesVente: LigneVenteFiche[] = Array.isArray(ticket.ligneVentes)
        ? ticket.ligneVentes.filter((l) => l && l.statut_ligne !== 'annule')
        : [];
    const servicesList = Array.isArray(ticket.services) ? ticket.services : [];

    const activeLignesSum = activeLignesVente.reduce(
        (sum, l) => sum + Math.round((Number(l.prix_unitaire_final) || 0) * (Number(l.quantite) || 1)),
        0
    );

    // Map de correspondance pour récupérer prix_achat / activite / source_piece / stockId si on passe par ticket.services
    const lvById = new Map<string, LigneVenteFiche>();
    const lvByName = new Map<string, LigneVenteFiche>();
    activeLignesVente.forEach((l) => {
        if (l.id) lvById.set(l.id, l);
        const key = normalizeText(l.designation);
        if (key && !lvByName.has(key)) lvByName.set(key, l);
    });

    const coveredStockQty = new Map<string, number>();
    const coveredExternalRefs: Array<{ lineIndex: number; name: string; cost: number; used: boolean }> = [];

    const pushLigneVente = (
        l: LigneVenteFiche,
        overrideActivite?: ActivityCategory
    ) => {
        const qty = Math.max(1, Number(l.quantite) || 1);
        const ca = Math.max(0, Math.round((Number(l.prix_unitaire_final) || 0) * qty));
        const sourcePiece = inferLinePartSource(l, ticket);

        let unitCost = 0;
        let costSource: LineCostSource = 'none';

        // Règle absolue : une pièce fournie par le client n'a JAMAIS de coût pièce atelier
        if (sourcePiece !== 'fourni_client') {
            const explicitUnitCost = Math.max(0, Number(l.prix_achat) || 0);
            const stockCatalogUnitCost =
                l.article_stock_id && stockMap.get(l.article_stock_id)
                    ? Math.max(0, Number(stockMap.get(l.article_stock_id)!.cost) || 0)
                    : 0;

            if (explicitUnitCost > 0) {
                unitCost = explicitUnitCost;
                costSource = 'ligne_vente';
            } else if (l.type_ligne === 'article_stock' && stockCatalogUnitCost > 0) {
                unitCost = stockCatalogUnitCost;
                costSource = 'stock_catalog';
            }
        }

        const partCost = sourcePiece === 'fourni_client' ? 0 : Math.round(unitCost * qty);
        if (l.article_stock_id && sourcePiece !== 'fourni_client') {
            coveredStockQty.set(
                l.article_stock_id,
                (coveredStockQty.get(l.article_stock_id) || 0) + qty
            );
        }

        const chosenActivite = overrideActivite || l.activite;
        const activite = categorizeLineActivity({
            activite: chosenActivite,
            designation: l.designation,
            categorie: l.categorie,
            type_ligne: l.type_ligne,
        });

        const lineIndex = rawLines.length;
        rawLines.push({
            id: l.id || `line-${lineIndex}`,
            designation: l.designation || 'PRESTATION',
            categorie: l.categorie || 'AUTRE',
            typeLigne: l.type_ligne,
            activite,
            isManualActivity: Boolean(chosenActivite),
            sourcePiece,
            statutLigne: l.statut_ligne || 'prevu',
            quantite: qty,
            ca,
            partCost,
            costSource,
            articleStockId: l.article_stock_id || null,
        });

        if (
            partCost > 0 &&
            sourcePiece !== 'fourni_client' &&
            (l.type_ligne === 'article_hors_stock' || l.type_ligne === 'prestation')
        ) {
            coveredExternalRefs.push({
                lineIndex,
                name: normalizeText(l.designation),
                cost: partCost,
                used: false,
            });
        }
    };

    if (
        activeLignesVente.length > 0 &&
        (fin.servicesCost === 0 || Math.abs(activeLignesSum - fin.servicesCost) <= 1)
    ) {
        activeLignesVente.forEach((l) => pushLigneVente(l));
        if (activeLignesSum === 0 && fin.repairCost > 0) {
            rawLines.push({
                id: '__repair_forfait__',
                designation: 'RÉPARATION / PRESTATION (FORFAIT DOSSIER)',
                categorie: 'RÉPARATION',
                typeLigne: 'forfait',
                activite: 'reparation',
                isManualActivity: false,
                sourcePiece: null,
                statutLigne: isTicketCompleted ? 'utilise' : 'prevu',
                quantite: 1,
                ca: fin.repairCost,
                partCost: 0,
                costSource: 'none',
                articleStockId: null,
            });
        }
    } else if (servicesList.length > 0 && fin.servicesCost > 0) {
        const decompiled = decompileServicesToLignesVente(
            servicesList,
            ticket.id,
            ticket.macModel || ''
        );
        decompiled.forEach((dl, idx) => {
            const origSvc = servicesList[idx];
            const matchedLv =
                lvById.get(dl.id) || lvByName.get(normalizeText(dl.designation));
            const enriched: LigneVenteFiche = matchedLv
                ? {
                      ...dl,
                      type_ligne: matchedLv.type_ligne,
                      article_stock_id: matchedLv.article_stock_id,
                      prix_achat: matchedLv.prix_achat,
                      activite: matchedLv.activite || origSvc?.activite,
                      source_piece: matchedLv.source_piece,
                      statut_ligne: matchedLv.statut_ligne,
                  }
                : {
                      ...dl,
                      activite: origSvc?.activite,
                  };
            pushLigneVente(enriched, enriched.activite);
        });
    } else if (fin.repairCost > 0) {
        rawLines.push({
            id: '__repair_forfait__',
            designation: 'RÉPARATION / PRESTATION (FORFAIT DOSSIER)',
            categorie: 'RÉPARATION',
            typeLigne: 'forfait',
            activite: 'reparation',
            isManualActivity: false,
            sourcePiece: null,
            statutLigne: isTicketCompleted ? 'utilise' : 'prevu',
            quantite: 1,
            ca: fin.repairCost,
            partCost: 0,
            costSource: 'none',
            articleStockId: null,
        });
    }

    // Helper pour rattacher un coût pièce non encore déduit à la meilleure ligne (sans double comptage)
    const attachExtraPartCost = (
        hintName: string,
        extraCost: number,
        source: LineCostSource,
        inferredSourcePiece: PartSupplySource
    ) => {
        if (extraCost <= 0) return;
        const normHint = normalizeText(hintName);
        const nonDiagLines = rawLines.filter(
            (r) => r.typeLigne !== 'diagnostic' && r.sourcePiece !== 'fourni_client'
        );

        let target = nonDiagLines.find((r) => {
            const rNorm = normalizeText(r.designation);
            return (
                normHint &&
                (rNorm.includes(normHint) || normHint.includes(rNorm))
            );
        });

        if (!target && nonDiagLines.length === 1) {
            target = nonDiagLines[0];
        }

        if (!target && nonDiagLines.length > 1) {
            const candidates = nonDiagLines
                .filter((r) => r.partCost === 0)
                .sort((a, b) => b.ca - a.ca);
            target =
                candidates[0] ||
                [...nonDiagLines].sort((a, b) => b.ca - a.ca)[0];
        }

        if (target) {
            target.partCost += extraCost;
            if (target.costSource === 'none') {
                target.costSource = source;
            }
            if (!target.sourcePiece) {
                target.sourcePiece = inferredSourcePiece;
            }
        } else {
            rawLines.push({
                id: `__extra_${source}_${rawLines.length}`,
                designation: hintName || 'PIÈCE RATTACHÉE AU DOSSIER',
                categorie: 'PIÈCE',
                typeLigne: inferredSourcePiece === 'en_stock' ? 'article_stock' : 'article_hors_stock',
                activite: 'vente_pieces',
                isManualActivity: false,
                sourcePiece: inferredSourcePiece,
                statutLigne: 'utilise',
                quantite: 1,
                ca: 0,
                partCost: extraCost,
                costSource: source,
                articleStockId: null,
            });
        }
    };

    // 3. Déduction UNIQUE des prélèvements StockUsage (uniquement pour les quantités non couvertes par ligneVentes)
    const ticketUsages = (options.stockUsages || []).filter(
        (u) => u && u.ticket_id === ticket.id
    );
    ticketUsages.forEach((usage) => {
        const uQty = Math.max(0, Number(usage.quantite_utilisee) || 0);
        if (uQty <= 0) return;
        const alreadyCovered = coveredStockQty.get(usage.stock_id) || 0;
        const uncoveredQty = Math.max(0, uQty - alreadyCovered);
        coveredStockQty.set(usage.stock_id, Math.max(0, alreadyCovered - uQty));

        if (uncoveredQty > 0) {
            const stockDef = stockMap.get(usage.stock_id);
            const unitCost = Math.max(0, Number(stockDef?.cost) || 0);
            const extraCost = Math.round(uncoveredQty * unitCost);
            if (extraCost > 0) {
                attachExtraPartCost(
                    usage.stockName || stockDef?.name || 'Pièce stock',
                    extraCost,
                    'stock_usage',
                    'en_stock'
                );
            }
        }
    });

    // 4. Déduction UNIQUE des achats confrères ExternalPurchase (si pas déjà saisi via prix_achat d'une ligne)
    const ticketPurchases = (options.externalPurchases || []).filter(
        (p) => p && p.ticket_id === ticket.id
    );
    ticketPurchases.forEach((purchase) => {
        const extCost = Math.max(0, Math.round(Number(purchase.purchase_price) || 0));
        if (extCost <= 0) return;
        const extName = normalizeText(purchase.item_name);

        const matchIdx = coveredExternalRefs.findIndex(
            (ref) =>
                !ref.used &&
                (Math.abs(ref.cost - extCost) <= 1 ||
                    (extName &&
                        (ref.name.includes(extName) || extName.includes(ref.name))))
        );
        if (matchIdx >= 0) {
            coveredExternalRefs[matchIdx].used = true;
            const matchedLine = rawLines[coveredExternalRefs[matchIdx].lineIndex];
            if (matchedLine) {
                matchedLine.costSource = 'external_purchase';
            }
            return;
        }

        attachExtraPartCost(
            purchase.item_name || 'Achat confrère',
            extCost,
            'external_purchase',
            'a_commander'
        );
    });

    // 5. Répartition exacte du CA réellement encaissé sur les lignes (réconciliation sans écart d'arrondi)
    const forecastTotalCA = rawLines.reduce((s, r) => s + r.ca, 0);
    const targetRealCA = forecastTotalCA > 0 ? Math.min(fin.advanceReceived, forecastTotalCA) : 0;
    const collectionRatio = forecastTotalCA > 0 ? targetRealCA / forecastTotalCA : 0;

    const realCAAllocations: number[] = rawLines.map((rl) => Math.round(rl.ca * collectionRatio));
    const allocatedSum = realCAAllocations.reduce((s, v) => s + v, 0);
    const residual = targetRealCA - allocatedSum;
    if (residual !== 0 && rawLines.length > 0) {
        let bestIdx = -1;
        let maxCA = -1;
        rawLines.forEach((rl, idx) => {
            if (rl.ca > maxCA) {
                maxCA = rl.ca;
                bestIdx = idx;
            }
        });
        if (bestIdx >= 0) {
            realCAAllocations[bestIdx] = Math.max(0, realCAAllocations[bestIdx] + residual);
        }
    }

    // 6. Calcul final (Prévisionnel vs Réel) par ligne et agrégation par activité et dossier
    let plannedOrderCost = 0;
    let enStockCost = 0;
    let fourniClientCount = 0;

    const lines: LineProfitability[] = rawLines.map((rl, idx) => {
        const taxProvision = Math.round(rl.ca * (taxRate / 100));
        const grossMargin = rl.ca - rl.partCost;
        const netMargin = rl.ca - rl.partCost - taxProvision;
        const marginRate = rl.ca > 0 ? (netMargin / rl.ca) * 100 : 0;

        const realCA = realCAAllocations[idx] || 0;
        const realTaxProvision = Math.round(realCA * (taxRate / 100));

        const isEngagedPartCost =
            rl.partCost > 0 &&
            rl.sourcePiece !== 'fourni_client' &&
            (rl.costSource === 'stock_usage' ||
                rl.costSource === 'external_purchase' ||
                rl.sourcePiece === 'en_stock' ||
                rl.statutLigne === 'utilise' ||
                rl.statutLigne === 'reserve' ||
                isTicketCompleted ||
                hasLinkedCommande);

        const realPartCost = isEngagedPartCost ? rl.partCost : 0;
        const isPlannedOrderPending =
            rl.partCost > 0 &&
            rl.sourcePiece === 'a_commander' &&
            !isEngagedPartCost;

        if (rl.sourcePiece === 'fourni_client') fourniClientCount += 1;
        if (rl.sourcePiece === 'en_stock') enStockCost += rl.partCost;
        if (isPlannedOrderPending) plannedOrderCost += rl.partCost;

        const realGrossMargin = realCA - realPartCost;
        const realNetMargin = realCA - realPartCost - realTaxProvision;
        const realMarginRate = realCA > 0 ? (realNetMargin / realCA) * 100 : 0;

        const bucket = emptyByActivity[rl.activite];
        bucket.lineCount += 1;
        bucket.ca += rl.ca;
        bucket.partCost += rl.partCost;
        bucket.taxProvision += taxProvision;
        bucket.grossMargin += grossMargin;
        bucket.netMargin += netMargin;
        bucket.realCA += realCA;
        bucket.realPartCost += realPartCost;
        bucket.realTaxProvision += realTaxProvision;
        bucket.realGrossMargin += realGrossMargin;
        bucket.realNetMargin += realNetMargin;

        return {
            id: rl.id,
            designation: rl.designation,
            categorie: rl.categorie,
            typeLigne: rl.typeLigne,
            activite: rl.activite,
            isManualActivity: rl.isManualActivity,
            sourcePiece: rl.sourcePiece,
            statutLigne: rl.statutLigne,
            quantite: rl.quantite,
            ca: rl.ca,
            partCost: rl.partCost,
            costSource: rl.costSource,
            taxProvision,
            grossMargin,
            netMargin,
            marginRate,
            realCA,
            realPartCost,
            realTaxProvision,
            realGrossMargin,
            realNetMargin,
            realMarginRate,
            isPlannedOrderPending,
        };
    });

    const activitiesPresent: ActivityCategory[] = [];
    ACTIVITY_ORDER.forEach((act) => {
        const b = emptyByActivity[act];
        if (b.lineCount > 0) {
            b.ticketCount = 1;
            b.marginRate = b.ca > 0 ? (b.netMargin / b.ca) * 100 : 0;
            b.realMarginRate = b.realCA > 0 ? (b.realNetMargin / b.realCA) * 100 : 0;
            activitiesPresent.push(act);
        }
    });

    const totalCA = lines.reduce((s, l) => s + l.ca, 0);
    const totalPartCost = lines.reduce((s, l) => s + l.partCost, 0);
    const totalTaxProvision = lines.reduce((s, l) => s + l.taxProvision, 0);
    const grossMargin = totalCA - totalPartCost;
    const netMargin = totalCA - totalPartCost - totalTaxProvision;
    const marginRate = totalCA > 0 ? (netMargin / totalCA) * 100 : 0;

    const realCA = lines.reduce((s, l) => s + l.realCA, 0);
    const realPartCost = lines.reduce((s, l) => s + l.realPartCost, 0);
    const realTaxProvision = lines.reduce((s, l) => s + l.realTaxProvision, 0);
    const realGrossMargin = realCA - realPartCost;
    const realNetMargin = realCA - realPartCost - realTaxProvision;
    const realMarginRate = realCA > 0 ? (realNetMargin / realCA) * 100 : 0;

    let dominantActivity: ActivityCategory = 'reparation';
    if (activitiesPresent.length > 0) {
        dominantActivity = [...activitiesPresent].sort(
            (a, b) => emptyByActivity[b].ca - emptyByActivity[a].ca
        )[0];
    }

    return {
        ticketId: ticket.id,
        isInfacturable: false,
        taxRate,
        collectionRatio,
        totalCA,
        totalPartCost,
        totalTaxProvision,
        grossMargin,
        netMargin,
        marginRate,
        realCA,
        realPartCost,
        realTaxProvision,
        realGrossMargin,
        realNetMargin,
        realMarginRate,
        plannedOrderCost,
        enStockCost,
        fourniClientCount,
        dominantActivity,
        activitiesPresent,
        lines,
        byActivity: emptyByActivity,
    };
};

export interface ComputeFixedChargesOptions {
    fixedCharges?: FixedChargeItem[];
    periodMode: 'jour' | 'semaine' | 'mois' | 'trimestre' | 'semestre' | 'annee' | 'custom' | 'all';
    startDate?: Date | null;
    endDate?: Date | null;
    ticketsForSpan?: RepairTicket[];
}

/**
 * Calcule les charges fixes proratisées sur la période choisie,
 * totalement séparées des marges par activité.
 */
export const computeFixedChargesForPeriod = (
    options: ComputeFixedChargesOptions
): {
    total: number;
    lines: FixedChargePeriodLine[];
    periodFactorLabel: string;
} => {
    const charges = Array.isArray(options.fixedCharges) ? options.fixedCharges : [];

    let monthsEquivalent = 1;
    let periodFactorLabel = 'Base mensuelle (1 mois)';

    switch (options.periodMode) {
        case 'jour':
            monthsEquivalent = 1 / 30;
            periodFactorLabel = 'Prorata journalier (1/30 mois)';
            break;
        case 'semaine':
            monthsEquivalent = 12 / 52;
            periodFactorLabel = 'Prorata hebdomadaire (12/52 mois)';
            break;
        case 'mois':
            monthsEquivalent = 1;
            periodFactorLabel = 'Base mensuelle (1 mois)';
            break;
        case 'trimestre':
            monthsEquivalent = 3;
            periodFactorLabel = 'Base trimestrielle (3 mois)';
            break;
        case 'semestre':
            monthsEquivalent = 6;
            periodFactorLabel = 'Base semestrielle (6 mois)';
            break;
        case 'annee':
            monthsEquivalent = 12;
            periodFactorLabel = 'Base annuelle (12 mois)';
            break;
        case 'custom': {
            if (options.startDate && options.endDate) {
                const diffDays = Math.max(
                    1,
                    Math.round((options.endDate.getTime() - options.startDate.getTime()) / 86400000) + 1
                );
                monthsEquivalent = diffDays / 30;
                periodFactorLabel = `Prorata sur ${diffDays} jour(s)`;
            } else {
                monthsEquivalent = 1;
                periodFactorLabel = 'Base mensuelle';
            }
            break;
        }
        case 'all':
        default: {
            const validTimes = (options.ticketsForSpan || [])
                .map((t) => (t.createdAt ? new Date(t.createdAt).getTime() : NaN))
                .filter((ms) => Number.isFinite(ms));
            if (validTimes.length >= 2) {
                const minMs = Math.min(...validTimes);
                const maxMs = Math.max(...validTimes);
                const spanDays = Math.max(30, Math.round((maxMs - minMs) / 86400000) + 1);
                monthsEquivalent = Math.max(1, spanDays / 30.4375);
                periodFactorLabel = `Prorata historique (${monthsEquivalent.toFixed(1)} mois)`;
            } else {
                monthsEquivalent = 1;
                periodFactorLabel = 'Base mensuelle (1 mois)';
            }
            break;
        }
    }

    const lines: FixedChargePeriodLine[] = charges.map((c) => {
        const baseAmount = Math.max(0, Number(c.amount) || 0);
        if (!c.active) {
            return {
                id: c.id,
                label: c.label,
                category: c.category,
                frequency: c.frequency,
                baseAmount,
                proratedAmount: 0,
                active: false,
                date: c.date,
            };
        }

        let proratedAmount = 0;
        if (c.frequency === 'ponctuel') {
            if (options.periodMode === 'all') {
                proratedAmount = Math.round(baseAmount);
            } else if (c.date && options.startDate && options.endDate) {
                const d = new Date(`${c.date}T12:00:00`);
                if (!isNaN(d.getTime()) && d >= options.startDate && d <= options.endDate) {
                    proratedAmount = Math.round(baseAmount);
                }
            } else if (!options.startDate && !options.endDate) {
                proratedAmount = Math.round(baseAmount);
            }
        } else {
            let monthlyRate = baseAmount;
            if (c.frequency === 'trimestriel') monthlyRate = baseAmount / 3;
            else if (c.frequency === 'annuel') monthlyRate = baseAmount / 12;
            proratedAmount = Math.round(monthlyRate * monthsEquivalent);
        }

        return {
            id: c.id,
            label: c.label,
            category: c.category,
            frequency: c.frequency,
            baseAmount,
            proratedAmount,
            active: true,
            date: c.date,
        };
    });

    const total = lines.reduce((sum, l) => sum + l.proratedAmount, 0);

    return {
        total,
        lines,
        periodFactorLabel,
    };
};

export interface CalculatePortfolioProfitabilityOptions extends CalculateTicketProfitabilityOptions {
    fixedCharges?: FixedChargeItem[];
    periodMode?: ComputeFixedChargesOptions['periodMode'];
    startDate?: Date | null;
    endDate?: Date | null;
}

/**
 * Calcule la rentabilité complète (prévisionnelle et réelle) d'un portefeuille de dossiers :
 * - Par ligne & par dossier
 * - Par activité (Réparation, Vente de pièces, Vente de MacBook)
 * - Charges fixes clairement séparées + Résultat d'exploitation net
 */
export const calculatePortfolioProfitability = (
    tickets: RepairTicket[],
    options: CalculatePortfolioProfitabilityOptions = {}
): PortfolioProfitabilityReport => {
    const taxRate = Math.max(0, Number(options.taxProvisionRate) || 0);
    const byActivity = createEmptyByActivityMap();
    const ticketResults = new Map<string, TicketProfitability>();

    let facturableTicketCount = 0;
    let infacturableTicketCount = 0;
    let totalCA = 0;
    let totalPartCost = 0;
    let totalTaxProvision = 0;
    let totalGrossMargin = 0;
    let totalNetMarginBeforeFixed = 0;

    let totalRealCA = 0;
    let totalRealPartCost = 0;
    let totalRealTaxProvision = 0;
    let totalRealGrossMargin = 0;
    let totalRealNetMarginBeforeFixed = 0;

    let enStockPartCostTotal = 0;
    let aCommanderPartCostTotal = 0;
    let aCommanderPlannedCostTotal = 0;
    let fourniClientLineCount = 0;

    tickets.forEach((ticket) => {
        const res = calculateTicketProfitability(ticket, options);
        ticketResults.set(ticket.id, res);

        if (res.isInfacturable) {
            infacturableTicketCount += 1;
            return;
        }

        facturableTicketCount += 1;
        totalCA += res.totalCA;
        totalPartCost += res.totalPartCost;
        totalTaxProvision += res.totalTaxProvision;
        totalGrossMargin += res.grossMargin;
        totalNetMarginBeforeFixed += res.netMargin;

        totalRealCA += res.realCA;
        totalRealPartCost += res.realPartCost;
        totalRealTaxProvision += res.realTaxProvision;
        totalRealGrossMargin += res.realGrossMargin;
        totalRealNetMarginBeforeFixed += res.realNetMargin;

        res.lines.forEach((l) => {
            if (l.sourcePiece === 'en_stock') enStockPartCostTotal += l.partCost;
            else if (l.sourcePiece === 'a_commander') {
                aCommanderPartCostTotal += l.partCost;
                if (l.isPlannedOrderPending) aCommanderPlannedCostTotal += l.partCost;
            } else if (l.sourcePiece === 'fourni_client') {
                fourniClientLineCount += 1;
            }
        });

        ACTIVITY_ORDER.forEach((act) => {
            const src = res.byActivity[act];
            const dst = byActivity[act];
            if (src.lineCount > 0) {
                dst.lineCount += src.lineCount;
                dst.ticketCount += 1;
                dst.ca += src.ca;
                dst.partCost += src.partCost;
                dst.taxProvision += src.taxProvision;
                dst.grossMargin += src.grossMargin;
                dst.netMargin += src.netMargin;
                dst.realCA += src.realCA;
                dst.realPartCost += src.realPartCost;
                dst.realTaxProvision += src.realTaxProvision;
                dst.realGrossMargin += src.realGrossMargin;
                dst.realNetMargin += src.realNetMargin;
            }
        });
    });

    ACTIVITY_ORDER.forEach((act) => {
        const b = byActivity[act];
        b.marginRate = b.ca > 0 ? (b.netMargin / b.ca) * 100 : 0;
        b.realMarginRate = b.realCA > 0 ? (b.realNetMargin / b.realCA) * 100 : 0;
    });

    const marginRateBeforeFixed =
        totalCA > 0 ? (totalNetMarginBeforeFixed / totalCA) * 100 : 0;
    const realMarginRateBeforeFixed =
        totalRealCA > 0 ? (totalRealNetMarginBeforeFixed / totalRealCA) * 100 : 0;

    const fixed = computeFixedChargesForPeriod({
        fixedCharges: options.fixedCharges,
        periodMode: options.periodMode || 'mois',
        startDate: options.startDate,
        endDate: options.endDate,
        ticketsForSpan: tickets,
    });

    const operatingResultAfterFixed = totalNetMarginBeforeFixed - fixed.total;
    const operatingMarginRateAfterFixed =
        totalCA > 0 ? (operatingResultAfterFixed / totalCA) * 100 : 0;

    const realOperatingResultAfterFixed = totalRealNetMarginBeforeFixed - fixed.total;
    const realOperatingMarginRateAfterFixed =
        totalRealCA > 0 ? (realOperatingResultAfterFixed / totalRealCA) * 100 : 0;

    return {
        taxRate,
        facturableTicketCount,
        infacturableTicketCount,
        totalCA,
        totalPartCost,
        totalTaxProvision,
        totalGrossMargin,
        totalNetMarginBeforeFixed,
        marginRateBeforeFixed,
        totalRealCA,
        totalRealPartCost,
        totalRealTaxProvision,
        totalRealGrossMargin,
        totalRealNetMarginBeforeFixed,
        realMarginRateBeforeFixed,
        enStockPartCostTotal,
        aCommanderPartCostTotal,
        aCommanderPlannedCostTotal,
        fourniClientLineCount,
        byActivity,
        ticketResults,
        fixedChargesTotal: fixed.total,
        fixedChargesLines: fixed.lines,
        fixedChargesPeriodFactorLabel: fixed.periodFactorLabel,
        operatingResultAfterFixed,
        operatingMarginRateAfterFixed,
        realOperatingResultAfterFixed,
        realOperatingMarginRateAfterFixed,
    };
};

export interface WorkshopTreasurySnapshot {
    // Période / Date de démarrage éventuelle
    treasuryStartDate?: string;
    // Capital & Stock (modèle ~2 000 000 F CFA réinvesti progressivement)
    initialCapital: number;
    stockCostValue: number;
    stockSellingValue: number;
    stockQuantityTotal: number;
    effectiveOpeningCash: number;
    isOpeningCashAuto: boolean;
    reinvestmentRate: number;
    totalCurrentCapital: number;
    capitalGrowth: number;
    // Encaissements & Créances (sans double comptage)
    ticketsCashIn: number;
    facturesCashIn: number;
    clientOrdersCashIn: number;
    totalCashIn: number;
    clientReceivables: number;
    // Sorties de caisse réelles (sans double comptage)
    supplierOrdersPaid: number;
    horsStockPartsPaid: number;
    totalCashOut: number;
    // Soldes de trésorerie
    grossCashBalance: number;
    // Réserves dédiées
    fiscalReserveTotal: number;
    fiscalReservePaid: number;
    fiscalReserveRemaining: number;
    reinvestmentReserveTotal: number;
    reinvestmentReserveUsed: number;
    reinvestmentReserveRemaining: number;
    totalReserves: number;
    // Dépenses à payer (Passif court terme, sans double comptage)
    supplierOrdersPayable: number;
    supplierOrdersPayableCount: number;
    plannedPartsToOrderCost: number;
    plannedPartsToOrderCount: number;
    monthlyFixedCharges: number;
    totalPayables: number;
    // Trésorerie disponible (libre)
    treasuryAfterReserves: number;
    availableTreasury: number;
    // Alertes strictement optionnelles (0 blocage)
    enableOptionalAlerts: boolean;
    lowTreasuryThreshold: number;
    isLowTreasuryAlert: boolean;
    lowStockItemsCount: number;
}

export interface CalculateWorkshopTreasuryInput {
    allTickets: RepairTicket[];
    stockItems: StockItem[];
    stockUsages: StockUsage[];
    externalPurchases: ExternalPurchase[];
    commandes: Commande[];
    factures: Facture[];
    settings?: Partial<ProfitabilitySettings>;
}

const isOnOrAfterStartDate = (rawDate?: string | null, startDateStr?: string | null): boolean => {
    const cleanStart = (startDateStr || '').trim();
    if (!cleanStart) return true;
    if (!rawDate) return false;
    const cutoff = new Date(`${cleanStart}T00:00:00.000`).getTime();
    if (!Number.isFinite(cutoff)) return true;

    const trimmed = rawDate.trim();
    const docMs = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
        ? new Date(`${trimmed}T12:00:00.000`).getTime()
        : new Date(trimmed).getTime();
    return Number.isFinite(docMs) && docMs >= cutoff;
};

/**
 * Calcule la trésorerie disponible, les réserves (fiscale + réinvestissement stock),
 * les dépenses à payer et le suivi du capital initial sans aucun double comptage.
 */
export const calculateWorkshopTreasury = (
    input: CalculateWorkshopTreasuryInput
): WorkshopTreasurySnapshot => {
    const cfg = input.settings || {};
    const treasuryStartDate = (cfg.treasuryStartDate || '').trim() || undefined;
    const initialCapital = Math.max(0, Number(cfg.initialCapital ?? 2000000) || 0);
    const reinvestmentRate = Math.max(0, Math.min(100, Number(cfg.reinvestmentRate ?? 0) || 0));
    const taxProvisionRate = Math.max(0, Number(cfg.taxProvisionRate ?? 0) || 0);
    const manualTaxReservePaid = Math.max(0, Number(cfg.manualTaxReservePaid ?? 0) || 0);
    const manualReinvestedUsed = Math.max(0, Number(cfg.manualReinvestedUsed ?? 0) || 0);
    const includeFacturesInTreasury = cfg.includeFacturesInTreasury !== false;
    const enableOptionalAlerts = Boolean(cfg.enableOptionalAlerts);
    const lowTreasuryThreshold = Math.max(0, Number(cfg.lowTreasuryThreshold ?? 0) || 0);

    // 1. Stock actuel en atelier (Zéro blocage même si stock = 0)
    let stockCostValue = 0;
    let stockSellingValue = 0;
    let stockQuantityTotal = 0;
    let lowStockItemsCount = 0;

    (input.stockItems || []).forEach((item) => {
        if (!item || item.isActive === false) return;
        const qty = Math.max(0, Number(item.quantity) || 0);
        const threshold = Math.max(0, Number(item.alertThreshold) || 0);
        if (qty > 0) {
            stockQuantityTotal += qty;
            stockCostValue += Math.round(qty * Math.max(0, Number(item.cost) || 0));
            stockSellingValue += Math.round(qty * Math.max(0, Number(item.sellingPrice) || 0));
        }
        if (enableOptionalAlerts && threshold > 0 && qty <= threshold) {
            lowStockItemsCount += 1;
        }
    });

    const isOpeningCashAuto = cfg.openingCash === undefined || cfg.openingCash === null || Number.isNaN(Number(cfg.openingCash));
    const effectiveOpeningCash = isOpeningCashAuto
        ? Math.max(0, initialCapital - stockCostValue)
        : Number(cfg.openingCash) || 0;

    const stockMap = new Map<string, StockItem>();
    (input.stockItems || []).forEach((s) => {
        if (s && s.id) stockMap.set(s.id, s);
    });

    // 2. Analyse des fiches (encaissements, créances, fiscalité réelle, achats hors-stock engagés vs prévus)
    let ticketsCashIn = 0;
    let clientReceivables = 0;
    let fiscalReserveTotal = 0;
    let totalPositiveRealMargin = 0;
    let horsStockPartsPaid = 0;
    let plannedPartsToOrderCost = 0;
    let plannedPartsToOrderCount = 0;

    (input.allTickets || []).forEach((ticket) => {
        if (!ticket || !ticket.id) return;
        if (!isOnOrAfterStartDate(ticket.createdAt, treasuryStartDate)) return;
        const fin = getTicketFinancialSummary(ticket);
        if (fin.isInfacturable) return;

        ticketsCashIn += fin.advanceReceived;
        clientReceivables += fin.balanceDue;

        const prof = calculateTicketProfitability(ticket, {
            stockMap,
            stockUsages: input.stockUsages,
            externalPurchases: input.externalPurchases,
            taxProvisionRate,
        });

        fiscalReserveTotal += prof.realTaxProvision;
        if (prof.realNetMargin > 0) {
            totalPositiveRealMargin += prof.realNetMargin;
        }

        // Anti-double-comptage : si la fiche est déjà liée à une Commande, le coût fournisseur passe par Commande
        if (!ticket.linkedCommandeId) {
            prof.lines.forEach((line) => {
                // Les pièces 'en_stock' ont déjà été financées par le stock/commandes fournisseurs
                // Les pièces 'fourni_client' coûtent 0 F
                if (line.sourcePiece === 'a_commander' || line.costSource === 'external_purchase') {
                    if (line.realPartCost > 0) {
                        horsStockPartsPaid += line.realPartCost;
                    } else if (line.isPlannedOrderPending && line.partCost > 0) {
                        plannedPartsToOrderCost += line.partCost;
                        plannedPartsToOrderCount += 1;
                    }
                }
            });
        }
    });

    // 3. Factures autonomes et Commandes clients (uniquement non liées aux fiches -> 0 double comptage)
    let facturesCashIn = 0;
    let clientOrdersCashIn = 0;

    if (includeFacturesInTreasury) {
        (input.factures || []).forEach((fac) => {
            if (!fac || fac.status === 'Annulé' || fac.status === 'Brouillon') return;
            if (!isOnOrAfterStartDate(fac.date || fac.updatedAt, treasuryStartDate)) return;
            const total = Math.max(0, Number(fac.total) || 0);
            const adv = Math.max(0, Number(fac.advance) || 0);
            facturesCashIn += fac.status === 'Payé' ? total : Math.min(total, adv);
        });

        (input.commandes || []).forEach((cmd) => {
            if (!cmd || !cmd.isRevenue || cmd.isLinkedToTicket || cmd.status === 'Annulé') return;
            if (!isOnOrAfterStartDate(cmd.date || cmd.updatedAt, treasuryStartDate)) return;
            const total = Math.max(0, Number(cmd.total) || 0);
            const adv = Math.max(0, Number(cmd.advance) || 0);
            clientOrdersCashIn += cmd.status === 'Payé' ? total : Math.min(total, adv);
        });
    }

    // 4. Commandes fournisseurs TGS-CI (!isRevenue) : payées vs à payer
    let supplierOrdersPaid = 0;
    let supplierOrdersPayable = 0;
    let supplierOrdersPayableCount = 0;

    (input.commandes || []).forEach((cmd) => {
        if (!cmd || cmd.isRevenue || cmd.status === 'Annulé') return;
        if (!isOnOrAfterStartDate(cmd.date || cmd.updatedAt, treasuryStartDate)) return;
        const total = Math.max(0, Number(cmd.total) || 0);
        const adv = Math.max(0, Number(cmd.advance) || 0);
        const paid = cmd.status === 'Payé' ? total : Math.min(total, adv);
        const due = cmd.status === 'Payé' ? 0 : Math.max(0, total - adv);
        supplierOrdersPaid += paid;
        if (due > 0) {
            supplierOrdersPayable += due;
            supplierOrdersPayableCount += 1;
        }
    });

    // 5. Charges fixes mensuelles de référence (passif récurrent du mois en cours)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const fixedMonth = computeFixedChargesForPeriod({
        fixedCharges: cfg.fixedCharges,
        periodMode: 'mois',
        startDate: monthStart,
        endDate: monthEnd,
    });
    const monthlyFixedCharges = fixedMonth.total;

    // 6. Synthèse Trésorerie, Réserves, Dépenses à payer & Capital
    const totalCashIn = ticketsCashIn + facturesCashIn + clientOrdersCashIn;
    const totalCashOut = supplierOrdersPaid + horsStockPartsPaid;
    const grossCashBalance = effectiveOpeningCash + totalCashIn - totalCashOut;

    const fiscalReserveRemaining = Math.max(0, fiscalReserveTotal - manualTaxReservePaid);
    const reinvestmentReserveTotal = Math.round(totalPositiveRealMargin * (reinvestmentRate / 100));
    const reinvestmentReserveRemaining = Math.max(0, reinvestmentReserveTotal - manualReinvestedUsed);
    const totalReserves = fiscalReserveRemaining + reinvestmentReserveRemaining;

    const totalPayables = supplierOrdersPayable + plannedPartsToOrderCost + monthlyFixedCharges;

    const treasuryAfterReserves = grossCashBalance - totalReserves;
    const availableTreasury = grossCashBalance - totalReserves - totalPayables;

    const totalCurrentCapital =
        stockCostValue + (grossCashBalance - fiscalReserveRemaining - supplierOrdersPayable);
    const capitalGrowth = totalCurrentCapital - initialCapital;

    const isLowTreasuryAlert =
        enableOptionalAlerts &&
        lowTreasuryThreshold > 0 &&
        availableTreasury < lowTreasuryThreshold;

    return {
        treasuryStartDate,
        initialCapital,
        stockCostValue,
        stockSellingValue,
        stockQuantityTotal,
        effectiveOpeningCash,
        isOpeningCashAuto,
        reinvestmentRate,
        totalCurrentCapital,
        capitalGrowth,
        ticketsCashIn,
        facturesCashIn,
        clientOrdersCashIn,
        totalCashIn,
        clientReceivables,
        supplierOrdersPaid,
        horsStockPartsPaid,
        totalCashOut,
        grossCashBalance,
        fiscalReserveTotal,
        fiscalReservePaid: manualTaxReservePaid,
        fiscalReserveRemaining,
        reinvestmentReserveTotal,
        reinvestmentReserveUsed: manualReinvestedUsed,
        reinvestmentReserveRemaining,
        totalReserves,
        supplierOrdersPayable,
        supplierOrdersPayableCount,
        plannedPartsToOrderCost,
        plannedPartsToOrderCount,
        monthlyFixedCharges,
        totalPayables,
        treasuryAfterReserves,
        availableTreasury,
        enableOptionalAlerts,
        lowTreasuryThreshold,
        isLowTreasuryAlert,
        lowStockItemsCount,
    };
};
