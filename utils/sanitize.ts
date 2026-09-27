
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

const ensureValidISO = (dateStr: unknown): string => {
    if (!dateStr || typeof dateStr !== 'string') return new Date().toISOString();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

export const sanitizeSimpleDocuments = (docs: unknown[]): SimpleDocument[] => {
    if (!Array.isArray(docs)) return [];
    return docs.map((itemInput: unknown) => {
        const item = itemInput as Record<string, unknown>;
        return {
            id: (item['id'] as string) || `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            updatedAt: ensureValidISO((item['updatedAt'] as string) || (item['date'] as string)),
            title: (item['title'] as string) || 'Document sans titre',
            content: (item['content'] as string) || '',
            date: ensureValidISO(item['date'] as string),
            recipientName: (item['recipientName'] as string) || undefined,
        };
    });
};

export const sanitizeStoredDocuments = (docs: unknown[]): StoredDocument[] => {
    if (!Array.isArray(docs)) return [];
    return docs.map((itemInput: unknown) => {
        const item = itemInput as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
            id: item.id || `doc-file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.name || 'Document sans nom',
            type: item.type || 'application/octet-stream',
            size: Number(item.size) || 0,
            category: item.category || 'Non classé',
            uploadDate: ensureValidISO(item.uploadDate),
            data: item.data || '', 
            description: item.description || '',
        };
    });
};

export const sanitizeTicket = (input: unknown): RepairTicket => {
  const ticket = (input && typeof input === 'object' ? input : {}) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  
  const diagSheetBInput = ticket.diagnosticSheetB as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const diagSheetB = diagSheetBInput ? {
    entryCondition: diagSheetBInput.entryCondition || EntryCondition.NO_POWER,
    testDuration: diagSheetBInput.testDuration || '',
    repairDelay: diagSheetBInput.repairDelay || '',
    diagnosticPoints: Array.isArray(diagSheetBInput.diagnosticPoints) ? diagSheetBInput.diagnosticPoints : [],
    tensionValues: Array.isArray(diagSheetBInput.tensionValues) ? diagSheetBInput.tensionValues : [],
    visualInspection: diagSheetBInput.visualInspection || '',
    images: Array.isArray(diagSheetBInput.images) ? diagSheetBInput.images : [],
  } : undefined;

  return {
    ...ticket,
    id: (typeof ticket.id === 'string' && ticket.id.trim()) 
      ? ticket.id.trim().toUpperCase() 
      : '',
    createdAt: ensureValidISO(ticket.createdAt),
    updatedAt: ensureValidISO(ticket.updatedAt || ticket.createdAt),
    status: ticket.status || RepairStatus.A_DIAGNOSTIQUER,
    client: {
      name: ticket.client?.name || 'Client inconnu',
      phone: ticket.client?.phone || '',
      secondaryPhone: ticket.client?.secondaryPhone || '',
      email: ticket.client?.email || '',
      id: ticket.client?.id || '',
      customFields: ticket.client?.customFields || {},
      isEnterprise: !!ticket.client?.isEnterprise
    },
    macBrand: ticket.macBrand || 'APPLE',
    macModel: ticket.macModel || '',
    modelNumber: ticket.modelNumber || '',
    macColor: ticket.macColor || '',
    serialNumber: ticket.serialNumber || '',
    problemDescription: ticket.problemDescription || '',
    technicianNotes: ticket.technicianNotes || '',
    costs: {
      diagnostic: Number(ticket.costs?.diagnostic) || 0,
      repair: Number(ticket.costs?.repair) || 0,
      advance: (ticket.status || RepairStatus.A_DIAGNOSTIQUER) === RepairStatus.RENDU
        ? (Number(ticket.costs?.diagnostic) || 0) + (Number(ticket.costs?.repair) || 0)
        : Number(ticket.costs?.advance) || 0,
    },
    powersOn: typeof ticket.powersOn === 'boolean' ? ticket.powersOn : true,
    powerOnStatus: ticket.powerOnStatus || 'non',
    chargerIncluded: typeof ticket.chargerIncluded === 'boolean' ? ticket.chargerIncluded : false,
    bagIncluded: typeof ticket.bagIncluded === 'boolean' ? ticket.bagIncluded : false,
    bagDescription: ticket.bagDescription || '',
    caseIncluded: typeof ticket.caseIncluded === 'boolean' ? ticket.caseIncluded : false,
    caseColor: ticket.caseColor || '',
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
    multimediaEnabled: typeof ticket.multimediaEnabled === 'boolean' ? ticket.multimediaEnabled : false,
    printDiagnosticIntegrated: typeof ticket.printDiagnosticIntegrated === 'boolean' ? ticket.printDiagnosticIntegrated : false,
    showExpertiseB: typeof ticket.showExpertiseB === 'boolean' ? ticket.showExpertiseB : false,
    printFunctionalTests: typeof ticket.printFunctionalTests === 'boolean' ? ticket.printFunctionalTests : false,
    printLegalDocument: typeof ticket.printLegalDocument === 'boolean' ? ticket.printLegalDocument : false,
    selectedLegalTemplate: ticket.selectedLegalTemplate,
    isReIntervention: typeof ticket.isReIntervention === 'boolean' ? ticket.isReIntervention : false,
    reInterventionReason: ticket.reInterventionReason || '',
    reInterventionReceiptDate: ticket.reInterventionReceiptDate || '',
    warrantyInterventionReport: ticket.warrantyInterventionReport || '',
    savDiagnosis: ticket.savDiagnosis || '',
    savNewRdvDate: ticket.savNewRdvDate || '',
    savNextRdvDate: ticket.savNextRdvDate || '',
    savNextRdvNotes: ticket.savNextRdvNotes || '',
    isReopenedAfterCancellation: typeof ticket.isReopenedAfterCancellation === 'boolean' ? ticket.isReopenedAfterCancellation : false,
    cancellationReturnDate: ticket.cancellationReturnDate || '',
    cancellationReturnNotes: ticket.cancellationReturnNotes || '',
  };
};

export const sanitizeTickets = (tickets: unknown[]): RepairTicket[] => {
  if (!Array.isArray(tickets)) return [];
  return tickets.map(sanitizeTicket);
};

export const sanitizeStock = (stockItems: unknown[]): StockItem[] => {
    if (!Array.isArray(stockItems)) return [];
    return stockItems.map((itemInput: unknown) => {
        const item = itemInput as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
        id: item.id || `stk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        updatedAt: ensureValidISO(item.updatedAt),
        name: item.name || '',
        quantity: Number(item.quantity) || 0,
        category: item.category || 'Non classé',
        reference: item.reference || undefined,
        cost: item.cost !== undefined ? Number(item.cost) : undefined,
        sellingPrice: item.sellingPrice !== undefined ? Number(item.sellingPrice) : undefined,
        color: item.color || '',
        compatibleModels: Array.isArray(item.compatibleModels) 
            ? item.compatibleModels 
            : (typeof item.compatibleModels === 'string' ? item.compatibleModels.split(',').map((s: string) => s.trim()).filter(Boolean) : []),
        condition: ['Neuf', 'Occasion', 'Reconditionné'].includes(item.condition) ? item.condition : 'Neuf',
        alertThreshold: Number(item.alertThreshold) || 1,
        supplier: item.supplier || '',
        location: item.location || '',
        entryDate: item.entryDate || new Date().toISOString().split('T')[0],
        isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
        customFields: item.customFields || {},
      };
    });
};

export const sanitizeServices = (services: unknown[]): RepairServiceItem[] => {
    if (!Array.isArray(services)) return [];
    return services.map((itemInput: unknown) => {
        const item = itemInput as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
            id: item.id || `svc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            updatedAt: ensureValidISO(item.updatedAt),
            name: item.name || '',
            price: Number(item.price) || 0,
            category: item.category || 'Non classé',
        };
    });
};

export const sanitizeAppointments = (appointments: unknown[]): Appointment[] => {
    if (!Array.isArray(appointments)) return [];
    return appointments.map((itemInput: unknown) => {
        const item = itemInput as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
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
        };
    });
};

export const sanitizeFactures = (factures: unknown[]): Facture[] => {
    if (!Array.isArray(factures)) return [];
    return factures.map((itemInput: unknown) => {
        const item = itemInput as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
            id: item.id || `fac-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            updatedAt: ensureValidISO(item.updatedAt || item.date),
            numero: item.numero || '',
            date: ensureValidISO(item.date),
            clientName: item.clientName || '',
            clientPhone: item.clientPhone || '',
            macModel: item.macModel || '',
            macColor: item.macColor || '',
            macSpecs: item.macSpecs || '',
            items: Array.isArray(item.items) ? (item.items as unknown[]).map((iInput: unknown) => {
                const i = iInput as any; // eslint-disable-line @typescript-eslint/no-explicit-any
                return {...i, quantity: Number(i.quantity)||0, unitPrice: Number(i.unitPrice)||0, totalPrice: Number(i.totalPrice)||0};
            }) : [],
            total: Number(item.total) || 0,
            status: ['Brouillon', 'Finalisé', 'Payé', 'Annulé'].includes(item.status) ? item.status : 'Brouillon',
            warranty: item.warranty || undefined,
            advance: Number(item.advance) || 0,
            message: item.message || undefined,
        };
    });
};

export const sanitizeProformas = (proformas: unknown[]): Proforma[] => {
    if (!Array.isArray(proformas)) return [];
    return proformas.map((itemInput: unknown) => {
        const item = itemInput as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
            id: item.id || `pro-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            updatedAt: ensureValidISO(item.updatedAt || item.date),
            numero: item.numero || '',
            date: ensureValidISO(item.date),
            clientName: item.clientName || '',
            clientPhone: item.clientPhone || '',
            macModel: item.macModel || '',
            macColor: item.macColor || '',
            macSpecs: item.macSpecs || '',
            items: Array.isArray(item.items) ? (item.items as unknown[]).map((iInput: unknown) => {
                const i = iInput as any; // eslint-disable-line @typescript-eslint/no-explicit-any
                return {...i, quantity: Number(i.quantity)||0, unitPrice: Number(i.unitPrice)||0, totalPrice: Number(i.totalPrice)||0};
            }) : [],
            total: Number(item.total) || 0,
            status: ['Brouillon', 'Envoyé', 'Accepté', 'Refusé'].includes(item.status) ? item.status : 'Brouillon',
            message: item.message || undefined,
        };
    });
};

export const sanitizeCommandes = (commandes: unknown[]): Commande[] => {
    if (!Array.isArray(commandes)) return [];
    return commandes.map((itemInput: unknown) => {
        const item = itemInput as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
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
            items: Array.isArray(item.items) ? (item.items as unknown[]).map((iInput: unknown) => {
                const i = iInput as any; // eslint-disable-line @typescript-eslint/no-explicit-any
                return {...i, quantity: Number(i.quantity)||0, unitPrice: Number(i.unitPrice)||0, totalPrice: Number(i.totalPrice)||0};
            }) : [],
            total: Number(item.total) || 0,
            status: ['Brouillon', 'Commandé', 'Reçu', 'Annulé', 'Payé'].includes(item.status) ? item.status : 'Brouillon',
            deliveryDelay: item.deliveryDelay || undefined,
            advance: Number(item.advance) || 0,
            message: item.message || undefined,
            isRevenue: typeof item.isRevenue === 'boolean' ? item.isRevenue : false,
        };
    });
};

export const sanitizeSuggestions = (suggestions: unknown[]): SuggestionRecord[] => {
    if (!Array.isArray(suggestions)) return [];
    return suggestions.map((itemInput: unknown) => {
        const item = itemInput as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
            category: item.category || '',
            values: Array.isArray(item.values) ? item.values : [],
        };
    }).filter(item => item.category);
};
