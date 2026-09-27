
import React, { useState, useMemo } from 'react';
import { RepairTicket, RepairStatus, Role, HistoryEntry } from '../types.ts';
import PaginationControls from './PaginationControls.tsx';
import { DocumentMagnifyingGlassIcon, PrinterIcon, TrashIcon, PencilIcon, ExclamationTriangleIcon } from './icons.tsx';
import { getStatusStyle } from '../utils/statusStyles.ts';
import useLogs from '../hooks/useLogs.ts';
import { useFirebase } from '../context/FirebaseContext.tsx';
import Modal from './Modal.tsx';
import useAppointments from '../hooks/useAppointments.ts';
import { isFallbackTicketId, extractTicketSequenceNumber } from '../utils/idGenerator.ts';

interface TicketArchiveProps {
  tickets: RepairTicket[];
  onSelectTicket: (ticket: RepairTicket) => void;
  onPrintTicket: (ticket: RepairTicket) => void;
  onEditTicket?: (ticket: RepairTicket) => void;
  onDeleteTicket?: (ticketId: string) => void;
  onUpdateTicket?: (ticket: RepairTicket) => Promise<void>;
}

const PAGE_SIZE = 15;

const TicketArchive: React.FC<TicketArchiveProps> = ({ 
  tickets, 
  onSelectTicket, 
  onPrintTicket, 
  onEditTicket, 
  onDeleteTicket,
  onUpdateTicket 
}) => {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'id' | 'createdAt' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const { addLog } = useLogs();
  const { user } = useFirebase();
  const { addAppointment } = useAppointments();

  const getInitialRepairDays = (t: RepairTicket): number => {
    if (t.diagnosticSheetB?.repairDelay) {
        const matches = t.diagnosticSheetB.repairDelay.match(/\d+/g);
        if (matches && matches.length > 0) {
            const numbers = matches.map(Number);
            const maxDays = Math.max(...numbers);
            if (maxDays > 0) return maxDays;
        }
    }
    return 3; // fallback default
  };
  const [ticketToDelete, setTicketToDelete] = useState<RepairTicket | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    tickets.forEach(t => {
      if (t.createdAt) {
        try {
          const yr = new Date(t.createdAt).getFullYear().toString();
          if (yr && yr !== 'NaN') years.add(yr);
        } catch {
          // ignore parsing errors
        }
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [tickets]);

  const handleSort = (field: 'id' | 'createdAt' | 'status') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleStatusChange = async (ticket: RepairTicket, newStatus: RepairStatus) => {
    if (newStatus === ticket.status || !onUpdateTicket) return;
    setIsUpdatingStatus(ticket.id);

    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    let activeRole: Role = 'Système';
    if (roleParam) {
        const roleMap: Record<string, Role> = {
            'accueil': 'Accueil',
            'technicien': 'Technicien',
            'editeur': 'Editeur',
            'factureetcommande': 'Facture et Commande',
            'systeme': 'Système'
        };
        activeRole = roleMap[roleParam.toLowerCase()] || 'Système';
    }

    const now = new Date().toISOString();
    const newHistoryEntry: HistoryEntry = { 
        timestamp: now, 
        user: activeRole, 
        action: `Changement de statut (via archives) : ${ticket.status} ➔ ${newStatus}` 
    };

    let updatedTicket: RepairTicket = { 
        ...ticket, 
        status: newStatus, 
        postponedDays: undefined, 
        postponedUntil: undefined, 
        updatedAt: now, 
        history: [...(ticket.history || []), newHistoryEntry] 
    };
    
    if (newStatus === RepairStatus.RENDU) {
        const total = (ticket.costs?.diagnostic || 0) + (ticket.costs?.repair || 0);
        updatedTicket = {
            ...updatedTicket,
            costs: {
                ...updatedTicket.costs,
                advance: total
            }
        };
    }

    if ((newStatus === RepairStatus.DEVIS_APPROUVE || newStatus === RepairStatus.REPARATION_EN_COURS || newStatus === RepairStatus.EN_ATTENTE_DE_PIECES) && !ticket.rendezVousDate) {
        const days = getInitialRepairDays(ticket);
        const d = new Date();
        d.setDate(d.getDate() + days);
        const calculatedDateStr = d.toISOString().split('T')[0];
        
        updatedTicket = {
            ...updatedTicket,
            rendezVousDate: calculatedDateStr,
            rendezVousTime: '10:00',
            estimatedWorkDelay: `${days} jours`
        };

        try {
            await addAppointment({
                date: calculatedDateStr,
                time: '10:00',
                clientName: ticket.client?.name || 'Client',
                clientPhone: ticket.client?.phone || '',
                reason: 'Récupération',
                notes: `Rendez-vous de récupération après réparation (Fiche ${ticket.id}). Statut mis à jour vers ${newStatus} (depuis les archives).`,
                ticketId: ticket.id
            });
        } catch (error) {
            console.error("Failed to auto-create appointment from TicketArchive:", error);
        }
    }

    try {
        await onUpdateTicket(updatedTicket);
    } catch (error) {
        console.error("Failed to update status from TicketArchive:", error);
    } finally {
        setIsUpdatingStatus(null);
    }
  };

  const handleBulkStatusChange = async (newStatus: RepairStatus) => {
    if (!onUpdateTicket || selectedTicketIds.length === 0) return;
    setIsBulkUpdating(true);

    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    let activeRole: Role = 'Système';
    if (roleParam) {
        const roleMap: Record<string, Role> = {
            'accueil': 'Accueil',
            'technicien': 'Technicien',
            'editeur': 'Editeur',
            'factureetcommande': 'Facture et Commande',
            'systeme': 'Système'
        };
        activeRole = roleMap[roleParam.toLowerCase()] || 'Système';
    }

    const now = new Date().toISOString();

    try {
        for (const ticketId of selectedTicketIds) {
            const ticket = tickets.find(t => t.id === ticketId);
            if (!ticket || ticket.status === newStatus) continue;

            const newHistoryEntry: HistoryEntry = { 
                timestamp: now, 
                user: activeRole, 
                action: `Changement de statut groupé (via archives) : ${ticket.status} ➔ ${newStatus}` 
            };

            let updatedTicket: RepairTicket = { 
                ...ticket, 
                status: newStatus, 
                postponedDays: undefined, 
                postponedUntil: undefined, 
                updatedAt: now, 
                history: [...(ticket.history || []), newHistoryEntry] 
            };
            
            if (newStatus === RepairStatus.RENDU) {
                const total = (ticket.costs?.diagnostic || 0) + (ticket.costs?.repair || 0);
                updatedTicket = {
                    ...updatedTicket,
                    costs: {
                        ...updatedTicket.costs,
                        advance: total
                    }
                };
            }

            if ((newStatus === RepairStatus.DEVIS_APPROUVE || newStatus === RepairStatus.REPARATION_EN_COURS || newStatus === RepairStatus.EN_ATTENTE_DE_PIECES) && !ticket.rendezVousDate) {
                const days = getInitialRepairDays(ticket);
                const d = new Date();
                d.setDate(d.getDate() + days);
                const calculatedDateStr = d.toISOString().split('T')[0];
                
                updatedTicket = {
                    ...updatedTicket,
                    rendezVousDate: calculatedDateStr,
                    rendezVousTime: '10:00',
                    estimatedWorkDelay: `${days} jours`
                };

                try {
                    await addAppointment({
                        date: calculatedDateStr,
                        time: '10:00',
                        clientName: ticket.client?.name || 'Client',
                        clientPhone: ticket.client?.phone || '',
                        reason: 'Récupération',
                        notes: `Rendez-vous de récupération après réparation (Fiche ${ticket.id}). Statut mis à jour vers ${newStatus} (changement groupé).`,
                        ticketId: ticket.id
                    });
                } catch (error) {
                    console.error("Failed to auto-create appointment in bulk status change:", error);
                }
            }

            await onUpdateTicket(updatedTicket);
        }
        setSelectedTicketIds([]);
    } catch (error) {
        console.error("Failed to bulk update status from TicketArchive:", error);
    } finally {
        setIsBulkUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!ticketToDelete) return;

    if (deletePassword !== '2019') {
      setDeleteError('Mot de passe d\'autorisation "2019" incorrect.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    let activeRole: Role = 'Système';
    if (roleParam) {
        const roleMap: Record<string, Role> = {
            'accueil': 'Accueil',
            'technicien': 'Technicien',
            'editeur': 'Editeur',
            'factureetcommande': 'Facture et Commande',
            'systeme': 'Système'
        };
        activeRole = roleMap[roleParam.toLowerCase()] || 'Système';
    }

    const userName = user?.email || user?.displayName || 'Visiteur';
    const msg = `Fiche ${ticketToDelete.id} (Client: ${ticketToDelete.client.name.toUpperCase()}, Appareil: ${ticketToDelete.macModel}) supprimée définitivement par l'utilisateur ${userName} (Rôle connecté: ${activeRole}) le ${new Date().toLocaleString('fr-FR')}`;

    try {
      if (onDeleteTicket) {
        await onDeleteTicket(ticketToDelete.id);
      }
      await addLog('Service', 'Suppression', msg);
      setTicketToDelete(null);
      setDeletePassword('');
      setDeleteError('');
    } catch (err) {
      console.error("Error during deletion execution in archive panel:", err);
      setDeleteError("Erreur lors de la suppression de la fiche.");
    }
  };

  const filteredTickets = useMemo(() => {
    const low = filter.toLowerCase();
    return tickets.filter(t => {
      const matchesSearch = !filter || (
        t.client.name.toLowerCase().includes(low) || 
        t.id.toLowerCase().includes(low) ||
        t.macModel.toLowerCase().includes(low) || 
        (t.client.phone || '').includes(filter)
      );

      const matchesStatus = !statusFilter || t.status === statusFilter;

      let matchesDate = true;
      if (dateFilter) {
        try {
          const tDate = new Date(t.createdAt);
          const tDateString = tDate.toISOString().slice(0, 10);
          matchesDate = tDateString === dateFilter;
        } catch {
          matchesDate = false;
        }
      }

      let matchesYear = true;
      if (yearFilter) {
        try {
          const yr = new Date(t.createdAt).getFullYear().toString();
          matchesYear = yr === yearFilter;
        } catch {
          matchesYear = false;
        }
      }

      return matchesSearch && matchesStatus && matchesDate && matchesYear;
    });
  }, [tickets, filter, statusFilter, dateFilter, yearFilter]);

  const sortedTickets = useMemo(() => {
    return [...filteredTickets].sort((a, b) => {
      if (sortField === 'createdAt') {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        if (dateA !== dateB) {
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        }
        // En cas d'égalité de date, trier par identifiant séquentiel numérique
        const numA = extractTicketSequenceNumber(a.id) ?? 0;
        const numB = extractTicketSequenceNumber(b.id) ?? 0;
        if (numA !== numB) {
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        }
        const compareId = a.id.localeCompare(b.id, 'fr', { numeric: true });
        return sortOrder === 'asc' ? compareId : -compareId;
      }
      if (sortField === 'id') {
        const numA = extractTicketSequenceNumber(a.id);
        const numB = extractTicketSequenceNumber(b.id);
        if (numA !== null && numB !== null && numA !== numB) {
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        }
        const compareId = a.id.localeCompare(b.id, 'fr', { numeric: true });
        return sortOrder === 'asc' ? compareId : -compareId;
      }
      if (sortField === 'status') {
        const compareStatus = a.status.localeCompare(b.status, 'fr');
        return sortOrder === 'asc' ? compareStatus : -compareStatus;
      }
      return 0;
    });
  }, [filteredTickets, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedTickets.length / PAGE_SIZE);
  const paginatedTickets = useMemo(() => sortedTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [sortedTickets, currentPage]);

  const statusOptions = Object.values(RepairStatus);

  return (
    <div className="apple-card p-6 shadow-xl">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xl font-black text-white">Archives Générales</h2>
          <div className="w-full md:w-80">
              <input 
                  type="text" 
                  placeholder="Rechercher nom, dossier, modèle..." 
                  value={filter}
                  onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-apple-blue/20 text-white"
              />
          </div>
        </div>

        {/* SECTION FILTRES AVANCÉS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-zinc-950/40 border border-white/5 rounded-2xl">
          {/* STATUT */}
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-apple-muted tracking-wider mb-1.5 pl-1">Filtrer par Statut</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase font-black focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              <option value="">Tous les statuts</option>
              {statusOptions.map(opt => (
                <option key={opt} value={opt} className="bg-zinc-950 text-slate-300 uppercase py-1">{opt}</option>
              ))}
            </select>
          </div>

          {/* DATE PRÉCISE */}
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-apple-muted tracking-wider mb-1.5 pl-1">Date précise</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
              className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:border-blue-500 focus:outline-none cursor-pointer"
            />
          </div>

          {/* ANNÉE */}
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-apple-muted tracking-wider mb-1.5 pl-1">Année</span>
            <select
              value={yearFilter}
              onChange={(e) => { setYearFilter(e.target.value); setCurrentPage(1); }}
              className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase font-black focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              <option value="">Toutes les années</option>
              {availableYears.map(year => (
                <option key={year} value={year} className="bg-zinc-950 text-slate-300 font-mono text-xs">{year}</option>
              ))}
            </select>
          </div>

          {/* EFFACER FILTRES */}
          <div className="flex items-end">
            <button
              type="button"
              disabled={!statusFilter && !dateFilter && !yearFilter}
              onClick={() => {
                setStatusFilter('');
                setDateFilter('');
                setYearFilter('');
                setCurrentPage(1);
              }}
              className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-white/5 active:scale-95"
            >
              Réinitialiser filtres
            </button>
          </div>
        </div>
      </div>

      {/* BANQUE D'ACTIONS GROUPÉES */}
      {selectedTicketIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 mb-5 bg-blue-600/10 border border-blue-500/20 rounded-[20px] animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1.5 bg-blue-500/20 rounded-xl text-blue-400 font-black text-xs font-mono">
               {selectedTicketIds.length}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest font-sans">Actions Groupées</p>
              <p className="text-[11px] text-zinc-300 font-semibold leading-none mt-1">{selectedTicketIds.length} dossier(s) coché(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              disabled={isBulkUpdating}
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusChange(e.target.value as RepairStatus);
                  e.target.value = '';
                }
              }}
              className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white uppercase font-black tracking-tight focus:border-blue-500 focus:outline-none w-full sm:w-auto"
            >
              <option value="">-- Appliquer le statut aux sélections --</option>
              {statusOptions.map(opt => (
                <option key={opt} value={opt} className="bg-zinc-950 text-slate-300 py-1 uppercase font-sans text-xs">
                  {opt}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSelectedTicketIds([])}
              disabled={isBulkUpdating}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all shrink-0"
            >
              Effacer la sélection
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm text-left">
            <thead className="text-[11px] font-bold text-apple-muted uppercase tracking-wider bg-white/5">
                <tr>
                    <th className="px-4 py-3 rounded-l-xl text-center w-12">
                        <input 
                            type="checkbox" 
                            checked={paginatedTickets.length > 0 && paginatedTickets.every(t => selectedTicketIds.includes(t.id))}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    const newIds = [...selectedTicketIds];
                                    paginatedTickets.forEach(t => {
                                        if (!newIds.includes(t.id)) newIds.push(t.id);
                                    });
                                    setSelectedTicketIds(newIds);
                                } else {
                                    const paginatedIds = paginatedTickets.map(t => t.id);
                                    setSelectedTicketIds(selectedTicketIds.filter(id => !paginatedIds.includes(id)));
                                }
                            }}
                            className="rounded border-white/25 bg-neutral-900 text-apple-blue focus:ring-apple-blue/50 cursor-pointer h-4 w-4"
                        />
                    </th>
                    <th className="px-4 py-3 text-center">Actions</th>
                    <th 
                        className="px-4 py-3 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('id')}
                    >
                        <div className="flex items-center gap-1 select-none">
                            Dossier {sortField === 'id' && (
                                <span className="text-[10px] text-apple-blue font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                            )}
                        </div>
                    </th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Matériel</th>
                    <th 
                        className="px-4 py-3 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('createdAt')}
                    >
                        <div className="flex items-center gap-1 select-none">
                            Date {sortField === 'createdAt' && (
                                <span className="text-[10px] text-apple-blue font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                            )}
                        </div>
                    </th>
                    <th 
                        className="px-4 py-3 rounded-r-xl cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('status')}
                    >
                        <div className="flex items-center gap-1 select-none">
                            Statut {sortField === 'status' && (
                                <span className="text-[10px] text-apple-blue font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                            )}
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {paginatedTickets.map(ticket => (
                    <tr key={ticket.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 py-4 text-center">
                            <input 
                                type="checkbox"
                                checked={selectedTicketIds.includes(ticket.id)}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setSelectedTicketIds([...selectedTicketIds, ticket.id]);
                                    } else {
                                        setSelectedTicketIds(selectedTicketIds.filter(id => id !== ticket.id));
                                    }
                                }}
                                className="rounded border-white/25 bg-neutral-900 text-apple-blue focus:ring-apple-blue/50 cursor-pointer h-4 w-4"
                            />
                        </td>
                        <td className="px-4 py-4 flex justify-center gap-1">
                            <button onClick={() => onSelectTicket(ticket)} className="p-2 hover:bg-apple-blue hover:text-white rounded-full transition-all text-apple-muted" title="Voir"><DocumentMagnifyingGlassIcon className="w-4 h-4" /></button>
                            {onEditTicket && <button onClick={() => onEditTicket(ticket)} className="p-2 hover:bg-apple-blue hover:text-white rounded-full transition-all text-apple-muted" title="Éditer"><PencilIcon className="w-4 h-4" /></button>}
                            <button onClick={() => onPrintTicket(ticket)} className="p-2 hover:bg-white/10 hover:text-white rounded-full transition-all text-apple-muted" title="Imprimer"><PrinterIcon className="w-4 h-4" /></button>
                            {onDeleteTicket && (
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setTicketToDelete(ticket); 
                                  setDeletePassword('');
                                  setDeleteError('');
                                }} 
                                className="p-2 hover:bg-red-600 hover:text-white rounded-full transition-all text-apple-muted opacity-0 group-hover:opacity-100" 
                                title="Supprimer"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            )}
                        </td>
                        <td className="px-4 py-4 font-mono font-bold text-apple-blue whitespace-nowrap">
                            {ticket.id}
                            {isFallbackTicketId(ticket.id) && (
                                <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded">
                                    Provisoire
                                </span>
                            )}
                        </td>
                        <td className="px-4 py-4 font-bold text-white truncate max-w-[150px] uppercase">{ticket.client.name}</td>
                        <td className="px-4 py-4 font-medium text-slate-300">{ticket.macModel}</td>
                        <td className="px-4 py-4 text-apple-muted">{new Date(ticket.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-4">
                            {onUpdateTicket ? (
                              <select
                                value={ticket.status}
                                disabled={isUpdatingStatus === ticket.id}
                                onChange={(e) => handleStatusChange(ticket, e.target.value as RepairStatus)}
                                className={`px-2.5 py-1 pr-6 rounded-full text-[10px] font-bold uppercase bg-transparent border-0 cursor-pointer focus:ring-1 focus:ring-white/20 outline-none leading-none appearance-none font-sans text-center transition-all ${isUpdatingStatus === ticket.id ? 'opacity-50' : ''} ${getStatusStyle(ticket.status).badge}`}
                                style={{
                                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23a1a1aa' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                                  backgroundPosition: 'right 0.35rem center',
                                  backgroundSize: '1.25rem 1.25rem',
                                  backgroundRepeat: 'no-repeat',
                                }}
                              >
                                {statusOptions.map(opt => (
                                  <option key={opt} value={opt} className="bg-zinc-950 text-slate-300 text-xs py-2 uppercase font-sans">
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusStyle(ticket.status).badge}`}>
                                {ticket.status}
                              </span>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
      
      <div className="mt-6 border-t border-white/5 pt-4">
          <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      {/* MODAL DE SUPPRESSION AVEC MOT DE PASSE "2019" ET ARCHIVAGE DANS L'HISTORIQUE */}
      {ticketToDelete && (
        <Modal isOpen={!!ticketToDelete} onClose={() => setTicketToDelete(null)}>
          <div className="text-white font-sans">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
              <div className="flex-shrink-0 bg-red-800 p-2.5 rounded-full">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-300" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Confirmer la suppression</h2>
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider font-mono">Action irréversible • Traçabilité activée</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 bg-white/5 p-4 rounded-2xl border border-white/5 mb-4">
              <p>
                Vous vous apprêtez à supprimer définitivement la fiche de réparation suivante :
              </p>
              <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-2 font-semibold">
                <span className="text-apple-muted">N° Dossier :</span>
                <span className="col-span-2 text-white font-mono">{ticketToDelete.id}</span>
                
                <span className="text-apple-muted">Client :</span>
                <span className="col-span-2 text-white uppercase">{ticketToDelete.client.name}</span>

                <span className="text-apple-muted">Matériel :</span>
                <span className="col-span-2 text-white">{ticketToDelete.macModel}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[10px] uppercase font-black text-apple-muted tracking-wide mb-2 pl-1">
                Mot de passe d'autorisation requis (2019)
              </label>
              <input 
                type="password"
                placeholder="Saisir le mot de passe d'autorisation..."
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  setDeleteError('');
                }}
                className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-600/50 text-white placeholder-zinc-600 text-center font-bold tracking-widest"
              />
              {deleteError && (
                <p className="text-xs text-red-500 font-bold mt-2 pl-1 italic">
                  ⚠️ {deleteError}
                </p>
              )}
            </div>

            <p className="text-[10px] font-medium text-zinc-500 italic text-center mb-5 leading-normal">
              Cette action génèrera une entrée indélébile dans l'historique de l'application indiquant votre session active ({user?.email || 'Visiteur Local'}) et l'heure précise.
            </p>

            <div className="flex gap-3 justify-end border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={() => {
                  setTicketToDelete(null);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-tight transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all shadow-xl shadow-red-900/30"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TicketArchive;
