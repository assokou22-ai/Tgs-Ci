
import React from 'react';
import { RepairTicket, LegalTemplateId } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableLegalDocumentProps {
  ticket: RepairTicket;
  template: LegalTemplateId;
}

const PrintableLegalDocument: React.FC<PrintableLegalDocumentProps> = ({ ticket, template }) => {
  const dateStr = new Date().toLocaleDateString('fr-FR');
  const clientName = ticket.client.name.toUpperCase();
  const macDesc = `${ticket.macBrand} ${ticket.macModel} ${ticket.modelNumber ? `(Model ${ticket.modelNumber})` : ''} (S/N: ${ticket.serialNumber || 'NON PRÉCISÉ'})`;

  const getTemplateContent = () => {
    switch (template) {
      case 'attestation':
        return {
          title: "ATTESTATION DE RÉPARATION ET BON FONCTIONNEMENT",
          body: `Je soussigné, Responsable technique chez TGS-CI, certifie par la présente avoir procédé à la réparation et à l'expertise complète de l'appareil cité en référence.\n\nPROPRIÉTAIRE : ${clientName}\nAPPAREIL : ${macDesc}\n\nTravaux effectués :\n${ticket.services.map(s => `• ${s.name}`).join('\n') || '• Maintenance technique curative'}\n\nL'appareil a été soumis à une batterie de tests post-réparation (Stabilité système, Charge, Ports E/S, Affichage) et est déclaré fonctionnel à la remise au client ce jour.\n\nLa présente attestation est délivrée pour valoir ce que de droit.`
        };
      case 'cession':
        return {
          title: "ACTE DE CESSION ET DÉCHARGE DE RESPONSABILITÉ",
          body: `Je soussigné(e), ${clientName}, détenteur du contact ${ticket.client.phone}, certifie sur l'honneur être le propriétaire légitime du matériel décrit ci-dessous et avoir la pleine capacité de le céder.\n\nDÉSIGNATION DU MATÉRIEL :\n- Appareil : ${macDesc}\n- Couleur : ${ticket.macColor || 'N/A'}\n\nJe cède ce jour ledit matériel à l'entreprise TGS-CI pour la somme convenue de ......................... F CFA.\n\nJe certifie formellement que ce matériel n'est pas issu d'un vol, d'un recel ou de tout autre acte frauduleux. Par la présente, je décharge l'entreprise TGS-CI de toute responsabilité concernant la provenance de cet appareil.\n\nMention manuscrite « Lu et approuvé, bon pour cession » :\n........................................................................................................`
        };
      default:
        return { title: "", body: "" };
    }
  };

  const content = getTemplateContent();

  return (
    <div className="printable-page" style={{ color: '#000', padding: '15mm' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5pt solid #000', paddingBottom: '15px', marginBottom: '30px' }}>
          <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <AppleLogo style={{ width: '22px', height: '22px', color: '#000' }} />
                  <h1 style={{ fontSize: '24pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
              </div>
              <div style={{ fontSize: '7.5pt', fontWeight: '900', textTransform: 'uppercase', color: '#555' }}>Expertise & Maintenance Apple Certifiée</div>
              <div style={{ fontSize: '8.5pt', color: '#333', marginTop: '5px' }}>Abidjan, Cocody Faya<br/>+225 07 57 13 35 07</div>
          </div>
          <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10pt', fontWeight: '900', background: '#000', color: '#FFF', padding: '1.5mm 3mm', borderRadius: '1mm', marginBottom: '4px', display: 'inline-block' }}>DOCUMENT OFFICIEL</div>
              <div style={{ fontSize: '9pt', color: '#666', fontWeight: 'bold' }}>Fait à Abidjan, le {dateStr}</div>
              <div style={{ fontSize: '8pt', color: '#0071e3', fontWeight: 'bold', marginTop: '2px' }}>Réf Dossier : #{ticket.id}</div>
          </div>
      </header>

      <main style={{ flex: 1 }}>
        <h2 style={{ fontSize: '15pt', fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', border: '1.5pt solid #000', padding: '4mm', marginBottom: '40px' }}>
            {content.title}
        </h2>

        <div style={{ fontSize: '11pt', lineHeight: '1.8', whiteSpace: 'pre-wrap', textAlign: 'justify', marginBottom: '40px' }}>
            {content.body}
        </div>
      </main>

      <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
          <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>BÉNÉFICIAIRE</div>
              <div style={{ fontSize: '7pt', fontStyle: 'italic', marginBottom: '10px' }}>(Signature précédée de la mention manuscrite)</div>
              <div style={{ border: '1pt solid #000', height: '35mm', width: '100%', background: '#FBFBFD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {template === 'attestation' && ticket.clientSignature && <img src={ticket.clientSignature} style={{ maxHeight: '90%' }} />}
              </div>
          </div>
          <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>POUR TGS-CI</div>
              <div style={{ fontSize: '7pt', fontStyle: 'italic', marginBottom: '10px' }}>(Cachet et Visa de la Direction)</div>
              <div style={{ border: '1pt dashed #DDD', height: '35mm', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#EEE', fontWeight: '900', fontSize: '14pt' }}>TGS - CI</span>
              </div>
          </div>
      </div>

      <footer style={{ marginTop: '30px', textAlign: 'center', borderTop: '0.5pt solid #EEE', paddingTop: '15px', fontSize: '7pt', color: '#AAA', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px' }}>
          TGS - CÔTE D'IVOIRE | COCODY FAYA | DOCUMENT DE CONTRÔLE INTERNE | CONFIDENTIEL
      </footer>
    </div>
  );
};

export default PrintableLegalDocument;
