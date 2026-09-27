
import React, { useState, useMemo, useEffect } from 'react';
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
    ExclamationTriangleIcon,
    PlusCircleIcon,
    SparklesIcon,
    GlobeAltIcon,
    ShoppingCartIcon,
    BuildingStorefrontIcon
} from './icons.tsx';
import { RepairServiceItem, LogEntry, RepairTicket, Client, Appointment } from '../types.ts';
import ERPDashboard from './ERPDashboard.tsx';
import useLogs from '../hooks/useLogs.ts';
import ClientManager from './ClientManager.tsx';
import Modal from './Modal.tsx';
import AppSettingsManager from './AppSettingsManager.tsx';
import CustomCssEditor from './CustomCssEditor.tsx';
import RepairDetail from './RepairDetail.tsx';
import RepairForm from './RepairForm.tsx';
import EnterpriseRepairForm from './EnterpriseRepairForm.tsx';
import CustomFieldsManager from './CustomFieldsManager.tsx';
import DeviceHistoryViewer from './DeviceHistoryViewer.tsx';
import InternalDocSearch from './InternalDocSearch.tsx';
import MacModelWebSearch from './MacModelWebSearch.tsx';
import OngoingOrdersView from './OngoingOrdersView.tsx';
import { playTone } from '../utils/audio.ts';
import ExportManager from './ExportManager.tsx';
import GoogleSyncManager from './GoogleSyncManager.tsx';
import KnowledgeBaseManager from './KnowledgeBaseManager.tsx';
import DashboardLayout, { NavItem } from './DashboardLayout.tsx';
import SimpleDocumentGenerator from './SimpleDocumentGenerator.tsx';
import TicketArchive from './TicketArchive.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableTicket from './PrintableTicket.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import ProblemModelMatrix from './ProblemModelMatrix.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import ErrorBoundaryWrapper from './ErrorBoundaryWrapper.tsx';
import { useToastContext } from '../context/ToastContext.tsx';

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

    const inputStyle = "mt-1 block w-full p-2.5 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all";

    return (
        <form onSubmit={handleSubmit} className="p-2 space-y-6">
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Édition Service</h2>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-1">Identifiant : {service.id}</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-[10px] font-black uppercase text-gray-500 mb-1 ml-1">Libellé de la prestation</label>
                    <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className={inputStyle} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="price" className="block text-[10px] font-black uppercase text-gray-500 mb-1 ml-1">Prix de vente (F CFA)</label>
                        <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} className={inputStyle} required />
                    </div>
                    <div>
                        <label htmlFor="category" className="block text-[10px) font-black uppercase text-gray-500 mb-1 ml-1">Catégorie métier</label>
                        <input type="text" id="category" name="category" value={formData.category} onChange={handleChange} className={inputStyle} required />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={onCancel} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Annuler</button>
                <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/40 hover:bg-blue-500 transition-all">Mettre à jour</button>
            </div>
        </form>
    );
};

const ServiceManager: React.FC<{ addLog: (category: 'Service', type: 'Ajout' | 'Suppression', message: string) => void; }> = ({ addLog }) => {
    const { showToast } = useToastContext();
    const { services, addService, updateService, deleteService } = useServices();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newServiceData, setNewServiceData] = useState({ name: '', price: '', category: '' });
    const [serviceToEdit, setServiceToEdit] = useState<RepairServiceItem | null>(null);
    const [serviceToDelete, setServiceToDelete] = useState<RepairServiceItem | null>(null);
    const [filter, setFilter] = useState('');

    const filteredServices = useMemo(() => {
        if (!filter) return services;
        const low = filter.toLowerCase();
        return services.filter(s => s.name.toLowerCase().includes(low) || s.category.toLowerCase().includes(low));
    }, [services, filter]);

    const handleConfirmAdd = async () => {
        const { name, price: priceStr, category } = newServiceData;
        if (name && priceStr && category) {
            try {
                const price = parseInt(priceStr, 10);
                if (!isNaN(price)) {
                    await addService({ name, price, category });
                    addLog('Service', 'Ajout', `Service ajouté : ${name}`);
                    playTone(660, 150);
                    setIsAddModalOpen(false);
                    setNewServiceData({ name: '', price: '', category: '' });
                } else {
                    showToast("Le prix doit être un nombre.", "error");
                }
            } catch (error) {
                console.error("Failed to add service:", error);
            }
        } else {
            showToast("Veuillez remplir tous les champs.", "warning");
        }
    };
    
    const confirmDelete = async () => {
        if (serviceToDelete) {
            try {
                await deleteService(serviceToDelete.id);
                addLog('Service', 'Suppression', `Service supprimé : ${serviceToDelete.name}`);
                setServiceToDelete(null);
            } catch (error) {
                console.error("Failed to delete service:", error);
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
                addLog('Service', 'Ajout', `Service modifié : ${service.name} -> ${service.price} F`);
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Catalogue Services & Tarifs</h2>
                <p className="text-sm text-gray-500 font-medium">Configurez les prestations proposées à l'accueil et leurs prix fixes.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-grow md:w-64">
                    <input 
                        type="text" 
                        placeholder="Filtrer un service..." 
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="w-full p-2.5 pl-10 rounded-xl bg-gray-50 dark:bg-gray-900 text-sm border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <ListBulletIcon className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                </div>
                <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all">
                    <PlusCircleIcon className="w-5 h-5"/>
                    Ajouter
                </button>
            </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
            <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                <thead className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 tracking-[0.15em]">
                    <tr>
                        <th className="px-6 py-4">Nom de la Prestation</th>
                        <th className="px-6 py-4">Catégorie</th>
                        <th className="px-6 py-4 text-right">Tarif (F CFA)</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredServices.map(service => (
                        <tr key={service.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white uppercase tracking-tight">{service.name}</td>
                            <td className="px-6 py-4">
                                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-[10px] font-black rounded-lg uppercase tracking-wider">{service.category}</span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-black text-blue-600 dark:text-blue-400">{service.price.toLocaleString('fr-FR')} F</td>
                            <td className="px-6 py-4">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => handleEdit(service)} className="p-2 bg-blue-600/5 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg transition-all" title="Modifier">
                                        <PencilIcon className="w-4 h-4"/>
                                    </button>
                                    <button onClick={() => setServiceToDelete(service)} className="p-2 bg-red-600/5 hover:bg-red-600 text-red-600 hover:text-white rounded-lg transition-all" title="Supprimer">
                                        <TrashIcon className="w-4 h-4"/>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        
        {filteredServices.length === 0 && (
            <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                Aucun service ne correspond à votre recherche
            </div>
        )}

         <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} containerClassName="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg m-4 p-8 border border-gray-200 dark:border-gray-700">
            {serviceToEdit && <ServiceEditForm service={serviceToEdit} onSave={handleUpdate} onCancel={() => setIsEditModalOpen(false)} />}
        </Modal>

        <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} containerClassName="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg m-4 p-8 border border-gray-200 dark:border-gray-700">
            <div className="p-2 space-y-6 text-white text-gray-900 dark:text-white">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Nouveau Service</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-500 mb-1 ml-1">Nom du service</label>
                        <input 
                            type="text" 
                            className="w-full p-2.5 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
                            value={newServiceData.name}
                            onChange={e => setNewServiceData(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-500 mb-1 ml-1">Prix (F CFA)</label>
                            <input 
                                type="number" 
                                className="w-full p-2.5 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
                                value={newServiceData.price}
                                onChange={e => setNewServiceData(prev => ({ ...prev, price: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-500 mb-1 ml-1">Catégorie</label>
                            <input 
                                type="text" 
                                className="w-full p-2.5 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
                                value={newServiceData.category}
                                onChange={e => setNewServiceData(prev => ({ ...prev, category: e.target.value }))}
                                placeholder="ex: Remplacement"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl font-bold text-xs uppercase tracking-widest">Annuler</button>
                    <button onClick={handleConfirmAdd} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/40">Créer le service</button>
                </div>
            </div>
        </Modal>

        <ConfirmationModal
            isOpen={!!serviceToDelete}
            onClose={() => setServiceToDelete(null)}
            onConfirm={confirmDelete}
            title="Supprimer le service ?"
            message={`Voulez-vous vraiment retirer définitivement la prestation "${serviceToDelete?.name}" du catalogue ?`}
            confirmText="Supprimer du catalogue"
        />
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

type EditorView = 'stats' | 'matrix' | 'stock' | 'services' | 'clients' | 'fiches' | 'settings' | 'design' | 'history' | 'logs' | 'docsearch' | 'websearch' | 'exports' | 'backup' | 'knowledge' | 'simpledocs' | 'ongoing_orders' | 'enterprise';

const EditorDashboard: React.FC<EditorDashboardProps> = ({ tickets, updateTicket, deleteTicket, appointments, bulkUpdateTickets }) => {
  const { addLog } = useLogs();
  const { showToast } = useToastContext();
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem('editor_unlocked_2019') === 'true';
  });
  const [inputPass, setInputPass] = useState('');
  const [passError, setPassError] = useState('');

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPass.trim() === '2019') {
      setIsUnlocked(true);
      sessionStorage.setItem('editor_unlocked_2019', 'true');
      setPassError('');
      playTone(880, 150);
      showToast("Accès Éditeur autorisé", "success");
    } else {
      setPassError("Mot de passe incorrect");
      playTone(330, 250);
      showToast("Accès refusé", "error");
    }
  };

  const [currentView, setCurrentView] = useState<EditorView>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('stockFilter')) return 'stock';
    return 'stats';
  });
  const [ticketToEdit, setTicketToEdit] = useState<RepairTicket | null>(null);
  const [ticketToPrint, setTicketToPrint] = useState<RepairTicket | null>(null);
  const privateStockFilter = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('stockFilter');
  })();
  const [locationSearch, setLocationSearch] = useState(window.location.search);
  const { settings } = useAppSettings();

  useEffect(() => {
    const handlePopState = () => {
        setLocationSearch(window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
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
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('stockFilter')) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('stockFilter');
        window.history.replaceState({}, '', newUrl);
    }
  }, []);

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
  
  const handleEdit = (ticket: RepairTicket) => {
    setTicketToEdit(ticket);
  };

  const handleSaveTicket = async (ticketData: Partial<RepairTicket>, action: 'new' | 'close' | 'print', oldId?: string) => {
    if (ticketToEdit) {
        await updateTicket(ticketData as RepairTicket, oldId);
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
        addLog('Service', 'Suppression', `Client ${clientIdentifiers.name} et ses ${ticketsToDelete.length} fiche(s) supprimé(s).`);
    }
  };

  const handleExitRole = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('role');
      url.searchParams.delete('ticketId');
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const navItems: NavItem[] = [
      {id: 'stats', label: 'Supervision', icon: ChartBarIcon, isActive: currentView === 'stats', onClick: () => setCurrentView('stats') },
      {id: 'stock', label: 'Stock', icon: WrenchScrewdriverIcon, isActive: currentView === 'stock', onClick: () => setCurrentView('stock'), featureId: 'mod_stock' },
      {id: 'services', label: 'Tarifs Prestations', icon: CurrencyEuroIcon, isActive: currentView === 'services', onClick: () => setCurrentView('services') },
      {id: 'clients', label: 'Clients', icon: UserGroupIcon, isActive: currentView === 'clients', onClick: () => setCurrentView('clients'), featureId: 'mod_clients' },
      {id: 'enterprise', label: 'Fiches client Entreprise', icon: BuildingStorefrontIcon, isActive: currentView === 'enterprise', onClick: () => setCurrentView('enterprise') },
      {id: 'simpledocs', label: 'Documents', icon: DocumentDuplicateIcon, isActive: currentView === 'simpledocs', onClick: () => setCurrentView('simpledocs'), featureId: 'mod_documents' },
      {id: 'knowledge', label: 'Base de Fichiers', icon: CloudArrowDownIcon, isActive: currentView === 'knowledge', onClick: () => setCurrentView('knowledge'), featureId: 'mod_knowledge' },
      {id: 'websearch', label: 'Grounding Web', icon: GlobeAltIcon, isActive: currentView === 'websearch', onClick: () => setCurrentView('websearch'), featureId: 'tool_ai_search' },
      {id: 'docsearch', label: 'Recherche IA', icon: BookOpenIcon, isActive: currentView === 'docsearch', onClick: () => setCurrentView('docsearch'), featureId: 'tool_ai_search' },
      {id: 'matrix', label: 'Matrice Pannes', icon: ExclamationTriangleIcon, isActive: currentView === 'matrix', onClick: () => setCurrentView('matrix') },
      {id: 'fiches', label: 'Archives Fiches', icon: ListBulletIcon, isActive: currentView === 'fiches', onClick: () => setCurrentView('fiches') },
      {id: 'ongoing_orders', label: 'Suivi Commandes', icon: ShoppingCartIcon, isActive: currentView === 'ongoing_orders', onClick: () => setCurrentView('ongoing_orders'), featureId: 'menu_finance' },
      {id: 'exports', label: 'Exports', icon: DocumentArrowDownIcon, isActive: currentView === 'exports', onClick: () => setCurrentView('exports'), featureId: 'mod_exports' },
      {id: 'settings', label: 'Paramètres', icon: PencilIcon, isActive: currentView === 'settings', onClick: () => setCurrentView('settings') },
      {id: 'design', label: 'Design CSS', icon: SparklesIcon, isActive: currentView === 'design', onClick: () => setCurrentView('design') },
      {id: 'history', label: 'Historique', icon: ClockIcon, isActive: currentView === 'history', onClick: () => setCurrentView('history') },
      {id: 'logs', label: 'Logs', icon: ListBulletIcon, isActive: currentView === 'logs', onClick: () => setCurrentView('logs') },
      {id: 'backup', label: 'Sauvegarde ONLINE', icon: ArrowPathIcon, isActive: currentView === 'backup', onClick: () => setCurrentView('backup'), featureId: 'mod_backup' },
  ];

  const viewLabels: Record<EditorView, string | undefined> = {
      stats: undefined,
      matrix: 'Analyse Pannes',
      fiches: 'Archives Clients',
      ongoing_orders: 'Suivi Commandes en Cours',
      stock: 'Gestion Matériel',
      services: 'Tarification',
      clients: 'Fichier Clients',
      enterprise: 'Comptes Entreprise',
      simpledocs: 'Générateur Documents',
      knowledge: 'Base de Données Fichiers',
      websearch: 'Vérificateur Compatibilité Web',
      docsearch: 'Expert IA Documentaire',
      exports: 'Centre d\'Exportation',
      settings: 'Configuration Logiciel',
      design: 'Studio CSS Live',
      history: 'Historique Connexions',
      logs: 'Journal Modifications',
      backup: 'Sauvegarde ONLINE'
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'stats': return <ERPDashboard tickets={tickets} appointments={appointments} />;
      case 'matrix': return <ProblemModelMatrix tickets={tickets} />;
      case 'fiches': return <TicketArchive tickets={searchedTickets} onSelectTicket={handleSelectTicket} onPrintTicket={setTicketToPrint} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} onUpdateTicket={updateTicket} />;
      case 'ongoing_orders': return <OngoingOrdersView />;
      case 'enterprise': return <TicketArchive tickets={searchedTickets.filter(t => t.client.isEnterprise)} onSelectTicket={handleSelectTicket} onPrintTicket={setTicketToPrint} onEditTicket={handleEdit} onDeleteTicket={deleteTicket} onUpdateTicket={updateTicket} />;
      case 'stock': return <StockManager addLog={addLog} initialFilter={privateStockFilter || undefined} tickets={tickets} />;
      case 'services': return <ServiceManager addLog={addLog} />;
      case 'clients': return <ClientManager tickets={searchedTickets} onUpdateClient={handleClientUpdate} onDeleteClient={handleDeleteClient} />;
      case 'simpledocs': return <SimpleDocumentGenerator />;
      case 'websearch': return <MacModelWebSearch />;
      case 'docsearch': return <InternalDocSearch />;
      case 'knowledge': return <KnowledgeBaseManager />;
      case 'exports': return <ExportManager />;
      case 'settings': return <div className="space-y-6"><AppSettingsManager /><CustomFieldsManager /></div>;
      case 'design': return <CustomCssEditor />;
      case 'history': return <DeviceHistoryViewer />;
      case 'logs': return <LogViewer logs={logs} />;
      case 'backup': return <GoogleSyncManager />;
      default: return null;
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-radial-gradient from-blue-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />
        <div className="w-full max-w-md bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] shadow-2xl z-10 animate-fade-in relative">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tight italic">Superviseur Éditeur</h1>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 font-sans">Atelier TGS - Côte d'Ivoire</p>
            </div>

            <div className="bg-zinc-900/50 rounded-2xl p-4 mb-6 border border-white/5 flex items-start gap-3">
                <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div>
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-sans">Modification Protégée</h4>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal font-sans">
                        Ce rôle permet de configurer le catalogue, gérer les stocks et modifier les paramètres système. Clé d'accès requise pour continuer.
                    </p>
                </div>
            </div>

            <form onSubmit={handleVerifyPassword} className="space-y-4">
                <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 px-1 font-sans">
                        Mot de passe Éditeur
                    </label>
                    <input
                        type="password"
                        value={inputPass}
                        onChange={(e) => { setInputPass(e.target.value); setPassError(''); }}
                        placeholder="••••"
                        className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 px-5 text-sm text-center text-white placeholder-zinc-600 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono tracking-widest text-lg"
                        required
                        autoFocus
                    />
                    {passError && (
                        <p className="mt-2 text-xs text-red-400 font-medium px-1 text-center font-sans">{passError}</p>
                    )}
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={handleExitRole}
                        className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 font-bold rounded-2xl uppercase tracking-widest text-xs transition-all active:scale-95 font-sans"
                    >
                        Quitter
                    </button>
                    <button
                        type="submit"
                        disabled={!inputPass}
                        className="flex-1 py-4 bg-white hover:bg-zinc-200 text-black disabled:opacity-50 font-black rounded-2xl uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg shadow-white/5 font-sans"
                    >
                        Valider
                    </button>
                </div>
            </form>
        </div>
      </div>
    );
  }

  if (ticketToEdit) {
    const activeTicketToEdit = tickets.find(t => t.id === ticketToEdit.id) || ticketToEdit;
    return (
        <DashboardLayout title="Éditeur" navItems={navItems} onBack={handleBackToList} onExitRole={handleExitRole}>
            <ErrorBoundaryWrapper name="Formulaire Édition">
                {activeTicketToEdit.client.isEnterprise ? (
                   <EnterpriseRepairForm tickets={tickets} ticketToEdit={activeTicketToEdit} onSave={handleSaveTicket} onCancel={handleCancelForm} />
                ) : (
                   <RepairForm tickets={tickets} ticketToEdit={activeTicketToEdit} onSave={handleSaveTicket} onCancel={handleCancelForm} role="Editeur" />
                )}
            </ErrorBoundaryWrapper>
        </DashboardLayout>
    );
  }
  
  if (selectedTicket) {
    return (
        <DashboardLayout 
            title="Éditeur" 
            navItems={navItems} 
            onBack={handleBackToList} 
            onExitRole={handleExitRole}
        >
            <ErrorBoundaryWrapper name="Détail Réparation">
                <RepairDetail 
                    ticket={selectedTicket} 
                    onBack={handleBackToList} 
                    onUpdate={handleUpdateTicket} 
                    onDelete={deleteTicket} 
                    role="Editeur" 
                    onEdit={handleEdit} 
                />
            </ErrorBoundaryWrapper>
        </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
        title="Éditeur" 
        subtitle={viewLabels[currentView]} 
        navItems={navItems}
        onBack={currentView !== 'stats' ? () => setCurrentView('stats') : undefined}
        onExitRole={handleExitRole}
    >
        <ErrorBoundaryWrapper name={viewLabels[currentView] || 'Vue Console'}>
            {renderCurrentView()}
        </ErrorBoundaryWrapper>
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
