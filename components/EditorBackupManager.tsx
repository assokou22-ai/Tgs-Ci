import React, { useState, useRef, ChangeEvent } from 'react';
import { backupEditorData, restoreEditorDatabase, mergeEditorDatabaseFromFile } from '../services/backupService.ts';
import { BackupData } from '../types.ts';
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from './icons.tsx';

const EditorBackupManager: React.FC = () => {
    const [actionProgress, setActionProgress] = useState({ loading: false, message: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadBackup = async () => {
        const defaultFileName = `backup_editeur_${new Date().toISOString().split('T')[0]}.json`;
        const fileName = window.prompt("Nom du fichier de sauvegarde :", defaultFileName);
        if (fileName) {
            await backupEditorData(fileName);
        }
    };

    const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm(`Êtes-vous sûr de vouloir restaurer les données depuis "${file.name}" ?`)) {
            if (event.target) event.target.value = '';
            return;
        }

        const mode = window.confirm("Voulez-vous FUSIONNER les données (recommandé) ?\n\nOK = Fusionner (Met à jour les fiches et le stock sans rien écraser brutalement)\nAnnuler = Écraser (Efface toutes les Fiches, Stock et Services actuels avant restauration)") 
            ? 'merge' 
            : 'overwrite';

        if (mode === 'overwrite' && !window.confirm("ATTENTION : Vous avez choisi d'ÉCRASER les données. Toutes les Fiches Clients, le Stock et les Services actuels seront perdus. Continuer ?")) {
            if (event.target) event.target.value = '';
            return;
        }

        setActionProgress({ loading: true, message: 'Lecture et analyse du fichier...' });

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("Fichier invalide.");
                
                const parsedJson = JSON.parse(text);
                
                // Basic validation
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
                
                alert("Opération terminée avec succès ! La page va se recharger.");
                window.location.reload();

            } catch (error) {
                console.error("Restore failed:", error);
                const msg = error instanceof Error ? error.message : "Erreur inconnue";
                alert(`Échec de la restauration : ${msg}`);
            } finally {
                setActionProgress({ loading: false, message: '' });
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
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
                        onClick={handleDownloadBackup}
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
        </div>
    );
};

export default EditorBackupManager;