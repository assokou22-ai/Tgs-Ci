import React, { useState, useMemo } from 'react';
import { RepairTicket, Appointment, DailyActionItem } from '../types.ts';
import { useDailyActions } from '../hooks/useDailyActions.ts';
import { formatDateKey, addDaysToDateStr, formatPeriodDisplay } from '../services/reminderService.ts';
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
import { Calendar, CalendarRange, Sparkles } from 'lucide-react';
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
        setSelectedDate,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        dateMode,
        setDateMode,
        applyPreset,
        changeYear,
        selectMonth,
        isRange,
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
    const isSingleToday = !isRange && startDate === todayStr;

    // Current year extracted from startDate
    const currentSelectedYear = useMemo(() => {
        const y = parseInt(startDate.split('-')[0], 10);
        return isNaN(y) ? new Date().getFullYear() : y;
    }, [startDate]);

    // Display formatted period or single date
    const formattedPeriodHeader = useMemo(() => {
        return formatPeriodDisplay(startDate, isRange ? endDate : undefined);
    }, [startDate, endDate, isRange]);

    // Number of days in selected period
    const periodDayCount = useMemo(() => {
        if (!isRange) return 1;
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const s = new Date(sy, sm - 1, sd).getTime();
        const e = new Date(ey, em - 1, ed).getTime();
        const diff = Math.abs(e - s);
        return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
    }, [startDate, endDate, isRange]);

    // Handle Quick Date switching in Single Day mode
    const handlePrevDay = () => setSelectedDate(addDaysToDateStr(startDate, -1));
    const handleNextDay = () => setSelectedDate(addDaysToDateStr(startDate, 1));
    const handleGoToday = () => applyPreset('today');

    // Change year seamlessly preserving month & day
    const handleYearChange = (newYear: number) => {
        if (isNaN(newYear) || newYear < 1900 || newYear > 2200) return;
        changeYear(newYear);
    };

    const MONTHS_LABELS = useMemo(() => [
        { idx: 0, short: 'Jan', full: 'Janvier' },
        { idx: 1, short: 'Fév', full: 'Février' },
        { idx: 2, short: 'Mar', full: 'Mars' },
        { idx: 3, short: 'Avr', full: 'Avril' },
        { idx: 4, short: 'Mai', full: 'Mai' },
        { idx: 5, short: 'Juin', full: 'Juin' },
        { idx: 6, short: 'Juil', full: 'Juillet' },
        { idx: 7, short: 'Août', full: 'Août' },
        { idx: 8, short: 'Sept', full: 'Septembre' },
        { idx: 9, short: 'Oct', full: 'Octobre' },
        { idx: 10, short: 'Nov', full: 'Novembre' },
        { idx: 11, short: 'Déc', full: 'Décembre' },
    ], []);

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
            
            {/* Top Navigation & Date / Period Bar */}
            <div className="apple-card p-6 bg-zinc-950/90 border border-white/10 space-y-4">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-white/10">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
                                <ClockIcon className="w-3.5 h-3.5 text-blue-400" />
                                {isRange ? 'Planning Périodique' : 'Tableau du Matin'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                {isRange ? `${periodDayCount} jours sélectionnés (${startDate} au ${endDate})` : 'Rappels & Actions 8h / J-3 / J-1'}
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight capitalize mt-2">
                            {isRange ? 'Actions de la Période' : 'Actions du Jour'}
                        </h1>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5 capitalize">
                            {formattedPeriodHeader} {isSingleToday && <span className="text-emerald-400 font-bold ml-1">(Aujourd'hui)</span>}
                        </p>
                    </div>

                    {/* Mode Toggle & Primary Actions */}
                    <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                        <div className="flex items-center bg-black/60 p-1 rounded-2xl border border-white/10">
                            <button
                                type="button"
                                onClick={() => setDateMode('single')}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                    dateMode === 'single'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Jour par jour</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDateMode('range')}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                    dateMode === 'range'
                                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-extrabold shadow-lg shadow-amber-900/40'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <CalendarRange className="w-3.5 h-3.5" />
                                <span>Période personnalisée</span>
                            </button>
                        </div>

                        {/* Print Button with dynamic label */}
                        <button 
                            onClick={handlePrintDailySheet}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/40 rounded-2xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-950/40 active:scale-95"
                            title={isRange ? "Imprimer toute la période sélectionnée" : "Imprimer le tableau du jour"}
                        >
                            <PrinterIcon className="w-4 h-4" />
                            <span>Imprimer {isRange ? 'la période' : 'le jour'}</span>
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

                {/* Sub-bar: Inputs & Presets based on Date Mode */}
                {dateMode === 'single' ? (
                    <div className="space-y-3 pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date affichée :</span>
                                <div className="flex items-center bg-black/60 p-1 rounded-2xl border border-white/10">
                                    <button 
                                        onClick={handlePrevDay}
                                        className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
                                        title="Jour précédent"
                                    >
                                        <ChevronLeftIcon className="w-4 h-4" />
                                    </button>
                                    
                                    <button
                                        onClick={handleGoToday}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                            isSingleToday ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        Aujourd'hui
                                    </button>

                                    <button 
                                        onClick={handleNextDay}
                                        className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
                                        title="Jour suivant"
                                    >
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                <input 
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="p-2 bg-black/60 border border-white/10 rounded-xl text-xs font-mono text-white outline-none focus:border-blue-500 transition-all cursor-pointer font-bold"
                                />
                            </div>

                            {/* Quick Presets switch to range */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider mr-1">Raccourcis :</span>
                                <button
                                    onClick={() => applyPreset('example_jan_feb', currentSelectedYear)}
                                    className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                                    title={`Exemple : du 1er janvier ${currentSelectedYear} au 15 février ${currentSelectedYear}`}
                                >
                                    🎯 1 Janv - 15 Févr
                                </button>
                                {[
                                    { id: 'this_week' as const, label: 'Cette semaine' },
                                    { id: 'this_month' as const, label: 'Ce mois-ci' },
                                    { id: 'last_month' as const, label: 'Mois dernier' },
                                    { id: 'this_year' as const, label: `Année ${currentSelectedYear}` }
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => applyPreset(p.id, currentSelectedYear)}
                                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Invitation Banner to Period Selection */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-950/30 via-slate-900 to-black p-3.5 rounded-2xl border border-blue-500/20">
                            <div className="flex items-center gap-2.5 text-xs text-blue-200">
                                <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                                <span>Besoin d'afficher et d'imprimer une période spécifique (ex : <strong>du 1er janvier au 15 février</strong>, ou n'importe quelle année) ?</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDateMode('range')}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 shadow-md"
                            >
                                Choisir une Période Libre →
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 pt-1 bg-gradient-to-br from-zinc-900/95 via-zinc-900/90 to-black p-4 sm:p-5 rounded-3xl border border-amber-500/30 shadow-2xl">
                        {/* En-tête du sélecteur de période */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                                <h3 className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-widest">
                                    Sélection Personnalisée de la Période à Afficher & Imprimer
                                </h3>
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                Aucune restriction de date ni d'année
                            </span>
                        </div>

                        {/* Rangée 1 : Saisie libre Du / Au / Année */}
                        <div className="flex flex-wrap items-center gap-4 bg-black/60 p-3.5 rounded-2xl border border-white/10">
                            {/* Date Début */}
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest shrink-0">Du (Début) :</label>
                                <input 
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-3 py-1.5 bg-zinc-900 border border-white/20 rounded-xl text-xs font-mono text-white outline-none focus:border-amber-400 transition-all cursor-pointer font-bold"
                                />
                            </div>

                            {/* Date Fin */}
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest shrink-0">Au (Fin) :</label>
                                <input 
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-3 py-1.5 bg-zinc-900 border border-white/20 rounded-xl text-xs font-mono text-white outline-none focus:border-amber-400 transition-all cursor-pointer font-bold"
                                />
                            </div>

                            {/* Sélecteur d'Année sans limite */}
                            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Année :</label>
                                <div className="flex items-center bg-zinc-900 border border-white/20 rounded-xl p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => handleYearChange(currentSelectedYear - 1)}
                                        className="px-2 py-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 text-xs font-black transition-all"
                                        title="Année précédente"
                                    >
                                        ◀
                                    </button>
                                    <input
                                        type="number"
                                        value={currentSelectedYear}
                                        onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                                        className="w-16 bg-transparent text-center text-xs font-mono font-black text-white outline-none"
                                        title="Tapez n'importe quelle année selon votre besoin"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleYearChange(currentSelectedYear + 1)}
                                        className="px-2 py-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 text-xs font-black transition-all"
                                        title="Année suivante"
                                    >
                                        ▶
                                    </button>
                                </div>
                            </div>

                            {/* Bouton Aujourd'hui */}
                            <button
                                type="button"
                                onClick={() => applyPreset('today')}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ml-auto"
                            >
                                Aujourd'hui
                            </button>
                        </div>

                        {/* Rangée 2 : Raccourcis Directs dont l'Exemple Exact Demandé */}
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest mr-1">Raccourcis :</span>
                                
                                {/* Exemple précis demandé par l'utilisateur */}
                                <button
                                    type="button"
                                    onClick={() => applyPreset('example_jan_feb', currentSelectedYear)}
                                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-amber-950/30 active:scale-95"
                                    title={`Définir du 1er janvier ${currentSelectedYear} au 15 février ${currentSelectedYear}`}
                                >
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                    <span>🎯 Du 1er Janv. au 15 Févr. ({currentSelectedYear})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => applyPreset('this_month', currentSelectedYear)}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    Ce mois
                                </button>

                                <button
                                    type="button"
                                    onClick={() => applyPreset('last_month', currentSelectedYear)}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    Mois dernier
                                </button>

                                <button
                                    type="button"
                                    onClick={() => applyPreset('q1', currentSelectedYear)}
                                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    T1 (Jan-Mar)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('q2', currentSelectedYear)}
                                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    T2 (Avr-Juin)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('q3', currentSelectedYear)}
                                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    T3 (Juil-Sept)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('q4', currentSelectedYear)}
                                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    T4 (Oct-Déc)
                                </button>

                                <button
                                    type="button"
                                    onClick={() => applyPreset('this_year', currentSelectedYear)}
                                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    Toute l'année {currentSelectedYear}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => applyPreset('last_7_days')}
                                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    7 derniers jours
                                </button>

                                <button
                                    type="button"
                                    onClick={() => applyPreset('last_30_days')}
                                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    30 derniers jours
                                </button>
                            </div>

                            {/* Rangée 3 : Les 12 Mois de l'année en 1 clic */}
                            <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-white/5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider mr-1">
                                    Mois ({currentSelectedYear}) :
                                </span>
                                {MONTHS_LABELS.map(m => (
                                    <button
                                        key={m.idx}
                                        type="button"
                                        onClick={() => selectMonth(m.idx, currentSelectedYear)}
                                        className="px-2 py-1 bg-black/40 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 rounded-lg text-[9px] font-mono font-bold transition-all"
                                        title={`Afficher tout le mois de ${m.full} ${currentSelectedYear}`}
                                    >
                                        {m.short}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Résumé actif et bouton direct d'impression */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-slate-300">
                                    Période active : <strong className="text-white capitalize">{formattedPeriodHeader}</strong> ({periodDayCount} jour{periodDayCount > 1 ? 's' : ''})
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-slate-400 font-mono text-[11px]">
                                    <strong className="text-amber-400">{displayList.length}</strong> action{displayList.length > 1 ? 's' : ''} à afficher & imprimer
                                </span>
                                <button
                                    type="button"
                                    onClick={handlePrintDailySheet}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
                                >
                                    <PrinterIcon className="w-3.5 h-3.5" />
                                    <span>Lancer l'impression</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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

            {/* MAIN ACTIONS TABLE (EXACT SCHEMA REQUESTED: Date | Heure | Client | Appareil | Action | Statut) */}
            <div className="apple-card overflow-hidden border border-white/10 bg-zinc-950/90 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                {isRange && (
                                    <th className="py-4 px-6 w-32 text-center">Date</th>
                                )}
                                <th className="py-4 px-6 w-28">Heure</th>
                                <th className="py-4 px-6 w-56">Client</th>
                                <th className="py-4 px-6 w-60">Appareil</th>
                                <th className="py-4 px-6">Action</th>
                                <th className="py-4 px-6 w-44 text-right">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {displayList.length === 0 ? (
                                <tr>
                                    <td colSpan={isRange ? 6 : 5} className="py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                                <CheckCircleIcon className="w-6 h-6 text-emerald-400" />
                                            </div>
                                            <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
                                                {filterCategory === 'OVERDUE'
                                                    ? 'Aucun dossier en retard. Atelier à jour !'
                                                    : filterCategory === 'DONE'
                                                    ? 'Aucune action effectuée enregistrée.'
                                                    : isRange
                                                    ? 'Aucune action trouvée sur cette période sélectionnée.'
                                                    : 'Aucune action restante pour cette date.'}
                                            </p>
                                            {!isRange && isSingleToday && (
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
                                            {/* 0. DATE (SI PÉRIODE) */}
                                            {isRange && (
                                                <td className="py-4 px-6 align-middle text-center font-mono">
                                                    <div className="inline-flex flex-col items-center bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-slate-300">
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-blue-400">
                                                            {new Date(item.dateCible + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })}
                                                        </span>
                                                        <span className="text-xs font-black text-white">
                                                            {new Date(item.dateCible + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                                        </span>
                                                        <span className="text-[9px] text-slate-500 font-bold">
                                                            {item.dateCible.split('-')[0]}
                                                        </span>
                                                    </div>
                                                </td>
                                            )}

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
                    fileName={isRange ? `TGS_ACTIONS_${startDate}_au_${endDate}.pdf` : `TGS_ACTIONS_DU_JOUR_${startDate}.pdf`}
                    headerTools={
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="font-black text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <CalendarRange className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Période à Imprimer :</span>
                                </span>
                                
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] text-slate-400 uppercase font-black">Du :</label>
                                    <input 
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => {
                                            setDateMode('range');
                                            setStartDate(e.target.value);
                                        }}
                                        className="px-2.5 py-1 bg-black border border-white/20 rounded-lg text-xs font-mono text-white outline-none focus:border-amber-400 font-bold"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] text-slate-400 uppercase font-black">Au :</label>
                                    <input 
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => {
                                            setDateMode('range');
                                            setEndDate(e.target.value);
                                        }}
                                        className="px-2.5 py-1 bg-black border border-white/20 rounded-lg text-xs font-mono text-white outline-none focus:border-amber-400 font-bold"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => applyPreset('example_jan_feb', currentSelectedYear)}
                                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                    title="Exemple : 1 Janvier au 15 Février"
                                >
                                    🎯 1 Janv - 15 Févr
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('this_month', currentSelectedYear)}
                                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    Ce mois
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('this_year', currentSelectedYear)}
                                    className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    Année {currentSelectedYear}
                                </button>
                                <span className="text-[10px] text-slate-400 border-l border-white/10 pl-2.5 ml-1 font-mono font-bold">
                                    <strong className="text-emerald-400">{displayList.length}</strong> action{displayList.length > 1 ? 's' : ''} prête{displayList.length > 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                    }
                >
                    <PrintableDailyActions 
                        dateKey={startDate}
                        endDateKey={endDate}
                        isRange={isRange}
                        formattedDate={formattedPeriodHeader}
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
