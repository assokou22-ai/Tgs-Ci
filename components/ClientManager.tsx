
import React, { useState, useMemo } from 'react';
import { RepairTicket, Client } from '../types.ts';
import { PencilIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, ExclamationTriangleIcon } from './icons.tsx';
import Modal from './Modal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import PaginationControls from './PaginationControls.tsx';
import { playTone } from '../utils/audio.ts';

interface UniqueClient extends Client {
    ticketCount: number;
    originalIdentifiers: { name: string; phone: string; id?: string };
    totalBilled: number;
    totalAdvanced: number;
    balance: number;
}

interface ClientManagerProps {
    tickets: RepairTicket[];
    onUpdateClient: (originalClient: Client, newClientData: Client) => Promise<void>;
    onDeleteClient: (clientIdentifiers: { name: string; phone: string; id?: string }) => Promise<void>;
}

const PAGE_SIZE = 15;

const ClientEditForm: React.FC<{
    client: UniqueClient;
    onSave: (updatedClient: Client) => Promise<void>;
    onCancel: () => void;
}> = ({ client, onSave, onCancel }) => {
    const { settings } = useAppSettings();
    const clientCustomFields = settings.customFields.client;

    const [formData, setFormData] = useState<Client>({
        id: client.id || '',
        name: client.name,
        phone: client.phone,
        email: client.email || '',
        customFields: client.customFields || {},
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCustomFieldChange = (fieldId: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            customFields: { ...(prev.customFields || {}), [fieldId]: value },
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onSave(formData);
        } catch (error) {
            console.error("Failed to save client update:", error);
            alert("La mise à jour du client a échoué. Voir la console pour les détails.");
        }
    };

    const inputStyle = "mt-1 block w-full p-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500";

    return (
        <form onSubmit={handleSubmit} className="p-2 space-y-4">
            <h2 className="text-xl font-bold">Modifier Client</h2>
            <div>
                <label htmlFor="id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">ID Client</label>
                <input type="text" id="id" name="id" value={formData.id} onChange={handleChange} className={inputStyle} />
            </div>
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom</label>
                <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className={inputStyle} required />
            </div>
             <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Téléphone</label>
                <input type="text" id="phone" name="phone" value={formData.phone} onChange={handleChange} className={inputStyle} required />
            </div>
             <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email (Optionnel)</label>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className={inputStyle} />
            </div>

            {clientCustomFields.length > 0 && (
                 <div className="space-y-3 pt-3 border-t border-gray-300 dark:border-gray-700">
                    {clientCustomFields.map(field => (
                        <div key={field.id}>
                             <label htmlFor={field.id} className="block text-sm font-medium">{field.label}</label>
                             <input
                                type="text"
                                id={field.id}
                                value={formData.customFields?.[field.id] || ''}
                                onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                className={inputStyle + " mt-1"}
                             />
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Enregistrer</button>
            </div>
        </form>
    );
};


const ClientManager: React.FC<ClientManagerProps> = ({ tickets, onUpdateClient, onDeleteClient }) => {
    const [filter, setFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [clientToEdit, setClientToEdit] = useState<UniqueClient | null>(null);
    const [clientToDelete, setClientToDelete] = useState<UniqueClient | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    const uniqueClients = useMemo((): UniqueClient[] => {
        const clientMap = new Map<string, Omit<UniqueClient, 'totalBilled' | 'totalAdvanced' | 'balance'>>();

        tickets.forEach(ticket => {
            const key = ticket.client.id || `${ticket.client.name.toLowerCase().trim()}|${ticket.client.phone.replace(/\s/g, '')}`;
            
            if (clientMap.has(key)) {
                clientMap.get(key)!.ticketCount++;
            } else {
                clientMap.set(key, {
                    ...ticket.client,
                    ticketCount: 1,
                    originalIdentifiers: { name: ticket.client.name, phone: ticket.client.phone, id: ticket.client.id },
                    customFields: ticket.client.customFields || {},
                });
            }
        });

        const clientsWithFinancials = Array.from(clientMap.values()).map(client => {
            const clientTickets = tickets.filter(t => {
                if(client.id) return t.client.id === client.id;
                return t.client.name === client.name && t.client.phone === client.phone;
            });

            const financials = clientTickets.reduce((acc, curr) => {
                acc.totalBilled += (curr.costs.diagnostic || 0) + (curr.costs.repair || 0);
                acc.totalAdvanced += curr.costs.advance || 0;
                return acc;
            }, { totalBilled: 0, totalAdvanced: 0 });

            return {
                ...client,
                ...financials,
                balance: financials.totalBilled - financials.totalAdvanced,
            };
        });

        return clientsWithFinancials;
    }, [tickets]);

    const filteredClients = useMemo(() => {
        if (!filter) return uniqueClients;
        const lowercasedFilter = filter.toLowerCase();
        return uniqueClients.filter(client =>
            client.name.toLowerCase().includes(lowercasedFilter) ||
            client.phone.includes(filter) ||
            (client.id || '').toLowerCase().includes(lowercasedFilter)
        );
    }, [uniqueClients, filter]);

    const sortedClients = useMemo(() => {
        let sortableItems = [...filteredClients];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const getSortableValue = (client: UniqueClient, key: string): any => {
                    return client[key as keyof UniqueClient];
                };
    
                const aValue = getSortableValue(a, sortConfig.key);
                const bValue = getSortableValue(b, sortConfig.key);

                if (aValue == null) return 1;
                if (bValue == null) return -1;
                
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return aValue.localeCompare(bValue, undefined, { numeric: true }) * (sortConfig.direction === 'asc' ? 1 : -1);
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredClients, sortConfig]);

    const totalPages = Math.ceil(sortedClients.length / PAGE_SIZE);
    const paginatedClients = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return sortedClients.slice(start, start + PAGE_SIZE);
    }, [sortedClients, currentPage]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleEdit = (client: UniqueClient) => {
        setClientToEdit(client);
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        setClientToEdit(null);
        setIsModalOpen(false);
    };

    const handleSave = async (newClientData: Client) => {
        if (!clientToEdit) return;
        
        if (window.confirm(`Confirmer la modification pour "${clientToEdit.name}" ? Cela sera appliqué à ses ${clientToEdit.ticketCount} fiche(s).`)) {
            await onUpdateClient(clientToEdit.originalIdentifiers, newClientData);
            playTone(660, 150);
            handleCloseModal();
        }
    };

    const confirmDeleteClient = async () => {
        if (clientToDelete) {
            await onDeleteClient(clientToDelete.originalIdentifiers);
            playTone(220, 300);
            setClientToDelete(null);
        }
    };
    
    const formatCurrency = (value: number) => `${value.toLocaleString('fr-FR')} F`;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Gestion des Clients ({filteredClients.length})</h2>
             <input type="text" placeholder="Rechercher un client par nom, téléphone ou ID..." value={filter} onChange={e => { setFilter(e.target.value); setCurrentPage(1); }} className="w-full p-2 mb-4 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600" />
            
            <div className="max-h-96 overflow-y-auto">
                 <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                    <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700/50 sticky top-0">
                        <tr>
                            <th scope="col" className="px-4 py-2">
                                <button onClick={() => requestSort('name')} className="flex items-center gap-1 hover:text-white">
                                    Client
                                    {sortConfig.key === 'name' && (
                                        sortConfig.direction === 'asc' 
                                            ? <ChevronUpIcon className="w-3 h-3" /> 
                                            : <ChevronDownIcon className="w-3 h-3" />
                                    )}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-2">
                                <button onClick={() => requestSort('id')} className="flex items-center gap-1 hover:text-white">
                                    ID/Téléphone
                                    {sortConfig.key === 'id' && (
                                        sortConfig.direction === 'asc' 
                                            ? <ChevronUpIcon className="w-3 h-3" /> 
                                            : <ChevronDownIcon className="w-3 h-3" />
                                    )}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-2 text-right">
                                <button onClick={() => requestSort('totalBilled')} className="flex items-center gap-1 hover:text-white ml-auto">
                                    Total Facturé
                                    {sortConfig.key === 'totalBilled' && (
                                        sortConfig.direction === 'asc' 
                                            ? <ChevronUpIcon className="w-3 h-3" /> 
                                            : <ChevronDownIcon className="w-3 h-3" />
                                    )}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-2 text-right">
                                <button onClick={() => requestSort('totalAdvanced')} className="flex items-center gap-1 hover:text-white ml-auto">
                                    Avances
                                    {sortConfig.key === 'totalAdvanced' && (
                                        sortConfig.direction === 'asc' 
                                            ? <ChevronUpIcon className="w-3 h-3" /> 
                                            : <ChevronDownIcon className="w-3 h-3" />
                                    )}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-2 text-right">
                                <button onClick={() => requestSort('balance')} className="flex items-center gap-1 hover:text-white ml-auto">
                                    Solde Dû
                                    {sortConfig.key === 'balance' && (
                                        sortConfig.direction === 'asc' 
                                            ? <ChevronUpIcon className="w-3 h-3" /> 
                                            : <ChevronDownIcon className="w-3 h-3" />
                                    )}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-2 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedClients.map(client => (
                            <tr key={client.originalIdentifiers.id || `${client.originalIdentifiers.name}-${client.originalIdentifiers.phone}`} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{client.name}</td>
                                <td className="px-4 py-2 font-mono text-xs">{client.id || client.phone}</td>
                                <td className="px-4 py-2 font-mono text-right">{formatCurrency(client.totalBilled)}</td>
                                <td className="px-4 py-2 font-mono text-right text-green-600 dark:text-green-400">{formatCurrency(client.totalAdvanced)}</td>
                                <td className={`px-4 py-2 font-mono font-bold text-right ${client.balance > 0 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                                    {formatCurrency(client.balance)}
                                </td>
                                <td className="px-4 py-2 flex items-center justify-center gap-2">
                                    <button onClick={() => handleEdit(client)} className="p-1" title="Modifier le client">
                                        <PencilIcon className="w-4 h-4 text-blue-500 dark:text-blue-400"/>
                                    </button>
                                    <button onClick={() => setClientToDelete(client)} className="p-1" title="Supprimer le client et ses fiches">
                                        <TrashIcon className="w-4 h-4 text-red-500"/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
            
            <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

            <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                {clientToEdit && <ClientEditForm client={clientToEdit} onSave={handleSave} onCancel={handleCloseModal} />}
            </Modal>

            <ConfirmationModal
                isOpen={!!clientToDelete}
                onClose={() => setClientToDelete(null)}
                onConfirm={confirmDeleteClient}
                title="Supprimer ce Client ?"
                message={
                    <div className="space-y-4">
                        <p>Vous êtes sur le point de supprimer définitivement le client <strong>{clientToDelete?.name}</strong>.</p>
                        <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm">
                            <p className="flex items-center gap-2 font-black uppercase mb-1">
                                <ExclamationTriangleIcon className="w-4 h-4" /> Attention : Conséquence critique
                            </p>
                            <p>Cette action supprimera également les <strong>{clientToDelete?.ticketCount} fiche(s)</strong> de réparation associées à ce client.</p>
                        </div>
                        <p className="text-xs text-gray-400 italic">Cette opération est irréversible et effacera tout l'historique technique lié à ce client.</p>
                    </div>
                }
                confirmText="Supprimer tout"
            />
        </div>
    );
};

export default ClientManager;
