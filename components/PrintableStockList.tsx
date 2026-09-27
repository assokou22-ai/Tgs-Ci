
import React from 'react';
import { StockItem } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableStockListProps {
  stock: StockItem[];
}

const PrintableStockList: React.FC<PrintableStockListProps> = ({ stock }) => {
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '8.5pt',
    color: '#000',
  };

  const thStyle: React.CSSProperties = {
    padding: '8px 10px',
    border: '0.8pt solid #000',
    backgroundColor: '#f2f2f2',
    textAlign: 'left',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontSize: '7.5pt',
    letterSpacing: '0.5px'
  };

  const tdStyle: React.CSSProperties = {
    padding: '8px 10px',
    border: '0.8pt solid #000',
    verticalAlign: 'top'
  };

  const sortedStock = [...stock].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="printable-page" style={{ color: '#000', padding: '15mm' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5pt solid #000', paddingBottom: '15px', marginBottom: '20px' }}>
          <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <AppleLogo style={{ width: '22px', height: '22px', color: '#000' }} />
                  <h1 style={{ fontSize: '24pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
              </div>
              <div style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase', color: '#555' }}>Inventaire Technique & Picking Logistique</div>
          </div>
          <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10pt', fontWeight: '900', background: '#000', color: '#FFF', padding: '1.5mm 3mm', borderRadius: '1mm', marginBottom: '4px', display: 'inline-block' }}>STOCK WORKSHOP</div>
              <div style={{ fontSize: '8pt', color: '#666', fontWeight: 'bold' }}>Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</div>
          </div>
      </header>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '9pt', fontWeight: 'bold' }}>
        <div style={{ textTransform: 'uppercase', borderLeft: '3pt solid #000', paddingLeft: '10px' }}>Atelier Principal - Abidjan</div>
        <div>Volume d'inventaire : <span style={{ fontSize: '11pt' }}>{stock.length} Références</span></div>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>DÉSIGNATION & COMPATIBILITÉ</th>
            <th style={{ ...thStyle, width: '100px' }}>ÉTAT / COUL.</th>
            <th style={{ ...thStyle, width: '120px' }}>EMPLACEMENT</th>
            <th style={{ ...thStyle, textAlign: 'center', width: '50px' }}>QTÉ</th>
            <th style={{ ...thStyle, textAlign: 'right', width: '100px' }}>VALEUR UNIT.</th>
          </tr>
        </thead>
        <tbody>
          {sortedStock.map((item) => (
            <tr key={item.id}>
              <td style={tdStyle}>
                  <div style={{ fontWeight: '900', fontSize: '9.5pt', textTransform: 'uppercase' }}>{item.name}</div>
                  <div style={{ fontSize: '7pt', color: '#666', marginTop: '2px', fontWeight: 'bold' }}>
                      MODELE: {item.compatibleModels || 'UNIVERSEL'} | CAT: {item.category}
                  </div>
              </td>
              <td style={tdStyle}>
                  <div style={{ fontWeight: 'bold', fontSize: '8pt' }}>{item.condition}</div>
                  <div style={{ fontSize: '7.5pt', color: '#666' }}>{item.color || '-'}</div>
              </td>
              <td style={{ ...tdStyle, fontWeight: '900', fontFamily: 'monospace', fontSize: '9pt' }}>
                  {item.location || '---'}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: '900', fontSize: '11pt' }}>
                  {item.quantity}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', fontSize: '9pt' }}>
                  {(item.sellingPrice || 0).toLocaleString()} F
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer style={{ marginTop: 'auto', textAlign: 'center', borderTop: '0.8pt solid #EEE', paddingTop: '15px', fontSize: '7.5pt', color: '#AAA', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px' }}>
          TGS - CÔTE D'IVOIRE | COCODY FAYA | DOCUMENT DE CONTRÔLE INTERNE | CONFIDENTIEL
      </footer>
    </div>
  );
};

export default PrintableStockList;
