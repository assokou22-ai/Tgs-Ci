import React, { useState, useRef, ChangeEvent } from 'react';
import { backupEditorData, restoreEditorDatabase, mergeEditorDatabaseFromFile } from '../services/backupService.ts';
import { BackupData } from '../types.ts';
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from './icons.tsx';
import { useToastContext } from '../context/ToastContext.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import Modal from './Modal.tsx';
import { getBackupAppIdentifier } from '../utils/backupIdentifier.ts';

const EditorBackupManager: React.FC = () => {
    const { showToast } = useToastContext();
    const [actionProgress, setActionProgress] = useState({ loading: false, message: '' });
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [backupFileName, setBackupFileName] = useState('');
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [importStep, setImportStep] = useState<'confirm-file' | 'select-mode' | 'confirm-overwrite' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadRequest = () => {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
        const appTag = getBackupAppIdentifier();
        setBackupFileName(`${appTag}_backup_editeur_${dateStr} - ( ${timeStr} ).json`);
        setIsDownloadModalOpen(true);
    };

    const executeDownload = async () => {
        if (backupFileName.trim()) {
            await backupEditorData(backupFileName);
            setIsDownloadModalOpen(false);
        }
    };

    const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setImportStep('confirm-file');
    };

    const startImportFlow = () => {
        setImportStep('select-mode');
    };

    const handleModeSelection = (mode: 'merge' | 'overwrite') => {
        if (mode === 'overwrite') {
            setImportStep('confirm-overwrite');
        } else {
            executeImport('merge');
        }
    };

    const executeImport = async (mode: 'merge' | 'overwrite') => {
        if (!pendingFile) return;
        setImportStep(null);
        setActionProgress({ loading: true, message: 'Lecture et analyse du fichier...' });

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("Fichier invalide.");
                
                const parsedJson = JSON.parse(text);
                
                if (!parsedJson.tickets && !parsedJson.stock && !parsedJson.services) {
                    throw new Error("Ce fichier ne semble pas contenir de données Éditeur valides (Fiches/Stock/Services).");
                }

                const data: Partial<BackupData> = {
                    tickets: Array.isArray(parsedJson.tickets) ? parsedJson.tickets : [],
                    stock: Array.isArray(parsedJson.stock) ? parsedJson.stock : [],
                    services: Array.isArray(parsedJson.services) ? parsedJson.services : [],
                    suggestions: Array.isArray(parsedJson.suggestions) ? parsedJson.suggestions : [],
                };

                const operation = mode === 'merge' ? mergeEditorDatabaseFromFile : restoreEditorDatabase;
                
                await operation(data, (msg) => setActionProgress({ loading: true, message: msg }));
                
                showToast("Opération terminée avec succès !", "success");
                window.location.reload();

            } catch (error) {
                console.error("Restore failed:", error);
                const msg = error instanceof Error ? error.message : "Erreur inconnue";
                showToast(`Échec de la restauration : ${msg}`, "error");
            } finally {
                setActionProgress({ loading: false, message: '' });
                setPendingFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(pendingFile);
    };

    return (
        <div className="w-full max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-white">Sauvegarde & Restauration (Éditeur & Clients)</h2>
            <p className="text-gray-400 mb-8">
                Gérez les données opérationnelles critiques : <strong>Fiches Clients</strong>, <strong>Stock</strong>, <strong>Services</strong> et <strong>Suggestions</strong>.
                <br/>
                Cette sauvegarde assure la conservation de chaque détail des fiches (diagnostics, historique, notes, coûts) et de la configuration de l'atelier.
                <br/>
                <span className="text-xs text-gray-500 italic">Note : Les données financières (Factures/Commandes) ne sont pas incluses ici.</span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Backup Section */}
                <div className="bg-gray-700 p-6 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-3 mb-4 text-green-400">
                        <ArrowDownTrayIcon className="w-8 h-8" />
                        <h3 className="text-xl font-bold">Sauvegarder</h3>
                    </div>
                    <p className="text-sm text-gray-300 mb-6">
                        Téléchargez un fichier JSON contenant toutes vos fiches clients, le stock et les services.
                    </p>
                    <button
                        onClick={handleDownloadRequest}
                        className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2"
                    >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                        Télécharger la sauvegarde
                    </button>
                </div>

                {/* Restore Section */}
                <div className="bg-gray-700 p-6 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-3 mb-4 text-blue-400">
                        <ArrowUpTrayIcon className="w-8 h-8" />
                        <h3 className="text-xl font-bold">Restaurer</h3>
                    </div>
                    <p className="text-sm text-gray-300 mb-6">
                        Importez un fichier JSON pour restaurer ou fusionner vos données Éditeur et Clients.
                    </p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={actionProgress.loading}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                    >
                        <ArrowUpTrayIcon className="w-5 h-5" />
                        {actionProgress.loading ? 'Traitement...' : 'Importer un fichier'}
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleFileSelect} 
                    />
                </div>
            </div>

            {actionProgress.message && (
                <div className="mt-6 p-4 bg-gray-900 rounded-md text-center text-blue-300 animate-pulse">
                    {actionProgress.message}
                </div>
            )}

            {/* DOWNLOAD FILENAME MODAL */}
            <Modal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)}>
                <div className="p-6 text-white">
                    <h3 className="text-xl font-bold mb-4">Nom du fichier de sauvegarde</h3>
                    <input 
                        type="text" 
                        value={backupFileName} 
                        onChange={(e) => setBackupFileName(e.target.value)}
                        className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none focus:ring-2 focus:ring-green-500 mb-6"
                    />
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setIsDownloadModalOpen(false)} className="px-4 py-2 bg-gray-600 rounded">Annuler</button>
                        <button onClick={executeDownload} className="px-6 py-2 bg-green-600 rounded font-bold">Télécharger</button>
                    </div>
                </div>
            </Modal>

            {/* STEP 1: CONFIRM FILE IMPORT */}
            <ConfirmationModal
                isOpen={importStep === 'confirm-file'}
                onClose={() => { setImportStep(null); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                onConfirm={startImportFlow}
                title="Restaurer ce fichier ?"
                message={`Êtes-vous sûr de vouloir restaurer les données depuis "${pendingFile?.name}" ?`}
                confirmText="Continuer"
            />

            {/* STEP 2: SELECT MODE */}
            <Modal isOpen={importStep === 'select-mode'} onClose={() => { setImportStep(null); setPendingFile(null); }}>
                <div className="p-8 text-white text-center">
                    <h3 className="text-xl font-bold mb-4">Méthode de restauration</h3>
                    <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                        <strong>FUSIONNER (Recommandé) :</strong> Ajoute les nouvelles données à votre base actuelle. Utile pour synchroniser plusieurs postes.
                        <br/><br/>
                        <strong>TOUT ÉCRASER :</strong> Efface toute votre base actuelle (Fiches, Stock, Services) avant d'importer le fichier.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => handleModeSelection('merge')} className="w-full py-4 bg-blue-600 rounded-xl font-bold shadow-lg">FUSIONNER LES DONNÉES</button>
                        <button onClick={() => handleModeSelection('overwrite')} className="w-full py-4 bg-red-600/20 text-red-400 border border-red-600/30 rounded-xl font-bold">ÉCRASER TOUT (DANGEREUX)</button>
                        <button onClick={() => { setImportStep(null); setPendingFile(null); }} className="text-sm text-gray-500 mt-2">Annuler l'importation</button>
                    </div>
                </div>
            </Modal>

            {/* STEP 3: FINAL OVERWRITE WARNING */}
            <ConfirmationModal
                isOpen={importStep === 'confirm-overwrite'}
                onClose={() => setImportStep('select-mode')}
                onConfirm={() => executeImport('overwrite')}
                title="ALERTE CRITIQUE"
                message="ATTENTION : Vous avez choisi d'ÉCRASER les données. Toutes les Fiches Clients, le Stock et les Services actuels seront PERDUS. Êtes-vous certain ?"
                confirmText="Oui, Effacer et Remplacer"
                confirmBtnClassName="bg-red-600"
            />
        </div>
    );
};

export default EditorBackupManager;