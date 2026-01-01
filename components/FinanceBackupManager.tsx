
import React, { useState, useRef, ChangeEvent } from 'react';
import { backupFinanceData, restoreFinanceDatabase, mergeFinanceDatabaseFromFile } from '../services/backupService.ts';
import { BackupData } from '../types.ts';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ExclamationTriangleIcon, BanknotesIcon, ShoppingCartIcon, DocumentDuplicateIcon } from './icons.tsx';

type FinanceAnalysis = {
    facturesCount: number;
    commandesCount: number;
    proformasCount: number;
    data: Partial<BackupData>;
    fileName: string;
};

const FinanceBackupManager: React.FC = () => {
    const [actionProgress, setActionProgress] = useState({ loading: false, message: '' });
    const [analysis, setAnalysis] = useState<FinanceAnalysis | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadBackup = async () => {
        const dateStr = new Date().toISOString().split('T')[0];
        await backupFinanceData(`RM_Finance_${dateStr}.json`);
    };

    const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setActionProgress({ loading: true, message: 'Analyse du fichier...' });

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("Format de fichier invalide.");
                
                const parsedJson = JSON.parse(text);
                
                // Extraction et validation basique
                const data: Partial<BackupData> = {
                    factures: Array.isArray(parsedJson.factures) ? parsedJson.factures : [],
                    proformas: Array.isArray(parsedJson.proformas) ? parsedJson.proformas : [],
                    commandes: Array.isArray(parsedJson.commandes) ? parsedJson.commandes : [],
                };

                if (data.factures?.length === 0 && data.commandes?.length === 0 && data.proformas?.length === 0) {
                    throw new Error("Ce fichier ne contient aucune donnée financière exploitable.");
                }

                setAnalysis({
                    facturesCount: data.factures?.length || 0,
                    commandesCount: data.commandes?.length || 0,
                    proformasCount: data.proformas?.length || 0,
                    data,
                    fileName: file.name
                });
                
                setActionProgress({ loading: false, message: '' });
            } catch (error) {
                console.error("Analysis failed:", error);
                alert(`Erreur d'analyse : ${error instanceof Error ? error.message : "Fichier corrompu"}`);
                setActionProgress({ loading: false, message: '' });
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const executeImport = async (mode: 'merge' | 'overwrite') => {
        if (!analysis) return;

        const confirmMsg = mode === 'merge' 
            ? "FUSION : Les données existantes seront conservées. Les doublons seront mis à jour avec les versions les plus récentes. Continuer ?"
            : "ÉCRASEMENT : TOUTES vos factures, commandes et proformas actuelles seront supprimées et remplacées par le contenu du fichier. Continuer ?";

        if (!window.confirm(confirmMsg)) return;

        setActionProgress({ loading: true, message: mode === 'merge' ? 'Fusion des données...' : 'Restauration complète...' });

        try {
            const operation = mode === 'merge' ? mergeFinanceDatabaseFromFile : restoreFinanceDatabase;
            await operation(analysis.data, (msg) => setActionProgress({ loading: true, message: msg }));
            
            alert("Données financières restaurées avec succès !");
            window.location.reload();
        } catch (error) {
            console.error("Restore operation failed:", error);
            alert(`Échec de l'importation : ${error instanceof Error ? error.message : "Erreur inconnue"}`);
            setActionProgress({ loading: false, message: '' });
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto animate-fade-in">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Gestion de la Base Financière</h2>
                <p className="text-gray-400 mt-1">Exportation et importation sécurisée des factures, proformas et commandes.</p>
            </div>

            {!analysis ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Export Section */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl group hover:border-green-500/50 transition-colors">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-green-500/10 rounded-lg text-green-400 group-hover:bg-green-500/20 transition-colors">
                                <ArrowDownTrayIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Sauvegarder</h3>
                                <p className="text-sm text-gray-400">Générer un fichier finance.json</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                            Crée une copie de sécurité de l'intégralité de vos documents comptables. Recommandé avant toute modification majeure.
                        </p>
                        <button
                            onClick={handleDownloadBackup}
                            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                        >
                            <ArrowDownTrayIcon className="w-5 h-5" />
                            Télécharger la sauvegarde
                        </button>
                    </div>

                    {/* Import Section */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl group hover:border-blue-500/50 transition-colors">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                <ArrowUpTrayIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Restaurer</h3>
                                <p className="text-sm text-gray-400">Importer depuis un fichier</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                            Permet de récupérer vos documents sur un nouvel appareil ou de fusionner des données provenant d'un autre poste.
                        </p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={actionProgress.loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-50"
                        >
                            <ArrowUpTrayIcon className="w-5 h-5" />
                            {actionProgress.loading ? 'Analyse...' : 'Sélectionner un fichier'}
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
            ) : (
                <div className="bg-gray-800 rounded-xl border-2 border-blue-500/30 overflow-hidden shadow-2xl animate-scale-up">
                    <div className="p-6 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-white">Analyse du fichier : <span className="text-blue-400">{analysis.fileName}</span></h3>
                            <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-semibold">Contenu détecté prêt pour l'importation</p>
                        </div>
                        <button onClick={() => setAnalysis(null)} className="text-sm text-gray-500 hover:text-white transition-colors">Annuler</button>
                    </div>
                    
                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 flex items-center gap-4">
                                <div className="p-2 bg-green-500/20 text-green-400 rounded-md">
                                    <BanknotesIcon className="w-6 h-6"/>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{analysis.facturesCount}</p>
                                    <p className="text-xs text-gray-400 uppercase">Factures</p>
                                </div>
                            </div>
                            <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 flex items-center gap-4">
                                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-md">
                                    <ShoppingCartIcon className="w-6 h-6"/>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{analysis.commandesCount}</p>
                                    <p className="text-xs text-gray-400 uppercase">Commandes</p>
                                </div>
                            </div>
                            <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 flex items-center gap-4">
                                <div className="p-2 bg-yellow-500/20 text-yellow-400 rounded-md">
                                    <DocumentDuplicateIcon className="w-6 h-6"/>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{analysis.proformasCount}</p>
                                    <p className="text-xs text-gray-400 uppercase">Proformas</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg flex items-start gap-4 mb-8">
                            <ExclamationTriangleIcon className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-200">
                                <p className="font-bold mb-1">Méthode d'importation</p>
                                <p>Choisissez la <strong>fusion</strong> pour ajouter les nouvelles données à votre base actuelle sans rien perdre.</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={() => executeImport('merge')} 
                                className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all flex flex-col items-center justify-center shadow-lg"
                            >
                                <span>FUSIONNER LES DONNÉES</span>
                                <span className="text-[10px] font-normal opacity-70">Ajouter/Mettre à jour intelligemment</span>
                            </button>
                            <button 
                                onClick={() => executeImport('overwrite')} 
                                className="flex-1 py-4 bg-red-700/50 hover:bg-red-600 text-red-100 font-bold rounded-lg border border-red-700/50 transition-all flex flex-col items-center justify-center"
                            >
                                <span>REMPLACER TOUT</span>
                                <span className="text-[10px] font-normal opacity-70">Supprimer l'actuel et remplacer</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {actionProgress.message && (
                <div className="mt-8 p-4 bg-gray-900/80 border border-gray-700 rounded-lg flex items-center justify-center gap-3 animate-pulse">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-blue-400 text-sm font-medium">{actionProgress.message}</span>
                </div>
            )}
        </div>
    );
};

export default FinanceBackupManager;
