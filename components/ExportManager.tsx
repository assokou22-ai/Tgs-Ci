
import React, { useState } from 'react';
import { backupData, compileFullBackupData } from '../services/backupService.ts';
import { exportToPdf, exportToExcel, exportFullDataToExcel, exportTicketFinancialPointToExcel } from '../services/exportService.ts';
import { ArrowDownTrayIcon, BanknotesIcon } from './icons.tsx';
import { Archive, FolderArchive } from 'lucide-react';
import { useToastContext } from '../context/ToastContext.tsx';
import { RepairTicket, DiagnosticCheck, RepairServiceItem } from '../types.ts';
import { getTicketFinancialSummary } from '../utils/ticketHelpers.ts';
import { ExportAllDossiersModal } from './ExportAllDossiersModal.tsx';

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
    const [isLoading, setIsLoading] = useState<null | 'json' | 'excelAll' | 'excelTickets' | 'pdfTickets' | 'excelFinancialPoint'>(null);
    const [isLoadingLlm, setIsLoadingLlm] = useState(false);
    const [isExportAllDossiersOpen, setIsExportAllDossiersOpen] = useState(false);

    const handleExport = async (exportType: 'json' | 'excelAll' | 'excelTickets' | 'pdfTickets' | 'excelFinancialPoint') => {
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
                case 'excelFinancialPoint': {
                    const ticketsList = fullData.tickets || [];
                    let totalBilled = 0;
                    let totalAdvance = 0;
                    let totalBalanceDue = 0;
                    let facturablesCount = 0;
                    let infacturablesCount = 0;
                    let paidCount = 0;
                    let withBalanceCount = 0;

                    ticketsList.forEach((t: RepairTicket) => {
                        const fin = getTicketFinancialSummary(t);
                        if (fin.isInfacturable) {
                            infacturablesCount++;
                        } else {
                            facturablesCount++;
                            totalBilled += fin.totalBilled;
                            totalAdvance += fin.advanceReceived;
                            totalBalanceDue += fin.balanceDue;
                            if (fin.isFullyPaid) paidCount++;
                            if (fin.balanceDue > 0) withBalanceCount++;
                        }
                    });

                    const collectionRate = totalBilled > 0 ? Math.round((totalAdvance / totalBilled) * 100) : 0;
                    const metrics = {
                        totalBilled,
                        totalAdvance,
                        totalBalanceDue,
                        facturablesCount,
                        infacturablesCount,
                        paidCount,
                        withBalanceCount,
                        collectionRate,
                        totalCount: ticketsList.length
                    };

                    exportTicketFinancialPointToExcel(
                        ticketsList,
                        "Registre Global d'Atelier",
                        metrics,
                        `POINT_FINANCIER_GLOBAL_TGS_${new Date().toISOString().split('T')[0]}.xlsx`
                    );
                    showToast("Point financier exporté avec succès !", "success");
                    break;
                }
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
                const totalCost = getTicketFinancialSummary(ticket).totalBilled;

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
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-5xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">Centre d'Exportation</h2>
                <p className="text-gray-400">
                    Téléchargez vos données dans différents formats pour la sauvegarde, l'analyse ou l'archivage.
                </p>
            </div>

            {/* CARTE VEDETTE : EXPORTER TOUS LES DOSSIERS (ARCHIVE ZIP COMPLÈTE) */}
            <div className="bg-gradient-to-br from-blue-950/60 via-slate-900 to-indigo-950/60 border-2 border-blue-500/30 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="space-y-2 relative z-10 max-w-2xl">
                    <div className="flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest">
                        <Archive className="w-4 h-4" />
                        <span>Archivage Global Intégral • Hors-Ligne</span>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">
                        Exporter tous les dossiers (Archive ZIP)
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                        Génère une archive ZIP structurée contenant <strong>un dossier par numéro de fiche</strong> (ex. : <code className="text-blue-300 bg-black/40 px-1.5 py-0.5 rounded font-mono">26RM751/</code>).
                        Chaque dossier contient la fiche complète en <strong>PDF</strong> et <strong>HTML</strong>, ainsi que toutes les photos originales classées (<span className="text-slate-400">réception, restitution, Yango, justificatifs Wave/OM</span>).
                        Inclut un <strong>portail index.html</strong> à la racine pour naviguer hors-ligne sans connexion et le rapport <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded font-mono">Erreurs_export.txt</code>.
                    </p>
                </div>

                <button
                    onClick={() => setIsExportAllDossiersOpen(true)}
                    className="relative z-10 w-full md:w-auto px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all shrink-0 active:scale-95"
                >
                    <FolderArchive className="w-5 h-5" />
                    <span>Exporter tous les dossiers</span>
                </button>
            </div>

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
                    title="Point Financier d'Atelier (Excel)"
                    description="Exportez le point financier officiel complet de l'atelier avec totaux facturés, acomptes perçus, solde restant dû et traitement strict des fiches annulées (0 F comptabilisé au point selon la règle comptable TGS-CI)."
                    buttonText="Exporter le Point Financier"
                    onExport={() => handleExport('excelFinancialPoint')}
                    Icon={BanknotesIcon}
                    loading={isLoading === 'excelFinancialPoint'}
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

            <ExportAllDossiersModal
                isOpen={isExportAllDossiersOpen}
                onClose={() => setIsExportAllDossiersOpen(false)}
            />
        </div>
    );
};

export default ExportManager;
