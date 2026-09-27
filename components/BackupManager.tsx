
import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { backupData, restoreFullDatabase, mergeDatabaseFromFile, getDatabaseSummary, validateBackupSchema } from '../services/backupService.ts';
import { dbGetStorageEstimate, dbRequestPersistentStorage } from '../services/dbService.ts';
import { 
    ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowPathIcon, 
    ShieldCheckIcon, XCircleIcon as XIcon,
    ExclamationTriangleIcon, CheckCircleIcon
} from './icons.tsx';
import { useToastContext } from '../context/ToastContext.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';

const BackupManager: React.FC = () => {
    const { showToast } = useToastContext();
    const [actionProgress, setActionProgress] = useState({ loading: false, message: '' });
    const [restorePreview, setRestorePreview] = useState<{ fileName: string; version: string; count: number; data: Record<string, unknown> } | null>(null);
    const [importMode, setImportMode] = useState<'merge' | 'overwrite' | null>(null);
    const [localStats, setLocalStats] = useState<{ tickets: number; stock: number; finance: number; documents: number }>({ tickets: 0, stock: 0, finance: 0, documents: 0 });
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

              const isV4 = !!raw.identite_export;
              const tickets = isV4 ? raw.registre_technique?.fiches_reparation : raw.tickets;
              
              setRestorePreview({
                  fileName: file.name,
                  version: isV4 ? "V4 Pro (Hautement organisé)" : "Legacy",
                  count: (tickets as unknown[])?.length || 0,
                  data: raw as Record<string, unknown>
              });
          } catch {
              showToast("Format incompatible.", "error");
          } finally {
              setActionProgress({ loading: false, message: '' });
          }
      };
      reader.readAsText(file);
    };

    const handleImport = async (mode: 'merge' | 'overwrite') => {
        setImportMode(mode);
    };

    const confirmImport = async () => {
        if (!restorePreview || !importMode) return;
        const mode = importMode;
        setImportMode(null);

        setActionProgress({ loading: true, message: mode === 'merge' ? 'Fusion Delta...' : 'Écriture complète...' });
        try {
            const operation = mode === 'merge' ? mergeDatabaseFromFile : restoreFullDatabase;
            await operation(restorePreview.data, (m) => setActionProgress({ loading: true, message: m }));
            showToast("Opération terminée.", "success");
            window.location.reload();
        } catch {
            showToast("Échec de l'import.", "error");
        } finally {
            setActionProgress({ loading: false, message: '' });
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-end gap-6 bg-white/[0.02] p-8 rounded-[40px] border border-white/5 shadow-2xl">
                <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                            <ShieldCheckIcon className="w-8 h-8 text-white"/>
                        </div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic">Centre de Sauvegarde</h2>
                    </div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Standard TGS-CI : Export Interopérable & Fusion Intelligente</p>
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
                            {storageInfo?.isPersistent ? <CheckCircleIcon className="w-6 h-6 text-white"/> : <ExclamationTriangleIcon className="w-6 h-6 text-white"/>}
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
                    L'application peut stocker plus de 100 Go de données (fiches, photos, documents) directement dans votre navigateur. 
                    L'activation de la persistance empêche le système de supprimer vos données en cas de manque d'espace disque.
                </p>
            </div>

            {!restorePreview ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="group bg-white/[0.03] p-10 rounded-[48px] border border-white/5 hover:border-blue-500/30 transition-all">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8">
                            <ArrowDownTrayIcon className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase mb-3">Exporter l'Atelier</h3>
                        <p className="text-sm text-slate-400 mb-8 leading-relaxed">Fichier JSON structuré (V4) classable par date. Contient fiches, stock, services et historique.</p>
                        <button onClick={() => backupData('FULL')} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase text-xs tracking-widest transition-all">
                            Générer Archive .JSON
                        </button>
                    </div>

                    <div className="group bg-white/[0.03] p-10 rounded-[48px] border border-white/5 hover:border-emerald-500/30 transition-all">
                        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-8">
                            <ArrowUpTrayIcon className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase mb-3">Importer / Fusionner</h3>
                        <p className="text-sm text-slate-400 mb-8 leading-relaxed">Chargez un fichier pour enrichir votre base actuelle ou restaurer un poste complet.</p>
                        <button onClick={() => restoreInputRef.current?.click()} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black uppercase text-xs tracking-widest transition-all">
                            Sélectionner un fichier
                        </button>
                        <input type="file" ref={restoreInputRef} className="hidden" accept=".json" onChange={handleFileSelect} />
                    </div>
                </div>
            ) : (
                <div className="bg-slate-900 rounded-[48px] border-2 border-blue-500/50 p-10 animate-slide-up shadow-3xl">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Audit avant Import</h3>
                            <p className="text-blue-400 font-mono text-sm">{restorePreview.fileName}</p>
                        </div>
                        <button onClick={() => setRestorePreview(null)} className="p-3 hover:bg-white/10 rounded-full"><XIcon className="w-8 h-8 text-slate-500" /></button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                        <div className="bg-black/40 p-6 rounded-3xl border border-white/5">
                            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Version Archive</p>
                            <p className="text-lg font-black text-white">{restorePreview.version}</p>
                        </div>
                        <div className="bg-black/40 p-6 rounded-3xl border border-white/5">
                            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Contenu Détecté</p>
                            <p className="text-lg font-black text-white">{restorePreview.count} Fiches de réparation</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6">
                        <button onClick={() => handleImport('merge')} className="flex-1 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase tracking-widest text-sm transition-all shadow-2xl flex flex-col items-center gap-1">
                            <span>Fusion Complémentaire</span>
                            <span className="text-[9px] opacity-60 font-bold">(Sûr : n'efface rien)</span>
                        </button>
                        <button onClick={() => handleImport('overwrite')} className="flex-1 py-6 bg-white/5 hover:bg-red-600/20 text-slate-400 hover:text-red-400 rounded-3xl font-black uppercase tracking-widest text-sm border border-white/10 transition-all flex flex-col items-center gap-1">
                            <span>Remplacer tout</span>
                            <span className="text-[9px] opacity-60 font-bold">(Attention : écrase la base actuelle)</span>
                        </button>
                    </div>
                </div>
            )}

            {actionProgress.loading && (
                <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-10 text-center backdrop-blur-xl">
                    <div className="space-y-6">
                        <ArrowPathIcon className="w-16 h-16 text-blue-500 animate-spin mx-auto" />
                        <p className="text-2xl font-black text-white uppercase tracking-tighter animate-pulse">{actionProgress.message}</p>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={importMode !== null}
                onClose={() => setImportMode(null)}
                onConfirm={confirmImport}
                title={importMode === 'merge' ? "Fusionner les bases ?" : "Restaurer l'archive ?"}
                message={importMode === 'merge' 
                    ? "FUSION : Vos données actuelles seront conservées. Les éléments manquants seront ajoutés. Confirmer ?" 
                    : "ATTENTION : RESTAURATION TOTALE. TOUTE la base locale sera remplacée par le contenu de ce fichier. Confirmer ?"}
                confirmText={importMode === 'merge' ? "Fusionner" : "Tout Remplacer"}
                confirmBtnClassName={importMode === 'merge' ? "bg-blue-600" : "bg-red-600"}
            />
        </div>
    );
};

export default BackupManager;
