
// types.ts (Version enrichie avec inventaire détaillé)

export type ThemeType = 'system' | 'clair' | 'sombre' | 'bleu-apple' | 'vert-nature' | 'ia-aleatoire' | 'monochrome' | 'vga-classic';

export interface ColorPalette {
    primary: string;
    secondary: string;
    bg: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
}

export type FeatureId = 
    | 'menu_accueil' | 'menu_technicien' | 'menu_editeur' | 'menu_finance' | 'menu_engagements_sav' | 'menu_actions_du_jour'
    | 'tool_ai_reports' | 'tool_ai_diag' | 'tool_ai_price' | 'tool_ai_correction' | 'tool_ai_search'
    | 'mod_stock' | 'mod_clients' | 'mod_documents' | 'mod_knowledge' | 'mod_multimedia' | 'mod_appointments'
    | 'mod_backup' | 'mod_exports' | 'mod_legal_folder' | 'mod_diagnostic_b' | 'mod_enterprise_clients' | 'mod_daily_actions';

export interface AppFeatures {
    enabled: Record<FeatureId, boolean>;
    requireSession: Record<FeatureId, boolean>;
}

export type Role = 'Accueil' | 'Technicien' | 'Editeur' | 'Facture et Commande' | 'Engagements SAV' | 'Actions du jour' | 'Système';

export enum RepairStatus {
    A_DIAGNOSTIQUER = 'À diagnostiquer',
    DIAGNOSTIC_EN_COURS = 'Diagnostic en cours',
    DEVIS_A_VALIDER = 'Devis à valider',
    DEVIS_APPROUVE = 'Devis approuvé',
    EN_ATTENTE_DE_PIECES = 'En attente de pièces',
    REPARATION_EN_COURS = 'Réparation en cours',
    TESTS_EN_COURS = 'Tests en cours',
    TERMINE = 'Terminé',
    RENDU = 'Rendu',
    NON_REPARABLE = 'Non réparable',
    ANNULE = 'Annulé',
    REPORTE = 'Reporté',
}

export enum EntryCondition {
    BOOT_DISPLAY = "Démarre et s'affiche (Scénario A)",
    BOOT_NO_DISPLAY = "Démarre mais pas d'affichage (Scénario B)",
    NO_POWER = "Ne démarre pas / Aucune réaction (Scénario C)",
}

export type PowerOnStatus = 
    | 'non' 
    | 'charge_systeme' 
    | 'ne_charge_pas' 
    | 'bootloop' 
    | 'ecran_casse' 
    | 'ecran_non_fonctionnel' 
    | 'rien_ne_saffiche';

export type DeclaredSymptomCategory = 
    | 'no_power' 
    | 'liquid' 
    | 'screen' 
    | 'battery' 
    | 'system_reboot' 
    | 'other';

export interface DeclaredSymptomsDetails {
    selectedCategories?: DeclaredSymptomCategory[];
    // Ne s'allume plus
    noPowerIncidentDate?: string;
    noPowerCondition?: string;
    noPowerCustomCondition?: string;
    // Contact liquide
    liquidIncidentDate?: string;
    liquidType?: string;
    liquidCustomType?: string;
    liquidPluggedAfter?: 'oui' | 'non' | 'inconnu';
    liquidPoweredAfter?: 'oui' | 'non' | 'inconnu';
    liquidDryingAttempted?: string;
    // Écran & Affichage
    screenIssueType?: string;
    screenCause?: string;
    // Batterie & Charge
    batteryIssueType?: string;
    batteryChargerType?: 'apple_original' | 'generique_tiers' | 'inconnu';
    // Système / Redémarrages
    systemIssueType?: string;
    // Autre & Notes
    customProblem?: string;
    additionalNotes?: string;
}

export interface Attachment {
    id: string;
    name: string;
    type: 'image' | 'video' | 'audio' | 'pdf';
    data: string;
    createdAt: string;
}

export interface Client {
    id?: string;
    name: string;
    phone: string;
    secondaryPhone?: string;
    smsPhone?: string;
    useWhatsAppForSms?: boolean;
    email?: string;
    customFields?: Record<string, string>;
    isEnterprise?: boolean;
    clientType?: 'direct' | 'subcontractor';
    technicianName?: string;
    technicianPhone?: string;
    finalClientName?: string;
}

export interface Costs {
    diagnostic: number;
    repair: number;
    advance: number;
}

export interface RepairServiceItem {
    id: string;
    updatedAt: string;
    name: string;
    price: number;
    category: string;
}

export interface HistoryEntry {
    timestamp: string;
    user: Role;
    action: string;
}

export interface DiagnosticCheck {
    component: string;
    status: 'Non testé' | 'OK' | 'Problème' | 'Non testable (état machine)';
    notes: string;
}

export interface DiagnosticPoint {
    item: string;
    notes: string;
    status?: 'OK' | 'NOK' | 'N/A'; // Ajout pour le rapport P4
}

export interface TensionValue {
    line: string;
    value: string;
    status: 'Correct' | 'Anormal' | 'Absent';
    nominalValue?: number;
    machineType?: string;
}

export interface DiagnosticSheetBData {
  entryCondition: EntryCondition;
  testDuration: string;
  repairDelay: string;
  diagnosticPoints: DiagnosticPoint[];
  tensionValues: TensionValue[];
  visualInspection: string;
  images?: string[];
}

export type LegalTemplateId = 'bon' | 'attestation' | 'cession';

export type TechnicalReportLevel = 'express' | 'standard' | 'expert_p3';

export interface TechnicalInterventionReport {
    enabled?: boolean;
    level?: TechnicalReportLevel;
    reportTitle?: string;
    interventionsDone?: string;
    result?: string;
    observation?: string;
    faultCause?: string;
    importantNotes?: string;
    retraitDateInfo?: string;
    nextRdvInfo?: string;
    sessionPasswordRequired?: boolean;
    dataWipeAcknowledged?: boolean;
    oldChipsReturned?: boolean;
    updatedAt?: string;
    technicianName?: string;
}

export interface RepairTicket {
    id: string;
    createdAt: string;
    updatedAt: string;
    diagnosticCreatedAt?: string;
    lastNotifiedAt?: string;
    status: RepairStatus;
    client: Client;
    macBrand: string; 
    macModel: string;
    modelNumber?: string; // Ajout du numéro AXXXX
    macColor?: string;
    serialNumber?: string;
    problemDescription: string;
    declaredSymptomsDetails?: DeclaredSymptomsDetails;
    technicianNotes?: string;
    estimatedWorkDelay?: string;
    costs: Costs;
    powersOn: boolean;
    powerOnStatus: PowerOnStatus;
    chargerIncluded: boolean; 
    bagIncluded: boolean;
    bagDescription?: string;
    caseIncluded: boolean;
    caseColor?: string;
    batteryFunctional: 'unknown' | 'yes' | 'no';
    warrantyVoidAgreed: boolean;
    dataBackupAck: boolean;
    clientSignature?: string;
    services: RepairServiceItem[];
    history: HistoryEntry[];
    diagnosticReport?: DiagnosticCheck[];
    diagnosticImages?: string[];
    attachments?: Attachment[];
    customFields?: Record<string, string>;
    diagnosticSheetB?: DiagnosticSheetBData;
    multimediaEnabled?: boolean;
    printDiagnosticIntegrated?: boolean; 
    showExpertiseB?: boolean;
    printFunctionalTests?: boolean; // NOUVEAU P4
    printTechnicalReportP3?: boolean; // NOUVEAU P3 RAPPORT DE FIN D'INTERVENTION
    technicalReport?: TechnicalInterventionReport;
    printLegalDocument?: boolean;
    selectedLegalTemplate?: LegalTemplateId;
    
    // Champs SAV enrichis
    isReIntervention?: boolean;
    reInterventionReason?: string; // Raison du retour (Client)
    reInterventionReceiptDate?: string; // Date de réception SAV (selon le jour de la réception)
    savDiagnosis?: string; // Diagnostic SAV et cause de la nouvelle intervention
    savNewRdvDate?: string; // Nouvelle date de RDV
    savNextRdvDate?: string; // Prochain RDV (facultatif ou si attente d'une nouvelle pièce)
    savNextRdvNotes?: string; // Notes / détails pour prochain RDV
    warrantyInterventionReport?: string; // Rapport de correction (Technicien) / Actions correctives
    
    // Champs de retour après annulation
    isReopenedAfterCancellation?: boolean;
    cancellationReturnDate?: string;
    cancellationReturnNotes?: string;
    postponedDays?: number;
    postponedUntil?: string;
    ligneVentes?: LigneVenteFiche[];
    
    // Champs de commande liée
    isWaitingForOrderedPart?: boolean;
    isMountingDay?: boolean;
    linkedCommandeId?: string;
    linkedCommandeNumber?: string;
    rendezVousDate?: string;
    rendezVousTime?: string;
    subcontractorIncident?: string;

    // Précision obligatoire statut En Attente & Rappels automatiques
    waitingStatusLabel?: string; // ex: "En attente de validation du devis — relancer le 26 août à 10 h"
    waitingReason?: string; // motif détaillé
    waitingFollowUpDate?: string; // YYYY-MM-DD
    waitingFollowUpTime?: string; // HH:mm
}

export type DailyActionStatus = 'A_FAIRE' | 'FAIT' | 'EN_RETARD';
export type DailyActionType = 'RAPPEL_J3' | 'CONFIRMATION_J1' | 'JOUR_J0_8H' | 'RELANCE_DEVIS' | 'ATTENTE_PIECE' | 'RDV_CLIENT' | 'SAV_PROMESSE' | 'AUTRE';

export interface DailyActionItem {
    id: string;
    heure: string; // ex: "08 h 00", "09 h 00", "11 h 00", "14 h 00"
    clientName: string;
    clientPhone: string;
    appareil: string;
    action: string; // Libellé de l'action à faire
    statut: DailyActionStatus;
    ticketId?: string;
    engagementId?: string;
    appointmentId?: string;
    dateCible: string; // YYYY-MM-DD
    typeRappel: DailyActionType;
    details?: string;
    isOverdue?: boolean;
    completedAt?: string;
    createdAt: string;
}

export interface LigneVenteFiche {
    id: string;
    fiche_id: string;
    type_ligne: 'article_stock' | 'article_hors_stock' | 'prestation';
    article_stock_id: string | null;
    designation: string;
    modele_compatible: string;
    categorie: string;
    quantite: number;
    prix_unitaire_standard: number;
    reduction_active: boolean;
    reduction_type: 'montant' | 'pourcentage' | null;
    reduction_valeur: number;
    prix_unitaire_final: number;
    motif_reduction?: string;
    statut_ligne: 'prevu' | 'reserve' | 'utilise' | 'annule';
    prix_achat?: number;
}

export interface MouvementStock {
    id: string;
    article_stock_id: string;
    fiche_id: string | null;
    type_mouvement: 'reservation' | 'sortie' | 'annulation_reservation' | 'ajustement' | 'entree_achat';
    quantite: number;
    date_mouvement: string;
    utilisateur: string;
    commentaire?: string;
    designation_article?: string;
}

export interface StockItem {
    id: string;
    updatedAt: string;
    name: string; 
    quantity: number;
    category: string;
    reference?: string;
    cost?: number; 
    sellingPrice?: number;
    color?: string;
    compatibleModels?: string[];
    condition?: 'Neuf' | 'Occasion' | 'Reconditionné';
    alertThreshold?: number;
    supplier?: string;
    location?: string;
    entryDate?: string;
    isActive?: boolean;
    customFields: Record<string, string>;
    quantite_reservee?: number;
}

export interface StockUsage {
    id: string;
    stock_id: string;
    ticket_id: string;
    quantite_utilisee: number;
    date: string;
    stockName?: string;
}

export interface ExternalPurchase {
    id: string;
    ticket_id: string;
    item_name: string;
    collaborator_name: string;
    purchase_price: number;
    sale_price: number;
    date: string;
}

export type SuggestionCategory = 
    | 'problem_description' 
    | 'mac_models' 
    | 'mac_colors'
    | 'service_name' 
    | 'diagnostic_notes' 
    | 'customServiceName' 
    | 'power_on_details'
    | 'collaborator_names'
    | 'bag_descriptions'
    | 'case_colors';

export interface SuggestionRecord {
    category: SuggestionCategory | string;
    values: string[];
}

export interface DocumentItem {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export type FactureStatus = 'Brouillon' | 'Finalisé' | 'Payé' | 'Annulé';

export type DocumentNature = 'macbook' | 'pieces' | 'reparation' | 'autre';
export type WarrantyType = 'macbook' | 'reparation' | 'pieces' | 'aucun' | 'personnalise';

export interface Facture {
    id: string;
    updatedAt: string;
    numero: string;
    date: string;
    clientName: string;
    clientPhone: string;
    documentNature?: DocumentNature;
    macModel: string;
    macColor?: string;
    macSpecs?: string;
    macSerialNumber?: string;
    macModelNumber?: string;
    macScreenSize?: string;
    macCondition?: 'Neuf' | 'Occasion' | 'Reconditionné';
    items: DocumentItem[];
    total: number;
    status: FactureStatus;
    warranty?: string;
    warrantyType?: WarrantyType;
    warrantyConditions?: string;
    includeWarrantyBlock?: boolean;
    advance: number;
    message?: string;
    proformaNumero?: string;
    proformaId?: string;
    history?: HistoryEntry[];
}

export type DocumentStatus = FactureStatus | 'Envoyé' | 'Accepté' | 'Refusé' | 'Commandé' | 'Reçu';

export interface Proforma {
    id: string;
    updatedAt: string;
    numero: string;
    date: string;
    clientName: string;
    clientPhone: string;
    documentNature?: DocumentNature;
    macModel: string;
    macColor?: string;
    macSpecs?: string;
    macSerialNumber?: string;
    macModelNumber?: string;
    macScreenSize?: string;
    macCondition?: 'Neuf' | 'Occasion' | 'Reconditionné';
    items: DocumentItem[];
    total: number;
    status: 'Brouillon' | 'Envoyé' | 'Accepté' | 'Refusé';
    warranty?: string;
    warrantyType?: WarrantyType;
    warrantyConditions?: string;
    includeWarrantyBlock?: boolean;
    advance?: number;
    message?: string;
    convertedFactureNumero?: string;
    convertedFactureId?: string;
}

export type PurchaseType = 'Écran' | 'MacBook Pro' | 'MacBook Air' | 'Batterie' | 'Clavier' | 'Carte Mère' | 'Autre';

export interface Commande {
    id: string;
    updatedAt: string;
    numero: string;
    date: string;
    supplierName: string;
    clientName?: string;
    clientPhone: string;
    macModel: string;
    macColor?: string;
    macSpecs?: string;
    items: DocumentItem[];
    total: number;
    status: 'Brouillon' | 'Commandé' | 'Reçu' | 'Annulé' | 'Payé';
    deliveryDelay?: string;
    warranty?: string;
    advance: number;
    message?: string;
    isRevenue?: boolean; 
    purchaseType?: PurchaseType | string;
    macDetails?: {
        processor?: string;
        ram?: string;
        ssd?: string;
        screenSize?: string;
        condition?: 'Neuf' | 'Occasion';
        hasBox?: 'Oui' | 'Non';
    };
    partDetails?: {
        size?: string;
        color?: string;
        condition?: 'Neuf' | 'Occasion';
        ram?: string;
        processor?: string;
        ssd?: string;
    };
    isLinkedToTicket?: boolean;
    linkedTicketId?: string;
    history?: HistoryEntry[];
}

export interface Appointment {
    id: string;
    createdAt: string;
    updatedAt: string;
    date: string; 
    time: string; 
    clientName: string;
    clientPhone: string;
    reason: 'Récupération' | 'Dépôt' | 'Diagnostic' | 'Autre';
    notes?: string;
    ticketId?: string;
}

export interface DeviceSession {
    id: string;
    timestamp: string;
    email?: string;
    ipAddress?: string;
    browser?: string;
    os?: string;
    location?: string;
    coordinates?: string;
}

export interface LogEntry {
    id: string;
    timestamp: string;
    category: 'Service' | 'Stock' | 'Finance';
    type: 'Ajout' | 'Suppression';
    message: string;
}

export interface SimpleDocument {
    id: string;
    updatedAt: string;
    title: string;
    content: string;
    date: string;
    recipientName?: string;
}

export interface StoredDocument {
    id: string;
    name: string; 
    type: string; 
    size: number; 
    category: string; 
    uploadDate: string;
    data: string; 
    description: string; 
}

export interface CustomFieldDef {
    id: string;
    label: string;
}

export interface SerializedAppSettings {
  theme: string;
  customCss: string;
  clauses: string[];
  customFields: {
    ticket: CustomFieldDef[];
    stock: CustomFieldDef[];
    client: CustomFieldDef[];
  };
}

export type EngagementSavStatus = 
    | 'A_OUVRIR'
    | 'PIECE_A_COMMANDER'
    | 'PIECE_COMMANDEE'
    | 'PIECE_RECUE'
    | 'CLIENT_A_APPELER'
    | 'RDV_FIXE'
    | 'REMPLACEMENT_EFFECTUE'
    | 'CLOS'
    | 'ANNULE';

export interface EngagementSav {
    id: string; // SAV-YYYYMMDD-XXX
    numeroFicheOrigine: string | null;
    numeroCommandeOrigine: string | null;
    clientId: string | null;
    nomClient: string;
    telephoneClient: string;
    appareil: string;
    pieceAremplacer: string;
    motif: string;
    datePromesse: string; // YYYY-MM-DD
    prochaineDateAction: string; // YYYY-MM-DD
    statut: EngagementSavStatus;
    responsable: string;
    noteInterne: string;
    createdAt: string;
    updatedAt: string;
    isSynced?: boolean;
    atelierId: string | null;
}

export interface BackupData {
    tickets: RepairTicket[];
    stock: StockItem[];
    services: RepairServiceItem[];
    suggestions: SuggestionRecord[];
    appointments: Appointment[];
    factures: Facture[];
    proformas: Proforma[];
    commandes: Commande[];
    simpleDocuments: SimpleDocument[];
    storedDocuments: StoredDocument[];
    stockUsage?: StockUsage[];
    externalPurchases?: ExternalPurchase[];
    appSettings?: SerializedAppSettings;
    engagementsSav?: EngagementSav[];
}

export type EntityType = 
    | 'ticket' | 'stock' | 'stockUsage' | 'externalPurchase' | 'service' | 'facture' | 'proforma' | 'commande' 
    | 'appointment' | 'deviceSession' | 'simpleDocument' | 'storedDocument' | 'suggestions' | 'engagementSav' | 'mouvementStock';

export interface SyncQueueItem {
    id: number;
    timestamp: number;
    entity: EntityType;
    entityId: string;
    operation: 'put' | 'delete';
    payload?: unknown;
    retries?: number;
    lastError?: string;
}
