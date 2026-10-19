import React, { useState, useMemo, useEffect } from 'react';
import { 
    RepairTicket, RepairStatus 
} from '../types.ts';
import DashboardLayout, { NavItem } from './DashboardLayout.tsx';
import { 
    Clock, Phone, AlertTriangle, 
    Calendar, CheckCircle, Search, Wrench, 
    Sparkles, ChevronRight, Printer, FileText, CheckCircle2, XCircle,
    X, Eye, ArrowRight, PhoneCall, DollarSign
} from 'lucide-react';
import { WhatsAppIcon, MacbookIcon } from './icons.tsx';
import RepairDetail from './RepairDetail.tsx';
import RepairForm from './RepairForm.tsx';
import EnterpriseRepairForm from './EnterpriseRepairForm.tsx';
import TechnicalBlockageModal from './TechnicalBlockageModal.tsx';
import ActionsDuJourView from './ActionsDuJourView.tsx';
import AppointmentCalendarView from './AppointmentCalendarView.tsx';
import TicketFinancialPointManager from './TicketFinancialPointManager.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableBlockageNote from './PrintableBlockageNote.tsx';
import { useToastContext } from '../context/ToastContext.tsx';
import { formatWhatsAppPhone, generateWhatsAppUrl, formatDisplayDate } from '../utils/formatters.ts';
import { getStatusStyle } from '../utils/statusStyles.ts';
import { getTicketFinancialSummary } from '../utils/ticketHelpers.ts';

type KpiModalType = 'blockages' | 'devis' | 'en_cours' | 'prets' | 'total';

interface AssistantClienteleDashboardProps {
    tickets: RepairTicket[];
    updateTicket: (ticket: RepairTicket) => Promise<void>;
    deleteTicket: (ticketId: string) => Promise<void>;
    loading?: boolean;
    onExitRole?: () => void;
}

export const AssistantClienteleDashboard: React.FC<AssistantClienteleDashboardProps> = ({
    tickets,
    updateTicket,
    deleteTicket,
    loading,
    onExitRole
}) => {
    const { showToast } = useToastContext();
    const [currentView, setCurrentView] = useState<'blockages' | 'actions' | 'tickets' | 'appointments' | 'point_financier'>('blockages');
    const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
    const [editingTicket, setEditingTicket] = useState<RepairTicket | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    // Modals
    const [activeBlockageTicket, setActiveBlockageTicket] = useState<RepairTicket | null>(null);
    const [previewTicket, setPreviewTicket] = useState<RepairTicket | null>(null);
    const [activeKpiModal, setActiveKpiModal] = useState<KpiModalType | null>(null);
    const [kpiModalSearch, setKpiModalSearch] = useState('');
    const [kpiFinancialFilter, setKpiFinancialFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

    // Fermer la modale au clavier via la touche Échap
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (activeKpiModal) {
                    setActiveKpiModal(null);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeKpiModal]);

    // Statistiques clés
    const stats = useMemo(() => {
        const total = tickets.length;
        const blockages = tickets.filter(t => !!t.technicalBlockageReport);
        const pendingBlockages = blockages.filter(t => t.technicalBlockageReport?.status === 'DEMANDEE' || t.technicalBlockageReport?.status === 'CLIENT_INFORME');
        const devisAValider = tickets.filter(t => t.status === RepairStatus.DEVIS_A_VALIDER);
        const enCours = tickets.filter(t => [RepairStatus.REPARATION_EN_COURS, RepairStatus.TESTS_EN_COURS, RepairStatus.EN_ATTENTE_DE_PIECES].includes(t.status));
        const prets = tickets.filter(t => t.status === RepairStatus.TERMINE);
        
        return {
            total,
            blockagesTotal: blockages.length,
            pendingBlockages: pendingBlockages.length,
            devisAValider: devisAValider.length,
            enCours: enCours.length,
            prets: prets.length
        };
    }, [tickets]);

    // Tickets avec rapport de blocage / rallonge
    const blockageTickets = useMemo(() => {
        return tickets.filter(t => !!t.technicalBlockageReport)
            .sort((a, b) => {
                const dateA = new Date(a.technicalBlockageReport?.updatedAt || a.updatedAt).getTime();
                const dateB = new Date(b.technicalBlockageReport?.updatedAt || b.updatedAt).getTime();
                return dateB - dateA;
            });
    }, [tickets]);

    // Tickets filtrés pour la vue globale
    const filteredTickets = useMemo(() => {
        let list = [...tickets];

        if (statusFilter !== 'ALL') {
            if (statusFilter === 'EN_COURS') {
                list = list.filter(t => [RepairStatus.REPARATION_EN_COURS, RepairStatus.TESTS_EN_COURS, RepairStatus.EN_ATTENTE_DE_PIECES].includes(t.status));
            } else {
                list = list.filter(t => t.status === statusFilter);
            }
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(t => 
                t.id.toLowerCase().includes(q) ||
                t.client.name.toLowerCase().includes(q) ||
                t.client.phone.includes(q) ||
                t.macModel.toLowerCase().includes(q) ||
                (t.serialNumber && t.serialNumber.toLowerCase().includes(q))
            );
        }

        return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }, [tickets, statusFilter, searchQuery]);

    // Actions rapides sur les blocages / rallonges
    const handleQuickWhatsAppBlockage = (ticket: RepairTicket) => {
        const report = ticket.technicalBlockageReport;
        if (!report) return;

        const rawPhone = ticket.client?.phone || '';
        const cleanPhone = formatWhatsAppPhone(rawPhone);
        if (!cleanPhone) {
            showToast("Numéro de téléphone du client introuvable ou invalide.", "error");
            return;
        }

        const msg = report.clientExplanation || `Bonjour ${ticket.client.name}, concernant votre ${ticket.macModel} (Dossier N°${ticket.id}) : suite aux remplacements des premiers composants, des tests approfondis nécessitent une rallonge de délai de +${report.requestedDays} jours. Prochain RDV : ${report.calculatedRdvDate}.`;

        const waUrl = generateWhatsAppUrl(cleanPhone, msg);
        window.open(waUrl, '_blank');

        // Mettre à jour le statut en CLIENT_INFORME si c'était DEMANDEE
        if (report.status === 'DEMANDEE') {
            const updated: RepairTicket = {
                ...ticket,
                updatedAt: new Date().toISOString(),
                technicalBlockageReport: {
                    ...report,
                    status: 'CLIENT_INFORME',
                    notifiedViaWhatsApp: true,
                    updatedAt: new Date().toISOString()
                },
                history: [
                    ...(ticket.history || []),
                    {
                        timestamp: new Date().toISOString(),
                        user: 'Assistant Clientèle',
                        action: `Notification WhatsApp envoyée au client pour la demande de rallonge (+${report.requestedDays}j). Nouveau RDV : ${report.calculatedRdvDate}.`
                    }
                ]
            };
            updateTicket(updated);
        }

        showToast("WhatsApp ouvert pour le client !", "success");
    };

    const handleConfirmClientAgreement = async (ticket: RepairTicket, agreed: boolean) => {
        const report = ticket.technicalBlockageReport;
        if (!report) return;

        const now = new Date().toISOString();
        const newStatus = agreed ? 'ACCEPTEE' : 'REFUSEE';
        const actionLabel = agreed
            ? `Accord client validé pour la rallonge de +${report.requestedDays} jours. Prochain RDV confirmé au ${report.calculatedRdvDate}.`
            : `Client informé de la rallonge mais a refusé ou demandé un point d'étape urgent.`;

        const updated: RepairTicket = {
            ...ticket,
            updatedAt: now,
            technicalBlockageReport: {
                ...report,
                status: newStatus,
                updatedAt: now
            },
            history: [
                ...(ticket.history || []),
                {
                    timestamp: now,
                    user: 'Assistant Clientèle',
                    action: actionLabel
                }
            ]
        };

        try {
            await updateTicket(updated);
            showToast(agreed ? "Accord client consigné avec succès !" : "Statut refus consigné.", agreed ? "success" : "info");
        } catch (e) {
            console.error("Erreur mise à jour accord client :", e);
            showToast("Erreur lors de la mise à jour.", "error");
        }
    };

    const navItems: NavItem[] = [
        {
            id: 'blockages',
            label: 'Blocages & Rallonges',
            icon: AlertTriangle,
            isActive: currentView === 'blockages',
            onClick: () => setCurrentView('blockages'),
            badge: stats.pendingBlockages > 0 ? stats.pendingBlockages : undefined
        },
        {
            id: 'actions',
            label: 'Actions du Jour',
            icon: Clock,
            isActive: currentView === 'actions',
            onClick: () => setCurrentView('actions')
        },
        {
            id: 'tickets',
            label: 'Dossiers & Clients',
            icon: FileText,
            isActive: currentView === 'tickets',
            onClick: () => setCurrentView('tickets'),
            badge: stats.total
        },
        {
            id: 'appointments',
            label: 'Rendez-vous & Retraits',
            icon: Calendar,
            isActive: currentView === 'appointments',
            onClick: () => setCurrentView('appointments')
        },
        {
            id: 'point_financier',
            label: 'Point Financier Fiches',
            icon: DollarSign,
            isActive: currentView === 'point_financier',
            onClick: () => setCurrentView('point_financier')
        }
    ];

    const baseModalTickets = useMemo(() => {
        if (!activeKpiModal) return [];
        let list: RepairTicket[] = [];
        if (activeKpiModal === 'blockages') {
            list = tickets.filter(t => !!t.technicalBlockageReport);
        } else if (activeKpiModal === 'devis') {
            list = tickets.filter(t => t.status === RepairStatus.DEVIS_A_VALIDER || t.status === RepairStatus.DEVIS_REFUSE);
        } else if (activeKpiModal === 'en_cours') {
            list = tickets.filter(t => [RepairStatus.REPARATION_EN_COURS, RepairStatus.TESTS_EN_COURS, RepairStatus.EN_ATTENTE_DE_PIECES].includes(t.status));
        } else if (activeKpiModal === 'prets') {
            list = tickets.filter(t => t.status === RepairStatus.TERMINE);
        } else if (activeKpiModal === 'total') {
            list = [...tickets];
        }

        if (kpiModalSearch.trim()) {
            const q = kpiModalSearch.toLowerCase().trim();
            list = list.filter(t => 
                t.id.toLowerCase().includes(q) ||
                t.client.name.toLowerCase().includes(q) ||
                (t.client.phone || '').toLowerCase().includes(q) ||
                (t.macBrand || '').toLowerCase().includes(q) ||
                (t.macModel || '').toLowerCase().includes(q) ||
                (t.serialNumber || '').toLowerCase().includes(q) ||
                (t.problemDescription || '').toLowerCase().includes(q) ||
                (t.technicalBlockageReport?.blockageReason || '').toLowerCase().includes(q)
            );
        }

        return list;
    }, [tickets, activeKpiModal, kpiModalSearch]);

    // Synthèse financière globale sur l'ensemble des fiches de la modale active
    const modalFinancialSummary = useMemo(() => {
        return baseModalTickets.reduce((acc, t) => {
            const fin = getTicketFinancialSummary(t);
            acc.totalBilled += fin.totalBilled;
            acc.totalAdvance += fin.advanceReceived;
            acc.totalBalanceDue += fin.balanceDue;
            if (fin.isFullyPaid) acc.paidCount += 1;
            if (fin.balanceDue > 0) acc.unpaidCount += 1;
            return acc;
        }, {
            totalBilled: 0,
            totalAdvance: 0,
            totalBalanceDue: 0,
            paidCount: 0,
            unpaidCount: 0
        });
    }, [baseModalTickets]);

    const modalTickets = useMemo(() => {
        if (kpiFinancialFilter === 'unpaid') {
            return baseModalTickets.filter(t => getTicketFinancialSummary(t).balanceDue > 0);
        } else if (kpiFinancialFilter === 'paid') {
            return baseModalTickets.filter(t => getTicketFinancialSummary(t).isFullyPaid);
        }
        return baseModalTickets;
    }, [baseModalTickets, kpiFinancialFilter]);

    const getKpiWhatsAppMessage = (ticket: RepairTicket, kpi: KpiModalType) => {
        const clientName = ticket.client.name || 'Client';
        const model = ticket.macModel || 'MacBook';
        const fin = getTicketFinancialSummary(ticket);
        const total = fin.totalBilled.toLocaleString('fr-FR');
        const deposit = fin.advanceReceived.toLocaleString('fr-FR');
        const balance = fin.balanceDue.toLocaleString('fr-FR');

        if (kpi === 'blockages') {
            const extraDays = ticket.technicalBlockageReport?.requestedDays || ticket.technicalBlockageReport?.estimatedExtraDays || 3;
            const motif = ticket.technicalBlockageReport?.blockageReason || "un approvisionnement technique spécifique";
            return `Bonjour ${clientName},\n\nAtelier TGS-CI Cocody concernant votre ${model} (Fiche #${ticket.id}).\n\nNos techniciens ont identifié : ${motif}.\nNous sollicitons une rallonge de délai estimée à +${extraDays} jour(s) pour assurer une réparation durable.\n\nMerci de nous confirmer votre accord en répondant à ce message.\n\nService Relations Clients TGS-CI.`;
        }
        if (kpi === 'devis') {
            return `Bonjour ${clientName},\n\nAtelier TGS-CI Cocody concernant votre ${model} (Fiche #${ticket.id}).\n\nLe diagnostic de votre appareil est achevé. Le montant total estimé de l'intervention est de ${total} FCFA (Acompte versé : ${deposit} FCFA).\n\nMerci de nous transmettre votre accord par retour de ce message afin de lancer les réparations.\n\nService Clientèle TGS-CI.`;
        }
        if (kpi === 'prets') {
            return `Bonjour ${clientName},\n\nBonne nouvelle de l'atelier TGS-CI Cocody ! 🎉\nVotre ${model} (Fiche #${ticket.id}) est réparé, testé et prêt pour retrait.\n\nTotal facturé : ${total} FCFA\nAcompte versé : ${deposit} FCFA\nSolde restant à régler au guichet : ${balance} FCFA.\n\nÀ très vite !`;
        }
        if (kpi === 'en_cours') {
            return `Bonjour ${clientName},\n\nAtelier TGS-CI Cocody concernant votre ${model} (Fiche #${ticket.id}).\n\nVotre machine est actuellement en cours d'intervention sur nos bancs de réparation micro-électronique. Nous vous informerons dès l'achèvement des tests.`;
        }
        return `Bonjour ${clientName},\n\nAtelier TGS-CI Cocody au sujet de votre ${model} (Fiche #${ticket.id}).\nTotal dossier : ${total} FCFA (Acompte : ${deposit} FCFA, Reste dû : ${balance} FCFA). Restant à votre entière disposition.`;
    };

    if (editingTicket) {
        return (
            <div className="min-h-screen bg-black text-white p-4 md:p-8">
                {editingTicket.client?.isEnterprise ? (
                    <EnterpriseRepairForm
                        key={editingTicket.id}
                        tickets={tickets}
                        ticketToEdit={editingTicket}
                        onSave={async (ticket, action, oldId) => {
                            await updateTicket(ticket as RepairTicket, oldId);
                            setEditingTicket(null);
                            setSelectedTicket(ticket as RepairTicket);
                        }}
                        onCancel={() => setEditingTicket(null)}
                    />
                ) : (
                    <RepairForm
                        key={editingTicket.id}
                        tickets={tickets}
                        ticketToEdit={editingTicket}
                        onSave={async (ticket, action, oldId) => {
                            await updateTicket(ticket as RepairTicket, oldId);
                            setEditingTicket(null);
                            setSelectedTicket(ticket as RepairTicket);
                        }}
                        onCancel={() => setEditingTicket(null)}
                        role="Assistant Clientèle"
                    />
                )}
            </div>
        );
    }

    if (selectedTicket) {
        return (
            <div className="min-h-screen bg-black text-white p-4 md:p-8">
                <RepairDetail
                    ticket={selectedTicket}
                    onBack={() => setSelectedTicket(null)}
                    onUpdate={async (updatedTicket, oldId) => {
                        await updateTicket(updatedTicket, oldId);
                        setSelectedTicket(updatedTicket);
                    }}
                    onDelete={async (id) => {
                        await deleteTicket(id);
                        setSelectedTicket(null);
                    }}
                    role="Assistant Clientèle"
                    onEdit={(t) => setEditingTicket(t)}
                />
            </div>
        );
    }

    const handleExitRole = () => {
        setSelectedTicket(null);
        setEditingTicket(null);
        setActiveBlockageTicket(null);
        setPreviewTicket(null);
        setActiveKpiModal(null);
        setKpiFinancialFilter('all');
        setCurrentView('blockages');

        const url = new URL(window.location.href);
        url.searchParams.delete('role');
        url.searchParams.delete('ticketId');
        window.history.pushState({}, '', url);

        if (onExitRole) {
            try {
                onExitRole();
            } catch (err) {
                console.error("Erreur onExitRole:", err);
            }
        }
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    const handleBack = () => {
        if (activeKpiModal) {
            setActiveKpiModal(null);
            return;
        }
        if (selectedTicket) {
            setSelectedTicket(null);
            return;
        }
        if (editingTicket) {
            setEditingTicket(null);
            return;
        }
        if (currentView !== 'blockages') {
            setCurrentView('blockages');
            return;
        }
        handleExitRole();
    };

    return (
        <DashboardLayout
            title="Assistant(e) Clientèle & Administratif(ve)"
            subtitle="Atelier TGS Côte d'Ivoire • Coordination & Relations Clients"
            role="Assistant Clientèle"
            navItems={navItems}
            activeTab={currentView}
            onTabChange={(tab) => setCurrentView(tab as 'blockages' | 'actions' | 'tickets' | 'appointments' | 'point_financier')}
            statsBadge={`${stats.total} fiches`}
            onBack={handleBack}
            onExitRole={handleExitRole}
        >
            <div className="relative z-10 space-y-6 pb-20">
                {loading && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center gap-2 text-xs text-blue-300 font-bold animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-apple-blue"></span>
                        Synchronisation des fiches atelier en cours...
                    </div>
                )}
                {/* Compteurs VVR & KPIs Cliquables avec ouverture dynamique en fenêtre modale */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                    <button 
                        onClick={() => {
                            setActiveKpiModal('blockages');
                            setKpiModalSearch('');
                            setKpiFinancialFilter('all');
                        }}
                        className={`group relative text-left p-4 rounded-3xl flex items-center justify-between border transition-all duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer ${
                            activeKpiModal === 'blockages'
                                ? 'bg-amber-950/60 border-amber-500 shadow-xl shadow-amber-500/20 ring-2 ring-amber-500/50' 
                                : 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-950/30'
                        }`}
                        title="Cliquer pour afficher la liste détaillée des blocages et rallonges en modale"
                    >
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Rallonges & Blocages</p>
                                <span className="text-[8px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">Détails</span>
                            </div>
                            <p className="text-2xl md:text-3xl font-black text-white mt-1">{stats.blockagesTotal}</p>
                            <p className="text-[9px] text-amber-300 font-bold mt-0.5">{stats.pendingBlockages} en attente</p>
                        </div>
                        <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-400 shrink-0 group-hover:scale-110 transition-transform">
                            <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                    </button>

                    <button 
                        onClick={() => {
                            setActiveKpiModal('devis');
                            setKpiModalSearch('');
                            setKpiFinancialFilter('all');
                        }}
                        className={`group relative text-left p-4 rounded-3xl flex items-center justify-between border transition-all duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer ${
                            activeKpiModal === 'devis'
                                ? 'bg-purple-950/60 border-purple-500 shadow-xl shadow-purple-500/20 ring-2 ring-purple-500/50' 
                                : 'bg-purple-950/20 border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-950/30'
                        }`}
                        title="Cliquer pour afficher la liste détaillée des devis VVR à relancer en modale"
                    >
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-[10px] font-black uppercase tracking-wider text-purple-400">VVR · Devis à Valider</p>
                                <span className="text-[8px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">Détails</span>
                            </div>
                            <p className="text-2xl md:text-3xl font-black text-white mt-1">{stats.devisAValider}</p>
                            <p className="text-[9px] text-purple-300 font-bold mt-0.5">En attente accord client</p>
                        </div>
                        <div className="p-3 bg-purple-500/20 rounded-2xl text-purple-400 shrink-0 group-hover:scale-110 transition-transform">
                            <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                    </button>

                    <button 
                        onClick={() => {
                            setActiveKpiModal('en_cours');
                            setKpiModalSearch('');
                            setKpiFinancialFilter('all');
                        }}
                        className={`group relative text-left p-4 rounded-3xl flex items-center justify-between border transition-all duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer ${
                            activeKpiModal === 'en_cours'
                                ? 'bg-blue-950/60 border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500/50' 
                                : 'bg-blue-950/20 border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-950/30'
                        }`}
                        title="Cliquer pour afficher les appareils VVR en cours de réparation en modale"
                    >
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-[10px] font-black uppercase tracking-wider text-blue-400">VVR · En Travaux</p>
                                <span className="text-[8px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">Détails</span>
                            </div>
                            <p className="text-2xl md:text-3xl font-black text-white mt-1">{stats.enCours}</p>
                            <p className="text-[9px] text-blue-300 font-bold mt-0.5">Sur bancs techniques</p>
                        </div>
                        <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400 shrink-0 group-hover:scale-110 transition-transform">
                            <Wrench className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                    </button>

                    <button 
                        onClick={() => {
                            setActiveKpiModal('prets');
                            setKpiModalSearch('');
                            setKpiFinancialFilter('all');
                        }}
                        className={`group relative text-left p-4 rounded-3xl flex items-center justify-between border transition-all duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer ${
                            activeKpiModal === 'prets'
                                ? 'bg-emerald-950/60 border-emerald-500 shadow-xl shadow-emerald-500/20 ring-2 ring-emerald-500/50' 
                                : 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-950/30'
                        }`}
                        title="Cliquer pour afficher les appareils prêts au retrait en modale"
                    >
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">VVR · Prêts Retrait</p>
                                <span className="text-[8px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">Détails</span>
                            </div>
                            <p className="text-2xl md:text-3xl font-black text-white mt-1">{stats.prets}</p>
                            <p className="text-[9px] text-emerald-300 font-bold mt-0.5">Disponibles au guichet</p>
                        </div>
                        <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 shrink-0 group-hover:scale-110 transition-transform">
                            <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                    </button>

                    <button 
                        onClick={() => {
                            setActiveKpiModal('total');
                            setKpiModalSearch('');
                            setKpiFinancialFilter('all');
                        }}
                        className={`group relative text-left p-4 rounded-3xl flex items-center justify-between border transition-all duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer col-span-2 sm:col-span-1 ${
                            activeKpiModal === 'total'
                                ? 'bg-slate-900 border-zinc-400 shadow-xl shadow-white/10 ring-2 ring-white/30' 
                                : 'bg-slate-950/30 border-white/10 hover:border-white/30 hover:bg-slate-900/40'
                        }`}
                        title="Cliquer pour afficher l'ensemble des dossiers atelier VVR en modale"
                    >
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-300">Total Fiches VVR</p>
                                <span className="text-[8px] px-1.5 py-0.2 rounded bg-white/10 text-white border border-white/20 font-mono">Détails</span>
                            </div>
                            <p className="text-2xl md:text-3xl font-black text-white mt-1">{stats.total}</p>
                            <p className="text-[9px] text-zinc-400 font-bold mt-0.5">Registre complet</p>
                        </div>
                        <div className="p-3 bg-white/10 rounded-2xl text-white shrink-0 group-hover:scale-110 transition-transform">
                            <FileText className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                    </button>
                </div>

                {/* BANDEAU ACTION SORTIE DES POINTS FINANCIERS */}
                <div className="bg-gradient-to-r from-blue-950/40 via-[#0e1322] to-indigo-950/40 border border-blue-500/25 rounded-3xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black uppercase tracking-wider text-white">
                                    Sortie des Points Financiers d'Atelier
                                </h4>
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[9px] font-black uppercase">
                                    Nouveau
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                                Sortez le point total des montants facturés sur chaque fiche selon vos besoins (par semaine, mois, année, semestre, trimestre ou de date à date).
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setCurrentView('point_financier')}
                        className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer flex items-center gap-2 shrink-0 ${
                            currentView === 'point_financier'
                                ? 'bg-apple-blue text-white shadow-blue-500/30'
                                : 'bg-white text-black hover:bg-zinc-200'
                        }`}
                    >
                        <span>📊 Sortir le Point Financier</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* VUE 1 : BLOCAGES & RALLONGES DÉLAIS (VUE CENTRALE) */}
                {currentView === 'blockages' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/50 p-4 rounded-3xl border border-white/5">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                                    Gestion des Dossiers Bloqués & Rallonges de Délais
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Rapports déposés par les techniciens en cours de réparation • Informez les clients et consignez leurs accords.
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/30 self-start sm:self-auto">
                                {blockageTickets.length} dossier(s) avec avenant de délai
                            </span>
                        </div>

                        {blockageTickets.length === 0 ? (
                            <div className="text-center py-16 bg-slate-950/40 border border-dashed border-white/10 rounded-3xl space-y-3">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-600">
                                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                                </div>
                                <h3 className="text-base font-bold text-white uppercase tracking-wider">Aucun blocage signalé</h3>
                                <p className="text-xs text-slate-400 max-w-md mx-auto">
                                    Toutes les réparations en cours avancent dans les délais normaux. Lorsqu'un technicien enregistre un rapport de blocage, il apparaîtra immédiatement ici avec toutes les actions client.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {blockageTickets.map((t) => {
                                    const r = t.technicalBlockageReport!;
                                    const statusBadge = 
                                        r.status === 'ACCEPTEE' ? { label: 'Accord client confirmé', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' } :
                                        r.status === 'CLIENT_INFORME' ? { label: 'Client informé (En attente)', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/30' } :
                                        r.status === 'REFUSEE' ? { label: 'Client refuse / Point requis', bg: 'bg-red-500/20 text-red-300 border-red-500/30' } :
                                        { label: 'Rallonge demandée par technicien', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };

                                    return (
                                        <div 
                                            key={t.id} 
                                            className="bg-slate-900/70 border border-white/10 rounded-3xl p-5 md:p-6 space-y-4 hover:border-amber-500/30 transition-all shadow-xl"
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/5 gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20 shrink-0">
                                                        <MacbookIcon className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-base font-black text-white font-mono">Dossier N°{t.id}</span>
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${statusBadge.bg}`}>
                                                                {statusBadge.label}
                                                            </span>
                                                            <span className="px-2 py-0.5 bg-white/5 text-slate-400 rounded text-[9px] font-bold">
                                                                Tech : {r.technicianName}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-300 font-bold mt-1">
                                                            {t.client.name} • <span className="text-amber-300">{t.client.phone}</span> • <span className="text-slate-400">{t.macModel}</span>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuickWhatsAppBlockage(t)}
                                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-900/30"
                                                    >
                                                        <WhatsAppIcon className="w-4 h-4" />
                                                        <span>WhatsApp Client</span>
                                                    </button>
                                                    <a
                                                        href={`tel:${t.client.phone}`}
                                                        className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                                                    >
                                                        <Phone className="w-4 h-4" />
                                                        <span>Appeler</span>
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveBlockageTicket(t)}
                                                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-white/10"
                                                    >
                                                        Modifier / Compléter
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewTicket(t)}
                                                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-white/10"
                                                        title="Aperçu / Impression note d'intervention"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedTicket(t)}
                                                        className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all"
                                                        title="Voir la fiche complète"
                                                    >
                                                        <ChevronRight className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Détails du blocage & Rallonge */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2">
                                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                                        <Wrench className="w-3.5 h-3.5" />
                                                        Composants déjà remplacés
                                                    </p>
                                                    <div className="space-y-1">
                                                        {r.replacedComponents && r.replacedComponents.length > 0 ? (
                                                            r.replacedComponents.map((c, i) => (
                                                                <p key={i} className="text-xs text-slate-200 font-bold">• {c}</p>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs text-slate-500 italic">Aucun dans la liste standard</p>
                                                        )}
                                                        {r.customComponentsText && (
                                                            <p className="text-xs text-emerald-300 font-mono italic">
                                                                + {r.customComponentsText}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2">
                                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5" />
                                                        Symptôme / Nature du blocage
                                                    </p>
                                                    <div className="space-y-1">
                                                        {r.symptoms && r.symptoms.length > 0 ? (
                                                            r.symptoms.map((s, i) => (
                                                                <p key={i} className="text-xs text-slate-200 font-bold">• {s}</p>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs text-slate-500 italic">Non précisé</p>
                                                        )}
                                                        {r.technicalDetails && (
                                                            <p className="text-[11px] text-slate-400 font-mono italic mt-1 border-t border-white/5 pt-1">
                                                                "{r.technicalDetails}"
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 space-y-2 flex flex-col justify-between">
                                                    <div>
                                                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            Rallonge & Prochain RDV
                                                        </p>
                                                        <p className="text-lg font-black text-white mt-1">
                                                            +{r.requestedDays} jour{r.requestedDays > 1 ? 's ouvrés' : ' ouvré'}
                                                        </p>
                                                        <p className="text-xs font-bold text-amber-200 capitalize mt-0.5">
                                                            {formatDisplayDate(r.calculatedRdvDate)}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">Heure prévue : {r.calculatedRdvTime || '10:00'}</p>
                                                    </div>

                                                    <div className="flex items-center gap-2 pt-2 border-t border-amber-500/20">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleConfirmClientAgreement(t, true)}
                                                            className="flex-1 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            <span>Accord OK</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleConfirmClientAgreement(t, false)}
                                                            className="flex-1 py-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                            <span>Refus</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Message client vulgarisé généré */}
                                            {r.clientExplanation && (
                                                <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-2xl">
                                                    <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                        <Sparkles className="w-3 h-3" />
                                                        Message vulgarisé préparé pour le client :
                                                    </p>
                                                    <p className="text-xs text-slate-300 font-sans italic line-clamp-2 hover:line-clamp-none transition-all cursor-pointer">
                                                        "{r.clientExplanation}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* VUE 2 : ACTIONS & RELANCES DU JOUR */}
                {currentView === 'actions' && (
                    <div className="space-y-4">
                        <ActionsDuJourView />
                    </div>
                )}

                {/* VUE 3 : DOSSIERS & CLIENTS ATELIER */}
                {currentView === 'tickets' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/50 p-4 rounded-3xl border border-white/5">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Rechercher par N° dossier, nom client, téléphone, modèle..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-apple-blue transition-all"
                                />
                            </div>

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white font-bold outline-none focus:border-apple-blue cursor-pointer"
                            >
                                <option value="ALL">Tous les statuts ({tickets.length})</option>
                                {Object.values(RepairStatus).map(st => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                            {filteredTickets.map(ticket => {
                                const statusStyle = getStatusStyle(ticket.status);
                                const hasBlockage = !!ticket.technicalBlockageReport;
                                const fin = getTicketFinancialSummary(ticket);

                                return (
                                    <div
                                        key={ticket.id}
                                        onClick={() => setSelectedTicket(ticket)}
                                        className="bg-slate-900/60 border border-white/5 rounded-3xl p-5 space-y-3 hover:border-apple-blue/50 hover:bg-slate-900 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-white font-mono">#{ticket.id}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${statusStyle.badge}`}>
                                                    {ticket.status}
                                                </span>
                                            </div>

                                            <div>
                                                <p className="text-sm font-black text-white group-hover:text-apple-blue transition-colors">
                                                    {ticket.client.name}
                                                </p>
                                                <p className="text-xs text-slate-400 font-mono">{ticket.client.phone}</p>
                                            </div>

                                            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                                                <p className="text-xs font-bold text-slate-200">{ticket.macModel}</p>
                                                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                                    {ticket.problemDescription}
                                                </p>
                                            </div>

                                            {hasBlockage && (
                                                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                                                    <span className="text-[9px] font-black text-amber-300 uppercase flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                                                        Rallonge +{ticket.technicalBlockageReport?.requestedDays}j
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 font-mono font-bold">
                                                        {ticket.technicalBlockageReport?.calculatedRdvDate}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-white/5">
                                            <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                                                <div>
                                                    <span className="text-[9px] text-zinc-400 uppercase font-sans font-bold block">Total</span>
                                                    <strong className="text-white font-bold">{fin.totalBilled.toLocaleString('fr-FR')} F</strong>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-emerald-400 uppercase font-sans font-bold block">Acompte</span>
                                                    <strong className="text-emerald-400 font-bold">{fin.advanceReceived.toLocaleString('fr-FR')} F</strong>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-amber-400 uppercase font-sans font-bold block">Reste</span>
                                                    {fin.isFullyPaid ? (
                                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                                                            Soldé
                                                        </span>
                                                    ) : (
                                                        <strong className="text-amber-400 font-bold">
                                                            {fin.balanceDue.toLocaleString('fr-FR')} F
                                                        </strong>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold pt-1 border-t border-white/5">
                                                <span>RDV : {ticket.rendezVousDate || 'Non fixé'}</span>
                                                <span className="text-apple-blue group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                                                    Détails →
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* VUE 4 : RENDEZ-VOUS & RETRAITS */}
                {currentView === 'appointments' && (
                    <div className="space-y-4">
                        <AppointmentCalendarView
                            tickets={tickets}
                            onSelectTicket={(ticket) => setSelectedTicket(ticket)}
                        />
                    </div>
                )}

                {/* VUE 5 : SORTIE DES POINTS FINANCIERS DE L'ATELIER */}
                {currentView === 'point_financier' && (
                    <div className="space-y-4">
                        <TicketFinancialPointManager
                            tickets={tickets}
                            onSelectTicket={(ticket) => setSelectedTicket(ticket)}
                            onBack={() => setCurrentView('tickets')}
                        />
                    </div>
                )}
            </div>

            {/* Modal de modification / rapport de blocage */}
            {activeBlockageTicket && (
                <TechnicalBlockageModal
                    isOpen={!!activeBlockageTicket}
                    onClose={() => setActiveBlockageTicket(null)}
                    ticket={activeBlockageTicket}
                    role="Assistant Clientèle"
                    onSaveReport={async (updated) => {
                        await updateTicket(updated);
                        setActiveBlockageTicket(null);
                    }}
                    onPrintNote={(t) => {
                        setActiveBlockageTicket(null);
                        setPreviewTicket(t);
                    }}
                />
            )}

            {/* Modal d'aperçu d'impression de l'avenant de délai */}
            {previewTicket && (
                <PreviewModal
                    isOpen={!!previewTicket}
                    onClose={() => setPreviewTicket(null)}
                    fileName={`AVENANT_DELAI_${previewTicket.id}.pdf`}
                >
                    <PrintableBlockageNote ticket={previewTicket} />
                </PreviewModal>
            )}

            {/* MODALE DYNAMIQUE DES COMPTEURS VVR / KPI */}
            {activeKpiModal && (
                <div 
                    className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setActiveKpiModal(null);
                    }}
                >
                    <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#0c0e14] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white animate-scale-up">
                        
                        {/* En-tête de la modale */}
                        <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4 bg-white/[0.02]">
                            <div className="flex items-center gap-3.5">
                                <div className={`p-3 rounded-2xl border ${
                                    activeKpiModal === 'blockages' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                    activeKpiModal === 'devis' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                                    activeKpiModal === 'en_cours' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                    activeKpiModal === 'prets' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                    'bg-white/10 text-white border-white/20'
                                }`}>
                                    {activeKpiModal === 'blockages' && <AlertTriangle className="w-6 h-6" />}
                                    {activeKpiModal === 'devis' && <Sparkles className="w-6 h-6" />}
                                    {activeKpiModal === 'en_cours' && <Wrench className="w-6 h-6" />}
                                    {activeKpiModal === 'prets' && <CheckCircle className="w-6 h-6" />}
                                    {activeKpiModal === 'total' && <FileText className="w-6 h-6" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-white">
                                            {activeKpiModal === 'blockages' && 'Rallonges de Délais & Dossiers Bloqués'}
                                            {activeKpiModal === 'devis' && 'Devis à Relancer (VVR)'}
                                            {activeKpiModal === 'en_cours' && 'Appareils en Cours de Travaux'}
                                            {activeKpiModal === 'prets' && 'Appareils Prêts au Retrait'}
                                            {activeKpiModal === 'total' && 'Tous les Dossiers Atelier'}
                                        </h3>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black font-mono border ${
                                            activeKpiModal === 'blockages' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                                            activeKpiModal === 'devis' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                            activeKpiModal === 'en_cours' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                            activeKpiModal === 'prets' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                            'bg-white/10 text-white border-white/20'
                                        }`}>
                                            {modalTickets.length}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        {activeKpiModal === 'blockages' && 'Dossiers ayant fait l’objet d’un rapport de blocage ou d’une demande d’avenant de délai.'}
                                        {activeKpiModal === 'devis' && 'MacBook diagnostiqués avec devis chiffré en attente de validation ou relance client.'}
                                        {activeKpiModal === 'en_cours' && 'Dossiers actuellement pris en charge sur les bancs de réparation ou de tests techniques.'}
                                        {activeKpiModal === 'prets' && 'Appareils réparés et testés avec succès, disponibles pour restitution et encaissement.'}
                                        {activeKpiModal === 'total' && 'Registre complet de tous les dossiers pris en charge dans l’atelier.'}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setActiveKpiModal(null)}
                                className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                                title="Fermer la fenêtre (Échap)"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* BANDEAU SYNTHÈSE COMPTABLE DU REGISTRE ATELIER */}
                        <div className="px-6 py-4 bg-gradient-to-r from-slate-900/90 via-[#10141f] to-slate-900/90 border-b border-white/10">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-apple-blue animate-pulse"></span>
                                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                                        Synthèse Comptable Atelier ({modalTickets.length} dossier{modalTickets.length > 1 ? 's' : ''})
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-[10px]">
                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 font-mono text-emerald-400 font-bold">
                                        {modalFinancialSummary.paidCount} soldé(s)
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 font-mono text-amber-400 font-bold">
                                        {modalFinancialSummary.unpaidCount} avec reste dû
                                    </span>
                                    <button
                                        onClick={() => {
                                            setActiveKpiModal(null);
                                            setCurrentView('point_financier');
                                        }}
                                        className="px-2.5 py-1 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all ml-1"
                                        title="Ouvrir le module complet d'extraction et d'impression du point financier"
                                    >
                                        <span>📊 Sortir le Point →</span>
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Total Facturé */}
                                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-blue-500/25 flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-400">Total Facturé</p>
                                        <p className="text-lg md:text-xl font-black text-white font-mono mt-0.5">
                                            {modalFinancialSummary.totalBilled.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">FCFA</span>
                                        </p>
                                        <p className="text-[9px] text-slate-400 font-medium">Diagnostic + Réparation</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                </div>

                                {/* Total Acomptes Reçus */}
                                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-emerald-500/25 flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Acomptes Reçus</p>
                                        <p className="text-lg md:text-xl font-black text-emerald-300 font-mono mt-0.5">
                                            {modalFinancialSummary.totalAdvance.toLocaleString('fr-FR')} <span className="text-xs font-normal text-emerald-500/80">FCFA</span>
                                        </p>
                                        <p className="text-[9px] text-slate-400 font-medium">Avances perçues en caisse</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                        <CheckCircle className="w-5 h-5" />
                                    </div>
                                </div>

                                {/* Reste Total Dû */}
                                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-amber-500/25 flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Reste Total Dû</p>
                                        <p className="text-lg md:text-xl font-black text-amber-300 font-mono mt-0.5">
                                            {modalFinancialSummary.totalBalanceDue.toLocaleString('fr-FR')} <span className="text-xs font-normal text-amber-500/80">FCFA</span>
                                        </p>
                                        <p className="text-[9px] text-slate-400 font-medium">Créances à percevoir au retrait</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Barre de recherche & filtres financiers dans la modale */}
                        <div className="px-6 py-3.5 bg-black/40 border-b border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            <div className="relative flex-1 max-w-md">
                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    value={kpiModalSearch}
                                    onChange={(e) => setKpiModalSearch(e.target.value)}
                                    placeholder="Rechercher par client, téléphone, n° de fiche, modèle..."
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-apple-blue/50"
                                />
                                {kpiModalSearch && (
                                    <button 
                                        onClick={() => setKpiModalSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Filtres financiers rapides pour faciliter la comptabilité */}
                            <div className="flex items-center gap-1.5 self-start md:self-auto bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setKpiFinancialFilter('all')}
                                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                        kpiFinancialFilter === 'all'
                                            ? 'bg-white/20 text-white shadow-sm'
                                            : 'text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    Tous
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setKpiFinancialFilter('unpaid')}
                                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                        kpiFinancialFilter === 'unpaid'
                                            ? 'bg-amber-500/25 text-amber-300 shadow-sm border border-amber-500/40'
                                            : 'text-zinc-400 hover:text-amber-300'
                                    }`}
                                >
                                    Reste dû ({modalFinancialSummary.unpaidCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setKpiFinancialFilter('paid')}
                                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                        kpiFinancialFilter === 'paid'
                                            ? 'bg-emerald-500/25 text-emerald-300 shadow-sm border border-emerald-500/40'
                                            : 'text-zinc-400 hover:text-emerald-300'
                                    }`}
                                >
                                    Soldés ({modalFinancialSummary.paidCount})
                                </button>
                            </div>
                        </div>

                        {/* Liste scrollable des dossiers */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 no-scrollbar">
                            {modalTickets.length === 0 ? (
                                <div className="py-14 text-center space-y-3">
                                    <div className="w-14 h-14 mx-auto rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
                                        <Search className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-bold text-zinc-300">Aucun dossier trouvé dans cette catégorie</p>
                                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                                        {kpiModalSearch ? "Aucun élément ne correspond à votre recherche. Essayez d'autres mots-clés." : "Toutes les interventions dans cette catégorie sont actuellement traitées."}
                                    </p>
                                </div>
                            ) : (
                                modalTickets.map((ticket) => {
                                    const statusStyle = getStatusStyle(ticket.status);
                                    const fin = getTicketFinancialSummary(ticket);
                                    const phoneFormatted = formatWhatsAppPhone(ticket.client.phone);
                                    const whatsappMsg = getKpiWhatsAppMessage(ticket, activeKpiModal);
                                    const whatsappUrl = phoneFormatted ? generateWhatsAppUrl(phoneFormatted, whatsappMsg) : '';

                                    return (
                                        <div 
                                            key={ticket.id}
                                            className="bg-[#12151d] hover:bg-[#161a24] border border-white/[0.08] hover:border-white/20 rounded-2xl p-4 sm:p-5 transition-all shadow-md space-y-3.5"
                                        >
                                            {/* Haut de carte : ID, Date, Statut */}
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-mono text-xs font-black text-white px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                                                        #{ticket.id}
                                                    </span>
                                                    <span className="text-[11px] text-zinc-400">
                                                        Déposé le {formatDisplayDate(ticket.createdAt)}
                                                    </span>
                                                    {ticket.client?.isEnterprise && (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                            Entreprise
                                                        </span>
                                                    )}
                                                </div>

                                                <span className={`px-2.5 py-0.8 rounded-full text-[10px] font-black uppercase tracking-wider ${statusStyle.badge}`}>
                                                    {ticket.status}
                                                </span>
                                            </div>

                                            {/* Corps principal : Client & Appareil */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                                {/* Client */}
                                                <div className="space-y-1">
                                                    <p className="text-sm font-black text-white flex items-center gap-1.5">
                                                        <span>{ticket.client.name}</span>
                                                    </p>
                                                    <p className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
                                                        <Phone className="w-3.5 h-3.5 text-zinc-500" />
                                                        <span>{ticket.client.phone || 'Non renseigné'}</span>
                                                    </p>
                                                </div>

                                                {/* Appareil */}
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                                                        <MacbookIcon className="w-3.5 h-3.5 text-apple-blue" />
                                                        <span>{ticket.macModel}</span>
                                                    </div>
                                                    <p className="text-[11px] text-zinc-500 font-mono truncate">
                                                        S/N : {ticket.serialNumber || 'Non renseigné'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Description du problème */}
                                            {ticket.problemDescription && (
                                                <div className="text-xs text-zinc-400 bg-black/30 border border-white/5 rounded-xl p-2.5 line-clamp-2">
                                                    <span className="text-zinc-500 font-semibold mr-1">Panne :</span>
                                                    {ticket.problemDescription}
                                                </div>
                                            )}

                                            {/* Alerte spécifique selon le KPI */}
                                            {activeKpiModal === 'blockages' && ticket.technicalBlockageReport && (
                                                <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-1.5 text-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-black text-amber-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                            Raison : {ticket.technicalBlockageReport.blockageReason}
                                                        </span>
                                                        <span className="font-bold text-amber-300">
                                                            +{ticket.technicalBlockageReport.requestedDays || ticket.technicalBlockageReport.estimatedExtraDays || 0} jours demandés
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                                        <span>Nouveau RDV estimé : <strong className="text-white font-mono">{ticket.technicalBlockageReport.calculatedRdvDate || 'À fixer'}</strong></span>
                                                        <span className="font-semibold text-amber-200">Statut : {ticket.technicalBlockageReport.status || 'En attente accord'}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Chiffres financiers normalisés et lisibles */}
                                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2 border-t border-white/5">
                                                {fin.isInfacturable ? (
                                                    <div className="flex flex-wrap items-center gap-2 text-[11px] bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20">
                                                        <span className="text-rose-400 font-black">🚫 INFACTURABLE</span>
                                                        <span className="text-rose-300 text-[10px] font-bold">Fiche annulée : aucun fond intégrable au point (0 FCFA comptabilisé)</span>
                                                        {fin.rawAdvanceReceived > 0 && (
                                                            <span className="text-slate-400 line-through text-[10px] ml-1 font-mono">
                                                                (Avance déclarée : {fin.rawAdvanceReceived.toLocaleString('fr-FR')} FCFA)
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px]">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                                            <span className="text-zinc-400">Total :</span>
                                                            <strong className="text-white font-mono font-bold">
                                                                {fin.totalBilled.toLocaleString('fr-FR')} FCFA
                                                            </strong>
                                                        </div>

                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                            <span className="text-zinc-400">Acompte :</span>
                                                            <strong className="text-emerald-400 font-mono font-bold">
                                                                {fin.advanceReceived.toLocaleString('fr-FR')} FCFA
                                                            </strong>
                                                        </div>

                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${fin.balanceDue > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                                                            <span className="text-zinc-400">Reste dû :</span>
                                                            {fin.isFullyPaid ? (
                                                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 text-[10px]">
                                                                    Soldé (0 FCFA)
                                                                </span>
                                                            ) : (
                                                                <strong className="text-amber-400 font-mono font-bold">
                                                                    {fin.balanceDue.toLocaleString('fr-FR')} FCFA
                                                                </strong>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Boutons d'actions rapides sur la carte */}
                                                <div className="flex items-center gap-2">
                                                    {phoneFormatted && (
                                                        <a
                                                            href={whatsappUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all active:scale-95"
                                                            title="Ouvrir WhatsApp avec un message pré-rédigé officiel"
                                                        >
                                                            <WhatsAppIcon className="w-3.5 h-3.5" />
                                                            <span>WhatsApp</span>
                                                        </a>
                                                    )}

                                                    {ticket.client?.phone && (
                                                        <a
                                                            href={`tel:${ticket.client.phone}`}
                                                            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-all active:scale-95"
                                                            title="Appeler le client"
                                                        >
                                                            <PhoneCall className="w-3.5 h-3.5" />
                                                        </a>
                                                    )}

                                                    <button
                                                        onClick={() => {
                                                            setActiveKpiModal(null);
                                                            setSelectedTicket(ticket);
                                                        }}
                                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-apple-blue hover:bg-blue-600 text-white text-xs font-black transition-all active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer"
                                                        title="Ouvrir la fiche complète dans le module"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span>Consulter</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Pied de la modale */}
                        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-xs text-zinc-400">
                                <span>Total catégorie : <strong className="text-white font-bold">{modalTickets.length} dossier(s)</strong></span>
                            </div>

                            <div className="flex items-center gap-2.5 w-full sm:w-auto">
                                <button
                                    onClick={() => {
                                        const target = activeKpiModal;
                                        setActiveKpiModal(null);
                                        if (target === 'blockages') {
                                            setCurrentView('blockages');
                                        } else if (target === 'devis') {
                                            setCurrentView('tickets');
                                            setStatusFilter(RepairStatus.DEVIS_A_VALIDER);
                                        } else if (target === 'en_cours') {
                                            setCurrentView('tickets');
                                            setStatusFilter('EN_COURS');
                                        } else if (target === 'prets') {
                                            setCurrentView('tickets');
                                            setStatusFilter(RepairStatus.TERMINE);
                                        } else {
                                            setCurrentView('tickets');
                                            setStatusFilter('ALL');
                                        }
                                    }}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer"
                                >
                                    <span>Afficher en vue tableau</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>

                                <button
                                    onClick={() => setActiveKpiModal(null)}
                                    className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-all cursor-pointer"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default AssistantClienteleDashboard;
