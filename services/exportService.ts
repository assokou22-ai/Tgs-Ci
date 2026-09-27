
import { RepairTicket, BackupData } from '../types.ts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

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
    const data = tickets.map(t => ({
        ID: t.id,
        Date: new Date(t.createdAt).toLocaleDateString('fr-FR'),
        Client: t.client.name,
        Telephone: t.client.phone,
        Modèle: t.macModel,
        Statut: t.status,
        'Frais Diag (F)': t.costs.diagnostic,
        'Frais Rép (F)': t.costs.repair,
        'Avance (F)': t.costs.advance,
        'Total (F)': (t.costs.diagnostic || 0) + (t.costs.repair || 0),
        'Solde (F)': ((t.costs.diagnostic || 0) + (t.costs.repair || 0)) - (t.costs.advance || 0)
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fiches de Réparation');
    XLSX.writeFile(workbook, fileName);
};

export const exportFullDataToExcel = (data: BackupData) => {
    const workbook = XLSX.utils.book_new();
    const ticketsData = data.tickets.map(t => ({
        ID: t.id,
        Date: new Date(t.createdAt).toLocaleDateString('fr-FR'),
        Client: t.client.name,
        Modèle: t.macModel,
        Statut: t.status,
        Total: (t.costs.diagnostic || 0) + (t.costs.repair || 0)
    }));
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
    const data = tickets.map(t => ({
        ID: t.id,
        Client: t.client.name,
        Modèle: t.macModel,
        Statut: t.status,
        'Frais Diagnostic': t.costs.diagnostic,
        'Frais Réparation': t.costs.repair,
        'Total Dossier': (t.costs.diagnostic || 0) + (t.costs.repair || 0),
        'Acompte': t.costs.advance,
        'Reste à Payer': ((t.costs.diagnostic || 0) + (t.costs.repair || 0)) - (t.costs.advance || 0),
        'Date Entrée': new Date(t.createdAt).toLocaleDateString('fr-FR')
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rapport Synthétique');
    XLSX.writeFile(workbook, `TGS_RAPPORT_SYNTHESE_${new Date().toISOString().split('T')[0]}.xlsx`);
};
