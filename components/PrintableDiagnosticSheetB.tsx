
import React from 'react';
import { RepairTicket } from '../types.ts';

interface PrintableDiagnosticSheetBProps {
  ticket: RepairTicket;
}

const PrintableDiagnosticSheetB: React.FC<PrintableDiagnosticSheetBProps> = ({ ticket }) => {
  const data = ticket.diagnosticSheetB;
  const totalCost = (ticket.costs?.diagnostic || 0) + (ticket.costs?.repair || 0);
  const balance = totalCost - (ticket.costs?.advance || 0);

  const mainContainerStyle: React.CSSProperties = {
    fontFamily: '"Courier New", Courier, monospace',
    color: '#000',
    backgroundColor: 'white',
    width: '210mm',
    minHeight: '297mm',
    padding: '12mm',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    fontSize: '9pt',
  };

  const headerStyle: React.CSSProperties = {
    borderBottom: '2px solid #000',
    paddingBottom: '10px',
    marginBottom: '20px',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    margin: '10px 0',
  };

  const thStyle: React.CSSProperties = {
    backgroundColor: '#eee',
    padding: '5px',
    border: '1px solid #000',
    textAlign: 'left',
    fontSize: '8pt',
    fontWeight: 'bold'
  };

  const tdStyle: React.CSSProperties = {
    padding: '5px',
    border: '1px solid #000',
  };

  if (!data) {
      return <div style={mainContainerStyle}>Aucune expertise électronique disponible pour cette fiche.</div>;
  }

  return (
    <div style={mainContainerStyle}>
      <header style={headerStyle}>
        <div style={{ fontSize: '14pt', fontWeight: 'bold', textAlign: 'center' }}>TGS-CI - EXPERTISE ÉLECTRONIQUE AVANCÉE</div>
        <div style={{ fontSize: '9pt', textAlign: 'center', marginTop: '5px' }}>Dossier Technique N°: <strong>{ticket.id}</strong> | Modèle: <strong>{ticket.macModel}</strong></div>
      </header>

      <div style={{ marginBottom: '15px', border: '1px solid #000', padding: '8px' }}>
          <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '5px' }}>ÉTAT INITIAL (ARRIVÉE):</div>
          <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#c53030' }}>{data.entryCondition}</div>
      </div>

      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>RELEVÉS DE TENSIONS (MOTHERBOARD RAILS):</div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>LIGNE / RAIL</th>
            <th style={{ ...thStyle, width: '25%', textAlign: 'center' }}>VALEUR MESURÉE</th>
            <th style={{ ...thStyle, width: '25%', textAlign: 'center' }}>ÉTAT</th>
          </tr>
        </thead>
        <tbody>
          {data.tensionValues.map((t, i) => (
            <tr key={i}>
              <td style={tdStyle}>{t.line}</td>
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{t.value || 'N.C.'}</td>
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', color: t.status === 'Correct' ? 'green' : 'red' }}>{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>POINTS D'EXPERTISE & DIAGNOSTIC:</div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>POINT DE CONTRÔLE</th>
            <th style={thStyle}>OBSERVATIONS TECHNIQUES</th>
          </tr>
        </thead>
        <tbody>
          {data.diagnosticPoints.map((p, i) => (
            <tr key={i}>
              <td style={{ ...tdStyle, width: '40%', fontWeight: 'bold' }}>{p.item}</td>
              <td style={tdStyle}>{p.notes || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '10px', border: '1px solid #000', padding: '10px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>CONCLUSION D'INSPECTION VISUELLE :</div>
          <div style={{ minHeight: '60px', fontSize: '9pt' }}>{data.visualInspection || "Pas d'anomalie visuelle majeure signalée."}</div>
      </div>

      {/* GALERIE IMAGES EXPERTISE B */}
      {data.images && data.images.length > 0 && (
          <div style={{ marginTop: '15px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>PHOTOS DE L'EXPERTISE (CM) :</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {data.images.map((img, idx) => (
                      <div key={idx} style={{ border: '1px solid #000', height: '120px', overflow: 'hidden' }}>
                          <img src={img} alt="Preuve Expertise" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div style={{ border: '1px solid #000', padding: '8px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '8pt', borderBottom: '1px solid #000', marginBottom: '5px' }}>MODALITÉS</div>
              <div>Durée Expertise: <strong>{data.testDuration}</strong></div>
              <div>Délai Réparation: <strong>{data.repairDelay}</strong></div>
          </div>
          <div style={{ border: '1px solid #000', padding: '8px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '8pt', borderBottom: '1px solid #000', marginBottom: '5px' }}>RÉCAPITULATIF FINANCIER</div>
              <div style={{ textAlign: 'right' }}>Prix Fixé: <strong>{totalCost.toLocaleString('fr-FR')} F</strong></div>
              <div style={{ textAlign: 'right' }}>Avance Payée: <strong>{ticket.costs.advance.toLocaleString('fr-FR')} F</strong></div>
              <div style={{ textAlign: 'right', fontSize: '11pt', borderTop: '1px solid #000', marginTop: '3px' }}>SOLDE: <strong>{balance.toLocaleString('fr-FR')} F CFA</strong></div>
          </div>
      </div>

      <div style={{ marginTop: 'auto', textAlign: 'center', borderTop: '1px solid #000', paddingTop: '10px' }}>
          <div style={{ fontSize: '8pt', marginBottom: '15px' }}>
              Expert responsable : __________________________ Signature : __________________________
          </div>
          <div style={{ fontSize: '7pt', color: '#666' }}>
              TGS-CI | Document technique officiel à usage de preuve de conformité.
          </div>
      </div>
    </div>
  );
};

export default PrintableDiagnosticSheetB;
