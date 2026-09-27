import React, { useState, useMemo } from 'react';
import { RepairTicket, Appointment, DailyActionItem } from '../types.ts';
import { useDailyActions } from '../hooks/useDailyActions.ts';
import { formatDateKey, addDaysToDateStr } from '../services/reminderService.ts';
import { 
    ClockIcon, 
    CheckCircleIcon, 
    ExclamationTriangleIcon, 
    PrinterIcon, 
    PhoneIcon, 
    ArrowPathIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon,
    WhatsAppIcon
} from './icons.tsx';
import WhatsAppShareModal from './WhatsAppShareModal.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableDailyActions from './PrintableDailyActions.tsx';
import { generateWhatsAppUrl } from '../utils/formatters.ts';

interface ActionsDuJourViewProps {
    tickets: RepairTicket[];
    appointments?: Appointment[];
    onSelectTicket?: (ticket: RepairTicket) => void;
}

export const ActionsDuJourView: React.FC<ActionsDuJourViewProps> = ({
    tickets,
    appointments = [],
    onSelectTicket
}) => {
    const {
        selectedDate,
        setSelectedDate,
        filteredActions,
        stats,
        filterCategory,
        setFilterCategory,
        toggleActionStatus,
        markAllTodayDone,
        refresh
    } = useDailyActions(tickets, appointments);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTicketForWhatsApp, setSelectedTicketForWhatsApp] = useState<RepairTicket | null>(null);
    const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    const todayStr = useMemo(() => formatDateKey(new Date()), []);
    const isToday = selectedDate === todayStr;

    // Display formatted date
    const formattedDateHeader = useMemo(() => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        return dateObj.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }, [selectedDate]);

    // Handle Quick Date switching
    const handlePrevDay = () => setSelectedDate(prev => addDaysToDateStr(prev, -1));
    const handleNextDay = () => setSelectedDate(prev => addDaysToDateStr(prev, 1));
    const handleGoToday = () => setSelectedDate(todayStr);

    // Filter by search query
    const displayList = useMemo(() => {
        if (!searchQuery.trim()) return filteredActions;
        const q = searchQuery.toLowerCase();
        return filteredActions.filter(a => 
            a.clientName.toLowerCase().includes(q) ||
            a.clientPhone.toLowerCase().includes(q) ||
            a.appareil.toLowerCase().includes(q) ||
            a.action.toLowerCase().includes(q) ||
            (a.ticketId && a.ticketId.toLowerCase().includes(q))
        );
    }, [filteredActions, searchQuery]);

    // Handle opening WhatsApp with prefilled message
    const handleOpenWhatsAppForAction = (actionItem: DailyActionItem) => {
        const associatedTicket = tickets.find(t => t.id === actionItem.ticketId);
        if (associatedTicket) {
            setSelectedTicketForWhatsApp(associatedTicket);
            setIsWhatsAppOpen(true);
        } else {
            // Direct WhatsApp web link
            const msg = `Bonjour ${actionItem.clientName},\nConcernant votre ${actionItem.appareil} : ${actionItem.action}. Atelier TGS-CI.`;
            const url = generateWhatsAppUrl(actionItem.clientPhone, msg);
            window.open(url, '_blank');
        }
    };

    const handlePrintDailySheet = () => {
        setIsPrintModalOpen(true);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-fade-in font-sans pb-24">
            
            {/* Top Navigation & Date Bar */}
            <div className="apple-card p-6 bg-zinc-950/80 border border-white/10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
                            <ClockIcon className="w-3.5 h-3.5 text-blue-400" />
                            Tableau du Matin
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            Rappels & Actions 8h / J-3 / J-1
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight capitalize mt-2">
                        Actions du jour
                    </h1>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5 capitalize">
                        {formattedDateHeader} {isToday && <span className="text-emerald-400 font-bold ml-1">(Aujourd'hui)</span>}
                    </p>
                </div>

                {/* Date Controls & Print */}
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    <div className="flex items-center bg-black/60 p-1 rounded-2xl border border-white/5">
                        <button 
                            onClick={handlePrevDay}
                            className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
                            title="Jour précédent"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        
                        <button
                            onClick={handleGoToday}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Aujourd'hui
                        </button>

                        <button 
                            onClick={handleNextDay}
                            className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
                            title="Jour suivant"
                        >
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <input 
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="p-2.5 bg-black/60 border border-white/10 rounded-2xl text-xs font-mono text-white outline-none focus:border-blue-500 transition-all cursor-pointer"
                        />

                        <button 
                            onClick={handlePrintDailySheet}
                            className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-2xl transition-all flex items-center gap-1.5 text-xs font-bold"
                            title="Imprimer le tableau du jour"
                        >
                            <PrinterIcon className="w-4 h-4" />
                            <span className="hidden sm:inline text-[10px] uppercase font-black tracking-wider">Imprimer</span>
                        </button>

                        <button 
                            onClick={refresh}
                            className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-2xl transition-all"
                            title="Actualiser"
                        >
                            <ArrowPathIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* OVERDUE DOSSIERS ALERT BANNER (CRITICAL REQUIREMENT) */}
            {stats.overdueCount > 0 && (
                <div className="apple-card p-5 sm:p-6 bg-gradient-to-r from-red-950/40 via-amber-950/20 to-black border border-red-500/40 rounded-3xl shadow-xl shadow-red-950/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-slide-up">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0">
                            <ExclamationTriangleIcon className="w-6 h-6 text-red-400 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full">
                                    Attention Retards
                                </span>
                                <span className="text-xs font-black text-red-300 uppercase tracking-tight">
                                    {stats.overdueCount} {stats.overdueCount > 1 ? 'dossiers en retard' : 'dossier en retard'}
                                </span>
                            </div>
                            <p className="text-sm font-black text-white uppercase tracking-tight mt-1">
                                {stats.overdueSummaryText}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                Ces actions d'attente ou relances n'ont pas encore été validées par l'atelier.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setFilterCategory(filterCategory === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
                        className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shrink-0 border ${
                            filterCategory === 'OVERDUE'
                                ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40'
                                : 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20'
                        }`}
                    >
                        {filterCategory === 'OVERDUE' ? 'Voir toutes les actions' : 'Traiter les retards'}
                    </button>
                </div>
            )}

            {/* KPI Metrics Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button 
                    onClick={() => setFilterCategory('ALL')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                        filterCategory === 'ALL' 
                            ? 'bg-blue-600/15 border-blue-500/40 shadow-lg shadow-blue-900/20' 
                            : 'bg-black/40 border-white/5 hover:border-white/10'
                    }`}
                >
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Actions</p>
                    <p className="text-2xl font-black text-white mt-1">{stats.totalToday}</p>
                </button>

                <button 
                    onClick={() => setFilterCategory('TODO')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                        filterCategory === 'TODO' 
                            ? 'bg-amber-600/15 border-amber-500/40 shadow-lg shadow-amber-900/20' 
                            : 'bg-black/40 border-white/5 hover:border-white/10'
                    }`}
                >
                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">À faire</p>
                    <p className="text-2xl font-black text-amber-300 mt-1">{stats.todoCount}</p>
                </button>

                <button 
                    onClick={() => setFilterCategory('DONE')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                        filterCategory === 'DONE' 
                            ? 'bg-emerald-600/15 border-emerald-500/40 shadow-lg shadow-emerald-900/20' 
                            : 'bg-black/40 border-white/5 hover:border-white/10'
                    }`}
                >
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Effectuées</p>
                    <p className="text-2xl font-black text-emerald-300 mt-1">{stats.doneCount}</p>
                </button>

                <button 
                    onClick={() => setFilterCategory('OVERDUE')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                        filterCategory === 'OVERDUE' 
                            ? 'bg-red-600/20 border-red-500/50 shadow-lg shadow-red-900/30' 
                            : 'bg-black/40 border-white/5 hover:border-white/10'
                    }`}
                >
                    <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">En Retard</p>
                    <p className="text-2xl font-black text-red-400 mt-1">{stats.overdueCount}</p>
                </button>
            </div>

            {/* Filter Bar & Quick Search */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar gap-1">
                    {[
                        { id: 'ALL', label: 'Toutes les actions' },
                        { id: 'TODO', label: `À faire (${stats.todoCount})` },
                        { id: 'DONE', label: `Effectuées (${stats.doneCount})` },
                        { id: 'OVERDUE', label: `En retard (${stats.overdueCount})` }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterCategory(tab.id as typeof filterCategory)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${
                                filterCategory === tab.id
                                    ? 'bg-white text-black font-extrabold shadow-md'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-64">
                        <MagnifyingGlassIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text"
                            placeholder="Rechercher client, action..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/5 rounded-2xl text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
                        />
                    </div>

                    {stats.todoCount > 0 && filterCategory !== 'DONE' && (
                        <button
                            onClick={markAllTodayDone}
                            className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5"
                            title="Marquer toutes les actions du jour comme faites"
                        >
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            <span>Tout Valider</span>
                        </button>
                    )}
                </div>
            </div>

            {/* MAIN ACTIONS TABLE (EXACT SCHEMA REQUESTED: Heure | Client | Appareil | Action | Statut) */}
            <div className="apple-card overflow-hidden border border-white/10 bg-zinc-950/90 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                <th className="py-4 px-6 w-32">Heure</th>
                                <th className="py-4 px-6 w-56">Client</th>
                                <th className="py-4 px-6 w-60">Appareil</th>
                                <th className="py-4 px-6">Action</th>
                                <th className="py-4 px-6 w-44 text-right">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {displayList.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                                <CheckCircleIcon className="w-6 h-6 text-emerald-400" />
                                            </div>
                                            <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
                                                {filterCategory === 'OVERDUE'
                                                    ? 'Aucun dossier en retard. Atelier à jour !'
                                                    : filterCategory === 'DONE'
                                                    ? 'Aucune action effectuée enregistrée.'
                                                    : 'Aucune action restante pour cette date.'}
                                            </p>
                                            {isToday && (
                                                <button
                                                    onClick={handleNextDay}
                                                    className="text-xs text-blue-400 hover:text-blue-300 font-bold underline"
                                                >
                                                    Consulter les actions de demain →
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayList.map((item) => {
                                    const isDone = item.statut === 'FAIT';
                                    const isOverdue = item.isOverdue || item.statut === 'EN_RETARD';
                                    const associatedTicket = tickets.find(t => t.id === item.ticketId);

                                    return (
                                        <tr 
                                            key={item.id} 
                                            className={`transition-colors group hover:bg-white/[0.02] ${
                                                isDone 
                                                    ? 'opacity-50 bg-black/20' 
                                                    : isOverdue 
                                                    ? 'bg-red-950/10' 
                                                    : ''
                                            }`}
                                        >
                                            {/* 1. HEURE */}
                                            <td className="py-4 px-6 align-middle font-mono">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black tracking-tight border ${
                                                        isDone 
                                                            ? 'bg-white/5 text-slate-400 border-white/5 line-through' 
                                                            : isOverdue
                                                            ? 'bg-red-500/15 text-red-400 border-red-500/30 font-extrabold'
                                                            : 'bg-blue-600/15 text-blue-300 border-blue-500/30'
                                                    }`}>
                                                        {item.heure}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* 2. CLIENT */}
                                            <td className="py-4 px-6 align-middle">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-black uppercase tracking-tight ${isDone ? 'line-through text-slate-400' : 'text-white'}`}>
                                                            {item.clientName}
                                                        </span>
                                                        {item.ticketId && (
                                                            <button
                                                                onClick={() => associatedTicket && onSelectTicket && onSelectTicket(associatedTicket)}
                                                                className="text-[9px] font-mono font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 hover:bg-blue-500/20 transition-all uppercase"
                                                                title="Ouvrir la fiche technique"
                                                            >
                                                                {item.ticketId}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {item.clientPhone && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <a 
                                                                href={`tel:${item.clientPhone}`}
                                                                className="text-[10px] font-mono font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                                                            >
                                                                <PhoneIcon className="w-3 h-3 text-slate-500" />
                                                                {item.clientPhone}
                                                            </a>
                                                            <button 
                                                                onClick={() => handleOpenWhatsAppForAction(item)}
                                                                className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400 transition-all"
                                                                title="Contacter sur WhatsApp"
                                                            >
                                                                <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-400" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 3. APPAREIL */}
                                            <td className="py-4 px-6 align-middle">
                                                <div>
                                                    <p className={`text-xs font-bold uppercase tracking-tight ${isDone ? 'text-slate-500' : 'text-slate-200'}`}>
                                                        {item.appareil}
                                                    </p>
                                                    {item.details && (
                                                        <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5 italic">
                                                            {item.details}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 4. ACTION */}
                                            <td className="py-4 px-6 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-black uppercase tracking-tight ${
                                                        isDone 
                                                            ? 'line-through text-slate-400' 
                                                            : isOverdue
                                                            ? 'text-red-300 font-extrabold'
                                                            : 'text-white'
                                                    }`}>
                                                        {item.action}
                                                    </span>
                                                    {item.typeRappel === 'RAPPEL_J3' && (
                                                        <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[8px] font-black uppercase rounded">
                                                            J-3
                                                        </span>
                                                    )}
                                                    {item.typeRappel === 'CONFIRMATION_J1' && (
                                                        <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] font-black uppercase rounded">
                                                            J-1
                                                        </span>
                                                    )}
                                                    {item.typeRappel === 'JOUR_J0_8H' && (
                                                        <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase rounded">
                                                            8h
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 5. STATUT */}
                                            <td className="py-4 px-6 align-middle text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => toggleActionStatus(item.id, item.statut)}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5 ${
                                                            isDone
                                                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/30'
                                                                : isOverdue
                                                                ? 'bg-red-600/20 text-red-300 border-red-500/40 hover:bg-red-600 hover:text-white'
                                                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500 hover:text-black'
                                                        }`}
                                                    >
                                                        <CheckCircleIcon className="w-3.5 h-3.5" />
                                                        <span>{isDone ? 'Fait' : isOverdue ? 'En retard' : 'À faire'}</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* WhatsApp modal if triggered */}
            {isWhatsAppOpen && selectedTicketForWhatsApp && (
                <WhatsAppShareModal 
                    isOpen={isWhatsAppOpen}
                    ticket={selectedTicketForWhatsApp}
                    onClose={() => setIsWhatsAppOpen(false)}
                />
            )}

            {/* Print & PDF Preview Modal */}
            {isPrintModalOpen && (
                <PreviewModal 
                    isOpen={isPrintModalOpen} 
                    onClose={() => setIsPrintModalOpen(false)} 
                    fileName={`TGS_ACTIONS_DU_JOUR_${selectedDate}.pdf`}
                >
                    <PrintableDailyActions 
                        dateKey={selectedDate}
                        formattedDate={formattedDateHeader}
                        actions={displayList}
                        stats={stats}
                        filterCategory={filterCategory}
                    />
                </PreviewModal>
            )}

        </div>
    );
};

export default ActionsDuJourView;
