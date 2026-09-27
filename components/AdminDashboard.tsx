
import React, { useState, useEffect, useMemo } from 'react';
import { RepairTicket, RepairStatus } from '../types.ts';
import RepairList from './RepairList.tsx';
import RepairDetail from './RepairDetail.tsx';
import RepairForm from './RepairForm.tsx';
import EnterpriseRepairForm from './EnterpriseRepairForm.tsx';
import Dashboard from './Dashboard.tsx';
import AnalyticsReport from './DailyReport.tsx';
import CalendarView from './CalendarView.tsx';
import TicketArchive from './TicketArchive.tsx';
import DiagnosticWorkboard from './DiagnosticWorkboard.tsx';
import { ChartBarIcon, ListBulletIcon, CalendarDaysIcon, SparklesIcon, BookOpenIcon, DocumentMagnifyingGlassIcon, ClockIcon } from './icons.tsx';
import DashboardLayout, { NavItem } from './DashboardLayout.tsx';
import ActionsDuJourView from './ActionsDuJourView.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableTicket from './PrintableTicket.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { useOrientation } from '../hooks/useOrientation.ts';

interface AdminDashboardProps {
    tickets: RepairTicket[];
    updateTicket: (ticket: RepairTicket) => Promise<void>;
    deleteTicket: (ticketId: string) => Promise<void>;
    loading: boolean;
}

const TicketListsView: React.FC<{
    tickets: RepairTicket[];
    loading: boolean;
    onSelectTicket: (ticket: RepairTicket) => void;
    onEditTicket: (ticket: RepairTicket) => void;
    onDeleteTicket: (ticket: RepairTicket) => void;
}> = ({ tickets, loading, onSelectTicket, onEditTicket, onDeleteTicket }) => {
    const { isMobile, isMobileLandscape } = useOrientation();
    const [activeCategoryMobile, setActiveCategoryMobile] = useState<'a_traiter' | 'en_cours' | 'clotures'>('a_traiter');

    return (
        <div className="space-y-4">
            {(isMobile || isMobileLandscape) && (
                <div className="flex bg-zinc-950/60 p-1.5 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar gap-1">
                    <button
                        onClick={() => setActiveCategoryMobile('a_traiter')}
                        className={`flex-1 min-w-[90px] text-center py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeCategoryMobile === 'a_traiter'
                                ? 'bg-apple-blue text-white shadow-lg'
                                : 'text-zinc-500 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        À Traiter ({tickets.filter(t => [RepairStatus.A_DIAGNOSTIQUER, RepairStatus.DIAGNOSTIC_EN_COURS, RepairStatus.DEVIS_A_VALIDER].includes(t.status)).length})
                    </button>
                    <button
                        onClick={() => setActiveCategoryMobile('en_cours')}
                        className={`flex-1 min-w-[90px] text-center py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeCategoryMobile === 'en_cours'
                                ? 'bg-apple-blue text-white shadow-lg'
                                : 'text-zinc-500 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        En Cours ({tickets.filter(t => [RepairStatus.DEVIS_APPROUVE, RepairStatus.EN_ATTENTE_DE_PIECES, RepairStatus.REPARATION_EN_COURS, RepairStatus.TESTS_EN_COURS].includes(t.status)).length})
                    </button>
                    <button
                        onClick={() => setActiveCategoryMobile('clotures')}
                        className={`flex-1 min-w-[90px] text-center py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeCategoryMobile === 'clotures'
                                ? 'bg-apple-blue text-white shadow-lg'
                                : 'text-zinc-500 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        Clôturés ({tickets.filter(t => [RepairStatus.TERMINE, RepairStatus.RENDU, RepairStatus.NON_REPARABLE, RepairStatus.ANNULE, RepairStatus.REPORTE].includes(t.status)).length})
                    </button>
                </div>
            )}

            <div className={(isMobile || isMobileLandscape) ? 'block space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6'}>
                {(!(isMobile || isMobileLandscape) || activeCategoryMobile === 'a_traiter') && (
                    <RepairList 
                        title="À Traiter" 
                        tickets={tickets} 
                        loading={loading}
                        onSelectTicket={onSelectTicket} 
                        onEditTicket={onEditTicket} 
                        onDeleteTicket={(ticketId) => {
                            const t = tickets.find(x => x.id === ticketId);
                            if (t) onDeleteTicket(t);
                        }}
                        statusToShow={[RepairStatus.A_DIAGNOSTIQUER, RepairStatus.DIAGNOSTIC_EN_COURS, RepairStatus.DEVIS_A_VALIDER]} 
                    />
                )}
                {(!(isMobile || isMobileLandscape) || activeCategoryMobile === 'en_cours') && (
                    <RepairList 
                        title="En Cours" 
                        tickets={tickets} 
                        loading={loading}
                        onSelectTicket={onSelectTicket} 
                        onEditTicket={onEditTicket} 
                        onDeleteTicket={(ticketId) => {
                            const t = tickets.find(x => x.id === ticketId);
                            if (t) onDeleteTicket(t);
                        }}
                        statusToShow={[RepairStatus.DEVIS_APPROUVE, RepairStatus.EN_ATTENTE_DE_PIECES, RepairStatus.REPARATION_EN_COURS, RepairStatus.TESTS_EN_COURS]}
                    />
                )}
                {(!(isMobile || isMobileLandscape) || activeCategoryMobile === 'clotures') && (
                    <RepairList 
                        title="Clôturées, Annulées & Reportées" 
                        tickets={tickets} 
                        loading={loading}
                        onSelectTicket={onSelectTicket} 
                        onEditTicket={onEditTicket} 
                        onDeleteTicket={(ticketId) => {
                            const t = tickets.find(x => x.id === ticketId);
                            if (t) onDeleteTicket(t);
                        }}
                        statusToShow={[RepairStatus.TERMINE, RepairStatus.RENDU, RepairStatus.NON_REPARABLE, RepairStatus.ANNULE, RepairStatus.REPORTE]}
                    />
                )}
            </div>
        </div>
    );
};


const AdminDashboard: React.FC<AdminDashboardProps> = ({ tickets, updateTicket, deleteTicket, loading }) => {
  const [ticketToEdit, setTicketToEdit] = useState<RepairTicket | null>(null); 
  const [ticketToPrint, setTicketToPrint] = useState<RepairTicket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<RepairTicket | null>(null);
  const [currentView, setCurrentView] = useState<'lists' | 'diagnostics' | 'dashboard' | 'report' | 'calendar' | 'archive' | 'actions'>('lists');
  const [locationSearch, setLocationSearch] = useState(window.location.search);
  const [isLoading, setIsLoading] = useState(false);
  
  const { settings } = useAppSettings();

  const handleSetView = (view: typeof currentView) => {
    setIsLoading(true);
    setCurrentView(view);
    setTimeout(() => setIsLoading(false), 500);
  };

  useEffect(() => {
    const handlePopState = () => setLocationSearch(window.location.search);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  const selectedTicket = useMemo(() => {
    const urlParams = new URLSearchParams(locationSearch);
    const ticketId = urlParams.get('ticketId');
    if (ticketId && tickets.length > 0) {
      return tickets.find(t => t.id.trim().toUpperCase() === ticketId.trim().toUpperCase()) || null;
    }
    return null;
  }, [tickets, locationSearch]);

  useEffect(() => {
    if (selectedTicket && ticketToEdit) {
      setTimeout(() => setTicketToEdit(null), 0);
    }
  }, [selectedTicket, ticketToEdit]);

  const handleSelectTicket = (ticket: RepairTicket) => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('ticketId', ticket.id);
    window.history.pushState({}, '', newUrl);
    setLocationSearch(newUrl.search);
  };
  
  const handleBackToList = () => {
      if (ticketToEdit) {
          setTicketToEdit(null);
          if (selectedTicket) handleSelectTicket(selectedTicket);
          return;
      }
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('ticketId');
      window.history.pushState({}, '', newUrl);
      setLocationSearch(newUrl.search);
      if (currentView !== 'lists') handleSetView('lists');
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

  const handleExitRole = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('role');
      url.searchParams.delete('ticketId');
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
  };
  
  const handleEdit = (ticket: RepairTicket) => {
    setTicketToEdit(ticket);
  };
  
  const handleSaveTicket = async (ticketData: Partial<RepairTicket>, action: 'new' | 'close' | 'print', oldId?: string) => {
    await updateTicket(ticketData as RepairTicket, oldId);
    if (action === 'print') {
        setTicketToEdit(null);
        setTimeout(() => setTicketToPrint(ticketData as RepairTicket), 100);
    } else if (action === 'close') {
        setTicketToEdit(null);
        handleSelectTicket(ticketData as RepairTicket);
    }
  };

  const confirmDelete = async () => {
      if (ticketToDelete) {
          await deleteTicket(ticketToDelete.id);
          setTicketToDelete(null);
          handleBackToList();
      }
  };

  const handleCancelForm = () => {
    const ticketBeingEdited = ticketToEdit;
    setTicketToEdit(null);
    if (ticketBeingEdited) handleSelectTicket(ticketBeingEdited); 
  };
  
  const navItems: NavItem[] = [
      { id: 'actions', label: 'Actions du jour', icon: ClockIcon, isActive: currentView === 'actions', onClick: () => handleSetView('actions') },
      { id: 'lists', label: 'Suivi Fiches', icon: ListBulletIcon, isActive: currentView === 'lists', onClick: () => handleSetView('lists') },
      { id: 'diagnostics', label: 'Diagnostics', icon: DocumentMagnifyingGlassIcon, isActive: currentView === 'diagnostics', onClick: () => handleSetView('diagnostics') },
      { id: 'dashboard', label: 'Stats Atelier', icon: ChartBarIcon, isActive: currentView === 'dashboard', onClick: () => handleSetView('dashboard') },
      { id: 'report', label: 'Rapports IA', icon: SparklesIcon, isActive: currentView === 'report', onClick: () => handleSetView('report') },
      { id: 'calendar', label: 'Calendrier', icon: CalendarDaysIcon, isActive: currentView === 'calendar', onClick: () => handleSetView('calendar') },
      { id: 'archive', label: 'Archives', icon: BookOpenIcon, isActive: currentView === 'archive', onClick: () => handleSetView('archive') },
  ];

  const renderContent = () => {
      if (ticketToEdit) {
          const activeTicketToEdit = tickets.find(t => t.id === ticketToEdit.id) || ticketToEdit;
          if (activeTicketToEdit.client.isEnterprise) {
              return <EnterpriseRepairForm tickets={tickets} ticketToEdit={activeTicketToEdit} onSave={handleSaveTicket} onCancel={handleCancelForm} />;
          }
          return <RepairForm tickets={tickets} ticketToEdit={activeTicketToEdit} onSave={handleSaveTicket} onCancel={handleCancelForm} role="Technicien" />;
      }
      if (selectedTicket) {
        return (
          <RepairDetail 
            ticket={selectedTicket} 
            onBack={handleBackToList} 
            onUpdate={handleUpdateTicket} 
            onDelete={() => setTicketToDelete(selectedTicket)} 
            role="Technicien" 
            onEdit={handleEdit} 
          />
        );
      }
      switch (currentView) {
        case 'actions': return <ActionsDuJourView tickets={tickets} onSelectTicket={handleSelectTicket} />;
        case 'dashboard': return <Dashboard tickets={tickets} />;
        case 'diagnostics': return <DiagnosticWorkboard tickets={searchedTickets} onSelectTicket={handleSelectTicket} onUpdateTicket={updateTicket} />;
        case 'report': return <AnalyticsReport tickets={tickets} onBack={handleBackToList} />;
        case 'calendar': return <CalendarView tickets={searchedTickets} onSelectTicket={handleSelectTicket} />;
        case 'archive': return (
          <TicketArchive 
            tickets={searchedTickets} 
            onSelectTicket={handleSelectTicket} 
            onPrintTicket={setTicketToPrint} 
            onEditTicket={handleEdit} 
            onDeleteTicket={deleteTicket} 
            onUpdateTicket={updateTicket}
          />
        );
        case 'lists':
        default: return (
          <TicketListsView 
            tickets={searchedTickets} 
            loading={loading || isLoading} 
            onSelectTicket={handleSelectTicket} 
            onEditTicket={handleEdit} 
            onDeleteTicket={setTicketToDelete} 
          />
        );
        }
    };

  return (
    <DashboardLayout 
        title="Technicien" 
        navItems={navItems} 
        onBack={(selectedTicket || ticketToEdit || currentView !== 'lists') ? handleBackToList : undefined}
        onExitRole={handleExitRole}
    >
        {renderContent()}
        {ticketToPrint && (
            <PreviewModal isOpen={!!ticketToPrint} onClose={() => setTicketToPrint(null)} fileName={`fiche_${ticketToPrint.id}.pdf`}>
                <PrintableTicket ticket={ticketToPrint} printSettings={settings.print} customFieldDefs={settings.customFields.ticket} />
            </PreviewModal>
        )}
        <ConfirmationModal
            isOpen={!!ticketToDelete}
            onClose={() => setTicketToDelete(null)}
            onConfirm={confirmDelete}
            title="Supprimer la fiche ?"
            message={`Vous allez supprimer définitivement le dossier de ${ticketToDelete?.client.name}. Cette action est irréversible.`}
            confirmText="Supprimer définitivement"
        />
    </DashboardLayout>
  );
};

export default AdminDashboard;
