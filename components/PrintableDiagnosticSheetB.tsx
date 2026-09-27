import React, { useRef, useState, useEffect } from 'react';
import { RepairTicket } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableDiagnosticSheetBProps {
  ticket: RepairTicket;
}

const PrintableDiagnosticSheetB: React.FC<PrintableDiagnosticSheetBProps> = ({ ticket }) => {
  const data = ticket.diagnosticSheetB;
  const totalCost = (ticket.costs?.diagnostic || 0) + (ticket.costs?.repair || 0);
  const balance = totalCost - (ticket.costs?.advance || 0);

  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState<number>(1);

  // Ajustement automatique strict (auto-scaler) en cas de quantité de texte inhabituelle
  useEffect(() => {
    const evaluateFit = () => {
      if (!pageRef.current || !contentRef.current) return;
      const availableHeight = pageRef.current.clientHeight;
      const actualHeight = contentRef.current.scrollHeight;

      if (availableHeight > 0 && actualHeight > availableHeight + 1) {
        const calculatedScale = (availableHeight - 2) / actualHeight;
        setFitScale(prev => {
          const target = Math.max(0.72, Math.min(1, calculatedScale));
          return Math.abs(prev - target) > 0.01 ? target : prev;
        });
      } else {
        setFitScale(prev => (prev < 1 ? 1 : prev));
      }
    };

    evaluateFit();
    const timer = setTimeout(evaluateFit, 150);
    window.addEventListener('resize', evaluateFit);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', evaluateFit);
    };
  }, [data, ticket]);

  if (!data) {
    return <div className="printable-page">Aucune expertise électronique disponible pour cette fiche.</div>;
  }

  const tensionCount = data.tensionValues?.length || 0;
  const pointsCount = data.diagnosticPoints?.length || 0;
  const visualText = (data.visualInspection || '').trim();
  const visualLen = visualText.length;
  const visualLines = visualText.split('\n').filter(Boolean).length;
  const imageList = data.images && data.images.length > 0 ? data.images.slice(0, 3) : [];
  const hasImages = imageList.length > 0;

  // Calcul du score dynamique de contenu pour ajuster les marges et hauteurs
  const contentScore = (tensionCount * 12) + (pointsCount * 14) + (visualLen * 0.4) + (visualLines * 8) + (hasImages ? 65 : 0);

  const isExtreme = contentScore > 360 || visualLen > 350;
  const isDense = (contentScore > 200 || visualLen > 160 || (hasImages && tensionCount > 5)) && !isExtreme;

  const cfg = {
    pagePadding: isExtreme ? '4mm 7mm' : isDense ? '5mm 8mm' : '6mm 9mm',
    headerPaddingBottom: isExtreme ? '1.2mm' : isDense ? '1.8mm' : '2.4mm',
    headerMarginBottom: isExtreme ? '1.5mm' : isDense ? '2mm' : '2.8mm',
    titleSize: isExtreme ? '13pt' : isDense ? '14.5pt' : '16pt',
    subHeaderSize: isExtreme ? '7.5pt' : isDense ? '8pt' : '8.5pt',
    
    // Identification
    idPadding: isExtreme ? '1.4mm 2.5mm' : isDense ? '1.8mm 3mm' : '2.4mm 3.8mm',
    idMarginBottom: isExtreme ? '1.4mm' : isDense ? '2mm' : '2.6mm',
    idLabelSize: isExtreme ? '7pt' : isDense ? '7.5pt' : '8pt',
    idValueSize: isExtreme ? '9.5pt' : isDense ? '10.5pt' : '11.5pt',
    idSubSize: isExtreme ? '7.5pt' : isDense ? '8pt' : '8.5pt',
    
    // État initial
    initialPadding: isExtreme ? '1.2mm 2.2mm' : isDense ? '1.5mm 2.6mm' : '2mm 3.2mm',
    initialMarginBottom: isExtreme ? '1.4mm' : isDense ? '2mm' : '2.6mm',
    initialFontSize: isExtreme ? '8pt' : isDense ? '8.5pt' : '9.5pt',
    
    // Titres de section
    sectionTitleSize: isExtreme ? '7.8pt' : isDense ? '8.2pt' : '8.8pt',
    sectionMarginBottom: isExtreme ? '1mm' : isDense ? '1.4mm' : '1.8mm',
    
    // Tableaux
    thPadding: isExtreme ? '0.8mm 1.6mm' : isDense ? '1mm 2mm' : '1.3mm 2.4mm',
    thFontSize: isExtreme ? '7.5pt' : isDense ? '8pt' : '8.5pt',
    tdPadding: isExtreme ? '0.7mm 1.6mm' : isDense ? '0.9mm 2mm' : '1.2mm 2.4mm',
    tdFontSize: isExtreme ? '7.8pt' : isDense ? '8.2pt' : '8.8pt',
    tableMarginBottom: isExtreme ? '1.5mm' : isDense ? '2mm' : '2.6mm',
    
    // Inspection visuelle
    visualPadding: isExtreme ? '1.4mm 2.2mm' : isDense ? '1.8mm 2.6mm' : '2.4mm 3.2mm',
    visualFontSize: isExtreme ? '8pt' : isDense ? '8.5pt' : '9.2pt',
    visualLineHeight: isExtreme ? '1.22' : isDense ? '1.28' : '1.35',
    
    // Images
    imageHeight: isExtreme ? '42px' : isDense ? '50px' : '62px',
    
    // Cartouches bas
    bottomCardPadding: isExtreme ? '1.2mm 2mm' : isDense ? '1.6mm 2.5mm' : '2mm 3mm',
    bottomMarginTop: isExtreme ? '1.4mm' : isDense ? '2mm' : '2.6mm',
    
    // Visa
    visaPaddingTop: isExtreme ? '1.2mm' : isDense ? '1.6mm' : '2.2mm',
    visaFontSize: isExtreme ? '7.2pt' : isDense ? '7.8pt' : '8.2pt',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: cfg.tableMarginBottom,
  };

  const thStyle: React.CSSProperties = {
    backgroundColor: '#f1f5f9',
    padding: cfg.thPadding,
    border: '0.6pt solid #cbd5e1',
    textAlign: 'left',
    fontSize: cfg.thFontSize,
    fontWeight: '800',
    color: '#334155'
  };

  const tdStyle: React.CSSProperties = {
    padding: cfg.tdPadding,
    border: '0.6pt solid #cbd5e1',
    fontSize: cfg.tdFontSize,
    verticalAlign: 'middle',
  };

  // Les deux tableaux (Tensions et Points d'expertise) sont agencés côte à côte en grille à 2 colonnes
  // quand les deux existent, ce qui gagne ~45mm de hauteur tout en rendant le texte beaucoup plus grand et lisible !
  const hasBothTables = tensionCount > 0 && pointsCount > 0;

  return (
    <div 
      ref={pageRef}
      className="printable-page ticket-single-page single-page-fit" 
      style={{ 
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
        color: '#0f172a',
        backgroundColor: '#ffffff',
        padding: cfg.pagePadding,
        height: '285mm',
        maxHeight: '285mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        lineHeight: '1.25',
        pageBreakInside: 'avoid',
        pageBreakAfter: 'always',
        position: 'relative'
      }}
    >
      <div
        ref={contentRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          width: '100%',
          transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
          transformOrigin: 'top center',
          transition: 'transform 0.15s ease-out'
        }}
      >
        {/* BLOC PRINCIPAL SUPÉRIEUR */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* EN-TÊTE OFFICIEL */}
          <header style={{ borderBottom: '1.8pt solid #000', paddingBottom: cfg.headerPaddingBottom, marginBottom: cfg.headerMarginBottom, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '0.6mm' }}>
                <AppleLogo style={{ width: '20px', height: '20px', color: '#000' }} />
                <span style={{ fontSize: '14.5pt', fontWeight: '900', letterSpacing: '0.04em' }}>TGS - CI</span>
            </div>
            <div style={{ fontSize: cfg.titleSize, fontWeight: '900', letterSpacing: '0.02em', color: '#0369a1' }}>
              RAPPORT D'EXPERTISE ÉLECTRONIQUE (P3)
            </div>
            <div style={{ fontSize: cfg.subHeaderSize, color: '#64748b', fontWeight: '700', marginTop: '0.4mm' }}>
              Dossier Technique : <strong style={{ color: '#0f172a' }}>#{ticket.id}</strong>
            </div>
          </header>

          {/* BLOC D'IDENTIFICATION CLIENT & APPAREIL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginBottom: cfg.idMarginBottom, border: '0.6pt solid #cbd5e1', borderRadius: '1.5mm', padding: cfg.idPadding, backgroundColor: '#f8fafc' }}>
              <div>
                  <div style={{ fontSize: cfg.idLabelSize, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.3mm' }}>Client</div>
                  <div style={{ fontSize: cfg.idValueSize, fontWeight: '900', color: '#0f172a' }}>{ticket.client.name}</div>
                  <div style={{ fontSize: cfg.idSubSize, color: '#475569', marginTop: '0.2mm', fontWeight: '600' }}>Tél : {ticket.client.phone}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: cfg.idLabelSize, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.3mm' }}>Appareil</div>
                  <div style={{ fontSize: cfg.idValueSize, fontWeight: '900', color: '#0f172a' }}>{ticket.macBrand} {ticket.macModel}</div>
                  <div style={{ fontSize: cfg.idSubSize, color: '#475569', marginTop: '0.2mm', fontWeight: '600' }}>S/N : {ticket.serialNumber || 'Inconnu'}</div>
              </div>
          </div>

          {/* ÉTAT INITIAL À LA RÉCEPTION */}
          <div style={{ marginBottom: cfg.initialMarginBottom, border: '0.6pt solid #fed7aa', padding: cfg.initialPadding, backgroundColor: '#fff7ed', borderRadius: '1.2mm', display: 'flex', alignItems: 'center', gap: '2.5mm' }}>
              <span style={{ fontWeight: '900', color: '#9a3412', fontSize: cfg.idLabelSize, textTransform: 'uppercase', shrink: 0 }}>ÉTAT INITIAL À LA RÉCEPTION :</span>
              <span style={{ fontSize: cfg.initialFontSize, fontWeight: '800', color: '#c2410c' }}>{data.entryCondition}</span>
          </div>

          {/* TABLEAUX TECHNIQUES : GRILLE ÉQUILIBRÉE 2 COLONNES (TENSIONS + POINTS CRITIQUES) */}
          {hasBothTables ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginBottom: cfg.tableMarginBottom }}>
              {/* Colonne Gauche : Tensions Carte Mère */}
              <div>
                <div style={{ fontWeight: '900', marginBottom: cfg.sectionMarginBottom, fontSize: cfg.sectionTitleSize, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  RELEVÉS DE TENSIONS (RAILS CARTE MÈRE) :
                </div>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: '42%' }}>LIGNE / RAIL</th>
                      <th style={{ ...thStyle, width: '33%', textAlign: 'center' }}>VALEUR</th>
                      <th style={{ ...thStyle, width: '25%', textAlign: 'center' }}>ÉTAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tensionValues.map((t, i) => (
                      <tr key={i}>
                        <td style={{ ...tdStyle, fontWeight: '800' }}>{t.line}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>
                          <span>{t.value || 'N.C.'}</span>
                          {t.nominalValue && (
                            <span style={{ fontSize: '7pt', color: '#64748b', fontWeight: 'normal', marginLeft: '3px', display: 'block' }}>
                              (Cible: {t.nominalValue}V)
                            </span>
                          )}
                        </td>
                        <td style={{ 
                          ...tdStyle, 
                          textAlign: 'center', 
                          fontWeight: '900', 
                          color: t.status === 'Correct' ? '#166534' : t.status === 'Absent' ? '#c2410c' : '#dc2626' 
                        }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.5px 4px',
                            borderRadius: '1mm',
                            backgroundColor: t.status === 'Correct' ? '#f0fdf4' : t.status === 'Absent' ? '#fff7ed' : '#fef2f2',
                            border: `0.4pt solid ${t.status === 'Correct' ? '#bbf7d0' : t.status === 'Absent' ? '#fed7aa' : '#fecaca'}`
                          }}>
                            {t.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Colonne Droite : Points d'Expertise Critiques */}
              <div>
                <div style={{ fontWeight: '900', marginBottom: cfg.sectionMarginBottom, fontSize: cfg.sectionTitleSize, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  POINTS D'EXPERTISE CRITIQUES :
                </div>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: '45%' }}>POINT DE CONTRÔLE</th>
                      <th style={thStyle}>OBSERVATIONS TECHNIQUES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.diagnosticPoints.map((p, i) => (
                      <tr key={i}>
                        <td style={{ ...tdStyle, fontWeight: '800' }}>{p.item}</td>
                        <td style={{ ...tdStyle, color: '#334155', fontWeight: '500' }}>{p.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // Affichage pleine largeur si un seul tableau est présent
            <>
              {tensionCount > 0 && (
                <div style={{ marginBottom: cfg.tableMarginBottom }}>
                  <div style={{ fontWeight: '900', marginBottom: cfg.sectionMarginBottom, fontSize: cfg.sectionTitleSize, color: '#0369a1', textTransform: 'uppercase' }}>
                    RELEVÉS DE TENSIONS (RAILS CARTE MÈRE) :
                  </div>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>LIGNE / RAIL</th>
                        <th style={{ ...thStyle, width: '28%', textAlign: 'center' }}>VALEUR MESURÉE</th>
                        <th style={{ ...thStyle, width: '22%', textAlign: 'center' }}>ÉTAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tensionValues.map((t, i) => (
                        <tr key={i}>
                          <td style={{ ...tdStyle, fontWeight: '800' }}>{t.line}</td>
                          <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>
                            {t.value || 'N.C.'}
                            {t.nominalValue && <span style={{ fontSize: '7pt', color: '#64748b', fontWeight: 'normal', marginLeft: '4px' }}>(Cible: {t.nominalValue}V)</span>}
                          </td>
                          <td style={{ 
                            ...tdStyle, 
                            textAlign: 'center', 
                            fontWeight: '900', 
                            color: t.status === 'Correct' ? '#166534' : t.status === 'Absent' ? '#c2410c' : '#dc2626' 
                          }}>
                            {t.status.toUpperCase()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {pointsCount > 0 && (
                <div style={{ marginBottom: cfg.tableMarginBottom }}>
                  <div style={{ fontWeight: '900', marginBottom: cfg.sectionMarginBottom, fontSize: cfg.sectionTitleSize, color: '#0369a1', textTransform: 'uppercase' }}>
                    POINTS D'EXPERTISE CRITIQUES :
                  </div>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: '38%' }}>POINT DE CONTRÔLE</th>
                        <th style={thStyle}>OBSERVATIONS TECHNIQUES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.diagnosticPoints.map((p, i) => (
                        <tr key={i}>
                          <td style={{ ...tdStyle, fontWeight: '800' }}>{p.item}</td>
                          <td style={{ ...tdStyle, color: '#334155' }}>{p.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* CONCLUSION D'INSPECTION VISUELLE */}
          <div style={{ border: '0.6pt solid #cbd5e1', borderRadius: '1.2mm', padding: cfg.visualPadding, backgroundColor: '#f8fafc', marginBottom: cfg.tableMarginBottom }}>
              <div style={{ fontWeight: '900', marginBottom: '0.5mm', fontSize: cfg.idLabelSize, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                CONCLUSION D'INSPECTION VISUELLE :
              </div>
              <div style={{ 
                fontSize: cfg.visualFontSize, 
                color: '#1e293b', 
                lineHeight: cfg.visualLineHeight,
                fontWeight: '500',
                whiteSpace: 'pre-wrap'
              }}>
                {data.visualInspection || "Pas d'anomalie visuelle majeure signalée."}
              </div>
          </div>

          {/* PHOTOS DE L'EXPERTISE */}
          {hasImages && (
              <div style={{ marginBottom: cfg.tableMarginBottom }}>
                  <div style={{ fontWeight: '900', marginBottom: '0.8mm', fontSize: cfg.idLabelSize, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    PHOTOS DE L'EXPERTISE (MICROSCOPIE / ÉTAT) :
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${imageList.length}, 1fr)`, gap: '4px' }}>
                      {imageList.map((img, idx) => (
                          <div key={idx} style={{ border: '0.6pt solid #cbd5e1', borderRadius: '1mm', height: cfg.imageHeight, overflow: 'hidden', backgroundColor: '#000' }}>
                              <img src={img} alt={`Expertise ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </div>

        {/* BLOC INFÉRIEUR GARANTI SANS DÉBORDEMENT (MODALITÉS + SYNTHÈSE + VISA) */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginTop: cfg.bottomMarginTop }}>
              <div style={{ border: '0.6pt solid #cbd5e1', borderRadius: '1.2mm', padding: cfg.bottomCardPadding, backgroundColor: '#f8fafc' }}>
                  <div style={{ fontWeight: '900', fontSize: cfg.idLabelSize, color: '#64748b', borderBottom: '0.4pt solid #cbd5e1', paddingBottom: '0.4mm', marginBottom: '0.8mm', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    MODALITÉS D'INTERVENTION
                  </div>
                  <div style={{ fontSize: cfg.idSubSize, color: '#334155' }}>Durée Expertise : <strong style={{ color: '#0f172a' }}>{data.testDuration || 'N/A'}</strong></div>
                  <div style={{ fontSize: cfg.idSubSize, color: '#334155', marginTop: '0.3mm' }}>Délai Réparation : <strong style={{ color: '#0f172a' }}>{data.repairDelay || 'N/A'}</strong></div>
              </div>
              <div style={{ border: '0.6pt solid #bbf7d0', borderRadius: '1.2mm', padding: cfg.bottomCardPadding, backgroundColor: '#f0fdf4' }}>
                  <div style={{ fontWeight: '900', fontSize: cfg.idLabelSize, color: '#166534', borderBottom: '0.4pt solid #bbf7d0', paddingBottom: '0.4mm', marginBottom: '0.8mm', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    SYNTHÈSE FINANCIÈRE
                  </div>
                  <div style={{ textAlign: 'right', fontSize: cfg.idSubSize, color: '#334155' }}>
                    Total Dossier : <strong>{totalCost.toLocaleString('fr-FR')} F CFA</strong>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: cfg.idValueSize, borderTop: '0.5pt solid #bbf7d0', marginTop: '0.6mm', paddingTop: '0.4mm', fontWeight: '900', color: '#166534' }}>
                    SOLDE : {balance.toLocaleString('fr-FR')} F CFA
                  </div>
              </div>
          </div>

          <div style={{ textAlign: 'center', borderTop: '1.2pt solid #000', paddingTop: cfg.visaPaddingTop, marginTop: '1.6mm' }}>
              <div style={{ fontSize: cfg.visaFontSize, color: '#475569', fontWeight: '700' }}>
                  Expert responsable : __________________________ Signature & Cachet : __________________________
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintableDiagnosticSheetB;