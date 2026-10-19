import { RepairTicket } from '../types.ts';
import { addDaysExcludingSundaysAndHolidays } from '../utils/dateCalculator.ts';
import { formatWhatsAppPhone, generateWhatsAppUrl } from '../utils/formatters.ts';

export type WorkshopTemplateId = 
  | 'two_options_t2_nand'       // Modèle 1 : Blocage Apple/T2/NAND avec 2 options (poursuite vs CM 72h)
  | 'nand_voltages_dataloss'     // Modèle 2 : Point d'étape tensions OK, NAND HS + perte données
  | 'apple_session_password'     // Modèle 3 : Mot de passe session requis pour activation Apple & tests
  | 'standard_delay_extension'   // Modèle 4 : Rallonge classique banc de test microscope
  | 'ready_balance'              // Modèle 5 : Appareil prêt avec solde
  | 'quote_approval'             // Modèle 6 : Devis & accord technique
  | 'unrepairable_return';       // Modèle 7 : Non réparable & restitution

export interface WorkshopTemplateMeta {
  id: WorkshopTemplateId;
  title: string;
  category: 'blocage' | 'avancement' | 'urgent' | 'cloture';
  badge: string;
  description: string;
  recommendedFor: string;
}

export const WORKSHOP_TEMPLATES_META: WorkshopTemplateMeta[] = [
  {
    id: 'two_options_t2_nand',
    title: 'Dilemme 2 Options (Poursuite vs Carte Mère 72h)',
    category: 'blocage',
    badge: '2 Options Claires',
    description: 'Échec serveur Apple / Puce T2 / NAND. Propose au client soit d\'attendre la reprise approfondie, soit de remplacer la carte mère sous 72h.',
    recommendedFor: 'Blocages complexes, restaurations en échec, puces T2'
  },
  {
    id: 'nand_voltages_dataloss',
    title: 'Point Tensions Rétablies & Puces NAND (Perte données)',
    category: 'avancement',
    badge: 'Tensions & NAND',
    description: 'Tensions 12.6V PPBUS et 3.3V/5V rétablies mais stockage NAND endommagé. Informe du délai d\'approvisionnement et de la perte des données.',
    recommendedFor: 'Tensions OK, stockage illisible, remplacement NAND'
  },
  {
    id: 'apple_session_password',
    title: 'Demande Mot de Passe Session (Activation Apple & Tests)',
    category: 'urgent',
    badge: 'Action Client Requise',
    description: 'MacBook démarre après remplacement NAND/PMU/ROM. Apple exige le mot de passe de session pour l\'activation et les tests ligne par ligne.',
    recommendedFor: 'Mac redémarré bloqué sur écran d\'activation Apple'
  },
  {
    id: 'standard_delay_extension',
    title: 'Rallonge Délais Atelier (Banc de test microscope)',
    category: 'blocage',
    badge: 'Rallonge Délais',
    description: 'Remplacement des premiers composants effectué, mesures complémentaires sur les étages secondaires sous microscope.',
    recommendedFor: 'Diagnostic prolongé, recherche de court-circuit secondaire'
  },
  {
    id: 'ready_balance',
    title: 'Appareil Prêt & Solde à Régler',
    category: 'cloture',
    badge: 'Retrait Disponible',
    description: 'Travaux terminés avec succès, tests de stabilité validés, solde financier calculé et horaires de retrait.',
    recommendedFor: 'MacBook entièrement réparé et testé'
  },
  {
    id: 'quote_approval',
    title: 'Devis Technique & Demande d\'Accord',
    category: 'avancement',
    badge: 'Devis Chiffré',
    description: 'Bilan de l\'expertise et montant total des travaux pour accord préalable avant lancement.',
    recommendedFor: 'Fin du diagnostic initial'
  },
  {
    id: 'unrepairable_return',
    title: 'Rapport d\'Impossibilité Technique & Restitution',
    category: 'cloture',
    badge: 'Non Réparable',
    description: 'Constat d\'irréparabilité après expertise poussée, motifs clairs et modalités de restitution de la machine.',
    recommendedFor: 'Carte mère irréparable, perforation, CPU/GPU fissuré'
  }
];

export interface TemplateVariables {
  clientName?: string;
  civility?: 'Monsieur' | 'Madame' | '';
  macModel?: string;
  aNumber?: string;
  ticketId?: string;
  daysExtension?: number;
  resumeDateFormatted?: string;
  // Options Carte Mère partenaire
  partnerMotherboardSpec?: string;
  partnerMotherboardPrice?: string;
  // Tensions
  ppbusVoltage?: string;
  s5s4Voltage?: string;
  // Mot de passe & composants
  replacedChips?: string[];
  plannedDeliveryDay?: string;
  totalCost?: number;
  advancePaid?: number;
  balanceDue?: number;
}

/**
 * Détecte la civilité à partir du nom ou des indications
 */
export const detectCivility = (clientName?: string): 'Monsieur' | 'Madame' => {
  if (!clientName) return 'Monsieur';
  const lower = clientName.toLowerCase();
  if (lower.startsWith('mme') || lower.startsWith('madame') || lower.includes('épouse') || lower.includes('mme.')) {
    return 'Madame';
  }
  return 'Monsieur';
};

/**
 * Formate une date en français lisible (ex: "lundi 12 octobre 2026")
 */
export const formatFrenchReadableDate = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

/**
 * Générateur principal des modèles de message d'atelier TGS CI
 */
export const generateWorkshopMessage = (
  templateId: WorkshopTemplateId,
  ticket: RepairTicket,
  customVars?: Partial<TemplateVariables>
): string => {
  const rawClientName = ticket.client?.name || ticket.clientName || 'Cher client';
  const detectedCivility = customVars?.civility || detectCivility(rawClientName);
  
  // Nettoyer le nom pour le salut initial
  let cleanGreetingName = detectedCivility;
  if (!detectedCivility) cleanGreetingName = rawClientName;

  const model = ticket.macModel || 'MacBook Pro';
  const id = ticket.id || 'N/A';
  
  // Extraction éventuelle du numéro AXXXX
  const aMatch = model.match(/\b(A\d{4})\b/i);
  const aNumber = customVars?.aNumber || (aMatch ? aMatch[1].toUpperCase() : '');

  // Calcul d'une date de reprise ou de livraison (par défaut 3 jours ouvrés)
  const days = customVars?.daysExtension || ticket.technicalBlockageReport?.requestedDays || 3;
  const targetDateObj = addDaysExcludingSundaysAndHolidays(new Date(), days);
  const readableTargetDate = customVars?.resumeDateFormatted || formatFrenchReadableDate(targetDateObj);

  // Finances
  const total = customVars?.totalCost ?? ((ticket.costs?.diagnostic || 0) + (ticket.costs?.repair || 0));
  const advance = customVars?.advancePaid ?? (ticket.costs?.advance || 0);
  const balance = customVars?.balanceDue ?? Math.max(0, total - advance);

  switch (templateId) {
    // -------------------------------------------------------------
    // MODÈLE 1 : BLOCAGE SERVEUR APPLE / T2 / NAND & 2 OPTIONS
    // -------------------------------------------------------------
    case 'two_options_t2_nand': {
      const mbSpec = customVars?.partnerMotherboardSpec || 'Core i7, 16 Go de RAM, SSD 512 Go';
      const mbPrice = customVars?.partnerMotherboardPrice || '200 000 F CFA';

      return `Bonjour ${cleanGreetingName},

Comme promis hier, voici le point sur votre ${model}, dossier N° ${id}.

Nous avons encore consacré toute la journée d'hier à votre machine et avons relancé la procédure avec le serveur d'Apple à de nombreuses reprises. Malheureusement, notre requête échoue toujours.

Au départ, nous pensions à une indisponibilité passagère de la connexion avec le serveur de Apple. Mais comme l'échec se répète, nous pensons maintenant que la cause est plus profonde dans la communication entre la puce de sécurité T2 et les nouvelles NAND. Trouver cette cause demande un diagnostic plus poussé, que nous ne pouvons pas faire à la hâte.

Nous savons que votre MacBook est un outil de travail essentiel pour vous et que ce retard vous pénalise. Nous en sommes sincèrement désolés, car nous espérions vous le rendre dès hier.

Pour que vous puissiez choisir ce qui convient le mieux à votre situation, nous vous proposons deux options :

1 - Poursuivre la réparation de votre carte mère actuelle
Nous reprendrons les travaux à partir du ${readableTargetDate}. Ce délai nous permet de terminer les travaux déjà reportés, puis de consacrer à votre carte mère toute l'attention que ce diagnostic demande.
Cette option peut vous convenir si le délai n'est pas un problème pour vous. Le résultat n'est cependant pas garanti mais rien n'est impossible en électronique, le tout n'est qu'une question de temps à nos yeux.

2 - Remplacer la carte mère sous 72 heures
Un partenaire de confiance dispose d'une carte mère compatible : ${mbSpec}.
Tarif : ${mbPrice}, avec l'achat, le montage et les tests compris.
C'est la solution la plus rapide et la plus sûre pour retrouver un ordinateur fonctionnel et reprendre votre travail au plus vite.

Dès que vous aurez fait votre choix, nous organiserons les prochaines étapes.
Passez une excellente journée ${cleanGreetingName}`;
    }

    // -------------------------------------------------------------
    // MODÈLE 2 : POINT TENSIONS & BLOCAGE NAND & PERTE DE DONNÉES
    // -------------------------------------------------------------
    case 'nand_voltages_dataloss': {
      const ppbus = customVars?.ppbusVoltage || '12,6 V (PPBUS)';
      const s5s4 = customVars?.s5s4Voltage || '3,3 V (S5 / S4) et 5 V (S5 / S4)';
      const modelDetail = aNumber ? `${model} (${aNumber})` : model;

      return `Bonjour ${cleanGreetingName},
Comment allez-vous ?

Voici le point sur l'intervention en cours sur votre MacBook. Fiche N° ${id} — ${modelDetail}

*Travaux effectués
Nous avons rétabli les tensions de démarrage de la carte mère. La séquence d'allumage va maintenant jusqu'à l'initialisation du stockage (NAND).

*État actuel
La carte mère démarre et termine sa séquence d'allumage. Les tensions qui manquaient sont maintenant bien fournies : ${ppbus}, ${s5s4}.

Le démarrage se bloque ensuite au moment de la lecture des puces NAND (la mémoire de stockage).
Ces puces ne peuvent pas être lues ni chargées par le système.

*Cause identifiée
Une des puces NAND a subi un dommage latent, ce qui empêche la lecture du stockage.

*Solution proposée
La réparation est possible. Il faut remplacer les puces NAND, puis réinstaller le système. Nous n'avons pas de NAND compatibles avec votre modèle en stock pour le moment, donc il faut compter un délai supplémentaire jusqu'au ${readableTargetDate}, le temps de les trouver et de les installer.

****Important : ce remplacement entraîne la perte totale des données de la machine. Les données actuelles ne pourront pas être récupérées.

Une fois le démarrage et l'affichage validés, nous ferons les tests finaux et vérifierons que la machine fonctionne de façon stable. Nous vous recontacterons ensuite pour la récupération.
Passez une excellente journée`;
    }

    // -------------------------------------------------------------
    // MODÈLE 3 : DEMANDE MOT DE PASSE SESSION APPLE & TESTS LIGNE PAR LIGNE
    // -------------------------------------------------------------
    case 'apple_session_password': {
      const modelDetail = aNumber ? `${model} (${aNumber})` : model;
      const chips = customVars?.replacedChips && customVars.replacedChips.length > 0 
        ? customVars.replacedChips 
        : ['Remplacement des NAND de stockage', 'Remplacement de la PMU', 'Remplacement des SoC ROM'];
      const chipsList = chips.map(c => `• ${c}`).join('\n');
      const deliveryDay = customVars?.plannedDeliveryDay || `${readableTargetDate} à partir de 10 h`;

      return `Bonjour ${cleanGreetingName},
Comment allez-vous ?

Update du rapport d'intervention — Fiche N° ${id}

Suite au premier démarrage de votre MacBook (${modelDetail}), nous avons détecté un défaut de lecture des NAND et de communication avec la mémoire unifiée.

**Interventions réalisées :
${chipsList}

**État actuel :
Le MacBook démarre. Il doit maintenant être restauré complètement pour être activé par les serveurs Apple dans le processus en cours.

** Important — Mot de passe requis :
Apple exigera obligatoirement l'ancien mot de passe de session (bureau) pour valider l'activation de votre MacBook auprès de ses serveurs.
Sans ce mot de passe :
• La restauration ne pourra pas aboutir
• Nous ne pourrons pas effectuer les tests de confirmation de fin de travaux sur votre MacBook
Ces tests seront réalisés ligne par ligne sur votre machine (affichage, clavier, trackpad, ports USB-C, Wi-Fi, Bluetooth, caméra, son, batterie, charge, NAND, etc.) afin de vous remettre un MacBook dont chaque fonction a été validée et dont l'effectivité du fonctionnement et la stabilité sont confirmées.

**Concernant vos données :
Le remplacement des NAND entraîne malheureusement l'effacement complet des données. Toutes les anciennes puces retirées de votre carte vous seront remises lors de la restitution de votre MacBook.

**Cause du défaut :
Défaut documenté sur l'architecture électronique : les puces programmables, même n'ayant reçu aucun dommage physique ou corrosion, perdent leur activité après une inactivité prolongée en état OFF.

**Retrait prévu :
${deliveryDay}, selon votre disponibilité.

Pouvez-vous, s'il vous plaît, nous communiquer l'ancien mot de passe de session de votre ancien bureau, afin que nous puissions finaliser dès que possible l'activation et les tests ?

Passez une excellente journée, ${cleanGreetingName}.`;
    }

    // -------------------------------------------------------------
    // MODÈLE 4 : RALLONGE TECHNIQUE STANDARD D'ATELIER
    // -------------------------------------------------------------
    case 'standard_delay_extension': {
      const comps = ticket.technicalBlockageReport?.replacedComponents?.slice(0, 2).join(' et ') || "les micro-composants d'alimentation";
      const sym = ticket.technicalBlockageReport?.symptoms?.[0]?.toLowerCase() || "des instabilités résiduelles de circuit";

      return `Bonjour ${cleanGreetingName},

Dans le cadre du suivi des réparations sur votre ${model} (Dossier N°${id}), nos techniciens ont procédé au remplacement des premiers composants identifiés (${comps}).

Cependant, lors des bancs de tests de stabilité sous microscope, nous constatons encore ${sym}. Afin de vous garantir un fonctionnement parfaitement fiable et sécurisé dans le temps, notre atelier approfondit les mesures électroniques sur les étages secondaires de la carte logique.

Nous sollicitons une rallonge de délai de ${days} jour${days > 1 ? 's ouvrés' : ' ouvré'}. Votre prochaine date de mise à disposition estimée est reprogrammée au ${readableTargetDate} à 10 h 00.

Nous restons à votre entière disposition pour tout complément d'information. Merci de votre confiance et de votre compréhension.
Passez une excellente journée ${cleanGreetingName}.`;
    }

    // -------------------------------------------------------------
    // MODÈLE 5 : APPAREIL PRÊT & RETRAIT ATELIER
    // -------------------------------------------------------------
    case 'ready_balance': {
      return `*TGS CI - RÉPARER MON MACBOOK*
📌 *FICHE N°${id}*
👤 *CLIENT :* ${rawClientName}

✅ *BONNE NOUVELLE : VOTRE APPAREIL EST PRÊT !*

Bonjour ${cleanGreetingName},
Votre *${model}* est entièrement réparé, testé avec succès et disponible dans nos ateliers.

💰 *Total des travaux :* ${total.toLocaleString('fr-FR')} F CFA
💳 *Acompte versé :* ${advance.toLocaleString('fr-FR')} F CFA
💵 *SOLDE À RÉGLER AU RETRAIT :* ${balance.toLocaleString('fr-FR')} F CFA

📍 *Atelier TGS CI :* Cocody Faya, Abidjan
📞 *Contact :* +225 07 57 13 35 07
⏰ *Horaires :* Lundi au Vendredi (08h30 - 18h30), Samedi (09h00 - 16h00)

Vous pouvez vous présenter à l'atelier avec votre fiche de dépôt pour le retrait de votre appareil.
Merci de votre confiance et passez une excellente journée !`;
    }

    // -------------------------------------------------------------
    // MODÈLE 6 : DEVIS TECHNIQUE & ACCORD
    // -------------------------------------------------------------
    case 'quote_approval': {
      const diagNote = ticket.diagnosticReport || ticket.problemDescription || 'Intervention électronique sur carte mère';
      return `*TGS CI - RÉPARER MON MACBOOK*
📌 *FICHE N°${id}*
👤 *CLIENT :* ${rawClientName}

🛠 *DEVIS TECHNIQUE D'INTERVENTION*

Bonjour ${cleanGreetingName},
L'expertise technique complète de votre *${model}* a été finalisée sur notre banc d'essai.

🔍 *Constat d'atelier :* ${diagNote}
💰 *Montant total des travaux :* ${total.toLocaleString('fr-FR')} F CFA
${advance > 0 ? `💳 *Acompte déjà enregistré :* ${advance.toLocaleString('fr-FR')} F CFA\n💵 *Solde prévisionnel :* ${balance.toLocaleString('fr-FR')} F CFA\n` : ''}
⏱ *Délai d'intervention estimé :* ${days} jours ouvrés à validation.

Merci de nous confirmer votre accord en répondant directement à ce message afin de démarrer l'intervention.
Passez une excellente journée !`;
    }

    // -------------------------------------------------------------
    // MODÈLE 7 : NON RÉPARABLE & RESTITUTION
    // -------------------------------------------------------------
    case 'unrepairable_return': {
      const reason = ticket.technicianNotes || ticket.technicalBlockageReport?.technicalDetails || 'Dommages irréversibles constatés sur le circuit imprimé multi-couches ou le processeur principal';
      return `*TGS CI - RÉPARER MON MACBOOK*
📌 *FICHE N°${id}*
👤 *CLIENT :* ${rawClientName}

⚠️ *RAPPORT D'EXPERTISE TECHNIQUE*

Bonjour ${cleanGreetingName},
Après des tests approfondis et de multiples tentatives sur votre *${model}*, nous avons le regret de vous informer que la machine ne peut être remise en état de fonctionnement fiable.

*Motif technique :*
${reason}.

Nos techniciens ont réassemblé votre appareil avec soin. Vous pouvez vous présenter à notre atelier de Cocody Faya avec votre fiche N°${id} pour récupérer votre machine.

Nous restons à votre écoute et vous souhaitons une excellente journée.`;
    }

    default:
      return '';
  }
};

/**
 * Génère le lien WhatsApp complet pour un message donné
 */
export const createWorkshopWhatsAppUrl = (ticket: RepairTicket, messageText: string): string => {
  const rawPhone = ticket.client?.phone || ticket.clientPhone || '';
  const cleanPhone = formatWhatsAppPhone(rawPhone);
  return generateWhatsAppUrl(cleanPhone, messageText);
};
