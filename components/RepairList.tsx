
import React, { useState, useMemo, useEffect } from 'react';
import { RepairTicket, RepairStatus } from '../types.ts';
import { PencilIcon, StarIcon, PrinterIcon, TrashIcon } from './icons.tsx';
import PaginationControls from './PaginationControls.tsx';
import ListItemSkeleton from './skeletons/ListItemSkeleton.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';

interface RepairListProps {
  title: string;
  tickets: RepairTicket[];
  onSelectTicket: (ticket: RepairTicket) => void;
  onEditTicket: (ticket: RepairTicket) => void;
  onDeleteTicket?: (ticketId: string) => Promise<void>;
  statusToShow: RepairStatus[];
  loading: boolean;
  onPrintTicket?: (ticket: RepairTicket) => void;
}

const PAGE_SIZE = 12;

const RepairList: React.FC<RepairListProps> = ({ title, tickets, onSelectTicket, onEditTicket, onDeleteTicket, statusToShow, loading, onPrintTicket }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [ticketToDelete, setTicketToDelete] = useState<RepairTicket | null>(null);
  
  const filteredTickets = useMemo(() => 
    tickets.filter(ticket => statusToShow.includes(ticket.status)),
    [tickets, statusToShow]
  );

  const sortedTickets = useMemo(() => {
    return [...filteredTickets].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
    });
  }, [filteredTickets]);

  const totalPages = useMemo(() =>
    Math.ceil(sortedTickets.length / PAGE_SIZE),
    [sortedTickets.length]
  );

  const paginatedTickets = useMemo(() =>
    sortedTickets.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    ),
    [sortedTickets, currentPage]
  );

  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
        setCurrentPage(page);
    }
  };

  const confirmDelete = async () => {
    if (ticketToDelete && onDeleteTicket) {
      await onDeleteTicket(ticketToDelete.id);
      setTicketToDelete(null);
    }
  };

  const formatDateShort = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(',', ' à');
  };

  const renderContent = () => {
      if (loading) {
          return (
              <div className="h-96 overflow-y-auto">
                  {Array.from({ length: 5 }).map((_, i) => <ListItemSkeleton key={i} />)}
              </div>
          );
      }
      if (sortedTickets.length === 0) {
           return (
                <div className="h-96 flex items-center justify-center">
                    <p className="p-4 text-gray-500">Aucune fiche dans cette catégorie.</p>
                </div>
           );
      }

      return (
          <>
            <ul className="divide-y divide-gray-700 h-96 overflow-y-auto">
              {paginatedTickets.map(ticket => {
                const isCompleted = ticket.status === RepairStatus.TERMINE;
                const totalCost = (ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0);
                const balance = totalCost - (ticket.costs.advance || 0);

                return (
                  <li key={ticket.id} onClick={() => onSelectTicket(ticket)} className="p-4 hover:bg-gray-700 cursor-pointer transition-colors group">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {isCompleted && <span title="Réparation terminée"><StarIcon className="w-4 h-4 text-red-500 flex-shrink-0" /></span>}
                        <p className="font-semibold truncate">{ticket.client.name}</p>
                      </div>
                       <div className="flex items-center">
                            {balance > 0 && (
                            <p className="text-sm font-semibold text-green-400 whitespace-nowrap ml-2">
                                {balance.toLocaleString('fr-FR')} F
                            </p>
                          )}
                          <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  onEditTicket(ticket);
                              }}
                              className="ml-2 p-1 rounded-full text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-blue-600 hover:text-white transition-all" 
                              title="Modifier"
                          >
                              <PencilIcon className="w-4 h-4"/>
                          </button>
                          {onPrintTicket && (
                              <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      onPrintTicket(ticket);
                                  }}
                                  className="ml-1 p-1 rounded-full text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-600 hover:text-white transition-all" 
                                  title="Imprimer"
                              >
                                  <PrinterIcon className="w-4 h-4"/>
                              </button>
                          )}
                          {onDeleteTicket && (
                              <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      setTicketToDelete(ticket);
                                  }}
                                  className="ml-1 p-1 rounded-full text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white transition-all" 
                                  title="Supprimer la fiche"
                              >
                                  <TrashIcon className="w-4 h-4"/>
                              </button>
                          )}
                       </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <p className="text-sm text-gray-300 truncate">{ticket.macModel}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{formatDateShort(ticket.createdAt)}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{ticket.id}</p>
                  </li>
                );
              })}
            </ul>
             <div className="p-2 border-t border-gray-700">
              <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
              />
            </div>
          </>
      );
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="p-4 bg-gray-700/50 flex justify-between items-center flex-wrap gap-2 text-white">
        <h2 className="text-lg font-semibold flex items-center gap-2">
            {title} ({!loading ? filteredTickets.length : '...'})
        </h2>
      </div>
      {renderContent()}

      <ConfirmationModal
        isOpen={!!ticketToDelete}
        onClose={() => setTicketToDelete(null)}
        onConfirm={confirmDelete}
        title="Confirmer la suppression"
        message={
            <p>
                Êtes-vous sûr de vouloir supprimer la fiche <strong>{ticketToDelete?.id}</strong> pour <strong>{ticketToDelete?.client.name}</strong> ?
                <br />Cette action est irréversible.
            </p>
        }
        confirmText="Supprimer"
      />
    </div>
  );
};

export default RepairList;
