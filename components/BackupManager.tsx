import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { backupData, backupUniqueMasterArchive, getDatabaseSummary, validateBackupSchema } from '../services/backupService.ts';
import { dbGetStorageEstimate, dbRequestPersistentStorage } from '../services/dbService.ts';
import {
    ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowPathIcon,
    ShieldCheckIcon, ArchiveBoxIcon,
    ExclamationTriangleIcon, CheckCircleIcon
} from './icons.tsx';
import { useToastContext } from '../context/ToastContext.tsx';
import BackupPeriodRestoreModal from './BackupPeriodRestoreModal.tsx';

const BackupManager: React.FC = () => {
    const { showToast } = useToastContext();
    const [actionProgress, setActionProgress] = useState({ loading: false, message: '' });
    const [restorePreview, setRestorePreview] = useState<{ fileName: string; data: Record<string, unknown> } | null>(null);
    const [localStats, setLocalStats] = useState<{
        tickets: number;
        stock: number;
        finance: number;
        documents: number;
        coverageLabel?: string;
    }>({ tickets: 0, stock: 0, finance: 0, documents: 0 });
    const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number; percent: number; isPersistent: boolean } | null>(null);
    const restoreInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        refreshStats();
        checkStorage();
    }, []);

    const checkStorage = async () => {
        const estimate = await dbGetStorageEstimate();
        const isPersistent = await (navigator.storage && navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false));
        if (estimate) {
            setStorageInfo({ ...estimate, isPersistent });
        }
    };

    const handleRequestPersistence = async () => {
        const granted = await dbRequestPersistentStorage();
        if (granted) {
            showToast("Stockage persistant activé.", "success");
            checkStorage();
        } else {
            showToast("Le navigateur a refusé la persistance.", "warning");
        }
    };

    const refreshStats = async () => {
        const stats = await getDatabaseSummary();
        setLocalStats(stats);
    };

    const handleUniqueBackup = async () => {
        setActionProgress({ loading: true, message: 'Génération du Backup Unique complet...' });
        try {
            const res = await backupUniqueMasterArchive();
            showToast(
                `Backup Unique généré (${res.coverage.coverageLabel} · ${res.coverage.totalTickets} fiches) !`,
                'success'
            );
        } catch {
            showToast('Échec de la génération du Backup Unique.', 'error');
        } finally {
            setActionProgress({ loading: false, message: '' });
        }
    };

    const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setActionProgress({ loading: true, message: 'Audit du fichier...' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const raw = JSON.parse(e.target?.result as string);
                const validation = validateBackupSchema(raw);

                if (!validation.valid) throw new Error(validation.errors[0]);

                setRestorePreview({
                    fileName: file.name,
                    data: raw as Record<string, unknown>
                });
            } catch {
                showToast("Format incompatible.", "error");
            } finally {
                setActionProgress({ loading: false, message: '' });
                if (restoreInputRef.current) restoreInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-end gap-6 bg-white/[0.02] p-8 rounded-[40px] border border-white/5 shadow-2xl">
                <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                            <ShieldCheckIcon className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic">Centre de Sauvegarde</h2>
                    </div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                        Standard TGS-CI : Export Interopérable &amp; Restauration Sélective par Période
                    </p>
                    {localStats.coverageLabel && (
                        <p className="text-xs font-bold text-emerald-400 mt-2">
                            Plage des dossiers locaux : {localStats.coverageLabel}
                        </p>
                    )}
                </div>

                <div className="bg-blue-600/10 px-6 py-4 rounded-3xl border border-blue-500/20 text-center">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Base Active</p>
                    <p className="text-sm font-black text-white">{localStats.tickets} Fiches</p>
                </div>
            </header>

            {/* STORAGE HEALTH */}
            <div className="apple-card p-8 bg-white/[0.02] border border-white/5">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${storageInfo?.isPersistent ? 'bg-emerald-600' : 'bg-amber-600'} shadow-xl`}>
                            {storageInfo?.isPersistent ? <CheckCircleIcon className="w-6 h-6 text-white" /> : <ExclamationTriangleIcon className="w-6 h-6 text-white" />}
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Santé du Stockage Local</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                {storageInfo?.isPersistent ? 'Stockage Persistant Activé' : 'Stockage Temporaire (Risque de suppression)'}
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 max-w-md w-full">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                            <span className="text-slate-400">Utilisation : {((storageInfo?.usage || 0) / (1024 * 1024 * 1024)).toFixed(2)} Go</span>
                            <span className="text-blue-400">Quota : {((storageInfo?.quota || 0) / (1024 * 1024 * 1024)).toFixed(0)} Go</span>
                        </div>
                        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div
                                className={`h-full transition-all duration-1000 ${storageInfo?.percent && storageInfo.percent > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${storageInfo?.percent || 0}%` }}
                            ></div>
                        </div>
                    </div>

                    {!storageInfo?.isPersistent && (
                        <button
                            onClick={handleRequestPersistence}
                            className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-amber-900/40"
                        >
                            Activer Persistance
                        </button>
                    )}
                </div>
                <p className="mt-4 text-[9px] text-slate-500 font-bold uppercase leading-relaxed max-w-3xl">
                    L&apos;application peut stocker plus de 100 Go de données (fiches, photos, documents) directement dans votre navigateur.
                    L&apos;activation de la persistance empêche le système de supprimer vos données en cas de manque d&apos;espace disque.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="group bg-white/[0.03] p-10 rounded-[48px] border border-white/5 hover:border-blue-500/30 transition-all space-y-5">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
                        <ArrowDownTrayIcon className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase mb-2">Exporter l&apos;Atelier</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Fichier JSON structuré (V4) incluant automatiquement la date du plus ancien dossier jusqu&apos;à aujourd&apos;hui, toutes vos fiches, photos, vidéos, factures, montants, prestations et stock.
                        </p>
                    </div>
                    <div className="space-y-3 pt-2">
                        <button onClick={() => backupData('FULL')} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase text-xs tracking-widest transition-all">
                            Générer Archive .JSON (Classique)
                        </button>
                        <button
                            onClick={handleUniqueBackup}
                            className="w-full py-4 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-3xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            <ArchiveBoxIcon className="w-4 h-4 text-emerald-400" />
                            <span>Créer Backup Unique Complet (Historique Total)</span>
                        </button>
                    </div>
                </div>

                <div className="group bg-white/[0.03] p-10 rounded-[48px] border border-white/5 hover:border-emerald-500/30 transition-all space-y-5">
                    <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center">
                        <ArrowUpTrayIcon className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase mb-2">Importer / Restaurer par Période</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Chargez votre archive pour restaurer uniquement les <strong>2, 3, 4 ou 5 derniers mois</strong>, tout restaurer, ou rechercher et importer un ancien dossier précis (ex. client venu il y a 7 mois).
                        </p>
                    </div>
                    <div className="pt-2">
                        <button onClick={() => restoreInputRef.current?.click()} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black uppercase text-xs tracking-widest transition-all">
                            Sélectionner un fichier (.json)
                        </button>
                        <input type="file" ref={restoreInputRef} className="hidden" accept=".json" onChange={handleFileSelect} />
                    </div>
                </div>
            </div>

            {actionProgress.loading && (
                <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-10 text-center backdrop-blur-xl">
                    <div className="space-y-6">
                        <ArrowPathIcon className="w-16 h-16 text-blue-500 animate-spin mx-auto" />
                        <p className="text-2xl font-black text-white uppercase tracking-tighter animate-pulse">{actionProgress.message}</p>
                    </div>
                </div>
            )}

            <BackupPeriodRestoreModal
                isOpen={!!restorePreview}
                fileName={restorePreview?.fileName || ''}
                rawBackupData={restorePreview?.data || null}
                onClose={() => setRestorePreview(null)}
                onCompleted={() => {
                    setRestorePreview(null);
                    window.location.reload();
                }}
            />
        </div>
    );
};

export default BackupManager;
