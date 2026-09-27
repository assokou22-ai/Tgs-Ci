
import React from 'react';
import { AppleLogo } from './icons.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';

interface PrintableSimpleDocumentProps {
  title: string;
  content: string;
  date?: string;
  recipientName?: string;
}

const PrintableSimpleDocument: React.FC<PrintableSimpleDocumentProps> = ({ title, content, date, recipientName }) => {
  const { settings } = useAppSettings();
  const shop = settings.workshop || {
    name: 'TGS-CI',
    address: 'Cocody Faya, Carrefour Coq Ivoir',
    phone: '+225 07 57 13 35 07',
    email: 'thegoodstoreci@gmail.com',
    register: 'RCCM CI-ABJ-03-2023-B13-05421'
  };

  return (
    <div className="printable-page" style={{ color: '#000', padding: '15mm 15mm' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', borderBottom: '2.5pt solid #000', paddingBottom: '15px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
              <AppleLogo style={{ width: '22px', height: '22px', color: '#000' }} />
              <h1 style={{ fontSize: '24pt', margin: 0, fontWeight: '900', color: '#000', letterSpacing: '0.02em' }}>{shop.name}</h1>
          </div>
          <div style={{ fontSize: '7.5pt', fontWeight: '900', textTransform: 'uppercase', color: '#666', marginBottom: '8px' }}>Expertise & Maintenance Apple Certifiée</div>
          <div style={{ fontSize: '8.5pt', color: '#333', lineHeight: '1.3', whiteSpace: 'pre-line', textAlign: 'left' }}>
{`${shop.address}
${shop.phone}
${shop.email}`}
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '10pt', fontWeight: '900', background: '#000', color: '#FFF', padding: '1.5mm 3mm', display: 'inline-block', borderRadius: '1mm', marginBottom: '5px' }}>DOCUMENT OFFICIEL</div>
            <p style={{ margin: '5px 0', fontSize: '11pt', fontWeight: '900' }}>Fait à Abidjan, le {date ? new Date(date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}</p>
            {recipientName && (
                <div style={{ marginTop: '5px', fontSize: '9pt', fontWeight: '800', color: '#0071e3', textTransform: 'uppercase' }}>
                    TITULAIRE : {recipientName}
                </div>
            )}
        </div>
      </header>
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {title && (
            <h2 style={{ fontSize: '15pt', fontWeight: '900', textDecoration: 'none', marginBottom: '25px', textAlign: 'center', textTransform: 'uppercase', border: '1.5pt solid #000', padding: '3mm' }}>
                {title}
            </h2>
          )}
          
          <div style={{ fontSize: '11pt', lineHeight: '1.8', whiteSpace: 'pre-wrap', textAlign: 'justify', color: '#000', flex: 1 }}>
              {content}
          </div>
      </main>

      <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
          <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>BÉNÉFICIAIRE</div>
              <div style={{ fontSize: '7pt', fontStyle: 'italic', marginBottom: '10px' }}>{recipientName ? recipientName.toUpperCase() : '(Signature)'}</div>
              <div style={{ border: '1pt solid #000', height: '30mm', width: '100%', background: '#FBFBFD' }}></div>
          </div>
          <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>POUR {shop.name.toUpperCase()}</div>
              <div style={{ fontSize: '7pt', fontStyle: 'italic', marginBottom: '10px' }}>(Cachet et Visa de la Direction)</div>
              <div style={{ border: '1pt dashed #DDD', height: '30mm', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#EEE', fontWeight: '900', fontSize: '14pt' }}>{shop.name.toUpperCase()}</span>
              </div>
          </div>
      </div>

      <footer style={{ marginTop: '25px', textAlign: 'center', fontSize: '7.5px', color: '#999', borderTop: '0.5pt solid #eee', paddingTop: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>
        {shop.name} | RCCM: {shop.register || 'RCCM CI-ABJ-03-2023-B13-05421'} | {shop.phone} | {shop.email}
      </footer>
    </div>
  );
};

export default PrintableSimpleDocument;
