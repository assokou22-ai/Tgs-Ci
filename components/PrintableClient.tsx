
import React from 'react';
import { RepairTicket, Client } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableClientProps {
  client: Client;
  tickets: RepairTicket[];
}

const PrintableClient: React.FC<PrintableClientProps> = ({ client, tickets }) => {
  const totalBilled = tickets.reduce((acc, curr) => acc + (curr.costs.diagnostic || 0) + (curr.costs.repair || 0), 0);
  const totalAdvanced = tickets.reduce((acc, curr) => acc + (curr.costs.advance || 0), 0);
  const balance = totalBilled - totalAdvanced;

  return (
    <div className="printable-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <AppleLogo style={{ width: '25px', height: '25px', color: '#000' }} />
                  <h1 style={{ fontSize: '24pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
              </div>
              <div style={{ fontSize: '7pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666' }}>L'excellence de la réparation MacBook</div>
          </div>
          <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '18pt', fontWeight: '900', borderBottom: '3pt solid #000', paddingBottom: '3px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Fiche Client</h2>
              <div style={{ fontSize: '9pt', color: '#666', marginTop: '3px' }}>Date d'impression: {new Date().toLocaleDateString('fr-FR')}</div>
          </div>
      </div>

      <div style={{ border: '1pt solid #000', padding: '20px', marginBottom: '30px', background: '#F9F9F9' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                  <div style={{ fontSize: '7pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666', marginBottom: '5px' }}>Informations Client :</div>
                  <div style={{ fontSize: '14pt', fontWeight: '900' }}>{client.name.toUpperCase()}</div>
                  <div style={{ fontSize: '11pt', fontWeight: '700', marginTop: '5px', fontFamily: 'monospace' }}>Tél: {client.phone}</div>
                  {client.email && <div style={{ fontSize: '10pt', color: '#444' }}>Email: {client.email}</div>}
                  {client.id && <div style={{ fontSize: '9pt', color: '#888', marginTop: '5px' }}>ID: {client.id}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '7pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666', marginBottom: '5px' }}>Résumé Financier :</div>
                  <div style={{ fontSize: '10pt' }}>Total Facturé: <strong>{totalBilled.toLocaleString()} F</strong></div>
                  <div style={{ fontSize: '10pt' }}>Total Avances: <strong style={{ color: '#2f855a' }}>{totalAdvanced.toLocaleString()} F</strong></div>
                  <div style={{ fontSize: '14pt', fontWeight: '900', marginTop: '10px', borderTop: '1pt solid #000', paddingTop: '5px' }}>
                      SOLDE DÛ: <span style={{ color: balance > 0 ? '#c53030' : '#2f855a' }}>{balance.toLocaleString()} F CFA</span>
                  </div>
              </div>
          </div>
      </div>

      <h3 style={{ fontSize: '12pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '15px', borderBottom: '1pt solid #EEE', paddingBottom: '5px' }}>Historique des Interventions ({tickets.length})</h3>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
              <tr style={{ background: '#000', color: '#FFF' }}>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '8pt' }}>RÉFÉRENCE</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '8pt' }}>DATE</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '8pt' }}>APPAREIL</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '8pt' }}>STATUT</th>
                  <th style={{ padding: '8px', textAlign: 'right', fontSize: '8pt' }}>TOTAL (F)</th>
              </tr>
          </thead>
          <tbody>
              {tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((ticket) => (
                  <tr key={ticket.id} style={{ borderBottom: '0.5pt solid #EEE' }}>
                      <td style={{ padding: '8px', fontSize: '9pt', fontWeight: 'bold', fontFamily: 'monospace' }}>{ticket.id}</td>
                      <td style={{ padding: '8px', fontSize: '9pt' }}>{new Date(ticket.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '8px', fontSize: '9pt' }}>{ticket.macBrand} {ticket.macModel}</td>
                      <td style={{ padding: '8px', fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase' }}>{ticket.status}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '9pt', fontWeight: 'bold' }}>
                          {((ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0)).toLocaleString()}
                      </td>
                  </tr>
              ))}
          </tbody>
      </table>

      <div style={{ marginTop: 'auto' }}>
          <footer style={{ marginTop: '40px', textAlign: 'center', padding: '12px 0', borderTop: '0.5pt solid #EEE', fontSize: '7pt', color: '#AAA', fontWeight: 'bold', textTransform: 'uppercase' }}>
            TGS - Côte d'Ivoire | Cocody Faya | +225 07 57 13 35 07 | Workshop Certified
          </footer>
      </div>
    </div>
  );
};

export default PrintableClient;
