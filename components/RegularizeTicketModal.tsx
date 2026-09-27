import React, { useState, useMemo } from 'react';
import { RepairTicket } from '../types.ts';
import { 
    XIcon, 
    CheckCircleIcon, 
    ExclamationTriangleIcon, 
    ArrowPathIcon,
    PencilIcon
} from './icons.tsx';
import { 
    isFallbackTicketId, 
    generateNextTicketSequence, 
    findChronologicalGapForTicket,
    extractTicketSequenceNumber 
} from '../utils/idGenerator.ts';

interface RegularizeTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: RepairTicket;
    allTickets: RepairTicket[];
    onConfirm: (newId: string) => Promise<void>;
}

const RegularizeTicketModal: React.FC<RegularizeTicketModalProps> = ({
    isOpen,
    onClose,
    ticket,
    allTickets,
    onConfirm
}) => {
    const isEnterprise = Boolean(ticket.client?.isEnterprise);
    const targetYear = ticket.createdAt 
        ? new Date(ticket.createdAt).getFullYear() 
        : new Date().getFullYear();

    // Trou chronologique détecté (ex: 26-RM-0672)
    const suggestedGap = useMemo(() => {
        return findChronologicalGapForTicket(ticket, allTickets);
    }, [ticket, allTickets]);

    // Prochain numéro en fin de série (ex: 26-RM-0725)
    const nextSeriesSeq = useMemo(() => {
        return generateNextTicketSequence(allTickets, isEnterprise, targetYear);
    }, [allTickets, isEnterprise, targetYear]);

    // État de l'ID choisi ou saisi manuellement
    const [selectedId, setSelectedId] = useState<string>(() => {
        return suggestedGap || nextSeriesSeq;
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Réinitialiser la suggestion si le ticket change
    React.useEffect(() => {
        if (isOpen) {
            setSelectedId(suggestedGap || nextSeriesSeq);
        }
    }, [isOpen, suggestedGap, nextSeriesSeq]);

    // Validation du numéro saisi
    const validation = useMemo(() => {
        const clean = selectedId.trim().toUpperCase();
        if (!clean) {
            return { valid: false, message: "Veuillez renseigner un numéro de dossier.", type: 'error' };
        }

        // Vérifier s'il y a un conflit avec un autre ticket
        const conflict = (allTickets || []).find(
            t => t.id.trim().toUpperCase() === clean && t.id.trim().toUpperCase() !== ticket.id.trim().toUpperCase()
        );

        if (conflict) {
            return {
                valid: false,
                message: `Conflit : Le numéro ${clean} est déjà attribué à ${conflict.client?.name || 'un autre client'} (${conflict.macModel || 'Appareil'}).`,
                type: 'error'
            };
        }

        // Vérifier s'il s'agit d'un identifiant fallback
        if (isFallbackTicketId(clean)) {
            return {
                valid: false,
                message: "Ce numéro contient encore un mot-clé provisoire (FALLBACK / NOUVEAU). Utilisez un format officiel (YY-RM-XXXX).",
                type: 'warning'
            };
        }

        const seqNum = extractTicketSequenceNumber(clean, isEnterprise, targetYear);
        if (seqNum === null) {
            return {
                valid: true,
                message: `Format personnalisé détecté (${clean}). Veillez à respecter la convention de votre atelier.`,
                type: 'info'
            };
        }

        return {
            valid: true,
            message: `✓ Numéro ${clean} parfaitement disponible et conforme aux standards de numérotation.`,
            type: 'success'
        };
    }, [selectedId, allTickets, ticket.id, isEnterprise, targetYear]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const clean = selectedId.trim().toUpperCase();
        if (!validation.valid || !clean || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onConfirm(clean);
            onClose();
        } catch (err) {
            console.error("Error applying regularized ticket ID:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 text-white overflow-hidden relative">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl">
                            <PencilIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-tight">
                                Régulariser / Modifier le N° de Dossier
                            </h3>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Identifiant actuel : <span className="font-mono font-bold text-amber-400">{ticket.id}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-all"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Info & Ambition */}
                <div className="text-xs text-zinc-300 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-1.5">
                    <p className="font-medium text-zinc-200">
                        Date de dépôt : <span className="font-bold text-white">{new Date(ticket.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Le système prend en charge un volume illimité de fiches sans restriction numérique (au-delà de 9999, 10000+). La mise à jour propagera automatiquement ce numéro sur tous les rendez-vous, engagements SAV et historiques associés.
                    </p>
                </div>

                {/* Suggestions Rapides */}
                <div className="space-y-3">
                    <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                        Options de numérotation suggérées
                    </label>

                    <div className="grid grid-cols-1 gap-2.5">
                        {/* Option 1 : Trou chronologique (ex: 26-RM-0672) */}
                        {suggestedGap && (
                            <button
                                type="button"
                                onClick={() => setSelectedId(suggestedGap)}
                                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                                    selectedId === suggestedGap
                                        ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500'
                                        : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                                }`}
                            >
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-black text-sm text-blue-400">{suggestedGap}</span>
                                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[9px] font-black uppercase rounded-full">
                                            Recommandé (Rattrapage)
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        Comble l'interruption de séquence entre les dossiers créés à cette période.
                                    </p>
                                </div>
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                    selectedId === suggestedGap ? 'border-blue-500 bg-blue-500 text-white' : 'border-zinc-700'
                                }`}>
                                    {selectedId === suggestedGap && <span className="text-xs">✓</span>}
                                </div>
                            </button>
                        )}

                        {/* Option 2 : Fin de série */}
                        <button
                            type="button"
                            onClick={() => setSelectedId(nextSeriesSeq)}
                            className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                                selectedId === nextSeriesSeq
                                    ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500'
                                    : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                            }`}
                        >
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-black text-sm text-zinc-200">{nextSeriesSeq}</span>
                                    <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-[9px] font-black uppercase rounded-full">
                                        Fin de série
                                    </span>
                                </div>
                                <p className="text-[11px] text-zinc-400">
                                    Attribue le prochain numéro officiel séquentiel disponible.
                                </p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                selectedId === nextSeriesSeq ? 'border-blue-500 bg-blue-500 text-white' : 'border-zinc-700'
                            }`}>
                                {selectedId === nextSeriesSeq && <span className="text-xs">✓</span>}
                            </div>
                        </button>
                    </div>
                </div>

                {/* Saisie Libre */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                            Numéro final à appliquer (modifiable librement)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={selectedId}
                                onChange={(e) => setSelectedId(e.target.value.toUpperCase())}
                                placeholder="ex: 26-RM-0672"
                                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-2xl font-mono text-base font-bold text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all uppercase tracking-wider"
                            />
                            {selectedId && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedId('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs p-1"
                                >
                                    Effacer
                                </button>
                            )}
                        </div>

                        {/* Message de statut en direct */}
                        <div className={`mt-2 text-xs flex items-center gap-1.5 ${
                            validation.type === 'error' ? 'text-red-400' :
                            validation.type === 'warning' ? 'text-amber-400' :
                            validation.type === 'info' ? 'text-sky-400' : 'text-emerald-400'
                        }`}>
                            {validation.type === 'error' && <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />}
                            {validation.type === 'success' && <CheckCircleIcon className="w-4 h-4 shrink-0" />}
                            <span>{validation.message}</span>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={!validation.valid || isSubmitting || selectedId.trim().toUpperCase() === ticket.id.trim().toUpperCase()}
                            className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    <span>Mise à jour en cours...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircleIcon className="w-4 h-4" />
                                    <span>Appliquer N° {selectedId.trim().toUpperCase() || '...'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegularizeTicketModal;
