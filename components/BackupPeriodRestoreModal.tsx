import React, { useMemo, useState } from 'react';
import {
    CalendarDaysIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    ShieldCheckIcon,
    XIcon,
    ArrowPathIcon,
} from './icons.tsx';
import {
    RestorePeriodSelection,
    computeBackupCoverage,
    filterBackupByPeriod,
    formatFrenchDate,
    searchTicketsInBackup,
} from '../utils/backupPeriod.ts';
import {
    mergeDatabaseWithPeriodFilter,
    restoreDatabaseWithPeriodFilter,
} from '../services/backupService.ts';
import { useToastContext } from '../context/ToastContext.tsx';

interface BackupPeriodRestoreModalProps {
    isOpen: boolean;
    fileName: string;
    rawBackupData: unknown;
    onClose: () => void;
    onCompleted?: (mode: 'merge' | 'overwrite' | 'single', summary: string) => void;
    allowOverwrite?: boolean;
}

const PERIOD_OPTIONS: Array<{ value: RestorePeriodSelection; label: string; sub: string }> = [
    { value: 2, label: '2 derniers mois', sub: 'Dossiers récents' },
    { value: 3, label: '3 derniers mois', sub: 'Trimestre actif' },
    { value: 4, label: '4 derniers mois', sub: 'Activité étendue' },
    { value: 5, label: '5 derniers mois', sub: 'Historique moyen' },
    { value: 'all', label: 'Tout restaurer', sub: 'Historique complet' },
];

const BackupPeriodRestoreModal: React.FC<BackupPeriodRestoreModalProps> = ({
    isOpen,
    fileName,
    rawBackupData,
    onClose,
    onCompleted,
    allowOverwrite = true,
}) => {
    const { showToast } = useToastContext();
    const [selectedPeriod, setSelectedPeriod] = useState<RestorePeriodSelection>('all');
    const [includeReferenceData, setIncludeReferenceData] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmOverwrite, setConfirmOverwrite] = useState(false);
    const [isWorking, setIsWorking] = useState(false);
    const [progressMsg, setProgressMsg] = useState('');

    const coverage = useMemo(() => {
        if (!rawBackupData) return null;
        return computeBackupCoverage(rawBackupData as Record<string, unknown>);
    }, [rawBackupData]);

    const preview = useMemo(() => {
        if (!rawBackupData) return null;
        return filterBackupByPeriod(rawBackupData, {
            months: selectedPeriod,
            includeReferenceData,
        });
    }, [rawBackupData, selectedPeriod, includeReferenceData]);

    const searchMatches = useMemo(() => {
        if (!rawBackupData || !searchQuery.trim()) return [];
        return searchTicketsInBackup(rawBackupData, searchQuery, 15);
    }, [rawBackupData, searchQuery]);

    if (!isOpen || !rawBackupData || !coverage || !preview) return null;

    const handleApply = async (mode: 'merge' | 'overwrite') => {
        if (mode === 'overwrite' && !confirmOverwrite) {
            setConfirmOverwrite(true);
            return;
        }
        setIsWorking(true);
        setProgressMsg(mode === 'merge' ? 'Fusion intelligente en cours...' : 'Restauration en cours...');
        try {
            const opts = { months: selectedPeriod, includeReferenceData };
            if (mode === 'merge') {
                await mergeDatabaseWithPeriodFilter(rawBackupData, opts, setProgressMsg);
            } else {
                await restoreDatabaseWithPeriodFilter(rawBackupData, opts, setProgressMsg);
            }
            const periodLabel = selectedPeriod === 'all' ? 'historique complet' : `${selectedPeriod} derniers mois`;
            const msg = `${preview.counts.tickets} fiche(s), ${preview.counts.factures} facture(s) et ${preview.counts.commandes} commande(s) (${periodLabel}) intégrées avec succès.`;
            showToast(msg, 'success');
            if (onCompleted) {
                onCompleted(mode, msg);
            } else {
                window.location.reload();
            }
        } catch (err) {
            console.error('Period restore failed:', err);
            showToast('Échec de la restauration depuis cette archive.', 'error');
        } finally {
            setIsWorking(false);
            setConfirmOverwrite(false);
            setProgressMsg('');
        }
    };

    const handleRestoreSingleTicket = async (ticketId: string) => {
        setIsWorking(true);
        setProgressMsg(`Restauration du dossier #${ticketId}...`);
        try {
            await mergeDatabaseWithPeriodFilter(
                rawBackupData,
                {
                    months: 'all',
                    includeReferenceData,
                    onlyTicketIds: [ticketId],
                },
                setProgressMsg
            );
            const msg = `Dossier #${ticketId} et ses pièces/factures liées importés sans écraser votre base actuelle.`;
            showToast(msg, 'success');
            if (onCompleted) {
                onCompleted('single', msg);
            } else {
                window.location.reload();
            }
        } catch (err) {
            console.error('Single ticket restore failed:', err);
            showToast(`Impossible d'importer le dossier #${ticketId}.`, 'error');
        } finally {
            setIsWorking(false);
            setProgressMsg('');
        }
    };

    return (
        <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#111418] border border-white/10 rounded-[28px] max-w-3xl w-full shadow-2xl overflow-hidden my-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 p-6 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                            <ShieldCheckIcon className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">
                                Audit & Choix de la Période de Restauration
                            </h3>
                            <p className="text-xs font-mono text-blue-400 break-all mt-0.5">{fileName}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isWorking}
                        className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                    {/* Plage couverte par le backup */}
                    <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <CalendarDaysIcon className="w-6 h-6 text-emerald-400 shrink-0" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                                    Couverture réelle contenue dans ce backup
                                </p>
                                <p className="text-sm font-bold text-white mt-0.5">
                                    {coverage.coverageLabel}
                                </p>
                            </div>
                        </div>
                        <div className="text-left sm:text-right text-xs text-slate-300 space-y-0.5">
                            <p><span className="font-black text-white">{coverage.totalTickets}</span> fiches au total</p>
                            <p className="text-[11px] text-slate-400">
                                {coverage.totalFactures} factures · {coverage.totalCommandes} commandes · {coverage.totalStock} stock
                            </p>
                        </div>
                    </div>

                    {/* Sélecteur simple 2, 3, 4, 5 mois ou Tout */}
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">
                            1. Quelle période souhaitez-vous restaurer dans cet appareil ?
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            {PERIOD_OPTIONS.map((opt) => {
                                const active = selectedPeriod === opt.value;
                                return (
                                    <button
                                        key={String(opt.value)}
                                        type="button"
                                        disabled={isWorking}
                                        onClick={() => {
                                            setSelectedPeriod(opt.value);
                                            setConfirmOverwrite(false);
                                        }}
                                        className={`p-3 rounded-2xl border text-left transition-all ${
                                            active
                                                ? 'bg-blue-600/25 border-blue-400 text-white shadow-lg shadow-blue-950/40'
                                                : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07]'
                                        }`}
                                    >
                                        <p className="text-xs font-black uppercase tracking-wide">{opt.label}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{opt.sub}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Compteur temps réel de ce qui sera restauré */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold text-white">
                                {preview.cutoffIso
                                    ? `Sélection : du ${formatFrenchDate(preview.cutoffIso)} à aujourd'hui (${selectedPeriod} derniers mois)`
                                    : 'Sélection : Historique complet de cette archive'}
                            </p>
                            <span className="text-xs font-black text-blue-400">
                                {preview.counts.tickets} fiches retenues
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="bg-black/30 rounded-xl px-3 py-2 border border-white/5">
                                <span className="text-slate-400 block text-[10px] uppercase">Fiches</span>
                                <span className="font-black text-white text-sm">{preview.counts.tickets}</span>
                            </div>
                            <div className="bg-black/30 rounded-xl px-3 py-2 border border-white/5">
                                <span className="text-slate-400 block text-[10px] uppercase">Factures / Devis</span>
                                <span className="font-black text-white text-sm">
                                    {preview.counts.factures + preview.counts.proformas}
                                </span>
                            </div>
                            <div className="bg-black/30 rounded-xl px-3 py-2 border border-white/5">
                                <span className="text-slate-400 block text-[10px] uppercase">Commandes / SAV</span>
                                <span className="font-black text-white text-sm">
                                    {preview.counts.commandes + preview.counts.engagementsSav}
                                </span>
                            </div>
                            <div className="bg-black/30 rounded-xl px-3 py-2 border border-white/5">
                                <span className="text-slate-400 block text-[10px] uppercase">Stock & Tarifs</span>
                                <span className="font-black text-white text-sm">
                                    {preview.counts.stock + preview.counts.services}
                                </span>
                            </div>
                        </div>

                        <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer pt-1">
                            <input
                                type="checkbox"
                                checked={includeReferenceData}
                                onChange={(e) => setIncludeReferenceData(e.target.checked)}
                                className="rounded border-white/20 bg-black/40 text-blue-500"
                            />
                            <span>
                                Conserver & inclure le Catalogue Stock, les Prestations/Tarifs et les Paramètres (recommandé pour ne perdre aucun montant ni prestation)
                            </span>
                        </label>
                    </div>

                    {/* Recherche ciblée d'un ancien dossier (ex: client venu il y a 7 mois) */}
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <MagnifyingGlassIcon className="w-4 h-4 text-amber-400" />
                            <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                                Client ancien de retour (ex. il y a 7 mois ou plus) ? Recherche directe dans ce backup
                            </p>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher par nom du client, téléphone, n° fiche (#26-RM-...) ou n° série..."
                            className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                        {searchQuery.trim() && (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {searchMatches.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic px-1">
                                        Aucun dossier trouvé pour « {searchQuery} » dans cette archive.
                                    </p>
                                ) : (
                                    searchMatches.map((t) => (
                                        <div
                                            key={t.id}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-black/40 border border-white/10 rounded-xl p-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-white">
                                                    #{t.id} · {t.client?.name || 'Client'} ({t.client?.phone || '—'})
                                                </p>
                                                <p className="text-[11px] text-slate-400 truncate">
                                                    {formatFrenchDate(t.createdAt)} · {t.macModel || 'MacBook'} · Statut : {t.status} · Montant : {(t.costs?.repair || 0).toLocaleString('fr-FR')} F
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={isWorking}
                                                onClick={() => handleRestoreSingleTicket(t.id)}
                                                className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider shrink-0 transition-colors disabled:opacity-50"
                                            >
                                                Importer ce dossier
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {isWorking && (
                        <div className="flex items-center gap-3 bg-blue-600/15 border border-blue-500/30 rounded-2xl p-3 text-xs font-bold text-blue-300">
                            <ArrowPathIcon className="w-4 h-4 animate-spin shrink-0" />
                            <span>{progressMsg || 'Traitement en cours...'}</span>
                        </div>
                    )}

                    {confirmOverwrite && (
                        <div className="flex items-start gap-3 bg-red-600/15 border border-red-500/40 rounded-2xl p-4 text-xs text-red-200">
                            <ExclamationTriangleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-black uppercase text-red-300">Confirmer le remplacement complet de la base locale ?</p>
                                <p className="mt-1 text-red-200/80">
                                    Les données locales non présentes dans la période choisie seront remplacées sur cet appareil. Si vous souhaitez juste ajouter les fiches sans rien supprimer, cliquez plutôt sur « Fusionner sans écraser ».
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 p-6 border-t border-white/10 bg-white/[0.02]">
                    <button
                        type="button"
                        disabled={isWorking}
                        onClick={onClose}
                        className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-black uppercase tracking-wider transition-colors"
                    >
                        Annuler
                    </button>

                    {allowOverwrite && (
                        <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => handleApply('overwrite')}
                            className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors border ${
                                confirmOverwrite
                                    ? 'bg-red-600 hover:bg-red-500 text-white border-red-400'
                                    : 'bg-white/5 hover:bg-red-600/20 text-red-300 border-red-500/30'
                            }`}
                        >
                            {confirmOverwrite ? 'Confirmer le remplacement' : 'Remplacer la base locale'}
                        </button>
                    )}

                    <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => handleApply('merge')}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-900/40 transition-colors disabled:opacity-50"
                    >
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>Fusionner sans écraser (Recommandé)</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BackupPeriodRestoreModal;
