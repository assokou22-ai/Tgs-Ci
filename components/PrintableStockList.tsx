import React from 'react';
import { StockItem } from '../types.ts';
import { MacbookIcon } from './icons.tsx';

interface PrintableStockListProps {
  stock: StockItem[];
}

const PrintableStockList: React.FC<PrintableStockListProps> = ({ stock }) => {
  const headerStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: '24px',
    borderBottom: '2px solid #333',
    paddingBottom: '16px',
    color: 'black',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '10px',
    color: 'black',
  };

  const thStyle: React.CSSProperties = {
    padding: '8px',
    border: '1px solid #ddd',
    backgroundColor: '#f2f2f2',
    textAlign: 'left',
  };

  const tdStyle: React.CSSProperties = {
    padding: '8px',
    border: '1px solid #ddd',
  };

  return (
    <div style={{ fontFamily: 'sans-serif', color: '#333', padding: '20px', backgroundColor: 'white', width: '210mm' }}>
      <header style={headerStyle}>
        <div style={{ marginBottom: '16px' }}>
            <MacbookIcon style={{ height: '50px', width: '50px', color: '#999', margin: '0 auto' }} />
        </div>
        <h1 style={{ fontSize: '24px', margin: '0 0 8px 0', fontWeight: 'bold' }}>TGS-CI</h1>
        <p style={{ fontSize: '16px', margin: 0, marginBottom: '8px' }}>Rapport d'Inventaire du Stock</p>
        <div style={{ fontSize: '12px', color: '#555', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
{`FAYA CARREFOUR COQ IVOIR
commune de COCODY,  COTE D'IVOIRE

+225 0757133507 / +225 0574518447`}
        </div>
      </header>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: 'black' }}>
        <div><strong>Date du rapport:</strong> {new Date().toLocaleDateString('fr-FR')}</div>
        <div><strong>Total d'articles uniques:</strong> {stock.length}</div>
      </div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Nom de l'article</th>
            <th style={thStyle}>Référence</th>
            <th style={thStyle}>Catégorie</th>
            <th style={thStyle}>Quantité</th>
            <th style={thStyle}>Coût d'achat (Unitaire)</th>
          </tr>
        </thead>
        <tbody>
          {[...stock].sort((a, b) => a.name.localeCompare(b.name)).map((item) => (
            <tr key={item.id}>
              <td style={tdStyle}>{item.name}</td>
              <td style={tdStyle}>{item.reference || '-'}</td>
              <td style={tdStyle}>{item.category}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{(item.cost || 0).toLocaleString('fr-FR')} F</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PrintableStockList;