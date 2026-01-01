
import React from 'react';
import { RepairTicket, CustomFieldDef } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableLegalFolderProps {
  ticket: RepairTicket;
  customFieldDefs: CustomFieldDef[];
}

const PrintableLegalFolder: React.FC<PrintableLegalFolderProps> = ({ ticket, customFieldDefs }) => {
  const totalCost = (ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0);
  const balance = totalCost - (ticket.costs.advance || 0);

  const mainContainerStyle: React.CSSProperties = {
    fontFamily: 'Arial, sans-serif',
    color: '#000',
    backgroundColor: 'white',
    width: '210mm',
    padding: '12mm',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    fontSize: '8.5pt',
    lineHeight: '1.3',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    backgroundColor: '#1a202c',
    color: '#fff',
    padding: '6px 12px',
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: '18px',
    marginBottom: '10px',
    fontSize: '9.5pt',
    letterSpacing: '0.5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const gridTableStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '150px 1fr',
    border: '1px solid #000',
    marginBottom: '12px'
  };

  const gridHeaderStyle: React.CSSProperties = {
    padding: '6px',
    backgroundColor: '#f3f4f6',
    borderRight: '1px solid #000',
    borderBottom: '1px solid #000',
    fontWeight: 'bold',
    fontSize: '7.5pt',
    textTransform: 'uppercase'
  };

  const gridValueStyle: React.CSSProperties = {
    padding: '6px',
    borderBottom: '1px solid #000',
    fontSize: '8.5pt'
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return 'Non renseigné';
    return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).replace(',', ' à');
  };

  const batteryLabel = {
      'unknown': 'INCONNU',
      'yes': 'FONCTIONNELLE',
      'no': 'NON FONCTIONNELLE'
  }[ticket.batteryFunctional] || 'INCONNU';

  return (
    <div style={mainContainerStyle}>
      {/* HEADER OFFICIEL JURIDIQUE */}
      <header style={{ borderBottom: '3px solid #000', paddingBottom: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '18pt', fontWeight: '900', color: '#000' }}>TGS - CI</div>
            <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>EXPERT MACBOOK INDÉPENDANT</div>
            <div style={{ fontSize: '7pt', color: '#444' }}>COCODY FAYA | ABIDJAN, CÔTE D'IVOIRE</div>
        </div>
        <div style={{ textAlign: 'center' }}>
            <AppleLogo style={{ width: '35px', height: '35px' }} />
        </div>
        <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11pt', fontWeight: '900', border: '2px solid #000', padding: '4px 10px', display: 'inline-block' }}>
                DOSSIER DE PREUVE N° {ticket.id}
            </div>
            <div style={{ fontSize: '7pt', marginTop: '4px', fontWeight: 'bold' }}>Généré le : {new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      </header>

      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <h1 style={{ fontSize: '12pt', fontWeight: '900', textTransform: 'uppercase', textDecoration: 'underline' }}>Synthèse de Conformité Technique et Engagement Contractuel</h1>
      </div>

      {/* 1. IDENTIFICATION */}
      <div style={sectionHeaderStyle}><span>1. Identification des Parties & Matériel</span></div>
      <div style={gridTableStyle}>
          <div style={gridHeaderStyle}>Titulaire du dossier</div>
          <div style={gridValueStyle}><strong>{ticket.client.name}</strong> ({ticket.client.phone})</div>
          
          <div style={gridHeaderStyle}>Appareil Identifié</div>
          <div style={gridValueStyle}><strong>{ticket.macBrand} {ticket.macModel}</strong></div>
          
          <div style={gridHeaderStyle}>État à la Réception</div>
          <div style={gridValueStyle}>
              {ticket.powersOn ? "S'allume / Réagit" : "Aucun allumage / Inerte"} | 
              Batterie : {batteryLabel} | 
              Chargeur : {ticket.chargerIncluded ? 'FOURNI' : 'ABSENT'}
          </div>

          <div style={gridHeaderStyle}>Problème Déclaré</div>
          <div style={{ ...gridValueStyle, borderBottom: 'none' }}>{ticket.problemDescription}</div>
      </div>

      {/* 2. TRAÇABILITÉ CHRONOLOGIQUE */}
      <div style={sectionHeaderStyle}><span>2. Traçabilité Chronologique de l'Intervention</span></div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', border: '1px solid #000' }}>
          <thead>
              <tr style={{ backgroundColor: '#f3f4f6', fontSize: '7pt', fontWeight: 'bold' }}>
                  <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>DATE / HEURE</th>
                  <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>OPÉRATEUR</th>
                  <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>ACTION / ÉTAPE RÉALISÉE</th>
              </tr>
          </thead>
          <tbody>
              {ticket.history.map((entry, idx) => (
                  <tr key={idx} style={{ fontSize: '7.5pt' }}>
                      <td style={{ border: '1px solid #000', padding: '4px', fontMono: 'monospace' }}>{formatDateTime(entry.timestamp)}</td>
                      <td style={{ border: '1px solid #000', padding: '4px' }}>{entry.user}</td>
                      <td style={{ border: '1px solid #000', padding: '4px' }}>{entry.action}</td>
                  </tr>
              ))}
          </tbody>
      </table>

      {/* 3. AUDIT TECHNIQUE COMPLET */}
      <div style={sectionHeaderStyle}><span>3. Audit Technique & Expertise Approfondie</span></div>
      <div style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#fafafa', marginBottom: '12px' }}>
          <div style={{ fontWeight: '900', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px' }}>RAPPORT DE DIAGNOSTIC FONCTIONNEL (FICHE A)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              {ticket.diagnosticReport?.map((dr, i) => (
                  <div key={i} style={{ borderBottom: '1px dashed #ccc', padding: '2px 0', fontSize: '7.5pt' }}>
                      <strong>{dr.component} :</strong> {dr.status} {dr.notes ? `[${dr.notes}]` : ''}
                  </div>
              ))}
          </div>

          {ticket.diagnosticSheetB && (
              <div style={{ marginTop: '12px', borderTop: '2px solid #000', paddingTop: '8px' }}>
                  <div style={{ fontWeight: '900', textDecoration: 'underline', marginBottom: '5px' }}>EXPERTISE ÉLECTRONIQUE AVANCÉE (FICHE B)</div>
                  <div style={{ fontSize: '8pt', marginBottom: '5px' }}><strong>Condition initiale :</strong> {ticket.diagnosticSheetB.entryCondition}</div>
                  <div style={{ fontSize: '8pt', whiteSpace: 'pre-wrap', backgroundColor: '#fff', padding: '5px', border: '1px solid #ddd' }}>
                      {ticket.diagnosticSheetB.visualInspection || "Aucune anomalie visuelle majeure signalée par l'expert."}
                  </div>
              </div>
          )}
          
          <div style={{ marginTop: '10px', fontWeight: 'bold', fontSize: '8pt' }}>Notes de l'expert :</div>
          <div style={{ fontSize: '8.5pt', fontStyle: 'italic', padding: '5px' }}>{ticket.technicianNotes || "Néant."}</div>
      </div>

      {/* FOOTER JURIDIQUE & SIGNATURES */}
      <div style={{ marginTop: 'auto', borderTop: '3px solid #000', paddingTop: '10px' }}>
          <div style={{ fontSize: '7pt', color: '#000', textAlign: 'justify', marginBottom: '15px', lineHeight: '1.3' }}>
              <strong>MENTIONS ET LIMITES DE RESPONSABILITÉ TGS CI :</strong> TGS CI agit selon une <strong>obligation de moyens</strong>. 
              La sauvegarde des données avant intervention relève de la <strong>responsabilité exclusive du client</strong> ; l'atelier ne pourra être tenu responsable de toute perte. 
              La <strong>garantie est limitée à 1 mois</strong> (30j). La garantie est <strong>annulée</strong> en cas de bris de scellé, oxydation, choc physique ou intervention d'un tiers. Tout appareil doit être retiré sous <strong>30 jours</strong> après avis de disponibilité.
              La signature ci-dessous vaut pour acceptation intégrale du rapport technique et des CGV susmentionnées.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
              <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase' }}>Accord Client & Reconnaissance des Faits</div>
                  <div style={{ height: '80px', border: '1.5px solid #000', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fcfcfc' }}>
                      {ticket.clientSignature && <img src={ticket.clientSignature} style={{ maxHeight: '90%', maxWidth: '95%' }} />}
                  </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase' }}>Visa TGS - CI (Cachet)</div>
                  <div style={{ height: '80px', border: '2px dashed #999', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ color: '#ccc', fontSize: '8pt' }}>VISA EXPERT</span>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default PrintableLegalFolder;
