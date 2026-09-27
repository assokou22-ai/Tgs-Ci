
import React, { useState } from 'react';
import { backupData, compileFullBackupData } from '../services/backupService.ts';
import { exportToPdf, exportToExcel, exportFullDataToExcel } from '../services/exportService.ts';
import { ArrowDownTrayIcon } from './icons.tsx';
import { useToastContext } from '../context/ToastContext.tsx';
import { RepairTicket, DiagnosticCheck, RepairServiceItem } from '../types.ts';

const ExportCard: React.FC<{
    title: string;
    description: string;
    buttonText: string;
    onExport: () => void;
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
    loading: boolean;
}> = ({ title, description, buttonText, onExport, Icon, loading }) => (
    <div className="bg-gray-700/50 p-6 rounded-lg flex flex-col">
        <div className="flex-grow">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Icon className="w-6 h-6" />
                {title}
            </h3>
            <p className="mt-2 text-sm text-gray-400">{description}</p>
        </div>
        <button
            onClick={onExport}
            disabled={loading}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-wait transition-colors"
        >
            <ArrowDownTrayIcon className="w-5 h-5" />
            {loading ? 'Exportation...' : buttonText}
        </button>
    </div>
);


const ExportManager: React.FC = () => {
    const { showToast } = useToastContext();
    const [isLoading, setIsLoading] = useState<null | 'json' | 'excelAll' | 'excelTickets' | 'pdfTickets'>(null);
    const [isLoadingLlm, setIsLoadingLlm] = useState(false);

    const handleExport = async (exportType: 'json' | 'excelAll' | 'excelTickets' | 'pdfTickets') => {
        setIsLoading(exportType);
        try {
            const fullData = await compileFullBackupData();

            switch (exportType) {
                case 'json':
                    // Fix: backupData expects a type 'FULL' | 'FINANCE' | 'TECH', the filename is generated internally
                    await backupData('FULL');
                    break;
                case 'excelAll':
                    exportFullDataToExcel(fullData);
                    break;
                case 'excelTickets':
                    exportToExcel(fullData.tickets, `export_fiches_${new Date().toISOString().split('T')[0]}.xlsx`);
                    break;
                case 'pdfTickets':
                    exportToPdf(fullData.tickets, `liste_fiches_${new Date().toISOString().split('T')[0]}.pdf`);
                    break;
            }
        } catch (err) {
            console.error(`Export failed for type ${exportType}:`, err);
            showToast("L'exportation a échoué.", "error");
        } finally {
            setIsLoading(null);
        }
    };
    
    const handleLlmExport = async () => {
        setIsLoadingLlm(true);
        try {
            const fullData = await compileFullBackupData();
            const tickets = fullData.tickets || [];
            
            const trainingData = (tickets as RepairTicket[]).map(ticket => {
                const clientReport = ticket.problemDescription || "Non spécifié";
                const model = `${ticket.macBrand || 'MacBook'} ${ticket.macModel || ''} ${ticket.modelNumber ? '(N° Model: ' + ticket.modelNumber + ')' : ''}`.trim();
                const state = ticket.powersOn ? "Démarre" : "Ne démarre pas";
                const powerStatus = ticket.powerOnStatus || "Non spécifié";
                
                const instruction = `Diagnostiquer la panne de cet ordinateur et proposer le devis d'intervention technique.`;
                const input = `Équipement : ${model}. Symptômes déclarés par le client : ${clientReport}. État d'alimentation : ${state} (${powerStatus}). Matériel fourni : ${ticket.chargerIncluded ? 'avec chargeur' : 'sans chargeur'}.`;
                
                const diagReport = ticket.diagnosticReport?.map((dr: DiagnosticCheck) => `- ${dr.component} : ${dr.status} (${dr.notes || ''})`).join('\n') || '';
                const techNotes = ticket.technicianNotes || '';
                const services = ticket.services?.map((s: RepairServiceItem) => `- ${s.name} : ${s.price.toLocaleString()} F CFA`).join('\n') || '';
                const totalCost = (ticket.costs?.diagnostic || 0) + (ticket.services?.reduce((sum: number, s: RepairServiceItem) => sum + s.price, 0) || 0);

                const output = `Rapport d'expertise technique :\n${diagReport || 'Aucun point détaillé enregistré.'}\n\nNotes de réparation :\n${techNotes || 'Diagnostic standard sans remarque.'}\n\nPrestations effectuées :\n${services || 'Aucune prestation chiffrée.'}\n\nMontant total calculé : ${totalCost.toLocaleString()} F CFA (Expertise fixe : ${(ticket.costs?.diagnostic || 0).toLocaleString()} F CFA). Statut final de la machine : ${ticket.status}.`;

                return {
                    instruction,
                    input,
                    output
                };
            });

            // Trigger file download
            const dataStr = JSON.stringify(trainingData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const fileName = `dataset_entraînement_llm_${new Date().toISOString().split('T')[0]}.json`;

            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', fileName);
            linkElement.click();
            showToast("Dataset d'entraînement local exporté !", "success");
        } catch (err) {
            console.error("LLM dataset export failed:", err);
            showToast("L'exportation pour LLM a échoué.", "error");
        } finally {
            setIsLoadingLlm(false);
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-2">Centre d'Exportation</h2>
            <p className="text-gray-400 mb-6">
                Téléchargez vos données dans différents formats pour la sauvegarde, l'analyse ou l'archivage.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <ExportCard 
                    title="Sauvegarde Complète (JSON)"
                    description="Exportez toutes les données de l'application (fiches, stock, services, etc.) dans un seul fichier JSON. Idéal pour les sauvegardes complètes et la restauration."
                    buttonText="Exporter en JSON"
                    onExport={() => handleExport('json')}
                    Icon={ArrowDownTrayIcon}
                    loading={isLoading === 'json'}
                />
                 <ExportCard 
                    title="Export Complet (Excel)"
                    description="Exportez toutes les données dans un fichier Excel multi-feuilles (.xlsx). Chaque type de donnée (fiches, stock...) aura sa propre feuille."
                    buttonText="Exporter en Excel"
                    onExport={() => handleExport('excelAll')}
                    Icon={ArrowDownTrayIcon}
                    loading={isLoading === 'excelAll'}
                />
                 <ExportCard 
                    title="Exporter les Fiches (Excel)"
                    description="Créez un fichier Excel (.xlsx) contenant uniquement la liste détaillée de toutes les fiches de réparation. Parfait pour une analyse externe."
                    buttonText="Exporter les Fiches (Excel)"
                    onExport={() => handleExport('excelTickets')}
                    Icon={ArrowDownTrayIcon}
                    loading={isLoading === 'excelTickets'}
                />
                 <ExportCard 
                    title="Archiver les Fiches (PDF)"
                    description="Générez un document PDF listant de manière concise toutes les fiches de réparation. Utile pour l'archivage ou une vue d'ensemble rapide."
                    buttonText="Exporter en PDF"
                    onExport={() => handleExport('pdfTickets')}
                    Icon={ArrowDownTrayIcon}
                    loading={isLoading === 'pdfTickets'}
                />
                 <ExportCard 
                    title="Dataset d'Entraînement LLM (Alpaca JSON)"
                    description="Générez un dataset d'instructions (Prompt-Réponse) structuré au format Alpaca à partir de vos fiches de dépôts et diagnostics. Permet d'entraîner ou d'affiner des modèles IA (Llama, Gemma...) en local."
                    buttonText="Exporter le Dataset LLM"
                    onExport={handleLlmExport}
                    Icon={ArrowDownTrayIcon}
                    loading={isLoadingLlm}
                />
            </div>
        </div>
    );
};

export default ExportManager;
