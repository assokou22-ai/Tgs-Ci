
import { RepairTicket, BackupData } from '../types.ts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { getTicketFinancialSummary } from '../utils/ticketHelpers.ts';
import { ACTIVITY_LABELS, ACTIVITY_ORDER, PART_SOURCE_SHORT_LABELS, PortfolioProfitabilityReport, WorkshopTreasurySnapshot } from '../utils/profitability.ts';

/**
 * Capture un élément HTML et génère un PDF A4 avec une qualité maximale.
 */
export const exportElementToPdf = async (element: HTMLElement, fileName: string) => {
    // S'assurer que toutes les polices du document principal sont bien chargées
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        try {
            await document.fonts.ready;
        } catch {
            // Continuation en cas d'indisponibilité
        }
    }

    // Paramètres de capture ultra-haute fidélité pour une lecture et impression impeccables
    const canvas = await html2canvas(element, { 
        // Netteté A4 ; réduite sur téléphone pour ne pas dépasser la mémoire graphique
        scale: (typeof window !== 'undefined' && (window.AndroidBridge || window.innerWidth < 768)) ? 1.75 : 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794, // Largeur exacte A4 à 96 DPI
        onclone: async (clonedDoc, clonedElement) => {
            // 1. Réinitialiser tout transform: scale sur l'élément et ses ancêtres dans le clone
            if (clonedElement) {
                clonedElement.style.transform = 'none';
                let parent = clonedElement.parentElement;
                while (parent) {
                    if (parent.style && parent.style.transform) {
                        parent.style.transform = 'none';
                    }
                    parent = parent.parentElement;
                }
            }

            // 2. S'assurer que tous les éléments images sont bien affichés
            const images = clonedDoc.getElementsByTagName('img');
            for (let i = 0; i < images.length; i++) {
                images[i].style.display = 'block';
            }

            // 3. Injecter des règles CSS strictes pour garantir des espaces normaux entre les mots
            // et éviter tout écrasement ou chevauchement de texte dans le moteur html2canvas
            const style = clonedDoc.createElement('style');
            style.textContent = `
                * {
                    letter-spacing: 0.02em !important;
                    word-spacing: normal !important;
                    text-rendering: geometricPrecision !important;
                    -webkit-font-smoothing: antialiased !important;
                }
                .printable-page, .printable-page * {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                    letter-spacing: 0.02em !important;
                    word-spacing: normal !important;
                }
            `;
            clonedDoc.head.appendChild(style);

            // 4. Attendre la résolution des polices dans l'iframe clonée
            if (clonedDoc.fonts && clonedDoc.fonts.ready) {
                try {
                    await clonedDoc.fonts.ready;
                } catch {
                    // ignore
                }
            }
        }
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0); // Qualité JPEG maximale
    const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    // Page 1
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'SLOW');
    heightLeft -= pdfHeight;

    // Découpage multipage intelligent (seuil de 2mm pour éviter les pages blanches résiduelles)
    while (heightLeft > 2) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'SLOW');
        heightLeft -= pdfHeight;
    }
    
    pdf.save(fileName);
};

export const exportToPdf = (tickets: RepairTicket[], fileName: string) => {
  const doc = new jsPDF();
  const tableColumn = ["ID", "Client", "Modèle", "Statut", "Date"];
  const tableRows = tickets.map(t => [t.id, t.client.name, t.macModel, t.status, new Date(t.createdAt).toLocaleDateString()]);
  (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({ 
    head: [tableColumn], 
    body: tableRows, 
    startY: 20,
    styles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 }
  });
  doc.text("Archive des fiches de réparation TGS-CI", 14, 15);
  doc.save(fileName);
};

export const exportToExcel = (tickets: RepairTicket[], fileName: string) => {
    const data = tickets.map(t => {
        const fin = getTicketFinancialSummary(t);
        return {
            ID: t.id,
            Date: new Date(t.createdAt).toLocaleDateString('fr-FR'),
            Client: t.client.name,
            Telephone: t.client.phone,
            Modèle: t.macModel,
            Statut: t.status,
            'Facturable (Point)': fin.isInfacturable ? 'INFACTURABLE' : 'Facturable',
            'Frais Diag (F)': fin.isInfacturable ? 0 : t.costs.diagnostic,
            'Frais Rép (F)': fin.isInfacturable ? 0 : fin.repairCost,
            'Avance (F)': fin.advanceReceived,
            'Total (F)': fin.totalBilled,
            'Solde (F)': fin.balanceDue,
            'Observation Comptable': fin.isInfacturable 
                ? (fin.rawAdvanceReceived > 0 
                    ? `Fiche annulée : avance de ${fin.rawAdvanceReceived.toLocaleString('fr-FR')} F CFA non intégrable au point` 
                    : 'Fiche annulée : infacturable (aucun fond intégrable)')
                : ''
        };
    });
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fiches de Réparation');
    XLSX.writeFile(workbook, fileName);
};

export const exportFullDataToExcel = (data: BackupData) => {
    const workbook = XLSX.utils.book_new();
    const ticketsData = data.tickets.map(t => {
        const fin = getTicketFinancialSummary(t);
        return {
            ID: t.id,
            Date: new Date(t.createdAt).toLocaleDateString('fr-FR'),
            Client: t.client.name,
            Modèle: t.macModel,
            Statut: t.status,
            'Facturable (Point)': fin.isInfacturable ? 'INFACTURABLE' : 'Facturable',
            Total: fin.totalBilled,
            Avance: fin.advanceReceived,
            Solde: fin.balanceDue
        };
    });
    const ticketsSheet = XLSX.utils.json_to_sheet(ticketsData);
    XLSX.utils.book_append_sheet(workbook, ticketsSheet, 'Fiches');
    
    if (data.stock && data.stock.length > 0) {
        const stockSheet = XLSX.utils.json_to_sheet(data.stock);
        XLSX.utils.book_append_sheet(workbook, stockSheet, 'Stock');
    }
    
    if (data.factures && data.factures.length > 0) {
        const facturesSheet = XLSX.utils.json_to_sheet(data.factures);
        XLSX.utils.book_append_sheet(workbook, facturesSheet, 'Factures');
    }

    XLSX.writeFile(workbook, `TGS_EXPORT_COMPLET_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportCompiledReportToExcel = (tickets: RepairTicket[]) => {
    const data = tickets.map(t => {
        const fin = getTicketFinancialSummary(t);
        return {
            ID: t.id,
            Client: t.client.name,
            Modèle: t.macModel,
            Statut: t.status,
            'Régime Point': fin.isInfacturable ? 'INFACTURABLE' : 'Facturable',
            'Frais Diagnostic': fin.isInfacturable ? 0 : t.costs.diagnostic,
            'Frais Réparation': fin.isInfacturable ? 0 : fin.repairCost,
            'Total Dossier': fin.totalBilled,
            'Acompte': fin.advanceReceived,
            'Reste à Payer': fin.balanceDue,
            'Date Entrée': new Date(t.createdAt).toLocaleDateString('fr-FR'),
            'Note Comptabilité': fin.isInfacturable ? (fin.infacturableNotice || 'Fiche annulée infacturable') : ''
        };
    });
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rapport Synthétique');
    XLSX.writeFile(workbook, `TGS_RAPPORT_SYNTHESE_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export interface FinancialPointMetrics {
    totalBilled: number;
    totalAdvance: number;
    totalBalanceDue: number;
    facturablesCount: number;
    infacturablesCount: number;
    paidCount: number;
    withBalanceCount: number;
    collectionRate: number;
    totalCount: number;
}

/**
 * Export Excel officiel et complet du point financier des fiches d'atelier
 * avec période personnalisée (semaine, mois, année, semestre, trimestre, de date à date).
 */
export const exportTicketFinancialPointToExcel = (
    tickets: RepairTicket[],
    periodLabel: string,
    metrics: FinancialPointMetrics,
    fileName?: string,
    profitability?: PortfolioProfitabilityReport,
    treasury?: WorkshopTreasurySnapshot
) => {
    // 1. Synthèse générale en en-tête
    const summaryData = [
        { Paramètre: "ORGANISME", Valeur: "TGS - CÔTE D'IVOIRE (Atelier MacBook)" },
        { Paramètre: "DOCUMENT", Valeur: "POINT FINANCIER D'ATELIER (FICHES DE RÉPARATION)" },
        { Paramètre: "PÉRIODE DU POINT", Valeur: periodLabel },
        { Paramètre: "DATE D'EXTRACTION", Valeur: new Date().toLocaleString('fr-FR') },
        { Paramètre: "TOTAL MONTANTS FACTURÉS", Valeur: `${metrics.totalBilled.toLocaleString('fr-FR')} F CFA` },
        { Paramètre: "TOTAL ACOMPTES PERÇUS (CAISSE)", Valeur: `${metrics.totalAdvance.toLocaleString('fr-FR')} F CFA` },
        { Paramètre: "TOTAL RESTANT DÛ (CRÉANCES)", Valeur: `${metrics.totalBalanceDue.toLocaleString('fr-FR')} F CFA` },
        { Paramètre: "TAUX D'ENCAISSEMENT", Valeur: `${metrics.collectionRate}%` },
        { Paramètre: "VOLUME TOTAL FICHES", Valeur: `${metrics.totalCount} (Facturables: ${metrics.facturablesCount}, Infacturables: ${metrics.infacturablesCount})` },
        { Paramètre: "RÈGLE COMPTABLE APPLIQUÉE", Valeur: "Fiches annulées : 0 F au point financier (aucun fond intégrable)" },
        ...(profitability ? [
            { Paramètre: "COÛT PIÈCES DÉDUIT (1x)", Valeur: `${profitability.totalPartCost.toLocaleString('fr-FR')} F CFA (En stock: ${profitability.enStockPartCostTotal.toLocaleString('fr-FR')} F | À cmd: ${profitability.aCommanderPartCostTotal.toLocaleString('fr-FR')} F)` },
            { Paramètre: `PROVISION FISCALE PRÉV. / RÉELLE (${profitability.taxRate}%)`, Valeur: `${profitability.totalTaxProvision.toLocaleString('fr-FR')} F / ${profitability.totalRealTaxProvision.toLocaleString('fr-FR')} F CFA` },
            { Paramètre: "MARGE NETTE PRÉVISIONNELLE (AVANT CHARGES FIXES)", Valeur: `${profitability.totalNetMarginBeforeFixed.toLocaleString('fr-FR')} F CFA (${profitability.marginRateBeforeFixed.toFixed(1)}%)` },
            { Paramètre: "MARGE NETTE RÉELLE ENCAISSÉE (AVANT CHARGES FIXES)", Valeur: `${profitability.totalRealNetMarginBeforeFixed.toLocaleString('fr-FR')} F CFA (${profitability.realMarginRateBeforeFixed.toFixed(1)}%)` },
            { Paramètre: `CHARGES FIXES SÉPARÉES (${profitability.fixedChargesPeriodFactorLabel})`, Valeur: `${profitability.fixedChargesTotal.toLocaleString('fr-FR')} F CFA` },
            { Paramètre: "RÉSULTAT D'EXPLOITATION PRÉVISIONNEL", Valeur: `${profitability.operatingResultAfterFixed.toLocaleString('fr-FR')} F CFA` },
            { Paramètre: "RÉSULTAT D'EXPLOITATION RÉEL", Valeur: `${profitability.realOperatingResultAfterFixed.toLocaleString('fr-FR')} F CFA` },
        ] : []),
        ...(treasury ? [
            { Paramètre: "CAPITAL INITIAL / CAPITAL ACTUEL", Valeur: `${treasury.initialCapital.toLocaleString('fr-FR')} F / ${treasury.totalCurrentCapital.toLocaleString('fr-FR')} F CFA` },
            { Paramètre: "TRÉSORERIE DISPONIBLE NETTE (SANS DOUBLE COMPTAGE)", Valeur: `${treasury.availableTreasury.toLocaleString('fr-FR')} F CFA (Caisse brute: ${treasury.grossCashBalance.toLocaleString('fr-FR')} F)` },
            { Paramètre: "RÉSERVES DÉDIÉES (FISC + RÉINVEST. STOCK)", Valeur: `${treasury.totalReserves.toLocaleString('fr-FR')} F CFA` },
            { Paramètre: "DÉPENSES À PAYER (PASSIF COURT TERME)", Valeur: `${treasury.totalPayables.toLocaleString('fr-FR')} F CFA` },
        ] : [])
    ];

    // 2. Lignes détaillées de chaque fiche
    const rowsData = tickets.map((t, index) => {
        const fin = getTicketFinancialSummary(t);
        const prof = profitability?.ticketResults.get(t.id);
        const dateCreation = t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : 'N/A';
        const dateMaj = t.updatedAt ? new Date(t.updatedAt).toLocaleDateString('fr-FR') : 'N/A';

        let statutPaiement = "Non défini";
        if (fin.isInfacturable) {
            statutPaiement = "ANNULÉ / INFACTURABLE (0 F)";
        } else if (fin.isFullyPaid) {
            statutPaiement = "SOLDÉ (100% payé)";
        } else if (fin.advanceReceived > 0) {
            statutPaiement = "ACOMPTE VERSÉ (Solde en attente)";
        } else {
            statutPaiement = "NON ENCAISSÉ (Solde intégral)";
        }

        return {
            'N°': index + 1,
            'N° FICHE': `#${t.id}`,
            'DATE ENTRÉE': dateCreation,
            'DERNIÈRE MAJ': dateMaj,
            'CLIENT': t.client?.name || 'Client',
            'CONTACT': t.client?.phone || 'N/A',
            'ENTREPRISE': t.client?.isEnterprise ? 'OUI' : 'NON',
            'MODÈLE MAC': t.macModel || 'MacBook',
            'STATUT ATELIER': t.status,
            'RÉGIME POINT': fin.isInfacturable ? 'INFACTURABLE' : 'FACTURABLE',
            'FRAIS DIAG (F CFA)': fin.isInfacturable ? 0 : fin.diagnosticCost,
            'FRAIS RÉPARATION (F CFA)': fin.isInfacturable ? 0 : fin.repairCost,
            'TOTAL FACTURÉ (F CFA)': fin.isInfacturable ? 0 : fin.totalBilled,
            'ACOMPTE ENCAISSÉ (F CFA)': fin.isInfacturable ? 0 : fin.advanceReceived,
            'SOLDE RESTANT DÛ (F CFA)': fin.isInfacturable ? 0 : fin.balanceDue,
            ...(profitability ? {
                'ACTIVITÉ(S)': fin.isInfacturable ? 'INFACTURABLE' : (prof?.activitiesPresent.map(a => ACTIVITY_LABELS[a]).join(', ') || 'Réparation'),
                'COÛT PIÈCES 1X (F CFA)': fin.isInfacturable ? 0 : (prof?.totalPartCost || 0),
                'PROVISION FISCALE (F CFA)': fin.isInfacturable ? 0 : (prof?.totalTaxProvision || 0),
                'MARGE PRÉVISIONNELLE (F CFA)': fin.isInfacturable ? 0 : (prof?.netMargin || 0),
                'MARGE RÉELLE ENCAISSÉE (F CFA)': fin.isInfacturable ? 0 : (prof?.realNetMargin || 0),
            } : {}),
            'ÉTAT RÈGLEMENT': statutPaiement,
            'OBSERVATION COMPTABLE': fin.isInfacturable
                ? (fin.rawAdvanceReceived > 0 
                    ? `Fiche annulée : avance de ${fin.rawAdvanceReceived.toLocaleString('fr-FR')} F isolée hors point`
                    : 'Fiche annulée : infacturable (0 F CFA au point)')
                : (fin.balanceDue > 0 ? `Reste à percevoir au retrait : ${fin.balanceDue.toLocaleString('fr-FR')} F` : 'Dossier soldé')
        };
    });

    // 3. Ligne de total
    const totalRow = {
        'N°': 'TOTAL',
        'N° FICHE': `TOTAL (${metrics.facturablesCount} facturables)`,
        'DATE ENTRÉE': '',
        'DERNIÈRE MAJ': '',
        'CLIENT': '',
        'CONTACT': '',
        'ENTREPRISE': '',
        'MODÈLE MAC': '',
        'STATUT ATELIER': '',
        'RÉGIME POINT': '',
        'FRAIS DIAG (F CFA)': tickets.reduce((s, t) => s + (getTicketFinancialSummary(t).isInfacturable ? 0 : getTicketFinancialSummary(t).diagnosticCost), 0),
        'FRAIS RÉPARATION (F CFA)': tickets.reduce((s, t) => s + (getTicketFinancialSummary(t).isInfacturable ? 0 : getTicketFinancialSummary(t).repairCost), 0),
        'TOTAL FACTURÉ (F CFA)': metrics.totalBilled,
        'ACOMPTE ENCAISSÉ (F CFA)': metrics.totalAdvance,
        'SOLDE RESTANT DÛ (F CFA)': metrics.totalBalanceDue,
        ...(profitability ? {
            'ACTIVITÉ(S)': 'TOUTES ACTIVITÉS',
            'COÛT PIÈCES 1X (F CFA)': profitability.totalPartCost,
            'PROVISION FISCALE (F CFA)': profitability.totalTaxProvision,
            'MARGE PRÉVISIONNELLE (F CFA)': profitability.totalNetMarginBeforeFixed,
            'MARGE RÉELLE ENCAISSÉE (F CFA)': profitability.totalRealNetMarginBeforeFixed,
        } : {}),
        'ÉTAT RÈGLEMENT': `Taux d'encaissement : ${metrics.collectionRate}%`,
        'OBSERVATION COMPTABLE': `${metrics.paidCount} soldée(s), ${metrics.withBalanceCount} avec solde dû, ${metrics.infacturablesCount} infacturable(s)`
    };

    rowsData.push(totalRow as unknown as (typeof rowsData)[0]);

    const workbook = XLSX.utils.book_new();

    // Feuille 1: Synthèse
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Synthèse Point');

    // Feuille 2: Détail par fiche
    const rowsSheet = XLSX.utils.json_to_sheet(rowsData);
    XLSX.utils.book_append_sheet(workbook, rowsSheet, 'Détail Dossiers');

    if (profitability) {
        // Feuille 3: Rentabilité par Activité (Prévisionnelle vs Réelle)
        const activityRows = ACTIVITY_ORDER.map(act => {
            const b = profitability.byActivity[act];
            return {
                'ACTIVITÉ': b.label,
                'DOSSIERS CONCERNÉS': b.ticketCount,
                'LIGNES': b.lineCount,
                'CA FACTURÉ (F CFA)': b.ca,
                'CA ENCAISSÉ RÉEL (F CFA)': b.realCA,
                'COÛT PIÈCES 1X (F CFA)': b.partCost,
                [`PROVISION FISCALE ${profitability.taxRate}% (F CFA)`]: b.taxProvision,
                'MARGE PRÉVISIONNELLE (F CFA)': b.netMargin,
                'TAUX PRÉV. (%)': `${b.marginRate.toFixed(1)}%`,
                'MARGE RÉELLE ENCAISSÉE (F CFA)': b.realNetMargin,
                'TAUX RÉEL (%)': `${b.realMarginRate.toFixed(1)}%`
            };
        });
        activityRows.push({
            'ACTIVITÉ': 'TOTAL ACTIVITÉS (AVANT CHARGES FIXES)',
            'DOSSIERS CONCERNÉS': profitability.facturableTicketCount,
            'LIGNES': ACTIVITY_ORDER.reduce((s, a) => s + profitability.byActivity[a].lineCount, 0),
            'CA FACTURÉ (F CFA)': profitability.totalCA,
            'CA ENCAISSÉ RÉEL (F CFA)': profitability.totalRealCA,
            'COÛT PIÈCES 1X (F CFA)': profitability.totalPartCost,
            [`PROVISION FISCALE ${profitability.taxRate}% (F CFA)`]: profitability.totalTaxProvision,
            'MARGE PRÉVISIONNELLE (F CFA)': profitability.totalNetMarginBeforeFixed,
            'TAUX PRÉV. (%)': `${profitability.marginRateBeforeFixed.toFixed(1)}%`,
            'MARGE RÉELLE ENCAISSÉE (F CFA)': profitability.totalRealNetMarginBeforeFixed,
            'TAUX RÉEL (%)': `${profitability.realMarginRateBeforeFixed.toFixed(1)}%`
        });
        const activitySheet = XLSX.utils.json_to_sheet(activityRows);
        XLSX.utils.book_append_sheet(workbook, activitySheet, 'Rentabilité Activités');

        // Feuille 4: Détail Ligne par Ligne
        const lineRows: Array<Record<string, string | number>> = [];
        tickets.forEach(t => {
            const prof = profitability.ticketResults.get(t.id);
            if (!prof || prof.isInfacturable) return;
            prof.lines.forEach(line => {
                lineRows.push({
                    'N° FICHE': `#${t.id}`,
                    'CLIENT': t.client?.name || 'Client',
                    'DÉSIGNATION LIGNE': line.designation,
                    'ACTIVITÉ': ACTIVITY_LABELS[line.activite],
                    'ORIGINE PIÈCE': line.sourcePiece ? PART_SOURCE_SHORT_LABELS[line.sourcePiece] : 'Main d\'œuvre',
                    'QTÉ': line.quantite,
                    'CA FACTURÉ (F CFA)': line.ca,
                    'CA ENCAISSÉ (F CFA)': line.realCA,
                    'COÛT PIÈCES 1X (F CFA)': line.partCost,
                    'PROVISION FISCALE (F CFA)': line.taxProvision,
                    'MARGE PRÉVISIONNELLE (F CFA)': line.netMargin,
                    'MARGE RÉELLE (F CFA)': line.realNetMargin,
                    'TAUX MARGE PRÉV. (%)': `${line.marginRate.toFixed(1)}%`
                });
            });
        });
        if (lineRows.length > 0) {
            const linesSheet = XLSX.utils.json_to_sheet(lineRows);
            XLSX.utils.book_append_sheet(workbook, linesSheet, 'Détail Lignes');
        }

        // Feuille 5: Charges Fixes (séparées)
        if (profitability.fixedChargesLines.length > 0) {
            const chargeRows = profitability.fixedChargesLines.map(c => ({
                'LIBELLÉ CHARGE FIXE': c.label,
                'CATÉGORIE': c.category || 'Général',
                'PÉRIODICITÉ': c.frequency.toUpperCase(),
                'MONTANT DE BASE (F CFA)': c.baseAmount,
                'MONTANT PRORATISÉ PÉRIODE (F CFA)': c.proratedAmount,
                'STATUT': c.active ? 'ACTIVE' : 'INACTIVE'
            }));
            chargeRows.push({
                'LIBELLÉ CHARGE FIXE': `TOTAL CHARGES FIXES (${profitability.fixedChargesPeriodFactorLabel})`,
                'CATÉGORIE': '',
                'PÉRIODICITÉ': '',
                'MONTANT DE BASE (F CFA)': 0,
                'MONTANT PRORATISÉ PÉRIODE (F CFA)': profitability.fixedChargesTotal,
                'STATUT': ''
            });
            const chargesSheet = XLSX.utils.json_to_sheet(chargeRows);
            XLSX.utils.book_append_sheet(workbook, chargesSheet, 'Charges Fixes');
        }
    }

    if (treasury) {
        // Feuille 6: Trésorerie, Réserves, Passif à Payer & Capital Atelier
        const treasuryRows = [
            { RUBRIQUE: 'CAPITAL & STOCK', INDICATEUR: 'Capital initial atelier', VALEUR_F_CFA: treasury.initialCapital },
            { RUBRIQUE: 'CAPITAL & STOCK', INDICATEUR: `Stock actuel au coût d'achat (${treasury.stockQuantityTotal} unités)`, VALEUR_F_CFA: treasury.stockCostValue },
            { RUBRIQUE: 'CAPITAL & STOCK', INDICATEUR: 'Valeur vente estimée du stock', VALEUR_F_CFA: treasury.stockSellingValue },
            { RUBRIQUE: 'CAPITAL & STOCK', INDICATEUR: `Trésorerie de départ (${treasury.isOpeningCashAuto ? 'Auto = Capital - Stock' : 'Manuelle'})`, VALEUR_F_CFA: treasury.effectiveOpeningCash },
            { RUBRIQUE: 'CAPITAL & STOCK', INDICATEUR: 'Capital actuel net (Stock + Cash Net)', VALEUR_F_CFA: treasury.totalCurrentCapital },
            { RUBRIQUE: 'CAPITAL & STOCK', INDICATEUR: 'Évolution du capital depuis ouverture', VALEUR_F_CFA: treasury.capitalGrowth },
            { RUBRIQUE: 'FLUX CAISSE (0 DOUBLE COMPTAGE)', INDICATEUR: 'Encaissements fiches atelier', VALEUR_F_CFA: treasury.ticketsCashIn },
            { RUBRIQUE: 'FLUX CAISSE (0 DOUBLE COMPTAGE)', INDICATEUR: 'Encaissements factures autonomes', VALEUR_F_CFA: treasury.facturesCashIn },
            { RUBRIQUE: 'FLUX CAISSE (0 DOUBLE COMPTAGE)', INDICATEUR: 'Encaissements commandes clients directes', VALEUR_F_CFA: treasury.clientOrdersCashIn },
            { RUBRIQUE: 'FLUX CAISSE (0 DOUBLE COMPTAGE)', INDICATEUR: 'Commandes fournisseurs déjà payées', VALEUR_F_CFA: -treasury.supplierOrdersPaid },
            { RUBRIQUE: 'FLUX CAISSE (0 DOUBLE COMPTAGE)', INDICATEUR: 'Achats hors-stock engagés (non liés commande)', VALEUR_F_CFA: -treasury.horsStockPartsPaid },
            { RUBRIQUE: 'FLUX CAISSE (0 DOUBLE COMPTAGE)', INDICATEUR: 'Solde caisse brut', VALEUR_F_CFA: treasury.grossCashBalance },
            { RUBRIQUE: 'RÉSERVES DÉDIÉES', INDICATEUR: 'Réserve fiscale restante', VALEUR_F_CFA: treasury.fiscalReserveRemaining },
            { RUBRIQUE: 'RÉSERVES DÉDIÉES', INDICATEUR: `Réserve réinvestissement stock (${treasury.reinvestmentRate}%) restante`, VALEUR_F_CFA: treasury.reinvestmentReserveRemaining },
            { RUBRIQUE: 'RÉSERVES DÉDIÉES', INDICATEUR: 'Total réserves dédiées', VALEUR_F_CFA: treasury.totalReserves },
            { RUBRIQUE: 'DÉPENSES À PAYER (PASSIF)', INDICATEUR: `Commandes fournisseurs à solder (${treasury.supplierOrdersPayableCount})`, VALEUR_F_CFA: treasury.supplierOrdersPayable },
            { RUBRIQUE: 'DÉPENSES À PAYER (PASSIF)', INDICATEUR: `Pièces marquées À commander prévues (${treasury.plannedPartsToOrderCount})`, VALEUR_F_CFA: treasury.plannedPartsToOrderCost },
            { RUBRIQUE: 'DÉPENSES À PAYER (PASSIF)', INDICATEUR: 'Charges fixes mensuelles de référence', VALEUR_F_CFA: treasury.monthlyFixedCharges },
            { RUBRIQUE: 'DÉPENSES À PAYER (PASSIF)', INDICATEUR: 'Total dépenses à payer', VALEUR_F_CFA: treasury.totalPayables },
            { RUBRIQUE: 'DISPONIBILITÉ', INDICATEUR: 'Trésorerie après réserves', VALEUR_F_CFA: treasury.treasuryAfterReserves },
            { RUBRIQUE: 'DISPONIBILITÉ', INDICATEUR: 'Trésorerie disponible nette (libre)', VALEUR_F_CFA: treasury.availableTreasury },
            { RUBRIQUE: 'CRÉANCES', INDICATEUR: 'Solde client restant à encaisser', VALEUR_F_CFA: treasury.clientReceivables },
        ];
        const treasurySheet = XLSX.utils.json_to_sheet(treasuryRows);
        XLSX.utils.book_append_sheet(workbook, treasurySheet, 'Trésorerie & Capital');
    }

    const cleanFileName = fileName || `POINT_FINANCIER_TGS_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, cleanFileName);
};


