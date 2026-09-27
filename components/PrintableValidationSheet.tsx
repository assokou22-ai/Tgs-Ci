
import React from 'react';
import { RepairTicket } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableValidationSheetProps {
  ticket: RepairTicket;
}

const PrintableValidationSheet: React.FC<PrintableValidationSheetProps> = ({ ticket }) => {
  const checkListItems = [
    "Démarrage & Séquence de Boot",
    "Affichage (Luminosité, Pixels morts)",
    "Clavier (Toutes touches, Rétroéclairage)",
    "Trackpad (Clic, Déplacement, Gestes)",
    "Audio (Haut-parleurs Gauche/Droit)",
    "Microphone & Webcam",
    "Connectivité (Wi-Fi, Bluetooth)",
    "Ports (USB-C, MagSafe, Audio Jack)",
    "Charge & Détection Adaptateur",
    "Batterie (État, Cycles)",
    "Capteurs (TouchID, Ambient Light)",
    "Ventilation & Températures",
    "Esthétique (Nettoyage, Vis serrées)"
  ];

  const styles = {
    page: { padding: '15mm', color: '#000', fontSize: '9pt', lineHeight: '1.4' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2pt solid #000', paddingBottom: '10px', marginBottom: '20px' },
    logoSection: { display: 'flex', alignItems: 'center', gap: '8px' },
    logo: { width: '24px', height: '24px' },
    companyName: { fontSize: '18pt', fontWeight: '900', margin: 0 },
    docTitle: { fontSize: '12pt', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' as const, border: '1pt solid #000', padding: '5px 10px', marginTop: '10px' },
    infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' },
    infoBox: { border: '1pt solid #ccc', padding: '10px' },
    infoLabel: { fontSize: '7pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666', marginBottom: '2px' },
    infoValue: { fontSize: '10pt', fontWeight: 'bold' },
    table: { width: '100%', borderCollapse: 'collapse' as const, marginBottom: '20px' },
    th: { border: '1pt solid #000', padding: '5px', backgroundColor: '#f0f0f0', textAlign: 'left' as const, fontSize: '8pt', fontWeight: 'bold' },
    td: { border: '1pt solid #000', padding: '5px' },
    checkbox: { width: '12px', height: '12px', border: '1pt solid #000', display: 'inline-block', marginRight: '5px' },
    footer: { marginTop: '30px', borderTop: '1pt solid #eee', paddingTop: '10px', textAlign: 'center' as const, fontSize: '7pt', color: '#888' }
  };

  return (
    <div className="printable-page" style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.logoSection}>
            <AppleLogo style={{ ...styles.logo, color: '#000' }} />
            <h1 style={styles.companyName}>TGS - CI</h1>
          </div>
          <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#555' }}>Expertise & Maintenance Apple</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14pt', fontWeight: '900', color: '#000' }}>#{ticket.id}</div>
          <div style={{ fontSize: '8pt' }}>{new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      </header>

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ ...styles.docTitle, display: 'inline-block' }}>Fiche de Contrôle Qualité & Validation</div>
      </div>

      <div style={styles.infoGrid}>
        <div style={styles.infoBox}>
          <div style={styles.infoLabel}>Client / Propriétaire</div>
          <div style={styles.infoValue}>{ticket.client.name}</div>
          <div>{ticket.client.phone}</div>
        </div>
        <div style={styles.infoBox}>
          <div style={styles.infoLabel}>Matériel</div>
          <div style={styles.infoValue}>{ticket.macBrand} {ticket.macModel}</div>
          <div>S/N: {ticket.serialNumber || 'N/A'}</div>
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Points de Contrôle</th>
            <th style={{ ...styles.th, width: '60px', textAlign: 'center' }}>Conforme</th>
            <th style={{ ...styles.th, width: '60px', textAlign: 'center' }}>N/A</th>
            <th style={styles.th}>Observations / Notes</th>
          </tr>
        </thead>
        <tbody>
          {checkListItems.map((item, index) => (
            <tr key={index}>
              <td style={styles.td}>{item}</td>
              <td style={{ ...styles.td, textAlign: 'center' }}><div style={styles.checkbox}></div></td>
              <td style={{ ...styles.td, textAlign: 'center' }}><div style={styles.checkbox}></div></td>
              <td style={styles.td}></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginBottom: '20px', border: '1pt solid #000', padding: '10px', height: '80px' }}>
        <div style={styles.infoLabel}>Observations Finales du Technicien</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '20px' }}>
        <div style={{ border: '1pt solid #ccc', padding: '15px', height: '100px' }}>
          <div style={styles.infoLabel}>Visa Technicien / Contrôle Qualité</div>
        </div>
        <div style={{ border: '1pt solid #ccc', padding: '15px', height: '100px' }}>
          <div style={styles.infoLabel}>Visa Client (Pour réception conforme)</div>
          <div style={{ fontSize: '7pt', fontStyle: 'italic', marginTop: '5px' }}>
            Je reconnais avoir vérifié le bon fonctionnement de mon appareil sur les points ci-dessus et je valide la réparation.
          </div>
        </div>
      </div>

      <footer style={styles.footer}>
        TGS-CI - Cocody Faya, Carrefour Coq Ivoir - +225 07 57 13 35 07 - Document interne
      </footer>
    </div>
  );
};

export default PrintableValidationSheet;
