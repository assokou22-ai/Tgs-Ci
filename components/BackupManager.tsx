
import React, { useState, useRef, ChangeEvent } from 'react';
import { BackupData } from '../types.ts';
import { backupData, restoreFullDatabase, mergeDatabaseFromFile, compileFullBackupData } from '../services/backupService.ts';
import { saveDataToServer } from '../services/serverService.ts';
import { 
    ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowPathIcon, 
    ExclamationTriangleIcon, BanknotesIcon, WrenchScrewdriverIcon, 
    UserGroupIcon, DocumentDuplicateIcon, ShieldCheckIcon 
} from './icons.tsx';

type RestoreAnalysis = {
    summary: {
        tickets: number;
        stock: number;
        finance: number;
        documents: number;
    };
    data: BackupData;
};

const BackupManager: React.FC = () => {
    const [actionProgress, setActionProgress] = useState({ loading: false, message: '' });
    const [restorePreview, setRestorePreview] = useState<RestoreAnalysis | null>(null);
    const restoreInputRef = useRef<HTMLInputElement>(null);

    const handleForceServerBackup = async () => {
        setActionProgress({ loading: true, message: 'Initialisation de la liaison Cloud Google...' });
        try {
            const storeId = sessionStorage.getItem('mac-repair-app-storeId');
            if (!storeId) throw new Error("ID du magasin manquant.");
            
            setActionProgress({ loading: true, message: 'Compilation universelle des données...' });
            const fullData = await compileFullBackupData();
            
            setActionProgress({ loading: true, message: 'Transfert sécurisé vers le serveur Cloud...' });
            await saveDataToServer(storeId, fullData);
            
            const now = new Date().toISOString();
            localStorage.setItem('mac-repair-app-lastBackupDate', now);
            window.dispatchEvent(new CustomEvent('backupCompleted', { detail: now }));
            
            setActionProgress({ loading: false, message: '✅ Synchronisation Cloud réussie !' });
        } catch (error) {
             setActionProgress({ loading: false, message: `❌ Erreur Cloud: ${error instanceof Error ? error.message : 'Inconnue'}` });
        } finally {
            setTimeout(() => setActionProgress({ loading: false, message: '' }), 4000);
        }
    };

    const handleDownloadFullBackup = async () => {
        const dateStr = new Date().toISOString().split('T')[0];
        await backupData(`TGS_Local_Save_${dateStr}.json`);
    };

    const handleRestoreFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setActionProgress({ loading: true, message: 'Analyse de l\'archive locale...' });

      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const text = e.target?.result;
              if (typeof text !== 'string') throw new Error("Fichier illisible.");
              
              const data = JSON.parse(text) as BackupData;
              
              setRestorePreview({
                  summary: {
                      tickets: (data.tickets || []).length,
                      stock: (data.stock || []).length,
                      finance: (data.factures || []).length + (data.commandes || []).length + (data.proformas || []).length,
                      documents: (data.simpleDocuments || []).length + (data.storedDocuments || []).length,
                  },
                  data
              });
              setActionProgress({ loading: false, message: '' });
          } catch (error) {
              alert("Format de sauvegarde invalide.");
              setActionProgress({ loading: false, message: '' });
          }
      };
      reader.readAsText(file);
    };

    const executeRestore = async (mode: 'merge' | 'overwrite') => {
        if (!restorePreview) return;
        
        const confirmMsg = mode === 'merge' 
            ? "FUSION : Vos données actuelles seront conservées et complétées. Continuer ?"
            : "ATTENTION : TOUTES vos données actuelles seront supprimées et remplacées. Cette action est irréversible. Continuer ?";

        if (!window.confirm(confirmMsg)) return;

        setActionProgress({ loading: true, message: 'Démarrage de la restauration...' });
        const operation = mode === 'merge' ? mergeDatabaseFromFile : restoreFullDatabase;

        try {
            await operation(restorePreview.data, (msg) => setActionProgress({ loading: true, message: msg }));
            alert("Restauration système terminée.");
            window.location.reload();
        } catch (error) {
            setActionProgress({ loading: false, message: "Échec critique de la restauration." });
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20">
            {/* Header Pro */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        <ShieldCheckIcon className="w-10 h-10 text-blue-500"/>
                        Console de Synchronisation
                    </h2>
                    <p className="text-slate-400 font-medium">Sécurisez votre activité : Cloud Google & Archives Locales.</p>
                </div>
                {actionProgress.message && (
                    <div className="px-4 py-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase rounded-xl animate-pulse">
                        {actionProgress.message}
                    </div>
                )}
            </div>

            {!restorePreview ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Colonne Cloud (Mise en avant) */}
                    <div className="lg:col-span-7">
                        <div className="glass p-8 rounded-3xl border-t-4 border-blue-600 shadow-2xl space-y-6 bg-gradient-to-br from-blue-600/5 to-transparent">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/40">
                                    <ArrowPathIcon className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase">Cloud Google TGS-CI</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Synchronisation Serveur Temps Réel</p>
                                </div>
                            </div>
                            
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Le système synchronise automatiquement vos modifications. Utilisez ce bouton pour <strong>forcer une mise à jour complète</strong> vers votre serveur distant. Cela garantit que tous les postes de l'atelier disposent de la même version.
                            </p>

                            <button 
                                onClick={handleForceServerBackup} 
                                disabled={actionProgress.loading}
                                className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-900/30 transition-all transform active:scale-95 flex items-center justify-center gap-3"
                            >
                                <ArrowPathIcon className={`w-5 h-5 ${actionProgress.loading ? 'animate-spin' : ''}`} />
                                {actionProgress.loading ? 'Synchronisation...' : 'Synchroniser tout vers le Cloud'}
                            </button>
                            
                            <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase mb-2">
                                    <ShieldCheckIcon className="w-3 h-3"/> État de protection
                                </div>
                                <p className="text-[11px] text-slate-500 italic">
                                    Les données sont chiffrées avant le transfert vers le serveur cloud Google. Les pièces jointes et rapports techniques sont inclus dans la sauvegarde globale.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Colonne Archives Locales */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="glass p-6 rounded-3xl border border-white/10 space-y-6">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <DocumentDuplicateIcon className="w-4 h-4" /> Archives Manuelles
                            </h3>
                            
                            <div className="space-y-4">
                                <button 
                                    onClick={handleDownloadFullBackup}
                                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all text-xs uppercase flex items-center justify-center gap-2 border border-white/5"
                                >
                                    <ArrowDownTrayIcon className="w-4 h-4" /> Sauvegarde locale (.json)
                                </button>

                                <button 
                                    onClick={() => restoreInputRef.current?.click()}
                                    className="w-full py-4 bg-transparent border-2 border-dashed border-slate-700 hover:border-blue-500/50 text-slate-500 hover:text-blue-400 rounded-xl font-bold transition-all text-xs uppercase flex items-center justify-center gap-2"
                                >
                                    <ArrowUpTrayIcon className="w-4 h-4" /> Restaurer un fichier
                                </button>
                                <input type="file" ref={restoreInputRef} className="hidden" accept=".json" onChange={handleRestoreFileSelect} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="glass p-8 rounded-3xl border-2 border-blue-500/50 shadow-2xl animate-scale-up">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-black text-blue-400 uppercase flex items-center gap-3">
                            <ExclamationTriangleIcon className="w-8 h-8"/> Analyse de l'Archive
                        </h3>
                        <button onClick={() => setRestorePreview(null)} className="px-4 py-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-black uppercase">Annuler</button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                        <div className="bg-slate-900 p-4 rounded-2xl text-center border border-white/5">
                            <UserGroupIcon className="w-6 h-6 mx-auto mb-2 text-blue-400"/>
                            <p className="text-2xl font-black text-white">{restorePreview.summary.tickets}</p>
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Fiches</p>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-2xl text-center border border-white/5">
                            <WrenchScrewdriverIcon className="w-6 h-6 mx-auto mb-2 text-yellow-400"/>
                            <p className="text-2xl font-black text-white">{restorePreview.summary.stock}</p>
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Stock</p>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-2xl text-center border border-white/5">
                            <BanknotesIcon className="w-6 h-6 mx-auto mb-2 text-green-400"/>
                            <p className="text-2xl font-black text-white">{restorePreview.summary.finance}</p>
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Finance</p>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-2xl text-center border border-white/5">
                            <DocumentDuplicateIcon className="w-6 h-6 mx-auto mb-2 text-purple-400"/>
                            <p className="text-2xl font-black text-white">{restorePreview.summary.documents}</p>
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Docs</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button 
                            onClick={() => executeRestore('merge')} 
                            className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all flex flex-col items-center justify-center"
                        >
                            <span>Fusionner</span>
                            <span className="text-[10px] font-medium opacity-60">Ajouter sans supprimer</span>
                        </button>
                        <button 
                            onClick={() => executeRestore('overwrite')} 
                            className="flex-1 py-5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/30 rounded-2xl font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center"
                        >
                            <span>Tout Écraser</span>
                            <span className="text-[10px] font-medium opacity-60">Remplacer la base actuelle</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BackupManager;
