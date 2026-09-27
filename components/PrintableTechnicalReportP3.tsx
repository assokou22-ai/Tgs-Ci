import React, { useRef, useState, useEffect } from 'react';
import { RepairTicket, RepairStatus } from '../types.ts';

interface PrintableTechnicalReportP3Props {
  ticket: RepairTicket;
}

const PrintableTechnicalReportP3: React.FC<PrintableTechnicalReportP3Props> = ({ ticket }) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState<number>(1);

  const rep = ticket?.technicalReport || {};

  // Formattage date édition
  const editDateStr = rep.updatedAt 
    ? new Date(rep.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // État initial de réception
  const getInitialCondition = () => {
    if (ticket.diagnosticSheetB?.entryCondition) {
      return ticket.diagnosticSheetB.entryCondition;
    }
    if (ticket.problemDescription) {
      return ticket.problemDescription;
    }
    return "Ne démarre pas / Aucune réaction (Scénario C)";
  };

  // Fallbacks par défaut calqués fidèlement sur le document TGS-CI fourni
  const defaultInterventions = [
    "Correction de plusieurs composants alimentant la NAND de stockage, les tensions de démarrage et les alimentations secondaires.",
    "Remplacement de la PMU (Power Management Unit).",
    "Remplacement de la ROM de démarrage du SoC."
  ];

  const defaultResult = [
    "Le MacBook démarre et affiche normalement."
  ];

  const defaultObservation = [
    "Défaillance de la batterie : elle semble complètement affaiblie."
  ];

  const defaultCauses = [
    "Corrosion",
    "Humidité",
    "Poussière"
  ];

  const defaultImportant = [
    "Un niveau de corrosion avancé a été corrigé, mais il peut réapparaître sous des puces aujourd'hui parfaitement fonctionnelles.",
    "Effectuez des sauvegardes régulières de vos données utilisées sur cette machine.",
    "Prévoyez une mise à disposition de la machine tous les 30 jours, pour un contrôle de 48 h minimum dans nos locaux.",
    "Un suivi particulier doit être assuré sur cette machine pendant au moins 3 mois."
  ];

  // Calcul dynamique de la densité pour garantir STRICTEMENT 1 SEULE PAGE A4
  const interventionsText = rep.interventionsDone || defaultInterventions.join('\n');
  const resultText = rep.result || defaultResult.join('\n');
  const obsText = rep.observation || defaultObservation.join('\n');
  const causesText = rep.faultCause || defaultCauses.join('\n');
  const importantText = rep.importantNotes || defaultImportant.join('\n');

  const totalLines = (interventionsText.split('\n').length)
    + (resultText.split('\n').length)
    + (obsText.split('\n').length)
    + (causesText.split('\n').length)
    + (importantText.split('\n').length);

  const totalChars = interventionsText.length + resultText.length + obsText.length + causesText.length + importantText.length;

  const isExtreme = totalLines > 26 || totalChars > 1200;
  const isUltra = (totalLines > 19 || totalChars > 850) && !isExtreme;
  const isDense = (totalLines > 14 || totalChars > 580) && !isUltra && !isExtreme;

  const cfg = {
    pagePadding: isExtreme ? '3.5mm 6.5mm' : isUltra ? '4.5mm 7.5mm' : isDense ? '6mm 9mm' : '7.5mm 10.5mm',
    headerMarginBottom: isExtreme ? '1.5mm' : isUltra ? '2mm' : isDense ? '2.5mm' : '3.5mm',
    titleSize: isExtreme ? '13pt' : isUltra ? '14.5pt' : isDense ? '16.5pt' : '18.5pt',
    subHeaderSize: isExtreme ? '7.5pt' : isUltra ? '8pt' : isDense ? '8.5pt' : '9.5pt',
    dividerMarginBottom: isExtreme ? '1.4mm' : isUltra ? '1.8mm' : isDense ? '2.2mm' : '3mm',
    
    // Client & Appareil
    clientCardPadding: isExtreme ? '1.4mm 2.8mm' : isUltra ? '1.8mm 3.2mm' : isDense ? '2.4mm 3.8mm' : '3.2mm 4.5mm',
    clientCardMarginBottom: isExtreme ? '1.4mm' : isUltra ? '1.8mm' : isDense ? '2.2mm' : '3mm',
    clientSubSize: isExtreme ? '7.2pt' : isUltra ? '7.8pt' : isDense ? '8.2pt' : '8.8pt',
    clientNameSize: isExtreme ? '9.5pt' : isUltra ? '10.2pt' : isDense ? '10.8pt' : '11.5pt',
    
    // État initial
    initialCondPadding: isExtreme ? '1.2mm 2.6mm' : isUltra ? '1.6mm 3mm' : '2.2mm 3.5mm',
    initialCondMarginBottom: isExtreme ? '1.4mm' : isUltra ? '1.8mm' : isDense ? '2.2mm' : '3mm',
    initialCondFontSize: isExtreme ? '7.8pt' : isUltra ? '8.2pt' : isDense ? '8.8pt' : '9.5pt',
    
    // Statut & Fiche
    statusTableMarginBottom: isExtreme ? '1.4mm' : isUltra ? '1.8mm' : isDense ? '2.2mm' : '3mm',
    statusPaddingHeader: isExtreme ? '1mm 2.2mm' : isUltra ? '1.2mm 2.4mm' : isDense ? '1.5mm 3mm' : '1.8mm 3.2mm',
    statusPaddingValue: isExtreme ? '1.4mm 2.2mm' : isUltra ? '1.6mm 2.4mm' : isDense ? '2mm 3mm' : '2.5mm 3.2mm',
    statusHeaderSize: isExtreme ? '7.2pt' : isUltra ? '7.8pt' : isDense ? '8.2pt' : '8.8pt',
    statusValueSize: isExtreme ? '8.5pt' : isUltra ? '9pt' : isDense ? '9.5pt' : '10.5pt',
    
    // Sections 1 à 6
    sectionsGap: isExtreme ? '1mm' : isUltra ? '1.4mm' : isDense ? '2mm' : '2.6mm',
    sectionTitleSize: isExtreme ? '8pt' : isUltra ? '8.5pt' : isDense ? '9.2pt' : '10pt',
    listMargin: isExtreme ? '0.4mm 0 0.6mm 3mm' : isUltra ? '0.6mm 0 0.8mm 3.5mm' : isDense ? '0.8mm 0 1.2mm 3.8mm' : '1.2mm 0 1.6mm 4.5mm',
    listFontSize: isExtreme ? '7.8pt' : isUltra ? '8.2pt' : isDense ? '8.8pt' : '9.5pt',
    listLineHeight: isExtreme ? '1.2' : isUltra ? '1.24' : isDense ? '1.3' : '1.38',
    liMarginBottom: isExtreme ? '0.3mm' : isUltra ? '0.5mm' : isDense ? '0.8mm' : '1.1mm',
    
    // Important Encadré
    importantPadding: isExtreme ? '1.4mm 2.4mm' : isUltra ? '1.8mm 2.8mm' : isDense ? '2.4mm 3.4mm' : '3mm 4.2mm',
    importantMarginTop: isExtreme ? '0.4mm' : isUltra ? '0.6mm' : isDense ? '1mm' : '1.5mm',
    
    // Retrait & Suivi table
    retraitTablePadding: isExtreme ? '1.4mm 2.2mm' : isUltra ? '1.6mm 2.6mm' : isDense ? '2mm 3mm' : '2.6mm 3.5mm',
    retraitTableFontSize: isExtreme ? '7.6pt' : isUltra ? '8.2pt' : isDense ? '8.8pt' : '9.2pt',
    retraitLineHeight: isExtreme ? '1.2' : isUltra ? '1.24' : isDense ? '1.3' : '1.38',
    
    // Signatures
    signatureMarginTop: isExtreme ? '1.4mm' : isUltra ? '2mm' : isDense ? '2.8mm' : '4mm',
    signatureBoxHeight: isExtreme ? '8mm' : isUltra ? '9.5mm' : isDense ? '12mm' : '15mm',
    
    // Footer
    footerMarginTop: isExtreme ? '1mm' : isUltra ? '1.4mm' : isDense ? '2mm' : '2.8mm',
  };

  // Ajustement automatique strict (auto-scaler) en cas de débordement
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
  }, [ticket]);

  if (!ticket) return null;

  // Helper pour diviser un texte multi-lignes en puces avec styling adaptatif
  const renderBulletList = (text?: string, fallback: string[] = []) => {
    let lines: string[] = [];
    if (!text || text.trim() === '') {
      if (fallback.length === 0) return null;
      lines = fallback;
    } else {
      lines = text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => l.replace(/^[•\-*✔]\s*/, ''));
    }

    return (
      <ul style={{ 
        margin: cfg.listMargin, 
        padding: 0, 
        listStyleType: 'disc', 
        fontSize: cfg.listFontSize, 
        lineHeight: cfg.listLineHeight, 
        color: '#1e293b' 
      }}>
        {lines.map((line, idx) => (
          <li key={idx} style={{ marginBottom: cfg.liMarginBottom }}>{line}</li>
        ))}
      </ul>
    );
  };

  const statusLabel = ticket.status === RepairStatus.RENDU 
    ? "Appareil rendu au client — travaux validés" 
    : ticket.status === RepairStatus.TERMINE 
      ? "Intervention terminée — machine fonctionnelle" 
      : "Intervention en cours / Rapport de fin de travaux";

  return (
    <div 
      ref={pageRef}
      className="printable-page ticket-single-page single-page-fit" 
      style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#0f172a',
        backgroundColor: '#ffffff',
        padding: cfg.pagePadding,
        lineHeight: '1.2',
        boxSizing: 'border-box',
        height: '285mm',
        maxHeight: '285mm',
        overflow: 'hidden',
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
        {/* CORPS PRINCIPAL */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* EN-TÊTE PRINCIPAL OFFICIEL TGS-CI */}
        <div style={{ textAlign: 'center', marginBottom: cfg.headerMarginBottom }}>
          <div style={{ fontSize: '14pt', fontWeight: '900', color: '#0369a1', letterSpacing: '0.05em' }}>
            TGS-CI
          </div>
          <div style={{ fontSize: cfg.subHeaderSize, fontWeight: '800', color: '#64748b', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '0.3mm' }}>
            RÉPARATION & EXPERTISE ÉLECTRONIQUE
          </div>
          <div style={{ fontSize: cfg.titleSize, fontWeight: '900', color: '#0f172a', marginTop: '1.2mm', letterSpacing: '-0.01em' }}>
            {rep.reportTitle || "RAPPORT DE FIN D'INTERVENTION (P3)"}
          </div>
          <div style={{ fontSize: cfg.subHeaderSize, color: '#64748b', fontWeight: '600', marginTop: '0.6mm' }}>
            Dossier technique : #{ticket.id} · Édité le {editDateStr}
          </div>
        </div>

        {/* LIGNE DE SÉPARATION DISCRÈTE */}
        <div style={{ height: '1.2px', backgroundColor: '#0f172a', marginBottom: cfg.dividerMarginBottom }} />

        {/* BLOC CLIENT ET APPAREIL */}
        <div style={{
          border: '0.6pt solid #cbd5e1',
          borderRadius: '1.2mm',
          padding: cfg.clientCardPadding,
          marginBottom: cfg.clientCardMarginBottom,
          backgroundColor: '#ffffff'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm' }}>
            {/* CLIENT */}
            <div>
              <div style={{ fontSize: cfg.clientSubSize, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4mm' }}>
                CLIENT
              </div>
              <div style={{ fontSize: cfg.clientNameSize, fontWeight: '900', color: '#0f172a', textTransform: 'uppercase' }}>
                {ticket.client?.name || 'CLIENT NON COMMUNIQUÉ'}
              </div>
              <div style={{ fontSize: cfg.clientSubSize, color: '#334155', marginTop: '0.3mm' }}>
                Tél : {ticket.client?.phone || 'N/A'}
              </div>
            </div>

            {/* APPAREIL */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: cfg.clientSubSize, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4mm' }}>
                APPAREIL
              </div>
              <div style={{ fontSize: cfg.clientNameSize, fontWeight: '900', color: '#0f172a' }}>
                {ticket.macBrand} {ticket.macModel}
              </div>
              <div style={{ fontSize: cfg.clientSubSize, color: '#475569', marginTop: '0.3mm' }}>
                Réf. {ticket.modelNumber || 'AXXXX'} · S/N : {ticket.serialNumber || 'NON COMMUNIQUÉ'}
              </div>
            </div>
          </div>
        </div>

        {/* BANDEAU ÉTAT INITIAL À LA RÉCEPTION */}
        <div style={{
          border: '0.6pt solid #e2e8f0',
          backgroundColor: '#f8fafc',
          padding: cfg.initialCondPadding,
          borderRadius: '1.2mm',
          marginBottom: cfg.initialCondMarginBottom,
          fontSize: cfg.initialCondFontSize,
          display: 'flex',
          alignItems: 'center',
          gap: '2mm'
        }}>
          <span style={{ fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
            ÉTAT INITIAL À LA RÉCEPTION :
          </span>
          <span style={{ fontWeight: '700', color: '#dc2626' }}>
            {getInitialCondition()}
          </span>
        </div>

        {/* TABLEAU STATUT ET FICHE */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: cfg.statusTableMarginBottom }}>
          <tbody>
            <tr>
              <td style={{
                width: '70%',
                backgroundColor: '#f1f5f9',
                border: '0.6pt solid #cbd5e1',
                padding: cfg.statusPaddingHeader,
                fontSize: cfg.statusHeaderSize,
                fontWeight: '800',
                color: '#64748b',
                textTransform: 'uppercase'
              }}>
                STATUT
              </td>
              <td style={{
                width: '30%',
                backgroundColor: '#f1f5f9',
                border: '0.6pt solid #cbd5e1',
                padding: cfg.statusPaddingHeader,
                fontSize: cfg.statusHeaderSize,
                fontWeight: '800',
                color: '#64748b',
                textTransform: 'uppercase'
              }}>
                FICHE
              </td>
            </tr>
            <tr>
              <td style={{
                backgroundColor: '#f0fdf4',
                border: '0.6pt solid #cbd5e1',
                padding: cfg.statusPaddingValue,
                fontSize: cfg.statusValueSize,
                fontWeight: '800',
                color: '#166534'
              }}>
                {statusLabel}
              </td>
              <td style={{
                backgroundColor: '#ffffff',
                border: '0.6pt solid #cbd5e1',
                padding: cfg.statusPaddingValue,
                fontSize: cfg.statusValueSize,
                fontWeight: '900',
                color: '#0f172a',
                fontFamily: 'monospace'
              }}>
                N° {ticket.id}
              </td>
            </tr>
          </tbody>
        </table>

        {/* SECTIONS NUMÉROTÉES VERTES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: cfg.sectionsGap }}>
          {/* 1. Interventions réalisées */}
          <div>
            <div style={{ fontSize: cfg.sectionTitleSize, fontWeight: '900', color: '#047857', display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
              <span>1.</span> <span>Interventions réalisées</span>
            </div>
            {renderBulletList(rep.interventionsDone, defaultInterventions)}
          </div>

          {/* 2. Résultat */}
          <div>
            <div style={{ fontSize: cfg.sectionTitleSize, fontWeight: '900', color: '#047857', display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
              <span>2.</span> <span>Résultat</span>
            </div>
            {renderBulletList(rep.result, defaultResult)}
          </div>

          {/* 3. Constat */}
          <div>
            <div style={{ fontSize: cfg.sectionTitleSize, fontWeight: '900', color: '#047857', display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
              <span>3.</span> <span>Constat</span>
            </div>
            {renderBulletList(rep.observation, defaultObservation)}
          </div>

          {/* 4. Cause du défaut */}
          <div>
            <div style={{ fontSize: cfg.sectionTitleSize, fontWeight: '900', color: '#047857', display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
              <span>4.</span> <span>Cause du défaut</span>
            </div>
            {renderBulletList(rep.faultCause, defaultCauses)}
          </div>

          {/* 5. Important — précautions et suivi (Encadré beige soigné) */}
          <div style={{
            backgroundColor: '#fcfbf8',
            border: '0.6pt solid #e6ded3',
            borderRadius: '1.2mm',
            padding: cfg.importantPadding,
            marginTop: cfg.importantMarginTop
          }}>
            <div style={{ fontSize: cfg.sectionTitleSize, fontWeight: '900', color: '#047857', display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
              <span>5.</span> <span>Important — précautions et suivi</span>
            </div>
            {renderBulletList(rep.importantNotes, defaultImportant)}
          </div>

          {/* 6. Retrait et suivi (Tableau 2 colonnes) */}
          <div style={{ marginTop: '0.5mm' }}>
            <div style={{ fontSize: cfg.sectionTitleSize, fontWeight: '900', color: '#047857', display: 'flex', alignItems: 'center', gap: '1.5mm', marginBottom: '0.8mm' }}>
              <span>6.</span> <span>Retrait et suivi</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{
                    width: '50%',
                    backgroundColor: '#f1f5f9',
                    border: '0.6pt solid #cbd5e1',
                    padding: '1mm 2.5mm',
                    textAlign: 'left',
                    fontSize: '6.8pt',
                    fontWeight: '800',
                    color: '#334155'
                  }}>
                    Retrait de la machine
                  </th>
                  <th style={{
                    width: '50%',
                    backgroundColor: '#f1f5f9',
                    border: '0.6pt solid #cbd5e1',
                    padding: '1mm 2.5mm',
                    textAlign: 'left',
                    fontSize: '6.8pt',
                    fontWeight: '800',
                    color: '#334155'
                  }}>
                    Prochain rendez-vous
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{
                    border: '0.6pt solid #cbd5e1',
                    padding: cfg.retraitTablePadding,
                    fontSize: cfg.retraitTableFontSize,
                    color: '#1e293b',
                    lineHeight: cfg.retraitLineHeight,
                    verticalAlign: 'top'
                  }}>
                    {rep.retraitDateInfo || "Vendredi 18 septembre, à partir de 12 h, selon votre disponibilité."}
                  </td>
                  <td style={{
                    border: '0.6pt solid #cbd5e1',
                    padding: cfg.retraitTablePadding,
                    fontSize: cfg.retraitTableFontSize,
                    color: '#1e293b',
                    lineHeight: cfg.retraitLineHeight,
                    verticalAlign: 'top'
                  }}>
                    {rep.nextRdvInfo || "À partir du 19 octobre — à prévoir dans votre planning, pour une durée de 48 h minimum."}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BAS DE PAGE (SIGNATURES & FOOTER) */}
      <div>
        {/* ZONE DES SIGNATURES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6mm', marginTop: cfg.signatureMarginTop, paddingTop: '1mm' }}>
          <div>
            <div style={{ fontSize: '7pt', fontWeight: '800', color: '#475569', marginBottom: '0.8mm' }}>
              Technicien / TGS-CI Réparation
            </div>
            <div style={{
              height: cfg.signatureBoxHeight,
              borderBottom: '0.6pt solid #94a3b8',
              display: 'flex',
              alignItems: 'center',
              fontSize: '6.5pt',
              color: '#94a3b8',
              fontStyle: 'italic'
            }}>
              {rep.technicianName ? `Validé par : ${rep.technicianName}` : "Cachet & Visa Atelier"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '7pt', fontWeight: '800', color: '#475569', marginBottom: '0.8mm' }}>
              Signature du client
            </div>
            <div style={{
              height: cfg.signatureBoxHeight,
              borderBottom: '0.6pt solid #94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {ticket.clientSignature ? (
                <img src={ticket.clientSignature} alt="Signature Client" style={{ maxHeight: '90%' }} />
              ) : (
                <span style={{ fontSize: '6.5pt', color: '#cbd5e1', fontStyle: 'italic' }}>Bon pour accord & conformité</span>
              )}
            </div>
          </div>
        </div>

        {/* PIED DE PAGE DISCRET */}
        <div style={{
          marginTop: cfg.footerMarginTop,
          paddingTop: '1.2mm',
          borderTop: '0.4pt solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '6pt',
          color: '#64748b'
        }}>
          <span>TGS-CI Réparation — Abidjan · {ticket.client?.name || 'CLIENT'}</span>
          <span>Dossier #{ticket.id} · Page 1/1</span>
        </div>
      </div>
      </div>
    </div>
  );
};

export default PrintableTechnicalReportP3;
