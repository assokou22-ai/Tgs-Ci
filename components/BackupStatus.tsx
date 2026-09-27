import React, { useState, useRef } from 'react';
import { BackupData } from '../types.ts';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowPathIcon, ShieldCheckIcon } from './icons.tsx';
import { backupData, mergeDatabaseFromFile, validateBackupSchema } from '../services/backupService.ts';
import { synchronizeOnlineExport, synchronizeOnlineImport } from '../services/syncService.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';

const formatDisplayDate = (isoString: string | null): string => {
    if (!isoString) return 'Jamais';
    const date = new Date(isoString);
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const BackupStatus: React.FC = () => {
    const { showToast } = useToastContext();
    const [lastBackup, setLastBackup] = useState<string | null>(localStorage.getItem('mac-repair-app-lastBackupDate'));
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressMsg, setProgressMsg] = useState<string | null>(null);
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [activeSyncType, setActiveSyncType] = useState<'export' | 'import' | null>(null);
    const [rawBackupData, setRawBackupData] = useState<BackupData | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleOnlineExport = async () => {
        setIsProcessing(true);
        setActiveSyncType('export');
        setProgressPercent(0);
        setProgressMsg("Initialisation de l'exportation...");
        try {
            await synchronizeOnlineExport((msg, percent) => {
                setProgressMsg(msg);
                setProgressPercent(percent);
            });
            showToast("Synchro ONLINE Export terminée et transférée sur Firestore avec succès !", "success");
            const now = new Date().toISOString();
            localStorage.setItem('mac-repair-app-lastBackupDate', now);
            setLastBackup(now);
        } catch (err: unknown) {
            console.error(err);
            const errMsg = err instanceof Error ? err.message : "Erreur lors de l'exportation ONLINE.";
            showToast(errMsg, "error");
        } finally {
            setIsProcessing(false);
            setActiveSyncType(null);
            setProgressMsg(null);
        }
    };

    const handleOnlineImport = async () => {
        setIsProcessing(true);
        setActiveSyncType('import');
        setProgressPercent(0);
        setProgressMsg("Initialisation de l'importation...");
        try {
            await synchronizeOnlineImport((msg, percent) => {
                setProgressMsg(msg);
                setProgressPercent(percent);
            });
            showToast("Synchro ONLINE Import et intégration Cloud réalisées avec succès !", "success");
            const now = new Date().toISOString();
            localStorage.setItem('mac-repair-app-lastBackupDate', now);
            setLastBackup(now);
        } catch (err: unknown) {
            console.error(err);
            const errMsg = err instanceof Error ? err.message : "Erreur lors de l'importation ONLINE.";
            showToast(errMsg, "error");
        } finally {
            setIsProcessing(false);
            setActiveSyncType(null);
            setProgressMsg(null);
        }
    };

    const handleQuickBackup = async () => {
        setIsProcessing(true);
        try {
            await backupData('FULL');
            const now = new Date().toISOString();
            localStorage.setItem('mac-repair-app-lastBackupDate', now);
            setLastBackup(now);
            showToast("Sauvegarde locale exportée (Fichier JSON téléchargé)", "success");
        } catch {
            showToast("Erreur lors de la sauvegarde locale.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const raw = JSON.parse(event.target?.result as string);
                const validation = validateBackupSchema(raw);
                if (!validation.valid) throw new Error(validation.errors[0]);

                setRawBackupData(raw);
            } catch {
                showToast("Fichier invalide ou corrompu.", "error");
            } finally {
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const confirmMerge = async () => {
        if (!rawBackupData) return;
        try {
            setIsProcessing(true);
            await mergeDatabaseFromFile(rawBackupData);
            showToast("Fusion locale des données validée et appliquée.", "success");
            window.location.reload();
        } catch {
            showToast("La fusion locale a échoué.", "error");
        } finally {
            setIsProcessing(false);
            setRawBackupData(null);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-[#111418] p-5 rounded-[24px] border border-white/5 shadow-2xl gap-4">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-green-500/10 border border-green-500/20">
                        <ShieldCheckIcon className="w-7 h-7 text-green-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded inline-block mb-1">
                            Protection de l'atelier
                        </p>
                        <p className="text-sm font-bold text-white tracking-tight">
                            Dernière archive : {formatDisplayDate(lastBackup)}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-[#0071e3] font-bold uppercase tracking-wider mt-1">
                            <span>Sinc. Cibles :</span>
                            <span className="bg-[#0071e3]/10 text-[#0071e3] px-1.5 py-0.5 rounded">thegoodstoreci@gmail.com</span>
                            <span className="text-slate-600">&</span>
                            <span className="bg-[#0071e3]/10 text-[#0071e3] px-1.5 py-0.5 rounded">assokou22@gmail.com</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        onClick={handleOnlineExport}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 border border-blue-500/30 text-blue-400 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                        title="Sauver & exporter l'intégralité de l'application vers le serveur cloud"
                    >
                        {isProcessing && activeSyncType === 'export' ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin text-blue-400" />
                        ) : (
                            <ArrowUpTrayIcon className="w-4 h-4 text-blue-400" />
                        )}
                        <span>Synchro Online Export</span>
                    </button>

                    <button 
                        onClick={handleOnlineImport}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-teal-500/10 to-emerald-500/10 hover:from-teal-500/20 hover:to-emerald-500/20 border border-teal-500/30 text-teal-400 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                        title="Importer & fusionner l'intégralité de l'application depuis le serveur cloud"
                    >
                        {isProcessing && activeSyncType === 'import' ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin text-teal-400" />
                        ) : (
                            <ArrowDownTrayIcon className="w-4 h-4 text-teal-400" />
                        )}
                        <span>Synchro Online Import</span>
                    </button>

                    <span className="text-slate-700 font-bold">|</span>

                    <button 
                        onClick={handleQuickBackup}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-5 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/10 transition-all active:scale-95 disabled:opacity-50"
                        title="Télécharger l'archive JSON sur cette machine"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4 text-white" />
                        <span>Sauvegarder (locale)</span>
                    </button>

                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-5 py-3.5 bg-[#4c1d95]/20 hover:bg-[#4c1d95]/30 border border-purple-500/20 text-purple-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                        title="Fusionner des données depuis un fichier local .json"
                    >
                        <ArrowUpTrayIcon className="w-4 h-4 text-purple-400" />
                        <span>Fusionner (locale)</span>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportFile} />
                </div>
            </div>

            {/* BARRE DE CHARGEMENT DE 0 À 100 % */}
            {isProcessing && activeSyncType && (
                <div className="w-full bg-[#111418] rounded-[20px] p-4 border border-white/5 shadow-inner mt-2 animate-fade-in">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 animate-pulse">
                            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-blue-400" />
                            {progressMsg || (activeSyncType === 'export' ? "Exportation Cloud en cours..." : "Importation Cloud en cours...")}
                        </span>
                        <span className="text-xs font-black text-white">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                        <div 
                            className="bg-gradient-to-r from-blue-500 via-indigo-500 to-teal-500 h-full transition-all duration-300 ease-out" 
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!rawBackupData}
                onClose={() => setRawBackupData(null)}
                onConfirm={confirmMerge}
                title="Fusionner les données locales ?"
                message="FUSIONNER LOCALE : Souhaitez-vous ajouter les dossiers et données de ce fichier local JSON à votre base actuelle sans rien écraser ?"
                confirmText="Fusionner maintenant"
            />
        </div>
    );
};

export default BackupStatus;
