
import React from 'react';
import { RepairTicket } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableWarrantyReportProps {
  ticket: RepairTicket;
}

const PrintableWarrantyReport: React.FC<PrintableWarrantyReportProps> = ({ ticket }) => {
  const dateSAV = new Date().toLocaleDateString('fr-FR');

  return (
    <div className="printable-page" style={{ color: '#000', padding: '15mm', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ borderBottom: '2.5pt solid #c53030', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AppleLogo style={{ width: '24px', height: '24px', color: '#000' }} />
                <h1 style={{ fontSize: '22pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
            </div>
            <div style={{ fontSize: '9pt', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '5px', color: '#c53030' }}>SERVICE APRÈS-VENTE & GARANTIE</div>
        </div>
        <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12pt', fontWeight: '900', border: '1.5pt solid #c53030', color:'#c53030', padding: '3px 8px', display: 'inline-block' }}>RAPPORT SAV</div>
            <div style={{ fontSize: '8pt', marginTop: '4px', fontWeight: 'bold' }}>Dossier Initial #{ticket.id}</div>
        </div>
      </header>

      <div style={{ background: '#fff5f5', padding: '15px', border: '1pt solid #fc8181', marginBottom: '25px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
              <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>Client</div>
              <div style={{ fontSize: '11pt', fontWeight: '900' }}>{ticket.client.name}</div>
              <div style={{ fontSize: '8.5pt' }}>{ticket.client.phone}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>Machine</div>
              <div style={{ fontSize: '11pt', fontWeight: '900' }}>{ticket.macBrand} {ticket.macModel}</div>
              <div style={{ fontSize: '8.5pt' }}>S/N : {ticket.serialNumber}</div>
          </div>
      </div>

      <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '10pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px', borderBottom: '1pt solid #000', paddingBottom: '3px' }}>
            1. Motif du Retour (Déclaration Client)
          </h2>
          <div style={{ padding: '10px', border: '1pt dashed #ccc', minHeight: '60px', fontSize: '10pt', fontStyle: 'italic' }}>
              "{ticket.reInterventionReason || 'Non spécifié'}"
          </div>
      </div>

      <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '10pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px', borderBottom: '1pt solid #000', paddingBottom: '3px' }}>
            2. Diagnostic SAV & Cause Racine
          </h2>
          <div style={{ padding: '10px', background: '#f9f9f9', fontSize: '9pt', lineHeight: '1.4' }}>
              <p>Suite au retour de l'appareil, l'expertise technique a permis d'isoler la cause suivante :</p>
              <div style={{ marginTop: '10px', fontWeight: 'bold' }}>
                  {ticket.warrantyInterventionReport ? "Voir rapport détaillé ci-dessous." : "Analyse technique effectuée en atelier."}
              </div>
          </div>
      </div>

      <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '10pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px', borderBottom: '1pt solid #000', paddingBottom: '3px' }}>
            3. Actions Correctives (Sous Garantie)
          </h2>
          <div style={{ padding: '15px', border: '1pt solid #000', minHeight: '150px', fontSize: '10pt', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
              {ticket.warrantyInterventionReport || "Aucun rapport d'intervention saisi."}
          </div>
      </div>

      <div style={{ marginTop: 'auto', borderTop: '1.5pt solid #000', paddingTop: '15px' }}>
          <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '5px' }}>VALIDATION DE SORTIE SAV</div>
          <p style={{ fontSize: '7.5pt', lineHeight: '1.3', marginBottom: '30px' }}>
              L'appareil a subi une nouvelle série de tests. Le défaut signalé a été corrigé. 
              Le client reconnaît récupérer son matériel en état de fonctionnement.
              Cette intervention prolonge la garantie initiale uniquement sur la pièce remplacée (si applicable).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
              <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '40px' }}>VISA TECHNICIEN SAV</div>
                  <div style={{ borderTop: '1pt solid #000', width: '80%', margin: '0 auto' }}></div>
              </div>
              <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '40px' }}>RÉCEPTION CLIENT (Après Test)</div>
                  <div style={{ borderTop: '1pt solid #000', width: '80%', margin: '0 auto' }}></div>
              </div>
          </div>
      </div>

      <footer style={{ textAlign: 'center', fontSize: '7pt', color: '#888', marginTop: '20px', borderTop: '1pt solid #eee', paddingTop: '10px' }}>
          TGS-CI - Service Qualité & Satisfaction Client. Fait à Abidjan le {dateSAV}.
      </footer>
    </div>
  );
};

export default PrintableWarrantyReport;
