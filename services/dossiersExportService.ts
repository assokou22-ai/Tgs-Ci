import JSZip from 'jszip';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { RepairTicket, PaymentEntry } from '../types.ts';
import { dbGetTickets } from './dbService.ts';
import { getTicketFinancialSummary } from '../utils/ticketHelpers.ts';

export interface ExportProgress {
    totalTickets: number;
    currentTicketIndex: number;
    currentTicketId: string;
    stage: 'preparing' | 'processing' | 'zipping' | 'downloading' | 'completed' | 'partial' | 'failed';
    percent: number;
    message: string;
    warningCount: number;
    warnings: string[];
    generatedParts: { fileName: string; sizeBytes: number; blob: Blob }[];
}

export type ExportProgressCallback = (progress: ExportProgress) => void;

/**
 * Nettoie les chaînes pour éviter tout crash dans jsPDF avec des caractères rares ou emojis
 */
const cleanPdfText = (text: string | undefined | null): string => {
    if (!text) return '';
    return text
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .trim();
};

/**
 * Sécurise un ID de dossier pour le nommage des répertoires ZIP
 */
const sanitizeFolderId = (id: string): string => {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_').trim() || 'DOSSIER_INCONNU';
};

/**
 * Décode une DataURL base64 en Uint8Array binaire
 */
const parseDataUrl = (dataUrl: string): { mime: string; data: Uint8Array; extension: string } => {
    const parts = dataUrl.split(',');
    const match = parts[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'application/octet-stream';
    const base64Data = parts[1] || '';
    
    const raw = atob(base64Data);
    const data = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        data[i] = raw.charCodeAt(i);
    }

    let extension = 'jpg';
    if (mime.includes('png')) extension = 'png';
    else if (mime.includes('webp')) extension = 'webp';
    else if (mime.includes('gif')) extension = 'gif';
    else if (mime.includes('pdf')) extension = 'pdf';
    else if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';

    return { mime, data, extension };
};

/**
 * Récupère une ressource URL ou DataURL sous forme de binaire Uint8Array
 */
const fetchResourceAsBinary = async (
    urlOrData: string
): Promise<{ data: Uint8Array; extension: string } | null> => {
    if (!urlOrData || typeof urlOrData !== 'string') return null;

    if (urlOrData.startsWith('data:')) {
        try {
            const parsed = parseDataUrl(urlOrData);
            return { data: parsed.data, extension: parsed.extension };
        } catch {
            return null;
        }
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(urlOrData, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) return null;
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();

        let extension = 'jpg';
        if (blob.type.includes('png')) extension = 'png';
        else if (blob.type.includes('webp')) extension = 'webp';
        else if (blob.type.includes('pdf')) extension = 'pdf';
        else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) extension = 'jpg';
        else {
            const matchExt = urlOrData.match(/\.(jpg|jpeg|png|webp|pdf)($|\?)/i);
            if (matchExt) extension = matchExt[1].toLowerCase().replace('jpeg', 'jpg');
        }

        return { data: new Uint8Array(buffer), extension };
    } catch {
        return null;
    }
};

/**
 * Échappement HTML sécurisé
 */
const escapeHtml = (str: unknown): string => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Génère le fichier PDF complet et détaillé pour un dossier de réparation
 */
export const generateTicketPdf = (ticket: RepairTicket): ArrayBuffer => {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const fin = getTicketFinancialSummary(ticket);
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 16;

    // En-tête officiel
    doc.setFillColor(15, 23, 42); // Fond sombre ardoise
    doc.rect(14, currentY, pageWidth - 28, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('TGS-CI REPAIR MANAGEMENT — ATELIER SPÉCIALISÉ', 18, currentY + 8);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fiche Technique & Dossier Complet : N° ${cleanPdfText(ticket.id)}`, 18, currentY + 14);
    doc.text(`Émis le : ${new Date(ticket.createdAt).toLocaleDateString('fr-FR')} | Statut : ${cleanPdfText(ticket.status)}`, 18, currentY + 19);

    currentY += 28;

    // Bloc synthétique Client & Appareil
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('1. INFORMATIONS CLIENT & APPAREIL', 14, currentY);
    currentY += 4;

    const receptionModeLabel = ticket.receptionMode === 'livraison_yango' 
        ? `Livraison Yango (${ticket.yangoDetails?.driverType === 'yango_affilie' ? 'Livreur Yango' : 'Livreur Indépendant : ' + (ticket.yangoDetails?.driverName || 'Non précisé')})`
        : 'Dépôt direct à l\'atelier';

    const clientRows = [
        ['Client :', cleanPdfText(ticket.client.name), 'Marque / Modèle :', cleanPdfText(`${ticket.macBrand || 'Apple'} ${ticket.macModel || ''}`)],
        ['Téléphone :', cleanPdfText(ticket.client.phone), 'Numéro de Série :', cleanPdfText(ticket.serialNumber || 'Non renseigné')],
        ['Email / Autre :', cleanPdfText(ticket.client.email || ticket.client.secondaryPhone || '-'), 'N° Modèle / EMC :', cleanPdfText(`${ticket.modelNumber || '-'} / ${ticket.emc || '-'}`)],
        ['Mode Réception :', cleanPdfText(receptionModeLabel), 'Alimentation / Chargeur :', `${ticket.powersOn ? 'Démarre' : 'Ne démarre pas'} | ${ticket.chargerIncluded ? 'Avec chargeur' : 'Sans chargeur'}`],
    ];

    (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
        startY: currentY,
        body: clientRows,
        theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: 2, textColor: [51, 65, 85] },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 32, textColor: [15, 23, 42] },
            1: { cellWidth: 60 },
            2: { fontStyle: 'bold', cellWidth: 36, textColor: [15, 23, 42] },
            3: { cellWidth: 54 }
        },
        margin: { left: 14, right: 14 }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = (doc as any).lastAutoTable.finalY + 6;

    // Section 2 : Panne déclarée et Diagnostic
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('2. PANNE DÉCLARÉE & DIAGNOSTIC TECHNIQUE', 14, currentY);
    currentY += 4;

    const diagBody = [
        ['Panne déclarée par le client :', cleanPdfText(ticket.problemDescription || 'Aucun symptôme renseigné')],
        ['Notes du technicien :', cleanPdfText(ticket.technicianNotes || 'Aucune observation enregistrée')]
    ];

    if (ticket.diagnosticReport && ticket.diagnosticReport.length > 0) {
        const checksList = ticket.diagnosticReport
            .map(c => `${c.component}: ${c.status}${c.notes ? ' (' + c.notes + ')' : ''}`)
            .join(' | ');
        diagBody.push(['Points de contrôle vérifiés :', cleanPdfText(checksList)]);
    }

    if (ticket.diagnosticSheetB) {
        diagBody.push([
            'Expertise Fiche B :',
            cleanPdfText(`Diagnostic approfondi : ${ticket.diagnosticSheetB.generalDiagnostic || '-'} | Travaux : ${ticket.diagnosticSheetB.estimatedWorkDelay || '-'}`)
        ]);
    }

    (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
        startY: currentY,
        body: diagBody,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [51, 65, 85], lineColor: [226, 232, 240] },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 46, textColor: [15, 23, 42] },
            1: { cellWidth: 136 }
        },
        margin: { left: 14, right: 14 }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = (doc as any).lastAutoTable.finalY + 6;

    // Section 3 : Prestations chiffrées & Tarifs
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('3. PRESTATIONS CHIFFRÉES & INTERVENTIONS', 14, currentY);
    currentY += 4;

    const servicesHead = [['Prestation / Intervention', 'Catégorie', 'Montant (F CFA)']];
    const servicesRows: (string | number)[][] = [];

    if (ticket.costs?.diagnostic) {
        servicesRows.push(['Frais de Diagnostic / Expertise initiale', 'Diagnostic Fixe', `${ticket.costs.diagnostic.toLocaleString('fr-FR')} F CFA`]);
    }

    if (ticket.services && ticket.services.length > 0) {
        ticket.services.forEach(s => {
            servicesRows.push([cleanPdfText(s.name), cleanPdfText(s.category || 'Réparation'), `${s.price.toLocaleString('fr-FR')} F CFA`]);
        });
    }

    if (servicesRows.length === 0) {
        servicesRows.push(['Aucune prestation spécifique détaillée', '-', `${(ticket.costs?.repair || 0).toLocaleString('fr-FR')} F CFA`]);
    }

    (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
        startY: currentY,
        head: servicesHead,
        body: servicesRows,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
        columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 42 },
            2: { cellWidth: 40, halign: 'right' }
        },
        margin: { left: 14, right: 14 }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = (doc as any).lastAutoTable.finalY + 6;

    // Section 4 : Justificatifs de Paiement
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('4. JUSTIFICATIFS DE PAIEMENT', 14, currentY);
    currentY += 4;

    const paymentsHead = [['Date', 'Moyen de Paiement', 'Référence Transaction', 'Montant', 'Justificatif']];
    const paymentsRows: (string | number)[][] = [];

    if (ticket.paymentsList && ticket.paymentsList.length > 0) {
        ticket.paymentsList.forEach(p => {
            paymentsRows.push([
                new Date(p.date || p.createdAt).toLocaleDateString('fr-FR'),
                cleanPdfText(p.method.toUpperCase().replace('_', ' ')),
                cleanPdfText(p.reference || '-'),
                `${p.amount.toLocaleString('fr-FR')} F CFA`,
                p.proofUrl ? 'Inclus dans dossier' : 'Non joint / Espèces'
            ]);
        });
    } else if (ticket.costs?.advance && ticket.costs.advance > 0) {
        paymentsRows.push([
            new Date(ticket.createdAt).toLocaleDateString('fr-FR'),
            'ACOMPTE INITIAL',
            'Enregistrement entrée',
            `${ticket.costs.advance.toLocaleString('fr-FR')} F CFA`,
            'Encaissé à l\'accueil'
        ]);
    } else {
        paymentsRows.push(['-', 'Aucun versement enregistré', '-', '0 F CFA', '-']);
    }

    (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
        startY: currentY,
        head: paymentsHead,
        body: paymentsRows,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
        columnStyles: {
            0: { cellWidth: 26 },
            1: { cellWidth: 38 },
            2: { cellWidth: 44 },
            3: { cellWidth: 38, halign: 'right' },
            4: { cellWidth: 36, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = (doc as any).lastAutoTable.finalY + 6;

    // Vérifier s'il reste de la place sur la page pour le récapitulatif financier
    if (currentY > 230) {
        doc.addPage();
        currentY = 16;
    }

    // Section 5 : Point financier & Solde
    doc.setFillColor(fin.isInfacturable ? 254 : 248, fin.isInfacturable ? 242 : 250, fin.isInfacturable ? 242 : 252);
    doc.rect(14, currentY, pageWidth - 28, 22, 'F');
    doc.setDrawColor(fin.isInfacturable ? 244 : 203, fin.isInfacturable ? 63 : 213, fin.isInfacturable ? 94 : 225);
    doc.rect(14, currentY, pageWidth - 28, 22, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SYNTHÈSE FINANCIÈRE DE LA FICHE :', 18, currentY + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Facturé : ${fin.totalBilled.toLocaleString('fr-FR')} F CFA`, 18, currentY + 13);
    doc.text(`Acomptes / Règlements : ${fin.advanceReceived.toLocaleString('fr-FR')} F CFA`, 75, currentY + 13);
    
    doc.setFont('helvetica', 'bold');
    if (fin.balanceDue <= 0) {
        doc.setTextColor(16, 185, 129); // Vert
        doc.text(`Solde Dû : 0 F CFA (INTÉGRALEMENT RÉGLÉ)`, 138, currentY + 13);
    } else {
        doc.setTextColor(225, 29, 72); // Rouge
        doc.text(`Solde Restant Dû : ${fin.balanceDue.toLocaleString('fr-FR')} F CFA`, 138, currentY + 13);
    }

    if (fin.isInfacturable) {
        doc.setTextColor(190, 18, 60);
        doc.setFontSize(8);
        doc.text('Mention comptable : Dossier annulé / Infacturable (0 F CFA au point officiel).', 18, currentY + 18);
    }

    currentY += 28;

    // Section 6 : Historique & Travaux
    if (ticket.history && ticket.history.length > 0) {
        if (currentY > 230) {
            doc.addPage();
            currentY = 16;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('5. HISTORIQUE CHRONOLOGIQUE DES INTERVENTIONS', 14, currentY);
        currentY += 4;

        const historyRows = ticket.history.map(h => [
            new Date(h.date).toLocaleDateString('fr-FR') + ' ' + new Date(h.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            cleanPdfText(h.status),
            cleanPdfText(h.notes || '-'),
            cleanPdfText(h.updatedBy || 'Atelier')
        ]);

        (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
            startY: currentY,
            head: [['Date & Heure', 'Statut', 'Observations / Actions', 'Opérateur']],
            body: historyRows,
            theme: 'striped',
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
            styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [30, 41, 59] },
            columnStyles: {
                0: { cellWidth: 32 },
                1: { cellWidth: 36 },
                2: { cellWidth: 84 },
                3: { cellWidth: 30 }
            },
            margin: { left: 14, right: 14 }
        });
    }

    return doc.output('arraybuffer');
};

/**
 * Génère le fichier HTML autonome et élégant pour le dossier
 */
export const generateTicketHtml = (
    ticket: RepairTicket,
    photoManifest: {
        reception: string[];
        restitution: string[];
        yango: string[];
        paiements: { fileName: string; method: string; amount: number; reference?: string }[];
        generales: string[];
    }
): string => {
    const fin = getTicketFinancialSummary(ticket);
    const safeId = sanitizeFolderId(ticket.id);

    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dossier ${escapeHtml(ticket.id)} — TGS-CI Repair Management</title>
    <style>
        :root {
            --bg-page: #0f172a;
            --bg-card: #1e293b;
            --border-card: #334155;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --color-blue: #0284c7;
            --color-green: #10b981;
            --color-amber: #f59e0b;
            --color-rose: #f43f5e;
            --color-purple: #8b5cf6;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-page);
            color: var(--text-main);
            padding: 24px;
            line-height: 1.5;
        }
        .container { max-width: 1040px; margin: 0 auto; }
        .top-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border-card);
        }
        .btn-back {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: #334155;
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            transition: background 0.2s;
        }
        .btn-back:hover { background: #475569; }
        .btn-pdf {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: var(--color-blue);
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
        }
        .btn-pdf:hover { opacity: 0.9; }
        .header-card {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 1px solid var(--border-card);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
        }
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 16px;
        }
        .dossier-id {
            font-size: 28px;
            font-weight: 900;
            letter-spacing: -0.5px;
            color: #fff;
        }
        .badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .badge-status { background: rgba(2, 132, 199, 0.2); color: #38bdf8; border: 1px solid rgba(2, 132, 199, 0.3); }
        .badge-infacturable { background: rgba(244, 63, 94, 0.2); color: #fda4af; border: 1px solid rgba(244, 63, 94, 0.3); }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 20px;
        }
        .kpi-card {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-card);
            padding: 16px;
            border-radius: 12px;
        }
        .kpi-title { font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-bottom: 4px; }
        .kpi-value { font-size: 20px; font-weight: 800; color: #fff; }
        .card {
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
        }
        .card-title {
            font-size: 16px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            color: #e2e8f0;
            border-bottom: 1px solid #334155;
            padding-bottom: 10px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
        }
        .info-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .info-label { font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; }
        .info-val { font-size: 14px; font-weight: 500; color: #fff; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 13px;
        }
        th {
            background: #0f172a;
            color: var(--text-muted);
            text-align: left;
            padding: 10px 12px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #334155;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #334155;
            color: #cbd5e1;
        }
        tr:hover td { background: rgba(255, 255, 255, 0.02); }
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 16px;
            margin-top: 14px;
        }
        .photo-card {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            text-decoration: none;
            transition: transform 0.2s, border-color 0.2s;
        }
        .photo-card:hover {
            transform: translateY(-3px);
            border-color: var(--color-blue);
        }
        .photo-thumb {
            width: 100%;
            height: 140px;
            object-fit: cover;
            background: #020617;
        }
        .photo-caption {
            padding: 8px 10px;
            font-size: 11px;
            color: #cbd5e1;
            font-weight: 600;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
            border-top: 1px solid #1e293b;
        }
        .proof-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: #0284c7;
            color: #fff;
            border-radius: 6px;
            text-decoration: none;
            font-size: 11px;
            font-weight: 700;
        }
        .proof-link:hover { opacity: 0.85; }
        .timeline {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 12px;
        }
        .timeline-item {
            display: flex;
            gap: 16px;
            padding-bottom: 12px;
            border-left: 2px solid #334155;
            padding-left: 16px;
            position: relative;
        }
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -6px;
            top: 4px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--color-blue);
        }
        .timeline-time { font-size: 11px; color: var(--text-muted); font-weight: 700; }
        .timeline-title { font-size: 13px; font-weight: 700; color: #fff; }
        .timeline-notes { font-size: 12px; color: #cbd5e1; margin-top: 2px; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Top Nav -->
        <div class="top-nav">
            <a href="../index.html" class="btn-back">← Retour à l'Index Général</a>
            <a href="fiche_${escapeHtml(safeId)}.pdf" target="_blank" class="btn-pdf">📄 Télécharger / Imprimer la Fiche PDF</a>
        </div>

        <!-- Header Card -->
        <div class="header-card">
            <div class="header-top">
                <div>
                    <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 800; letter-spacing: 1px; margin-bottom: 4px;">TGS-CI REPAIR MANAGEMENT — DOSSIER TECHNIQUE</div>
                    <div class="dossier-id">Fiche N° ${escapeHtml(ticket.id)}</div>
                    <div style="font-size: 13px; color: #cbd5e1; margin-top: 4px;">Enregistré le : <strong>${new Date(ticket.createdAt).toLocaleDateString('fr-FR')} à ${new Date(ticket.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong></div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    <span class="badge badge-status">${escapeHtml(ticket.status)}</span>
                    ${fin.isInfacturable ? `<span class="badge badge-infacturable">🚫 DOSSIER INFACTURABLE (0 F AU POINT)</span>` : ''}
                </div>
            </div>

            <!-- Financial KPIs -->
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-title">Montant Total Facturé</div>
                    <div class="kpi-value">${fin.totalBilled.toLocaleString('fr-FR')} <span style="font-size: 12px; color: var(--text-muted);">F CFA</span></div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Acomptes & Règlements</div>
                    <div class="kpi-value" style="color: var(--color-green);">${fin.advanceReceived.toLocaleString('fr-FR')} <span style="font-size: 12px; color: var(--text-muted);">F CFA</span></div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Solde Restant Dû</div>
                    <div class="kpi-value" style="color: ${fin.balanceDue <= 0 ? 'var(--color-green)' : 'var(--color-rose)'};">
                        ${fin.balanceDue.toLocaleString('fr-FR')} <span style="font-size: 12px; color: var(--text-muted);">F CFA</span>
                    </div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Statut Règlement</div>
                    <div class="kpi-value" style="font-size: 14px; color: ${fin.isFullyPaid ? 'var(--color-green)' : 'var(--color-amber)'};">
                        ${fin.isFullyPaid ? '✅ Intégralement Payé' : '⏳ Solde en attente'}
                    </div>
                </div>
            </div>
        </div>

        <!-- 1. Client & Appareil -->
        <div class="card">
            <div class="card-title">👤 1. Coordonnées Client & Matériel Pris en Charge</div>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Nom du Client</span>
                    <span class="info-val">${escapeHtml(ticket.client.name)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Téléphone Principal</span>
                    <span class="info-val"><a href="tel:${escapeHtml(ticket.client.phone)}" style="color: var(--color-blue); text-decoration: none;">${escapeHtml(ticket.client.phone)}</a></span>
                </div>
                <div class="info-item">
                    <span class="info-label">Téléphone Secondaire / WhatsApp</span>
                    <span class="info-val">${escapeHtml(ticket.client.secondaryPhone || ticket.client.smsPhone || 'Non renseigné')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email</span>
                    <span class="info-val">${escapeHtml(ticket.client.email || 'Non renseigné')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Équipement</span>
                    <span class="info-val">${escapeHtml(ticket.macBrand || 'Apple')} ${escapeHtml(ticket.macModel || 'Non spécifié')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Numéro de Série</span>
                    <span class="info-val">${escapeHtml(ticket.serialNumber || 'Non renseigné')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">N° Modèle (AXXXX) / EMC</span>
                    <span class="info-val">${escapeHtml(ticket.modelNumber || '-')} / ${escapeHtml(ticket.emc || '-')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">État au Dépôt</span>
                    <span class="info-val">${ticket.powersOn ? '🟢 S\'allume' : '🔴 Ne s\'allume pas'} (${escapeHtml(ticket.powerOnStatus || 'Non spécifié')})</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Accessoires Fournis</span>
                    <span class="info-val">${ticket.chargerIncluded ? 'Avec chargeur' : 'Sans chargeur'}${ticket.bagIncluded ? ' | Avec sacoche' : ''}${ticket.caseIncluded ? ' | Avec pochette' : ''}</span>
                </div>
            </div>
        </div>

        <!-- 2. Mode de Réception -->
        <div class="card">
            <div class="card-title">📦 2. Mode de Réception de l'Appareil</div>
            ${ticket.receptionMode === 'livraison_yango' ? `
                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 14px; margin-bottom: 16px;">
                    <strong style="color: var(--color-amber);">🚕 Réception par Livraison Yango</strong>
                    <div class="info-grid" style="margin-top: 10px;">
                        <div class="info-item">
                            <span class="info-label">Date de Réception</span>
                            <span class="info-val">${escapeHtml(ticket.yangoDetails?.receptionDate || new Date(ticket.createdAt).toLocaleDateString('fr-FR'))}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Référence Course</span>
                            <span class="info-val">${escapeHtml(ticket.yangoDetails?.deliveryReference || 'Non renseignée')}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Type de Livreur</span>
                            <span class="info-val">${ticket.yangoDetails?.driverType === 'yango_affilie' ? 'Livreur officiel Yango' : 'Livreur Indépendant'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Nom & Téléphone Livreur</span>
                            <span class="info-val">${escapeHtml(ticket.yangoDetails?.driverName || '-')} (${escapeHtml(ticket.yangoDetails?.driverPhone || '-')})</span>
                        </div>
                    </div>
                    ${ticket.yangoDetails?.deliveryNotes ? `<p style="margin-top: 8px; font-size: 13px; color: #cbd5e1;">Remarques : ${escapeHtml(ticket.yangoDetails.deliveryNotes)}</p>` : ''}
                </div>
            ` : `
                <p style="font-size: 14px; color: #cbd5e1;">📍 <strong>Dépôt direct par le client à l'atelier</strong>.</p>
            `}
        </div>

        <!-- 3. Panne & Diagnostic -->
        <div class="card">
            <div class="card-title">🔍 3. Panne Constatée & Diagnostic Technique</div>
            <div style="margin-bottom: 16px;">
                <div class="info-label">Symptômes déclarés par le client</div>
                <div style="background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155; margin-top: 4px; font-size: 14px;">
                    ${escapeHtml(ticket.problemDescription || 'Aucun symptôme déclaré')}
                </div>
            </div>
            ${ticket.technicianNotes ? `
                <div style="margin-bottom: 16px;">
                    <div class="info-label">Observations & Diagnostic du Technicien</div>
                    <div style="background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155; margin-top: 4px; font-size: 14px;">
                        ${escapeHtml(ticket.technicianNotes)}
                    </div>
                </div>
            ` : ''}

            ${ticket.diagnosticReport && ticket.diagnosticReport.length > 0 ? `
                <div class="info-label" style="margin-top: 16px;">Grille des points de contrôle</div>
                <table>
                    <thead>
                        <tr>
                            <th>Composant</th>
                            <th>État / Résultat</th>
                            <th>Notes complémentaires</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ticket.diagnosticReport.map(c => `
                            <tr>
                                <td><strong>${escapeHtml(c.component)}</strong></td>
                                <td><span style="color: ${c.status.toLowerCase().includes('ok') || c.status.toLowerCase().includes('bon') ? 'var(--color-green)' : 'var(--color-rose)'}; font-weight: 700;">${escapeHtml(c.status)}</span></td>
                                <td>${escapeHtml(c.notes || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : ''}
        </div>

        <!-- 4. Prestations & Tarifs -->
        <div class="card">
            <div class="card-title">💰 4. Détail des Prestations & Montants Facturés</div>
            <table>
                <thead>
                    <tr>
                        <th>Prestation / Intervention</th>
                        <th>Catégorie</th>
                        <th style="text-align: right;">Prix unitaire</th>
                    </tr>
                </thead>
                <tbody>
                    ${ticket.costs?.diagnostic ? `
                        <tr>
                            <td>Frais d'Expertise & Diagnostic initial</td>
                            <td>Diagnostic Fixe</td>
                            <td style="text-align: right; font-weight: 700;">${ticket.costs.diagnostic.toLocaleString('fr-FR')} F CFA</td>
                        </tr>
                    ` : ''}
                    ${ticket.services && ticket.services.length > 0 ? ticket.services.map(s => `
                        <tr>
                            <td>${escapeHtml(s.name)}</td>
                            <td>${escapeHtml(s.category || 'Réparation')}</td>
                            <td style="text-align: right; font-weight: 700;">${s.price.toLocaleString('fr-FR')} F CFA</td>
                        </tr>
                    `).join('') : `
                        <tr>
                            <td>Réparation standard</td>
                            <td>Main d'œuvre</td>
                            <td style="text-align: right; font-weight: 700;">${(ticket.costs?.repair || 0).toLocaleString('fr-FR')} F CFA</td>
                        </tr>
                    `}
                </tbody>
            </table>
        </div>

        <!-- 5. Justificatifs de Paiement -->
        <div class="card">
            <div class="card-title">💳 5. Justificatifs de Paiement</div>
            ${ticket.paymentsList && ticket.paymentsList.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Mode</th>
                            <th>Référence</th>
                            <th style="text-align: right;">Montant</th>
                            <th>Justificatif</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ticket.paymentsList.map(p => {
                            const proofEntry = photoManifest.paiements.find(pm => pm.reference === p.reference || pm.amount === p.amount);
                            return `
                                <tr>
                                    <td>${new Date(p.date || p.createdAt).toLocaleDateString('fr-FR')}</td>
                                    <td><strong style="text-transform: uppercase;">${escapeHtml(p.method)}</strong></td>
                                    <td>${escapeHtml(p.reference || '-')}</td>
                                    <td style="text-align: right; font-weight: 700; color: var(--color-green);">${p.amount.toLocaleString('fr-FR')} F CFA</td>
                                    <td>
                                        ${proofEntry ? `
                                            <a href="justificatifs_paiements/${escapeHtml(proofEntry.fileName)}" target="_blank" class="proof-link">
                                                📄 Justificatif (${escapeHtml(proofEntry.fileName.endsWith('.pdf') ? 'PDF' : 'Image')})
                                            </a>
                                        ` : '<span style="color: var(--text-muted); font-size: 12px;">Non joint</span>'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            ` : `
                <p style="font-size: 13px; color: var(--text-muted);">
                    ${ticket.costs?.advance ? `Acompte initial enregistré à la création : <strong>${ticket.costs.advance.toLocaleString('fr-FR')} F CFA</strong> (Encaissé en atelier).` : 'Aucun versement n\'a encore été enregistré.'}
                </p>
            `}
        </div>

        <!-- 6. Photos & Annexes -->
        <div class="card">
            <div class="card-title">📸 6. Dossier Photographique & Éléments Visuels</div>
            
            ${photoManifest.reception.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 13px; text-transform: uppercase; color: var(--color-blue); font-weight: 800; margin-bottom: 8px;">A. Photos à la Réception (État Initial)</h3>
                    <div class="gallery-grid">
                        ${photoManifest.reception.map((file, i) => `
                            <a href="photos/reception/${escapeHtml(file)}" target="_blank" class="photo-card">
                                <img src="photos/reception/${escapeHtml(file)}" class="photo-thumb" loading="lazy" alt="Photo Réception ${i+1}">
                                <div class="photo-caption">${escapeHtml(file)}</div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${photoManifest.restitution.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 13px; text-transform: uppercase; color: var(--color-green); font-weight: 800; margin-bottom: 8px;">B. Photos Avant Restitution (État Réparé)</h3>
                    <div class="gallery-grid">
                        ${photoManifest.restitution.map((file, i) => `
                            <a href="photos/restitution/${escapeHtml(file)}" target="_blank" class="photo-card">
                                <img src="photos/restitution/${escapeHtml(file)}" class="photo-thumb" loading="lazy" alt="Photo Restitution ${i+1}">
                                <div class="photo-caption">${escapeHtml(file)}</div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${photoManifest.yango.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 13px; text-transform: uppercase; color: var(--color-amber); font-weight: 800; margin-bottom: 8px;">C. Captures & Preuves Livraison Yango</h3>
                    <div class="gallery-grid">
                        ${photoManifest.yango.map((file, i) => `
                            <a href="photos/livraison_yango/${escapeHtml(file)}" target="_blank" class="photo-card">
                                <img src="photos/livraison_yango/${escapeHtml(file)}" class="photo-thumb" loading="lazy" alt="Capture Yango ${i+1}">
                                <div class="photo-caption">${escapeHtml(file)}</div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${photoManifest.generales.length > 0 ? `
                <div>
                    <h3 style="font-size: 13px; text-transform: uppercase; color: var(--color-purple); font-weight: 800; margin-bottom: 8px;">D. Autres Photos & Documents Joints</h3>
                    <div class="gallery-grid">
                        ${photoManifest.generales.map((file, i) => `
                            <a href="photos/generales/${escapeHtml(file)}" target="_blank" class="photo-card">
                                <img src="photos/generales/${escapeHtml(file)}" class="photo-thumb" loading="lazy" alt="Photo Générale ${i+1}">
                                <div class="photo-caption">${escapeHtml(file)}</div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${(photoManifest.reception.length === 0 && photoManifest.restitution.length === 0 && photoManifest.yango.length === 0 && photoManifest.generales.length === 0) ? `
                <p style="font-size: 13px; color: var(--text-muted);">Aucune photo numérique n'était jointe à cette fiche lors de l'archivage.</p>
            ` : ''}
        </div>

        <!-- 7. Historique -->
        ${ticket.history && ticket.history.length > 0 ? `
            <div class="card">
                <div class="card-title">⏱️ 7. Journal & Historique des Travaux</div>
                <div class="timeline">
                    ${ticket.history.map(h => `
                        <div class="timeline-item">
                            <div style="flex: 1;">
                                <div class="timeline-time">${new Date(h.date).toLocaleDateString('fr-FR')} à ${new Date(h.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • Par : <strong>${escapeHtml(h.updatedBy || 'Atelier')}</strong></div>
                                <div class="timeline-title">${escapeHtml(h.status)}</div>
                                ${h.notes ? `<div class="timeline-notes">${escapeHtml(h.notes)}</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        <footer style="text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 40px; padding: 20px 0; border-top: 1px solid var(--border-card);">
            TGS-CI Repair Management Pro • Fiche d'archive générée le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} • Traçabilité 100% Hors-Ligne
        </footer>
    </div>
</body>
</html>`;
};

/**
 * Génère le portail index.html à la racine du ZIP permettant la consultation hors ligne
 */
export const generateGlobalIndexHtml = (tickets: RepairTicket[]): string => {
    let totalBilled = 0;
    let totalAdvance = 0;
    let totalBalance = 0;
    let facturablesCount = 0;
    let infacturablesCount = 0;

    tickets.forEach(t => {
        const fin = getTicketFinancialSummary(t);
        if (fin.isInfacturable) {
            infacturablesCount++;
        } else {
            facturablesCount++;
            totalBilled += fin.totalBilled;
            totalAdvance += fin.advanceReceived;
            totalBalance += fin.balanceDue;
        }
    });

    const ticketsJson = JSON.stringify(tickets.map(t => {
        const fin = getTicketFinancialSummary(t);
        const safeId = sanitizeFolderId(t.id);
        return {
            id: t.id,
            safeId,
            date: new Date(t.createdAt).toLocaleDateString('fr-FR'),
            client: t.client?.name || 'Inconnu',
            phone: t.client?.phone || '',
            model: `${t.macBrand || 'Apple'} ${t.macModel || ''}`.trim(),
            serial: t.serialNumber || '',
            status: t.status,
            receptionMode: t.receptionMode === 'livraison_yango' ? 'Livraison Yango' : 'Dépôt Atelier',
            totalBilled: fin.totalBilled,
            advance: fin.advanceReceived,
            balance: fin.balanceDue,
            isInfacturable: fin.isInfacturable,
            hasPhotos: (t.intakeImages?.length || 0) + (t.restitutionPhotos?.length || 0) + (t.images?.length || 0) > 0
        };
    }));

    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Index des Dossiers de Réparation — TGS-CI</title>
    <style>
        :root {
            --bg-page: #0f172a;
            --bg-card: #1e293b;
            --border-card: #334155;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --color-blue: #0284c7;
            --color-green: #10b981;
            --color-amber: #f59e0b;
            --color-rose: #f43f5e;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-page);
            color: var(--text-main);
            padding: 24px;
            line-height: 1.5;
        }
        .container { max-width: 1280px; margin: 0 auto; }
        .hero {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 1px solid var(--border-card);
            border-radius: 20px;
            padding: 32px;
            margin-bottom: 24px;
            box-shadow: 0 15px 30px -10px rgba(0,0,0,0.4);
        }
        .hero-title {
            font-size: 28px;
            font-weight: 900;
            letter-spacing: -0.5px;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .hero-sub {
            font-size: 14px;
            color: var(--text-muted);
            margin-top: 6px;
        }
        .kpi-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-top: 24px;
        }
        .kpi-box {
            background: rgba(15, 23, 42, 0.7);
            border: 1px solid var(--border-card);
            padding: 18px;
            border-radius: 14px;
        }
        .kpi-box-label { font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; }
        .kpi-box-val { font-size: 22px; font-weight: 900; color: #fff; margin-top: 4px; }
        .search-bar-wrap {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        .search-input {
            flex: 1;
            min-width: 280px;
            padding: 12px 18px;
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: 12px;
            color: #fff;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }
        .search-input:focus { border-color: var(--color-blue); }
        .filter-select {
            padding: 12px 16px;
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: 12px;
            color: #fff;
            font-size: 13px;
            outline: none;
        }
        .table-wrap {
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        th {
            background: #0f172a;
            color: var(--text-muted);
            text-align: left;
            padding: 14px 16px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid var(--border-card);
        }
        td {
            padding: 14px 16px;
            border-bottom: 1px solid #2d3748;
            color: #cbd5e1;
            vertical-align: middle;
        }
        tr:hover td { background: rgba(255, 255, 255, 0.03); }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .badge-status { background: rgba(2, 132, 199, 0.2); color: #38bdf8; border: 1px solid rgba(2, 132, 199, 0.3); }
        .badge-infact { background: rgba(244, 63, 94, 0.2); color: #fda4af; }
        .action-btns {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .btn-view {
            padding: 6px 12px;
            background: var(--color-blue);
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            transition: opacity 0.2s;
            white-space: nowrap;
        }
        .btn-view:hover { opacity: 0.85; }
        .btn-pdf-view {
            padding: 6px 10px;
            background: #334155;
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
        }
        .btn-pdf-view:hover { background: #475569; }
        .errors-notice {
            margin-top: 20px;
            padding: 14px 18px;
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.3);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            color: #fde68a;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Hero Section -->
        <div class="hero">
            <div class="hero-title">
                <span>📁</span> TGS-CI Repair Management — Archives Dossiers Hors-Ligne
            </div>
            <div class="hero-sub">
                Index officiel des fiches techniques, diagnostics, rapports d'interventions, historiques, règlements et photos sauvegardées.
            </div>

            <div class="kpi-row">
                <div class="kpi-box">
                    <div class="kpi-box-label">Dossiers Archivés</div>
                    <div class="kpi-box-val">${tickets.length}</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-box-label">Facturables vs Infacturables</div>
                    <div class="kpi-box-val" style="font-size: 18px;">${facturablesCount} <span style="font-size: 12px; color: var(--text-muted);">/</span> <span style="color: var(--color-rose);">${infacturablesCount} inf.</span></div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-box-label">Total Facturé (Atelier)</div>
                    <div class="kpi-box-val">${totalBilled.toLocaleString('fr-FR')} <span style="font-size: 12px; color: var(--text-muted);">F CFA</span></div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-box-label">Règlements Encaissés</div>
                    <div class="kpi-box-val" style="color: var(--color-green);">${totalAdvance.toLocaleString('fr-FR')} <span style="font-size: 12px; color: var(--text-muted);">F CFA</span></div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-box-label">Solde Restant Dû</div>
                    <div class="kpi-box-val" style="color: ${totalBalance <= 0 ? 'var(--color-green)' : 'var(--color-rose)'};">${totalBalance.toLocaleString('fr-FR')} <span style="font-size: 12px; color: var(--text-muted);">F CFA</span></div>
                </div>
            </div>
        </div>

        <!-- Filtres et Recherche -->
        <div class="search-bar-wrap">
            <input type="text" id="searchInput" class="search-input" placeholder="🔍 Rechercher par N° fiche, nom client, téléphone, modèle..." onkeyup="filterTickets()" autofocus>
            <select id="statusFilter" class="filter-select" onchange="filterTickets()">
                <option value="">Tous les statuts</option>
            </select>
        </div>

        <!-- Table des dossiers -->
        <div class="table-wrap">
            <table id="dossiersTable">
                <thead>
                    <tr>
                        <th>N° Fiche</th>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Appareil</th>
                        <th>Statut</th>
                        <th style="text-align: right;">Total (F CFA)</th>
                        <th style="text-align: right;">Solde Dû</th>
                        <th style="text-align: center;">Actions</th>
                    </tr>
                </thead>
                <tbody id="ticketsTbody">
                </tbody>
            </table>
        </div>

        <div class="errors-notice" id="errorsBanner">
            <span>📝 Un rapport d'audit détaillé est disponible à la racine : <strong>Erreurs_export.txt</strong></span>
            <a href="Erreurs_export.txt" target="_blank" style="color: #fff; background: rgba(245, 158, 11, 0.4); padding: 4px 10px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 12px;">Consulter le Journal</a>
        </div>

        <footer style="text-align: center; font-size: 12px; color: var(--text-muted); margin-top: 32px; padding: 20px 0;">
            TGS-CI Repair Management Pro • Index complet généré le ${new Date().toLocaleDateString('fr-FR')} • Traçabilité garantie 100% Hors-Ligne
        </footer>
    </div>

    <script>
        const allTickets = ${ticketsJson};

        // Remplir la liste des statuts
        const statuses = Array.from(new Set(allTickets.map(t => t.status))).filter(Boolean);
        const statusSelect = document.getElementById('statusFilter');
        statuses.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            statusSelect.appendChild(opt);
        });

        function renderRows(tickets) {
            const tbody = document.getElementById('ticketsTbody');
            tbody.innerHTML = '';

            if (tickets.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 32px; color: #94a3b8;">Aucun dossier trouvé correspondant aux critères.</td></tr>';
                return;
            }

            tickets.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = \`
                    <td>
                        <strong style="font-family: monospace; font-size: 14px; color: #fff;">#\${t.id}</strong>
                    </td>
                    <td style="font-size: 12px;">\${t.date}</td>
                    <td>
                        <div style="font-weight: 700; color: #fff;">\${t.client}</div>
                        <div style="font-size: 11px; color: #94a3b8;">\${t.phone || '-'}</div>
                    </td>
                    <td>
                        <div style="font-weight: 600;">\${t.model || '-'}</div>
                        <div style="font-size: 11px; color: #94a3b8;">\${t.serial || ''}</div>
                    </td>
                    <td>
                        <span class="badge badge-status">\${t.status}</span>
                        \${t.isInfacturable ? '<span class="badge badge-infact">Infacturable</span>' : ''}
                    </td>
                    <td style="text-align: right; font-weight: 700;">\${t.totalBilled.toLocaleString('fr-FR')} F</td>
                    <td style="text-align: right; font-weight: 700; color: \${t.balance <= 0 ? 'var(--color-green)' : 'var(--color-rose)'};">
                        \${t.balance.toLocaleString('fr-FR')} F
                    </td>
                    <td>
                        <div class="action-btns" style="justify-content: center;">
                            <a href="\${t.safeId}/fiche_\${t.safeId}.html" class="btn-view" title="Consulter la fiche complète HTML">Ouvrir Dossier</a>
                            <a href="\${t.safeId}/fiche_\${t.safeId}.pdf" target="_blank" class="btn-pdf-view" title="Voir le PDF">PDF</a>
                        </div>
                    </td>
                \`;
                tbody.appendChild(tr);
            });
        }

        function filterTickets() {
            const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
            const status = document.getElementById('statusFilter').value;

            const filtered = allTickets.filter(t => {
                const matchStatus = !status || t.status === status;
                const matchQuery = !query || 
                    t.id.toLowerCase().includes(query) ||
                    t.client.toLowerCase().includes(query) ||
                    t.phone.toLowerCase().includes(query) ||
                    t.model.toLowerCase().includes(query) ||
                    t.serial.toLowerCase().includes(query);
                return matchStatus && matchQuery;
            });

            renderRows(filtered);
        }

        renderRows(allTickets);
    </script>
</body>
</html>`;
};

/**
 * Génère le fichier Erreurs_export.txt
 */
export const generateAuditErrorReport = (
    totalTickets: number,
    completedTickets: number,
    warnings: string[],
    globalErrors: string[]
): string => {
    const isSuccess = warnings.length === 0 && globalErrors.length === 0;
    const isPartial = warnings.length > 0 && globalErrors.length === 0;
    const statusLabel = isSuccess ? 'COMPLET (100% de réussite)' : (isPartial ? 'PARTIEL (Avertissements détectés)' : 'ÉCHEC OU PARTIEL MAJEUR');

    let text = `================================================================================\n`;
    text += `RAPPORT D'AUDIT ET JOURNAL D'EXPORTATION — TGS-CI REPAIR MANAGEMENT\n`;
    text += `================================================================================\n`;
    text += `Date et heure d'exportation : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}\n`;
    text += `Statut global de l'exportation : ${statusLabel}\n`;
    text += `Nombre total de dossiers traités : ${totalTickets}\n`;
    text += `Nombre total de dossiers complets : ${completedTickets}\n`;
    text += `Nombre total d'avertissements (photos/fichiers manquants) : ${warnings.length}\n`;
    text += `Nombre d'erreurs critiques : ${globalErrors.length}\n\n`;

    if (isSuccess) {
        text += `RÉSULTAT :\n`;
        text += `L'intégralité des fiches techniques (PDF & HTML), les historiques,\n`;
        text += `les règlements et toutes les photos originales associées ont été\n`;
        text += `archivés avec un succès absolu.\n`;
        text += `L'index interactif 'index.html' à la racine vous permet de consulter\n`;
        text += `tous les dossiers hors-ligne en toute autonomie.\n`;
    } else {
        text += `RÉSUMÉ DES TRAITEMENTS :\n`;
        text += `L'exportation a poursuivi son exécution pour sauvegarder l'ensemble\n`;
        text += `des données récupérables. Les fiches PDF et HTML ont été créées pour\n`;
        text += `chaque dossier. Les éléments listés ci-après n'ont pas pu être incorporés\n`;
        text += `(inaccessibilité réseau, ressource expirée ou fichier source manquant).\n\n`;

        if (warnings.length > 0) {
            text += `--------------------------------------------------------------------------------\n`;
            text += `DÉTAIL DES ANOMALIES PAR DOSSIER :\n`;
            text += `--------------------------------------------------------------------------------\n`;
            warnings.forEach((w, idx) => {
                text += `[Avertissement #${idx + 1}] ${w}\n`;
            });
            text += `\n`;
        }

        if (globalErrors.length > 0) {
            text += `--------------------------------------------------------------------------------\n`;
            text += `ERREURS CRITIQUES D'EXÉCUTION :\n`;
            text += `--------------------------------------------------------------------------------\n`;
            globalErrors.forEach((e, idx) => {
                text += `[Erreur #${idx + 1}] ${e}\n`;
            });
            text += `\n`;
        }

        text += `CONSEIL :\n`;
        text += `Vous pouvez vérifier les fiches HTML et PDF dans les sous-dossiers concernés.\n`;
        text += `Toutes les données textuelles, financières et métriques sont intactes.\n`;
    }

    text += `================================================================================\n`;
    return text;
};

/**
 * Fonction maîtresse : Exporte tous les dossiers sous forme d'une ou plusieurs archives ZIP
 */
export const exportAllDossiersToZip = async (
    onProgress?: ExportProgressCallback,
    ticketsInput?: RepairTicket[]
): Promise<{ success: boolean; status: 'completed' | 'partial' | 'failed'; partsCount: number; warnings: string[] }> => {
    const warnings: string[] = [];
    const globalErrors: string[] = [];
    const generatedParts: { fileName: string; sizeBytes: number; blob: Blob }[] = [];

    // Seuil de découpage pour préserver la mémoire du navigateur et éviter les crashs JSZip
    const MAX_TICKETS_PER_BATCH = 75;

    try {
        if (onProgress) {
            onProgress({
                totalTickets: 0,
                currentTicketIndex: 0,
                currentTicketId: 'Initialisation',
                stage: 'preparing',
                percent: 0,
                message: 'Chargement de l\'intégralité des dossiers depuis le stockage...',
                warningCount: 0,
                warnings: [],
                generatedParts: []
            });
        }

        // Récupérer l'ensemble des tickets depuis IndexedDB (aucune limitation aux dossiers affichés)
        let allTickets = ticketsInput;
        if (!allTickets || allTickets.length === 0) {
            try {
                allTickets = await dbGetTickets();
            } catch (dbErr) {
                console.warn("Échec récupération dbGetTickets, utilisation fallback input:", dbErr);
                allTickets = ticketsInput || [];
            }
        }

        if (!allTickets || allTickets.length === 0) {
            throw new Error("Aucun dossier trouvé dans la base de données.");
        }

        const totalCount = allTickets.length;
        const totalBatches = Math.ceil(totalCount / MAX_TICKETS_PER_BATCH);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIdx = batchIndex * MAX_TICKETS_PER_BATCH;
            const endIdx = Math.min(startIdx + MAX_TICKETS_PER_BATCH, totalCount);
            const batchTickets = allTickets.slice(startIdx, endIdx);
            const isMultiBatch = totalBatches > 1;

            const zip = new JSZip();

            let batchCompletedCount = 0;

            for (let i = 0; i < batchTickets.length; i++) {
                const globalTicketIndex = startIdx + i + 1;
                const ticket = batchTickets[i];
                const safeId = sanitizeFolderId(ticket.id);

                if (onProgress) {
                    const progressPercent = Math.round(((globalTicketIndex - 1) / totalCount) * 85);
                    onProgress({
                        totalTickets: totalCount,
                        currentTicketIndex: globalTicketIndex,
                        currentTicketId: ticket.id,
                        stage: 'processing',
                        percent: progressPercent,
                        message: `Traitement du dossier ${globalTicketIndex}/${totalCount} : ${ticket.id}...`,
                        warningCount: warnings.length,
                        warnings: [...warnings],
                        generatedParts: [...generatedParts]
                    });
                }

                // Créer le dossier spécifique pour le ticket (ex : 26RM751)
                const folder = zip.folder(safeId);
                if (!folder) continue;

                const photoManifest = {
                    reception: [] as string[],
                    restitution: [] as string[],
                    yango: [] as string[],
                    paiements: [] as { fileName: string; method: string; amount: number; reference?: string }[],
                    generales: [] as string[]
                };

                // A. Traitement et extraction des photos de Réception
                const photosReception = folder.folder("photos")?.folder("reception");
                if (ticket.intakeImages && ticket.intakeImages.length > 0 && photosReception) {
                    for (let imgIdx = 0; imgIdx < ticket.intakeImages.length; imgIdx++) {
                        const imgSource = ticket.intakeImages[imgIdx];
                        try {
                            const binary = await fetchResourceAsBinary(imgSource);
                            if (binary) {
                                const fileName = `reception_photo_${imgIdx + 1}.${binary.extension}`;
                                photosReception.file(fileName, binary.data);
                                photoManifest.reception.push(fileName);
                            } else {
                                warnings.push(`[Dossier ${ticket.id}] Photo de réception n°${imgIdx + 1} inaccessible.`);
                            }
                        } catch (err) {
                            warnings.push(`[Dossier ${ticket.id}] Échec extraction photo réception n°${imgIdx + 1}: ${err}`);
                        }
                    }
                }

                if (ticket.backCoverImage && photosReception) {
                    try {
                        const binary = await fetchResourceAsBinary(ticket.backCoverImage);
                        if (binary) {
                            const fileName = `couvre_arriere_${safeId}.${binary.extension}`;
                            photosReception.file(fileName, binary.data);
                            photoManifest.reception.push(fileName);
                        }
                    } catch (err) {
                        warnings.push(`[Dossier ${ticket.id}] Photo couvre-arrière inaccessible: ${err}`);
                    }
                }

                // B. Traitement et extraction des photos avant Restitution
                const photosRestitution = folder.folder("photos")?.folder("restitution");
                if (ticket.restitutionPhotos && ticket.restitutionPhotos.length > 0 && photosRestitution) {
                    for (let rIdx = 0; rIdx < ticket.restitutionPhotos.length; rIdx++) {
                        const rSource = ticket.restitutionPhotos[rIdx];
                        try {
                            const binary = await fetchResourceAsBinary(rSource);
                            if (binary) {
                                const fileName = `restitution_photo_${rIdx + 1}.${binary.extension}`;
                                photosRestitution.file(fileName, binary.data);
                                photoManifest.restitution.push(fileName);
                            } else {
                                warnings.push(`[Dossier ${ticket.id}] Photo de restitution n°${rIdx + 1} inaccessible.`);
                            }
                        } catch (err) {
                            warnings.push(`[Dossier ${ticket.id}] Échec photo restitution n°${rIdx + 1}: ${err}`);
                        }
                    }
                }

                // C. Traitement des captures Livraison Yango
                const photosYango = folder.folder("photos")?.folder("livraison_yango");
                if (ticket.receptionMode === 'livraison_yango' && ticket.yangoDetails && photosYango) {
                    if (ticket.yangoDetails.whatsappScreenshot) {
                        try {
                            const bin = await fetchResourceAsBinary(ticket.yangoDetails.whatsappScreenshot);
                            if (bin) {
                                const fileName = `capture_whatsapp.${bin.extension}`;
                                photosYango.file(fileName, bin.data);
                                photoManifest.yango.push(fileName);
                            }
                        } catch {
                            warnings.push(`[Dossier ${ticket.id}] Capture WhatsApp Yango inaccessible.`);
                        }
                    }

                    if (ticket.yangoDetails.driverScreenshot) {
                        try {
                            const bin = await fetchResourceAsBinary(ticket.yangoDetails.driverScreenshot);
                            if (bin) {
                                const fileName = `capture_livreur.${bin.extension}`;
                                photosYango.file(fileName, bin.data);
                                photoManifest.yango.push(fileName);
                            }
                        } catch {
                            warnings.push(`[Dossier ${ticket.id}] Capture livreur Yango inaccessible.`);
                        }
                    }

                    if (ticket.yangoDetails.deliveryProofDoc) {
                        try {
                            const bin = await fetchResourceAsBinary(ticket.yangoDetails.deliveryProofDoc);
                            if (bin) {
                                const fileName = `preuve_livraison.${bin.extension}`;
                                photosYango.file(fileName, bin.data);
                                photoManifest.yango.push(fileName);
                            }
                        } catch {
                            warnings.push(`[Dossier ${ticket.id}] Document preuve livraison Yango inaccessible.`);
                        }
                    }
                }

                // D. Traitement des justificatifs de paiement électroniques
                const paymentsFolder = folder.folder("justificatifs_paiements");
                if (ticket.paymentsList && ticket.paymentsList.length > 0 && paymentsFolder) {
                    for (let pIdx = 0; pIdx < ticket.paymentsList.length; pIdx++) {
                        const payment: PaymentEntry = ticket.paymentsList[pIdx];
                        if (payment.proofUrl) {
                            try {
                                const bin = await fetchResourceAsBinary(payment.proofUrl);
                                if (bin) {
                                    const fileName = `justificatif_paiement_${pIdx + 1}_${payment.method}.${bin.extension}`;
                                    paymentsFolder.file(fileName, bin.data);
                                    photoManifest.paiements.push({
                                        fileName,
                                        method: payment.method,
                                        amount: payment.amount,
                                        reference: payment.reference
                                    });
                                } else {
                                    warnings.push(`[Dossier ${ticket.id}] Justificatif de paiement ${payment.method} (${payment.amount} F) inaccessible.`);
                                }
                            } catch (err) {
                                warnings.push(`[Dossier ${ticket.id}] Erreur traitement justificatif paiement: ${err}`);
                            }
                        }
                    }
                }

                // E. Traitement des photos générales
                const photosGenerales = folder.folder("photos")?.folder("generales");
                if (ticket.images && ticket.images.length > 0 && photosGenerales) {
                    for (let gIdx = 0; gIdx < ticket.images.length; gIdx++) {
                        try {
                            const bin = await fetchResourceAsBinary(ticket.images[gIdx]);
                            if (bin) {
                                const fileName = `photo_generale_${gIdx + 1}.${bin.extension}`;
                                photosGenerales.file(fileName, bin.data);
                                photoManifest.generales.push(fileName);
                            }
                        } catch {
                            warnings.push(`[Dossier ${ticket.id}] Photo générale n°${gIdx + 1} inaccessible.`);
                        }
                    }
                }

                // F. Génération de la fiche PDF
                try {
                    const pdfBuffer = generateTicketPdf(ticket);
                    folder.file(`fiche_${safeId}.pdf`, pdfBuffer);
                } catch (pdfErr) {
                    console.error(`Erreur génération PDF pour ${ticket.id}:`, pdfErr);
                    warnings.push(`[Dossier ${ticket.id}] Échec de génération PDF: ${pdfErr}`);
                }

                // G. Génération de la fiche HTML
                try {
                    const htmlContent = generateTicketHtml(ticket, photoManifest);
                    folder.file(`fiche_${safeId}.html`, htmlContent);
                    folder.file(`index.html`, htmlContent); // Permet d'ouvrir le dossier directement
                } catch (htmlErr) {
                    console.error(`Erreur génération HTML pour ${ticket.id}:`, htmlErr);
                    warnings.push(`[Dossier ${ticket.id}] Échec de génération HTML: ${htmlErr}`);
                }

                batchCompletedCount++;
            }

            // Génération de l'index HTML global à la racine du ZIP
            const globalIndexHtml = generateGlobalIndexHtml(batchTickets);
            zip.file("index.html", globalIndexHtml);

            // Génération du rapport d'audit et erreurs Erreurs_export.txt
            const auditText = generateAuditErrorReport(batchTickets.length, batchCompletedCount, warnings, globalErrors);
            zip.file("Erreurs_export.txt", auditText);

            // Compression ZIP
            if (onProgress) {
                onProgress({
                    totalTickets: totalCount,
                    currentTicketIndex: endIdx,
                    currentTicketId: 'Compression',
                    stage: 'zipping',
                    percent: 88,
                    message: isMultiBatch 
                        ? `Compression de l'archive ZIP (Partie ${batchIndex + 1}/${totalBatches})...` 
                        : 'Compression de l\'archive ZIP complète...',
                    warningCount: warnings.length,
                    warnings: [...warnings],
                    generatedParts: [...generatedParts]
                });
            }

            const zipBlob = await zip.generateAsync(
                { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
                (metadata) => {
                    if (onProgress) {
                        const zippingPercent = 88 + Math.round((metadata.percent / 100) * 10);
                        onProgress({
                            totalTickets: totalCount,
                            currentTicketIndex: endIdx,
                            currentTicketId: 'Compression',
                            stage: 'zipping',
                            percent: zippingPercent,
                            message: `Compression : ${Math.round(metadata.percent)}% terminé...`,
                            warningCount: warnings.length,
                            warnings: [...warnings],
                            generatedParts: [...generatedParts]
                        });
                    }
                }
            );

            const dateStr = new Date().toISOString().split('T')[0];
            const partSuffix = isMultiBatch ? `_Partie_${batchIndex + 1}_sur_${totalBatches}` : '';
            const fileName = `Export_Tous_Les_Dossiers_TGS_CI_${dateStr}${partSuffix}.zip`;

            generatedParts.push({
                fileName,
                sizeBytes: zipBlob.size,
                blob: zipBlob
            });

            // Déclencher le téléchargement automatique de cette archive
            triggerBrowserDownload(zipBlob, fileName);
        }

        const finalStatus = warnings.length === 0 ? 'completed' : 'partial';

        if (onProgress) {
            onProgress({
                totalTickets: totalCount,
                currentTicketIndex: totalCount,
                currentTicketId: 'Terminé',
                stage: finalStatus,
                percent: 100,
                message: finalStatus === 'completed'
                    ? `Exportation complète réussie (${totalCount} dossiers archivés) !`
                    : `Exportation partielle terminée avec ${warnings.length} avertissement(s). Consultez Erreurs_export.txt.`,
                warningCount: warnings.length,
                warnings: [...warnings],
                generatedParts: [...generatedParts]
            });
        }

        return {
            success: true,
            status: finalStatus,
            partsCount: generatedParts.length,
            warnings
        };

    } catch (err: unknown) {
        console.error("Échec critique exportAllDossiersToZip:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        globalErrors.push(errMsg);

        if (onProgress) {
            onProgress({
                totalTickets: 0,
                currentTicketIndex: 0,
                currentTicketId: 'Erreur',
                stage: 'failed',
                percent: 0,
                message: `L'exportation a échoué : ${errMsg}`,
                warningCount: warnings.length,
                warnings: [...warnings, errMsg],
                generatedParts: [...generatedParts]
            });
        }

        return {
            success: false,
            status: 'failed',
            partsCount: generatedParts.length,
            warnings: [...warnings, errMsg]
        };
    }
};

/**
 * Déclenche un téléchargement via le navigateur sans bloquer
 */
export const triggerBrowserDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 1000);
};
