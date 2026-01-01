
import React, { useState, useEffect, useRef } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowPathIcon } from './icons.tsx';
import { backupData, restoreFullDatabase } from '../services/backupService.ts';
import { BackupData } from '../types.ts';

const formatDisplayDate = (isoString: string | null): string => {
    if (!isoString) return 'jamais';
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
    const [lastBackup, setLastBackup] = useState<string | null>(localStorage.getItem('mac-repair-app-lastBackupDate'));
    const [lastRestore, setLastRestore] = useState<string | null>(localStorage.getItem('mac-repair-app-lastRestoreDate'));
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleBackupCompleted = (event: Event) => {
            const customEvent = event as CustomEvent<string>;
            setLastBackup(customEvent.detail);
        };
        window.addEventListener('backupCompleted', handleBackupCompleted);
        return () => window.removeEventListener('backupCompleted', handleBackupCompleted);
    }, []);

    const handleQuickBackup = async () => {
        setIsProcessing(true);
        try {
            const now = new Date().toISOString();
            const dateStr = now.split('T')[0];
            await backupData(`TGS_SAVE_${dateStr}.json`);
            localStorage.setItem('mac-repair-app-lastBackupDate', now);
            setLastBackup(now);
        } catch (error) {
            alert("Erreur lors de la génération de la sauvegarde.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm("ALERTE : Restaurer ce fichier remplacera TOUTES les données actuelles de l'atelier par celles du fichier. Voulez-vous continuer ?")) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text) as BackupData;
                
                // Basic validation of the backup file
                if (!data.tickets && !data.stock) {
                    throw new Error("Format de fichier invalide");
                }

                await restoreFullDatabase(data);
                const now = new Date().toISOString();
                localStorage.setItem('mac-repair-app-lastRestoreDate', now);
                alert("Restauration système terminée avec succès !");
                window.location.reload();
            } catch (err) {
                console.error("Restore error:", err);
                alert("Échec de la restauration : Le fichier de sauvegarde est corrompu ou invalide.");
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-2">
            <div className="flex items-center gap-6">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
                        <div className={`w-2 h-2 rounded-full ${lastBackup ? 'bg-green-500' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'} animate-pulse`}></div>
                        <span>Dernière Sauvegarde : <span className="text-white ml-1">{formatDisplayDate(lastBackup)}</span></span>
                    </div>
                    {lastRestore && (
                        <div className="hidden md:flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            <span>Dernière Restauration : <span className="text-gray-400 ml-1">{formatDisplayDate(lastRestore)}</span></span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileRestore} />
                
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all border border-gray-600 shadow-lg active:scale-95 disabled:opacity-50"
                    title="Restaurer une sauvegarde locale (.json)"
                >
                    <ArrowUpTrayIcon className="w-4 h-4" /> Restaurer
                </button>

                <button 
                    onClick={handleQuickBackup}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase shadow-xl shadow-blue-900/40 transition-all transform active:scale-95 disabled:opacity-50"
                    title="Télécharger une sauvegarde complète de l'atelier maintenant"
                >
                    {isProcessing ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                        <ArrowDownTrayIcon className="w-4 h-4" />
                    )}
                    Sauvegarder l'atelier
                </button>
            </div>
        </div>
    );
};

export default BackupStatus;
