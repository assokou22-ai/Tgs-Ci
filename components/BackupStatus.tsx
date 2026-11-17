import React, { useState, useRef, useEffect } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowPathIcon, ShieldCheckIcon, ArchiveBoxIcon, ExclamationTriangleIcon } from './icons.tsx';
import { backupData, backupUniqueMasterArchive, getLocalBackupCoverage, validateBackupSchema } from '../services/backupService.ts';
import { synchronizeOnlineExport, synchronizeOnlineImport, pushMissingLocalTicketsToCloud } from '../services/syncService.ts';
import { useSyncStatus } from '../hooks/useSyncStatus.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import BackupPeriodRestoreModal from './BackupPeriodRestoreModal.tsx';
import { BackupCoverageSummary } from '../utils/backupPeriod.ts';

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
    const {
        unsyncedTickets,
        pendingChanges,
        pendingTickets,
        lastPushSucceeded,
        lastError,
        isQuotaExceeded,
        isSyncing,
    } = useSyncStatus();
    const effectiveUnsentCount = Math.max(pendingTickets, unsyncedTickets.length, pendingChanges);
    const hasUnsentItems = effectiveUnsentCount > 0;
    const hasHardError = Boolean(isQuotaExceeded) || Boolean(lastError) || (!lastPushSucceeded && !hasUnsentItems);

    const [lastBackup, setLastBackup] = useState<string | null>(localStorage.getItem('mac-repair-app-lastBackupDate'));
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressMsg, setProgressMsg] = useState<string | null>(null);
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [activeSyncType, setActiveSyncType] = useState<'export' | 'import' | null>(null);
    const [pendingFile, setPendingFile] = useState<{ name: string; data: unknown } | null>(null);
    const [coverage, setCoverage] = useState<BackupCoverageSummary | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleQuickPushMissing = async () => {
        if (isProcessing || isSyncing) return;
        setIsProcessing(true);
        setProgressMsg('Envoi des fiches en attente vers le Cloud...');
        try {
            const report = await pushMissingLocalTicketsToCloud((m) => setProgressMsg(m));
            if (report.failed.length > 0) {
                showToast(`Envoi partiel : ${report.sent.length} envoyée(s), ${report.failed.length} en échec.`, 'error');
            } else if (report.sent.length > 0) {
                showToast(`${report.sent.length} fiche(s) envoyée(s) vers le Cloud !`, 'success');
            } else {
                showToast('Vérification Cloud terminée.', 'info');
            }
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Échec de l'envoi Cloud", 'error');
        } finally {
            setIsProcessing(false);
            setProgressMsg(null);
        }
    };

    useEffect(() => {
        getLocalBackupCoverage()
            .then(setCoverage)
            .catch(() => { /* non bloquant */ });
    }, []);

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

    const handleUniqueMasterBackup = async () => {
        setIsProcessing(true);
        try {
            const res = await backupUniqueMasterArchive();
            setCoverage(res.coverage);
            const now = new Date().toISOString();
            localStorage.setItem('mac-repair-app-lastBackupDate', now);
            setLastBackup(now);
            showToast(
                `Backup Unique créé (${res.coverage.coverageLabel} · ${res.coverage.totalTickets} fiches) !`,
                "success"
            );
        } catch {
            showToast("Erreur lors de la création du Backup Unique.", "error");
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

                setPendingFile({ name: file.name, data: raw });
            } catch {
                showToast("Fichier invalide ou corrompu.", "error");
            } finally {
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-[#111418] p-5 rounded-[24px] border border-white/5 shadow-2xl gap-4">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-green-500/10 border border-green-500/20 shrink-0">
                        <ShieldCheckIcon className="w-7 h-7 text-green-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded inline-block mb-1">
                            Protection de l&apos;atelier
                        </p>
                        <p className="text-sm font-bold text-white tracking-tight">
                            Dernière archive : {formatDisplayDate(lastBackup)}
                        </p>
                        {coverage && (
                            <p className="text-[11px] font-semibold text-emerald-400 mt-0.5">
                                Couverture actuelle : {coverage.coverageLabel} ({coverage.totalTickets} fiches)
                            </p>
                        )}
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
                        onClick={handleUniqueMasterBackup}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-5 py-3.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-emerald-500/30 transition-all active:scale-95 disabled:opacity-50"
                        title="Créer un Backup Unique complet avec plage du plus ancien dossier jusqu'à aujourd'hui"
                    >
                        <ArchiveBoxIcon className="w-4 h-4 text-emerald-400" />
                        <span>Backup Unique (Complet)</span>
                    </button>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-5 py-3.5 bg-[#4c1d95]/20 hover:bg-[#4c1d95]/30 border border-purple-500/20 text-purple-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                        title="Ouvrir un fichier .json et choisir la période (2, 3, 4, 5 mois ou tout) ou rechercher un ancien dossier"
                    >
                        <ArrowUpTrayIcon className="w-4 h-4 text-purple-400" />
                        <span>Restaurer / Période (.json)</span>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportFile} />
                </div>
            </div>

            {/* ALERTE HONNÊTE FICHES NON ENVOYÉES OU PROVISOIRES */}
            {(hasUnsentItems || hasHardError) && (
                <div className={`rounded-[20px] p-4 border space-y-2.5 ${
                    hasHardError
                        ? 'bg-red-950/25 border-red-500/35 text-red-200'
                        : 'bg-orange-950/25 border-orange-500/35 text-orange-200'
                }`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <ExclamationTriangleIcon className={`w-5 h-5 shrink-0 ${hasHardError ? 'text-red-400' : 'text-orange-400'}`} />
                            <div>
                                <p className={`text-xs font-black uppercase tracking-wider ${hasHardError ? 'text-red-300' : 'text-orange-300'}`}>
                                    {hasUnsentItems
                                        ? `${effectiveUnsentCount} fiche(s) non envoyée(s)`
                                        : isQuotaExceeded
                                        ? 'Quota Cloud atteint'
                                        : 'Synchronisation Cloud incomplète'}
                                </p>
                                <p className="text-[11px] text-zinc-300">
                                    {lastError || 'Des fiches locales ou provisoires ne sont pas encore confirmées dans le Cloud.'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleQuickPushMissing}
                            disabled={isProcessing || isSyncing}
                            className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-black font-black text-[10px] uppercase tracking-wider transition-all"
                        >
                            Envoyer les fiches en attente
                        </button>
                    </div>
                    {unsyncedTickets.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/10">
                            {unsyncedTickets.slice(0, 12).map((t) => (
                                <span
                                    key={t.id}
                                    className="text-[10px] font-mono bg-black/40 border border-orange-500/25 text-orange-200 px-2 py-0.5 rounded-lg"
                                >
                                    <strong>{t.id}</strong> · {t.clientName} · {t.macModel}
                                    {t.isProvisional ? ' (Provisoire)' : ''}
                                </span>
                            ))}
                            {unsyncedTickets.length > 12 && (
                                <span className="text-[10px] text-orange-300 font-bold px-2 py-0.5">
                                    +{unsyncedTickets.length - 12} autre(s)
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

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

            <BackupPeriodRestoreModal
                isOpen={!!pendingFile}
                fileName={pendingFile?.name || ''}
                rawBackupData={pendingFile?.data || null}
                onClose={() => setPendingFile(null)}
                onCompleted={() => {
                    setPendingFile(null);
                    window.location.reload();
                }}
            />
        </div>
    );
};

export default BackupStatus;
