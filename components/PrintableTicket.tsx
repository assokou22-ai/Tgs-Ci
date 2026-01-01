
import React from 'react';
import { RepairTicket, CustomFieldDef } from '../types.ts';
import { PrintSettings } from '../hooks/useAppSettings.ts';

interface PrintableTicketProps {
  ticket: RepairTicket;
  printSettings: PrintSettings;
  customFieldDefs: CustomFieldDef[];
}

const PrintableTicket: React.FC<PrintableTicketProps> = ({ ticket }) => {
  const diagnosticCost = ticket.costs?.diagnostic || 0;
  const advance = ticket.costs?.advance || 0;
  const total = (ticket.costs?.repair || 0) + diagnosticCost;
  const balance = total - advance;

  const batteryLabel = {
      'unknown': 'INCONNU',
      'yes': 'FONCTIONNELLE',
      'no': 'NON FONCTIONNELLE'
  }[ticket.batteryFunctional] || 'INCONNU';

  const containerStyle: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    padding: '12mm',
    backgroundColor: '#fff',
    color: '#000',
    fontFamily: '"Inter", "Helvetica", Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box'
  };

  const hrThick = { borderTop: '2pt solid #000', margin: '15px 0' };
  const hrThin = { borderTop: '0.5pt solid #000', margin: '10px 0' };

  return (
    <div style={containerStyle} className="print-container">
      {/* Header - ÉCO ENCRE (Bordures au lieu de fonds) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '28pt', fontWeight: '900', letterSpacing: '-1.5px', lineHeight: '1' }}>TGS - CI</div>
          <div style={{ fontSize: '9pt', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '5px' }}>
            Expertise & Réparation MacBook PRO
          </div>
          <div style={{ fontSize: '8pt', marginTop: '10px', lineHeight: '1.4' }}>
            Abidjan, Cocody Faya, Carrefour Coq Ivoir<br/>
            Contact: +225 07 57 13 35 07 / 05 74 51 84 47<br/>
            Email: thegoodstoreci@gmail.com
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ 
            border: '2pt solid #000', 
            padding: '8px 15px', 
            backgroundColor: '#fff', 
            color: '#000',
            textAlign: 'center',
            borderRadius: '4px'
          }}>
            <div style={{ fontSize: '7pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>Bon de Dépôt Officiel</div>
            <div style={{ fontSize: '22pt', fontWeight: '900', fontFamily: '"JetBrains Mono", monospace' }}>
              {ticket.id}
            </div>
          </div>
          <div style={{ fontSize: '8pt', marginTop: '8px', fontWeight: 'bold' }}>
            DATE: {new Date(ticket.createdAt).toLocaleDateString('fr-FR')} à {new Date(ticket.createdAt).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
          </div>
        </div>
      </div>

      <div style={hrThick}></div>

      {/* Section I : Client & Appareil */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        <div>
          <div style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '5px' }}>I. Propriétaire du Matériel</div>
          <div style={{ fontSize: '14pt', fontWeight: '900' }}>{ticket.client.name}</div>
          <div style={{ fontSize: '11pt', fontWeight: 'bold', fontFamily: '"JetBrains Mono", monospace' }}>{ticket.client.phone}</div>
          {ticket.client.email && <div style={{ fontSize: '9pt' }}>{ticket.client.email}</div>}
        </div>
        <div>
          <div style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '5px' }}>II. Identification Machine</div>
          <div style={{ fontSize: '14pt', fontWeight: '900' }}>{ticket.macBrand} {ticket.macModel}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
             <span style={{ border: '1pt solid #000', padding: '2px 6px', fontSize: '7pt', fontWeight: 'bold' }}>ALLUMAGE: {ticket.powersOn ? 'OUI' : 'NON'}</span>
             <span style={{ border: '1pt solid #000', padding: '2px 6px', fontSize: '7pt', fontWeight: 'bold' }}>BATTERIE: {batteryLabel}</span>
          </div>
        </div>
      </div>

      <div style={hrThin}></div>

      {/* Section III : Problème */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>III. Description de la Panne (Symptômes constatés)</div>
        <div style={{ 
            border: '0.5pt solid #000', 
            padding: '15px', 
            fontSize: '11pt', 
            lineHeight: '1.5',
            fontStyle: 'italic',
            minHeight: '50px'
        }}>
          "{ticket.problemDescription}"
        </div>
      </div>

      {/* Section IV : Coûts */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px' }}>IV. Analyse Financière Prévisionnelle</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1.5pt solid #000' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: '9pt' }}>DÉSIGNATION DES TRAVAUX</th>
              <th style={{ textAlign: 'right', padding: '8px 0', fontSize: '9pt' }}>MONTANT (F CFA)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '0.5pt solid #eee' }}>
              <td style={{ padding: '8px 0', fontSize: '10pt' }}>Audit technique & expertise circuits</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: '"JetBrains Mono", monospace' }}>{diagnosticCost.toLocaleString('fr-FR')}</td>
            </tr>
            {ticket.services.map((s, i) => (
              <tr key={i} style={{ borderBottom: '0.5pt solid #eee' }}>
                <td style={{ padding: '8px 0', fontSize: '10pt' }}>
                  <strong>{s.name}</strong><br/>
                  <small style={{ fontSize: '7pt', textTransform: 'uppercase', color: '#666' }}>{s.category}</small>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: '"JetBrains Mono", monospace' }}>{s.price.toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totaux - ÉCO ENCRE (Contours gras au lieu de blocs noirs) */}
      <div style={{ marginLeft: 'auto', width: '280px', marginTop: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '9pt' }}>
          <span>Total Estimation :</span>
          <span style={{ fontWeight: 'bold' }}>{total.toLocaleString('fr-FR')} F</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '9pt' }}>
          <span>Acompte Perçu :</span>
          <span style={{ fontWeight: 'bold' }}>- {advance.toLocaleString('fr-FR')} F</span>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          padding: '10px', 
          border: '2pt solid #000',
          marginTop: '5px',
          borderRadius: '4px'
        }}>
          <span style={{ fontWeight: '900', fontSize: '11pt' }}>SOLDE À RÉGLER :</span>
          <span style={{ fontWeight: '900', fontSize: '13pt', fontFamily: '"JetBrains Mono", monospace' }}>{balance.toLocaleString('fr-FR')} F</span>
        </div>
      </div>

      {/* CONDITIONS GÉNÉRALES TGS CI */}
      <div style={{ 
          marginTop: '25px', 
          fontSize: '7.2pt', 
          lineHeight: '1.4', 
          textAlign: 'justify', 
          border: '0.5pt solid #000', 
          padding: '10px',
          borderRadius: '2px'
      }}>
        <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '5px', fontSize: '8pt' }}>CONDITIONS GÉNÉRALES TGS CI :</div>
        1. <strong>OBLIGATION DE MOYEN :</strong> L'atelier TGS CI est tenu à une obligation de moyens et non de résultat.<br/>
        2. <strong>RESPONSABILITÉ DES DONNÉES :</strong> La sauvegarde des données relève de la responsabilité <strong>exclusive</strong> du client. TGS CI décline toute responsabilité en cas de perte.<br/>
        3. <strong>GARANTIE :</strong> Garantie de <strong>1 mois (30 jours)</strong> sur la pièce ou la prestation spécifique réalisée.<br/>
        4. <strong>ANNULATION DE GARANTIE :</strong> Garantie annulée si : bris de scellé TGS CI, oxydation après réparation, choc, ou ouverture par un tiers.<br/>
        5. <strong>RETRAIT :</strong> Le matériel doit être retiré sous <strong>30 jours</strong>. Après 60 jours, il est considéré comme abandonné.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '5px' }}>ACCORD CLIENT (SIGNATURE)</div>
          <div style={{ border: '0.5pt solid #000', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {ticket.clientSignature ? <img src={ticket.clientSignature} style={{ maxHeight: '90%', maxWidth: '90%' }} /> : <span style={{ color: '#eee', fontSize: '7pt' }}>Signature Numérique</span>}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '5px' }}>CACHET ATELIER TGS CI</div>
          <div style={{ border: '0.5pt dashed #000', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <span style={{ color: '#eee', fontWeight: '900', fontSize: '18pt', transform: 'rotate(-5deg)' }}>TGS-CI</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintableTicket;
