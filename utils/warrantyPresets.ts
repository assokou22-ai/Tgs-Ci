import { DocumentNature } from '../types.ts';

export const WARRANTY_PRESETS: Record<DocumentNature, { durations: string[]; conditions: string; label: string }> = {
  macbook: {
    label: 'Vente Ordinateur MacBook',
    durations: ['6 Mois SAV Local', '3 Mois SAV Local', '12 Mois (1 An)', '1 Mois', 'Sans garantie'],
    conditions: `• Garantie SAV TGS-CI pièces et main-d'œuvre sur l'ordinateur et accessoires fournis (chargeur/câble).
• Prise en charge SAV directe en nos locaux à Cocody Faya, Abidjan.
• La garantie ne couvre pas la casse physique (notamment écran), l'oxydation liquide ou toute intervention tierce.
• Tout matériel doit être vérifié à la réception.`
  },
  reparation: {
    label: 'Réparation / Intervention Atelier',
    durations: ['30 Jours', '3 Mois', '1 Mois', 'Sans garantie'],
    conditions: `• Garantie appliquée exclusivement sur la pièce remplacée et la main-d'œuvre technique.
• La garantie est annulée en cas de choc physique, trace de liquide ou intervention tierce.
• Tout matériel réparé doit être testé et vérifié à la réception.`
  },
  pieces: {
    label: 'Pièces détachées MacBook',
    durations: ['30 Jours', '3 Mois', 'Sans garantie'],
    conditions: `• Garantie sur la pièce détachée neuve/OEM fournie à compter de la réception.
• Tout composant doit être inspecté et testé avant montage ou collage définitif.
• Exclusion en cas de détérioration de nappe, fissure ou mauvaise manipulation.`
  },
  autre: {
    label: 'Autre / Précision libre',
    durations: ['30 Jours', 'Sans garantie'],
    conditions: `• Conditions particulières convenues entre les parties.
• Tout matériel ou prestation doit être validé à la réception.`
  }
};
