import React from 'react';
import { MacbookIcon } from './icons.tsx';

interface PrintableSimpleDocumentProps {
  title: string;
  content: string;
  date?: string;
}

const PrintableSimpleDocument: React.FC<PrintableSimpleDocumentProps> = ({ title, content, date }) => {
  
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px',
    borderBottom: '2px solid #333',
    paddingBottom: '20px',
    color: 'black',
  };

  const mainContainerStyle: React.CSSProperties = {
    fontFamily: 'sans-serif',
    color: '#333',
    padding: '40px',
    backgroundColor: 'white',
    width: '210mm',
    minHeight: '297mm', // A4 min height
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={mainContainerStyle}>
      <header style={headerStyle}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '28px', margin: '0 0 8px 0', fontWeight: 'bold', color: '#1a202c' }}>TGS-CI</h1>
          <div style={{ fontSize: '12px', color: '#555', marginTop: '8px', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
{`FAYA CARREFOUR COQ IVOIR
commune de COCODY,  COTE D'IVOIRE

+225 0757133507 / +225 0574518447`}
          </div>
        </div>
        <div style={{ flex: 'none', textAlign: 'center' }}>
            <MacbookIcon style={{ height: '50px', width: '50px', color: '#999' }} />
        </div>
        <div style={{flex: 1, textAlign: 'right'}}>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>Date : <strong>{date ? new Date(date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}</strong></p>
        </div>
      </header>
      
      <main style={{ flex: 1 }}>
          {title && (
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '30px', textAlign: 'center', textTransform: 'uppercase' }}>
                {title}
            </h2>
          )}
          
          <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', textAlign: 'justify' }}>
              {content}
          </div>
      </main>

      <footer style={{ marginTop: '50px', textAlign: 'center', fontSize: '10px', color: '#718096', borderTop: '1px solid #eee', paddingTop: '15px' }}>
        <p style={{margin: '5px 0 0 0'}}>RéparerMonMac / TGS-CI / thegoodstoreci@gmail.com / www.reparermonmac.com</p>
      </footer>
    </div>
  );
};

export default PrintableSimpleDocument;