
import { RepairTicket, HistoryEntry, BackupData } from '../types.ts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

export const exportElementToPdf = async (element: HTMLElement, fileName: string) => {
    try {
        // Capture haute définition avec largeur fixée à l'équivalent A4 (794px à 96dpi)
        const canvas = await html2canvas(element, { 
            scale: 2, 
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 794 
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        // Calcul du ratio pour adapter l'image à la largeur de la page A4
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;

        // Ajout de la première page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;

        // Gestion du multi-pages si nécessaire
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pdfHeight;
        }
        
        pdf.save(fileName);
    } catch (error) {
        console.error("Erreur lors de la génération du PDF:", error);
        alert("Impossible de générer le PDF. Vérifiez les permissions de votre navigateur.");
    }
};

// Fix: Correctly implement exportToPdf with proper type casting for jspdf-autotable
export const exportToPdf = (tickets: RepairTicket[], fileName: string) => {
  const doc = new jsPDF() as any;
  const tableColumn = ["ID", "Client", "Modèle", "Statut", "Date"];
  const tableRows = tickets.map(t => [t.id, t.client.name, t.macModel, t.status, new Date(t.createdAt).toLocaleDateString()]);
  doc.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
  doc.text("Archive des fiches de réparation", 14, 15);
  doc.save(fileName);
};

// Fix: Implement missing exportToExcel function for StatisticsDashboard and ExportManager
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

// Fix: Implement missing exportFullDataToExcel function for ExportManager
export const exportFullDataToExcel = (data: BackupData) => {
    const workbook = XLSX.utils.book_new();
    
    // Tickets Sheet
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
    
    // Stock Sheet
    if (data.stock && data.stock.length > 0) {
        const stockSheet = XLSX.utils.json_to_sheet(data.stock);
        XLSX.utils.book_append_sheet(workbook, stockSheet, 'Stock');
    }
    
    // Finance Sheets
    if (data.factures && data.factures.length > 0) {
        const facturesSheet = XLSX.utils.json_to_sheet(data.factures);
        XLSX.utils.book_append_sheet(workbook, facturesSheet, 'Factures');
    }

    XLSX.writeFile(workbook, `export_complet_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// Fix: Implement missing exportCompiledReportToExcel function for StatisticsDashboard
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
    XLSX.writeFile(workbook, `rapport_synthese_${new Date().toISOString().split('T')[0]}.xlsx`);
};
