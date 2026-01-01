
import React from 'react';
import { DocumentItem } from '../types.ts';

interface PrintableDocumentProps {
  title: string;
  numero: string;
  date: string;
  clientLabel: string;
  clientName: string;
  clientPhone?: string;
  macModel?: string;
  items: DocumentItem[];
  total: number;
  warranty?: string;
  advance?: number;
  message?: string;
}

const PrintableDocument: React.FC<PrintableDocumentProps> = ({ title, numero, date, clientName, clientPhone, macModel, items, total, warranty, advance, message }) => {
  const balance = total - (advance || 0);

  const container: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    padding: '15mm',
    fontFamily: 'Helvetica, Arial, sans-serif',
    color: '#000',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column'
  };

  return (
    <div style={container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
          <div>
              <div style={{ fontSize: '24pt', fontWeight: '900' }}>TGS - CI</div>
              <div style={{ fontSize: '9pt', fontWeight: 'bold', marginTop: '2px' }}>THE GOOD STORE CÔTE D'IVOIRE</div>
              <p style={{ margin: '5px 0', fontSize: '8pt' }}>Abidjan, Cocody Faya<br/>thegoodstoreci@gmail.com</p>
          </div>
          <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '18pt', fontWeight: '900', borderBottom: '3pt solid #000' }}>{title.toUpperCase()}</div>
              <div style={{ fontSize: '11pt', fontWeight: 'bold', marginTop: '5px' }}>N° {numero}</div>
              <div style={{ fontSize: '9pt' }}>Date: {new Date(date).toLocaleDateString('fr-FR')}</div>
          </div>
      </div>

      <div style={{ marginBottom: '30px', display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1, padding: '12px', border: '1.5pt solid #000' }}>
              <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Client / Facturé à :</div>
              <div style={{ fontSize: '12pt', fontWeight: '900' }}>{clientName}</div>
              <div style={{ fontSize: '10pt', fontWeight: 'bold', fontFamily: 'monospace' }}>Tél: {clientPhone}</div>
          </div>
          <div style={{ flex: 1, padding: '12px', border: '1.5pt solid #000' }}>
              <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Détails Matériel :</div>
              <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>MacBook {macModel}</div>
          </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
              <tr style={{ borderTop: '2pt solid #000', borderBottom: '2pt solid #000' }}>
                  <th style={{ padding: '10px', textAlign: 'left', fontSize: '8pt' }}>DESCRIPTION DES PRESTATIONS / ARTICLES</th>
                  <th style={{ padding: '10px', textAlign: 'center', fontSize: '8pt', width: '50px' }}>QTÉ</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: '8pt', width: '100px' }}>P.U. (F)</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: '8pt', width: '100px' }}>TOTAL (F)</th>
              </tr>
          </thead>
          <tbody>
              {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '0.5pt solid #ccc' }}>
                      <td style={{ padding: '12px 10px', fontSize: '10pt', fontWeight: 'bold' }}>{item.description}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontSize: '10pt' }}>{item.quantity}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontSize: '10pt' }}>{item.unitPrice.toLocaleString('fr-FR')}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontSize: '10pt', fontWeight: 'bold' }}>{item.totalPrice.toLocaleString('fr-FR')}</td>
                  </tr>
              ))}
          </tbody>
      </table>

      <div style={{ marginLeft: 'auto', width: '250px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '10pt' }}>
              <span>Montant HT :</span>
              <span>{total.toLocaleString('fr-FR')} F</span>
          </div>
          {advance > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '10pt' }}>
                  <span>Acompte perçu :</span>
                  <span>- {advance.toLocaleString('fr-FR')} F</span>
              </div>
          )}
          <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '12px 0', 
              borderTop: '2pt solid #000', 
              marginTop: '5px',
              fontSize: '12pt',
              fontWeight: '900'
          }}>
              <span>NET À PAYER :</span>
              <span style={{ fontFamily: 'monospace' }}>{balance.toLocaleString('fr-FR')} F</span>
          </div>
      </div>

      <div style={{ marginTop: '20px', padding: '10px', border: '1pt solid #000', fontSize: '8pt', lineHeight: '1.4' }}>
          <strong>CONDITIONS TGS CI :</strong> 1. Garantie de 1 mois (30j) sur la prestation spécifique citée. 
          2. <strong>Annulation :</strong> Garantie nulle si scellé brisé, oxydation, choc ou intervention tierce. 
          3. Obligation de moyens. Matériel à retirer sous 30 jours après avis.
          {warranty && <div style={{marginTop: '4px'}}><strong>Note complémentaire :</strong> {warranty}</div>}
      </div>

      {message && (
          <div style={{ marginTop: '10px', fontSize: '8pt', color: '#666', fontStyle: 'italic' }}>
              Note: {message}
          </div>
      )}

      <footer style={{ marginTop: 'auto', textAlign: 'center', padding: '15px 0', borderTop: '0.5pt solid #000', fontSize: '7pt', textTransform: 'uppercase', fontWeight: 'bold' }}>
          TGS - CI | Abidjan, Côte d'Ivoire | +225 07 57 13 35 07
      </footer>
    </div>
  );
};

export default PrintableDocument;
