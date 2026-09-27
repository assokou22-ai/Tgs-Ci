
import React from 'react';
import { Commande } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableOngoingOrdersListProps {
  commandes: Commande[];
}

const PrintableOngoingOrdersList: React.FC<PrintableOngoingOrdersListProps> = ({ commandes }) => {
  const totalPending = commandes.reduce((sum, c) => sum + (c.total - (c.advance || 0)), 0);

  return (
    <div className="printable-page" style={{ color: '#000', padding: '15mm', backgroundColor: '#fff' }}>
      <style>
        {`
          @media print {
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
          }
          .zebra-table tr:nth-child(even) { background-color: #f9f9f9; }
        `}
      </style>

      {/* FILIGRANE ARRIÈRE PLAN */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-45deg)', fontSize: '120pt', fontWeight: '900', color: 'rgba(0,0,0,0.03)', pointerEvents: 'none', zIndex: 0, whiteSpace: 'nowrap' }}>
        DOCUMENT INTERNE
      </div>

      <header style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5pt solid #000', paddingBottom: '15px', marginBottom: '25px' }}>
          <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AppleLogo style={{ width: '28px', height: '28px', color: '#000' }} />
                  <h1 style={{ fontSize: '24pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
              </div>
              <div style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase', marginTop: '5px', color: '#555', letterSpacing: '1px' }}>
                Rapport Logistique : Suivi des flux entrants
              </div>
          </div>
          <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#888', textTransform: 'uppercase' }}>Extraction du registre le</div>
              <div style={{ fontSize: '11pt', fontWeight: '900' }}>
                {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
          </div>
      </header>

      <div style={{ position: 'relative', zIndex: 1, marginBottom: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#000', color: '#fff', padding: '15px', borderRadius: '2mm' }}>
              <p style={{ fontSize: '7pt', textTransform: 'uppercase', marginBottom: '5px', opacity: 0.8 }}>Volume global en attente</p>
              <p style={{ fontSize: '18pt', fontWeight: '900', margin: 0 }}>{commandes.length} Dossiers Commandés</p>
          </div>
          <div style={{ border: '1.5pt solid #000', padding: '15px', borderRadius: '2mm', textAlign: 'right' }}>
              <p style={{ fontSize: '7pt', color: '#888', textTransform: 'uppercase', marginBottom: '5px' }}>Encours financier (Reliquat dû)</p>
              <p style={{ fontSize: '18pt', fontWeight: '900', color: '#0071e3', margin: 0 }}>{totalPending.toLocaleString()} F CFA</p>
          </div>
      </div>

      <table className="zebra-table" style={{ position: 'relative', zIndex: 1, width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
              <tr style={{ borderBottom: '2pt solid #000', fontSize: '8.5pt', fontWeight: '900', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1.5pt solid #000' }}>Référence</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1.5pt solid #000' }}>Entité / Destination</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1.5pt solid #000' }}>Matériel Concerné</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', borderBottom: '1.5pt solid #000' }}>Date</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right', borderBottom: '1.5pt solid #000' }}>Solde Dû</th>
              </tr>
          </thead>
          <tbody>
              {commandes.length > 0 ? (
                  commandes.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '0.5pt solid #ddd', fontSize: '9pt' }}>
                          <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontWeight: 'bold', color: '#0071e3' }}>{c.numero}</td>
                          <td style={{ padding: '12px 8px' }}>
                              <div style={{ fontWeight: '800', textTransform: 'uppercase' }}>{c.supplierName}</div>
                              {c.clientName && <div style={{ fontSize: '7.5pt', color: '#666', marginTop: '2px' }}>Dossier: {c.clientName}</div>}
                          </td>
                          <td style={{ padding: '12px 8px', fontWeight: '500' }}>{c.macModel || 'Pièces détachées diverses'}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', color: '#444' }}>{new Date(c.date).toLocaleDateString('fr-FR')}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '900', fontSize: '10pt' }}>
                            {(c.total - (c.advance || 0)).toLocaleString()} F
                          </td>
                      </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: '#aaa', fontStyle: 'italic', fontSize: '11pt' }}>
                        Aucun flux logistique en attente de réception.
                      </td>
                  </tr>
              )}
          </tbody>
      </table>

      <footer style={{ position: 'relative', zIndex: 1, marginTop: 'auto', borderTop: '0.5pt solid #eee', paddingTop: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '50px' }}>
              <div>
                  <p style={{ fontSize: '7.5pt', color: '#777', lineHeight: '1.5', margin: 0 }}>
                    <strong>CERTIFICATION :</strong> Ce rapport est une pièce comptable interne destinée au suivi des commandes fournisseurs TGS-CI.<br/>
                    Toute anomalie de réception doit être signalée au responsable logistique sous 24h.<br/>
                    <em>TGS-CI | Cocody Faya, Carrefour Coq Ivoir.</em>
                  </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '40px', borderBottom: '0.5pt solid #eee', paddingBottom: '5px' }}>
                    Visa Logistique & Appro.
                  </div>
                  <div style={{ borderBottom: '1pt solid #000', width: '180px', margin: '0 auto' }}></div>
                  <div style={{ fontSize: '6pt', color: '#aaa', marginTop: '5px' }}>Signature et Cachet</div>
              </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '6.5pt', color: '#ccc', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '2px' }}>
            Logiciel de Gestion TGS-CI • Edition Pro 2025
          </div>
      </footer>
    </div>
  );
};

export default PrintableOngoingOrdersList;
