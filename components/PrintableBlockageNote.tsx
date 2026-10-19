import React from 'react';
import { RepairTicket } from '../types.ts';
import { AppleLogo } from './icons.tsx';
import { formatDisplayDate } from '../utils/formatters.ts';

interface PrintableBlockageNoteProps {
    ticket: RepairTicket;
}

export const PrintableBlockageNote: React.FC<PrintableBlockageNoteProps> = ({ ticket }) => {
    const report = ticket.technicalBlockageReport;
    const dateToday = new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    if (!report) return null;

    const allReplaced = [
        ...(report.replacedComponents || []),
        ...(report.customComponentsText ? [report.customComponentsText] : [])
    ];

    const allSymptoms = [
        ...(report.symptoms || []),
        ...(report.technicalDetails ? [report.technicalDetails] : [])
    ];

    return (
        <div className="printable-page" style={{ color: '#000', padding: '15mm', fontFamily: 'Arial, sans-serif', backgroundColor: '#fff', fontSize: '9.5pt', lineHeight: 1.4 }}>
            {/* Header */}
            <header style={{ borderBottom: '2.5pt solid #d97706', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AppleLogo style={{ width: '22px', height: '22px', color: '#000' }} />
                        <h1 style={{ fontSize: '18pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
                    </div>
                    <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '4px', color: '#d97706' }}>
                        ATELIER SPÉCIALISÉ MACBOOK • NOTE TECHNIQUE EN COURS D'INTERVENTION
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10pt', fontWeight: '900', border: '1.5pt solid #d97706', color: '#d97706', padding: '3px 8px', display: 'inline-block' }}>
                        AVENANT DE DÉLAI
                    </div>
                    <div style={{ fontSize: '8.5pt', marginTop: '4px', fontWeight: 'bold' }}>
                        Dossier N° {ticket.id}
                    </div>
                </div>
            </header>

            {/* Infos Client & Appareil */}
            <div style={{ background: '#fffbeb', padding: '12px 14px', border: '1pt solid #fde68a', marginBottom: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                    <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#78350f', textTransform: 'uppercase' }}>Client</div>
                    <div style={{ fontSize: '11pt', fontWeight: '900', marginTop: '2px' }}>{ticket.client.name}</div>
                    <div style={{ fontSize: '8.5pt', color: '#333' }}>Tél : {ticket.client.phone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#78350f', textTransform: 'uppercase' }}>Machine Prise en Charge</div>
                    <div style={{ fontSize: '11pt', fontWeight: '900', marginTop: '2px' }}>{ticket.macBrand} {ticket.macModel}</div>
                    <div style={{ fontSize: '8.5pt', color: '#333' }}>S/N : {ticket.serialNumber || 'Non renseigné'}</div>
                </div>
            </div>

            {/* Cadre Nouveau Rendez-vous */}
            <div style={{ background: '#fef3c7', border: '1.5pt solid #d97706', padding: '12px 16px', borderRadius: '4px', marginBottom: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#b45309', letterSpacing: '0.05em' }}>
                    PROLONGATION DE DÉLAI TECHNIQUE RECOMMANDÉE (+{report.requestedDays} JOURS OUVRÉS)
                </div>
                <div style={{ fontSize: '13pt', fontWeight: '900', color: '#000', margin: '4px 0', textTransform: 'capitalize' }}>
                    Prochaine mise à disposition : {formatDisplayDate(report.calculatedRdvDate)} à 10 h 00
                </div>
                <div style={{ fontSize: '7.5pt', color: '#78350f' }}>
                    Calculé en jours ouvrés excluant dimanches et jours fériés nationaux
                </div>
            </div>

            {/* 1. Composants remplacés / interventions réalisées */}
            <div style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '9pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1pt solid #000', paddingBottom: '3px' }}>
                    1. Travaux et Composants déjà Remplacés
                </h2>
                <div style={{ padding: '8px 12px', background: '#f9fafb', border: '1pt solid #e5e7eb', borderRadius: '3px' }}>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '8.5pt' }}>
                        {allReplaced.map((c, i) => (
                            <li key={i} style={{ marginBottom: '3px', fontWeight: 'bold' }}>{c}</li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* 2. Constats & Nature du blocage technique */}
            <div style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '9pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1pt solid #000', paddingBottom: '3px' }}>
                    2. Constats Techniques & Instabilités Résiduelles
                </h2>
                <div style={{ padding: '8px 12px', background: '#fff1f2', border: '1pt solid #fecdd3', borderRadius: '3px' }}>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '8.5pt', color: '#9f1239' }}>
                        {allSymptoms.map((s, i) => (
                            <li key={i} style={{ marginBottom: '3px' }}>{s}</li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* 3. Note explicative vulgarisée transmise au client */}
            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '9pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1pt solid #000', paddingBottom: '3px' }}>
                    3. Explication et Traçabilité Clientèle
                </h2>
                <div style={{ padding: '10px 12px', border: '1pt dashed #cbd5e1', background: '#fafafa', fontSize: '8.5pt', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {report.clientExplanation}
                </div>
            </div>

            {/* Signatures & Mentions */}
            <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', borderTop: '1pt solid #e2e8f0', paddingTop: '15px' }}>
                <div>
                    <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b' }}>
                        Le Technicien Spécialiste
                    </div>
                    <div style={{ fontSize: '9pt', fontWeight: 'bold', marginTop: '4px' }}>
                        {report.technicianName}
                    </div>
                    <div style={{ marginTop: '28px', borderBottom: '1pt dotted #94a3b8', width: '80%' }}></div>
                    <div style={{ fontSize: '7pt', color: '#94a3b8', marginTop: '2px' }}>Signature & Visa technique</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b' }}>
                        Pour le Client / L'Assistant(e)
                    </div>
                    <div style={{ fontSize: '8.5pt', color: '#334155', marginTop: '4px' }}>
                        Fait à Abidjan, le {dateToday}
                    </div>
                    <div style={{ marginTop: '28px', borderBottom: '1pt dotted #94a3b8', width: '80%', marginLeft: 'auto' }}></div>
                    <div style={{ fontSize: '7pt', color: '#94a3b8', marginTop: '2px' }}>Notification transmise au client</div>
                </div>
            </div>
        </div>
    );
};

export default PrintableBlockageNote;
