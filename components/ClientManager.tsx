
import React, { useState, useMemo } from 'react';
import { RepairTicket, Client } from '../types.ts';
import { PencilIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, ExclamationTriangleIcon, PrinterIcon, WhatsAppIcon, PhoneIcon, DatabaseIcon } from './icons.tsx';
import Modal from './Modal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableClient from './PrintableClient.tsx';
import PrintableReport from './PrintableReport.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import PaginationControls from './PaginationControls.tsx';
import { playTone } from '../utils/audio.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import WhatsAppShareModal from './WhatsAppShareModal.tsx';

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
    const { showToast } = useToastContext();
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
            showToast("La mise à jour a échoué.", "error");
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


interface TechnicianCollaboration {
    name: string;
    phone: string;
    ticketsCount: number;
    totalBilled: number;
    successfulCount: number;
    canceledCount: number;
    returnedCount: number;
    conflictsCount: number;
    ticketsList: RepairTicket[];
}

const ClientManager: React.FC<ClientManagerProps> = ({ tickets, onUpdateClient, onDeleteClient }) => {
    const [activeTab, setActiveTab] = useState<'clients' | 'technicians'>('clients');
    const [selectedTechnician, setSelectedTechnician] = useState<TechnicianCollaboration | null>(null);
    const [techQuery, setTechQuery] = useState('');

    const [filter, setFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [clientToEdit, setClientToEdit] = useState<UniqueClient | null>(null);
    const [clientToDelete, setClientToDelete] = useState<UniqueClient | null>(null);
    const [clientToPrint, setClientToPrint] = useState<UniqueClient | null>(null);
    const [clientToWhatsApp, setClientToWhatsApp] = useState<UniqueClient | null>(null);
    const [clientDataToConfirm, setClientDataToConfirm] = useState<Client | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    const technicianCollaborations = useMemo((): TechnicianCollaboration[] => {
        const techsMap = new Map<string, TechnicianCollaboration>();

        tickets.forEach(ticket => {
            if (ticket.client?.clientType === 'subcontractor' && ticket.client?.technicianName) {
                const name = ticket.client.technicianName.trim().toUpperCase();
                const phone = ticket.client.technicianPhone?.trim() || '';
                const billed = (ticket.costs?.diagnostic || 0) + (ticket.costs?.repair || 0);
                const isSuccess = ticket.status === 'Terminé' || ticket.status === 'Rendu';
                const isCanceled = ticket.status === 'Annulé';
                const isReturned = ticket.status === 'Rendu';
                const hasConflict = !!ticket.subcontractorIncident && ticket.subcontractorIncident.trim().length > 0;

                if (!techsMap.has(name)) {
                    techsMap.set(name, {
                        name,
                        phone,
                        ticketsCount: 1,
                        totalBilled: billed,
                        successfulCount: isSuccess ? 1 : 0,
                        canceledCount: isCanceled ? 1 : 0,
                        returnedCount: isReturned ? 1 : 0,
                        conflictsCount: hasConflict ? 1 : 0,
                        ticketsList: [ticket]
                    });
                } else {
                    const existing = techsMap.get(name)!;
                    existing.ticketsCount++;
                    existing.totalBilled += billed;
                    if (isSuccess) existing.successfulCount++;
                    if (isCanceled) existing.canceledCount++;
                    if (isReturned) existing.returnedCount++;
                    if (hasConflict) existing.conflictsCount++;
                    existing.ticketsList.push(ticket);
                    if (phone && !existing.phone) {
                        existing.phone = phone;
                    }
                }
            }
        });

        return Array.from(techsMap.values());
    }, [tickets]);

    // Period Report States
    const [reportPeriodType, setReportPeriodType] = useState<'week' | 'month' | 'year'>('week');
    const [reportStartDate, setReportStartDate] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    });
    const [reportEndDate, setReportEndDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });
    const [reportSelectedMonth, setReportSelectedMonth] = useState(() => new Date().getMonth() + 1);
    const [reportSelectedYear, setReportSelectedYear] = useState(() => new Date().getFullYear());
    const [isPrintReportOpen, setIsPrintReportOpen] = useState(false);

    const reportFilteredTickets = useMemo(() => {
        return tickets.filter(ticket => {
            if (!ticket.createdAt) return false;
            const ticketDateStr = ticket.createdAt.split('T')[0];
            
            if (reportPeriodType === 'week') {
                return ticketDateStr >= reportStartDate && ticketDateStr <= reportEndDate;
            } else if (reportPeriodType === 'month') {
                const dateObj = new Date(ticket.createdAt);
                const ticketMonth = dateObj.getMonth() + 1;
                const ticketYear = dateObj.getFullYear();
                return ticketMonth === reportSelectedMonth && ticketYear === reportSelectedYear;
            } else {
                const dateObj = new Date(ticket.createdAt);
                return dateObj.getFullYear() === reportSelectedYear;
            }
        });
    }, [tickets, reportPeriodType, reportStartDate, reportEndDate, reportSelectedMonth, reportSelectedYear]);

    const reportMetrics = useMemo(() => {
        let totalBilled = 0;
        let totalAdvanced = 0;
        let totalRefunded = 0;
        const uniqueClientKeys = new Set<string>();

        reportFilteredTickets.forEach(t => {
            const isCanceled = t.status === 'Annulé';
            const advance = t.costs?.advance || 0;
            const billed = (t.costs?.diagnostic || 0) + (t.costs?.repair || 0);

            if (isCanceled) {
                if (advance > 0) {
                    totalRefunded += advance;
                }
            } else {
                totalBilled += billed;
                totalAdvanced += advance;
            }

            const clientKey = t.client.id || `${t.client.name.toLowerCase().trim()}|${t.client.phone.replace(/\s/g, '')}`;
            uniqueClientKeys.add(clientKey);
        });

        const balance = totalBilled - totalAdvanced;

        return {
            totalBilled,
            totalAdvanced,
            totalRefunded,
            balance,
            ticketCount: reportFilteredTickets.length,
            clientCount: uniqueClientKeys.size
        };
    }, [reportFilteredTickets]);

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
        const sortableItems = [...filteredClients];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const getSortableValue = (client: UniqueClient, key: string): string | number | undefined => {
                    return client[key as keyof UniqueClient] as string | number | undefined;
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

    const exportClientsCSV = () => {
        const headers = ['Nom', 'Téléphone', 'Fiches Associées'];
        const rows = sortedClients.map(client => {
            const clientTickets = tickets
                .filter(t => client.id ? t.client.id === client.id : (t.client.name === client.name && t.client.phone === client.phone))
                .map(t => t.id);
            return [
                `"${client.name.replace(/"/g, '""')}"`,
                `"${client.phone.replace(/"/g, '""')}"`,
                `"${clientTickets.join(', ')}"`
            ];
        });
        const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `base_clients_tgs_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        playTone(520, 200);
    };

    const exportClientsVCF = () => {
        const vcfRows = sortedClients.map(client => {
            const clientTickets = tickets
                .filter(t => client.id ? t.client.id === client.id : (t.client.name === client.name && t.client.phone === client.phone))
                .map(t => t.id);
            
            return [
                'BEGIN:VCARD',
                'VERSION:3.0',
                `FN:${client.name}`,
                `TEL;TYPE=CELL,VOICE:${client.phone}`,
                `NOTE:Client TGS CI - Fiches: ${clientTickets.join(', ')}`,
                'CATEGORIES:TGS-Clients',
                'END:VCARD'
            ].join('\n');
        });
        
        const vcfContent = vcfRows.join('\n');
        const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `contacts_tgs_ci_${new Date().toISOString().split('T')[0]}.vcf`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        playTone(600, 200);
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
        setClientDataToConfirm(newClientData);
    };

    const confirmUpdateClient = async () => {
        if (!clientToEdit || !clientDataToConfirm) return;
        await onUpdateClient(clientToEdit.originalIdentifiers, clientDataToConfirm);
        playTone(660, 150);
        setClientDataToConfirm(null);
        handleCloseModal();
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h2 className="text-xl font-bold">Base Clients & Collaborations</h2>
            </div>

            {/* Onglets principaux */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 gap-2">
                <button
                    type="button"
                    onClick={() => { setActiveTab('clients'); playTone(540, 50); }}
                    className={`pb-3 px-4 font-black uppercase text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === 'clients'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-black'
                            : 'border-transparent text-gray-400 hover:text-gray-300'
                    }`}
                >
                    👤 Clients Directs ({uniqueClients.length})
                </button>
                <button
                    type="button"
                    onClick={() => { setActiveTab('technicians'); playTone(580, 50); }}
                    className={`pb-3 px-4 font-black uppercase text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === 'technicians'
                            ? 'border-amber-500 text-amber-500 dark:text-amber-400 font-black'
                            : 'border-transparent text-gray-400 hover:text-gray-300'
                    }`}
                >
                    🛠️ Sous-traitance Techniciens ({technicianCollaborations.length})
                </button>
            </div>

            {activeTab === 'clients' ? (
                <>
                    <h2 className="text-lg font-bold mb-4">Gestion des Clients Directs ({filteredClients.length})</h2>
             <input type="text" placeholder="Rechercher un client par nom, téléphone ou ID..." value={filter} onChange={e => { setFilter(e.target.value); setCurrentPage(1); }} className="w-full p-2 mb-4 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600" />
            
            {/* Barre d'exportations de contacts/base de données */}
            <div className="flex flex-col md:flex-row gap-4 mb-5 p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl items-center justify-between">
                <div className="text-left">
                    <h3 className="text-xs font-black uppercase text-blue-800 dark:text-blue-300 tracking-wider flex items-center gap-1.5">
                        💾 Exportation de contacts & base de prospection
                    </h3>
                    <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                        Exportez les <span className="font-bold underline">{sortedClients.length} clients</span> de la liste active pour de la publicité ou pour les intégrer directement dans un répertoire téléphonique.
                    </p>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={exportClientsCSV}
                        className="flex-1 md:flex-initial bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/80 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        title="Exporter comme base de données pourExcel, CRM ou campagnes publicitaires"
                    >
                        <DatabaseIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Base Prospect (CSV)
                    </button>
                    <button
                        type="button"
                        onClick={exportClientsVCF}
                        className="flex-1 md:flex-initial bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/25 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        title="Fichier vCard .vcf importable directement sur iPhone, Android et tablettes"
                    >
                        <PhoneIcon className="w-4 h-4 text-white" /> Répertoire Téléphone (VCF)
                    </button>
                </div>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
                 <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                    <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700/50 sticky top-0">
                        <tr>
                            <th scope="col" className="px-4 py-2 text-center">Actions</th>
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
                                    N° Fiche(s)
                                    {sortConfig.key === 'id' && (
                                        sortConfig.direction === 'asc' 
                                            ? <ChevronUpIcon className="w-3 h-3" /> 
                                            : <ChevronDownIcon className="w-3 h-3" />
                                    )}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-2">
                                <button onClick={() => requestSort('phone')} className="flex items-center gap-1 hover:text-white">
                                    Téléphone
                                    {sortConfig.key === 'phone' && (
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
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedClients.map(client => (
                            <tr key={client.originalIdentifiers.id || `${client.originalIdentifiers.name}-${client.originalIdentifiers.phone}`} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-2 flex items-center justify-center gap-2">
                                    <button onClick={() => handleEdit(client)} className="p-1" title="Modifier le client">
                                        <PencilIcon className="w-4 h-4 text-blue-500 dark:text-blue-400"/>
                                    </button>
                                    <button onClick={() => setClientToWhatsApp(client)} className="p-1" title="Contacter par WhatsApp">
                                        <WhatsAppIcon className="w-4 h-4 text-emerald-500 dark:text-emerald-400"/>
                                    </button>
                                    <button onClick={() => setClientToPrint(client)} className="p-1" title="Imprimer la fiche client">
                                        <PrinterIcon className="w-4 h-4 text-gray-500 dark:text-gray-400"/>
                                    </button>
                                    <button onClick={() => setClientToDelete(client)} className="p-1" title="Supprimer le client et ses fiches">
                                        <TrashIcon className="w-4 h-4 text-red-500"/>
                                    </button>
                                </td>
                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{client.name}</td>
                                <td className="px-4 py-2 font-mono text-xs">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                            {tickets
                                                .filter(t => client.id ? t.client.id === client.id : (t.client.name === client.name && t.client.phone === client.phone))
                                                .map(t => (
                                                    <span key={t.id} className="px-1.5 py-0.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded font-bold text-[10px] border border-blue-500/25">
                                                        {t.id}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-2 font-mono text-xs">{client.phone}</td>
                                <td className="px-4 py-2 font-mono text-right">{formatCurrency(client.totalBilled)}</td>
                                <td className="px-4 py-2 font-mono text-right text-green-600 dark:text-green-400">{formatCurrency(client.totalAdvanced)}</td>
                                <td className={`px-4 py-2 font-mono font-bold text-right ${client.balance > 0 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                                    {formatCurrency(client.balance)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
            
            <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </>
            ) : (
                <div className="space-y-6">
                    {/* Tableau de bord & KPIs des Techniciens Partenaires */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 flex items-center shadow-sm">
                            <div className="p-3 mr-4 bg-amber-500/10 rounded-xl text-amber-500 text-xl font-bold">
                                🤝
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Partenaires actifs</p>
                                <p className="text-xl font-black text-gray-900 dark:text-white">{technicianCollaborations.length}</p>
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 flex items-center shadow-sm">
                            <div className="p-3 mr-4 bg-blue-500/10 rounded-xl text-blue-500 text-xl font-bold">
                                💻
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Machines sous-traitées</p>
                                <p className="text-xl font-black text-gray-900 dark:text-white">
                                    {technicianCollaborations.reduce((sum, tech) => sum + tech.ticketsCount, 0)} fiches
                                </p>
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 flex items-center shadow-sm">
                            <div className="p-3 mr-4 bg-emerald-500/10 rounded-xl text-emerald-500 text-xl font-bold">
                                💵
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">CA Collaborations</p>
                                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(technicianCollaborations.reduce((sum, tech) => sum + tech.totalBilled, 0))}
                                </p>
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 flex items-center shadow-sm">
                            <div className="p-3 mr-4 bg-red-500/10 rounded-xl text-red-500 text-xl font-bold">
                                ⚠️
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Incidents & Conflits</p>
                                <p className="text-xl font-black text-red-600 dark:text-red-400">
                                    {technicianCollaborations.reduce((sum, tech) => sum + tech.conflictsCount, 0)} signalés
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Barre de Recherche Techniciens */}
                    <input 
                        type="text" 
                        placeholder="Rechercher un technicien partenaire par son nom ou téléphone..." 
                        value={techQuery} 
                        onChange={e => setTechQuery(e.target.value)} 
                        className="w-full p-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 outline-none focus:ring-1 focus:ring-amber-500" 
                    />

                    {/* Liste des Techniciens */}
                    <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-750">
                        <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700/50 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-4 py-2.5">Technicien Partner</th>
                                    <th scope="col" className="px-4 py-2.5">Téléphone</th>
                                    <th scope="col" className="px-4 py-2.5 text-center">Fiches confiees</th>
                                    <th scope="col" className="px-4 py-2.5 text-right">Volume CA</th>
                                    <th scope="col" className="px-4 py-2.5 text-center text-green-600 dark:text-green-400 font-bold">Réussies (Terminées/Rendues)</th>
                                    <th scope="col" className="px-4 py-2.5 text-center text-red-500 font-bold">Annulées</th>
                                    <th scope="col" className="px-4 py-2.5 text-center text-blue-500 font-bold">Rendues</th>
                                    <th scope="col" className="px-4 py-2.5 text-center text-amber-500 font-bold">Incidents</th>
                                    <th scope="col" className="px-4 py-2.5 text-center">Dossier</th>
                                </tr>
                            </thead>
                            <tbody>
                                {technicianCollaborations
                                    .filter(tech => !techQuery || tech.name.toLowerCase().includes(techQuery.toLowerCase()) || tech.phone.includes(techQuery))
                                    .map(tech => (
                                        <tr key={tech.name} className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750/30 ${selectedTechnician?.name === tech.name ? 'bg-amber-500/10 dark:bg-amber-500/10' : ''}`}>
                                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                {tech.name}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs">{tech.phone || 'Non renseigné'}</td>
                                            <td className="px-4 py-3 text-center font-bold">{tech.ticketsCount}</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(tech.totalBilled)}</td>
                                            <td className="px-4 py-3 text-center font-bold text-green-600 dark:text-green-400">{tech.successfulCount}</td>
                                            <td className="px-4 py-3 text-center font-bold text-red-500">{tech.canceledCount}</td>
                                            <td className="px-4 py-3 text-center font-bold text-blue-500">{tech.returnedCount}</td>
                                            <td className="px-4 py-3 text-center">
                                                {tech.conflictsCount > 0 ? (
                                                    <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/25 text-red-500 rounded-full font-black text-[10px] animate-pulse">
                                                        ⚠️ {tech.conflictsCount} incident(s)
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 dark:text-gray-600 text-xs">Aucun</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedTechnician(tech); playTone(600, 100); }}
                                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-black text-[10px] uppercase tracking-wider rounded-lg transition-all"
                                                >
                                                    Inspecter fiches
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Section d'Inspection détaillée d'un technicien */}
                    {selectedTechnician && (() => {
                        const currentTech = technicianCollaborations.find(t => t.name === selectedTechnician.name) || selectedTechnician;
                        return (
                            <div className="mt-6 p-6 bg-amber-500/[0.02] border border-amber-500/20 rounded-2xl space-y-4 animate-fade-in">
                                <div className="flex items-center justify-between border-b border-amber-500/10 pb-3 flex-wrap gap-2">
                                    <div>
                                        <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                                            <span>📂 Dossier détaillé :</span>
                                            <span className="text-white bg-amber-500 px-2 py-0.5 rounded font-black text-xs">{currentTech.name}</span>
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Téléphone : {currentTech.phone || 'Non renseigné'} • {currentTech.ticketsCount} machines confiées au total
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTechnician(null)}
                                        className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                    >
                                        Fermer dossier
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                        Historique des interventions et machines confiées
                                    </h4>
                                    <div className="max-h-80 overflow-y-auto space-y-2.5 pr-2">
                                        {currentTech.ticketsList.map(t => {
                                            const ticketBilled = (t.costs?.diagnostic || 0) + (t.costs?.repair || 0);
                                            return (
                                                <div key={t.id} className="p-4 bg-zinc-900/10 dark:bg-zinc-950/40 border border-gray-200 dark:border-gray-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-amber-500/35 transition-colors">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/15">
                                                                {t.id}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                                t.status === 'Terminé' || t.status === 'Rendu'
                                                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                                                                    : t.status === 'Annulé'
                                                                    ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                                    : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20'
                                                            }`}>
                                                                {t.status}
                                                            </span>
                                                            {t.client?.finalClientName && (
                                                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium italic">
                                                                    (Pour client final : <span className="font-bold underline">{t.client.finalClientName}</span>)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-800 dark:text-slate-300 font-bold uppercase">
                                                            {t.macBrand} {t.macModel} {t.modelNumber ? `(${t.modelNumber})` : ''}
                                                        </p>
                                                        {t.subcontractorIncident && (
                                                            <div className="mt-1.5 p-2.5 bg-red-500/5 border border-red-500/15 text-red-500 text-xs rounded-lg space-y-0.5">
                                                                <p className="font-black text-[9px] uppercase tracking-wider text-red-500">⚠️ Incident / Conflit documenté :</p>
                                                                <p className="font-medium italic leading-relaxed">{t.subcontractorIncident}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 shrink-0 sm:text-right">
                                                        <div className="space-y-0.5">
                                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Montant facturé</p>
                                                            <p className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(ticketBilled)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                {clientToEdit && <ClientEditForm client={clientToEdit} onSave={handleSave} onCancel={handleCloseModal} />}
            </Modal>

            {clientToPrint && (
                <PreviewModal
                    isOpen={!!clientToPrint}
                    onClose={() => setClientToPrint(null)}
                    fileName={`CLIENT_${clientToPrint.name.replace(/\s/g, '_')}.pdf`}
                >
                    <PrintableClient 
                        client={clientToPrint} 
                        tickets={tickets.filter(t => {
                            if(clientToPrint.id) return t.client.id === clientToPrint.id;
                            return t.client.name === clientToPrint.name && t.client.phone === clientToPrint.phone;
                        })} 
                    />
                </PreviewModal>
            )}

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

            <ConfirmationModal
                isOpen={!!clientDataToConfirm}
                onClose={() => setClientDataToConfirm(null)}
                onConfirm={confirmUpdateClient}
                title="Mettre à jour le client ?"
                message={`Confirmer la mise à jour pour "${clientToEdit?.name}" ? Cette modification sera appliquée à l'ensemble de ses ${clientToEdit?.ticketCount} fiche(s).`}
                confirmText="Mettre à jour"
            />

            {clientToWhatsApp && (
                <WhatsAppShareModal 
                    isOpen={!!clientToWhatsApp}
                    onClose={() => setClientToWhatsApp(null)}
                    ticket={clientToWhatsApp}
                />
            )}

            {/* --- SECTION DES RAPPORTS COMPTABLES & REVENUS PAR PÉRIODE --- */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-6">
                <div>
                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">📊 Bilan d'Activité & Rapports Périodiques</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Consultez et exportez des rapports calculés sur les interventions et les revenus enregistrés pour les périodes de votre choix.
                    </p>
                </div>

                {/* Les 3 boutons demandés en bas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                        type="button"
                        onClick={() => { setReportPeriodType('week'); playTone(540, 80); }}
                        className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between active:scale-95 ${
                            reportPeriodType === 'week' 
                                ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 ring-1 ring-blue-500' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                    >
                        <span className="text-[9px] uppercase font-black tracking-widest text-blue-500">Période active</span>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white mt-1">📅 Semaine de ... à ...</h4>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">Plage de dates personnalisée</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { setReportPeriodType('month'); playTone(580, 80); }}
                        className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between active:scale-95 ${
                            reportPeriodType === 'month' 
                                ? 'border-purple-500 bg-purple-500/5 dark:bg-purple-500/10 ring-1 ring-purple-500' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                    >
                        <span className="text-[9px] uppercase font-black tracking-widest text-purple-500">Période active</span>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white mt-1">🗓️ Mois (choisir)</h4>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">Mois calendaire complet</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { setReportPeriodType('year'); playTone(620, 80); }}
                        className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between active:scale-95 ${
                            reportPeriodType === 'year' 
                                ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 ring-1 ring-emerald-500' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                    >
                        <span className="text-[9px] uppercase font-black tracking-widest text-emerald-500">Période active</span>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white mt-1">🏆 Année (choisir)</h4>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">Bilan complet d'une année</span>
                    </button>
                </div>

                {/* Sélecteurs dynamiques selon le choix de période */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                    {reportPeriodType === 'week' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-black tracking-wider text-gray-400">Date de début</label>
                                <input 
                                    type="date" 
                                    value={reportStartDate} 
                                    onChange={e => setReportStartDate(e.target.value)} 
                                    className="p-2.5 bg-white dark:bg-gray-800 text-gray-950 dark:text-gray-100 rounded-lg border border-gray-300 dark:border-gray-700 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-black tracking-wider text-gray-400">Date de fin</label>
                                <input 
                                    type="date" 
                                    value={reportEndDate} 
                                    onChange={e => setReportEndDate(e.target.value)} 
                                    className="p-2.5 bg-white dark:bg-gray-800 text-gray-950 dark:text-gray-100 rounded-lg border border-gray-300 dark:border-gray-700 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                                />
                            </div>
                        </div>
                    )}

                    {reportPeriodType === 'month' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-black tracking-wider text-gray-400">Sélectionner le Mois</label>
                                <select 
                                    value={reportSelectedMonth} 
                                    onChange={e => setReportSelectedMonth(Number(e.target.value))} 
                                    className="p-2.5 bg-white dark:bg-gray-800 text-gray-950 dark:text-gray-100 rounded-lg border border-gray-300 dark:border-gray-700 text-xs focus:ring-1 focus:ring-purple-500 font-semibold outline-none"
                                >
                                    {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, idx) => (
                                        <option key={idx} value={idx + 1}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-black tracking-wider text-gray-400">Année</label>
                                <select 
                                    value={reportSelectedYear} 
                                    onChange={e => setReportSelectedYear(Number(e.target.value))} 
                                    className="p-2.5 bg-white dark:bg-gray-800 text-gray-950 dark:text-gray-100 rounded-lg border border-gray-300 dark:border-gray-700 text-xs focus:ring-1 focus:ring-purple-500 font-semibold outline-none"
                                >
                                    {[2024, 2025, 2026, 2027, 2028].map(yr => (
                                        <option key={yr} value={yr}>{yr}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {reportPeriodType === 'year' && (
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] uppercase font-black tracking-wider text-gray-400 font-bold">Sélectionner l'Année</label>
                            <select 
                                value={reportSelectedYear} 
                                onChange={e => setReportSelectedYear(Number(e.target.value))} 
                                className="p-2.5 bg-white dark:bg-gray-800 text-gray-950 dark:text-gray-100 rounded-lg border border-gray-300 dark:border-gray-700 text-xs focus:ring-1 focus:ring-emerald-500 font-semibold w-full sm:w-1/2 outline-none"
                            >
                                {[2024, 2025, 2026, 2027, 2028].map(yr => (
                                    <option key={yr} value={yr}>{yr}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Rendu calculé du rapport */}
                <div className="bg-zinc-50 dark:bg-zinc-950/40 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/80 dark:border-gray-800 pb-4">
                        <div>
                            <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Calcul du Bilan Actuel</span>
                            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap mt-0.5">
                                📊 Rapport d'activité : 
                                <span className="text-blue-600 dark:text-blue-400 font-mono text-xs font-bold">
                                    {reportPeriodType === 'week' && `Du ${new Date(reportStartDate).toLocaleDateString('fr-FR')} au ${new Date(reportEndDate).toLocaleDateString('fr-FR')}`}
                                    {reportPeriodType === 'month' && `${['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][reportSelectedMonth - 1]} ${reportSelectedYear}`}
                                    {reportPeriodType === 'year' && `Année ${reportSelectedYear}`}
                                </span>
                            </h3>
                        </div>

                        <button
                            type="button"
                            onClick={() => { setIsPrintReportOpen(true); playTone(660, 200); }}
                            className="bg-blue-600 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/20 active:scale-95 text-white font-extrabold uppercase text-[10px] tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 border border-blue-500/25 cursor-pointer"
                        >
                            <PrinterIcon className="w-4 h-4 text-white" /> Exporter PDF / Imprimer le Rapport
                        </button>
                    </div>

                    {/* Report indicators */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        <div className="bg-white dark:bg-gray-800/40 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Fiches</span>
                            <div className="text-lg font-black text-gray-900 dark:text-white mt-1">{reportMetrics.ticketCount}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800/40 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Clients</span>
                            <div className="text-lg font-black text-gray-900 dark:text-white mt-1">{reportMetrics.clientCount}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800/40 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Total Facturé</span>
                            <div className="text-sm font-black text-blue-600 dark:text-blue-400 mt-1.5">{formatCurrency(reportMetrics.totalBilled)}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800/40 p-3.5 rounded-xl border border-green-200 dark:border-green-900/50 text-center bg-green-500/5 dark:bg-green-500/5">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-green-500">Avances Reçues</span>
                            <div className="text-sm font-black text-green-600 dark:text-green-400 mt-1.5">{formatCurrency(reportMetrics.totalAdvanced)}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800/40 p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 text-center bg-red-500/5 dark:bg-red-500/5">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-red-500">Montant Remboursé</span>
                            <div className="text-sm font-black text-red-600 dark:text-red-400 mt-1.5">{formatCurrency(reportMetrics.totalRefunded)}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800/40 p-3.5 rounded-xl border border-yellow-200 dark:border-yellow-900/50 text-center bg-yellow-500/5 dark:bg-yellow-500/5 col-span-2 sm:col-span-1 md:col-span-1">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-yellow-500">Restes à Percevoir</span>
                            <div className="text-sm font-black text-yellow-600 dark:text-yellow-400 mt-1.5">{formatCurrency(reportMetrics.balance)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Aperçu Impression du Rapport */}
            {isPrintReportOpen && (
                <PreviewModal
                    isOpen={isPrintReportOpen}
                    onClose={() => setIsPrintReportOpen(false)}
                    fileName={`RAPPORT_TGS_CI_${reportPeriodType.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`}
                >
                    <PrintableReport
                        periodType={reportPeriodType}
                        startDate={reportStartDate}
                        endDate={reportEndDate}
                        selectedMonth={reportSelectedMonth}
                        selectedYear={reportSelectedYear}
                        tickets={reportFilteredTickets}
                        metrics={reportMetrics}
                    />
                </PreviewModal>
            )}
        </div>
    );
};

export default ClientManager;
