
import React, { useState, useEffect } from 'react';
import useServices from '../hooks/useServices.ts';
import StockManager from './StockManager.tsx';
import { 
    PencilIcon, 
    TrashIcon,
    ChartBarIcon,
    WrenchScrewdriverIcon,
    CurrencyEuroIcon,
    UserGroupIcon,
    BookOpenIcon,
    ClockIcon,
    ListBulletIcon,
    DocumentArrowDownIcon,
    ArrowPathIcon,
    CloudArrowDownIcon,
    DocumentDuplicateIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon
} from './icons.tsx';
import { RepairServiceItem, LogEntry, RepairTicket, Client, Appointment } from '../types.ts';
import ERPDashboard from './ERPDashboard.tsx';
import useLogs from '../hooks/useLogs.ts';
import ClientManager from './ClientManager.tsx';
import Modal from './Modal.tsx';
import AppSettingsManager from './AppSettingsManager.tsx';
import RepairDetail from './RepairDetail.tsx';
import RepairForm from './RepairForm.tsx';
import CustomFieldsManager from './CustomFieldsManager.tsx';
import DeviceHistoryViewer from './DeviceHistoryViewer.tsx';
import InternalDocSearch from './InternalDocSearch.tsx';
import { playTone } from '../utils/audio.ts';
import ExportManager from './ExportManager.tsx';
import BackupManager from './BackupManager.tsx';
import KnowledgeBaseManager from './KnowledgeBaseManager.tsx';
import DashboardLayout, { NavItem } from './DashboardLayout.tsx';
import SimpleDocumentGenerator from './SimpleDocumentGenerator.tsx';
import TicketArchive from './TicketArchive.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableTicket from './PrintableTicket.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import ProblemModelMatrix from './ProblemModelMatrix.tsx';


const LogViewer: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Journal des Modifications</h2>
            {logs.length > 0 ? (
                <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {logs.map(log => (
                        <li key={log.id} className="flex items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm">
                            <span className={`w-2 h-2 rounded-full ${log.type === 'Ajout' ? 'bg-green-500' : 'bg-red-500'} mr-3 flex-shrink-0`} title={log.type}></span>
                            <span className="text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0">
                                {new Date(log.timestamp).toLocaleString('fr-FR')}
                            </span>
                            <span className="truncate">{log.message}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-500">Aucune modification enregistrée.</p>
            )}
        </div>
    );
};

const ServiceEditForm: React.FC<{
    service: RepairServiceItem;
    onSave: (service: RepairServiceItem) => void;
    onCancel: () => void;
}> = ({ service, onSave, onCancel }) => {
    const [formData, setFormData] = useState(service);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'price' ? Number(value) || 0 : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const inputStyle = "mt-1 block w-full p-2 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 focus:ring-blue-500 focus:border-blue-500";

    return (
        <form onSubmit={handleSubmit} className="p-2 space-y-4">
            <h2 className="text-xl font-bold">Modifier le Service</h2>
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom du service</label>
                <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className={inputStyle} required />
            </div>
            <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prix (F CFA)</label>
                <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} className={inputStyle} required />
            </div>
            <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Catégorie</label>
                <input type="text" id="category" name="category" value={formData.category} onChange={handleChange} className={inputStyle} required />
            </div>
            <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-500 text-white rounded-md">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Enregistrer</button>
            </div>
        </form>
    );
};


const ServiceManager: React.FC<{ addLog: (category: 'Service', type: 'Ajout' | 'Suppression', message: string) => void; }> = ({ addLog }) => {
    const { services, addService, updateService, deleteService } = useServices();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [serviceToEdit, setServiceToEdit] = useState<RepairServiceItem | null>(null);

    const handleAdd = async () => {
        const name = prompt("Nom du service :");
        const priceStr = prompt("Prix :");
        const category = prompt("Catégorie :");
        if (name && priceStr && category) {
            try {
                const price = parseInt(priceStr, 10);
                if (!isNaN(price)) {
                    await addService({ name, price, category });
                    addLog('Service', 'Ajout', `Service ajouté : ${name}`);
                    playTone(660, 150);
                } else {
                    alert("Le prix doit être un nombre.");
                }
            } catch (error) {
                console.error("Failed to add service (handled by hook):", error);
            }
        }
    };
    
    const handleDelete = async (service: RepairServiceItem) => {
      if(confirm(`Supprimer le service "${service.name}" ?`)) {
        try {
            await deleteService(service.id);
            addLog('Service', 'Suppression', `Service supprimé : ${service.name}`);
        } catch (error) {
            console.error("Failed to delete service (handled by hook):", error);
        }
      }
    };

    const handleEdit = (service: RepairServiceItem) => {
        setServiceToEdit(service);
        setIsEditModalOpen(true);
    };

    const handleUpdate = async (service: RepairServiceItem) => {
        if (serviceToEdit) {
            try {
                await updateService(service);
                addLog('Service', 'Ajout', `Service modifié : ${service.name}`);
                playTone(660, 150);
            } catch (error) {
                 console.error("Failed to update service:", error);
            } finally {
                setIsEditModalOpen(false);
                setServiceToEdit(null);
            }
        }
    };

    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">Gestion des Services</h2>
        <button onClick={handleAdd} className="mb-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md">
            Ajouter un Service
        </button>
        <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700/50 sticky top-0">
                    <tr>
                        <th className="px-4 py-2">Nom</th>
                        <th className="px-4 py-2">Catégorie</th>
                        <th className="px-4 py-2 text-right">Prix</th>
                        <th className="px-4 py-2 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {services.map(service => (
                        <tr key={service.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-2 font-medium">{service.name}</td>
                            <td className="px-4 py-2">{service.category}</td>
                            <td className="px-4 py-2 text-right font-mono">{service.price.toLocaleString('fr-FR')} F</td>
                            <td className="px-4 py-2 text-center">
                                <button onClick={() => handleEdit(service)} className="p-1 mx-1"><PencilIcon className="w-4 h-4 text-blue-500 dark:text-blue-400"/></button>
                                <button onClick={() => handleDelete(service)} className="p-1 mx-1"><TrashIcon className="w-4 h-4 text-red-500"/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
         <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
            {serviceToEdit && <ServiceEditForm service={serviceToEdit} onSave={handleUpdate} onCancel={() => setIsEditModalOpen(false)} />}
        </Modal>
      </div>
    );
};

interface EditorDashboardProps {
    tickets: RepairTicket[];
    updateTicket: (ticket: RepairTicket) => Promise<void>;
    deleteTicket: (ticketId: string) => Promise<void>;
    appointments: Appointment[];
    bulkUpdateTickets: (tickets: RepairTicket[]) => Promise<void>;
}

type EditorView = 'stats' | 'matrix' | 'stock' | 'services' | 'clients' | 'fiches' | 'settings' | 'history' | 'logs' | 'docsearch' | 'exports' | 'backup' | 'knowledge' | 'simpledocs';

const EditorDashboard: React.FC<EditorDashboardProps> = ({ tickets, updateTicket, deleteTicket, appointments, bulkUpdateTickets }) => {
  const { logs, addLog } = useLogs();
  const [currentView, setCurrentView] = useState<EditorView>('stats');
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
  const [ticketToEdit, setTicketToEdit] = useState<RepairTicket | null>(null);
  const [ticketToPrint, setTicketToPrint] = useState<RepairTicket | null>(null);
  const [stockFilter, setStockFilter] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState(window.location.search);
  const { settings, isFeatureEnabled } = useAppSettings();

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
    const initialStockFilter = urlParams.get('stockFilter');
    
    if (ticketId) {
        const ticket = tickets.find(t => t.id === ticketId);
        setSelectedTicket(ticket || null);
    }
    if (initialStockFilter) {
        setCurrentView('stock');
        setStockFilter(initialStockFilter);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('stockFilter');
        window.history.replaceState({}, '', newUrl);
        setLocationSearch(newUrl.search);
    }
  }, [tickets, locationSearch]);

  const handleSelectTicket = (ticket: RepairTicket) => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('ticketId', ticket.id);
    window.history.pushState({}, '', newUrl);
    setLocationSearch(newUrl.search);
    setSelectedTicket(ticket);
  };

  const handleBackToList = () => {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('ticketId');
      window.history.pushState({}, '', newUrl);
      setLocationSearch(newUrl.search);
      setSelectedTicket(null);
  };
  
  const handleEdit = (ticket: RepairTicket) => {
    setTicketToEdit(ticket);
    setSelectedTicket(null);
  };

  const handleSaveTicket = async (ticketData: Partial<RepairTicket>) => {
    if (ticketToEdit) {
        await updateTicket(ticketData as RepairTicket);
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
  
  const handleClientUpdate = async (originalClient: Client, newClientData: Client) => {
      const ticketsToUpdate = tickets.filter(t => {
          if(originalClient.id) return t.client.id === originalClient.id;
          return t.client.name === originalClient.name && t.client.phone === originalClient.phone;
      });
      
      if (ticketsToUpdate.length > 0) {
        const updatedTickets = ticketsToUpdate.map(ticket => ({
            ...ticket,
            client: { ...ticket.client, ...newClientData },
            updatedAt: new Date().toISOString(),
        }));
        await bulkUpdateTickets(updatedTickets);
      }
  };

  const handleDeleteClient = async (clientIdentifiers: { name: string; phone: string; id?: string }) => {
    const ticketsToDelete = tickets.filter(t => {
        if(clientIdentifiers.id) return t.client.id === clientIdentifiers.id;
        return t.client.name === clientIdentifiers.name && t.client.phone === clientIdentifiers.phone;
    });
    
    if (ticketsToDelete.length > 0) {
        for (const t of ticketsToDelete) {
            await deleteTicket(t.id);
        }
        addLog('Service' as any, 'Suppression' as any, `Client ${clientIdentifiers.name} et ses ${ticketsToDelete.length} fiche(s) supprimé(s).`);
    }
  };

  const navItems: NavItem[] = [
      {id: 'stats', label: 'Statistiques', icon: ChartBarIcon, isActive: currentView === 'stats', onClick: () => setCurrentView('stats') },
      {id: 'matrix', label: 'Matrice Pannes', icon: ExclamationTriangleIcon, isActive: currentView === 'matrix', onClick: () => setCurrentView('matrix') },
      {id: 'fiches', label: 'Fiches Clients', icon: ListBulletIcon, isActive: currentView === 'fiches', onClick: () => setCurrentView('fiches') },
      {id: 'stock', label: 'Stock', icon: WrenchScrewdriverIcon, isActive: currentView === 'stock', onClick: () => setCurrentView('stock'), featureId: 'mod_stock' },
      {id: 'services', label: 'Services', icon: CurrencyEuroIcon, isActive: currentView === 'services', onClick: () => setCurrentView('services') },
      {id: 'clients', label: 'Clients', icon: UserGroupIcon, isActive: currentView === 'clients', onClick: () => setCurrentView('clients'), featureId: 'mod_clients' },
      {id: 'simpledocs', label: 'Documents', icon: DocumentDuplicateIcon, isActive: currentView === 'simpledocs', onClick: () => setCurrentView('simpledocs'), featureId: 'mod_documents' },
      {id: 'knowledge', label: 'Base de Fichiers', icon: CloudArrowDownIcon, isActive: currentView === 'knowledge', onClick: () => setCurrentView('knowledge'), featureId: 'mod_knowledge' },
      {id: 'docsearch', label: 'Recherche IA', icon: BookOpenIcon, isActive: currentView === 'docsearch', onClick: () => setCurrentView('docsearch'), featureId: 'tool_ai_search' },
      {id: 'exports', label: 'Exports', icon: DocumentArrowDownIcon, isActive: currentView === 'exports', onClick: () => setCurrentView('exports'), featureId: 'mod_exports' },
      {id: 'settings', label: 'Paramètres', icon: PencilIcon, isActive: currentView === 'settings', onClick: () => setCurrentView('settings') },
      {id: 'history', label: 'Historique', icon: ClockIcon, isActive: currentView === 'history', onClick: () => setCurrentView('history') },
      {id: 'logs', label: 'Logs', icon: ListBulletIcon, isActive: currentView === 'logs', onClick: () => setCurrentView('logs') },
      {id: 'backup', label: 'Sauvegarde', icon: ArrowPathIcon, isActive: currentView === 'backup', onClick: () => setCurrentView('backup'), featureId: 'mod_backup' },
  ];

  const renderCurrentView = () => {
    switch (currentView) {
      case 'stats':
        return <ERPDashboard tickets={tickets} appointments={appointments} />;
      case 'matrix':
        return <ProblemModelMatrix tickets={tickets} />;
      case 'fiches':
        return <TicketArchive tickets={tickets} onSelectTicket={handleSelectTicket} onPrintTicket={setTicketToPrint} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} />;
      case 'stock':
        return <StockManager addLog={addLog} initialFilter={stockFilter || undefined} />;
      case 'services':
        return <ServiceManager addLog={addLog} />;
      case 'clients':
        return <ClientManager tickets={tickets} onUpdateClient={handleClientUpdate} onDeleteClient={handleDeleteClient} />;
      case 'simpledocs':
        return <SimpleDocumentGenerator />;
      case 'docsearch':
        return <InternalDocSearch />;
      case 'knowledge':
        return <KnowledgeBaseManager />;
      case 'exports':
        return <ExportManager />;
      case 'settings':
        return <div className="space-y-6"><AppSettingsManager /><CustomFieldsManager /></div>;
      case 'history':
        return <DeviceHistoryViewer />;
      case 'logs':
        return <LogViewer logs={logs} />;
      case 'backup':
        return <BackupManager />;
      default:
        return null;
    }
  };

  if (ticketToEdit) {
    return (
        <DashboardLayout title="Éditeur" navItems={navItems}>
            <RepairForm tickets={tickets} ticketToEdit={ticketToEdit} onSave={handleSaveTicket} onCancel={handleCancelForm} role="Editeur" />
        </DashboardLayout>
    );
  }
  
  if (selectedTicket) {
    return (
        <DashboardLayout title="Éditeur" navItems={navItems}>
            <RepairDetail ticket={selectedTicket} onBack={handleBackToList} onUpdate={updateTicket} onDelete={deleteTicket} role="Editeur" onEdit={handleEdit} />
        </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Éditeur" navItems={navItems}>
        {renderCurrentView()}
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

export default EditorDashboard;
