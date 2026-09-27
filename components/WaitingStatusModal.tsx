import React, { useState, useMemo } from 'react';
import { RepairTicket, RepairStatus, HistoryEntry, Role } from '../types.ts';
import { generateWaitingStatusPhrase, addDaysToDateStr, formatDateKey, formatTimeDisplay } from '../services/reminderService.ts';
import { ClockIcon, CalendarDaysIcon, SparklesIcon, CheckCircleIcon } from './icons.tsx';

interface WaitingStatusModalProps {
    isOpen: boolean;
    ticket: RepairTicket;
    targetStatus: RepairStatus; // DEVIS_A_VALIDER or EN_ATTENTE_DE_PIECES or other
    onClose: () => void;
    onConfirm: (updatedTicket: RepairTicket) => Promise<void>;
    role?: Role;
}

const PRESET_MOTIFS = [
    { id: 'devis', label: 'Validation du devis', defaultDays: 2, defaultTime: '10:00', type: 'devis' as const },
    { id: 'piece_ecran', label: 'Arrivée pièce (Écran Retina / LCD)', defaultDays: 3, defaultTime: '14:00', type: 'piece' as const },
    { id: 'piece_batterie', label: 'Arrivée pièce (Batterie d\'origine)', defaultDays: 2, defaultTime: '14:00', type: 'piece' as const },
    { id: 'piece_clavier', label: 'Arrivée pièce (Clavier / Topcase)', defaultDays: 4, defaultTime: '14:00', type: 'piece' as const },
    { id: 'piece_cm', label: 'Arrivée composant / Carte Mère', defaultDays: 5, defaultTime: '14:00', type: 'piece' as const },
    { id: 'client_rep', label: 'Réponse client suite à test atelier', defaultDays: 1, defaultTime: '11:00', type: 'autre' as const },
    { id: 'decision_ent', label: 'Accord direction / Bon pour accord Entreprise', defaultDays: 2, defaultTime: '09:00', type: 'autre' as const },
];

export const WaitingStatusModal: React.FC<WaitingStatusModalProps> = ({
    isOpen,
    ticket,
    targetStatus,
    onClose,
    onConfirm,
    role = 'Technicien'
}) => {
    const isInitialDevis = targetStatus === RepairStatus.DEVIS_A_VALIDER;
    const isInitialPiece = targetStatus === RepairStatus.EN_ATTENTE_DE_PIECES;

    const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
        if (isInitialDevis) return 'devis';
        if (isInitialPiece) return 'piece_ecran';
        return 'devis';
    });

    const [customMotif, setCustomMotif] = useState<string>(() => {
        return ticket.waitingReason || (isInitialDevis ? 'validation du devis' : isInitialPiece ? 'arrivée de la pièce de rechange' : 'décision client');
    });

    const [targetDate, setTargetDate] = useState<string>(() => {
        if (ticket.waitingFollowUpDate) return ticket.waitingFollowUpDate;
        const days = isInitialDevis ? 2 : 3;
        return addDaysToDateStr(formatDateKey(new Date()), days);
    });

    const [targetTime, setTargetTime] = useState<string>(() => {
        return ticket.waitingFollowUpTime || (isInitialDevis ? '10:00' : '14:00');
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const activeType = useMemo(() => {
        if (selectedPresetId === 'devis' || customMotif.toLowerCase().includes('devis')) return 'devis' as const;
        if (selectedPresetId.startsWith('piece') || customMotif.toLowerCase().includes('pièce') || customMotif.toLowerCase().includes('piece')) return 'piece' as const;
        return 'autre' as const;
    }, [selectedPresetId, customMotif]);

    const generatedPhrase = useMemo(() => {
        return generateWaitingStatusPhrase(customMotif, targetDate, targetTime, activeType);
    }, [customMotif, targetDate, targetTime, activeType]);

    // Computed reminder dates
    const reminderJ3 = useMemo(() => addDaysToDateStr(targetDate, -3), [targetDate]);
    const reminderJ1 = useMemo(() => addDaysToDateStr(targetDate, -1), [targetDate]);

    const handleSelectPreset = (preset: typeof PRESET_MOTIFS[0]) => {
        setSelectedPresetId(preset.id);
        setCustomMotif(preset.label);
        setTargetDate(addDaysToDateStr(formatDateKey(new Date()), preset.defaultDays));
        setTargetTime(preset.defaultTime);
    };

    const handleQuickDays = (days: number) => {
        setTargetDate(addDaysToDateStr(formatDateKey(new Date()), days));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const now = new Date().toISOString();
            const historyEntry: HistoryEntry = {
                timestamp: now,
                user: role,
                action: `Statut mis à jour : ${ticket.status} ➔ ${targetStatus} (${generatedPhrase})`
            };

            const updatedTicket: RepairTicket = {
                ...ticket,
                status: targetStatus,
                waitingStatusLabel: generatedPhrase,
                waitingReason: customMotif,
                waitingFollowUpDate: targetDate,
                waitingFollowUpTime: targetTime,
                updatedAt: now,
                history: [...ticket.history, historyEntry]
            };

            await onConfirm(updatedTicket);
            onClose();
        } catch (error) {
            console.error("Failed to save precise waiting status:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
            <div className="apple-card w-full max-w-xl p-6 sm:p-8 bg-zinc-950/95 border border-amber-500/30 rounded-3xl shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
                
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest rounded-full">
                            Règle Atelier Obligatoire
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-2 flex items-center gap-2">
                            Préciser le statut d'attente
                        </h2>
                        <p className="text-xs text-slate-400 font-bold mt-1">
                            Dossier <span className="text-white">{ticket.id}</span> • {ticket.client?.name} ({ticket.macBrand} {ticket.macModel})
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all text-sm font-bold"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Presets */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Motif précis de l'attente
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {PRESET_MOTIFS.map(preset => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => handleSelectPreset(preset)}
                                    className={`p-3 rounded-2xl text-left text-xs font-black transition-all border ${
                                        selectedPresetId === preset.id
                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-900/20'
                                            : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10'
                                    }`}
                                >
                                    <p className="uppercase tracking-tight">{preset.label}</p>
                                    <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                                        Relance suggérée : {preset.defaultDays}j ({formatTimeDisplay(preset.defaultTime)})
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Motif Input */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Détail ou ajustement du motif
                        </label>
                        <input 
                            type="text" 
                            value={customMotif}
                            onChange={(e) => setCustomMotif(e.target.value)}
                            placeholder="Ex: Validation du devis, Pièce d'écran LCD reçue..."
                            className="w-full p-3.5 bg-black/50 border border-white/10 rounded-2xl text-white text-xs font-bold focus:border-amber-500 outline-none transition-all"
                            required
                        />
                    </div>

                    {/* Date & Time settings */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/40 p-4 rounded-2xl border border-white/5">
                        <div>
                            <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <CalendarDaysIcon className="w-4 h-4 text-amber-400" />
                                Date du point / arrivée
                            </label>
                            <input 
                                type="date"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                className="w-full p-3 bg-zinc-900 border border-white/10 rounded-xl text-white font-mono text-xs outline-none focus:border-amber-500"
                                required
                            />
                            {/* Quick Days */}
                            <div className="flex gap-1.5 mt-2">
                                {[1, 2, 3, 5, 7].map(d => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => handleQuickDays(d)}
                                        className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black text-slate-300 uppercase"
                                    >
                                        +{d}j
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <ClockIcon className="w-4 h-4 text-amber-400" />
                                Heure de la relance / action
                            </label>
                            <input 
                                type="time"
                                value={targetTime}
                                onChange={(e) => setTargetTime(e.target.value)}
                                className="w-full p-3 bg-zinc-900 border border-white/10 rounded-xl text-white font-mono text-xs outline-none focus:border-amber-500"
                                required
                            />
                            {/* Quick hours */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {['08:00', '09:00', '10:00', '11:00', '14:00', '16:00'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setTargetTime(t)}
                                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                                            targetTime === t ? 'bg-amber-500 text-black font-extrabold' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                        }`}
                                    >
                                        {formatTimeDisplay(t)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Phrase Preview Result */}
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                        <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                            <SparklesIcon className="w-4 h-4" /> Phrase officielle enregistrée sur la fiche
                        </p>
                        <p className="text-sm font-black text-white italic bg-black/40 p-3 rounded-xl border border-white/5">
                            "{generatedPhrase}"
                        </p>
                    </div>

                    {/* Automatic Reminders Generated (3 rappels) */}
                    <div className="p-4 bg-zinc-900/60 rounded-2xl border border-white/5 space-y-2.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            3 Rappels automatiques programmés :
                        </p>
                        <div className="space-y-1.5 text-xs text-slate-300">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                <span className="font-mono text-blue-400 font-bold">J-3 ({reminderJ3})</span> : Préparer et organiser le point client
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                <span className="font-mono text-amber-400 font-bold">J-1 ({reminderJ1})</span> : Confirmer l'avancement et préparer la relance
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                <span className="font-mono text-emerald-400 font-bold">Jour J ({targetDate}) à 08h & {formatTimeDisplay(targetTime)}</span> : Action active dans le tableau du matin
                            </div>
                        </div>
                    </div>

                    {/* Actions buttons */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-7 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-900/30 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                            <CheckCircleIcon className="w-4 h-4" />
                            <span>Enregistrer & Activer Rappels</span>
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default WaitingStatusModal;
