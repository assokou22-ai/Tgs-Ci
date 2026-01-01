
import React, { useState, useEffect } from 'react';
import { RepairTicket, RepairStatus, Role } from '../types.ts';
import RepairList from './RepairList.tsx';
import RepairDetail from './RepairDetail.tsx';
import RepairForm from './RepairForm.tsx';
import { PlusCircleIcon, CalendarDaysIcon, ListBulletIcon, BookOpenIcon } from './icons.tsx';
import AppointmentCalendarView from './AppointmentCalendarView.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableTicket from './PrintableTicket.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import DashboardLayout, { NavItem } from './DashboardLayout.tsx';
import TicketArchive from './TicketArchive.tsx';

interface AccueilDashboardProps {
    tickets: RepairTicket[];
    addTicket: (ticket: Partial<RepairTicket>, role: Role) => Promise<RepairTicket>;
    updateTicket: (ticket: RepairTicket, oldId?: string) => Promise<void>;
    deleteTicket: (ticketId: string) => Promise<void>;
}

const AccueilDashboard: React.FC<AccueilDashboardProps> = ({ tickets, addTicket, updateTicket, deleteTicket }) => {
    const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [ticketToEdit, setTicketToEdit] = useState<RepairTicket | null>(null);
    const [ticketToPrint, setTicketToPrint] = useState<RepairTicket | null>(null);
    const [view, setView] = useState<'list' | 'calendar' | 'archive'>('list');
    const [locationSearch, setLocationSearch] = useState(window.location.search);

    const { settings } = useAppSettings();

    useEffect(() => {
        const handlePopState = () => setLocationSearch(window.location.search);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(locationSearch);
        const ticketId = urlParams.get('ticketId');
        if (ticketId) {
            const ticket = tickets.find(t => t.id === ticketId);
            setSelectedTicket(ticket || null);
        } else {
            setSelectedTicket(null);
        }
    }, [tickets, locationSearch]);

    const handleSelectTicket = (ticket: RepairTicket) => {
        setIsCreating(false);
        setTicketToEdit(null);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('ticketId', ticket.id);
        window.history.pushState({}, '', newUrl);
        setLocationSearch(newUrl.search);
    };

    const handleBack = () => {
        setSelectedTicket(null);
        setIsCreating(false);
        setTicketToEdit(null);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('ticketId');
        window.history.pushState({}, '', newUrl);
        setLocationSearch(newUrl.search);
    };

    const handleEdit = (ticket: RepairTicket) => {
        setSelectedTicket(null);
        setIsCreating(false);
        setTicketToEdit(ticket);
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
                handleSelectTicket(newTicket);
            } else if (action === 'print') {
                setIsCreating(false);
                setTicketToPrint(newTicket);
            }
            return newTicket;
        }
    };

    const navItems: NavItem[] = [
        { id: 'list', label: 'Suivi', icon: ListBulletIcon, isActive: view === 'list' && !isCreating && !selectedTicket, onClick: () => { setView('list'); handleBack(); } },
        { id: 'archive', label: 'Toutes les Fiches', icon: BookOpenIcon, isActive: view === 'archive' && !isCreating && !selectedTicket, onClick: () => { setView('archive'); handleBack(); } },
        { id: 'calendar', label: 'RDV', icon: CalendarDaysIcon, isActive: view === 'calendar' && !isCreating && !selectedTicket, onClick: () => { setView('calendar'); handleBack(); } },
        { id: 'new', label: 'Nouveau Dossier', icon: PlusCircleIcon, isActive: isCreating, onClick: () => { handleBack(); setIsCreating(true); } },
    ];

    return (
        <DashboardLayout title="Accueil" navItems={navItems}>
            {isCreating || ticketToEdit ? (
                <RepairForm tickets={tickets} onSave={handleSaveTicket} onCancel={() => { setIsCreating(false); setTicketToEdit(null); if (selectedTicket) handleSelectTicket(selectedTicket); }} ticketToEdit={ticketToEdit} role="Accueil" />
            ) : selectedTicket ? (
                <RepairDetail ticket={selectedTicket} onBack={handleBack} onUpdate={updateTicket} onDelete={deleteTicket} role="Accueil" onEdit={handleEdit} />
            ) : view === 'archive' ? (
                <TicketArchive tickets={tickets} onSelectTicket={handleSelectTicket} onPrintTicket={setTicketToPrint} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} />
            ) : view === 'list' ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <RepairList title="À Diagnostiquer" tickets={tickets} onSelectTicket={handleSelectTicket} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} statusToShow={[RepairStatus.A_DIAGNOSTIQUER]} loading={false} />
                    <RepairList title="Diagnostic en cours" tickets={tickets} onSelectTicket={handleSelectTicket} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} statusToShow={[RepairStatus.DIAGNOSTIC_EN_COURS, RepairStatus.DEVIS_A_VALIDER]} loading={false} />
                    <RepairList title="En réparation" tickets={tickets} onSelectTicket={handleSelectTicket} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} statusToShow={[RepairStatus.DEVIS_APPROUVE, RepairStatus.EN_ATTENTE_DE_PIECES, RepairStatus.REPARATION_EN_COURS, RepairStatus.TESTS_EN_COURS]} loading={false} />
                    <RepairList title="Prêt / Terminé" tickets={tickets} onSelectTicket={handleSelectTicket} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} statusToShow={[RepairStatus.TERMINE, RepairStatus.NON_REPARABLE]} loading={false} />
                    <RepairList title="Rendus" tickets={tickets} onSelectTicket={handleSelectTicket} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} statusToShow={[RepairStatus.RENDU]} loading={false} />
                </div>
            ) : (
                <AppointmentCalendarView tickets={tickets} />
            )}
            
            {ticketToPrint && (
                <PreviewModal isOpen={!!ticketToPrint} onClose={() => setTicketToPrint(null)} fileName={`fiche_${ticketToPrint.id}.pdf`}>
                    <PrintableTicket ticket={ticketToPrint} printSettings={settings.print} customFieldDefs={settings.customFields.ticket} />
                </PreviewModal>
            )}
        </DashboardLayout>
    );
};

export default AccueilDashboard;
