
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { RepairTicket, RepairStatus, Role, HistoryEntry, LegalTemplateId, TechnicalInterventionReport } from '../types.ts';
import { getStatusStyle } from '../utils/statusStyles.ts';
import { 
    PencilIcon, PrinterIcon, ChatBubbleLeftRightIcon, 
    ArrowLeftIcon, UserIcon, MacbookIcon,
    ShieldCheckIcon as LegalIcon,
    ClipboardDocumentListIcon,
    DocumentMagnifyingGlassIcon,
    ChevronDownIcon,
    WrenchScrewdriverIcon,
    PlusCircleIcon,
    ShoppingCartIcon,
    BuildingStorefrontIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    CalendarDaysIcon,
    CheckBadgeIcon,
    WhatsAppIcon,
    SparklesIcon,
    CloudArrowDownIcon
} from './icons.tsx';
import NotificationModal from './NotificationModal.tsx';
import DiagnosticSheetBModal from './DiagnosticSheetBModal.tsx';
import PrintableTicket from './PrintableTicket.tsx';
import PrintableLegalFolder from './PrintableLegalFolder.tsx';
import PrintableDiagnosticReport from './PrintableDiagnosticReport.tsx';
import PrintableDiagnosticSheetB from './PrintableDiagnosticSheetB.tsx';
import PrintableEnterpriseBon from './PrintableEnterpriseBon.tsx';
import PrintableLegalDocument from './PrintableLegalDocument.tsx';
import PrintableFunctionalTestsSheet from './PrintableFunctionalTestsSheet.tsx';
import PrintableWarrantyReport from './PrintableWarrantyReport.tsx';
import PrintableTechnicalReport from './PrintableTechnicalReport.tsx';
import PrintableTechnicalReportP3 from './PrintableTechnicalReportP3.tsx';
import PreviewModal from './PreviewModal.tsx';
import StockUsageModal from './StockUsageModal.tsx';
import ExternalPurchaseModal from './ExternalPurchaseModal.tsx';
import TechnicalReportEditModal from './TechnicalReportEditModal.tsx';
import useStock from '../hooks/useStock.ts';
import useExternalPurchases from '../hooks/useExternalPurchases.ts';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import useAppointments from '../hooks/useAppointments.ts';
import { playTone } from '../utils/audio.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { isFallbackTicketId } from '../utils/idGenerator.ts';
import { dbGetTickets } from '../services/dbService.ts';

import WhatsAppShareModal from './WhatsAppShareModal.tsx';
import WaitingStatusModal from './WaitingStatusModal.tsx';
import RegularizeTicketModal from './RegularizeTicketModal.tsx';

interface RepairDetailProps {
  ticket: RepairTicket;
  onBack: () => void;
  onUpdate: (ticket: RepairTicket, oldId?: string) => void | Promise<void>;
  onDelete: (ticketId: string) => void;
  role: Role;
  onEdit?: (ticket: RepairTicket) => void;
}

const RepairDetail: React.FC<RepairDetailProps> = ({ ticket, onBack, onUpdate, role, onEdit }) => {
    const { showToast } = useToastContext();
    const [isNotificationModalOpen, setNotificationModalOpen] = useState(false);
    const [isExpertiseModalOpen, setIsExpertiseModalOpen] = useState(false);
    const [isTechReportModalOpen, setIsTechReportModalOpen] = useState(false);
    const [isStockUsageOpen, setStockUsageOpen] = useState(false);
    const [isExternalPurchaseOpen, setExternalPurchaseOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewType, setPreviewType] = useState<'standard' | 'legal' | 'technical_report' | 'p3_report'>('standard');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isRegularizing, setIsRegularizing] = useState(false);
    const [isRegularizeModalOpen, setIsRegularizeModalOpen] = useState(false);
    const [allTickets, setAllTickets] = useState<RepairTicket[]>([]);

    const handleOpenRegularizeModal = async () => {
        try {
            const loaded = await dbGetTickets();
            setAllTickets(loaded);
        } catch (e) {
            console.error("Failed to load tickets for regularization modal:", e);
        }
        setIsRegularizeModalOpen(true);
    };

    const handleApplyNewTicketId = async (newOfficialId: string) => {
        setIsRegularizing(true);
        try {
            const oldId = ticket.id;
            const isFallback = isFallbackTicketId(oldId);

            const regularizedTicket: RepairTicket = {
                ...ticket,
                id: newOfficialId,
                updatedAt: new Date().toISOString(),
                history: [
                    ...(ticket.history || []),
                    {
                        timestamp: new Date().toISOString(),
                        user: role,
                        action: isFallback
                            ? `Régularisation du numéro de dossier : ancien identifiant provisoire [${oldId}] remplacé par le numéro officiel [${newOfficialId}].`
                            : `Modification du numéro de dossier : ancien numéro [${oldId}] remplacé par [${newOfficialId}].`
                    }
                ]
            };

            await onUpdate(regularizedTicket, oldId);
            playTone(880, 150);
            showToast(`Numéro de dossier attribué avec succès : ${newOfficialId}`, "success");
        } catch (err) {
            console.error("Failed to regularize ticket ID:", err);
            showToast("Erreur lors de la mise à jour du numéro de dossier.", "error");
            throw err;
        } finally {
            setIsRegularizing(false);
        }
    };
    const [isEditingWarrantyReport, setIsEditingWarrantyReport] = useState(false);
    const [warrantyReportText, setWarrantyReportText] = useState(ticket.warrantyInterventionReport || '');
    const [reInterventionReceiptDate, setReInterventionReceiptDate] = useState(ticket.reInterventionReceiptDate || '');
    const [reInterventionReasonText, setReInterventionReasonText] = useState(ticket.reInterventionReason || '');
    const [savDiagnosisText, setSavDiagnosisText] = useState(ticket.savDiagnosis || '');
    const [savNewRdvDate, setSavNewRdvDate] = useState(ticket.savNewRdvDate || '');
    const [savNextRdvDate, setSavNextRdvDate] = useState(ticket.savNextRdvDate || '');
    const [savNextRdvNotes, setSavNextRdvNotes] = useState(ticket.savNextRdvNotes || '');

    useEffect(() => {
        setWarrantyReportText(ticket.warrantyInterventionReport || '');
        setReInterventionReceiptDate(ticket.reInterventionReceiptDate || '');
        setReInterventionReasonText(ticket.reInterventionReason || '');
        setSavDiagnosisText(ticket.savDiagnosis || '');
        setSavNewRdvDate(ticket.savNewRdvDate || '');
        setSavNextRdvDate(ticket.savNextRdvDate || '');
        setSavNextRdvNotes(ticket.savNextRdvNotes || '');
    }, [ticket]);
    
    const [isWhatsAppShareOpen, setIsWhatsAppShareOpen] = useState(false);

    // États spécifiques pour le report de fiche
    const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);
    const [postponeDays, setPostponeDays] = useState<number>(5);
    const [postponeDate, setPostponeDate] = useState<string>('');

    // États spécifiques pour la validation de devis avec RDV
    const [isDevisApprovalModalOpen, setIsDevisApprovalModalOpen] = useState(false);
    const [repairDays, setRepairDays] = useState<number>(3);
    const { addAppointment } = useAppointments();

    // États spécifiques pour la précision obligatoire du statut En Attente & Rappels automatiques
    const [isWaitingStatusModalOpen, setIsWaitingStatusModalOpen] = useState(false);
    const [pendingWaitingStatus, setPendingWaitingStatus] = useState<RepairStatus>(RepairStatus.DEVIS_A_VALIDER);

    const getInitialRepairDays = useCallback(() => {
        if (ticket.diagnosticSheetB?.repairDelay) {
            const matches = ticket.diagnosticSheetB.repairDelay.match(/\d+/g);
            if (matches && matches.length > 0) {
                const numbers = matches.map(Number);
                const maxDays = Math.max(...numbers);
                if (maxDays > 0) return maxDays;
            }
        }
        return 3; // fallback default
    }, [ticket.diagnosticSheetB?.repairDelay]);

    useEffect(() => {
        if (isDevisApprovalModalOpen) {
            setRepairDays(getInitialRepairDays());
        }
    }, [isDevisApprovalModalOpen, getInitialRepairDays]);

    const calculatedRdvDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + repairDays);
        return d.toISOString().split('T')[0];
    }, [repairDays]);
    
    const { settings } = useAppSettings();
    const { movements } = useStock();
    const { purchases } = useExternalPurchases();

    const usedParts = useMemo(() => {
        return movements.filter(m => m.ticket_id === ticket.id);
    }, [movements, ticket.id]);

    const externalParts = useMemo(() => {
        return purchases.filter(p => p.ticket_id === ticket.id);
    }, [purchases, ticket.id]);

    const handleUpdateWithFeedback = async (updatedTicket: RepairTicket, actionDescription: string) => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            await onUpdate(updatedTicket);
            playTone(660, 100);
        } catch (error) { console.error(`Failed to ${actionDescription}:`, error); } finally { setIsUpdating(false); }
    };

    const handleStatusChange = async (newStatus: RepairStatus) => {
        if (newStatus === ticket.status) return;
        if (newStatus === RepairStatus.REPORTE) {
            setIsPostponeModalOpen(true);
            return;
        }
        if (newStatus === RepairStatus.DEVIS_APPROUVE) {
            setIsDevisApprovalModalOpen(true);
            return;
        }
        if (newStatus === RepairStatus.DEVIS_A_VALIDER || newStatus === RepairStatus.EN_ATTENTE_DE_PIECES) {
            setPendingWaitingStatus(newStatus);
            setIsWaitingStatusModalOpen(true);
            return;
        }
        const newHistoryEntry: HistoryEntry = { timestamp: new Date().toISOString(), user: role, action: `Changement de statut : ${ticket.status} ➔ ${newStatus}` };
        let updatedTicket: RepairTicket = { ...ticket, status: newStatus, postponedDays: undefined, postponedUntil: undefined, updatedAt: new Date().toISOString(), history: [...ticket.history, newHistoryEntry] };
        
        if (newStatus === RepairStatus.RENDU) {
            const total = (ticket.costs?.diagnostic || 0) + (ticket.costs?.repair || 0);
            updatedTicket = {
                ...updatedTicket,
                costs: {
                    ...updatedTicket.costs,
                    advance: total
                }
            };
        }

        if ((newStatus === RepairStatus.REPARATION_EN_COURS || newStatus === RepairStatus.EN_ATTENTE_DE_PIECES) && !ticket.rendezVousDate) {
            const days = getInitialRepairDays();
            const d = new Date();
            d.setDate(d.getDate() + days);
            const calculatedDateStr = d.toISOString().split('T')[0];
            
            updatedTicket = {
                ...updatedTicket,
                rendezVousDate: calculatedDateStr,
                rendezVousTime: '10:00',
                estimatedWorkDelay: `${days} jours`
            };
            
            try {
                await addAppointment({
                    date: calculatedDateStr,
                    time: '10:00',
                    clientName: ticket.client?.name || 'Client',
                    clientPhone: ticket.client?.phone || '',
                    reason: 'Récupération',
                    notes: `Rendez-vous de récupération après réparation (Fiche ${ticket.id}). Statut mis à jour vers ${newStatus}.`,
                    ticketId: ticket.id
                });
            } catch (error) {
                console.error("Failed to auto-create appointment on status change:", error);
            }
        }
        
        await handleUpdateWithFeedback(updatedTicket, 'mettre à jour le statut');
    };

    const handleConfirmPostpone = async () => {
        const now = new Date().toISOString();
        let targetDesc = '';
        const updateData: Partial<RepairTicket> = {
            status: RepairStatus.REPORTE,
            updatedAt: now,
        };

        if (postponeDate) {
            updateData.postponedUntil = postponeDate;
            updateData.postponedDays = undefined;
            targetDesc = `jusqu'au ${new Date(postponeDate).toLocaleDateString('fr-FR')}`;
        } else {
            updateData.postponedDays = postponeDays;
            updateData.postponedUntil = undefined;
            targetDesc = `pour ${postponeDays} jours`;
        }

        const newHistoryEntry: HistoryEntry = { 
            timestamp: now, 
            user: role, 
            action: `Changement de statut : ${ticket.status} ➔ Reporté (${targetDesc})` 
        };
        
        const updatedTicket: RepairTicket = { 
            ...ticket, 
            ...updateData, 
            history: [...ticket.history, newHistoryEntry] 
        };

        await handleUpdateWithFeedback(updatedTicket, "mettre à jour le statut en Reporté");
        setIsPostponeModalOpen(false);
    };

    const handleConfirmDevisApproval = async () => {
        const now = new Date().toISOString();
        const rdvDateStr = calculatedRdvDate;
        
        // 1. Add History Entry
        const newHistoryEntry: HistoryEntry = { 
            timestamp: now, 
            user: role, 
            action: `Devis validé. Réparation estimée à ${repairDays} jours. Rendez-vous de récupération planifié pour le ${new Date(rdvDateStr).toLocaleDateString('fr-FR')}` 
        };
        
        // 2. Prepare updated ticket
        const updatedTicket: RepairTicket = { 
            ...ticket, 
            status: RepairStatus.DEVIS_APPROUVE, 
            estimatedWorkDelay: `${repairDays} jours`,
            rendezVousDate: rdvDateStr,
            rendezVousTime: '10:00',
            updatedAt: now, 
            history: [...ticket.history, newHistoryEntry] 
        };
        
        // 3. Update the ticket
        await handleUpdateWithFeedback(updatedTicket, 'valider le devis');
        
        // 4. Create an automatic appointment
        try {
            await addAppointment({
                date: rdvDateStr,
                time: '10:00',
                clientName: ticket.client?.name || 'Client',
                clientPhone: ticket.client?.phone || '',
                reason: 'Récupération',
                notes: `Rendez-vous de récupération après réparation (Fiche ${ticket.id}). Devis approuvé.`,
                ticketId: ticket.id
            });
        } catch (error) {
            console.error("Failed to auto-create appointment:", error);
        }
        
        // Close modal
        setIsDevisApprovalModalOpen(false);
    };

    const handleTogglePrintOption = async (option: 'printDiagnosticIntegrated' | 'showExpertiseB' | 'multimediaEnabled' | 'printLegalDocument' | 'printFunctionalTests' | 'printTechnicalReportP3') => {
        const newValue = !ticket[option];
        const labelMap = { 
            printDiagnosticIntegrated: 'Rapport Technique (P2)', 
            showExpertiseB: 'Expertise Électronique (P3)', 
            printFunctionalTests: 'Rapport de tests Fonctionnels (P4)',
            printTechnicalReportP3: "Rapport Fin d'Intervention (P3)",
            multimediaEnabled: 'Module Multimédia',
            printLegalDocument: 'Document Juridique'
        };
        const label = labelMap[option];
        const newHistoryEntry: HistoryEntry = { timestamp: new Date().toISOString(), user: role, action: `${newValue ? 'Inclusion' : 'Retrait'} de ${label} dans le dossier.` };
        
        const updateData: Partial<RepairTicket> = { [option]: newValue, history: [...ticket.history, newHistoryEntry] };
        
        if (option === 'printLegalDocument' && newValue && !ticket.selectedLegalTemplate) {
            updateData.selectedLegalTemplate = 'bon';
        }

        await handleUpdateWithFeedback({ ...ticket, ...updateData }, 'basculer option');
    };

    const handleSelectLegalTemplate = async (templateId: LegalTemplateId) => {
        const updatedTicket = { 
            ...ticket, 
            selectedLegalTemplate: templateId,
            history: [
                ...ticket.history, 
                { timestamp: new Date().toISOString(), user: role as Role, action: `Changement de modèle juridique : ${templateId}` }
            ]
        };
        await handleUpdateWithFeedback(updatedTicket, 'changer template juridique');
    };

    const handleNotified = async (notificationType: string) => {
        const now = new Date().toISOString();
        const newHistoryEntry: HistoryEntry = { timestamp: now, user: role as Role, action: `Notification client envoyée : ${notificationType}` };
        await handleUpdateWithFeedback({ ...ticket, lastNotifiedAt: now, history: [...ticket.history, newHistoryEntry] }, 'enregistrer notification');
    };

    const handleSaveWarrantyReport = async () => {
        const newHistoryEntry: HistoryEntry = { timestamp: new Date().toISOString(), user: role as Role, action: `Mise à jour complète du Suivi SAV / Garantie` };
        const updatedTicket: RepairTicket = { 
            ...ticket, 
            warrantyInterventionReport: warrantyReportText, 
            reInterventionReceiptDate,
            reInterventionReason: reInterventionReasonText,
            savDiagnosis: savDiagnosisText,
            savNewRdvDate,
            savNextRdvDate,
            savNextRdvNotes,
            updatedAt: new Date().toISOString(), 
            history: [...ticket.history, newHistoryEntry] 
        };
        await handleUpdateWithFeedback(updatedTicket, 'sauvegarder rapport SAV');
        setIsEditingWarrantyReport(false);
    };

    const handleSaveExpertise = async (data: DiagnosticSheetBData) => {
        const updatedTicket: RepairTicket = { 
            ...ticket, 
            diagnosticSheetB: data, 
            updatedAt: new Date().toISOString(),
            showExpertiseB: true 
        };
        await handleUpdateWithFeedback(updatedTicket, 'enregistrer l\'expertise');
        setIsExpertiseModalOpen(false);
    };

    const handleSaveTechnicalReport = async (updatedFields: Record<string, string>, technicalReport?: TechnicalInterventionReport) => {
        const reportLevel = technicalReport?.level || 'expert_p3';
        const levelLabel = reportLevel === 'express' ? 'Niveau 1 Express' : reportLevel === 'standard' ? 'Niveau 2 Standard' : 'Niveau 3 Expert P3';
        const newHistoryEntry: HistoryEntry = {
            timestamp: new Date().toISOString(),
            user: role === 'admin' ? 'Administrateur' : 'Technicien',
            action: `Mise à jour du Rapport Technique (${levelLabel})`
        };
        const updatedTicket: RepairTicket = {
            ...ticket,
            customFields: updatedFields,
            ...(technicalReport ? { technicalReport } : {}),
            printTechnicalReportP3: true,
            updatedAt: new Date().toISOString(),
            history: [...ticket.history, newHistoryEntry]
        };
        await handleUpdateWithFeedback(updatedTicket, 'sauvegarder le rapport technique');
    };
    
    const totalCost = (ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0);
    const balance = Math.abs(totalCost - (ticket.costs.advance || 0));

    const hasDiagnosticData = !!(ticket.diagnosticReport?.length || ticket.customFields?.diagnostic || ticket.customFields?.constatsParticuliers);
    const hasExpertiseBData = !!ticket.diagnosticSheetB;

    const handleWhatsApp = () => {
        setIsWhatsAppShareOpen(true);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 pb-32 animate-fade-in">
            {/* Action Bar */}
            <div className="apple-card p-3 md:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 sticky top-20 z-40 glass shadow-2xl transition-all">
                <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-xl transition-all shrink-0">
                        <ArrowLeftIcon className="w-5 h-5 md:w-6 h-6" />
                    </button>
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                            <h2 className="text-sm md:text-xl font-black tracking-tighter uppercase text-white truncate">{ticket.id}</h2>
                            <button
                                type="button"
                                onClick={handleOpenRegularizeModal}
                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                title="Modifier ou régulariser le numéro de dossier"
                            >
                                <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                            {ticket.isReIntervention && (
                                <span className="px-2 py-0.5 bg-red-600 text-white text-[8px] font-black uppercase rounded shadow-lg animate-pulse shrink-0">RÉ-INTERVENTION</span>
                            )}
                            {ticket.isReopenedAfterCancellation && (
                                <span className="px-2 py-0.5 bg-amber-600 text-white text-[8px] font-black uppercase rounded shadow-lg shrink-0">RETOUR ANNULATION</span>
                            )}
                            <div className="relative group shrink-0">
                                <select 
                                    value={ticket.status}
                                    onChange={(e) => handleStatusChange(e.target.value as RepairStatus)}
                                    disabled={isUpdating}
                                    className={`appearance-none pl-3 pr-8 py-0.5 md:py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer outline-none ${
                                        getStatusStyle(ticket.status).selectBadge
                                    }`}
                                >
                                    {Object.values(RepairStatus).map(s => (
                                        <option key={s} value={s} className="bg-apple-surface text-white">{s}</option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                            </div>
                        </div>
                        <p className="text-[10px] md:text-xs text-slate-400 font-bold mt-1">
                            Fiche créée le : {new Date(ticket.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                    {/* Desktop Action Buttons - Hidden on mobile because they are in the fixed bar */}
                    <div className="hidden md:flex items-center gap-2">
                        {(ticket.status === RepairStatus.TERMINE || ticket.status === RepairStatus.RENDU) && (
                            <button
                                onClick={async () => {
                                    if (!ticket.printFunctionalTests) {
                                        await handleTogglePrintOption('printFunctionalTests');
                                    }
                                    setPreviewType('standard');
                                    setIsPreviewOpen(true);
                                }}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] md:text-[10px] font-black rounded-xl transition-all border border-emerald-500/20 uppercase tracking-widest flex items-center gap-1.5 md:gap-2 shadow-lg shadow-emerald-900/20 shrink-0"
                            >
                                <CheckBadgeIcon className="w-3.5 h-3.5 md:w-4 h-4"/> <span className="hidden xs:inline">Certifier Sortie</span><span className="xs:hidden">Sortie</span>
                            </button>
                        )}
                        
                        <button onClick={() => setNotificationModalOpen(true)} className="px-3 py-2 bg-green-600/10 hover:bg-green-600/20 text-green-400 text-[9px] md:text-[10px] font-black rounded-xl transition-all border border-green-500/20 uppercase tracking-widest flex items-center gap-1.5 md:gap-2 shrink-0">
                            <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 md:w-4 h-4"/> <span className="hidden xs:inline">Notifier</span>
                        </button>
                        <button onClick={handleWhatsApp} className="px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-[9px] md:text-[10px] font-black rounded-xl transition-all border border-emerald-500/20 uppercase tracking-widest flex items-center gap-1.5 md:gap-2 shrink-0">
                            <WhatsAppIcon className="w-3.5 h-3.5 md:w-4 h-4 text-emerald-500"/> <span className="hidden xs:inline">WhatsApp</span>
                        </button>
                        <button onClick={() => { setPreviewType('standard'); setIsPreviewOpen(true); }} className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] md:text-[10px] font-black rounded-xl transition-all border border-white/10 uppercase tracking-widest flex items-center gap-1.5 md:gap-2 shrink-0">
                            <PrinterIcon className="w-3.5 h-3.5 md:w-4 h-4"/> <span className="hidden xs:inline">Imprimer</span>
                        </button>
                        <button onClick={() => { setPreviewType('p3_report'); setIsPreviewOpen(true); }} className="px-3 py-2 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 text-[9px] md:text-[10px] font-black rounded-xl transition-all uppercase tracking-widest flex items-center gap-1.5 md:gap-2 shrink-0" title="Générer le Rapport de Fin d'Intervention (P3) officiel TGS-CI">
                            <DocumentMagnifyingGlassIcon className="w-3.5 h-3.5 md:w-4 h-4 text-emerald-400"/> <span className="hidden xs:inline">Rapport P3 (PDF)</span><span className="xs:hidden">Rapport P3</span>
                        </button>
                        <button onClick={() => setIsExpertiseModalOpen(true)} className="px-3 py-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 text-[9px] md:text-[10px] font-black rounded-xl transition-all border border-purple-500/20 uppercase tracking-widest flex items-center gap-1.5 md:gap-2 shrink-0">
                            <WrenchScrewdriverIcon className="w-3.5 h-3.5 md:w-4 h-4 text-purple-500"/> <span className="hidden xs:inline">Expertise P3</span>
                        </button>
                        <button 
                            onClick={() => {
                                const url = new URL(window.location.href);
                                url.searchParams.set('role', 'engagementssav');
                                url.searchParams.set('action', 'create');
                                if (ticket.id) url.searchParams.set('numeroFicheOrigine', ticket.id);
                                if (ticket.clientName) url.searchParams.set('nomClient', ticket.clientName);
                                if (ticket.clientPhone) url.searchParams.set('telephoneClient', ticket.clientPhone);
                                if (ticket.macModel) url.searchParams.set('appareil', ticket.macModel);
                                window.history.pushState({}, '', url);
                                window.dispatchEvent(new PopStateEvent('popstate'));
                            }}
                            className="px-3 py-2 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 text-[9px] md:text-[10px] font-black rounded-xl transition-all border border-amber-500/20 uppercase tracking-widest flex items-center gap-1.5 md:gap-2 shrink-0"
                            title="Créer un engagement SAV pour ce dossier"
                        >
                            <PlusCircleIcon className="w-3.5 h-3.5 md:w-4 h-4 text-amber-500" />
                            <span>Contrat SAV</span>
                        </button>
                        {onEdit && (
                            <button onClick={() => onEdit(ticket)} className="px-4 py-2 btn-apple-primary flex items-center gap-1.5 md:gap-2 shadow-xl shadow-blue-500/20 text-[9px] md:text-[10px] uppercase shrink-0">
                                <PencilIcon className="w-3.5 h-3.5 md:w-4 h-4"/> <span className="hidden xs:inline">Modifier</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Banner de régularisation si ID provisoire détecté */}
            {isFallbackTicketId(ticket.id) && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 md:p-5 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl shrink-0">
                            <ExclamationTriangleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-amber-300 uppercase tracking-tight">Numéro de dossier provisoire détecté</h4>
                                <span className="px-2 py-0.5 bg-amber-500/30 text-amber-200 text-[9px] font-black uppercase rounded">ID temporaire : {ticket.id}</span>
                            </div>
                            <p className="text-xs text-amber-200/80 mt-1">
                                Cette fiche possède un identifiant de secours. Cliquez sur Régulariser pour lui attribuer son numéro séquentiel officiel ({new Date().getFullYear().toString().slice(-2)}-{ticket.client?.isEnterprise ? 'ENT' : 'RM'}-XXXX). Tous les rendez-vous et contrats associés seront automatiquement mis à jour.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleOpenRegularizeModal}
                        disabled={isRegularizing}
                        className="w-full md:w-auto px-5 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-amber-950/20 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        <span>Régulariser le numéro maintenant</span>
                    </button>
                </div>
            )}

            {/* Floating Action Bar - Fixed for all devices */}
            <div className="fixed bottom-0 left-0 right-0 md:bottom-8 md:right-8 md:left-auto p-4 md:p-0 bg-black/80 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none border-t md:border-none border-white/10 z-[110] flex flex-row md:flex-col gap-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] md:pb-0 justify-center md:justify-end pointer-events-auto">
                <button 
                    onClick={handleWhatsApp}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600/20 text-emerald-400 rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-emerald-900/20 group min-h-[48px] md:min-w-[180px] active:scale-95 border border-emerald-500/20"
                >
                    <WhatsAppIcon className="w-5 h-5 group-hover:scale-110 transition-transform text-emerald-500" />
                    <span>WhatsApp</span>
                </button>
                <button 
                    onClick={() => { setPreviewType('standard'); setIsPreviewOpen(true); }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-white text-black rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-white/10 group min-h-[48px] md:min-w-[180px] active:scale-95"
                >
                    <PrinterIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span>Imprimer</span>
                </button>
                <button 
                    onClick={() => { setPreviewType('p3_report'); setIsPreviewOpen(true); }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-emerald-900/30 group min-h-[48px] md:min-w-[180px] active:scale-95"
                >
                    <DocumentMagnifyingGlassIcon className="w-5 h-5 group-hover:scale-110 transition-transform text-emerald-400" />
                    <span>Rapport P3</span>
                </button>
                {onEdit && (
                    <button 
                        onClick={() => onEdit(ticket)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-apple-blue text-white rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/40 group min-h-[48px] md:min-w-[180px] active:scale-95"
                    >
                        <PencilIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span>Modifier</span>
                    </button>
                )}
            </div>

            {/* PRECISE WAITING STATUS CARD & AUTOMATIC REMINDERS */}
            {(ticket.waitingStatusLabel || ticket.status === RepairStatus.DEVIS_A_VALIDER || ticket.status === RepairStatus.EN_ATTENTE_DE_PIECES) && (
                <div className="apple-card p-4 sm:p-5 bg-gradient-to-r from-amber-950/30 via-zinc-950 to-black border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-slide-up shadow-xl shadow-amber-950/20">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                            <ClockIcon className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-widest rounded-full border border-amber-500/30">
                                    Statut Précis & 3 Rappels Actifs
                                </span>
                                {ticket.waitingFollowUpDate && (
                                    <span className="text-[10px] font-mono font-bold text-amber-300">
                                        Date cible : {ticket.waitingFollowUpDate}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-black text-white italic mt-1">
                                "{ticket.waitingStatusLabel || 'En attente — Relance ou point à planifier'}"
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setPendingWaitingStatus(ticket.status);
                            setIsWaitingStatusModalOpen(true);
                        }}
                        className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 active:scale-95 flex items-center gap-1.5"
                    >
                        <PencilIcon className="w-3.5 h-3.5" />
                        <span>Modifier l'attente / date</span>
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                {/* COLONNE GAUCHE (DÉTAILS TECHNIQUES) */}
                <div className="lg:col-span-8 space-y-4 md:space-y-6">
                    {/* SECTION EXPERTISE ÉLECTRONIQUE SI PRÉSENTE */}
                    {ticket.diagnosticSheetB && (
                        <div className="apple-card p-6 md:p-8 border-purple-500/20 overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                <SparklesIcon className="w-32 h-32 text-purple-400" />
                            </div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                    <CloudArrowDownIcon className="w-6 h-6" /> Expertise Électronique P3
                                </h3>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setIsExpertiseModalOpen(true)}
                                        className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-all"
                                        title="Éditer l'expertise"
                                    >
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Rails de Tensions</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {ticket.diagnosticSheetB.tensionValues.filter(v => v.value).map((v, i) => (
                                            <div key={i} className="bg-black/20 p-2 rounded-xl border border-white/5 flex justify-between items-center">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase truncate mr-2">{v.line}</span>
                                                <span className={`text-[10px] font-black ${v.status === 'Correct' ? 'text-green-400' : 'text-red-500'}`}>{v.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Diagnostic Technique</p>
                                    <div className="bg-black/30 p-4 rounded-2xl border border-white/5 h-[120px] overflow-y-auto custom-scrollbar">
                                        <p className="text-xs text-blue-100 whitespace-pre-wrap leading-relaxed italic">
                                            {ticket.diagnosticSheetB.visualInspection || "Aucune conclusion technique saisie."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="apple-card p-6 md:p-8">
                            <h3 className="text-[9px] md:text-[10px] font-black text-apple-muted uppercase tracking-[0.2em] mb-3 md:mb-4">Informations Client</h3>
                            <div className="flex items-center gap-3 mb-2">
                                {ticket.client.isEnterprise ? <BuildingStorefrontIcon className="w-5 h-5 text-purple-400" /> : <UserIcon className="w-5 h-5 text-apple-blue" />}
                                <p className="text-xl md:text-2xl font-black text-white uppercase tracking-tight break-words">{ticket.client.name}</p>
                            </div>
                            <p className="mt-2 text-apple-blue font-mono font-bold text-base md:text-lg">{ticket.client.phone}</p>
                            {ticket.client.isEnterprise && ticket.customFields?.deposantName && (
                                <p className="text-[10px] text-slate-400 mt-2 uppercase font-black">Déposant : {ticket.customFields.deposantName} ({ticket.customFields.deposantFunction || 'Contact'})</p>
                            )}
                        </div>

                        <div className="apple-card p-6 md:p-8">
                            <h3 className="text-[9px] md:text-[10px] font-black text-apple-muted uppercase tracking-[0.2em] mb-3 md:mb-4">Détails Appareil & Accessoires</h3>
                            <div className="flex items-center gap-3 mb-2">
                                <MacbookIcon className="w-5 h-5 text-apple-blue" />
                                <div className="flex flex-col">
                                    <p className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">{ticket.macBrand} {ticket.macModel}</p>
                                    <p className="text-[10px] font-mono font-bold text-apple-muted mt-0.5">
                                        {ticket.modelNumber && <span className="text-blue-400 mr-2 uppercase">MODÈLE : {ticket.modelNumber}</span>}
                                        {ticket.macColor && <span className="text-slate-400 mr-2 uppercase">| {ticket.macColor}</span>}
                                    </p>
                                    <p className="text-[10px] font-mono font-bold text-slate-500 mt-1 uppercase">S/N: {ticket.serialNumber || 'NON SPÉCIFIÉ'}</p>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${ticket.powersOn ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'} border border-white/5`}>
                                    S'allume: {ticket.powersOn ? "OUI" : "NON"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION RETOUR APRÈS ANNULATION */}
                    {ticket.isReopenedAfterCancellation && (
                        <div className="apple-card p-8 bg-amber-950/25 border border-amber-500/30">
                            <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-[0.3em] flex items-center gap-3 mb-6">
                                <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" /> Retour après Annulation
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <p className="text-[9px] font-black text-amber-400 uppercase mb-1">Date du Retour de l'appareil</p>
                                    <p className="text-sm font-bold text-white font-mono">
                                        {ticket.cancellationReturnDate ? new Date(ticket.cancellationReturnDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Non définie'}
                                    </p>
                                </div>
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <p className="text-[9px] font-black text-amber-400 uppercase mb-1">Motif / Notes de Retour</p>
                                    <p className="text-sm font-semibold text-slate-200">
                                        {ticket.cancellationReturnNotes || "Aucune note saisie pour ce retour."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION SAV / GARANTIE (VISIBLE SEULEMENT SI RE-INTERVENTION) */}
                    {ticket.isReIntervention && (
                        <div className="apple-card p-8 bg-red-950/20 border-red-500/30">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[10px] font-black text-red-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                    <ExclamationTriangleIcon className="w-6 h-6 animate-pulse text-red-500" /> Suivi SAV / Garantie
                                </h3>
                                <div className="flex gap-2">
                                    {ticket.warrantyInterventionReport && (
                                        <button 
                                            onClick={() => { setPreviewType('standard'); setIsPreviewOpen(true); }}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-red-900/40 transition-all flex items-center gap-2"
                                        >
                                            <PrinterIcon className="w-4 h-4" /> Rapport SAV
                                        </button>
                                    )}
                                    {!isEditingWarrantyReport && (
                                        <button 
                                            onClick={() => setIsEditingWarrantyReport(true)}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                        >
                                            <PencilIcon className="w-4 h-4" /> Mettre à jour
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {isEditingWarrantyReport ? (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[9px] font-black text-red-300 uppercase mb-1.5">Date de Réception SAV *</label>
                                            <input 
                                                type="date"
                                                value={reInterventionReceiptDate}
                                                onChange={(e) => setReInterventionReceiptDate(e.target.value)}
                                                className="w-full p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all font-mono text-xs"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black text-red-300 uppercase mb-1.5">Motif du Retour Déclaré par le Client *</label>
                                            <input 
                                                type="text"
                                                value={reInterventionReasonText}
                                                onChange={(e) => setReInterventionReasonText(e.target.value)}
                                                className="w-full p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all text-xs"
                                                required
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[9px] font-black text-red-300 uppercase mb-1.5">Diagnostic SAV & Cause de la Nouvelle Intervention</label>
                                            <textarea 
                                                value={savDiagnosisText}
                                                onChange={(e) => setSavDiagnosisText(e.target.value)}
                                                rows={2}
                                                placeholder="Saisir le diagnostic SAV..."
                                                className="w-full p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black text-red-300 uppercase mb-1.5">Nouvelle date de RDV</label>
                                            <input 
                                                type="date"
                                                value={savNewRdvDate}
                                                onChange={(e) => setSavNewRdvDate(e.target.value)}
                                                className="w-full p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all font-mono text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black text-red-300 uppercase mb-1.5">Prochain rendez-vous (Facultatif / Attente de pièce)</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="date"
                                                    value={savNextRdvDate}
                                                    onChange={(e) => setSavNextRdvDate(e.target.value)}
                                                    className="p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all font-mono text-xs w-1/2"
                                                />
                                                <input 
                                                    type="text"
                                                    value={savNextRdvNotes}
                                                    onChange={(e) => setSavNextRdvNotes(e.target.value)}
                                                    placeholder="Ex: Attente écran"
                                                    className="p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all text-xs w-1/2"
                                                />
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[9px] font-black text-red-300 uppercase mb-1.5">Actions Correctives (Technicien)</label>
                                            <textarea 
                                                value={warrantyReportText}
                                                onChange={(e) => setWarrantyReportText(e.target.value)}
                                                rows={3}
                                                placeholder="Détaillez les actions correctives effectuées..."
                                                className="w-full p-3 bg-black/40 border border-red-500/30 rounded-xl text-white outline-none focus:border-red-500 transition-all text-xs"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button onClick={() => setIsEditingWarrantyReport(false)} className="px-4 py-2 text-slate-400 hover:text-white text-xs font-bold uppercase">Annuler</button>
                                        <button onClick={handleSaveWarrantyReport} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase">Valider le Suivi SAV</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                        <p className="text-[9px] font-black text-red-400 uppercase mb-1">Date de Réception SAV</p>
                                        <p className="text-sm font-bold text-white font-mono">
                                            {ticket.reInterventionReceiptDate ? new Date(ticket.reInterventionReceiptDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : (ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Non définie')}
                                        </p>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                        <p className="text-[9px] font-black text-red-400 uppercase mb-1">Motif du Retour (Déclaration Client)</p>
                                        <p className="text-sm font-medium text-white italic">
                                            "{ticket.reInterventionReason || 'Non spécifié'}"
                                        </p>
                                    </div>
                                    <div className="md:col-span-2 bg-black/20 p-4 rounded-xl border border-white/5">
                                        <p className="text-[9px] font-black text-red-400 uppercase mb-1">Diagnostic SAV & Cause de la Ré-intervention</p>
                                        <p className="text-sm font-semibold text-slate-200">
                                            {ticket.savDiagnosis || 'Aucun diagnostic SAV saisi pour le moment.'}
                                        </p>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                        <p className="text-[9px] font-black text-red-400 uppercase mb-1">Nouvelle Date de RDV</p>
                                        <p className="text-sm font-bold text-white font-mono">
                                            {ticket.savNewRdvDate ? new Date(ticket.savNewRdvDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Non programmée'}
                                        </p>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                        <p className="text-[9px] font-black text-red-400 uppercase mb-1">Prochain rendez-vous / Attente Pièce</p>
                                        <div className="flex flex-col">
                                            <p className="text-sm font-bold text-white font-mono">
                                                {ticket.savNextRdvDate ? new Date(ticket.savNextRdvDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Aucune date'}
                                            </p>
                                            {ticket.savNextRdvNotes && (
                                                <p className="text-xs text-red-300 mt-1 font-bold">
                                                    📌 {ticket.savNextRdvNotes}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 bg-white/5 p-4 rounded-xl border border-white/5 hover:border-red-500/20 transition-all cursor-pointer group" onClick={() => setIsEditingWarrantyReport(true)}>
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Actions Correctives (Technicien)</p>
                                            <PencilIcon className="w-4 h-4 text-slate-600 group-hover:text-red-400 transition-colors" />
                                        </div>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                                            {ticket.warrantyInterventionReport || "Cliquez pour rédiger les actions correctives effectuées..."}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SECTION DIAGNOSTIC - NOUVEAU RENDU VISUEL */}
                    {(hasDiagnosticData || hasExpertiseBData) && (
                        <div className="apple-card p-8 bg-purple-900/10 border-purple-500/30">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                    <DocumentMagnifyingGlassIcon className="w-6 h-6" /> Expertise & Diagnostic Validés
                                </h3>
                                <div className="flex gap-2">
                                    {hasDiagnosticData && (
                                        <button 
                                            onClick={() => { setPreviewType('standard'); setIsPreviewOpen(true); }}
                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/40 transition-all flex items-center gap-2"
                                        >
                                            <PrinterIcon className="w-4 h-4" /> Rapport P2
                                        </button>
                                    )}
                                    {hasExpertiseBData && (
                                        <button 
                                            onClick={() => { setPreviewType('standard'); setIsPreviewOpen(true); }}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/40 transition-all flex items-center gap-2"
                                        >
                                            <ClipboardDocumentListIcon className="w-4 h-4" /> Expertise P3
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {ticket.customFields?.constatsParticuliers && (
                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase mb-2">Observations Physiques</p>
                                        <p className="text-xs text-slate-200 italic">"{ticket.customFields.constatsParticuliers}"</p>
                                    </div>
                                )}
                                {ticket.customFields?.diagnostic && (
                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase mb-2">Conclusion Technique</p>
                                        <p className="text-xs text-slate-200 italic">"{ticket.customFields.diagnostic}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* SECTION RAPPORT TECHNIQUE DE FIN D'INTERVENTION (3 NIVEAUX) */}
                    <div className="apple-card p-6 md:p-8 bg-emerald-950/15 border-emerald-500/20">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                        <DocumentMagnifyingGlassIcon className="w-5 h-5 text-emerald-400" /> 
                                        Rapport de Fin d'Intervention & Expertise
                                    </h3>
                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[8px] font-black uppercase rounded-md border border-emerald-500/30">
                                        {ticket.technicalReport?.level === 'express' ? 'Niveau 1 · Express' :
                                         ticket.technicalReport?.level === 'standard' ? 'Niveau 2 · Standard' :
                                         'Niveau 3 · Expert P3'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    Document officiel TGS-CI (Niveau modulable selon le cas client)
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => { setPreviewType('p3_report'); setIsPreviewOpen(true); }}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                                >
                                    <PrinterIcon className="w-3.5 h-3.5 text-emerald-400" /> Aperçu P3
                                </button>
                                <button 
                                    onClick={() => setIsTechReportModalOpen(true)}
                                    className="px-3 py-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                                >
                                    <PencilIcon className="w-3.5 h-3.5 text-emerald-400" /> Configurer / Modifier
                                </button>
                            </div>
                        </div>
                        
                        {ticket.technicalReport ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-black/30 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-wider mb-1.5">
                                            1. Interventions réalisées
                                        </p>
                                        <p className="text-xs text-slate-200 whitespace-pre-line font-mono">
                                            {ticket.technicalReport.interventionsDone || "Remplacement des composants validé."}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-black/30 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-wider mb-1.5">
                                            2. Résultat
                                        </p>
                                        <p className="text-xs text-slate-200 whitespace-pre-line font-mono">
                                            {ticket.technicalReport.result || "Machine fonctionnelle."}
                                        </p>
                                    </div>
                                </div>

                                {ticket.technicalReport.importantNotes && (
                                    <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                                        <p className="text-[8px] font-black text-amber-400 uppercase tracking-wider mb-1">
                                            ⚠ 5. Important — Précautions & Suivi
                                        </p>
                                        <p className="text-xs text-amber-200/90 whitespace-pre-line font-mono">
                                            {ticket.technicalReport.importantNotes}
                                        </p>
                                    </div>
                                )}

                                {(ticket.technicalReport.retraitDateInfo || ticket.technicalReport.nextRdvInfo) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        {ticket.technicalReport.retraitDateInfo && (
                                            <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                                                <p className="text-[8px] font-black text-slate-400 uppercase">📅 Retrait de la machine</p>
                                                <p className="text-[11px] text-slate-200 font-bold mt-0.5">{ticket.technicalReport.retraitDateInfo}</p>
                                            </div>
                                        )}
                                        {ticket.technicalReport.nextRdvInfo && (
                                            <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                                                <p className="text-[8px] font-black text-slate-400 uppercase">🔄 Prochain rendez-vous</p>
                                                <p className="text-[11px] text-slate-200 font-bold mt-0.5">{ticket.technicalReport.nextRdvInfo}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-4 bg-black/30 rounded-2xl border border-white/5 flex flex-col justify-between">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-500 uppercase mb-2">🔬 Verdict Interne</p>
                                        <p className="text-xs text-slate-300 italic whitespace-pre-wrap">
                                            "{ticket.customFields?.technicalVerdict || "Le diagnostic standard complet a été réalisé et validé par notre équipe de techniciens certifiés."}"
                                        </p>
                                    </div>
                                </div>
                                <div className="p-4 bg-black/30 rounded-2xl border border-white/5 flex flex-col justify-between">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-500 uppercase mb-2">⚡ Contrôles & Mesures Réalisés</p>
                                        <p className="text-xs text-slate-300 italic whitespace-pre-wrap">
                                            "{ticket.customFields?.technicalMeasures || "Symptômes d'oxydation et court-circuits analysés sur le microscope technique. Aucune tension anormale n'affecte la puce SMC / T2 / M-Series."}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="apple-card p-6 md:p-8 border-2 border-emerald-500/10 bg-emerald-500/5">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[9px] md:text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <WrenchScrewdriverIcon className="w-5 h-5" /> Pièces & Matériel Assignés
                            </h3>
                            <div className="flex gap-2">
                                <button onClick={() => setStockUsageOpen(true)} className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2">
                                    <PlusCircleIcon className="w-4 h-4" /> Prélever Stock
                                </button>
                                <button onClick={() => setExternalPurchaseOpen(true)} className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2">
                                    <ShoppingCartIcon className="w-4 h-4" /> Achat Confrère
                                </button>
                            </div>
                        </div>
                        
                        {(usedParts.length > 0 || externalParts.length > 0) ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {usedParts.map(part => (
                                    <div key={part.id} className="p-4 bg-black/40 border border-white/5 rounded-2xl flex justify-between items-center group">
                                        <div className="overflow-hidden">
                                            <p className="text-xs font-black text-white uppercase truncate">{part.stockName || "Pièce Inconnue"}</p>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase">Stock interne • {new Date(part.date).toLocaleDateString('fr-FR')}</p>
                                        </div>
                                        <span className="px-3 py-1 bg-emerald-600/20 text-emerald-400 rounded-lg text-xs font-black shrink-0 ml-3">
                                            x {part.quantite_utilisee}
                                        </span>
                                    </div>
                                ))}
                                {externalParts.map(p => (
                                    <div key={p.id} className="p-4 bg-blue-900/20 border border-blue-500/20 rounded-2xl flex justify-between items-center group">
                                        <div className="overflow-hidden">
                                            <p className="text-xs font-black text-white uppercase truncate">{p.item_name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[8px] px-1.5 py-0.5 bg-blue-600 text-white rounded font-black uppercase tracking-tighter">EXTERNE</span>
                                                <p className="text-[9px] text-blue-400 font-bold uppercase truncate">{p.collaborator_name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-[10px] font-black text-emerald-400">{(p.sale_price - p.purchase_price).toLocaleString()} F</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-10 text-center border-2 border-dashed border-white/10 rounded-3xl opacity-30">
                                <p className="text-[10px] font-black uppercase tracking-widest italic">Aucun prélèvement stock ou achat confrère</p>
                            </div>
                        )}
                    </div>

                    <div className="apple-card p-6 md:p-8">
                        <h3 className="text-[9px] md:text-[10px] font-black text-apple-muted uppercase tracking-[0.2em] mb-5 md:mb-6">DÉSIGNATION DES PRESTATIONS</h3>
                        <div className="space-y-2 md:space-y-3">
                            <div className="flex justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                <span className="text-sm font-bold text-apple-muted uppercase tracking-wider">Expertise & Diagnostic</span>
                                <span className="text-sm font-mono font-black text-white">{(ticket.costs.diagnostic || 0).toLocaleString()} F</span>
                            </div>
                            {ticket.services.map((s, i) => (
                                <div key={i} className="flex justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-apple-blue/30 transition-all">
                                    <span className="text-sm font-black text-white uppercase tracking-tight truncate mr-2">{s.name}</span>
                                    <span className="text-sm font-mono font-black text-white shrink-0">{s.price.toLocaleString()} F</span>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/5">
                            <div className="text-center p-4 bg-green-500/5 rounded-2xl border border-green-500/10">
                                <p className="text-[8px] md:text-[9px] font-black text-green-500 uppercase mb-1">Acompte Perçu</p>
                                <p className="text-xl md:text-2xl font-black text-green-400">{ticket.costs.advance.toLocaleString()} F</p>
                            </div>
                            <div className="text-center p-4 bg-apple-blue/10 rounded-2xl border border-apple-blue/20">
                                <p className="text-[8px] md:text-[9px] font-black text-apple-blue uppercase mb-1">SOLDE À RÉGLER</p>
                                <p className="text-xl md:text-3xl font-black text-white tracking-tighter">{balance.toLocaleString()} F</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-4 md:space-y-6">
                    <div className="apple-card p-5 md:p-6 border-2 border-apple-blue/20">
                        <h3 className="text-[9px] md:text-[10px] font-black text-apple-blue uppercase tracking-[0.2em] mb-4">Composition du Dossier (Export)</h3>
                        <div className="space-y-2">
                             <button onClick={() => handleTogglePrintOption('printDiagnosticIntegrated')} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${ticket.printDiagnosticIntegrated ? 'bg-blue-600/10 border-blue-500/30' : 'bg-white/5 border-white/5 opacity-60'}`}>
                                <div className="flex items-center gap-3"><DocumentMagnifyingGlassIcon className={`w-5 h-5 ${ticket.printDiagnosticIntegrated ? 'text-blue-400' : 'text-slate-600'}`} /><div className="text-left"><p className={`text-[10px] font-black uppercase ${ticket.printDiagnosticIntegrated ? 'text-white' : 'text-slate-400'}`}>Rapport Technique (P2)</p></div></div>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${ticket.printDiagnosticIntegrated ? 'bg-blue-600 border-blue-500' : 'border-slate-700'}`}>{ticket.printDiagnosticIntegrated && <span className="text-[8px] text-white">✓</span>}</div>
                             </button>
                             <button onClick={() => handleTogglePrintOption('showExpertiseB')} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${ticket.showExpertiseB ? 'bg-purple-600/10 border-purple-500/30' : 'bg-white/5 border-white/5 opacity-60'}`}>
                                <div className="flex items-center gap-3"><ClipboardDocumentListIcon className={`w-5 h-5 ${ticket.showExpertiseB ? 'text-purple-400' : 'text-slate-600'}`} /><div className="text-left"><p className={`text-[10px] font-black uppercase ${ticket.showExpertiseB ? 'text-white' : 'text-slate-400'}`}>Expertise Électronique (P3)</p></div></div>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${ticket.showExpertiseB ? 'bg-purple-600 border-purple-500' : 'border-slate-700'}`}>{ticket.showExpertiseB && <span className="text-[8px] text-white">✓</span>}</div>
                             </button>
                             <button onClick={() => handleTogglePrintOption('printFunctionalTests')} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${ticket.printFunctionalTests ? 'bg-green-600/10 border-green-500/30' : 'bg-white/5 border-white/5 opacity-60'}`}>
                                <div className="flex items-center gap-3"><CheckBadgeIcon className={`w-5 h-5 ${ticket.printFunctionalTests ? 'text-green-400' : 'text-slate-600'}`} /><div className="text-left"><p className={`text-[10px] font-black uppercase ${ticket.printFunctionalTests ? 'text-white' : 'text-slate-400'}`}>Tests Fonctionnels Fin (P4)</p></div></div>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${ticket.printFunctionalTests ? 'bg-green-600 border-green-500' : 'border-slate-700'}`}>{ticket.printFunctionalTests && <span className="text-[8px] text-white">✓</span>}</div>
                             </button>
                             <button onClick={() => handleTogglePrintOption('printTechnicalReportP3')} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${ticket.printTechnicalReportP3 ? 'bg-emerald-600/10 border-emerald-500/30' : 'bg-white/5 border-white/5 opacity-60'}`}>
                                <div className="flex items-center gap-3"><DocumentMagnifyingGlassIcon className={`w-5 h-5 ${ticket.printTechnicalReportP3 ? 'text-emerald-400' : 'text-slate-600'}`} /><div className="text-left"><p className={`text-[10px] font-black uppercase ${ticket.printTechnicalReportP3 ? 'text-white' : 'text-slate-400'}`}>Rapport Fin d'Intervention (P3)</p></div></div>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${ticket.printTechnicalReportP3 ? 'bg-emerald-600 border-emerald-500' : 'border-slate-700'}`}>{ticket.printTechnicalReportP3 && <span className="text-[8px] text-white">✓</span>}</div>
                             </button>
                             <div className="space-y-1">
                                <button onClick={() => handleTogglePrintOption('printLegalDocument')} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${ticket.printLegalDocument ? 'bg-amber-600/10 border-amber-500/30' : 'bg-white/5 border-white/5 opacity-60'}`}>
                                    <div className="flex items-center gap-3"><LegalIcon className={`w-5 h-5 ${ticket.printLegalDocument ? 'text-amber-400' : 'text-slate-600'}`} /><div className="text-left"><p className={`text-[10px] font-black uppercase ${ticket.printLegalDocument ? 'text-white' : 'text-slate-400'}`}>Document Juridique</p></div></div>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${ticket.printLegalDocument ? 'bg-amber-600 border-amber-500' : 'border-slate-700'}`}>{ticket.printLegalDocument && <span className="text-[8px] text-white">✓</span>}</div>
                                </button>
                                {ticket.printLegalDocument && (
                                    <div className="px-2 py-3 bg-amber-600/5 rounded-xl border border-amber-500/10 mt-1 animate-slide-up">
                                        <label className="block text-[8px] font-black text-amber-500 uppercase tracking-widest mb-2 ml-1">Modèle de document</label>
                                        <div className="flex flex-col gap-1">
                                            {[
                                                { id: 'bon', label: 'Bon de Dépôt / Sortie' },
                                                { id: 'attestation', label: 'Attestation de Réparation' },
                                                { id: 'cession', label: 'Acte de Cession' }
                                            ].map(opt => (
                                                <button 
                                                    key={opt.id}
                                                    onClick={() => handleSelectLegalTemplate(opt.id as LegalTemplateId)}
                                                    className={`text-left px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all ${ticket.selectedLegalTemplate === opt.id ? 'bg-amber-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                    
                    <div className="apple-card p-5 md:p-6 bg-white/[0.02]">
                        <h3 className="text-[9px] md:text-[10px] font-black text-apple-muted uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                            Symptômes déclarés
                            {ticket.isReIntervention && <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />}
                        </h3>
                        <div className="text-sm font-medium text-blue-100 italic leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">
                            "{ticket.problemDescription}"
                        </div>
                        {ticket.isReIntervention && (
                            <div className="mt-3 p-3 bg-red-900/20 border border-red-500/20 rounded-xl">
                                <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-1">Information Traçabilité</p>
                                <p className="text-[10px] text-red-300 font-bold italic">Cet appareil est revenu pour une ré-intervention sur une panne déjà traitée.</p>
                            </div>
                        )}
                    </div>

                    <div className="apple-card p-5 md:p-6">
                        <h3 className="text-[9px] md:text-[10px] font-black text-apple-muted uppercase tracking-[0.2em] mb-5 md:mb-6 flex items-center justify-between">
                            Historique Traçabilité
                            <ClockIcon className="w-4 h-4 text-slate-500" />
                        </h3>
                        <div className="space-y-4 md:space-y-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {[...ticket.history].reverse().map((entry, idx) => (
                                <div key={idx} className="pl-4 border-l-2 border-white/10 pb-4 relative">
                                    <div className="absolute w-2 h-2 rounded-full bg-apple-blue -left-[5px] top-1 shadow-[0_0_8px_#0071e3]"></div>
                                    <p className="text-[11px] font-black text-white uppercase tracking-tight">{entry.action}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-[9px] text-apple-muted uppercase font-black">{entry.user}</p>
                                        <span className="text-[8px] text-slate-700">•</span>
                                        <p className="text-[9px] text-apple-muted font-bold flex items-center gap-1">
                                            <CalendarDaysIcon className="w-3 h-3 opacity-40" /> {new Date(entry.timestamp).toLocaleDateString('fr-FR')}
                                            <ClockIcon className="w-3 h-3 opacity-40 ml-1" /> {new Date(entry.timestamp).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {isPostponeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="apple-card w-full max-w-md p-6 bg-gray-900 border border-white/10 rounded-3xl shadow-2xl relative space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-lg font-black tracking-tight text-white uppercase">Préciser le délai du report</h3>
                            <p className="text-xs text-apple-muted">Sélectionnez le nombre de jours ou choisissez une date personnalisée dans le calendrier.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-apple-muted mb-2">Options rapides (Jours)</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[5, 10, 20, 30, 40].map((days) => (
                                        <button
                                            key={days}
                                            type="button"
                                            onClick={() => {
                                                setPostponeDays(days);
                                                setPostponeDate('');
                                            }}
                                            className={`py-2 rounded-xl text-xs font-black transition-all ${
                                                postponeDays === days && !postponeDate
                                                ? 'bg-amber-500 text-black border border-amber-400 font-extrabold'
                                                : 'bg-white/5 text-white border border-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            {days}j
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative py-2 flex items-center justify-center">
                                <span className="text-[10px] bg-gray-900 px-3 py-1 font-black text-slate-500 select-none tracking-widest uppercase border border-white/5 rounded-full">OU</span>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Choisir une date précise</label>
                                <input
                                    type="date"
                                    value={postponeDate}
                                    onChange={(e) => {
                                        setPostponeDate(e.target.value);
                                        setPostponeDays(0);
                                    }}
                                    className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-white font-mono font-bold outline-none focus:border-amber-500 transition-all cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsPostponeModalOpen(false)}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmPostpone}
                                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-950/20"
                            >
                                Confirmer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE VALIDATION DE DEVIS AVEC PLANIFICATION DE RDV */}
            {isDevisApprovalModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full space-y-6 shadow-2xl animate-scale-up">
                        <div className="flex items-center gap-3 text-emerald-400">
                            <CheckBadgeIcon className="w-8 h-8 shrink-0" />
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-wider">Validation de Devis</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Planification du rendez-vous client</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Nombre de jours pour la réparation</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[1, 2, 3, 5, 7].map((days) => (
                                        <button
                                            key={days}
                                            type="button"
                                            onClick={() => setRepairDays(days)}
                                            className={`py-2 rounded-xl text-xs font-black transition-all ${
                                                repairDays === days
                                                ? 'bg-emerald-500 text-black border border-emerald-400 font-extrabold'
                                                : 'bg-white/5 text-white border border-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            {days}j
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ou saisir un nombre de jours précis</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="90"
                                    value={repairDays || ''}
                                    onChange={(e) => setRepairDays(Math.max(1, parseInt(e.target.value) || 0))}
                                    className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-white font-mono font-bold outline-none focus:border-emerald-500 transition-all"
                                />
                            </div>

                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex flex-col items-center justify-center text-center space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Rendez-vous calculé de récupération</span>
                                <span className="text-base font-black text-white font-mono capitalize">
                                    {new Date(calculatedRdvDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                                <span className="text-[8px] text-slate-500 font-bold uppercase">Création automatique dans le calendrier à 10:00</span>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsDevisApprovalModalOpen(false)}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDevisApproval}
                                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-950/20"
                            >
                                Valider
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <WhatsAppShareModal 
                isOpen={isWhatsAppShareOpen}
                onClose={() => setIsWhatsAppShareOpen(false)}
                ticket={ticket}
            />

            <WaitingStatusModal
                isOpen={isWaitingStatusModalOpen}
                ticket={ticket}
                targetStatus={pendingWaitingStatus}
                onClose={() => setIsWaitingStatusModalOpen(false)}
                onConfirm={async (updatedTicket) => {
                    await handleUpdateWithFeedback(updatedTicket, 'enregistrer l\'attente et les rappels');
                }}
                role={role}
            />

            <NotificationModal isOpen={isNotificationModalOpen} onClose={() => setNotificationModalOpen(false)} ticket={ticket} onNotified={handleNotified} />
            
            {isExpertiseModalOpen && (
                <DiagnosticSheetBModal 
                    isOpen={isExpertiseModalOpen} 
                    onClose={() => setIsExpertiseModalOpen(false)} 
                    onSave={handleSaveExpertise} 
                    ticket={ticket} 
                />
            )}

            {isStockUsageOpen && <StockUsageModal isOpen={isStockUsageOpen} onClose={() => setStockUsageOpen(false)} ticket={ticket} />}
            {isExternalPurchaseOpen && <ExternalPurchaseModal isOpen={isExternalPurchaseOpen} onClose={() => setExternalPurchaseOpen(false)} ticket={ticket} />}
            {isTechReportModalOpen && (
                <TechnicalReportEditModal 
                    isOpen={isTechReportModalOpen} 
                    onClose={() => setIsTechReportModalOpen(false)} 
                    ticket={ticket} 
                    onSave={handleSaveTechnicalReport} 
                    onOpenPreview={() => {
                        setPreviewType('p3_report');
                        setIsPreviewOpen(true);
                    }}
                />
            )}

            <PreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} fileName={`TGS_DOSSIER_${ticket.id}.pdf`}>
                {previewType === 'legal' ? <PrintableLegalFolder ticket={ticket} customFieldDefs={settings.customFields.ticket} /> :
                 previewType === 'p3_report' ? <PrintableTechnicalReportP3 ticket={ticket} /> :
                 previewType === 'technical_report' ? <PrintableTechnicalReport ticket={ticket} /> : (
                    <div className="flex flex-col">
                        {/* Option d'impression spécifique pour le rapport SAV s'il est présent */}
                        {/* Toujours afficher la fiche de dépôt standard par défaut */}
                        <PrintableTicket ticket={ticket} printSettings={settings.print} customFieldDefs={settings.customFields.ticket} />
                        
                        {/* Si c'est une ré-intervention et qu'il y a un rapport, on l'ajoute à la suite */}
                        {ticket.isReIntervention && ticket.warrantyInterventionReport && (
                            <PrintableWarrantyReport ticket={ticket} />
                        )}
                        {ticket.printLegalDocument && (
                            ticket.selectedLegalTemplate === 'bon' ? <PrintableEnterpriseBon ticket={ticket} /> : 
                            <PrintableLegalDocument ticket={ticket} template={ticket.selectedLegalTemplate || 'bon'} />
                        )}
                        {ticket.printDiagnosticIntegrated && <PrintableDiagnosticReport ticket={ticket} />}
                        {ticket.showExpertiseB && <PrintableDiagnosticSheetB ticket={ticket} />}
                        {ticket.printFunctionalTests && <PrintableFunctionalTestsSheet ticket={ticket} />}
                        {ticket.printTechnicalReportP3 && <PrintableTechnicalReportP3 ticket={ticket} />}
                    </div>
                )}
            </PreviewModal>

            <RegularizeTicketModal
                isOpen={isRegularizeModalOpen}
                onClose={() => setIsRegularizeModalOpen(false)}
                ticket={ticket}
                allTickets={allTickets}
                onConfirm={handleApplyNewTicketId}
            />
        </div>
    );
};

export default RepairDetail;
