
import React, { useState, useMemo, memo, useEffect } from 'react';
import { RepairTicket, RepairStatus } from '../types.ts';
import { PencilIcon, PrinterIcon, MacbookIcon, TrashIcon, ClockIcon, CalendarDaysIcon, ClipboardDocumentCheckIcon, WhatsAppIcon } from './icons.tsx';
import PaginationControls from './PaginationControls.tsx';
import ListItemSkeleton from './skeletons/ListItemSkeleton.tsx';
import { motion } from 'framer-motion';
import WhatsAppShareModal from './WhatsAppShareModal.tsx';
import { getStatusStyle } from '../utils/statusStyles.ts';

interface RepairListProps {
  title: string;
  tickets: RepairTicket[];
  onSelectTicket: (ticket: RepairTicket) => void;
  onEditTicket: (ticket: RepairTicket) => void;
  onDeleteTicket?: (ticketId: string) => void;
  statusToShow: RepairStatus[];
  loading: boolean;
  onPrintTicket?: (ticket: RepairTicket, type?: 'standard' | 'diagnostic') => void;
}

const PAGE_SIZE = 8;

const RepairItem = memo(({ ticket, onSelect, onEdit, onPrint, onDelete, onWhatsApp, nowTimeVal }: { 
    ticket: RepairTicket; 
    onSelect: (t: RepairTicket) => void; 
    onEdit: (t: RepairTicket) => void; 
    onPrint?: (t: RepairTicket, type?: 'standard' | 'diagnostic') => void; 
    onDelete?: (id: string) => void;
    onWhatsApp: (t: RepairTicket) => void;
    nowTimeVal: number;
}) => {
    const total = (ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0);
    const balance = Math.abs(total - (ticket.costs.advance || 0));
    const createdAt = new Date(ticket.createdAt);

    // Détection de statut stagnant (> 5 jours sans changement)
    const isOngoingStatus = ticket.status !== RepairStatus.TERMINE && 
                            ticket.status !== RepairStatus.RENDU && 
                            ticket.status !== RepairStatus.ANNULE && 
                            ticket.status !== RepairStatus.NON_REPARABLE;
    const msInFiveDays = 5 * 24 * 60 * 60 * 1000;
    const isStale = isOngoingStatus && (nowTimeVal > 0) && (nowTimeVal - new Date(ticket.updatedAt).getTime() > msInFiveDays);
    
    const isToday = useMemo(() => {
        const d = new Date(ticket.createdAt);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    }, [ticket.createdAt]);

    const statusStyle = getStatusStyle(ticket.status);

    let borderStyleClass = 'border-neutral-500';
    if (ticket.status === RepairStatus.A_DIAGNOSTIQUER || ticket.status === RepairStatus.DIAGNOSTIC_EN_COURS || ticket.status === RepairStatus.DEVIS_A_VALIDER) {
        borderStyleClass = 'border-neutral-500';
    } else if (ticket.status === RepairStatus.DEVIS_APPROUVE || ticket.status === RepairStatus.EN_ATTENTE_DE_PIECES) {
        borderStyleClass = 'border-orange-500';
    } else if (ticket.status === RepairStatus.REPARATION_EN_COURS || ticket.status === RepairStatus.TESTS_EN_COURS || ticket.status === RepairStatus.TERMINE || ticket.status === RepairStatus.REPORTE) {
        borderStyleClass = 'border-yellow-500';
    } else if (ticket.status === RepairStatus.RENDU || ticket.status === RepairStatus.NON_REPARABLE || ticket.status === RepairStatus.ANNULE) {
        borderStyleClass = 'border-red-500';
    }
    
    return (
        <motion.div 
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => onSelect(ticket)} 
            className={`p-5 cursor-pointer transition-all group relative border-l-4 flex gap-4 ${
                isStale 
                ? 'bg-red-950/20 hover:bg-red-950/30 border-red-600 animate-pulse shadow-xl shadow-red-950/25' 
                : isToday
                ? `bg-apple-blue/5 hover:bg-apple-blue/10 ${borderStyleClass} shadow-lg shadow-apple-blue/5`
                : `hover:bg-white/[0.03] ${borderStyleClass} hover:border-apple-blue`
            }`}
        >
            <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); onEdit(ticket); }} className="p-3 hover:bg-white/10 rounded-xl text-apple-muted hover:text-white transition-all min-h-[44px] min-w-[44px] flex items-center justify-center" title="Modifier"><PencilIcon className="w-5 h-5"/></button>
                <button onClick={(e) => { e.stopPropagation(); onWhatsApp(ticket); }} className="p-3 hover:bg-emerald-600/20 rounded-xl text-apple-muted hover:text-emerald-400 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center" title="WhatsApp"><WhatsAppIcon className="w-5 h-5"/></button>
                <button onClick={(e) => { e.stopPropagation(); onPrint?.(ticket, 'standard'); }} className="p-3 hover:bg-white/10 rounded-xl text-apple-muted hover:text-white transition-all min-h-[44px] min-w-[44px] flex items-center justify-center" title="Imprimer Fiche"><PrinterIcon className="w-5 h-5"/></button>
                <button onClick={(e) => { e.stopPropagation(); onPrint?.(ticket, 'diagnostic'); }} className="p-3 hover:bg-purple-600/20 rounded-xl text-apple-muted hover:text-purple-400 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center" title="Imprimer Diagnostic"><ClipboardDocumentCheckIcon className="w-5 h-5"/></button>
                {onDelete && (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(ticket.id); }} className="p-3 hover:bg-red-600/20 rounded-xl text-apple-muted hover:text-red-400 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center" title="Supprimer">
                        <TrashIcon className="w-5 h-5"/>
                    </button>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col gap-1 overflow-hidden flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-black font-mono bg-white/5 text-apple-muted px-2 py-1 rounded-md">#{ticket.id}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 ${statusStyle.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
                                {ticket.status}
                            </span>
                            {isToday && (
                                <span className="px-2 py-0.5 bg-apple-blue text-white text-[8px] font-black uppercase rounded shadow-lg shadow-apple-blue/30 tracking-widest flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-white animate-ping"></span> DU JOUR ⚡
                                </span>
                            )}
                            {isStale && (
                                <span className="px-2 py-0.5 bg-red-600 text-white text-[8px] font-black uppercase rounded shadow-lg animate-bounce tracking-widest">
                                    STAGNANT ⚠️
                                </span>
                            )}
                        </div>
                        <p className={`font-black text-sm truncate uppercase tracking-tight ${isStale ? 'text-red-400 font-extrabold' : 'text-white'}`}>{ticket.client.name}</p>
                    </div>
                    {balance > 0 && (
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 ${
                            (total - (ticket.costs.advance || 0)) < 0 
                            ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' 
                            : 'text-red-400 bg-red-400/10 border-red-400/20'
                        }`}>
                          {balance.toLocaleString()} F
                        </span>
                    )}
                </div>
                
                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-[11px] font-bold text-apple-blue uppercase tracking-wide">{ticket.macBrand} {ticket.macModel}</p>
                            {ticket.isReIntervention && (
                                <span className="px-1.5 py-0.5 bg-red-600 text-white text-[7px] font-black uppercase rounded shadow-lg shadow-red-900/40">SAV</span>
                            )}
                        </div>
                        <p className="text-[9px] text-apple-muted font-bold mt-1 uppercase tracking-widest flex items-center gap-1.5">
                            <CalendarDaysIcon className="w-3 h-3" /> {createdAt.toLocaleDateString('fr-FR')}
                            <span className="opacity-40">|</span>
                            <ClockIcon className="w-3 h-3" /> {createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {ticket.status === RepairStatus.REPORTE && (
                            <p className="text-[9px] font-black text-amber-400 mt-1 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                ⏳ REPORTÉ : {ticket.postponedUntil ? `${new Date(ticket.postponedUntil).toLocaleDateString('fr-FR')}` : `${ticket.postponedDays} JOURS`}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
});

const RepairList: React.FC<RepairListProps> = ({ title, tickets, onSelectTicket, onEditTicket, onDeleteTicket, statusToShow, loading, onPrintTicket }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [waTicket, setWaTicket] = useState<RepairTicket | null>(null);
  const [nowTimeVal, setNowTimeVal] = useState<number>(0);

  const [prioritizeToday, setPrioritizeToday] = useState(() => {
    try {
      const saved = localStorage.getItem(`tgspro_prioritize_today_${title}`);
      return saved ? JSON.parse(saved) : (title === 'Diagnostic & Réparation');
    } catch {
      return title === 'Diagnostic & Réparation';
    }
  });

  useEffect(() => {
    localStorage.setItem(`tgspro_prioritize_today_${title}`, JSON.stringify(prioritizeToday));
  }, [prioritizeToday, title]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNowTimeVal(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  
  const filteredTickets = useMemo(() => 
    tickets.filter(ticket => statusToShow.includes(ticket.status)),
    [tickets, statusToShow]
  );

  // Reset page to 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusToShow, tickets.length]);

  const sortedTickets = useMemo(() => {
    const checkIsStale = (ticket: RepairTicket) => {
        const isOngoingStatus = ticket.status !== RepairStatus.TERMINE && 
                                ticket.status !== RepairStatus.RENDU && 
                                ticket.status !== RepairStatus.ANNULE && 
                                ticket.status !== RepairStatus.NON_REPARABLE;
        const msInFiveDays = 5 * 24 * 60 * 60 * 1000;
        return isOngoingStatus && (nowTimeVal > 0) && (nowTimeVal - new Date(ticket.updatedAt).getTime() > msInFiveDays);
    };

    const checkIsToday = (ticket: RepairTicket) => {
        const d = new Date(ticket.createdAt);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    };

    return [...filteredTickets].sort((a, b) => {
        if (prioritizeToday) {
            const aIsToday = checkIsToday(a);
            const bIsToday = checkIsToday(b);
            if (aIsToday && !bIsToday) return -1;
            if (!aIsToday && bIsToday) return 1;
            if (aIsToday && bIsToday) {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
        }

        const aStale = checkIsStale(a);
        const bStale = checkIsStale(b);

        if (aStale && !bStale) return -1;
        if (!aStale && bStale) return 1;

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredTickets, nowTimeVal, prioritizeToday]);

  const totalPages = Math.ceil(sortedTickets.length / PAGE_SIZE);

  const paginatedTickets = useMemo(() =>
    sortedTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedTickets, currentPage]
  );

  return (
    <div className="apple-card overflow-hidden flex flex-col h-[620px] bg-white/[0.03] border border-white/5 rounded-[32px] shadow-2xl">
      <div className="px-6 py-5 border-b border-white/10 bg-white/[0.02] flex justify-between items-center gap-2">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-apple-muted flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-apple-blue shadow-[0_0_12px_#0071e3]"></span>
            {title} <span className="text-white/40 ml-1 font-bold">({filteredTickets.length})</span>
        </h2>
        {title === 'Diagnostic & Réparation' && (
          <button
            onClick={() => setPrioritizeToday(!prioritizeToday)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[9px] font-black uppercase tracking-wider ${
              prioritizeToday
                ? 'bg-apple-blue/20 text-apple-blue border-apple-blue/30 shadow-[0_0_12px_rgba(0,113,227,0.2)]'
                : 'bg-white/5 text-apple-muted border-white/10 hover:bg-white/10 hover:text-white'
            }`}
            title="Mettre les fiches enregistrées aujourd'hui en tête de liste avant les fiches stagnantes et autres"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${prioritizeToday ? 'bg-apple-blue animate-pulse' : 'bg-apple-muted'}`}></span>
            Fiches du jour en tête
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
            Array.from({ length: 5 }).map((_, i) => <ListItemSkeleton key={i} />)
        ) : sortedTickets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-20">
                <MacbookIcon className="w-16 h-16 mb-4 text-apple-muted" />
                <p className="text-[10px] font-black text-apple-muted uppercase tracking-[0.3em]">Aucun dossier trouvé</p>
            </div>
        ) : (
            <div className="divide-y divide-white/5">
                {paginatedTickets.map(ticket => (
                    <RepairItem 
                        key={ticket.id} 
                        ticket={ticket} 
                        onSelect={onSelectTicket} 
                        onEdit={onEditTicket} 
                        onPrint={onPrintTicket} 
                        onDelete={onDeleteTicket} 
                        onWhatsApp={setWaTicket}
                        nowTimeVal={nowTimeVal}
                    />
                ))}
            </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01]">
        <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      {waTicket && (
          <WhatsAppShareModal 
            isOpen={!!waTicket}
            onClose={() => setWaTicket(null)}
            ticket={waTicket}
          />
      )}
    </div>
  );
};

export default memo(RepairList);
