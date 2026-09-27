
import React, { useState, useEffect, useMemo } from 'react';
import { RepairTicket, RepairStatus, Role } from '../types.ts';
import RepairList from './RepairList.tsx';
import { SyncDiagnosticPanel } from './SyncDiagnosticPanel.tsx';
import RepairDetail from './RepairDetail.tsx';
import RepairForm from './RepairForm.tsx';
import EnterpriseRepairForm from './EnterpriseRepairForm.tsx';
import { PlusCircleIcon, CalendarDaysIcon, ListBulletIcon, BookOpenIcon, BuildingStorefrontIcon, ClockIcon } from './icons.tsx';
import AppointmentCalendarView from './AppointmentCalendarView.tsx';
import ActionsDuJourView from './ActionsDuJourView.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableTicket from './PrintableTicket.tsx';
import PrintableEnterpriseBon from './PrintableEnterpriseBon.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import DashboardLayout, { NavItem } from './DashboardLayout.tsx';
import TicketArchive from './TicketArchive.tsx';
import { useOrientation } from '../hooks/useOrientation.ts';

interface AccueilDashboardProps {
    tickets: RepairTicket[];
    addTicket: (ticket: Partial<RepairTicket>, role: Role) => Promise<RepairTicket>;
    updateTicket: (ticket: RepairTicket, oldId?: string) => Promise<void>;
    deleteTicket: (ticketId: string) => Promise<void>;
    loading: boolean;
}

const AccueilDashboard: React.FC<AccueilDashboardProps> = ({ tickets, addTicket, updateTicket, deleteTicket, loading }) => {
    const { isMobile, isMobileLandscape } = useOrientation();
    const [isCreating, setIsCreating] = useState(false);
    const [isCreatingEnterprise, setIsCreatingEnterprise] = useState(false);
    const [ticketToEdit, setTicketToEdit] = useState<RepairTicket | null>(null);
    const [ticketToPrint, setTicketToPrint] = useState<RepairTicket | null>(null);
    const [printType, setPrintType] = useState<'standard' | 'diagnostic'>('standard');
    const [ticketToDelete, setTicketToDelete] = useState<RepairTicket | null>(null);
    const [view, setView] = useState<'list' | 'calendar' | 'archive' | 'enterprise' | 'actions'>('list');
    const [locationSearch, setLocationSearch] = useState(window.location.search);
    const [activeCategoryMobile, setActiveCategoryMobile] = useState<'encours' | 'traites' | 'rendus'>('encours');

    useEffect(() => {
        const handlePopState = () => setLocationSearch(window.location.search);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const selectedTicket = useMemo(() => {
        const urlParams = new URLSearchParams(locationSearch);
        const ticketId = urlParams.get('ticketId');
        if (ticketId && tickets.length > 0) {
            return tickets.find(t => t.id.trim().toUpperCase() === ticketId.trim().toUpperCase()) || null;
        }
        return null;
    }, [tickets, locationSearch]);

    const handleSelectTicket = (ticket: RepairTicket) => {
        setIsCreating(false);
        setIsCreatingEnterprise(false);
        setTicketToEdit(null);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('ticketId', ticket.id);
        window.history.pushState({}, '', newUrl);
        setLocationSearch(newUrl.search);
    };

    const handleBack = () => {
        if (isCreating || isCreatingEnterprise || ticketToEdit) {
            setIsCreating(false);
            setIsCreatingEnterprise(false);
            setTicketToEdit(null);
            return;
        }
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('ticketId');
        window.history.pushState({}, '', newUrl);
        setLocationSearch(newUrl.search);
        if (view !== 'list') setView('list');
    };

    const handleExitRole = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('role');
        url.searchParams.delete('ticketId');
        window.history.pushState({}, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    const handleEdit = (ticket: RepairTicket) => {
        setIsCreating(false);
        setIsCreatingEnterprise(false);
        setTicketToEdit(ticket);
    };

    const confirmDelete = async () => {
        if (ticketToDelete) {
            await deleteTicket(ticketToDelete.id);
            setTicketToDelete(null);
            handleBack();
        }
    };

    const handlePrintTicket = (ticket: RepairTicket, type: 'standard' | 'diagnostic' = 'standard') => {
        setPrintType(type);
        setTicketToPrint(ticket);
    };

    const handleSaveTicket = async (ticketData: Partial<RepairTicket>, action: 'new' | 'close' | 'print', oldId?: string): Promise<RepairTicket | void> => {
        if (ticketToEdit) {
            await updateTicket(ticketData as RepairTicket, oldId);
            setTicketToEdit(null);
            handleSelectTicket(ticketData as RepairTicket);
            return ticketData as RepairTicket;
        } else {
            const newTicket = await addTicket(ticketData, 'Accueil');
            if (action === 'close') {
                setIsCreating(false);
                setIsCreatingEnterprise(false);
                handleSelectTicket(newTicket);
            } else if (action === 'print') {
                setIsCreating(false);
                setIsCreatingEnterprise(false);
                setTicketToPrint(newTicket);
            }
            return newTicket;
        }
    };

    const handleUpdateTicket = async (updated: RepairTicket, oldId?: string) => {
        await updateTicket(updated, oldId);
        if (oldId && oldId !== updated.id) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('ticketId', updated.id);
            window.history.replaceState({}, '', newUrl);
            setLocationSearch(newUrl.search);
        }
    };

    const navItems: NavItem[] = [
        { id: 'actions', label: 'Actions du jour', icon: ClockIcon, isActive: view === 'actions' && !isCreating && !isCreatingEnterprise && !selectedTicket, onClick: () => { setView('actions'); handleBack(); } },
        { id: 'list', label: 'Suivi', icon: ListBulletIcon, isActive: view === 'list' && !isCreating && !isCreatingEnterprise && !selectedTicket, onClick: () => { setView('list'); handleBack(); } },
        { id: 'archive', label: 'Toutes les Fiches', icon: BookOpenIcon, isActive: view === 'archive' && !isCreating && !isCreatingEnterprise && !selectedTicket, onClick: () => { setView('archive'); handleBack(); } },
        { id: 'calendar', label: 'RDV', icon: CalendarDaysIcon, isActive: view === 'calendar' && !isCreating && !isCreatingEnterprise && !selectedTicket, onClick: () => { setView('calendar'); handleBack(); } },
        { id: 'new', label: 'Nouveau Dossier', icon: PlusCircleIcon, isActive: isCreating, onClick: () => { handleBack(); setIsCreating(true); } },
        { id: 'enterprise', label: 'Fiches client Entreprise', icon: BuildingStorefrontIcon, isActive: (view === 'enterprise' || isCreatingEnterprise) && !selectedTicket, onClick: () => { setView('enterprise'); handleBack(); } },
    ];

    const searchQuery = useMemo(() => {
        const urlParams = new URLSearchParams(locationSearch);
        return urlParams.get('search') || urlParams.get('q') || '';
    }, [locationSearch]);

    const searchedTickets = useMemo(() => {
        if (!searchQuery) {
            return tickets;
        }
        const lowerVal = searchQuery.toLowerCase();
        return tickets.filter(t => 
            t.id.toLowerCase().includes(lowerVal) ||
            t.client.name.toLowerCase().includes(lowerVal) ||
            (t.client.phone || '').toLowerCase().includes(lowerVal) ||
            (t.macBrand || '').toLowerCase().includes(lowerVal) ||
            (t.macModel || '').toLowerCase().includes(lowerVal) ||
            (t.serialNumber || '').toLowerCase().includes(lowerVal)
        );
    }, [tickets, searchQuery]);

    const enterpriseTickets = useMemo(() => searchedTickets.filter(t => t.client.isEnterprise), [searchedTickets]);

    return (
        <DashboardLayout 
            title="Accueil" 
            navItems={navItems}
            onBack={(selectedTicket || isCreating || isCreatingEnterprise || ticketToEdit || view !== 'list') ? handleBack : undefined}
            onExitRole={handleExitRole}
        >
            {isCreating || (ticketToEdit && !ticketToEdit.client.isEnterprise) ? (
                <RepairForm tickets={tickets} onSave={handleSaveTicket} onCancel={handleBack} ticketToEdit={ticketToEdit ? (tickets.find(t => t.id === ticketToEdit.id) || ticketToEdit) : null} role="Accueil" />
            ) : isCreatingEnterprise || (ticketToEdit && ticketToEdit.client.isEnterprise) ? (
                <EnterpriseRepairForm tickets={tickets} onSave={handleSaveTicket} onCancel={handleBack} ticketToEdit={ticketToEdit ? (tickets.find(t => t.id === ticketToEdit.id) || ticketToEdit) : null} />
            ) : selectedTicket ? (
                <RepairDetail ticket={selectedTicket} onBack={handleBack} onUpdate={handleUpdateTicket} onDelete={() => setTicketToDelete(selectedTicket)} role="Accueil" onEdit={handleEdit} />
            ) : view === 'actions' ? (
                <ActionsDuJourView tickets={tickets} onSelectTicket={handleSelectTicket} />
            ) : view === 'archive' ? (
                <TicketArchive tickets={searchedTickets} onSelectTicket={handleSelectTicket} onPrintTicket={(t) => handlePrintTicket(t, 'standard')} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} onUpdateTicket={updateTicket} />
            ) : view === 'enterprise' ? (
                <div className="space-y-6">
                    <div className="apple-card p-8 bg-purple-600/5 border border-purple-500/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                         <div>
                            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Portefeuille Entreprises</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Dossiers techniques liés aux comptes professionnels et flottes de parc.</p>
                         </div>
                         <button 
                            onClick={() => setIsCreatingEnterprise(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-purple-900/40"
                         >
                            <PlusCircleIcon className="w-5 h-5" />
                            Nouvelle Fiche Entreprise
                         </button>
                    </div>
                    <TicketArchive 
                        tickets={enterpriseTickets} 
                        onSelectTicket={handleSelectTicket} 
                        onPrintTicket={(t) => handlePrintTicket(t, 'standard')} 
                        onEditTicket={handleEdit} 
                        onDeleteTicket={deleteTicket} 
                        onUpdateTicket={updateTicket}
                    />
                </div>
            ) : view === 'list' ? (
                 <div className="space-y-6">
                     {(isMobile || isMobileLandscape) && (
                         <div className="flex bg-zinc-950/60 p-1.5 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar gap-1">
                             <button
                                 onClick={() => setActiveCategoryMobile('encours')}
                                 className={`flex-1 min-w-[90px] text-center py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                     activeCategoryMobile === 'encours'
                                         ? 'bg-apple-blue text-white shadow-lg'
                                         : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                 }`}
                             >
                                 En Cours ({searchedTickets.filter(t => [RepairStatus.A_DIAGNOSTIQUER, RepairStatus.DIAGNOSTIC_EN_COURS, RepairStatus.DEVIS_A_VALIDER, RepairStatus.DEVIS_APPROUVE, RepairStatus.EN_ATTENTE_DE_PIECES, RepairStatus.REPARATION_EN_COURS, RepairStatus.TESTS_EN_COURS].includes(t.status)).length})
                             </button>
                             <button
                                 onClick={() => setActiveCategoryMobile('traites')}
                                 className={`flex-1 min-w-[90px] text-center py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                     activeCategoryMobile === 'traites'
                                         ? 'bg-apple-blue text-white shadow-lg'
                                         : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                 }`}
                             >
                                 Traités ({searchedTickets.filter(t => [RepairStatus.REPORTE, RepairStatus.TERMINE, RepairStatus.NON_REPARABLE, RepairStatus.ANNULE].includes(t.status)).length})
                             </button>
                             <button
                                 onClick={() => setActiveCategoryMobile('rendus')}
                                 className={`flex-1 min-w-[90px] text-center py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                     activeCategoryMobile === 'rendus'
                                         ? 'bg-apple-blue text-white shadow-lg'
                                         : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                 }`}
                             >
                                 Rendus ({searchedTickets.filter(t => t.status === RepairStatus.RENDU).length})
                             </button>
                         </div>
                     )}

                     <div className={(isMobile || isMobileLandscape) ? 'block space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6'}>
                         {(!(isMobile || isMobileLandscape) || activeCategoryMobile === 'encours') && (
                             <RepairList title="Diagnostic & Réparation" tickets={searchedTickets} onSelectTicket={handleSelectTicket} onEditTicket={handleEdit} onDeleteTicket={async (id) => setTicketToDelete(tickets.find(t=>t.id===id)||null)} statusToShow={[RepairStatus.A_DIAGNOSTIQUER, RepairStatus.DIAGNOSTIC_EN_COURS, RepairStatus.DEVIS_A_VALIDER, RepairStatus.DEVIS_APPROUVE, RepairStatus.EN_ATTENTE_DE_PIECES, RepairStatus.REPARATION_EN_COURS, RepairStatus.TESTS_EN_COURS]} loading={loading} onPrintTicket={handlePrintTicket} />
                         )}
                         {(!(isMobile || isMobileLandscape) || activeCategoryMobile === 'traites') && (
                             <RepairList title="Reporté, Terminé & Annulé" tickets={searchedTickets} onSelectTicket={handleSelectTicket} onEditTicket={handleEdit} onDeleteTicket={async (id) => setTicketToDelete(tickets.find(t=>t.id===id)||null)} statusToShow={[RepairStatus.REPORTE, RepairStatus.TERMINE, RepairStatus.NON_REPARABLE, RepairStatus.ANNULE]} loading={loading} onPrintTicket={handlePrintTicket} />
                         )}
                         {(!(isMobile || isMobileLandscape) || activeCategoryMobile === 'rendus') && (
                             <RepairList title="Rendus" tickets={searchedTickets} onSelectTicket={handleSelectTicket} onEditTicket={handleEdit} onDeleteTicket={async (id) => setTicketToDelete(tickets.find(t=>t.id===id)||null)} statusToShow={[RepairStatus.RENDU]} loading={loading} onPrintTicket={handlePrintTicket} />
                         )}
                     </div>
                     <SyncDiagnosticPanel />
                  </div>
            ) : (
                <AppointmentCalendarView tickets={tickets} />
            )}
            
            {ticketToPrint && (
                <PreviewModal isOpen={!!ticketToPrint} onClose={() => setTicketToPrint(null)} fileName={`${printType === 'diagnostic' ? 'diagnostic' : 'fiche'}_${ticketToPrint.id}.pdf`}>
                    <div className="flex flex-col">
                        <PrintableTicket 
                            ticket={ticketToPrint} 
                            forceDiagnosticOnly={printType === 'diagnostic'}
                        />
                        {ticketToPrint.client.isEnterprise && printType === 'standard' && <PrintableEnterpriseBon ticket={ticketToPrint} />}
                    </div>
                </PreviewModal>
            )}

            <ConfirmationModal
                isOpen={!!ticketToDelete}
                onClose={() => setTicketToDelete(null)}
                onConfirm={confirmDelete}
                title="Confirmer la suppression ?"
                message={`Voulez-vous vraiment effacer le dossier de ${ticketToDelete?.client.name} ? Cette opération est définitive.`}
                confirmText="Oui, Supprimer"
                confirmButtonClass="bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20"
            />
        </DashboardLayout>
    );
};

export default AccueilDashboard;
