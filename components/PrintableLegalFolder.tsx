
import React from 'react';
import { RepairTicket, CustomFieldDef } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableLegalFolderProps {
  ticket: RepairTicket;
  customFieldDefs: CustomFieldDef[];
}

const PrintableLegalFolder: React.FC<PrintableLegalFolderProps> = ({ ticket }) => {
  const sectionHeaderStyle: React.CSSProperties = {
    backgroundColor: '#f5f5f7',
    color: '#000',
    padding: '5px 10px',
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: '15px',
    marginBottom: '8px',
    fontSize: '8.5pt',
    letterSpacing: '0.5px',
    borderLeft: '3pt solid #000'
  };

  const gridTableStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '150px 1fr',
    border: '0.8pt solid #eee',
    marginBottom: '10px'
  };

  const gridHeaderStyle: React.CSSProperties = {
    padding: '5px 8px',
    backgroundColor: '#fafafa',
    borderRight: '0.8pt solid #eee',
    borderBottom: '0.8pt solid #eee',
    fontWeight: '700',
    fontSize: '7.5pt',
    textTransform: 'uppercase',
    color: '#666'
  };

  const gridValueStyle: React.CSSProperties = {
    padding: '5px 8px',
    borderBottom: '0.8pt solid #eee',
    fontSize: '8.5pt'
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="printable-page">
      <header style={{ borderBottom: '2pt solid #000', paddingBottom: '12px', marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '5px' }}>
            <AppleLogo style={{ width: '28px', height: '28px', color: '#000' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '20pt', fontWeight: '900', color: '#000', letterSpacing: '0.02em' }}>TGS - CI</div>
              <div style={{ fontSize: '7.5pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666' }}>Département Expertise Technique</div>
          </div>
          <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10pt', fontWeight: '900', border: '1.2pt solid #000', padding: '4px 10px', display: 'inline-block' }}>
                  DOSSIER JURIDIQUE N° {ticket.id}
              </div>
              <div style={{ fontSize: '7.5pt', marginTop: '3px', fontWeight: 'bold' }}>Archivé le {new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>
      </header>

      <div style={sectionHeaderStyle}>1. Identification du Dossier</div>
      <div style={gridTableStyle}>
          <div style={gridHeaderStyle}>Titulaire</div>
          <div style={gridValueStyle}><strong>{ticket.client.name}</strong> ({ticket.client.phone})</div>
          <div style={gridHeaderStyle}>Matériel</div>
          <div style={gridValueStyle}><strong>{ticket.macBrand} {ticket.macModel}</strong> | S/N: {ticket.serialNumber || 'N/A'}</div>
          <div style={gridHeaderStyle}>Date d'Entrée</div>
          <div style={{ ...gridValueStyle, borderBottom: 'none' }}>{formatDateTime(ticket.createdAt)}</div>
      </div>

      <div style={sectionHeaderStyle}>2. État Initial Matériel</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
          <div style={{ border: '0.4pt solid #DDD', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#666' }}>Chargeur</div>
            <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>{ticket.chargerIncluded ? 'OUI' : 'NON'}</div>
          </div>
          <div style={{ border: '0.4pt solid #DDD', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#666' }}>Batterie</div>
            <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>{ticket.batteryFunctional === 'yes' ? 'OK' : ticket.batteryFunctional === 'no' ? 'HS' : 'Inconnue'}</div>
          </div>
          <div style={{ border: '0.4pt solid #DDD', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#666' }}>Allumage</div>
            <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>{ticket.powersOn ? 'OUI' : 'NON'}</div>
          </div>
      </div>

      <div style={sectionHeaderStyle}>3. Journal des Interventions</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '7.5pt' }}>
          <thead>
              <tr style={{ backgroundColor: '#000', color: '#fff' }}>
                  <th style={{ padding: '5px', textAlign: 'left', width: '110px' }}>Date</th>
                  <th style={{ padding: '5px', textAlign: 'left', width: '80px' }}>Auteur</th>
                  <th style={{ padding: '5px', textAlign: 'left' }}>Action Réalisée</th>
              </tr>
          </thead>
          <tbody style={{ border: '0.8pt solid #eee' }}>
              {ticket.history.map((entry, idx) => (
                  <tr key={idx} style={{ borderBottom: '0.4pt solid #eee' }}>
                      <td style={{ padding: '5px', fontFamily: 'monospace' }}>{formatDateTime(entry.timestamp)}</td>
                      <td style={{ padding: '5px', fontWeight: 'bold' }}>{entry.user.toUpperCase()}</td>
                      <td style={{ padding: '5px' }}>{entry.action}</td>
                  </tr>
              ))}
          </tbody>
      </table>

      <div style={{ marginTop: 'auto' }}>
          <div style={sectionHeaderStyle}>4. Cadre Légal TGS-CI</div>
          <div style={{ fontSize: '8.5pt', color: '#000', textAlign: 'left', marginBottom: '20px', padding: '10px', border: '1pt solid #000', backgroundColor: '#fafafa' }}>
              <div style={{ fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '0.5pt solid #000', paddingBottom: '3px' }}>
                  Clauses et Conditions Générales :
              </div>
              <div>• <strong>Diagnostic :</strong> 5 000 F CFA fixes, non remboursables.</div>
              <div>• <strong>Données :</strong> Sauvegarde à la charge du client exclusivement.</div>
              <div>• <strong>Garantie :</strong> 30 jours sur l'intervention effectuée.</div>
              <div>• <strong>Délais :</strong> Abandon réputé après 90 jours sans retrait.</div>
              <div style={{ marginTop: '5px', fontWeight: 'bold', color: '#c53030' }}>
                  • Accord Client : L'ouverture pour diagnostic peut annuler la garantie constructeur.
              </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '3px' }}>Titulaire</div>
                  <div style={{ fontSize: '7pt', fontStyle: 'italic', marginBottom: '3px' }}>"Lu et Approuvé"</div>
                  <div style={{ height: '60px', border: '0.8pt solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {ticket.clientSignature && <img src={ticket.clientSignature} style={{ maxHeight: '90%' }} />}
                  </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px' }}>Visa Expert TGS-CI</div>
                  <div style={{ height: '60px', border: '0.8pt dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ color: '#ccc', fontWeight: '900', fontSize: '9pt' }}>VISA TECHNIQUE</span>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default PrintableLegalFolder;
