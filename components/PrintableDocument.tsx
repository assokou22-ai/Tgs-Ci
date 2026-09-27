
import React from 'react';
import { DocumentItem } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableDocumentProps {
  title: string;
  numero: string;
  date: string;
  clientLabel: string;
  clientName: string;
  clientPhone?: string;
  documentNature?: 'macbook' | 'pieces' | 'reparation' | 'autre';
  macModel?: string;
  macColor?: string;
  macSpecs?: string;
  macSerialNumber?: string;
  macModelNumber?: string;
  macScreenSize?: string;
  macCondition?: 'Neuf' | 'Occasion' | 'Reconditionné' | string;
  items: DocumentItem[];
  total: number;
  warranty?: string;
  warrantyConditions?: string;
  includeWarrantyBlock?: boolean;
  advance?: number;
  message?: string;
}

const PrintableDocument: React.FC<PrintableDocumentProps> = ({ 
  title, 
  numero, 
  date, 
  clientLabel, 
  clientName, 
  clientPhone, 
  documentNature,
  macModel, 
  macColor, 
  macSpecs, 
  macSerialNumber, 
  macModelNumber, 
  macScreenSize, 
  macCondition, 
  items, 
  total, 
  warranty, 
  warrantyConditions,
  includeWarrantyBlock,
  advance, 
  message 
}) => {
  const balance = total - (advance || 0);

  // Détermination de l'affichage du bloc garantie
  const trimmedWarranty = warranty?.trim();
  const parsedConditions = warrantyConditions 
    ? warrantyConditions.split('\n').map(l => l.trim()).filter(Boolean)
    : [];
  
  const hasWarrantyContent = (includeWarrantyBlock !== false) && (Boolean(trimmedWarranty) || parsedConditions.length > 0);

  // Titre et libellé de l'appareil exactement tels que renseignés par l'utilisateur
  const displayModel = React.useMemo(() => {
    if (!macModel || !macModel.trim()) {
      return '';
    }
    return macModel.trim();
  }, [macModel]);

  const hasDeviceDetails = Boolean(
    displayModel || macColor || macSpecs || macModelNumber || macSerialNumber || macScreenSize || macCondition
  );

  return (
    <div className="printable-page" style={{ letterSpacing: '0.02em' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <AppleLogo style={{ width: '25px', height: '25px', color: '#000' }} />
                  <h1 style={{ fontSize: '24pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
              </div>
              <div style={{ fontSize: '7pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666', letterSpacing: '0.04em' }}>L'excellence de la réparation MacBook</div>
              <p style={{ margin: '10px 0 0 0', fontSize: '8.5pt', lineHeight: '1.4', color: '#333', letterSpacing: '0.01em' }}>
                Cocody Faya, Carrefour Coq Ivoir<br/>
                Abidjan, Côte d'Ivoire | thegoodstoreci@gmail.com
              </p>
          </div>
          <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '18pt', fontWeight: '900', borderBottom: '3pt solid #000', paddingBottom: '3px', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</h2>
              <div style={{ fontSize: '11pt', fontWeight: 'bold', letterSpacing: '0.02em' }}>N° {numero}</div>
              <div style={{ fontSize: '9pt', color: '#666', marginTop: '3px', letterSpacing: '0.01em' }}>Date: {new Date(date).toLocaleDateString('fr-FR')}</div>
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
          <div style={{ border: '1pt solid #000', padding: '15px' }}>
              <div style={{ fontSize: '7pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666', marginBottom: '5px', letterSpacing: '0.04em' }}>{clientLabel} / Destinataire :</div>
              <div style={{ fontSize: '12pt', fontWeight: '900', letterSpacing: '0.02em' }}>{clientName.toUpperCase()}</div>
              <div style={{ fontSize: '10pt', fontWeight: '700', marginTop: '3px', fontFamily: 'monospace', letterSpacing: '0.05em' }}>Tél: {clientPhone}</div>
          </div>
          <div style={{ border: '1pt solid #000', padding: '15px', background: '#F9F9F9' }}>
              <div style={{ fontSize: '7pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666', marginBottom: '5px', letterSpacing: '0.04em' }}>
                {documentNature === 'reparation' ? 'Appareil Pris en Charge :' : documentNature === 'pieces' ? 'Désignation Pièces / Matériel :' : 'Détails Matériel :'}
              </div>
              {displayModel && (
                <div style={{ fontSize: '10pt', fontWeight: '900', letterSpacing: '0.02em' }}>{displayModel}</div>
              )}
              {(macColor || macSpecs) && (
                  <div style={{ fontSize: '8.5pt', marginTop: '5px', color: '#444', lineHeight: '1.4', letterSpacing: '0.01em' }}>
                      {macColor} {macSpecs ? `| ${macSpecs}` : ''}
                  </div>
              )}
              {(macModelNumber || macSerialNumber || macScreenSize || macCondition) && (
                  <div style={{ fontSize: '8.5pt', marginTop: '5px', color: '#444', lineHeight: '1.4', borderTop: '0.5pt dashed #ccc', paddingTop: '5px', letterSpacing: '0.01em' }}>
                      {macModelNumber && <div>Modèle: <strong>{macModelNumber}</strong></div>}
                      {macSerialNumber && <div>S/N: <strong>{macSerialNumber}</strong></div>}
                      {macScreenSize && <div>Écran: {macScreenSize}</div>}
                      {macCondition && <div>État: {macCondition}</div>}
                  </div>
              )}
              {!hasDeviceDetails && (
                <div style={{ fontSize: '9pt', color: '#777', fontStyle: 'italic', letterSpacing: '0.01em' }}>Prestations / Articles désignés ci-dessous</div>
              )}
          </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
              <tr style={{ background: '#000', color: '#FFF' }}>
                  <th style={{ padding: '10px', textAlign: 'left', fontSize: '8.5pt', letterSpacing: '0.03em' }}>DÉSIGNATION DES PRESTATIONS / ARTICLES</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '50px', fontSize: '8.5pt', letterSpacing: '0.02em' }}>QTÉ</th>
                  <th style={{ padding: '10px', textAlign: 'right', width: '100px', fontSize: '8.5pt', letterSpacing: '0.02em' }}>P.U. (F)</th>
                  <th style={{ padding: '10px', textAlign: 'right', width: '100px', fontSize: '8.5pt', letterSpacing: '0.02em' }}>TOTAL (F)</th>
              </tr>
          </thead>
          <tbody>
              {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '0.5pt solid #EEE' }}>
                      <td style={{ padding: '10px', fontSize: '9pt', fontWeight: 'bold', letterSpacing: '0.01em' }}>{item.description}</td>
                      <td style={{ padding: '10px', textAlign: 'center', fontSize: '9pt', letterSpacing: '0.01em' }}>{item.quantity}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '9pt', letterSpacing: '0.02em' }}>{item.unitPrice.toLocaleString()}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '9pt', fontWeight: '900', letterSpacing: '0.02em' }}>{item.totalPrice.toLocaleString()}</td>
                  </tr>
              ))}
          </tbody>
      </table>

      <div style={{ marginLeft: 'auto', width: '280px', marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '10pt', borderBottom: '0.8pt solid #000' }}>
              <span style={{ fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.03em' }}>TOTAL TTC :</span>
              <span style={{ fontWeight: '900', letterSpacing: '0.02em' }}>{total.toLocaleString()} F CFA</span>
          </div>
          {advance !== undefined && advance > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '9.5pt', color: '#c53030', borderBottom: '0.5pt solid #EEE' }}>
                  <span style={{ fontWeight: 'bold', letterSpacing: '0.01em' }}>Avance reçue :</span>
                  <span style={{ fontWeight: '900', letterSpacing: '0.02em' }}>- {advance.toLocaleString()} F</span>
              </div>
          )}
          {advance !== undefined && advance > 0 && (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '15px 0', 
                marginTop: '5px',
                fontSize: '13pt',
                fontWeight: '900',
                borderTop: '2pt solid #000',
                letterSpacing: '0.02em'
            }}>
                <span style={{ letterSpacing: '0.03em' }}>{balance <= 0 ? 'TOTAL RÉGLÉ' : 'SOLDE À RÉGLER :'}</span>
                <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{balance.toLocaleString()} F</span>
            </div>
          )}
      </div>

      <div style={{ marginTop: 'auto' }}>
          {hasWarrantyContent && (
            <div style={{ padding: '15px', border: '0.8pt solid #DDD', backgroundColor: '#FAFAFA', borderRadius: '8px', marginBottom: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px', color: '#000', borderBottom: '0.5pt solid #EEE', paddingBottom: '5px', letterSpacing: '0.03em' }}>
                  📄 Garantie & Mentions
                </div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: '1.8', color: '#333', letterSpacing: '0.01em' }}>
                  {trimmedWarranty && (
                    <div style={{ marginBottom: parsedConditions.length > 0 ? '3px' : '0' }}>
                      • Garantie : <strong>{trimmedWarranty}</strong>
                    </div>
                  )}
                  {parsedConditions.map((cond, idx) => (
                    <div key={idx} style={{ marginTop: '2px' }}>
                      {cond.startsWith('•') || cond.startsWith('-') || cond.startsWith('*') ? cond : `• ${cond}`}
                    </div>
                  ))}
                </div>
            </div>
          )}
          
          {message && (
            <div style={{ marginTop: '12px', textAlign: 'center', fontStyle: 'italic', fontSize: '8pt', color: '#666', letterSpacing: '0.01em' }}>
                "{message}"
            </div>
          )}

          <div style={{ marginTop: '25px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8.5pt', fontWeight: 'bold', marginBottom: '45px', letterSpacing: '0.03em' }}>LE CLIENT / RÉCEPTIONNAIRE</div>
                  <div style={{ borderTop: '0.5pt solid #EEE', width: '120px', margin: '0 auto' }}></div>
              </div>
              <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8.5pt', fontWeight: 'bold', marginBottom: '45px', letterSpacing: '0.03em' }}>VISA TGS-CI</div>
                  <div style={{ borderTop: '0.5pt solid #EEE', width: '120px', margin: '0 auto' }}></div>
              </div>
          </div>

          <footer style={{ marginTop: '25px', textAlign: 'center', padding: '12px 0', borderTop: '0.5pt solid #EEE', fontSize: '7pt', color: '#AAA', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            TGS - Côte d'Ivoire | Cocody Faya | +225 07 57 13 35 07 | Workshop Certified
          </footer>
      </div>
    </div>
  );
};

export default PrintableDocument;
