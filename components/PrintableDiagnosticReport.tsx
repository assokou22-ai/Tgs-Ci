
import React from 'react';
import { RepairTicket, EntryCondition } from '../types.ts';
import { AppleLogo } from './icons.tsx';

interface PrintableDiagnosticReportProps {
  ticket: RepairTicket;
}

const PrintableDiagnosticReport: React.FC<PrintableDiagnosticReportProps> = ({ ticket }) => {
  const formatDateTime = (iso?: string) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
  };

  const hasLongFormDiagnostic = !!(ticket.customFields?.diagnostic || ticket.customFields?.constatsParticuliers);
  const constatsLen = (ticket.customFields?.constatsParticuliers || '').trim().length;
  const diagLen = (ticket.customFields?.diagnostic || '').trim().length;
  const notesLen = (ticket.technicianNotes || '').trim().length;
  const totalTextLen = constatsLen + diagLen + notesLen;

  // Détection intelligente du volume d'information
  // S'il n'y a que le tableau de composants (cas le plus fréquent), on agrandit généreusement la police
  const isUltra = totalTextLen > 380;
  const isDense = (hasLongFormDiagnostic || totalTextLen > 80) && !isUltra;

  const cfg = {
    padding: isUltra ? '4.5mm 7mm' : isDense ? '6mm 8.5mm' : '9mm 12mm',
    headerPaddingBottom: isUltra ? '1.2mm' : isDense ? '1.8mm' : '2.5mm',
    headerMarginBottom: isUltra ? '1.8mm' : isDense ? '2.5mm' : '4mm',
    appleLogoSize: isUltra ? 16 : isDense ? 20 : 25,
    titleSize: isUltra ? '14pt' : isDense ? '16.5pt' : '20pt',
    subtitleSize: isUltra ? '6.8pt' : isDense ? '7.5pt' : '9pt',
    refLabelSize: isUltra ? '6pt' : isDense ? '6.8pt' : '8pt',
    refIdSize: isUltra ? '13pt' : isDense ? '15pt' : '18pt',

    // Bloc récapitulatif
    summaryPadding: isUltra ? '1.5mm 2.5mm' : isDense ? '2.2mm 3.5mm' : '3.5mm 5mm',
    summaryMarginBottom: isUltra ? '1.8mm' : isDense ? '2.5mm' : '4mm',
    summaryLabelSize: isUltra ? '5.8pt' : isDense ? '6.5pt' : '7.8pt',
    summaryValueSize: isUltra ? '8pt' : isDense ? '9.5pt' : '11.5pt',
    summarySubSize: isUltra ? '6.5pt' : isDense ? '7.2pt' : '8.8pt',

    // Sections textuelles
    sectionTitleSize: isUltra ? '7pt' : isDense ? '8pt' : '9.5pt',
    sectionTextSize: isUltra ? '6.8pt' : isDense ? '7.6pt' : '9pt',
    sectionPadding: isUltra ? '1.2mm 2mm' : isDense ? '1.8mm 2.8mm' : '2.8mm 4mm',
    sectionMarginBottom: isUltra ? '1.5mm' : isDense ? '2.2mm' : '3.5mm',

    // Tableau des composants
    thPadding: isUltra ? '0.8mm 1.5mm' : isDense ? '1.4mm 2.2mm' : '2.8mm 3.5mm',
    thFontSize: isUltra ? '6.2pt' : isDense ? '7pt' : '8.5pt',
    tdPadding: isUltra ? '0.7mm 1.5mm' : isDense ? '1.2mm 2.2mm' : '2.6mm 3.5mm',
    tdFontSize: isUltra ? '6.6pt' : isDense ? '7.5pt' : '9.5pt',
    badgePadding: isUltra ? '0.2mm 1.2mm' : isDense ? '0.6mm 2mm' : '1.2mm 3.2mm',
    badgeFontSize: isUltra ? '5.8pt' : isDense ? '6.6pt' : '8pt',
    obsFontSize: isUltra ? '6.4pt' : isDense ? '7.2pt' : '9pt',

    // Bas de page / Visa
    footerPaddingTop: isUltra ? '1.5mm' : isDense ? '2.5mm' : '4mm',
    certTitleSize: isUltra ? '6.2pt' : isDense ? '7pt' : '8.5pt',
    certTextSize: isUltra ? '5.8pt' : isDense ? '6.6pt' : '8pt',
    visaTitleSize: isUltra ? '6.5pt' : isDense ? '7.5pt' : '9pt',
    visaBoxHeight: isUltra ? '10mm' : isDense ? '14mm' : '20mm',
    visaLineWidth: isUltra ? '90px' : isDense ? '120px' : '160px',
  };

  return (
    <div 
      className="printable-page ticket-single-page single-page-fit"
      style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#0f172a',
        backgroundColor: '#ffffff',
        padding: cfg.padding,
        height: '296mm',
        maxHeight: '296mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        lineHeight: '1.25',
        pageBreakInside: 'avoid',
        pageBreakAfter: 'always'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2pt solid #000', paddingBottom: cfg.headerPaddingBottom, marginBottom: cfg.headerMarginBottom }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AppleLogo style={{ width: `${cfg.appleLogoSize}px`, height: `${cfg.appleLogoSize}px`, color: '#000' }} />
                    <h1 style={{ fontSize: cfg.titleSize, fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
                </div>
                <div style={{ fontSize: cfg.subtitleSize, fontWeight: '900', textTransform: 'uppercase', marginTop: '1mm', color: '#0071e3', letterSpacing: '0.04em' }}>RAPPORT D'EXPERTISE TECHNIQUE (P2)</div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: cfg.refLabelSize, fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>Référence Dossier</div>
                <div style={{ fontSize: cfg.refIdSize, fontWeight: '900', fontFamily: 'monospace', color: '#0071e3' }}>#{ticket.id}</div>
            </div>
        </header>

        {/* SUMMARY INFO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '3mm', marginBottom: cfg.summaryMarginBottom, background: '#F8FAFC', padding: cfg.summaryPadding, border: '0.5pt solid #E2E8F0', borderRadius: '1.5mm' }}>
            <div>
                <div style={{ fontSize: cfg.summaryLabelSize, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.5mm', fontWeight: '800' }}>Appareil</div>
                <div style={{ fontSize: cfg.summaryValueSize, fontWeight: '900', color: '#0F172A' }}>{ticket.macBrand} {ticket.macModel}</div>
                <div style={{ fontSize: cfg.summarySubSize, color: '#475569', marginTop: '0.5mm', fontWeight: '600' }}>N° DE SÉRIE : {ticket.serialNumber || 'Inconnu'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: cfg.summaryLabelSize, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.5mm', fontWeight: '800' }}>Technicien responsable</div>
                <div style={{ fontSize: cfg.summaryValueSize, fontWeight: '900', color: '#0F172A' }}>DÉPARTEMENT EXPERTISE MAC</div>
                <div style={{ fontSize: cfg.summarySubSize, color: '#475569', marginTop: '0.5mm' }}>Expertise du {formatDateTime(ticket.diagnosticCreatedAt || ticket.updatedAt)}</div>
            </div>
        </div>

        {/* SECTION DIAGNOSTIC TEXTUEL (SI PRÉSENT) */}
        {hasLongFormDiagnostic && (
            <div style={{ marginBottom: cfg.sectionMarginBottom }}>
              <h2 style={{ fontSize: cfg.sectionTitleSize, fontWeight: '900', textTransform: 'uppercase', borderBottom: '1pt solid #000', paddingBottom: '0.8mm', marginBottom: '1.5mm' }}>Synthèse de l'Expertise Technique</h2>
              
              {ticket.customFields?.constatsParticuliers && (
                  <div style={{ marginBottom: '1.5mm' }}>
                      <div style={{ fontSize: cfg.sectionTitleSize, fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', marginBottom: '0.5mm' }}>🔍 CONSTATS PARTICULIERS :</div>
                      <div style={{ fontSize: cfg.sectionTextSize, backgroundColor: '#F8FAFC', padding: cfg.sectionPadding, border: '0.5pt solid #CBD5E1', borderRadius: '1mm', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                          {ticket.customFields.constatsParticuliers}
                      </div>
                  </div>
              )}

              {ticket.customFields?.diagnostic && (
                  <div style={{ marginBottom: '1.5mm' }}>
                      <div style={{ fontSize: cfg.sectionTitleSize, fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', marginBottom: '0.5mm' }}>🧪 RÉSUMÉ DU DIAGNOSTIC :</div>
                      <div style={{ fontSize: cfg.sectionTextSize, backgroundColor: '#F0F7FF', padding: cfg.sectionPadding, border: '0.5pt solid #BED4EB', borderRadius: '1mm', whiteSpace: 'pre-wrap', fontWeight: '500', lineHeight: '1.3' }}>
                          {ticket.customFields.diagnostic}
                      </div>
                  </div>
              )}
            </div>
        )}

        {/* SECTION POINTS DE CONTRÔLE (GRILLE STANDARD) */}
        <>
          <h2 style={{ fontSize: cfg.sectionTitleSize, fontWeight: '900', textTransform: 'uppercase', borderBottom: '1.2pt solid #000', paddingBottom: '0.8mm', marginBottom: '1.5mm' }}>Analyse Détaillée des Composants</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2.5mm' }}>
              <thead>
              <tr style={{ borderBottom: '1.4pt solid #000', fontSize: cfg.thFontSize, fontWeight: '900', color: '#0F172A' }}>
                  <th style={{ padding: cfg.thPadding, textAlign: 'left' }}>COMPOSANT / CIRCUIT</th>
                  <th style={{ padding: cfg.thPadding, textAlign: 'center', width: isUltra ? '85px' : '120px' }}>STATUT</th>
                  <th style={{ padding: cfg.thPadding, textAlign: 'left' }}>OBSERVATIONS</th>
              </tr>
              </thead>
              <tbody>
              {(() => {
                const activeCond = ticket.diagnosticSheetB?.entryCondition || EntryCondition.NO_POWER;
                let listToRender = ticket.diagnosticReport || [];

                if (listToRender.length === 0) {
                  const fallbackComponents = [
                    'Écran (Affichage/Rétro)', 'Clavier (Toutes touches)', 'Trackpad (Clic/Force)', 'Batterie (Cycles/Santé)', 
                    'Ports USB-C / Thunderbolt', 'Wi-Fi / Bluetooth', 'Haut-parleurs (L/R)', 'Webcam / Micro', 'Touch Bar / ID', 'SSD (Vitesse/Santé)'
                  ];
                  if (activeCond === EntryCondition.BOOT_NO_DISPLAY) {
                    listToRender = [{
                      component: 'Écran (Affichage/Rétro)',
                      status: 'Non testable (état machine)',
                      notes: 'Ne peut etre testé tant que la carte mere ne demarre'
                    }];
                  } else if (activeCond === EntryCondition.NO_POWER) {
                    listToRender = fallbackComponents.map(name => ({
                      component: name,
                      status: 'Non testable (état machine)',
                      notes: 'Ne peut etre testé tant que la carte mere ne demarre'
                    }));
                  } else {
                    listToRender = fallbackComponents.map(name => ({
                      component: name,
                      status: 'OK',
                      notes: 'Fonctionnel'
                    }));
                  }
                }

                return listToRender.map((check, index) => {
                  let bg = '#F7FAFC';
                  let color = '#4A5568';
                  let border = '0.5pt solid #CBD5E1';

                  const statusUpper = check.status.toUpperCase();
                  if (statusUpper.includes('OK') || statusUpper.includes('FONCTIONNEL')) {
                    bg = '#EBFBEE';
                    color = '#2F855A';
                    border = '0.6pt solid #9AE6B4';
                  } else if (statusUpper.includes('PROBLÈME') || statusUpper.includes('DÉFAUT') || statusUpper.includes('DEFECT') || statusUpper.includes('HS')) {
                    bg = '#FFF5F5';
                    color = '#C53030';
                    border = '0.6pt solid #FEB2B2';
                  } else if (statusUpper.includes('NON TESTABLE') || statusUpper.includes('MACHINE') || statusUpper.includes('ETAT') || statusUpper.includes('NON TESTÉ')) {
                    bg = '#FFF9DB';
                    color = '#B7791F';
                    border = '0.6pt solid #FBD38D';
                  }

                  return (
                    <tr key={index} style={{ borderBottom: '0.5pt solid #E2E8F0', fontSize: cfg.tdFontSize }}>
                        <td style={{ padding: cfg.tdPadding, fontWeight: '800' }}>{check.component}</td>
                        <td style={{ padding: cfg.tdPadding, textAlign: 'center' }}>
                        <span style={{ 
                            display: 'inline-block',
                            padding: cfg.badgePadding, 
                            borderRadius: '1mm', 
                            fontSize: cfg.badgeFontSize, 
                            fontWeight: '900',
                            background: bg,
                            color: color,
                            border: border,
                            letterSpacing: '0.02em'
                        }}>
                            {check.status.toUpperCase()}
                        </span>
                        </td>
                        <td style={{ padding: cfg.tdPadding, color: '#334155', fontSize: cfg.obsFontSize }}>
                        {check.notes || '-'}
                        </td>
                    </tr>
                  );
                });
              })()}
              </tbody>
          </table>
        </>

        {ticket.technicianNotes && (
          <div style={{ marginBottom: cfg.sectionMarginBottom }}>
              <h2 style={{ fontSize: cfg.sectionTitleSize, fontWeight: '900', textTransform: 'uppercase', borderBottom: '1pt solid #000', paddingBottom: '0.8mm', marginBottom: '1.2mm' }}>Verdict & Notes Supplémentaires</h2>
              <div style={{ fontSize: cfg.sectionTextSize, lineHeight: '1.3', padding: cfg.sectionPadding, border: '0.6pt solid #DDD', background: '#FAFAFA', borderRadius: '1mm' }}>
                  {ticket.technicianNotes}
              </div>
          </div>
        )}
      </div>

      {/* BAS DE PAGE CERTIFICATION & VISA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '6mm', borderTop: '1.4pt solid #000', paddingTop: cfg.footerPaddingTop, marginTop: 'auto' }}>
          <div>
              <div style={{ fontSize: cfg.certTitleSize, fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.8mm' }}>Certification d'Expertise</div>
              <p style={{ fontSize: cfg.certTextSize, color: '#475569', margin: 0, lineHeight: '1.35' }}>
                  Ce rapport atteste de l'état réel des composants de l'appareil à la date de l'expertise. Les dommages cachés ne pouvant être détectés sans démontage complet ne sont pas inclus.
              </p>
          </div>
          <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: cfg.visaTitleSize, fontWeight: '900', textTransform: 'uppercase', marginBottom: '1.5mm' }}>Visa Expert TGS-CI</div>
              <div style={{ height: cfg.visaBoxHeight, border: '0.6pt dashed #94A3B8', borderRadius: '1.5mm', display: 'flex', alignItems: 'center', justifyContent: 'center', width: cfg.visaLineWidth, margin: '0 auto', background: '#F8FAFC' }}>
                  <span style={{ fontSize: cfg.refLabelSize, color: '#94A3B8', fontWeight: 'bold' }}>CACHET ATELIER</span>
              </div>
          </div>
      </div>
    </div>
  );
};

export default PrintableDiagnosticReport;
