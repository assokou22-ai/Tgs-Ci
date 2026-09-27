
import React from 'react';
import { RepairTicket } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableFunctionalTestsSheetProps {
  ticket: RepairTicket;
}

const PrintableFunctionalTestsSheet: React.FC<PrintableFunctionalTestsSheetProps> = ({ ticket }) => {
  const tests = [
    { category: "SYSTÈME", items: ["Démarrage OS", "Réactivité Finder", "Mise en veille / Sortie", "Extinction complète"] },
    { category: "AFFICHAGE", items: ["Luminosité (Min/Max)", "Capteur lumière ambiante", "Pas de pixels morts", "Webcam"] },
    { category: "ENTRÉES", items: ["Clavier (Toutes touches)", "Rétroéclairage Clavier", "Trackpad (Clic & Force)", "Touch ID / Touch Bar"] },
    { category: "AUDIO", items: ["Haut-parleurs (Gauche/Droit)", "Microphone interne", "Prise Jack 3.5mm"] },
    { category: "CONNECTIVITÉ", items: ["Wi-Fi (Détection & Connexion)", "Bluetooth", "Ports USB-C / Thunderbolt", "Charge (MagSafe / USB-C)"] },
    { category: "ALIMENTATION", items: ["Cycle de charge batterie", "Détection chargeur", "Température stable"] }
  ];

  const dateSortie = new Date().toLocaleDateString('fr-FR');

  return (
    <div className="printable-page" style={{ color: '#000', padding: '15mm', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ borderBottom: '2.5pt solid #000', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AppleLogo style={{ width: '24px', height: '24px', color: '#000' }} />
                <h1 style={{ fontSize: '22pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
            </div>
            <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '5px' }}>Contrôle Qualité & Certification de Sortie</div>
        </div>
        <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12pt', fontWeight: '900', border: '1.5pt solid #000', padding: '3px 8px', display: 'inline-block' }}>RAPPORT P4</div>
            <div style={{ fontSize: '8pt', marginTop: '4px', fontWeight: 'bold' }}>Dossier #{ticket.id}</div>
        </div>
      </header>

      <div style={{ background: '#f5f5f7', padding: '15px', border: '1pt solid #ddd', marginBottom: '25px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
              <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>Appareil</div>
              <div style={{ fontSize: '11pt', fontWeight: '900' }}>{ticket.macBrand} {ticket.macModel}</div>
              <div style={{ fontSize: '8.5pt' }}>S/N : {ticket.serialNumber}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>Client</div>
              <div style={{ fontSize: '11pt', fontWeight: '900' }}>{ticket.client.name}</div>
              <div style={{ fontSize: '8.5pt' }}>Date du test : {dateSortie}</div>
          </div>
      </div>

      <h2 style={{ fontSize: '11pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '15px', borderBottom: '1pt solid #000', paddingBottom: '5px' }}>
        ✅ Tests de Fonctionnalité - Fin de Travaux
      </h2>

      <div style={{ marginBottom: '30px' }}>
          {tests.map((section, idx) => (
              <div key={idx} style={{ marginBottom: '15px', breakInside: 'avoid' }}>
                  <h3 style={{ fontSize: '9pt', fontWeight: 'bold', backgroundColor: '#eee', padding: '4px 8px', marginBottom: '0', border: '1pt solid #ccc', borderBottom: 'none' }}>{section.category}</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1pt solid #ccc' }}>
                      <tbody>
                          {section.items.map((test, i) => (
                              <tr key={i} style={{ borderBottom: '1pt solid #eee' }}>
                                  <td style={{ padding: '6px 10px', fontSize: '8.5pt', width: '60%' }}>{test}</td>
                                  <td style={{ padding: '6px 10px', borderLeft: '1pt solid #eee', textAlign: 'center', width: '20%' }}>
                                      <span style={{ fontSize: '8pt', fontWeight: 'bold' }}>CONFORME</span>
                                  </td>
                                  <td style={{ padding: '6px 10px', borderLeft: '1pt solid #eee', textAlign: 'center', width: '20%' }}>
                                      <div style={{ width: '12px', height: '12px', border: '1pt solid #000', margin: '0 auto', background: '#000' }}></div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          ))}
      </div>

      <div style={{ border: '1pt solid #000', padding: '15px', marginBottom: '20px' }}>
          <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px' }}>Observations Finales / Réserves :</div>
          <div style={{ height: '40px', borderBottom: '1pt dashed #ccc' }}></div>
          <div style={{ height: '40px', borderBottom: '1pt dashed #ccc' }}></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: 'auto' }}>
          <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '40px' }}>VISA TECHNICIEN CONTRÔLEUR</div>
              <div style={{ borderTop: '1pt solid #000', width: '80%', margin: '0 auto' }}></div>
          </div>
          <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '40px' }}>RÉCEPTION CLIENT (Pour accord)</div>
              <div style={{ borderTop: '1pt solid #000', width: '80%', margin: '0 auto' }}></div>
          </div>
      </div>

      <footer style={{ textAlign: 'center', fontSize: '7pt', color: '#888', marginTop: '20px', borderTop: '1pt solid #eee', paddingTop: '10px' }}>
          Document de certification interne TGS-CI. La signature du client vaut validation du bon fonctionnement de l'appareil.
      </footer>
    </div>
  );
};

export default PrintableFunctionalTestsSheet;
