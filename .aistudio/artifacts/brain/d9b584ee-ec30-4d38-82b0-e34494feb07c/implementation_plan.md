# Plan d'implémentation — Multi-Appareils, Traçabilité Réception Yango, Règlements Électroniques & Galerie Avant/Après

Plan de conception et d'architecture pour l'enrichissement fonctionnel de TGS-CI Repair Pro : sélecteur ergonomique de support (PC, iPad/Tablette, Téléphone), traçabilité fine du mode d'arrivée (Dépôt direct vs Livraison Yango avec captures WhatsApp et livreur), module de règlements électroniques (Wave, Orange Money, etc.) avec justificatifs PDF/images et calcul du reste à payer, et galerie comparative haute fidélité avant/après réparation.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Les trois choix stratégiques ont été confirmés lors de la phase de cadrage :
> 1. **Profil d'appareil** : Choix au premier lancement via un dialogue d'accueil avec mémorisation (`localStorage`), complété par un bouton d'ajustement instantané dans la barre d'outils supérieure.
> 2. **Comparaison Photos** : Vue scindée côte à côte (split-screen) avec agrandissement plein écran haute définition et bascule avant/après.
> 3. **Livraison Yango** : Support complet des multi-captures (formulaire WhatsApp, photo du livreur ou coordonnées précises, bon de livraison).

- **Confirmation 1 (Profil d'appareil)** : Adaptabilité fluide en 3 modes : Desktop (vue expert 1440px), iPad/Tablette (touch-friendly avec zones cibles ≥ 44px), Mobile/Smartphone (vue simplifiée, saisie guidée, accès immédiat à la caméra).
- **Confirmation 2 (Paiements)** : Conservation des preuves électroniques (JPG, PNG, PDF) sans dépendance API externe requise, avec calcul dynamique du solde restant dû.
- **Confirmation 3 (Photos & Restitution)** : Distinction claire « Réception » et « Restitution », avec qualification du statut réparé (Oui / Non / Préciser) et traçabilité expédition Yango.

---

### 1. Overview & Core Concept

- **What It Does** : 
  1. Permet de choisir à l'ouverture de l'application le type de support utilisé (**Ordinateur**, **iPad / Tablette**, **Smartphone Android / iPhone**) pour adapter instantanément la disposition, la taille des cibles tactiles et la complexité des formulaires.
  2. Enregistre avec exactitude le **mode d'arrivée de la machine** à l'atelier : Dépôt direct au comptoir ou acheminement par livreur Yango (avec captures WhatsApp du client, identité/photo du livreur et documents joints).
  3. Gère les **paiements et acomptes électroniques** (Wave, Orange Money, MTN Momo, Moov, Espèces, Virement) avec téléversement et consultation de reçus (PDF/JPG), suivi du solde dû et distinction des règlements partiels.
  4. Offre un module de **photos d'inspection Avant / Après** permettant de figer l'état d'entrée (châssis, écran, clavier, défauts) et l'état de sortie avant restitution client ou expédition Yango, avec comparateur côte à côte.

- **Target Audience / Persona** :
  - **Techniciens d'atelier & Accueil** : Réception rapide sur tablette ou téléphone, prise de photos directes sans friction.
  - **Gestionnaires comptables & Responsables** : Vérification des justificatifs Wave/OM, contrôle des soldes et validation de fin d'intervention sur poste fixe.

- **Key Value** :
  - Zéro litige client grâce à la preuve visuelle irréfutable avant/après et à la traçabilité Yango.
  - Clarté financière totale sur les acomptes encaissés par mobile money.
  - Confort de travail maximal que l'utilisateur soit debout avec un téléphone, assis au banc avec un iPad ou au bureau sur PC.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Sélection du profil d'appareil (Device Profile Picker)** :
   - Au premier chargement, une modale soignée invite à choisir son poste de travail :
     - *Ordinateur (PC / Mac)* : Mode dense, double colonne, raccourcis et visualisation globale.
     - *iPad / Tablette* : Mode tactile élargi, cartes espacées, boutons de 48px, saisie au doigt facilitée.
     - *Téléphone (iPhone / Android)* : Mode simplifié, sections pliables / accordéon, boutons flottants rapides pour caméra et téléphone.
   - Le choix est sauvegardé localement (`localStorage`). Un sélecteur compact reste accessible dans l'en-tête pour changer de mode en un clic.

2. **Enregistrement de la Réception (Dépôt Atelier vs Yango)** :
   - Dans le formulaire de création/modification de fiche (`RepairForm.tsx` & `EnterpriseRepairForm.tsx`) :
   - Bouton de choix segmenté clair :
     - `[ Dépôt direct à l'atelier ]`
     - `[ Livraison par Yango / Livreur ]`
   - Si Yango est sélectionné, un panneau dédié apparaît avec :
     - Nom et contact du client expéditeur.
     - Identité du livreur : Affilié Yango (avec capture écran de course) ou Indépendant (Nom + Téléphone direct).
     - Zone de dépôt de pièces jointes : Capture d'écran WhatsApp du formulaire, photo du livreur/colis, bon de livraison.
   - Les données restent consultables et modifiables en permanence sur la fiche détaillée (`RepairDetail.tsx`).

3. **Paiements Électroniques & Justificatifs** :
   - Ajout d'une sous-section comptable « Règlements & Justificatifs » :
     - Liste chronologique des paiements enregistrés.
     - Affichage des 3 compteurs financiers : **Total Facturé**, **Total Réglé**, **Solde Restant Dû**.
     - Formulaire d'ajout rapide : Montant, Date, Mode (Wave, Orange Money, Espèces, etc.), Référence de transaction.
     - Zone de justificatif : Dépôt d'image (JPG/PNG) ou document PDF.
     - Si « Espèces » est choisi, le justificatif est facultatif ; pour Wave/OM, un champ invite à joindre le reçu électronique.
     - Clic sur le reçu pour aperçu grand format ou téléchargement immédiat.

4. **Photos Avant & Après Intervention (Comparateur Haute Résolution)** :
   - Section « Galerie d'Intervention » scindée en deux volets :
     - **Volet A : À la réception (Avant)** : État esthétique, rayures, écran, capot, gravures de coque.
     - **Volet B : Avant la restitution (Après)** : Machine remise à neuf, composants réparés, confirmation du statut réparé (*Oui*, *Non*, ou *Préciser*).
   - Mode restitution Yango : Bouton pour ajouter la photo du colis prêt et la preuve d'expédition.
   - Bouton **« Comparer Avant / Après »** ouvrant un modal plein écran affichant les photos côte à côte avec zoom synchronisé pour lever toute contestation.

#### Visual Identity & Theme Tokens

- **Palette de couleurs** :
  - Toile neutre sombre et élégante : Slate-950 (`#020617`) et Zinc-900 (`#18181b`).
  - Accents fonctionnels :
    - Bleu Apple Pro (`#0284c7`) pour la navigation et les statuts techniques.
    - Émeraude (`#10b981`) pour les paiements complets et machines réparées.
    - Ambre (`#f59e0b`) pour les acomptes partiels et livraisons Yango en transit.
    - Indigo / Violet (`#6366f1`) pour les justificatifs électroniques Wave / OM.
- **Ergonomie tactile** :
  - Respect strict des zones cibles : 44px minimum sur tablette, 48px sur mobile.
  - Navigation par onglets ergonomiques en pied d'écran sur mobile pour un accès rapide au pouce.

---

### 3. Key Product Decisions & Trade-Offs

- **Décision 1 : Stockage des Justificatifs et Photos (Base64 compressé & IndexedDB / Firestore)**
  - *Approche choisie* : Compression intelligente côté client (Canvas/WebP pour les photos, préservation des PDF natifs) et stockage dans la collection du ticket avec réplication locale IndexedDB.
  - *Pourquoi* : Permet une utilisation 100% autonome hors-ligne à l'atelier sans saturer la bande passante ni nécessiter un bucket S3 complexe.
  - *Alternative écartée* : Hébergement externe tiers risquant des erreurs CORS ou des liens rompus.

- **Décision 2 : Sélecteur de profil sans altérer les règles métier**
  - *Approche choisie* : Le choix de l'appareil (Desktop, Tablette, Mobile) modifie la disposition de l'interface (taille des inputs, affichage accordéon vs colonnes, boutons tactiles rapides) sans restreindre les fonctionnalités de fond.
  - *Pourquoi* : Un technicien sur iPhone doit pouvoir valider un diagnostic complet aussi fidèlement qu'un collègue sur Mac Pro.

- **Décision 3 : Traçabilité Yango intégrée à la fiche machine**
  - *Approche choisie* : Structuration dédiée dans l'interface de réception avec consultation instantanée en tête de fiche.
  - *Pourquoi* : Les livreurs Yango déposent souvent l'ordinateur sans le client ; les captures WhatsApp constituent la preuve contractuelle essentielle de l'accord initial.

---

### 4. Technical Architecture & Data Strategy

#### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        App.tsx (Root Provider)                         │
│   • DeviceProfileContext (Desktop | Tablet | Mobile)                   │
│   • DeviceProfileModal (Sélection premier lancement / Switcher Header) │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│  Formulaires Réception & Échange    │   │      Consultation & Restitution     │
│  (RepairForm.tsx / EnterpriseForm)  │   │          (RepairDetail.tsx)         │
├─────────────────────────────────────┤   ├─────────────────────────────────────┤
│ 1. ReceptionModeSelector            │   │ 1. ReceptionBadge & YangoProofModal │
│    • Dépôt direct                   │   │    • Consultation captures WhatsApp │
│    • YangoDeliveryCard (captures)   │   │    • Identité et contact livreur    │
│ 2. PaymentManagerSection            │   │ 2. PaymentLedger & ProofViewer      │
│    • Wave / OM / Espèces / Autre    │   │    • Acomptes, soldes, reçus PDF/JPG│
│    • Justificatifs attachés         │   │ 3. InspectionComparisonModal        │
│ 3. IntakePhotosUploader             │   │    • Galerie Avant (Réception)      │
│    • Caméra / Galerie mobile & PC   │   │    • Galerie Après (Restitution)    │
│                                     │   │    • Statut Réparé Oui/Non/Préciser │
└──────────────────┬──────────────────┘   └──────────────────┬──────────────────┘
                   │                                         │
                   └──────────────────┬──────────────────────┘
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │       Storage & Database (types.ts / idb)       │
             │   • receptionDetails (Yango vs Atelier)         │
             │   • payments: PaymentEntry[] + solde calculé    │
             │   • inspectionPhotos (intake vs restitution)    │
             └─────────────────────────────────────────────────┘
```

#### Schéma de Données (Extensions dans `types.ts`)

```typescript
// Mode de réception
export type ReceptionMode = 'depot_atelier' | 'livraison_yango';

export interface YangoDeliveryInfo {
  clientName?: string;
  clientPhone?: string;
  receptionDate: string;
  deliveryReference?: string;
  deliveryNotes?: string;
  driverType: 'yango_affilie' | 'livreur_independant';
  driverName?: string;
  driverPhone?: string;
  whatsappScreenshot?: string; // Capture écran WhatsApp du formulaire client
  driverScreenshot?: string;   // Capture écran de la course Yango ou photo livreur
  deliveryProofDoc?: string;   // Fichier PDF ou photo de décharge
}

// Règlements électroniques & espèces
export type PaymentMethod = 'wave' | 'orange_money' | 'mtn_momo' | 'moov_money' | 'especes' | 'virement' | 'carte' | 'autre';

export interface PaymentEntry {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD ou ISO
  method: PaymentMethod;
  reference?: string; // Référence de transaction Wave, OM, etc.
  proofUrl?: string;  // Justificatif JPG/PNG ou PDF (Base64 ou Blob URL)
  proofName?: string;
  proofType?: 'image' | 'pdf';
  notes?: string;
  recordedBy?: string;
  createdAt: string;
}

// Photos Avant / Après & Restitution
export interface RestitutionDetails {
  isRepaired: 'oui' | 'non' | 'preciser';
  repairSummaryNotes?: string;
  repairedComponents?: string[];
  restitutionMode: 'retrait_atelier' | 'livraison_yango';
  yangoExpeditionProof?: string; // Photo du colis remis au livreur Yango
  yangoDriverInfo?: string;
  restitutionDate?: string;
}

// Enrichissement du RepairTicket
export interface RepairTicket {
  // ... champs existants ...
  receptionMode?: ReceptionMode;
  yangoDetails?: YangoDeliveryInfo;
  paymentsList?: PaymentEntry[];
  restitutionPhotos?: string[]; // Clichés pris avant restitution
  restitutionDetails?: RestitutionDetails;
}
```

#### Composants Clés à Créer ou Mettre à Jour

1. **`DeviceProfileContext.tsx` & `DeviceProfileModal.tsx`** :
   - Détection et sélection réversible du support (Ordinateur, Tablette, Téléphone).
   - Ajustement de l'UI : densité compacte sur PC, boutons amples sur tablette, flux par étapes sur smartphone.
2. **`ReceptionModeField.tsx`** :
   - Sélecteur Dépôt direct / Yango avec glisser-déposer de captures WhatsApp et photo du livreur.
3. **`PaymentLedgerManager.tsx`** :
   - Enregistrement des paiements (Wave, Orange Money, Espèces).
   - Suivi visuel clair : Payé / Partiel / Reste à payer.
   - Visualiseur intégré pour preuves JPG/PNG et PDF.
4. **`InspectionPhotoGallery.tsx` & `PhotoComparisonModal.tsx`** :
   - Onglets Réception (Avant) et Restitution (Après).
   - Qualification de la réparation (Oui / Non / Préciser).
   - Outil de comparaison avant/après en grand écran.
5. **Intégration dans `RepairForm.tsx`, `EnterpriseRepairForm.tsx` et `RepairDetail.tsx`** :
   - Prise en charge transparente à la création et à la consultation.
