import React from 'react';
import { RepairTicket } from '../types.ts';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { AppleLogo } from './icons.tsx';
import SecureQrCode from './SecureQrCode.tsx';

interface PrintableEnterpriseBonProps {
  ticket: RepairTicket;
}

const PrintableEnterpriseBon: React.FC<PrintableEnterpriseBonProps> = ({ ticket }) => {
  const { settings } = useAppSettings();
  const shop = settings.workshop || {
    name: "TGS - CÔTE D'IVOIRE (MacBook Expertise)",
    address: 'Cocody Faya, Carrefour Coq Ivoir, Abidjan',
    phone: '+225 07 57 13 35 07',
    email: 'contact@tgs-ci.com',
    currency: 'F CFA'
  };

  const dateDepot = new Date(ticket.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const heureDepot = new Date(ticket.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  
  const cf = ticket.customFields || {};

  const diagCost = ticket.costs?.diagnostic || 0;
  const servicesTotal = ticket.services?.reduce((sum, s) => sum + s.price, 0) || 0;
  const total = diagCost + servicesTotal;
  const advance = ticket.costs?.advance || 0;
  const balance = Math.abs(total - advance);

  const labelStyle: React.CSSProperties = { fontSize: '7pt', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.05em' };
  const valueStyle: React.CSSProperties = { fontSize: '9pt', fontWeight: '900', color: '#000' };

  return (
    <div className="printable-page" style={{ color: '#000', padding: '8mm 10mm', fontSize: '8.5pt', display: 'flex', flexDirection: 'column', gap: '3mm', lineHeight: '1.3' }}>
      
      {/* HEADER SECTION */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.5pt solid #000', paddingBottom: '2mm' }}>
          <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', marginBottom: '1mm' }}>
                <AppleLogo style={{ width: '16pt', height: '16pt', color: '#000' }} />
                <h1 style={{ fontSize: '18pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>{shop.name}</h1>
              </div>
              <p style={{ fontSize: '7pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#000', margin: '0 0 1mm 0' }}>CONTRAT DE DIAGNOSTIC & RÉPARATION MATÉRIEL ENTREPRISE (B2B)</p>
              <div style={{ fontSize: '7pt', color: '#444', lineHeight: '1.2' }}>{shop.address}<br/><strong>{shop.phone}</strong> | {shop.email}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4mm' }}>
              <SecureQrCode ticketId={ticket.id} size={48} />
              <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '8pt', fontWeight: '900', color: '#FFF', background: '#000', padding: '1mm 3mm', marginBottom: '1mm', borderRadius: '0.8mm', display: 'inline-block' }}>
                    BON DE DÉPÔT ENTREPRISE
                  </div>
                  <div style={{ fontSize: '15pt', fontWeight: '900', fontFamily: 'monospace', color: '#0071e3' }}>#{ticket.id}</div>
                  <div style={{ fontSize: '7pt', fontWeight: '900', marginTop: '0.5mm', color: '#000' }}>
                    DÉPÔT LE : {dateDepot} À {heureDepot}
                  </div>
              </div>
          </div>
      </header>

      {/* CUSTOMER & VEHICLE GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '4mm' }}>
          {/* ENTITÉ CLIENT */}
          <section style={{ border: '0.5pt solid #000', padding: '2.5mm', borderRadius: '1.5mm' }}>
              <h2 style={{ fontSize: '7.5pt', fontWeight: '900', borderBottom: '0.5pt solid #000', paddingBottom: '0.5mm', marginBottom: '1.5mm' }}>🏢 COMPTE ENTREPRISE</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5mm' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                      <div style={labelStyle}>Raison Sociale de l'Entreprise</div>
                      <div style={{ ...valueStyle, fontSize: '10pt', color: '#0071e3' }}>{ticket.client.name.toUpperCase()}</div>
                  </div>
                  <div>
                      <div style={labelStyle}>Nom du Déposant</div>
                      <div style={valueStyle}>{cf.deposantName || '................................'}</div>
                  </div>
                  <div>
                      <div style={labelStyle}>Fonction / Poste</div>
                      <div style={valueStyle}>{cf.deposantFunction || '................................'}</div>
                  </div>
                  <div>
                      <div style={labelStyle}>Contact Téléphone</div>
                      <div style={valueStyle}>{ticket.client.phone || '................................'}</div>
                  </div>
                  <div>
                      <div style={labelStyle}>Email Professionnel</div>
                      <div style={{ ...valueStyle, fontSize: '8.5pt' }}>{ticket.client.email || '................................'}</div>
                  </div>
                  <div>
                      <div style={labelStyle}>Registre du Commerce (RCCM)</div>
                      <div style={{ ...valueStyle, fontFamily: 'monospace', fontSize: '8pt' }}>{cf.rccm || 'NON PRÉCISÉ'}</div>
                  </div>
                  <div>
                      <div style={labelStyle}>N° Compte Contribuable (CC)</div>
                      <div style={{ ...valueStyle, fontFamily: 'monospace', fontSize: '8pt' }}>{cf.compteContribuable || 'NON PRÉCISÉ'}</div>
                  </div>
              </div>
          </section>

          {/* APPAREIL & INVENTAIRE */}
          <section style={{ border: '0.5pt solid #000', padding: '2.5mm', borderRadius: '1.5mm' }}>
              <h2 style={{ fontSize: '7.5pt', fontWeight: '900', borderBottom: '0.5pt solid #000', paddingBottom: '0.5mm', marginBottom: '1.5mm' }}>💻 SPÉCIFICATIONS APPAREIL</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5mm' }}>
                  <div>
                      <div style={labelStyle}>Modèle Commercial</div>
                      <div style={valueStyle}>{ticket.macModel || 'APPLE MACBOOK'}</div>
                  </div>
                  <div>
                      <div style={labelStyle}>N° Modèle (AXXXX)</div>
                      <div style={{ ...valueStyle, fontFamily: 'monospace' }}>{ticket.modelNumber || cf.modelA || 'NON SPÉCIFIÉ'}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                      <div style={labelStyle}>Numéro de Série (S/N)</div>
                      <div style={{ ...valueStyle, fontSize: '9pt', fontFamily: 'monospace', color: '#0071e3' }}>{ticket.serialNumber || 'NON SPÉCIFIÉ'}</div>
                  </div>
                  <div>
                      <div style={labelStyle}>Couleur</div>
                      <div style={valueStyle}>{ticket.macColor || 'NON PRÉCISÉ'}</div>
                  </div>
                  <div>
                      <div style={labelStyle}>Réf Bon de Commande / PO</div>
                      <div style={{ ...valueStyle, color: '#6b46c1' }}>{cf.poRef || 'AUCUNE'}</div>
                  </div>

                  {/* INVENTAIRE ACCESSOIRES */}
                  <div style={{ gridColumn: 'span 2', marginTop: '1.5mm', paddingTop: '1.5mm', borderTop: '0.3pt dashed #DDD' }}>
                      <div style={labelStyle}>Accessoires remis au dépôt</div>
                      <div style={{ display: 'flex', gap: '4mm', marginTop: '0.5mm' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5mm', fontSize: '7.5pt', fontWeight: 'bold' }}>
                              <div style={{ width: '9px', height: '9px', border: '1pt solid #000', background: ticket.chargerIncluded ? '#000' : 'transparent' }}></div>
                              <span>Chargeur {ticket.chargerIncluded && cf.chargerWatts ? `(${cf.chargerWatts}W)` : ''}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5mm', fontSize: '7.5pt', fontWeight: 'bold' }}>
                              <div style={{ width: '9px', height: '9px', border: '1pt solid #000', background: cf.hasCable === 'oui' ? '#000' : 'transparent' }}></div>
                              <span>Câble</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5mm', fontSize: '7.5pt', fontWeight: 'bold' }}>
                              <div style={{ width: '9px', height: '9px', border: '1pt solid #000', background: ticket.bagIncluded ? '#000' : 'transparent' }}></div>
                              <span>Housse/Sac</span>
                          </div>
                      </div>
                      {ticket.bagDescription && (
                          <div style={{ fontSize: '7.5pt', fontStyle: 'italic', marginTop: '0.5mm', color: '#444' }}>
                              Autre: {ticket.bagDescription}
                          </div>
                      )}
                  </div>
              </div>
          </section>
      </div>

      {/* PHYSICAL INSPECTION AND ALLUMAGE CHECKLIST */}
      <section style={{ border: '0.5pt solid #000', padding: '2.5mm', borderRadius: '1.5mm' }}>
          <h2 style={{ fontSize: '7.5pt', fontWeight: '900', borderBottom: '0.5pt solid #000', paddingBottom: '0.5mm', marginBottom: '2mm' }}>
              🔍 DIAGNOSTIC INITIAL & ÉTAT PHYSIQUE VISUEL AU DÉPÔT
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2mm', marginBottom: '2.5mm' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: '1.5mm', border: '0.3pt solid #DDD', borderRadius: '1mm', background: ticket.powersOn ? '#FFF' : '#F9F9F9' }}>
                  <span style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#666', textAlign: 'center', marginBottom: '1mm' }}>S'ALLUME</span>
                  <div style={{ width: '10px', height: '10px', border: '1pt solid #000', background: ticket.powersOn ? '#000' : 'transparent' }}></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: '1.5mm', border: '0.3pt solid #DDD', borderRadius: '1mm', background: cf.screenBroken === 'oui' ? '#FFF' : '#F9F9F9' }}>
                  <span style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#666', textAlign: 'center', marginBottom: '1mm' }}>ÉCRAN CASSÉ</span>
                  <div style={{ width: '10px', height: '10px', border: '1pt solid #000', background: cf.screenBroken === 'oui' ? '#000' : 'transparent' }}></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: '1.5mm', border: '0.3pt solid #DDD', borderRadius: '1mm', background: cf.traceChoc === 'oui' ? '#FFF' : '#F9F9F9' }}>
                  <span style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#666', textAlign: 'center', marginBottom: '1mm' }}>CHOCS/BOSSES</span>
                  <div style={{ width: '10px', height: '10px', border: '1pt solid #000', background: cf.traceChoc === 'oui' ? '#000' : 'transparent' }}></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: '1.5mm', border: '0.3pt solid #DDD', borderRadius: '1mm', background: cf.traceLiquid === 'oui' ? '#FFF' : '#F9F9F9' }}>
                  <span style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#666', textAlign: 'center', marginBottom: '1mm' }}>LIQUIDE/OXYD</span>
                  <div style={{ width: '10px', height: '10px', border: '1pt solid #000', background: cf.traceLiquid === 'oui' ? '#000' : 'transparent' }}></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: '1.5mm', border: '0.3pt solid #DDD', borderRadius: '1mm', background: cf.keyboardDamaged === 'oui' ? '#FFF' : '#F9F9F9' }}>
                  <span style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#666', textAlign: 'center', marginBottom: '1mm' }}>CLAVIER/TRACK HS</span>
                  <div style={{ width: '10px', height: '10px', border: '1pt solid #000', background: cf.keyboardDamaged === 'oui' ? '#000' : 'transparent' }}></div>
              </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '4mm', fontSize: '8pt' }}>
              <div>
                  <p style={{ margin: '1mm 0', whiteSpace: 'pre-line' }}><strong>Symptômes signalés par l'IT / le client :</strong> {ticket.problemDescription || 'Aucun symptôme renseigné.'}</p>
                  <p style={{ margin: '1mm 0' }}><strong>Comportement allumage :</strong> {cf.powerOnDetails || 'Non spécifié.'}</p>
                  {cf.constatsParticuliers && <p style={{ margin: '1mm 0' }}><strong>Constats de l'atelier :</strong> {cf.constatsParticuliers}</p>}
                  {cf.missingScrews === 'oui' && (
                    <p style={{ margin: '1mm 0', color: '#c53030' }}>
                      <strong>⚠ Alerte : Vis manquantes sous le châssis de la machine {cf.foundScrewsCount ? `(${cf.foundScrewsCount} trouvée(s))` : '(Nombre non précisé)'}.</strong>
                    </p>
                  )}
              </div>
              <div style={{ borderLeft: '0.5pt dashed #DDD', paddingLeft: '4mm' }}>
                  <p style={{ margin: '1mm 0' }}><strong>Diagnostic initial préconisé :</strong> {cf.diagnostic || 'Analyse approfondie de la carte logique en atelier.'}</p>
                  <p style={{ margin: '1mm 0' }}><strong>Raison Retour SAV :</strong> {ticket.isReIntervention ? 'Oui (Pris en charge sous garantie de réparation)' : 'Non'}</p>
              </div>
          </div>
      </section>

      {/* PRESTATIONS FACTURÉES ET CHIFFREMENT */}
      <section style={{ border: '0.5pt solid #000', padding: '2.5mm', borderRadius: '1.5mm' }}>
          <h2 style={{ fontSize: '7.5pt', fontWeight: '900', borderBottom: '0.5pt solid #000', paddingBottom: '0.5mm', marginBottom: '1.5mm' }}>
              💰 ESTIMATION FINANCIÈRE DES TRAVAUX (B2B)
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', textAlign: 'left' }}>
              <thead>
                  <tr style={{ borderBottom: '1pt solid #000', fontSize: '7pt', fontWeight: 'bold', color: '#555' }}>
                      <th style={{ padding: '1mm 0' }}>DESCRIPTION DES PRESTATIONS / COMPOSANTS ORIGINES</th>
                      <th style={{ width: '25%', textAlign: 'right', padding: '1mm 0' }}>MONTANT ({shop.currency || 'F CFA'})</th>
                  </tr>
              </thead>
              <tbody>
                  <tr style={{ borderBottom: '0.3pt dashed #EEE' }}>
                      <td style={{ padding: '1mm 0' }}>Forfait Diagnostic & Recherche de Pannes Micro-électronique (Carte Logique)</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '1mm 0' }}>{diagCost.toLocaleString()}</td>
                  </tr>
                  {ticket.services && ticket.services.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '0.3pt dashed #EEE' }}>
                          <td style={{ padding: '1mm 0' }}>{s.name}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '1mm 0' }}>{s.price.toLocaleString()}</td>
                      </tr>
                  ))}
                  <tr style={{ fontWeight: '900', borderTop: '1pt solid #000' }}>
                      <td style={{ padding: '1.5mm 0', textTransform: 'uppercase' }}>Montant Total Estimé & Validé</td>
                      <td style={{ textAlign: 'right', padding: '1.5mm 0', fontSize: '10pt', color: '#0071e3' }}>{total.toLocaleString()} F</td>
                  </tr>
                  {advance > 0 && (
                      <tr style={{ fontSize: '8pt', color: '#666' }}>
                          <td style={{ padding: '1mm 0' }}>Acompte technique reçu (-)</td>
                          <td style={{ textAlign: 'right', padding: '1mm 0' }}>-{advance.toLocaleString()}</td>
                      </tr>
                  )}
                  <tr style={{ fontWeight: '900', background: '#F4F4F4', borderTop: '1pt solid #000' }}>
                      <td style={{ padding: '2mm', textTransform: 'uppercase' }}>Reste à Payer à la Livraison</td>
                      <td style={{ textAlign: 'right', padding: '2mm', fontSize: '10pt', color: '#000' }}>{balance.toLocaleString()} F</td>
                  </tr>
              </tbody>
          </table>
      </section>

      {/* DISPOSITIONS LÉGALES ET CONTRACTUELLES B2B */}
      <section style={{ border: '0.5pt solid #DDD', padding: '2.5mm', borderRadius: '1.5mm', background: '#FAF9F6' }}>
          <h2 style={{ fontSize: '7.5pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '1.5mm', borderBottom: '0.5pt solid #000', paddingBottom: '0.5mm' }}>
              📄 CLAUSES CONTRACTUELLES ET LIMITATION DE RESPONSABILITÉ B2B (TGS-CI)
          </h2>
          <div style={{ fontSize: '6.5pt', fontWeight: 'bold', color: '#333', lineHeight: '1.3', textAlign: 'justify', display: 'flex', flexDirection: 'column', gap: '1mm' }}>
              <p>
                  <strong>1. POUVOIR D'ENGAGEMENT :</strong> Le déposant certifie sur l'honneur être dûment mandaté et habilité par sa hiérarchie pour engager juridiquement l'entreprise cliente, signer le présent bon de dépôt et approuver les devis ou diagnostics subséquents.
              </p>
              <p>
                  <strong>2. PERTE DÉFINITIVE DE GARANTIE APPLE :</strong> Le client reconnaît et accepte expressément que toute réparation micro-électronique (brasage, microsoudure sur puces Mx, T2) effectuée par nos ingénieurs hors circuit officiel Apple annule définitivement la garantie constructeur de l'appareil.
              </p>
              <p>
                  <strong>3. LIMITATION DE RESPONSABILITÉ :</strong> TGS-CI s'engage à une obligation de moyens. En raison de la complexité extrême des cartes mères MacBook, TGS-CI décline toute responsabilité pour les pannes invisibles (puces en court-circuit interne, micros-fissures multicouches) se déclarant suite à l'ouverture ou au démontage de la carte logique.
              </p>
              <p>
                  <strong>4. EXCLUSION DE RESPONSABILITÉ SUR LES DONNÉES (SSD SOUDÉS) :</strong> La sauvegarde des fichiers incombe entièrement à l'entreprise cliente. Les puces de stockage SSD étant directement soudées sur la carte mère des MacBook récents, l'atelier ne garantit pas l'intégrité des données en cas de panne critique du CPU/SSD.
              </p>
              <p>
                  <strong>5. MATÉRIELS ABANDONNÉS :</strong> À défaut de retrait de la machine dans un délai de quatre-vingt-dix (90) jours calendaires suivant la notification de mise à disposition, le matériel est réputé abandonné et TGS-CI pourra le recycler pour couvrir ses frais de diagnostic ou stockage.
              </p>
          </div>
          <div style={{ marginTop: '1.5mm', fontSize: '7.5pt', fontWeight: '900', color: '#c53030', textAlign: 'center', borderTop: '0.3pt dashed #DDD', paddingTop: '1mm' }}>
              ⚠ TOUTE OUVERTURE TECHNIQUE DE LA MACHINE MET FIN À LA GARANTIE CONSTRUCTEUR COCORICO D'ORIGINE ⚠
          </div>
      </section>

      {/* SIGNATURE BOXES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6mm', marginTop: '1mm' }}>
          <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '7.5pt', fontWeight: '900', marginBottom: '1mm' }}>✍️ LE CLIENT (CACHET ET SIGNATURE DE L'ENTREPRISE)</p>
              <p style={{ fontSize: '6.5pt', fontStyle: 'italic', marginBottom: '1.5mm', color: '#555' }}>Mention obligatoire : "{cf.luEtApprouve || '........................'}"</p>
              <div style={{ border: '0.5pt solid #000', height: '18mm', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '1mm', background: '#FFF' }}>
                  {ticket.clientSignature ? (
                      <img src={ticket.clientSignature} style={{ maxHeight: '90%' }} alt="Signature Client" />
                  ) : (
                      <span style={{ fontSize: '6pt', color: '#AAA' }}>SIGNATURE MANUSCRITE REQUIS AU DÉPÔT</span>
                  )}
              </div>
          </div>
          <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '7.5pt', fontWeight: '900', marginBottom: '1.5mm' }}>✍️ POUR TGS-CI (VISA TECHNIQUE ET CACHET DE L'ATELIER)</p>
              <div style={{ border: '0.5pt dashed #999', height: '18mm', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '1mm', background: '#FAFAFA' }}>
                  <div style={{ textAlign: 'center' }}>
                      <span style={{ color: '#DDD', fontWeight: '900', fontSize: '11pt', letterSpacing: '0.1em' }}>TGS - CI</span>
                      <p style={{ fontSize: '5.5pt', color: '#999', margin: 0, textTransform: 'uppercase' }}>Workshop Expert MacBook</p>
                  </div>
              </div>
          </div>
      </div>

    </div>
  );
};

export default PrintableEnterpriseBon;
