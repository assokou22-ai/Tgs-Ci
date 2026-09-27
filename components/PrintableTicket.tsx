
import React from 'react';
import { RepairTicket, PowerOnStatus } from '../types.ts';
import { AppleLogo } from './icons.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import SecureQrCode from './SecureQrCode.tsx';

interface PrintableTicketProps {
  ticket: RepairTicket;
  forceDiagnosticOnly?: boolean;
}

const PrintableTicket: React.FC<PrintableTicketProps> = ({ ticket, forceDiagnosticOnly = false }) => {
  const { settings } = useAppSettings();
  const shop = settings.workshop || {
    name: 'TGS-CI',
    phone: '+225 07 57 13 35 07',
    address: 'Cocody Faya, Carrefour Coq Ivoir, Abidjan',
    email: 'contact@tgs-ci.com',
    currency: 'F CFA'
  };

  if (!ticket) return null;
  
  const diagCost = ticket.costs?.diagnostic || 0;
  
  // Calcul intelligent des prestations
  const servicesTotal = ticket.services?.reduce((sum, s) => sum + s.price, 0) || 0;
  const total = diagCost + servicesTotal;
  
  const advance = ticket.costs?.advance || 0;
  const balance = Math.abs(total - advance);

  const dateStr = new Date(ticket.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hourStr = new Date(ticket.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Calcul dynamique intelligent de la charge de contenu :
  // On n'augmente le score que si du VRAI contenu supplémentaire volumineux est présent
  const servicesCount = ticket.services?.length || 0;
  const hasWarning = !ticket.powersOn;
  const problemDesc = (ticket.problemDescription || '').trim();
  const problemLen = problemDesc.length;
  const hasBagDesc = !!(ticket.bagIncluded && ticket.bagDescription);
  const isReIntervention = !!ticket.isReIntervention;
  const hasTechnicalVerdict = !!(ticket.customFields?.technicalVerdict || ticket.technicianNotes || ticket.customFields?.diagnostic);

  let densityScore = 0;
  // L'avertissement de non-démarrage est court (2 lignes), impact minime
  if (hasWarning) densityScore += 6;
  // Les prestations au-delà de la 1ère prennent de la hauteur
  if (servicesCount > 1) densityScore += (servicesCount - 1) * 11;
  // Description du problème
  if (problemLen > 250) densityScore += 26;
  else if (problemLen > 140) densityScore += 16;
  else if (problemLen > 70) densityScore += 8;
  // Éléments optionnels
  if (hasBagDesc) densityScore += 6;
  if (isReIntervention) densityScore += 6;
  if (hasTechnicalVerdict) densityScore += 12;

  // 4 paliers d'adaptation dynamique intelligente :
  // Le mode standard (< 25) est généreux, avec de grandes polices confortables et lisibles.
  // Les polices ne réduisent que lorsqu'il y a réellement beaucoup d'informations.
  const isExtreme = densityScore >= 70;
  const isUltra = densityScore >= 46 && !isExtreme;
  const isDense = densityScore >= 25 && !isUltra && !isExtreme;

  const cfg = {
    // Structure globale de la page A4 (210mm x 297mm)
    pagePadding: isExtreme ? '4mm 7mm' : isUltra ? '5.5mm 8.5mm' : isDense ? '7mm 9.5mm' : '8.5mm 11mm',
    sectionGap: isExtreme ? '1mm' : isUltra ? '1.8mm' : isDense ? '2.5mm' : '3.5mm',
    
    // En-tête
    headerPaddingBottom: isExtreme ? '0.8mm' : isUltra ? '1.4mm' : isDense ? '1.8mm' : '2.2mm',
    appleLogoSize: isExtreme ? '14pt' : isUltra ? '16pt' : isDense ? '18pt' : '21pt',
    shopNameSize: isExtreme ? '14pt' : isUltra ? '16pt' : isDense ? '18.5pt' : '21pt',
    subtitleSize: isExtreme ? '6.2pt' : isUltra ? '7pt' : isDense ? '7.8pt' : '8.5pt',
    addressSize: isExtreme ? '6.2pt' : isUltra ? '7pt' : isDense ? '7.5pt' : '8.2pt',
    badgeSize: isExtreme ? '7pt' : isUltra ? '7.8pt' : isDense ? '8.5pt' : '9.5pt',
    badgePadding: isExtreme ? '0.6mm 2mm' : isUltra ? '0.8mm 2.4mm' : isDense ? '1mm 2.8mm' : '1.3mm 3.2mm',
    qrSize: isExtreme ? 38 : isUltra ? 44 : isDense ? 48 : 54,
    ticketIdSize: isExtreme ? '13pt' : isUltra ? '14.5pt' : isDense ? '16.5pt' : '19pt',
    ticketDateSize: isExtreme ? '6.5pt' : isUltra ? '7pt' : isDense ? '7.8pt' : '8.5pt',

    // Client & Appareil
    cardPadding: isExtreme ? '1.2mm 2.2mm' : isUltra ? '1.8mm 2.8mm' : isDense ? '2.5mm 3.5mm' : '3.2mm 4.5mm',
    cardTitleSize: isExtreme ? '6.8pt' : isUltra ? '7.5pt' : isDense ? '8.5pt' : '9.5pt',
    labelSize: isExtreme ? '5.8pt' : isUltra ? '6.5pt' : isDense ? '7.2pt' : '8pt',
    valueSize: isExtreme ? '7.8pt' : isUltra ? '8.8pt' : isDense ? '9.8pt' : '11pt',
    serialSize: isExtreme ? '7.4pt' : isUltra ? '8.2pt' : isDense ? '9.2pt' : '10.5pt',

    // État & Inventaire
    inventoryPadding: isExtreme ? '1.2mm 2.2mm' : isUltra ? '1.8mm 2.8mm' : isDense ? '2.5mm 3.5mm' : '3mm 4.5mm',
    inventoryTitleSize: isExtreme ? '6.8pt' : isUltra ? '7.5pt' : isDense ? '8.2pt' : '9pt',
    inventoryFontSize: isExtreme ? '6.4pt' : isUltra ? '7.2pt' : isDense ? '8pt' : '9pt',
    inventoryRowGap: isExtreme ? '0.6mm' : isUltra ? '1mm' : isDense ? '1.5mm' : '2mm',

    // Avertissement Machine ne démarre pas (!powersOn)
    warnPadding: isExtreme ? '0.8mm 1.6mm' : isUltra ? '1.1mm 2mm' : isDense ? '1.4mm 2.4mm' : '1.8mm 3mm',
    warnFontSize: isExtreme ? '5.6pt' : isUltra ? '6.2pt' : isDense ? '6.8pt' : '7.4pt',
    warnLineHeight: isExtreme ? '1.12' : isUltra ? '1.16' : isDense ? '1.2' : '1.24',

    // Symptôme signalé
    symptomPadding: isExtreme ? '1mm 2mm' : isUltra ? '1.5mm 2.5mm' : isDense ? '2.2mm 3mm' : '2.8mm 4mm',
    symptomTitleSize: isExtreme ? '6.4pt' : isUltra ? '7pt' : isDense ? '7.8pt' : '8.5pt',
    symptomTextSize: isExtreme ? '7pt' : isUltra ? '8pt' : isDense ? '9pt' : '10.2pt',

    // Tableau devis & prestations
    thPadding: isExtreme ? '0.8mm 1.5mm' : isUltra ? '1.2mm 2mm' : isDense ? '1.8mm 2.8mm' : '2.4mm 3.5mm',
    tdPadding: isExtreme ? '0.6mm 1.5mm' : isUltra ? '1mm 2mm' : isDense ? '1.5mm 2.8mm' : '2.2mm 3.5mm',
    tableFontSize: isExtreme ? '6.5pt' : isUltra ? '7.4pt' : isDense ? '8.4pt' : '9.5pt',
    tableTotalSize: isExtreme ? '7.5pt' : isUltra ? '8.5pt' : isDense ? '9.5pt' : '10.5pt',
    tableBalanceSize: isExtreme ? '8.2pt' : isUltra ? '9.5pt' : isDense ? '10.8pt' : '12pt',

    // Conditions TGS-CI (Organisées en 2 colonnes - calibrées pour rester discrètes)
    conditionsPadding: isExtreme ? '0.8mm 1.5mm' : isUltra ? '1.1mm 1.8mm' : isDense ? '1.4mm 2.2mm' : '1.8mm 2.6mm',
    conditionsTitleSize: isExtreme ? '5.8pt' : isUltra ? '6.3pt' : isDense ? '6.8pt' : '7.4pt',
    conditionsFontSize: isExtreme ? '5pt' : isUltra ? '5.5pt' : isDense ? '6pt' : '6.6pt',
    conditionsLineHeight: isExtreme ? '1.08' : isUltra ? '1.12' : isDense ? '1.16' : '1.2',
    conditionsRowGap: isExtreme ? '0.2mm' : isUltra ? '0.4mm' : isDense ? '0.6mm' : '0.8mm',
    appleWarningSize: isExtreme ? '5.4pt' : isUltra ? '5.9pt' : isDense ? '6.4pt' : '7pt',

    // Retrait de matériel (SANS CADRANT)
    retraitFontSize: isExtreme ? '6.5pt' : isUltra ? '7.2pt' : isDense ? '8pt' : '9pt',
    retraitPaddingTop: isExtreme ? '0.8mm' : isUltra ? '1.2mm' : isDense ? '1.8mm' : '2.2mm',
    retraitMarginTop: isExtreme ? '0.6mm' : isUltra ? '1mm' : isDense ? '1.5mm' : '2mm',

    // Signatures
    signatureBoxHeight: isExtreme ? '7mm' : isUltra ? '9mm' : isDense ? '12mm' : '15mm',
    signatureTitleSize: isExtreme ? '6.2pt' : isUltra ? '7pt' : isDense ? '7.8pt' : '8.5pt',
    signatureMarginTop: isExtreme ? '0.6mm' : isUltra ? '1.2mm' : isDense ? '1.8mm' : '2.5mm',
  };

  const textLabel = { fontSize: cfg.labelSize, fontWeight: 'bold', color: '#666', textTransform: 'uppercase' as const };
  const textValue = { fontSize: cfg.valueSize, fontWeight: '900', color: '#000' };

  const getPowerStatusLabel = (status: PowerOnStatus) => {
    switch(status) {
      case 'charge_systeme': return "OUI, CHARGE LE SYSTÈME";
      case 'ne_charge_pas': return "OUI, NE CHARGE PAS LE SYSTÈME";
      case 'bootloop': return "AFFICHAGE / BOOT LOOP";
      case 'ecran_casse': return "OUI, ÉCRAN CASSÉ";
      case 'ecran_non_fonctionnel': return "OUI, ÉCRAN NON FONCTIONNEL";
      case 'rien_ne_saffiche': return "OUI, PAS D'AFFICHAGE";
      case 'non':
      default: return "NON, NE S'ALLUME PAS";
    }
  };

  return (
    <div 
      className="printable-page ticket-single-page single-page-fit" 
      style={{ 
        padding: cfg.pagePadding, 
        justifyContent: 'space-between', 
        gap: cfg.sectionGap,
        height: '296mm',
        maxHeight: '296mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        pageBreakInside: 'avoid',
        pageBreakAfter: 'always'
      }}
    >
      {/* EN-TÊTE OFFICIEL */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.4pt solid #000', paddingBottom: cfg.headerPaddingBottom }}>
          <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', marginBottom: '0.8mm' }}>
                <AppleLogo style={{ width: cfg.appleLogoSize, height: cfg.appleLogoSize, color: '#000' }} />
                <h1 style={{ fontSize: cfg.shopNameSize, fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>{shop.name}</h1>
              </div>
              <p style={{ fontSize: cfg.subtitleSize, fontWeight: 'bold', textTransform: 'uppercase', color: '#000', margin: '0 0 0.8mm 0' }}>Expertise & Réparation MacBook Apple</p>
              <div style={{ fontSize: cfg.addressSize, color: '#444', lineHeight: '1.2 text-left' }}>{shop.address}<br/><strong>{shop.phone}</strong></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '3.5mm' }}>
              <SecureQrCode ticketId={ticket.id} size={cfg.qrSize} />
              <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: cfg.badgeSize, fontWeight: '900', color: '#FFF', background: forceDiagnosticOnly ? '#6b46c1' : '#000', padding: cfg.badgePadding, marginBottom: '0.8mm', borderRadius: '0.8mm', display: 'inline-block' }}>
                    {forceDiagnosticOnly ? 'RAPPORT DE DIAGNOSTIC (P2)' : 'FICHE DE DÉPÔT'}
                  </div>
                  {ticket.isReIntervention && !forceDiagnosticOnly && (
                      <div style={{ fontSize: cfg.badgeSize, fontWeight: '900', color: '#FFF', background: '#c53030', padding: cfg.badgePadding, marginLeft: '1.5mm', borderRadius: '0.8mm', display: 'inline-block' }}>RÉ-INTERVENTION / SAV</div>
                  )}
                  <div style={{ fontSize: cfg.ticketIdSize, fontWeight: '900', fontFamily: 'monospace', color: '#0071e3', lineHeight: '1.1' }}>#{ticket.id}</div>
                  <div style={{ fontSize: cfg.ticketDateSize, fontWeight: '900', marginTop: '0.3mm', color: '#000' }}>
                    DÉPÔT : {dateStr} À {hourStr}
                    {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
                      <span style={{ color: '#444', fontWeight: 'bold', marginLeft: '1.2mm' }}>
                        · MAJ : {new Date(ticket.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                  </div>
              </div>
          </div>
      </header>

      {/* CLIENT & APPAREIL */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm' }}>
          <section style={{ border: '0.5pt solid #000', padding: cfg.cardPadding, borderRadius: '1.2mm' }}>
              <h2 style={{ fontSize: cfg.cardTitleSize, fontWeight: '900', borderBottom: '0.4pt solid #000', paddingBottom: '0.3mm', marginBottom: '0.8mm' }}>👤 CLIENT</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5mm' }}>
                <div>
                  <span style={textLabel}>Nom Complet : </span>
                  <span style={textValue}>{ticket.client.name.toUpperCase()}</span>
                </div>
                <div>
                  <span style={textLabel}>Contact WhatsApp : </span>
                  <span style={{ ...textValue, color: '#0071e3' }}>{ticket.client.phone}</span>
                </div>
              </div>
          </section>
          <section style={{ border: '0.5pt solid #000', padding: cfg.cardPadding, borderRadius: '1.2mm' }}>
              <h2 style={{ fontSize: cfg.cardTitleSize, fontWeight: '900', borderBottom: '0.4pt solid #000', paddingBottom: '0.3mm', marginBottom: '0.8mm' }}>💻 APPAREIL</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5mm' }}>
                <div>
                  <span style={textLabel}>Modèle : </span>
                  <span style={textValue}>{ticket.macModel} {ticket.modelNumber ? `(${ticket.modelNumber})` : ''}</span>
                </div>
                <div>
                  <span style={textLabel}>N° de Série (S/N) : </span>
                  <span style={{ ...textValue, fontSize: cfg.serialSize, fontFamily: 'monospace' }}>{ticket.serialNumber || 'NON SPÉCIFIÉ'}</span>
                </div>
              </div>
          </section>
      </div>

      {/* SECTION ÉTAT & INVENTAIRE */}
      <section style={{ border: '0.5pt solid #000', padding: cfg.inventoryPadding, borderRadius: '1.2mm' }}>
          <h2 style={{ fontSize: cfg.inventoryTitleSize, fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.8mm', borderBottom: '0.3pt solid #EEE', paddingBottom: '0.3mm' }}>📦 État à la réception & Inventaire</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '3.5mm' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: cfg.inventoryRowGap }}>
                  <div style={{ fontSize: cfg.inventoryFontSize, lineHeight: '1.25' }}>
                      <strong style={{ color: '#0071e3' }}>ALLUMAGE :</strong> {getPowerStatusLabel(ticket.powerOnStatus)}
                  </div>
                  <div style={{ fontSize: cfg.inventoryFontSize, lineHeight: '1.25' }}>
                      <strong style={{ color: '#0071e3' }}>ÉTAT BATTERIE :</strong> {ticket.batteryFunctional === 'yes' ? 'FONCTIONNELLE' : ticket.batteryFunctional === 'no' ? 'HS / DÉGRADÉE' : 'INCONNU (À TESTER)'}
                  </div>
                  <div style={{ fontSize: cfg.inventoryFontSize, lineHeight: '1.25' }}>
                      <strong style={{ color: '#0071e3' }}>COQUE PROTECTION :</strong> {ticket.caseIncluded ? `OUI (Couleur: ${ticket.caseColor || 'non précisée'})` : 'NON'}
                  </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: cfg.inventoryRowGap }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5mm', fontSize: cfg.inventoryFontSize, lineHeight: '1.25' }}>
                      <div style={{ width: '2.5mm', height: '2.5mm', border: '0.5pt solid #000', background: ticket.chargerIncluded ? '#000' : 'transparent', flexShrink: 0 }}></div>
                      <span><strong>CHARGEUR :</strong> {ticket.chargerIncluded ? 'OUI (A TESTER)' : 'NON'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5mm', fontSize: cfg.inventoryFontSize, lineHeight: '1.25' }}>
                      <div style={{ width: '2.5mm', height: '2.5mm', border: '0.5pt solid #000', background: ticket.bagIncluded ? '#000' : 'transparent', flexShrink: 0 }}></div>
                      <span><strong>SAC DE TRANSPORT :</strong> {ticket.bagIncluded ? 'OUI' : 'NON'}</span>
                  </div>
                  {ticket.bagIncluded && ticket.bagDescription && (
                      <div style={{ fontSize: '6pt', fontStyle: 'italic', paddingLeft: '3.5mm', color: '#555', lineHeight: '1.2' }}>
                          Desc: {ticket.bagDescription}
                      </div>
                  )}
              </div>
          </div>
      </section>

      {/* Avertissements conditionnels pour machine ne démarrant pas */}
      {!ticket.powersOn && (
        <div style={{ border: '0.6pt solid #333', padding: cfg.warnPadding, borderRadius: '1.2mm', backgroundColor: '#fff' }}>
            <div style={{ fontSize: cfg.warnFontSize, fontWeight: '500', color: '#111', lineHeight: cfg.warnLineHeight }}>
                ⚠️ <strong>Attention :</strong> Le diagnostic basique de {diagCost.toLocaleString()} {shop.currency} ne permet pas de tester les autres composants (écran, clavier, batterie, touchbar, etc.) tant que la carte mère ne démarre pas. L'état réel ne sera vérifiable qu'après remise sous tension de la carte mère.
            </div>
        </div>
      )}

      {/* SYMPTÔME SIGNALÉ / CONCLUSIONS DU DIAGNOSTIC */}
      <div style={{ border: '0.5pt solid #000', padding: cfg.symptomPadding, backgroundColor: '#f5f5f7', borderRadius: '1.2mm' }}>
          <h2 style={{ fontSize: cfg.symptomTitleSize, fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.6mm', color: forceDiagnosticOnly ? '#6b46c1' : '#0071e3' }}>
            {forceDiagnosticOnly ? '🔍 CONCLUSIONS DU DIAGNOSTIC' : '📝 SYMPTÔME SIGNALÉ'}
          </h2>
          <p style={{ fontSize: cfg.symptomTextSize, fontStyle: 'italic', margin: 0, fontWeight: '500', lineHeight: '1.25', whiteSpace: 'pre-line' }}>"{ticket.problemDescription}"</p>
          {(ticket.customFields?.technicalVerdict || ticket.technicianNotes || ticket.customFields?.diagnostic) && (
            <div style={{ marginTop: '0.8mm', paddingTop: '0.6mm', borderTop: '0.3pt dashed #ccc', fontSize: cfg.symptomTextSize, lineHeight: '1.2' }}>
              <span style={{ fontWeight: '900', color: '#0369a1' }}>🔬 RAPPORT TECHNIQUE / AVIS ATELIER : </span>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>
                {ticket.customFields?.technicalVerdict || ticket.technicianNotes || ticket.customFields?.diagnostic}
              </span>
            </div>
          )}
      </div>

      {/* TABLEAU DEVIS & PRESTATIONS */}
      {!forceDiagnosticOnly && (
        <div style={{ flex: '0 1 auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#000', color: '#FFF', fontSize: cfg.tableFontSize }}>
                        <th style={{ padding: cfg.thPadding, textAlign: 'left' }}>DÉSIGNATION TRAVAUX / PIÈCES</th>
                        <th style={{ padding: cfg.thPadding, textAlign: 'right', width: '25%' }}>MONTANT (F)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style={{ borderBottom: '0.4pt solid #EEE' }}>
                        <td style={{ padding: cfg.tdPadding, fontSize: cfg.tableFontSize, fontWeight: '600' }}>Expertise & Diagnostic Technique</td>
                        <td style={{ padding: cfg.tdPadding, textAlign: 'right', fontWeight: '900', fontSize: cfg.tableFontSize }}>{diagCost.toLocaleString()}</td>
                    </tr>
                    
                    <tr style={{ borderBottom: '0.4pt solid #EEE', backgroundColor: '#f0f7ff' }}>
                        <td style={{ padding: cfg.tdPadding, fontSize: cfg.tableFontSize, fontWeight: '900', color: '#0071e3' }}>Détails Devis & Prestations (Sous-total)</td>
                        <td style={{ padding: cfg.tdPadding, textAlign: 'right', fontWeight: '900', fontSize: cfg.tableFontSize, color: '#0071e3' }}>{servicesTotal.toLocaleString()}</td>
                    </tr>

                    {ticket.services.map((s, i) => (
                        <tr key={i} style={{ borderBottom: '0.4pt solid #EEE' }}>
                            <td style={{ padding: cfg.tdPadding, paddingLeft: '4mm', fontSize: cfg.tableFontSize, color: '#444' }}>• {s.name}</td>
                            <td style={{ padding: cfg.tdPadding, textAlign: 'right', fontSize: cfg.tableFontSize, color: '#444' }}>{s.price.toLocaleString()}</td>
                        </tr>
                    ))}

                    <tr style={{ borderTop: '0.8pt solid #000' }}>
                        <td style={{ padding: cfg.tdPadding, textAlign: 'right', fontWeight: '900', fontSize: cfg.tableTotalSize, color: '#555' }}>TOTAL ESTIMÉ</td>
                        <td style={{ padding: cfg.tdPadding, textAlign: 'right', fontSize: cfg.tableTotalSize, fontWeight: '900' }}>{total.toLocaleString()}</td>
                    </tr>
                    <tr style={{ color: '#c53030' }}>
                        <td style={{ padding: cfg.tdPadding, textAlign: 'right', fontSize: cfg.tableFontSize, fontWeight: 'bold' }}>ACOMPTE VERSÉ (-)</td>
                        <td style={{ padding: cfg.tdPadding, textAlign: 'right', fontSize: cfg.tableFontSize, fontWeight: '900' }}>{advance.toLocaleString()}</td>
                    </tr>
                    <tr style={{ background: '#0071e3', color: '#FFF' }}>
                        <td style={{ padding: cfg.tdPadding, textAlign: 'right', fontSize: cfg.tableBalanceSize, fontWeight: '900' }}>SOLDE À RÉGLER</td>
                        <td style={{ padding: cfg.tdPadding, textAlign: 'right', fontSize: cfg.tableBalanceSize, fontWeight: '900' }}>{balance.toLocaleString()} {shop.currency}</td>
                    </tr>
                </tbody>
            </table>
        </div>
      )}

      {/* CONDITIONS TGS-CI (Optimisées en 2 colonnes) */}
      <div style={{ border: '0.5pt solid #444', padding: cfg.conditionsPadding, borderRadius: '1.2mm', backgroundColor: '#fafafa' }}>
          <div style={{ fontSize: cfg.conditionsTitleSize, fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.4mm', borderBottom: '0.3pt solid #ccc', paddingBottom: '0.3mm', lineHeight: '1.2' }}>📄 CONDITIONS {shop.name}</div>
          <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              columnGap: '3mm', 
              rowGap: cfg.conditionsRowGap, 
              fontSize: cfg.conditionsFontSize, 
              fontWeight: '500', 
              lineHeight: cfg.conditionsLineHeight 
          }}>
            <div style={{ textAlign: 'justify' }}><span style={{ fontWeight: '800', color: '#0071e3' }}>Diagnostic :</span> Forfait fixe de {diagCost.toLocaleString()} {shop.currency} dû dès l'ouverture de l'appareil.</div>
            <div style={{ textAlign: 'justify' }}><span style={{ fontWeight: '800', color: '#0071e3' }}>Sauvegarde :</span> La responsabilité des données stockées incombe exclusivement au client. {shop.name} ne garantit pas la récupération des données.</div>
            <div style={{ textAlign: 'justify' }}><span style={{ fontWeight: '800', color: '#0071e3' }}>Garantie :</span> L'intervention technique sur les circuits logiques et composants propriétaires annule définitivement la garantie constructeur Apple.</div>
            <div style={{ textAlign: 'justify' }}><span style={{ fontWeight: '800', color: '#0071e3' }}>Abandon :</span> Tout matériel non récupéré sous 90 jours après notification est considéré comme abandonné et pourra être recyclé.</div>
            <div style={{ gridColumn: '1 / -1', textAlign: 'justify' }}><span style={{ fontWeight: '800', color: '#0071e3' }}>Limitation de Responsabilité :</span> {shop.name} est tenu à une obligation de moyens. En raison de la complexité des circuits électroniques, l'atelier n'est pas responsable des pannes intermittentes ou micro-fissures révélées au démontage.</div>
          </div>
          <div style={{ marginTop: '0.4mm', fontSize: cfg.appleWarningSize, fontWeight: '800', color: '#c53030', textAlign: 'center', paddingTop: '0.3mm', borderTop: '0.3pt dashed #DDD' }}>
            ⚠ L'OUVERTURE DE L'APPAREIL ANNULE LA GARANTIE CONSTRUCTEUR APPLE ⚠
          </div>
      </div>

      {/* SECTION RETRAIT DE MATÉRIEL — MENTION ET DATE MANUSCRITES DU CLIENT */}
      <div style={{ 
          borderTop: '0.6pt solid #000', 
          paddingTop: cfg.retraitPaddingTop,
          marginTop: cfg.retraitMarginTop,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: cfg.retraitFontSize,
          lineHeight: '1.2',
          color: '#000'
      }}>
          <span style={{ letterSpacing: '0.5px' }}>................................................</span>
          <span style={{ letterSpacing: '0.5px' }}>le ............./......................../...............................</span>
      </div>

      {/* SIGNATURE DU CLIENT & VISA ATELIER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4mm', marginTop: cfg.signatureMarginTop }}>
          <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: cfg.signatureTitleSize, fontWeight: '900', margin: '0 0 0.6mm 0' }}>SIGNATURE DU CLIENT</p>
              <div style={{ height: cfg.signatureBoxHeight, border: '0.5pt solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBFBFD' }}>
                  {ticket.clientSignature && <img src={ticket.clientSignature} style={{ maxHeight: '90%' }} alt="Signature client" />}
              </div>
          </div>
          <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: cfg.signatureTitleSize, fontWeight: '900', margin: '0 0 0.6mm 0' }}>VISA ATELIER / CACHET</p>
              <div style={{ height: cfg.signatureBoxHeight, border: '0.6pt dashed #AAA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#AAA', fontWeight: '900', fontSize: cfg.signatureTitleSize }}>{shop.name.toUpperCase()}</span>
              </div>
          </div>
      </div>
    </div>
  );
};

export default PrintableTicket;
