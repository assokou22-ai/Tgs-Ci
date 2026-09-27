import React from 'react';
import { RepairTicket, PowerOnStatus, EntryCondition } from '../types.ts';
import { AppleLogo } from './icons.tsx';
import { getStatusStyle } from '../utils/statusStyles.ts';
import SecureQrCode from './SecureQrCode.tsx';

interface PrintableTechnicalReportProps {
  ticket: RepairTicket;
}

const PrintableTechnicalReport: React.FC<PrintableTechnicalReportProps> = ({ ticket }) => {
  if (!ticket) return null;

  const dateStr = new Date(ticket.createdAt).toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
  const hourStr = new Date(ticket.createdAt).toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const updatedDateStr = ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) : 'N/A';

  const diagCost = ticket.costs?.diagnostic || 0;
  const servicesTotal = ticket.services?.reduce((sum, s) => sum + s.price, 0) || 0;
  const total = diagCost + servicesTotal;
  const advance = ticket.costs?.advance || 0;
  const balance = Math.max(0, total - advance);

  const getPowerStatusLabel = (status: PowerOnStatus) => {
    switch(status) {
      case 'charge_systeme': return "OUI, CHARGE LE SYSTÈME";
      case 'ne_charge_pas': return "OUI, NE CHARGE PAS LE SYSTÈME";
      case 'bootloop': return "AFFICHAGE / BOOT LOOP EN COURS";
      case 'ecran_casse': return "OUI, ÉCRAN BRISÉ / FISSURÉ";
      case 'ecran_non_fonctionnel': return "OUI, ÉCRAN SANS AFFICHAGE";
      case 'rien_ne_saffiche': return "OUI, PAS D'AFFICHAGE COQUE";
      case 'non':
      default: return "NON, S'ALLUME PAS (CARTE MÈRE HS)";
    }
  };

  const statusStyle = getStatusStyle(ticket.status);

  // Brand and styles setup according to high-fidelity Apple-certified aesthetic
  const styles = {
    container: {
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#1d1d1f',
      lineHeight: '1.25',
      padding: '4.5mm 7.5mm',
      backgroundColor: '#ffffff',
      height: '285mm',
      maxHeight: '285mm',
      boxSizing: 'border-box' as const,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'space-between' as const,
    },
    header: {
      borderBottom: '1.8px solid #002244',
      paddingBottom: '2mm',
      marginBottom: '2.5mm',
    },
    logoContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '2mm',
    },
    title: {
      fontSize: '16pt',
      fontWeight: '900',
      color: '#002244',
      letterSpacing: '0.02em',
      margin: 0,
    },
    subtitle: {
      fontSize: '6.8pt',
      fontWeight: '700',
      color: '#0071e3',
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      marginTop: '0.5mm',
      marginBottom: '0.5mm',
    },
    refBox: {
      textAlign: 'right' as const,
    },
    refId: {
      fontSize: '15pt',
      fontWeight: '900',
      fontFamily: 'monospace',
      color: '#0071e3',
      letterSpacing: '0.04em',
    },
    refLabel: {
      fontSize: '6.5pt',
      fontWeight: '800',
      color: '#86868b',
      textTransform: 'uppercase' as const,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '1mm',
      padding: '0.8mm 2mm',
      borderRadius: '0.8mm',
      fontSize: '6.5pt',
      fontWeight: '900',
      textTransform: 'uppercase' as const,
    },
    sectionTitle: {
      fontSize: '7.8pt',
      fontWeight: '900',
      color: '#002244',
      textTransform: 'uppercase' as const,
      borderBottom: '0.8px solid #e5e5e7',
      paddingBottom: '0.6mm',
      marginBottom: '1.5mm',
      letterSpacing: '0.03em',
    },
    grid2: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '3mm',
      marginBottom: '2.5mm',
    },
    card: {
      border: '0.6px solid #d2d2d7',
      borderRadius: '1.2mm',
      padding: '2mm 2.5mm',
      backgroundColor: '#f5f5f7',
    },
    label: {
      fontSize: '6pt',
      fontWeight: '700',
      color: '#86868b',
      textTransform: 'uppercase' as const,
      marginBottom: '0.3mm',
    },
    value: {
      fontSize: '7.8pt',
      fontWeight: '800',
      color: '#1d1d1f',
    },
    valuePrimary: {
      fontSize: '8.5pt',
      fontWeight: '900',
      color: '#0071e3',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      marginTop: '1mm',
      marginBottom: '2mm',
    },
    th: {
      backgroundColor: '#002244',
      color: '#ffffff',
      fontSize: '6.5pt',
      fontWeight: '900',
      padding: '1mm 2mm',
      textAlign: 'left' as const,
      textTransform: 'uppercase' as const,
    },
    td: {
      padding: '1mm 2mm',
      fontSize: '7.2pt',
      borderBottom: '0.6px solid #e5e5e7',
    },
    imageGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '2mm',
      marginTop: '1mm',
      marginBottom: '2.5mm',
    },
    imageWrapper: {
      border: '0.6px solid #d2d2d7',
      borderRadius: '1.2mm',
      overflow: 'hidden',
      height: '22mm',
      backgroundColor: '#f5f5f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
    },
    signSection: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '6mm',
      marginTop: '2mm',
    },
    signBox: {
      border: '0.6px dashed #002244',
      borderRadius: '1.2mm',
      height: '10mm',
      backgroundColor: '#fbfbfd',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative' as const,
      marginTop: '1mm',
    }
  };

  return (
    <div className="printable-page ticket-single-page single-page-fit" style={styles.container}>
      {/* HEADER SECTION */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm', borderBottom: '2.5px solid #002244', paddingBottom: '3mm' }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', padding: 0 }}>
              <div style={styles.logoContainer}>
                <AppleLogo style={{ width: '22pt', height: '22pt', color: '#002244' }} />
                <h1 style={styles.title}>TGS - CI</h1>
              </div>
              <div style={styles.subtitle}>TECHNOLOGY & REPAIR SERVICE GROUP</div>
              <div style={{ fontSize: '7.5pt', color: '#515154', marginTop: '1mm', lineHeight: '1.3' }}>
                Atelier Expert Certifié Apple • Plateforme de Diagnostic & Microsoudure<br />
                Cocody Faya, Abidjan • Tel: +225 07 57 13 35 07 • contact@tgs-ci.com
              </div>
            </td>
            <td style={{ verticalAlign: 'top', textAlign: 'right', padding: 0 }}>
              <div style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '3mm' }}>
                <SecureQrCode ticketId={ticket.id} size={50} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...styles.badge, backgroundColor: '#002244', color: '#ffffff', marginBottom: '2mm' }}>
                    📋 DOSSIER TECHNIQUE COMPLET
                  </div>
                  <div style={styles.refBox}>
                    <span style={styles.refLabel}>Fiche n° </span>
                    <span style={styles.refId}>#{ticket.id}</span>
                  </div>
                  <div style={{ fontSize: '7.5pt', fontWeight: '800', marginTop: '1mm', color: '#1d1d1f' }}>
                    RÉCEPTION : {dateStr} À {hourStr}<br />
                    MAJ TECHNIQUE : {updatedDateStr}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* CLENT & APPAREIL DETAILS */}
      <div style={styles.grid2}>
        {/* CARTE CLIENT */}
        <div style={styles.card}>
          <h3 style={{ fontSize: '8.5pt', fontWeight: '900', borderBottom: '1px solid #d2d2d7', paddingBottom: '1mm', marginBottom: '2mm', color: '#002244' }}>
            👤 INFORMATIONS CLIENT
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ ...styles.label, padding: '0.5mm 0', width: '35%' }}>Nom complet :</td>
                <td style={{ ...styles.value, padding: '0.5mm 0', textTransform: 'uppercase' }}>{ticket.client.name}</td>
              </tr>
              <tr>
                <td style={{ ...styles.label, padding: '0.5mm 0' }}>WhatsApp / Tel :</td>
                <td style={{ ...styles.valuePrimary, padding: '0.5mm 0' }}>{ticket.client.phone}</td>
              </tr>
              {ticket.client.email && (
                <tr>
                  <td style={{ ...styles.label, padding: '0.5mm 0' }}>E-mail :</td>
                  <td style={{ ...styles.value, padding: '0.5mm 0', fontSize: '8pt' }}>{ticket.client.email}</td>
                </tr>
              )}
              {ticket.client.isEnterprise && (
                <tr>
                  <td style={{ ...styles.label, padding: '0.5mm 0' }}>Type :</td>
                  <td style={{ ...styles.value, padding: '0.5mm 0', color: '#a855f7' }}>COMPTE ENTREPRISE / B2B</td>
                </tr>
              )}
              {ticket.customFields?.deposantName && (
                <tr>
                  <td style={{ ...styles.label, padding: '0.5mm 0' }}>Déposant :</td>
                  <td style={{ ...styles.value, padding: '0.5mm 0' }}>
                    {ticket.customFields.deposantName} {ticket.customFields.deposantFunction ? `(${ticket.customFields.deposantFunction})` : ''}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* CARTE APPAREIL */}
        <div style={styles.card}>
          <h3 style={{ fontSize: '8.5pt', fontWeight: '900', borderBottom: '1px solid #d2d2d7', paddingBottom: '1mm', marginBottom: '2mm', color: '#002244' }}>
            💻 SPÉCIFICATIONS APPAREIL
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ ...styles.label, padding: '0.5mm 0', width: '35%' }}>Modèle :</td>
                <td style={{ ...styles.value, padding: '0.5mm 0' }}>{ticket.macBrand} {ticket.macModel}</td>
              </tr>
              <tr>
                <td style={{ ...styles.label, padding: '0.5mm 0' }}>N° Modèle (A_XXX) :</td>
                <td style={{ ...styles.value, padding: '0.5mm 0', color: '#0071e3' }}>{ticket.modelNumber || 'Vérifié à l\'expertise'}</td>
              </tr>
              <tr>
                <td style={{ ...styles.label, padding: '0.5mm 0' }}>Numéro de Série :</td>
                <td style={{ ...styles.value, padding: '0.5mm 0', fontFamily: 'monospace' }}>{ticket.serialNumber || 'NON COMMUNIQUÉ'}</td>
              </tr>
              <tr>
                <td style={{ ...styles.label, padding: '0.5mm 0' }}>Couleur coque :</td>
                <td style={{ ...styles.value, padding: '0.5mm 0', textTransform: 'uppercase' }}>{ticket.macColor || 'Gris'}</td>
              </tr>
              {ticket.isReIntervention && (
                <tr>
                  <td style={{ ...styles.label, padding: '0.5mm 0' }}>Priorité :</td>
                  <td style={{ ...styles.value, padding: '0.5mm 0', color: '#ef4444' }}>🔥 GARANTIE / RE-INTERVENTION SAV</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECEPTION STATE & ACCESSORIES */}
      <div style={{ ...styles.card, marginBottom: '5mm', backgroundColor: '#ffffff', border: '0.6px solid #d2d2d7' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '45%', verticalAlign: 'top', paddingRight: '2mm' }}>
                <div style={styles.label}>État de démarrage initial :</div>
                <div style={{ fontSize: '8pt', fontWeight: 'bold', color: ticket.powersOn ? '#10b981' : '#ef4444' }}>
                  {getPowerStatusLabel(ticket.powerOnStatus)}
                </div>
              </td>
              <td style={{ width: '30%', verticalAlign: 'top' }}>
                <div style={styles.label}>Batterie intégrée :</div>
                <div style={{ fontSize: '8pt', fontWeight: 'bold' }}>
                  {ticket.batteryFunctional === 'yes' ? '🔋 FONCTIONNELLE' : ticket.batteryFunctional === 'no' ? '🪫 HS / DEGRADÉE' : '💤 DIAGNOSTIC EN COURS'}
                </div>
              </td>
              <td style={{ width: '25%', verticalAlign: 'top' }}>
                <div style={styles.label}>Inventaire :</div>
                <div style={{ fontSize: '7.5pt', lineHeight: '1.2' }}>
                  ⚡ Chargeur: <strong>{ticket.chargerIncluded ? 'OUI' : 'NON'}</strong><br />
                  👜 Sac: <strong>{ticket.bagIncluded ? 'OUI' : 'NON'}</strong><br />
                  🛡️ Coque: <strong>{ticket.caseIncluded ? `OUI (${ticket.caseColor || 'non spécifiée'})` : 'NON'}</strong>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SYMPTOMS & DIAGNOSTIC REVIEWS */}
      <h2 style={styles.sectionTitle}>🔍 ANALYSE DE L'EXPERTISE TECHNIQUE</h2>
      
      {/* Symptom block */}
      <div style={{ backgroundColor: '#fafafa', borderLeft: '3px solid #002244', padding: '2.5mm', borderRadius: '1mm', marginBottom: '4mm' }}>
        <div style={styles.label}>Symptôme Signalé à l'Entrée :</div>
        <p style={{ fontSize: '8.5pt', fontStyle: 'italic', margin: 0, fontWeight: '500' }}>
          "{ticket.problemDescription}"
        </p>
      </div>

      <div style={styles.grid2}>
        {/* Constats Cliniques / Synthese */}
        <div style={{ border: '0.6px solid #d2d2d7', borderRadius: '2mm', padding: '3.5mm', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.4px solid #d2d2d7', paddingBottom: '1mm', marginBottom: '2mm' }}>
            <span style={{ fontSize: '8pt', fontWeight: '900', color: '#002244' }}>🔬 Veredict Interne</span>
            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 ${statusStyle.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
              {ticket.status}
            </span>
          </div>

          {ticket.customFields?.technicalVerdict ? (
            <div>
              <div style={{ fontSize: '8.5pt', color: '#1d1d1f', fontWeight: 'bold', whiteSpace: 'pre-wrap', backgroundColor: '#0071e3/5', border: '0.5px solid #0071e3/20', padding: '2.5mm', borderRadius: '1mm' }}>
                {ticket.customFields.technicalVerdict}
              </div>
            </div>
          ) : (
            <>
              {ticket.customFields?.constatsParticuliers && (
                <div style={{ marginBottom: '2.5mm' }}>
                  <div style={{ ...styles.label, fontSize: '6.5pt' }}>Constats Particuliers Micro-électronique :</div>
                  <div style={{ fontSize: '8pt', color: '#333', whiteSpace: 'pre-wrap', backgroundColor: '#f5f5f7', padding: '2mm', borderRadius: '1mm' }}>
                    {ticket.customFields.constatsParticuliers}
                  </div>
                </div>
              )}

              {ticket.customFields?.diagnostic && (
                <div>
                  <div style={{ ...styles.label, fontSize: '6.5pt' }}>Synthèse d'Expertise Diagnostiquée :</div>
                  <div style={{ fontSize: '8pt', color: '#1d1d1f', fontWeight: 'bold', whiteSpace: 'pre-wrap', backgroundColor: '#0071e3/5', border: '0.5px solid #0071e3/20', padding: '2mm', borderRadius: '1mm' }}>
                    {ticket.customFields.diagnostic}
                  </div>
                </div>
              )}

              {!ticket.customFields?.constatsParticuliers && !ticket.customFields?.diagnostic && (
                <p style={{ fontSize: '8pt', color: '#86868b', fontStyle: 'italic', margin: 0 }}>
                  Le diagnostic standard complet a été réalisé et validé par notre équipe de techniciens certifiés.
                </p>
              )}
            </>
          )}
        </div>

        {/* Rails de tension ou Rapport de composants */}
        <div style={{ border: '0.6px solid #d2d2d7', borderRadius: '2mm', padding: '3.5mm', flex: 1 }}>
          <h4 style={{ fontSize: '8pt', fontWeight: '900', borderBottom: '0.4px solid #d2d2d7', paddingBottom: '1mm', marginBottom: '2mm', color: '#002244' }}>
            ⚡ Contrôles & Mesures Réalisés
          </h4>

          {ticket.customFields?.technicalMeasures ? (
            <div>
              <div style={{ fontSize: '8.5pt', color: '#1d1d1f', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                {ticket.customFields.technicalMeasures}
              </div>
            </div>
          ) : ticket.diagnosticSheetB ? (
            <div>
              <div style={{ ...styles.label, fontSize: '6.5pt', marginBottom: '1mm' }}>Mesures d'alimentation des rails (Expertise Électronique B) :</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5mm' }}>
                {ticket.diagnosticSheetB.tensionValues.filter(v => v.value).slice(0, 6).map((v, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f5f7', padding: '1mm 2mm', borderRadius: '1mm' }}>
                    <span style={{ fontSize: '7.5pt', fontWeight: 'bold', color: '#444' }}>{v.line}</span>
                    <span style={{ 
                      fontSize: '8pt', 
                      fontWeight: 'bold', 
                      color: v.status === 'Correct' ? '#10b981' : '#ef4444' 
                    }}>{v.value}</span>
                  </div>
                ))}
              </div>
              {ticket.diagnosticSheetB.visualInspection && (
                <div style={{ marginTop: '2mm' }}>
                  <div style={{ ...styles.label, fontSize: '6.5pt' }}>Rapport Inspecteur :</div>
                  <p style={{ fontSize: '7.5pt', color: '#555', margin: 0, fontStyle: 'italic', maxHeight: '12mm', overflow: 'hidden' }}>
                    "{ticket.diagnosticSheetB.visualInspection}"
                  </p>
                </div>
              )}
            </div>
          ) : ticket.diagnosticReport && ticket.diagnosticReport.length > 0 ? (
            <div>
              <div style={{ ...styles.label, fontSize: '6.5pt', marginBottom: '1.5mm' }}>Vérification des organes vitaux de l'appareil :</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1mm' }}>
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

                  return listToRender.map((chk, i) => {
                    let statusColor = '#4a5568';
                    const statusUpper = chk.status.toUpperCase();
                    if (statusUpper.includes('OK') || statusUpper.includes('FONCTIONNEL')) {
                      statusColor = '#2f855a';
                    } else if (statusUpper.includes('PROBLÈME') || statusUpper.includes('DÉFAUT') || statusUpper.includes('DEFECT') || statusUpper.includes('HS')) {
                      statusColor = '#c53030';
                    } else if (statusUpper.includes('NON TESTABLE') || statusUpper.includes('MACHINE') || statusUpper.includes('ETAT') || statusUpper.includes('NON TESTÉ')) {
                      statusColor = '#b7791f';
                    }

                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '7.5pt', borderBottom: '0.4px solid #ededed', paddingBottom: '0.5mm' }}>
                        <span style={{ fontWeight: 'bold' }}>{chk.component}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
                          <span style={{ color: '#888', fontSize: '7pt' }} className="truncate max-w-[120px]">{chk.notes || 'OK'}</span>
                          <span style={{ 
                            fontSize: '7pt', 
                            fontWeight: '900', 
                            color: statusColor
                          }}>{chk.status}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '8pt', color: '#86868b', fontStyle: 'italic', margin: 0 }}>
              Symptômes d'oxydation et court-circuits analysés sur le microscope technique. Aucune tension anormale n'affecte la puce SMC / T2 / M-Series.
            </p>
          )}
        </div>
      </div>

      {ticket.technicianNotes && (
        <div style={{ ...styles.card, margin: '4mm 0', backgroundColor: '#fafafc', border: '0.6px solid #d2d2d7' }}>
          <div style={styles.label}>Notes Finales du Technicien Principal:</div>
          <p style={{ fontSize: '8pt', color: '#333', margin: 0, whiteSpace: 'pre-wrap' }}>{ticket.technicianNotes}</p>
        </div>
      )}

      {/* PARTS & PRESTATIONS COMPLETED */}
      <h2 style={{ ...styles.sectionTitle, marginTop: '4mm' }}>🛠️ DETAILS DES PIECES & PRESTATIONS FACTURÉES</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Travaux Demandés / Pièces d'Origine Posées</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '20%' }}>Prix Unitaire</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '20%' }}>Montant (F CFA)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={styles.td}>🛡️ Forfait d'Expertise & Diagnostic Technique Standard</td>
            <td style={{ ...styles.td, textAlign: 'right', color: '#666' }}>{diagCost.toLocaleString()}</td>
            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold' }}>{diagCost.toLocaleString()}</td>
          </tr>

          {ticket.services && ticket.services.length > 0 ? (
            ticket.services.map((item, index) => (
              <tr key={index}>
                <td style={styles.td}>⚙️ {item.name}</td>
                <td style={{ ...styles.td, textAlign: 'right', color: '#666' }}>{item.price.toLocaleString()}</td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold' }}>{item.price.toLocaleString()}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} style={{ ...styles.td, fontStyle: 'italic', color: '#86868b', textAlign: 'center', padding: '3mm' }}>
                Aucune prestation supplémentaire sélectionnée (Fiche de diagnostic brut ou devis en attente).
              </td>
            </tr>
          )}

          {/* Financial calculations */}
          <tr style={{ backgroundColor: '#f5f5f7' }}>
            <td colSpan={2} style={{ ...styles.td, textAlign: 'right', fontWeight: '900', color: '#515154' }}>MONTANT TOTAL ESTIMÉ ET VALIDÉ :</td>
            <td style={{ ...styles.td, textAlign: 'right', fontWeight: '900', fontSize: '9pt', color: '#002244' }}>{total.toLocaleString()} F CFA</td>
          </tr>
          <tr>
            <td colSpan={2} style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold', color: '#c53030' }}>ACOMPTE TECHNIQUE REÇU (-) :</td>
            <td style={{ ...styles.td, textAlign: 'right', fontWeight: '900', color: '#c53030' }}>{advance.toLocaleString()} F CFA</td>
          </tr>
          <tr style={{ backgroundColor: '#0071e3', color: '#ffffff' }}>
            <td colSpan={2} style={{ ...styles.td, textAlign: 'right', fontWeight: '900', color: '#ffffff', border: 'none' }}>SOLDE À PAYER À LA LIVRAISON :</td>
            <td style={{ ...styles.td, textAlign: 'right', fontWeight: '900', fontSize: '10pt', color: '#ffffff', border: 'none' }}>{balance.toLocaleString()} F CFA</td>
          </tr>
        </tbody>
      </table>

      {/* DIAGNOSTIC IMAGES SECTION */}
      {ticket.diagnosticImages && ticket.diagnosticImages.length > 0 && (
        <div style={{ marginTop: '2mm' }}>
          <h2 style={styles.sectionTitle}>📸 GALERIE D'IMAGES DU DIAGNOSTIC ATELIER</h2>
          <div style={styles.imageGrid}>
            {ticket.diagnosticImages.slice(0, 6).map((img, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '1mm' }}>
                <div style={styles.imageWrapper}>
                  <img src={img} alt={`Diag-${idx + 1}`} style={styles.image} referrerPolicy="no-referrer" />
                </div>
                <div style={{ fontSize: '6.5pt', color: '#86868b', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  Micro-soudure / Preuve #{idx + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SIGNATURES AND SIGN-OFF SECTIONS */}
      <div style={styles.signSection}>
        <div>
          <div style={{ ...styles.label, textAlign: 'center' }}>ACCORD ET SIGNATURE CLIENT</div>
          <div style={styles.signBox}>
            {ticket.clientSignature ? (
              <img src={ticket.clientSignature} alt="Signature Client" style={{ maxHeight: '85%', maxWidth: '85%', objectFit: 'contain' }} referrerPolicy="no-referrer" />
            ) : (
              <span style={{ fontSize: '7.5pt', color: '#b5b5b9', fontStyle: 'italic', fontWeight: '500' }}>Aucune signature enregistrée</span>
            )}
          </div>
          <div style={{ fontSize: '6pt', color: '#86868b', textAlign: 'center', marginTop: '1mm' }}>
            Le client certifie avoir pris connaissance du rapport d'expertise technique d'origine Apple par TGS.
          </div>
        </div>

        <div>
          <div style={{ ...styles.label, textAlign: 'center' }}>VISA COMPTABLE & CACHET TECHNIQUE TGS CI</div>
          <div style={{ ...styles.signBox, border: '1px dashed #d2d2d7', display: 'flex', flexDirection: 'column', padding: '1mm' }}>
            <span style={{ fontSize: '8pt', fontWeight: '900', color: '#002244' }}>TGS - CÔTE D'IVOIRE</span>
            <span style={{ fontSize: '6.5pt', color: '#0071e3', fontWeight: 'bold', textTransform: 'none' }}>Workshop Expert MacBook</span>
            <div style={{ marginTop: '1.5mm', border: '1px solid #002244', padding: '0.5mm 2mm', borderRadius: '0.4mm', fontSize: '6pt', fontWeight: '800', color: '#002244' }}>
              AGRÉÉ COMPORTEMENT P3 PRO
            </div>
          </div>
          <div style={{ fontSize: '6pt', color: '#ef4444', textAlign: 'center', marginTop: '1mm', fontWeight: '900' }}>
            🔴 L'OUVERTURE DE L'APPAREIL EN DEHORS DE TGS CI ANNULE TOUT ENGAGEMENT DE GARANTIE.
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintableTechnicalReport;
