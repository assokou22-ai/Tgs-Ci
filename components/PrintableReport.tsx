import React from 'react';
import { RepairTicket } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableReportProps {
  periodType: 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
  selectedMonth: number;
  selectedYear: number;
  tickets: RepairTicket[];
  metrics: {
    totalBilled: number;
    totalAdvanced: number;
    totalRefunded?: number;
    balance: number;
    ticketCount: number;
    clientCount: number;
  };
}

const PrintableReport: React.FC<PrintableReportProps> = ({
  periodType,
  startDate,
  endDate,
  selectedMonth,
  selectedYear,
  tickets,
  metrics,
}) => {
  const monthsFr = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const getPeriodLabel = () => {
    if (periodType === 'week') {
      const start = new Date(startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const end = new Date(endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `SEMAINE DU ${start} AU ${end}`;
    } else if (periodType === 'month') {
      return `MOIS DE ${monthsFr[selectedMonth - 1].toUpperCase()} ${selectedYear}`;
    } else {
      return `ANNÉE COMPLÈTE ${selectedYear}`;
    }
  };

  return (
    <div className="printable-page" style={{ padding: '4px', color: '#000', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <AppleLogo style={{ width: '22px', height: '22px', color: '#000' }} />
            <h1 style={{ fontSize: '20pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
          </div>
          <div style={{ fontSize: '7pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#555' }}>L'excellence multimédia & réparation macbook</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: '13pt', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rapport & Bilan d'Activité</h2>
          <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#666', marginTop: '2px' }}>{getPeriodLabel()}</div>
        </div>
      </div>

      {/* Overview stats table/grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '20px' }}>
        <div style={{ border: '1px solid #CCC', borderRadius: '4px', padding: '6px 4px', textAlign: 'center', background: '#F9F9F9' }}>
          <div style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#555', textTransform: 'uppercase' }}>Fiches Créées</div>
          <div style={{ fontSize: '13pt', fontWeight: '900', marginTop: '4px' }}>{metrics.ticketCount}</div>
        </div>
        <div style={{ border: '1px solid #CCC', borderRadius: '4px', padding: '6px 4px', textAlign: 'center', background: '#F9F9F9' }}>
          <div style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#555', textTransform: 'uppercase' }}>Clients Uniques</div>
          <div style={{ fontSize: '13pt', fontWeight: '900', marginTop: '4px' }}>{metrics.clientCount}</div>
        </div>
        <div style={{ border: '1px solid #CCC', borderRadius: '4px', padding: '6px 4px', textAlign: 'center', background: '#F9F9F9' }}>
          <div style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#555', textTransform: 'uppercase' }}>Total Facturé</div>
          <div style={{ fontSize: '11pt', fontWeight: '900', color: '#000', marginTop: '4px' }}>{metrics.totalBilled.toLocaleString()} F</div>
        </div>
        <div style={{ border: '1px solid #CCC', borderRadius: '4px', padding: '6px 4px', textAlign: 'center', background: '#F4FEF4', borderColor: '#B2EBB2' }}>
          <div style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#2E7D32', textTransform: 'uppercase' }}>Avances Reçues</div>
          <div style={{ fontSize: '11pt', fontWeight: '900', color: '#2E7D32', marginTop: '4px' }}>{metrics.totalAdvanced.toLocaleString()} F</div>
        </div>
        <div style={{ border: '1px solid #CCC', borderRadius: '4px', padding: '6px 4px', textAlign: 'center', background: '#FEF4F4', borderColor: '#F8C8C8' }}>
          <div style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#C62828', textTransform: 'uppercase' }}>Remboursé</div>
          <div style={{ fontSize: '11pt', fontWeight: '900', color: '#C62828', marginTop: '4px' }}>{(metrics.totalRefunded || 0).toLocaleString()} F</div>
        </div>
        <div style={{ border: '1px solid #CCC', borderRadius: '4px', padding: '6px 4px', textAlign: 'center', background: '#FFFDF4', borderColor: '#EBD2B2' }}>
          <div style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#855A2F', textTransform: 'uppercase' }}>Restes à Percevoir</div>
          <div style={{ fontSize: '11pt', fontWeight: '900', color: '#855A2F', marginTop: '4px' }}>{metrics.balance.toLocaleString()} F</div>
        </div>
      </div>

      {/* Main Table Title */}
      <h3 style={{ fontSize: '10pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid #CCC', paddingBottom: '3px' }}>
        Détail des {tickets.length} interventions enregistrées sur la période
      </h3>

      {/* Report Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', marginBottom: '25px' }}>
        <thead>
          <tr style={{ background: '#000', color: '#FFF' }}>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 'bold' }}>N° FICHE (ID)</th>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 'bold' }}>DATE</th>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 'bold' }}>CLIENT & TÉLÉPHONE</th>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 'bold' }}>APPAREIL (MARQUE & MODÈLE)</th>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 'bold' }}>STATUT</th>
            <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 'bold' }}>BILLED</th>
            <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 'bold' }}>AVANCE</th>
            <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 'bold' }}>RESTE</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#777', fontStyle: 'italic' }}>
                Aucune fiche enregistrée sur cette période.
              </td>
            </tr>
          ) : (
            tickets
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((t) => {
                const isCanceled = t.status === 'Annulé';
                const billed = isCanceled ? 0 : ((t.costs.diagnostic || 0) + (t.costs.repair || 0));
                const advance = isCanceled ? 0 : (t.costs.advance || 0);
                const balance = billed - advance;
                return (
                  <tr key={t.id} style={{ borderBottom: '0.5px solid #DDD' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', fontFamily: 'monospace' }}>{t.id}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{new Date(t.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ fontWeight: 'bold' }}>{t.client.name}</div>
                      <div style={{ fontSize: '7pt', color: '#555', fontFamily: 'monospace' }}>{t.client.phone}</div>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      {t.macBrand} {t.macModel}
                      {t.modelNumber && <span style={{ fontSize: '7pt', color: '#666', fontFamily: 'monospace', marginLeft: '4px' }}>({t.modelNumber})</span>}
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: '900', textTransform: 'uppercase', fontSize: '7pt', color: isCanceled ? '#C62828' : '#000' }}>
                      {isCanceled && (t.costs.advance || 0) > 0 ? 'Annulé (Remboursé)' : t.status}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{billed.toLocaleString()}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: isCanceled ? '#C62828' : '#2E7D32' }}>
                      {isCanceled && (t.costs.advance || 0) > 0 ? (
                        <span style={{ textDecoration: 'line-through' }}>
                          {(t.costs.advance || 0).toLocaleString()}
                        </span>
                      ) : (
                        advance > 0 ? advance.toLocaleString() : '0'
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: balance > 0 ? '#C62828' : '#000' }}>{balance.toLocaleString()}</td>
                  </tr>
                );
              })
          )}
        </tbody>
      </table>

      {/* Signature & Validation Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', fontSize: '8pt' }}>
        <div>
          <div>Document généré automatiquement à : {new Date().toLocaleTimeString('fr-FR')}</div>
          <div style={{ color: '#777' }}>Auteur de la session : Service TGS Administration</div>
        </div>
        <div style={{ textAlign: 'right', marginRight: '20px' }}>
          <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '35px' }}>Signature de la Direction</div>
          <div style={{ fontSize: '7pt', color: '#888' }}>[ Cachet & Signature TGS-CI ]</div>
        </div>
      </div>

      {/* Standard layout footer */}
      <footer style={{ marginTop: '50px', textAlign: 'center', padding: '10px 0', borderTop: '0.5px solid #DDD', fontSize: '7pt', color: '#999', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        The Good Store Côte d'Ivoire | Cocody Faya | Route d'Abatta | Tél: +225 07 57 13 35 07 / +225 05 56 94 35 10
      </footer>
    </div>
  );
};

export default PrintableReport;
