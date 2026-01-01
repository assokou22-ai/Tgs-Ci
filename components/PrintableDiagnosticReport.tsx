
import React from 'react';
import { RepairTicket } from '../types.ts';

interface PrintableDiagnosticReportProps {
  ticket: RepairTicket;
}

const PrintableDiagnosticReport: React.FC<PrintableDiagnosticReportProps> = ({ ticket }) => {
  const mainContainerStyle: React.CSSProperties = {
    fontFamily: 'Helvetica, Arial, sans-serif',
    color: '#000',
    backgroundColor: 'white',
    width: '210mm',
    minHeight: '297mm',
    padding: '15mm',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    fontSize: '10pt',
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return 'Non renseigné';
    return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).replace(',', ' à');
  };

  return (
    <div style={mainContainerStyle}>
      <header style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '3px solid #000', paddingBottom: '12px' }}>
        <div style={{ fontWeight: '900', fontSize: '18pt', letterSpacing: '-1px' }}>TGS CI</div>
        <div style={{ fontWeight: 'bold', fontSize: '12pt', textTransform: 'uppercase' }}>Département Réparer mon Macbook</div>
        <div style={{ fontSize: '10pt', marginTop: '10px', textDecoration: 'underline', fontWeight: 'bold' }}>RAPPORT DE DIAGNOSTIC FONCTIONNEL</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '8.5pt', marginTop: '15px', color: '#000', textAlign: 'left' }}>
            <div>
                Dossier N°: <strong>{ticket.id}</strong><br/>
                Créé le: <strong>{formatDateTime(ticket.createdAt)}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
                Expertisé le: <strong>{formatDateTime(ticket.diagnosticCreatedAt)}</strong><br/>
                Édité le: <strong>{formatDateTime(new Date().toISOString())}</strong>
            </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div style={{ border: '2px solid #000', padding: '12px', borderRadius: '4px' }}>
              <div style={{ fontSize: '8pt', color: '#000', fontWeight: '900', textTransform: 'uppercase' }}>Titulaire du Dossier</div>
              <div style={{ fontWeight: 'black', fontSize: '11pt' }}>{ticket.client.name}</div>
              <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>{ticket.client.phone}</div>
          </div>
          <div style={{ border: '2px solid #000', padding: '12px', borderRadius: '4px' }}>
              <div style={{ fontSize: '8pt', color: '#000', fontWeight: '900', textTransform: 'uppercase' }}>Appareil Expertisé</div>
              <div style={{ fontWeight: 'black', fontSize: '11pt' }}>{ticket.macModel}</div>
              <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>Statut: {ticket.status}</div>
          </div>
      </div>

      {ticket.estimatedWorkDelay && (
        <div style={{ marginBottom: '15px', padding: '10px', border: '2px solid #000', borderRadius: '4px', textAlign: 'center', backgroundColor: '#f9f9f9' }}>
          <span style={{ fontSize: '1.1em', fontWeight: '900', color: '#000' }}>
            DÉLAI ESTIMÉ POUR LA RÉPARATION : <span style={{ color: '#FF0000' }}>{ticket.estimatedWorkDelay}</span>
          </span>
        </div>
      )}

      <div style={{ fontWeight: '900', backgroundColor: '#000', color: '#fff', padding: '6px 12px', marginBottom: '10px', fontSize: '10pt' }}>POINTS DE CONTRÔLE MATÉRIELS</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5px' }}>
        <thead>
          <tr style={{ backgroundColor: '#eee', fontWeight: '900', fontSize: '8.5pt' }}>
            <th style={{ border: '1.5px solid #000', padding: '8px', textAlign: 'left', color: '#000' }}>Composant</th>
            <th style={{ border: '1.5px solid #000', padding: '8px', textAlign: 'center', width: '120px', color: '#000' }}>État</th>
            <th style={{ border: '1.5px solid #000', padding: '8px', textAlign: 'left', color: '#000' }}>Observations Techniques</th>
          </tr>
        </thead>
        <tbody>
          {ticket.diagnosticReport?.map((check, index) => (
            <tr key={index} style={{ fontSize: '9pt' }}>
              <td style={{ border: '1px solid #000', padding: '8px', fontWeight: '900', color: '#000' }}>{check.component}</td>
              <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: '900', color: '#FF0000' }}>{check.status}</td>
              <td style={{ border: '1px solid #000', padding: '8px', color: '#FF0000', fontWeight: 'bold' }}>{check.notes || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {ticket.diagnosticImages && ticket.diagnosticImages.length > 0 && (
          <div style={{ marginTop: '25px' }}>
              <div style={{ fontWeight: '900', backgroundColor: '#000', color: '#fff', padding: '6px 12px', marginBottom: '10px', fontSize: '10pt' }}>ANNEXES VISUELLES</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  {ticket.diagnosticImages.map((img, idx) => (
                      <div key={idx} style={{ border: '1.5px solid #000', borderRadius: '4px', overflow: 'hidden', height: '140px' }}>
                          <img src={img} alt="Expertise" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div style={{ marginTop: 'auto', borderTop: '2.5px solid #000', paddingTop: '15px' }}>
          <div style={{ fontSize: '8pt', color: '#000', textAlign: 'justify', lineHeight: '1.4', marginBottom: '15px' }}>
              <strong>MENTIONS LÉGALES :</strong><br/>
              - Le Prestataire n'est tenu qu'à une obligation de moyens.<br/>
              - En cas de panne critique de carte mère sur MacBook récents, les données peuvent être irrémédiablement perdues.<br/>
              - Le matériel doit être retiré sous 1 mois après cet avis.<br/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', textAlign: 'center' }}>
              <div>
                  <div style={{ fontSize: '8.5pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '45px' }}>Visa Technicien</div>
                  <div style={{ borderBottom: '1.5px solid #000', width: '80%', margin: '0 auto' }}></div>
              </div>
              <div>
                  <div style={{ fontSize: '8.5pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '45px' }}>Accord Client</div>
                  <div style={{ borderBottom: '1.5px solid #000', width: '80%', margin: '0 auto' }}></div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default PrintableDiagnosticReport;
