
import React, { useState, useEffect } from 'react';
import { RepairTicket, RepairStatus } from '../types.ts';
import RepairList from './RepairList.tsx';
import RepairDetail from './RepairDetail.tsx';
import RepairForm from './RepairForm.tsx';
import Dashboard from './Dashboard.tsx';
import AnalyticsReport from './DailyReport.tsx';
import CalendarView from './CalendarView.tsx';
import TicketArchive from './TicketArchive.tsx';
import DiagnosticWorkboard from './DiagnosticWorkboard.tsx';
import { ChartBarIcon, ListBulletIcon, CalendarDaysIcon, SparklesIcon, BookOpenIcon, DocumentMagnifyingGlassIcon } from './icons.tsx';
import DashboardLayout, { NavItem } from './DashboardLayout.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableTicket from './PrintableTicket.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';

interface AdminDashboardProps {
    tickets: RepairTicket[];
    updateTicket: (ticket: RepairTicket) => Promise<void>;
    deleteTicket: (ticketId: string) => Promise<void>;
}

const TicketListsView: React.FC<{
    tickets: RepairTicket[];
    loading: boolean;
    onSelectTicket: (ticket: RepairTicket) => void;
    onEditTicket: (ticket: RepairTicket) => void;
    onDeleteTicket: (ticketId: string) => Promise<void>;
}> = ({ tickets, loading, onSelectTicket, onEditTicket, onDeleteTicket }) => (
     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <RepairList 
            title="À Traiter" 
            tickets={tickets} 
            loading={loading}
            onSelectTicket={onSelectTicket} 
            onEditTicket={onEditTicket} 
            onDeleteTicket={onDeleteTicket}
            statusToShow={[RepairStatus.A_DIAGNOSTIQUER, RepairStatus.DIAGNOSTIC_EN_COURS, RepairStatus.DEVIS_A_VALIDER]} 
        />
        <RepairList 
            title="En Cours" 
            tickets={tickets} 
            loading={loading}
            onSelectTicket={onSelectTicket} 
            onEditTicket={onEditTicket} 
            onDeleteTicket={onDeleteTicket}
            statusToShow={[RepairStatus.DEVIS_APPROUVE, RepairStatus.EN_ATTENTE_DE_PIECES, RepairStatus.REPARATION_EN_COURS, RepairStatus.TESTS_EN_COURS]}
        />
        <RepairList 
            title="Clôturées" 
            tickets={tickets} 
            loading={loading}
            onSelectTicket={onSelectTicket} 
            onEditTicket={onEditTicket} 
            onDeleteTicket={onDeleteTicket}
            statusToShow={[RepairStatus.TERMINE, RepairStatus.RENDU]}
        />
    </div>
);


const AdminDashboard: React.FC<AdminDashboardProps> = ({ tickets, updateTicket, deleteTicket }) => {
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
  const [ticketToEdit, setTicketToEdit] = useState<RepairTicket | null>(null); 
  const [ticketToPrint, setTicketToPrint] = useState<RepairTicket | null>(null);
  const [currentView, setCurrentView] = useState<'lists' | 'dashboard' | 'report' | 'calendar' | 'archive' | 'diagnostics'>('lists');
  const [locationSearch, setLocationSearch] = useState(window.location.search);
  const [isLoading, setIsLoading] = useState(true);
  
  const { settings } = useAppSettings();

  useEffect(() => {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 500); 
      return () => clearTimeout(timer);
  }, [currentView]);

  useEffect(() => {
    const handlePopState = () => {
        setLocationSearch(window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(locationSearch);
    const ticketId = urlParams.get('ticketId');
    if (ticketId && tickets.length > 0) {
      const ticket = tickets.find(t => t.id === ticketId);
      setSelectedTicket(ticket || null);
      setTicketToEdit(null); 
    } else {
      setSelectedTicket(null);
      setTicketToEdit(null); 
    }
  }, [tickets, locationSearch]);


  const handleSelectTicket = (ticket: RepairTicket) => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('ticketId', ticket.id);
    window.history.pushState({}, '', newUrl);
    setLocationSearch(newUrl.search);
  };
  
  const handleBackToList = () => {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('ticketId');
      window.history.pushState({}, '', newUrl);
      setLocationSearch(newUrl.search);
  };
  
  const handleEdit = (ticket: RepairTicket) => {
    setTicketToEdit(ticket);
    setSelectedTicket(null); 
  };
  
  const handleSaveTicket = async (ticketData: Partial<RepairTicket>, action: 'new' | 'close' | 'print') => {
    await updateTicket(ticketData as RepairTicket);
    
    if (action === 'print') {
        setTicketToEdit(null);
        setTimeout(() => setTicketToPrint(ticketData as RepairTicket), 100);
    } else if (action === 'close') {
        setTicketToEdit(null);
        handleSelectTicket(ticketData as RepairTicket);
    }
  };

  const handleCancelForm = () => {
    const ticketBeingEdited = ticketToEdit;
    setTicketToEdit(null);
    if (ticketBeingEdited) {
        handleSelectTicket(ticketBeingEdited); 
    }
  };
  
  const navItems: NavItem[] = [
      { id: 'lists', label: 'Suivi Fiches', icon: ListBulletIcon, isActive: currentView === 'lists', onClick: () => setCurrentView('lists') },
      { id: 'diagnostics', label: 'Diagnostics', icon: DocumentMagnifyingGlassIcon, isActive: currentView === 'diagnostics', onClick: () => setCurrentView('diagnostics') },
      { id: 'dashboard', label: 'Stats Atelier', icon: ChartBarIcon, isActive: currentView === 'dashboard', onClick: () => setCurrentView('dashboard') },
      { id: 'report', label: 'Rapports IA', icon: SparklesIcon, isActive: currentView === 'report', onClick: () => setCurrentView('report') },
      { id: 'calendar', label: 'Calendrier', icon: CalendarDaysIcon, isActive: currentView === 'calendar', onClick: () => setCurrentView('calendar') },
      { id: 'archive', label: 'Archives', icon: BookOpenIcon, isActive: currentView === 'archive', onClick: () => setCurrentView('archive') },
  ];

  const renderContent = () => {
      if (ticketToEdit) {
          return <RepairForm tickets={tickets} ticketToEdit={ticketToEdit} onSave={handleSaveTicket} onCancel={handleCancelForm} role="Technicien" />;
      }

      if (selectedTicket) {
        return <RepairDetail ticket={selectedTicket} onBack={handleBackToList} onUpdate={updateTicket} onDelete={deleteTicket} role="Technicien" onEdit={handleEdit} />;
      }
      
      switch (currentView) {
        case 'dashboard':
            return <Dashboard tickets={tickets} />;
        case 'diagnostics':
            return <DiagnosticWorkboard tickets={tickets} onSelectTicket={handleSelectTicket} onUpdateTicket={updateTicket} />;
        case 'report':
            return <AnalyticsReport tickets={tickets} onBack={() => setCurrentView('lists')} />;
        case 'calendar':
            return <CalendarView tickets={tickets} onSelectTicket={handleSelectTicket} />;
        case 'archive':
            return <TicketArchive tickets={tickets} onSelectTicket={handleSelectTicket} onPrintTicket={setTicketToPrint} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} />;
        case 'lists':
        default:
            return <TicketListsView tickets={tickets} loading={isLoading} onSelectTicket={handleSelectTicket} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} />;
        }
    };

  return (
    <DashboardLayout title="Technicien" navItems={navItems}>
        {renderContent()}
        {ticketToPrint && (
            <PreviewModal
                isOpen={!!ticketToPrint}
                onClose={() => setTicketToPrint(null)}
                fileName={`fiche_${ticketToPrint.id}.pdf`}
            >
                <PrintableTicket 
                    ticket={ticketToPrint} 
                    printSettings={settings.print} 
                    customFieldDefs={settings.customFields.ticket} 
                />
            </PreviewModal>
        )}
    </DashboardLayout>
  );
};

export default AdminDashboard;
