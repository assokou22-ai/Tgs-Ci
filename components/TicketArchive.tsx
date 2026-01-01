
import React, { useState, useMemo } from 'react';
import { RepairTicket } from '../types.ts';
import PaginationControls from './PaginationControls.tsx';
import { DocumentMagnifyingGlassIcon, PrinterIcon, TrashIcon, PencilIcon } from './icons.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';

interface TicketArchiveProps {
  tickets: RepairTicket[];
  onSelectTicket: (ticket: RepairTicket) => void;
  onPrintTicket: (ticket: RepairTicket) => void;
  onEditTicket?: (ticket: RepairTicket) => void;
  onDeleteTicket?: (ticketId: string) => Promise<void>;
}

const PAGE_SIZE = 20;

const TicketArchive: React.FC<TicketArchiveProps> = ({ tickets, onSelectTicket, onPrintTicket, onEditTicket, onDeleteTicket }) => {
  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [ticketToDelete, setTicketToDelete] = useState<RepairTicket | null>(null);

  const filteredTickets = useMemo(() => {
    if (!filter) return tickets;
    const lowerFilter = filter.toLowerCase();
    return tickets.filter(t => 
        t.client.name.toLowerCase().includes(lowerFilter) ||
        t.id.toLowerCase().includes(lowerFilter) ||
        t.macModel.toLowerCase().includes(lowerFilter) ||
        t.client.phone.includes(filter)
    );
  }, [tickets, filter]);

  const sortedTickets = useMemo(() => {
      return [...filteredTickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filteredTickets]);

  const totalPages = Math.ceil(sortedTickets.length / PAGE_SIZE);
  
  const paginatedTickets = useMemo(() => {
      const start = (currentPage - 1) * PAGE_SIZE;
      return sortedTickets.slice(start, start + PAGE_SIZE);
  }, [sortedTickets, currentPage]);

  const handlePageChange = (page: number) => {
      setCurrentPage(page);
  };

  const confirmDelete = async () => {
    if (ticketToDelete && onDeleteTicket) {
      await onDeleteTicket(ticketToDelete.id);
      setTicketToDelete(null);
    }
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(',', ' à');
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-white mb-4">Archives Générales ({sortedTickets.length})</h2>
      
      <input 
        type="text" 
        placeholder="Rechercher par Nom, ID, Téléphone ou Modèle..." 
        value={filter}
        onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
        className="w-full p-2 mb-4 bg-gray-700 text-white rounded border border-gray-600 focus:ring-blue-500 focus:border-blue-500 outline-none"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                <tr>
                    <th className="px-4 py-3">Date & Heure</th>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Modèle</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                </tr>
            </thead>
            <tbody>
                {paginatedTickets.map(ticket => (
                    <tr key={ticket.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors group">
                        <td className="px-4 py-2 text-[11px] font-mono">{formatDateTime(ticket.createdAt)}</td>
                        <td className="px-4 py-2 font-mono text-xs">{ticket.id}</td>
                        <td className="px-4 py-2 font-bold text-white">{ticket.client.name}</td>
                        <td className="px-4 py-2">{ticket.macModel}</td>
                        <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                                ticket.status === 'Terminé' || ticket.status === 'Rendu' ? 'bg-green-900 text-green-300' : 
                                ticket.status === 'Non réparable' ? 'bg-red-900 text-red-300' : 'bg-blue-900 text-blue-300'
                            }`}>
                                {ticket.status}
                            </span>
                        </td>
                        <td className="px-4 py-2 flex justify-center gap-2">
                            <button 
                                onClick={() => onSelectTicket(ticket)} 
                                className="p-2 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
                                title="Consulter la fiche"
                            >
                                <DocumentMagnifyingGlassIcon className="w-4 h-4" />
                            </button>
                            {onEditTicket && (
                                <button 
                                    onClick={() => onEditTicket(ticket)} 
                                    className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors"
                                    title="Modifier la fiche"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                            )}
                            <button 
                                onClick={() => onPrintTicket(ticket)} 
                                className="p-2 bg-gray-600 hover:bg-gray-500 rounded text-white transition-colors"
                                title="Imprimer la fiche"
                            >
                                <PrinterIcon className="w-4 h-4" />
                            </button>
                            {onDeleteTicket && (
                                <button 
                                    onClick={() => setTicketToDelete(ticket)} 
                                    className="p-2 bg-red-800 hover:bg-red-600 rounded text-white opacity-0 group-hover:opacity-100 transition-all"
                                    title="Supprimer la fiche"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                        </td>
                    </tr>
                ))}
                {paginatedTickets.length === 0 && (
                    <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500 italic">Aucune fiche trouvée.</td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
      
      <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />

      <ConfirmationModal
        isOpen={!!ticketToDelete}
        onClose={() => setTicketToDelete(null)}
        onConfirm={confirmDelete}
        title="Confirmation de suppression"
        message={
            <div className="space-y-3">
                <p>Vous êtes sur le point de supprimer la fiche <strong>{ticketToDelete?.id}</strong>.</p>
                <p className="text-red-400">Cette action est définitive et supprimera toutes les données techniques et historiques rattachées à <strong>{ticketToDelete?.client.name}</strong>.</p>
            </div>
        }
        confirmText="Supprimer"
      />
    </div>
  );
};

export default TicketArchive;
