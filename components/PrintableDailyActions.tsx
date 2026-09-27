import React from 'react';
import { DailyActionItem } from '../types.ts';
import { AppleLogo } from './icons.tsx';
import { formatDisplayPhone } from '../utils/formatters.ts';

interface PrintableDailyActionsProps {
    dateKey: string;
    formattedDate: string;
    actions: DailyActionItem[];
    stats: {
        totalToday: number;
        todoCount: number;
        doneCount: number;
        overdueCount: number;
    };
    filterCategory?: 'ALL' | 'TODO' | 'DONE' | 'OVERDUE';
}

export const PrintableDailyActions: React.FC<PrintableDailyActionsProps> = ({
    dateKey,
    formattedDate,
    actions,
    stats,
    filterCategory = 'ALL'
}) => {
    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '8.5pt',
        color: '#000',
        marginBottom: '20px'
    };

    const thStyle: React.CSSProperties = {
        padding: '8px 10px',
        border: '1pt solid #000',
        backgroundColor: '#f2f2f2',
        textAlign: 'left',
        fontWeight: '900',
        textTransform: 'uppercase',
        fontSize: '7.5pt',
        letterSpacing: '0.5px'
    };

    const tdStyle: React.CSSProperties = {
        padding: '8px 10px',
        border: '0.8pt solid #000',
        verticalAlign: 'top'
    };

    const filterTitle = 
        filterCategory === 'TODO' ? 'ACTIONS À FAIRE' :
        filterCategory === 'DONE' ? 'ACTIONS EFFECTUÉES' :
        filterCategory === 'OVERDUE' ? 'DOSSIERS EN RETARD' :
        'TOUTES LES ACTIONS DU JOUR';

    return (
        <div className="printable-page" style={{ color: '#000', padding: '12mm 15mm', backgroundColor: '#ffffff', minHeight: '297mm', position: 'relative', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <style>
                {`
                    @media print {
                        thead { display: table-header-group; }
                        tr { page-break-inside: avoid; }
                    }
                    .zebra-actions tr:nth-child(even) { background-color: #fafafa; }
                `}
            </style>

            {/* FILIGRANE ARRIÈRE PLAN */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-35deg)', fontSize: '90pt', fontWeight: '900', color: 'rgba(0,0,0,0.03)', pointerEvents: 'none', zIndex: 0, whiteSpace: 'nowrap' }}>
                TGS ATELIER
            </div>

            {/* HEADER */}
            <header style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5pt solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <AppleLogo style={{ width: '24px', height: '24px', color: '#000' }} />
                        <h1 style={{ fontSize: '22pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
                            TGS - CI
                        </h1>
                    </div>
                    <div style={{ fontSize: '9pt', fontWeight: '900', textTransform: 'uppercase', color: '#000', letterSpacing: '0.5px' }}>
                        Tableau du Matin & Actions du Jour
                    </div>
                    <div style={{ fontSize: '7.5pt', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '2px' }}>
                        Feuille de route opérationnelle atelier • Cocody Faya, Abidjan (Réf. {dateKey})
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '8.5pt', fontWeight: '900', background: '#000', color: '#FFF', padding: '1.5mm 3mm', borderRadius: '1mm', marginBottom: '4px', display: 'inline-block', textTransform: 'uppercase' }}>
                        {filterTitle}
                    </div>
                    <div style={{ fontSize: '10pt', fontWeight: '900', textTransform: 'capitalize', color: '#0071e3' }}>
                        {formattedDate}
                    </div>
                    <div style={{ fontSize: '7pt', color: '#888', fontWeight: 'bold' }}>
                        Édité le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </header>

            {/* KPI STATS BAR */}
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                <div style={{ background: '#000', color: '#fff', padding: '8px 12px', borderRadius: '1.5mm' }}>
                    <div style={{ fontSize: '6.5pt', textTransform: 'uppercase', fontWeight: 'bold', opacity: 0.8 }}>Total Prévu</div>
                    <div style={{ fontSize: '14pt', fontWeight: '900' }}>{stats.totalToday} <span style={{ fontSize: '8pt', fontWeight: 'normal' }}>actions</span></div>
                </div>
                <div style={{ border: '1.5pt solid #000', background: '#fff', padding: '8px 12px', borderRadius: '1.5mm' }}>
                    <div style={{ fontSize: '6.5pt', textTransform: 'uppercase', fontWeight: 'bold', color: '#666' }}>À Traiter</div>
                    <div style={{ fontSize: '14pt', fontWeight: '900', color: '#d97706' }}>{stats.todoCount}</div>
                </div>
                <div style={{ border: '1.5pt solid #000', background: '#fff', padding: '8px 12px', borderRadius: '1.5mm' }}>
                    <div style={{ fontSize: '6.5pt', textTransform: 'uppercase', fontWeight: 'bold', color: '#666' }}>Effectuées</div>
                    <div style={{ fontSize: '14pt', fontWeight: '900', color: '#059669' }}>{stats.doneCount}</div>
                </div>
                <div style={{ border: stats.overdueCount > 0 ? '1.5pt solid #dc2626' : '1.5pt solid #000', background: stats.overdueCount > 0 ? '#fef2f2' : '#fff', padding: '8px 12px', borderRadius: '1.5mm' }}>
                    <div style={{ fontSize: '6.5pt', textTransform: 'uppercase', fontWeight: 'bold', color: stats.overdueCount > 0 ? '#dc2626' : '#666' }}>En Retard</div>
                    <div style={{ fontSize: '14pt', fontWeight: '900', color: stats.overdueCount > 0 ? '#dc2626' : '#000' }}>{stats.overdueCount}</div>
                </div>
            </div>

            {/* ALERT BOX IF RETARDS */}
            {stats.overdueCount > 0 && filterCategory !== 'DONE' && (
                <div style={{ position: 'relative', zIndex: 1, border: '1.5pt solid #dc2626', background: '#fff5f5', padding: '8px 12px', borderRadius: '1.5mm', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '8pt', color: '#991b1b', fontWeight: 'bold' }}>
                        ⚠️ <strong>ATTENTION RETARDS :</strong> {stats.overdueCount} dossier(s) en attente dépassent le délai planifié. Priorité absolue de relance ce matin.
                    </div>
                </div>
            )}

            {/* TABLE DES ACTIONS */}
            <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
                <table className="zebra-actions" style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, width: '65px', textAlign: 'center' }}>Heure</th>
                            <th style={{ ...thStyle, width: '150px' }}>Client & Contact</th>
                            <th style={{ ...thStyle, width: '130px' }}>Appareil / Modèle</th>
                            <th style={thStyle}>Action Requise / Rappel</th>
                            <th style={{ ...thStyle, width: '100px', textAlign: 'center' }}>Statut & Visa</th>
                        </tr>
                    </thead>
                    <tbody>
                        {actions.length > 0 ? (
                            actions.map((item, idx) => {
                                const isDone = item.statut === 'FAIT';
                                const isOverdue = item.isOverdue || item.statut === 'EN_RETARD';

                                return (
                                    <tr key={item.id || idx} style={{ borderBottom: '0.8pt solid #ddd', backgroundColor: isOverdue ? '#fff8f8' : undefined }}>
                                        {/* 1. HEURE */}
                                        <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', fontSize: '9pt' }}>
                                            <div style={{ padding: '2px 4px', border: '0.8pt solid #000', borderRadius: '1mm', display: 'inline-block', backgroundColor: isDone ? '#eee' : isOverdue ? '#fee2e2' : '#f0f9ff' }}>
                                                {item.heure}
                                            </div>
                                        </td>

                                        {/* 2. CLIENT */}
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: '900', fontSize: '9pt', textTransform: 'uppercase', color: isDone ? '#777' : '#000' }}>
                                                {item.clientName}
                                            </div>
                                            {item.ticketId && (
                                                <div style={{ fontSize: '7.5pt', fontFamily: 'monospace', fontWeight: 'bold', color: '#0071e3', marginTop: '1px' }}>
                                                    Dossier #{item.ticketId}
                                                </div>
                                            )}
                                            {item.clientPhone && (
                                                <div style={{ fontSize: '7.5pt', color: '#444', fontFamily: 'monospace', marginTop: '2px' }}>
                                                    📞 {formatDisplayPhone(item.clientPhone)}
                                                </div>
                                            )}
                                        </td>

                                        {/* 3. APPAREIL */}
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 'bold', fontSize: '8.5pt', textTransform: 'uppercase' }}>
                                                {item.appareil || 'MacBook'}
                                            </div>
                                            {item.details && (
                                                <div style={{ fontSize: '7pt', color: '#666', marginTop: '2px', fontStyle: 'italic' }}>
                                                    {item.details}
                                                </div>
                                            )}
                                        </td>

                                        {/* 4. ACTION */}
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: isOverdue ? '900' : '700', fontSize: '8.5pt', color: isOverdue ? '#b91c1c' : '#000' }}>
                                                {item.action}
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                                {item.typeRappel && (
                                                    <span style={{ fontSize: '6.5pt', fontWeight: '900', padding: '1px 4px', border: '0.5pt solid #000', borderRadius: '0.5mm', textTransform: 'uppercase', backgroundColor: '#f5f5f5' }}>
                                                        {item.typeRappel.replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {isOverdue && (
                                                    <span style={{ fontSize: '6.5pt', fontWeight: '900', padding: '1px 4px', backgroundColor: '#dc2626', color: '#fff', borderRadius: '0.5mm', textTransform: 'uppercase' }}>
                                                        EN RETARD
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 5. STATUT & VISA */}
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                                <div style={{ fontSize: '7pt', fontWeight: '900', textTransform: 'uppercase', color: isDone ? '#059669' : isOverdue ? '#dc2626' : '#d97706' }}>
                                                    {isDone ? '☑ FAIT' : isOverdue ? '⚠️ RETARD' : '☐ À FAIRE'}
                                                </div>
                                                <div style={{ width: '100%', height: '18px', border: '0.5pt dashed #999', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6.5pt', color: '#aaa', marginTop: '2px' }}>
                                                    {isDone ? 'Validé' : 'Visa / Heure'}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#888', fontStyle: 'italic', fontSize: '10pt' }}>
                                    Aucune action répertoriée pour cette sélection.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* FOOTER & EMARGEMENT */}
            <footer style={{ position: 'relative', zIndex: 1, marginTop: 'auto', borderTop: '1.5pt solid #000', paddingTop: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr', gap: '15px' }}>
                    <div>
                        <div style={{ fontSize: '7pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '2px' }}>
                            Consignes Atelier & Traçabilité TGS-CI :
                        </div>
                        <p style={{ fontSize: '6.5pt', color: '#555', margin: 0, lineHeight: '1.4' }}>
                            1. Chaque appel téléphonique ou message WhatsApp envoyé doit être consigné sur cette feuille.<br />
                            2. Dès confirmation par le client (accord devis ou retrait), mettre à jour la fiche dans le système.<br />
                            3. Cette feuille doit être signée en fin de journée par le chef d'atelier et archivée.
                        </p>
                    </div>

                    <div style={{ border: '0.8pt solid #000', padding: '6px', borderRadius: '1.5mm', textAlign: 'center' }}>
                        <div style={{ fontSize: '6.5pt', fontWeight: '900', textTransform: 'uppercase', color: '#444' }}>Visa Technicien</div>
                        <div style={{ height: '24px' }}></div>
                    </div>

                    <div style={{ border: '0.8pt solid #000', padding: '6px', borderRadius: '1.5mm', textAlign: 'center' }}>
                        <div style={{ fontSize: '6.5pt', fontWeight: '900', textTransform: 'uppercase', color: '#444' }}>Visa Chef d'Atelier</div>
                        <div style={{ height: '24px' }}></div>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '6.5pt', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    TGS - CÔTE D'IVOIRE • COCODY FAYA • DOCUMENT INTERNE EXCLUSIF • CONFIDENTIEL
                </div>
            </footer>
        </div>
    );
};

export default PrintableDailyActions;
