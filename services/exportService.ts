
import { RepairTicket, BackupData } from '../types.ts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { getTicketFinancialSummary } from '../utils/ticketHelpers.ts';

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
        scale: 2.5, // Netteté texte ultra-précise sur papier A4
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
    fileName?: string
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
        { Paramètre: "RÈGLE COMPTABLE APPLIQUÉE", Valeur: "Fiches annulées : 0 F au point financier (aucun fond intégrable)" }
    ];

    // 2. Lignes détaillées de chaque fiche
    const rowsData = tickets.map((t, index) => {
        const fin = getTicketFinancialSummary(t);
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
    XLSX.utils.book_append_sheet(workbook, rowsSheet, 'Détail Ligne par Ligne');

    const cleanFileName = fileName || `POINT_FINANCIER_TGS_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, cleanFileName);
};

