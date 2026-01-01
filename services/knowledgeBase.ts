// services/knowledgeBase.ts

export interface KnowledgeDoc {
  id: string;
  content: string;
  keywords: string[];
}

export const knowledgeBase: KnowledgeDoc[] = [
  {
    id: 'warranty-policy',
    content: "Notre politique de garantie standard est de 3 mois sur la pièce changée et la main-d'œuvre associée. Cette garantie ne couvre pas les dommages accidentels (chute, liquide) survenus après la réparation. Pour les réparations de carte mère, la garantie est de 1 mois. Aucune garantie n'est offerte sur les désoxydations.",
    keywords: ['garantie', 'mois', 'carte mère', 'désoxydation', 'liquide', 'chute'],
  },
  {
    id: 'pricing-diag',
    content: "Le coût du diagnostic est de 5000 F CFA. Ce montant est déduit du coût total de la réparation si le client accepte le devis. Si le devis est refusé, les 5000 F sont conservés pour le temps de diagnostic.",
    keywords: ['prix', 'coût', 'diagnostic', 'devis', 'déduit'],
  },
  {
    id: 'unrepairable-fee',
    content: "Si un appareil est jugé non réparable après un diagnostic approfondi, seuls les frais de diagnostic de 5000 F sont facturés. Il n'y a pas de frais de 'remontage'.",
    keywords: ['non réparable', 'irréparable', 'frais', 'facturé'],
  },
  {
    id: 'data-recovery',
    content: "La récupération de données est un service distinct et n'est pas garantie. Le prix de base pour une récupération simple (sans dessoudage de puce) est de 40000 F CFA. Pour une récupération complexe nécessitant de la micro-soudure, un devis spécifique doit être établi, généralement entre 100000 F et 200000 F.",
    keywords: ['récupération', 'données', 'prix', 'dessoudage', 'micro-soudure'],
  },
  {
    id: 'urgent-repair',
    content: "Les réparations urgentes sont possibles moyennant un supplément de 20% sur le coût total de la main-d'œuvre. Le délai pour une réparation urgente est généralement de 24h, sous réserve de disponibilité des pièces.",
    keywords: ['urgent', 'urgence', 'rapide', 'supplément', 'délai', '24h'],
  },
  {
    id: 'payment-advance',
    content: "Une avance de 50% du montant total du devis est requise avant de commencer toute réparation ou de commander des pièces spécifiques. Le solde est payable à la récupération de l'appareil.",
    keywords: ['avance', 'paiement', 'acompte', 'solde', 'payer'],
  },
];
