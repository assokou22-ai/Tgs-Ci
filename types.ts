
// types.ts (extrait mis à jour pour la modularité)

export type ThemeType = 'system' | 'blanc-noir-bleu' | 'blanc-vert-bleu' | 'blanc-bleu-noir' | 'professionnel' | 'ia-aleatoire';

export interface ColorPalette {
    primary: string;
    secondary: string;
    bg: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
}

// Identifiants uniques pour chaque fonctionnalité/menu du logiciel
export type FeatureId = 
    | 'menu_accueil' | 'menu_technicien' | 'menu_editeur' | 'menu_finance'
    | 'tool_ai_reports' | 'tool_ai_diag' | 'tool_ai_price' | 'tool_ai_correction' | 'tool_ai_search'
    | 'mod_stock' | 'mod_clients' | 'mod_documents' | 'mod_knowledge' | 'mod_multimedia' | 'mod_appointments'
    | 'mod_backup' | 'mod_exports' | 'mod_legal_folder' | 'mod_diagnostic_b';

export interface AppFeatures {
    enabled: Record<FeatureId, boolean>;
    requireSession: Record<FeatureId, boolean>;
}

// ... reste du fichier inchangé ...
export type Role = 'Accueil' | 'Technicien' | 'Editeur' | 'Facture et Commande';

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
}

export enum EntryCondition {
    BOOT_DISPLAY = "Démarre et s'affiche (Scénario A)",
    BOOT_NO_DISPLAY = "Démarre mais pas d'affichage (Scénario B)",
    NO_POWER = "Ne démarre pas / Aucune réaction (Scénario C)",
}

export interface Attachment {
    id: string;
    name: string;
    type: 'image' | 'video' | 'audio' | 'pdf';
    data: string; // Base64 encoding
    createdAt: string;
}

export interface Client {
    id?: string;
    name: string;
    phone: string;
    email?: string;
    customFields?: Record<string, string>;
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
    user: 'Accueil' | 'Technicien' | 'Editeur';
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
}

export interface TensionValue {
  line: string;
  value: string;
  status: 'Correct' | 'Anormal' | 'Absent';
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
    problemDescription: string;
    technicianNotes?: string;
    estimatedWorkDelay?: string;
    costs: Costs;
    powersOn: boolean;
    chargerIncluded: boolean;
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
}

export interface StockItem {
    id: string;
    updatedAt: string;
    name: string;
    quantity: number;
    category: string;
    reference?: string;
    cost?: number;
    customFields: Record<string, string>;
}

export type SuggestionCategory = 'macModel' | 'problemDescription' | 'clientName' | 'clientPhone' | 'customServiceName';

export interface SuggestionRecord {
    category: SuggestionCategory;
    values: string[];
}

export interface LogEntry {
    id: string;
    timestamp: string;
    category: 'Service' | 'Stock';
    type: 'Ajout' | 'Suppression';
    message: string;
}

export interface StoredBackup {
    id: number;
    timestamp: string;
    data: BackupData;
}

export type EntityType = 'ticket' | 'stock' | 'service' | 'facture' | 'proforma' | 'commande' | 'appointment' | 'deviceSession' | 'simpleDocument' | 'storedDocument';

export interface SyncQueueItem {
    id: number;
    timestamp: number;
    entity: EntityType;
    entityId: string;
    operation: 'put' | 'delete';
    payload?: any;
}

export interface DocumentDetails {
    macModel: string;
    macColor?: string;
    clientPhone: string;
    macSpecs?: string;
}

export interface Facture extends DocumentDetails {
    id: string;
    updatedAt: string;
    numero: string;
    date: string;
    clientName: string;
    items: DocumentItem[];
    total: number;
    status: FactureStatus;
    warranty?: string;
    advance: number;
    message?: string;
}

export interface DocumentItem {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export type FactureStatus = 'Brouillon' | 'Finalisé' | 'Payé' | 'Annulé';

export type DocumentStatus = FactureStatus | 'Commande en cours';

export interface CustomFieldDef {
    id: string;
    label: string;
}

export interface Proforma extends DocumentDetails {
    id: string;
    updatedAt: string;
    numero: string;
    date: string;
    clientName: string;
    items: DocumentItem[];
    total: number;
    status: 'Brouillon' | 'Envoyé' | 'Accepté' | 'Refusé';
    message?: string;
}

export interface Commande extends DocumentDetails {
    id: string;
    updatedAt: string;
    numero: string;
    date: string;
    supplierName: string;
    clientName?: string;
    items: DocumentItem[];
    total: number;
    status: 'Brouillon' | 'Commandé' | 'Reçu' | 'Annulé' | 'Payé';
    deliveryDelay?: string;
    advance: number;
    message?: string;
    isRevenue?: boolean; 
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
}
