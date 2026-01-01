
import {
    RepairTicket,
    RepairStatus,
    StockItem,
    RepairServiceItem,
    Appointment,
    Facture,
    Proforma,
    Commande,
    SuggestionRecord,
    SimpleDocument,
    StoredDocument,
    EntryCondition,
} from '../types.ts';

const ensureValidISO = (dateStr: any): string => {
    if (!dateStr) return new Date().toISOString();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

export const sanitizeSimpleDocuments = (docs: any[]): SimpleDocument[] => {
    if (!Array.isArray(docs)) return [];
    return docs.map((item: any) => ({
        id: item.id || `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        updatedAt: ensureValidISO(item.updatedAt || item.date),
        title: item.title || 'Document sans titre',
        content: item.content || '',
        date: ensureValidISO(item.date),
        recipientName: item.recipientName || undefined,
    }));
};

export const sanitizeStoredDocuments = (docs: any[]): StoredDocument[] => {
    if (!Array.isArray(docs)) return [];
    return docs.map((item: any) => ({
        id: item.id || `doc-file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: item.name || 'Document sans nom',
        type: item.type || 'application/octet-stream',
        size: Number(item.size) || 0,
        category: item.category || 'Non classé',
        uploadDate: ensureValidISO(item.uploadDate),
        data: item.data || '', 
        description: item.description || '',
    }));
};

export const sanitizeTicket = (ticket: any): RepairTicket => {
  if (!ticket || typeof ticket !== 'object') ticket = {};
  
  const diagSheetB = ticket.diagnosticSheetB ? {
    entryCondition: ticket.diagnosticSheetB.entryCondition || EntryCondition.NO_POWER,
    testDuration: ticket.diagnosticSheetB.testDuration || '',
    repairDelay: ticket.diagnosticSheetB.repairDelay || '',
    diagnosticPoints: Array.isArray(ticket.diagnosticSheetB.diagnosticPoints) ? ticket.diagnosticSheetB.diagnosticPoints : [],
    tensionValues: Array.isArray(ticket.diagnosticSheetB.tensionValues) ? ticket.diagnosticSheetB.tensionValues : [],
    visualInspection: ticket.diagnosticSheetB.visualInspection || '',
    images: Array.isArray(ticket.diagnosticSheetB.images) ? ticket.diagnosticSheetB.images : [],
  } : undefined;

  return {
    id: ticket.id || `RM-fallback-${Date.now()}`,
    createdAt: ensureValidISO(ticket.createdAt),
    updatedAt: ensureValidISO(ticket.updatedAt || ticket.createdAt),
    status: ticket.status || RepairStatus.A_DIAGNOSTIQUER,
    client: {
      name: ticket.client?.name || 'Client inconnu',
      phone: ticket.client?.phone || '',
      email: ticket.client?.email || '',
      id: ticket.client?.id || '',
      customFields: ticket.client?.customFields || {},
    },
    macBrand: ticket.macBrand || 'APPLE',
    macModel: ticket.macModel || '',
    problemDescription: ticket.problemDescription || '',
    technicianNotes: ticket.technicianNotes || '',
    costs: {
      diagnostic: Number(ticket.costs?.diagnostic) || 0,
      repair: Number(ticket.costs?.repair) || 0,
      advance: Number(ticket.costs?.advance) || 0,
    },
    powersOn: typeof ticket.powersOn === 'boolean' ? ticket.powersOn : true,
    chargerIncluded: typeof ticket.chargerIncluded === 'boolean' ? ticket.chargerIncluded : false,
    batteryFunctional: ['unknown', 'yes', 'no'].includes(ticket.batteryFunctional) ? ticket.batteryFunctional : 'unknown',
    warrantyVoidAgreed: typeof ticket.warrantyVoidAgreed === 'boolean' ? ticket.warrantyVoidAgreed : false,
    dataBackupAck: typeof ticket.dataBackupAck === 'boolean' ? ticket.dataBackupAck : false,
    clientSignature: ticket.clientSignature || undefined,
    services: Array.isArray(ticket.services) ? ticket.services : [],
    history: Array.isArray(ticket.history) ? ticket.history : [],
    diagnosticReport: Array.isArray(ticket.diagnosticReport) ? ticket.diagnosticReport : [],
    diagnosticImages: Array.isArray(ticket.diagnosticImages) ? ticket.diagnosticImages : [],
    customFields: ticket.customFields || {},
    diagnosticSheetB: diagSheetB,
    estimatedWorkDelay: ticket.estimatedWorkDelay || '',
    multimediaEnabled: typeof ticket.multimediaEnabled === 'boolean' ? ticket.multimediaEnabled : true,
    printDiagnosticIntegrated: typeof ticket.printDiagnosticIntegrated === 'boolean' ? ticket.printDiagnosticIntegrated : true,
  };
};

export const sanitizeTickets = (tickets: any[]): RepairTicket[] => {
  if (!Array.isArray(tickets)) return [];
  return tickets.map(sanitizeTicket);
};

export const sanitizeStock = (stockItems: any[]): StockItem[] => {
    if (!Array.isArray(stockItems)) return [];
    return stockItems.map((item: any) => ({
        id: item.id || `stk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        updatedAt: ensureValidISO(item.updatedAt),
        name: item.name || '',
        quantity: Number(item.quantity) || 0,
        category: item.category || 'Non classé',
        reference: item.reference || undefined,
        cost: item.cost !== undefined ? Number(item.cost) : undefined,
        customFields: item.customFields || {},
    }));
};

export const sanitizeServices = (services: any[]): RepairServiceItem[] => {
    if (!Array.isArray(services)) return [];
    return services.map((item: any) => ({
        id: item.id || `svc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        updatedAt: ensureValidISO(item.updatedAt),
        name: item.name || '',
        price: Number(item.price) || 0,
        category: item.category || 'Non classé',
    }));
};

export const sanitizeAppointments = (appointments: any[]): Appointment[] => {
    if (!Array.isArray(appointments)) return [];
    return appointments.map((item: any) => ({
        id: item.id || `appt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: ensureValidISO(item.createdAt),
        updatedAt: ensureValidISO(item.updatedAt || item.createdAt),
        date: item.date || '',
        time: item.time || '',
        clientName: item.clientName || '',
        clientPhone: item.clientPhone || '',
        reason: ['Récupération', 'Dépôt', 'Diagnostic', 'Autre'].includes(item.reason) ? item.reason : 'Autre',
        notes: item.notes || undefined,
        ticketId: item.ticketId || undefined,
    }));
};

export const sanitizeFactures = (factures: any[]): Facture[] => {
    if (!Array.isArray(factures)) return [];
    return factures.map((item: any) => ({
        id: item.id || `fac-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        updatedAt: ensureValidISO(item.updatedAt || item.date),
        numero: item.numero || '',
        date: ensureValidISO(item.date),
        clientName: item.clientName || '',
        clientPhone: item.clientPhone || '',
        macModel: item.macModel || '',
        macColor: item.macColor || '',
        macSpecs: item.macSpecs || '',
        items: Array.isArray(item.items) ? item.items.map(i => ({...i, quantity: Number(i.quantity)||0, unitPrice: Number(i.unitPrice)||0, totalPrice: Number(i.totalPrice)||0})) : [],
        total: Number(item.total) || 0,
        status: ['Brouillon', 'Finalisé', 'Payé', 'Annulé'].includes(item.status) ? item.status : 'Brouillon',
        warranty: item.warranty || undefined,
        advance: Number(item.advance) || 0,
        message: item.message || undefined,
    }));
};

export const sanitizeProformas = (proformas: any[]): Proforma[] => {
    if (!Array.isArray(proformas)) return [];
    return proformas.map((item: any) => ({
        id: item.id || `pro-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        updatedAt: ensureValidISO(item.updatedAt || item.date),
        numero: item.numero || '',
        date: ensureValidISO(item.date),
        clientName: item.clientName || '',
        clientPhone: item.clientPhone || '',
        macModel: item.macModel || '',
        macColor: item.macColor || '',
        macSpecs: item.macSpecs || '',
        items: Array.isArray(item.items) ? item.items.map(i => ({...i, quantity: Number(i.quantity)||0, unitPrice: Number(i.unitPrice)||0, totalPrice: Number(i.totalPrice)||0})) : [],
        total: Number(item.total) || 0,
        status: ['Brouillon', 'Envoyé', 'Accepté', 'Refusé'].includes(item.status) ? item.status : 'Brouillon',
        message: item.message || undefined,
    }));
};

export const sanitizeCommandes = (commandes: any[]): Commande[] => {
    if (!Array.isArray(commandes)) return [];
    return commandes.map((item: any) => ({
        id: item.id || `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        updatedAt: ensureValidISO(item.updatedAt || item.date),
        numero: item.numero || '',
        date: ensureValidISO(item.date),
        supplierName: item.supplierName || 'Inconnu',
        clientName: item.clientName || undefined,
        clientPhone: item.clientPhone || '',
        macModel: item.macModel || '',
        macColor: item.macColor || '',
        macSpecs: item.macSpecs || '',
        items: Array.isArray(item.items) ? item.items.map(i => ({...i, quantity: Number(i.quantity)||0, unitPrice: Number(i.unitPrice)||0, totalPrice: Number(i.totalPrice)||0})) : [],
        total: Number(item.total) || 0,
        status: ['Brouillon', 'Commandé', 'Reçu', 'Annulé', 'Payé'].includes(item.status) ? item.status : 'Brouillon',
        deliveryDelay: item.deliveryDelay || undefined,
        advance: Number(item.advance) || 0,
        message: item.message || undefined,
        isRevenue: typeof item.isRevenue === 'boolean' ? item.isRevenue : false,
    }));
};

export const sanitizeSuggestions = (suggestions: any[]): SuggestionRecord[] => {
    if (!Array.isArray(suggestions)) return [];
    return suggestions.map((item: any) => ({
        category: item.category || '',
        values: Array.isArray(item.values) ? item.values : [],
    })).filter(item => item.category);
};
