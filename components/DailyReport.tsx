import React, { useMemo, useState } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { RepairTicket, RepairStatus } from '../types.ts';
import { ArrowLeftIcon } from './icons.tsx';

interface AnalyticsReportProps {
  tickets: RepairTicket[];
  onBack: () => void;
}

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

const AnalyticsReport: React.FC<AnalyticsReportProps> = ({ tickets, onBack }) => {
    const [report, setReport] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [period, setPeriod] = useState<Period>('daily');

    const periodData = useMemo(() => {
        const now = new Date();
        let startDate = new Date();
        const periodNameMap: Record<Period, string> = {
            daily: "du jour",
            weekly: "de la semaine",
            monthly: "du mois",
            yearly: "de l'année",
        };

        switch (period) {
            case 'daily':
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'weekly':
                const dayOfWeek = now.getDay();
                const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Monday start
                startDate = new Date(now.getFullYear(), now.getMonth(), diff);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                startDate.setHours(0, 0, 0, 0);
                break;
        }

        const startDateISO = startDate.toISOString();

        const createdInPeriod = tickets.filter(t => t.createdAt >= startDateISO);
        const updatedInPeriod = tickets.filter(t => t.updatedAt >= startDateISO && t.createdAt < startDateISO);
        const completedInPeriod = tickets.filter(t => (t.status === RepairStatus.TERMINE || t.status === RepairStatus.RENDU) && t.updatedAt >= startDateISO);

        return {
            created: createdInPeriod,
            completed: completedInPeriod,
            updated: updatedInPeriod,
            periodName: periodNameMap[period]
        };
    }, [tickets, period]);

    const generateReport = async () => {
        setLoading(true);
        setError('');
        setReport('');

        const prompt = `
            Génère un rapport ${periodData.periodName} concis et professionnel pour un technicien en réparation de Mac. 
            Le rapport doit être en français, structuré et facile à lire.
            Voici les données brutes ${periodData.periodName} :
            - Fiches créées: ${periodData.created.length}
            - Fiches terminées (statut changé à "Terminé" ou "Rendu"): ${periodData.completed.length}
            - Modèles de Mac enregistrés: ${[...new Set(periodData.created.map(t => t.macModel))].join(', ') || 'Aucun'}
            - Problèmes signalés:
            ${periodData.created.map(t => `- ${t.problemDescription}`).join('\n') || 'Aucun'}

            Le rapport doit inclure les sections suivantes :
            1.  **Résumé des Chiffres Clés**: Indique le nombre de nouvelles fiches et de réparations terminées.
            2.  **Tendances**: Analyse brièvement les pannes et modèles récurrents sur la période. Si aucune tendance claire ne se dégage, mentionne-le.
            3.  **Points d'Attention**: Propose des actions concrètes basées sur les données. Par exemple, si plusieurs problèmes de batterie sont signalés, suggère de vérifier le stock de batteries pour les modèles concernés.
            
            Adopte un ton informatif et utile. Commence le rapport par "Rapport ${periodData.periodName} du ${new Date().toLocaleDateString('fr-FR')}".
        `;

        try {
            // Fixed: Using process.env.API_KEY directly and using recommended model name
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });
            setReport(response.text || '');
        } catch (e: any) {
            console.error("Erreur de génération du rapport IA :", e);
            setError("Une erreur est survenue lors de la communication avec le service d'IA. Veuillez vérifier votre connexion et réessayer.");
        } finally {
            setLoading(false);
        }
    };

    const periodOptions: { key: Period; label: string }[] = [
        { key: 'daily', label: 'Journalier' },
        { key: 'weekly', label: 'Hebdomadaire' },
        { key: 'monthly', label: 'Mensuel' },
        { key: 'yearly', label: 'Annuel' }
    ];

    const titleMap: Record<Period, string> = {
        daily: 'Rapport Journalier',
        weekly: 'Rapport Hebdomadaire',
        monthly: 'Rapport Mensuel',
        yearly: 'Rapport Annuel',
    }

  return (
    <div className="p-4 max-w-4xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-blue-400 hover:underline mb-4">
          <ArrowLeftIcon className="w-5 h-5" />
          Retour au tableau de bord
        </button>
      <div className="bg-gray-800 rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <h1 className="text-2xl font-bold text-white">{titleMap[period]}</h1>
            <div className="flex items-center gap-2 bg-gray-700 p-1 rounded-lg">
                {periodOptions.map(option => (
                    <button
                        key={option.key}
                        onClick={() => setPeriod(option.key)}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${period === option.key ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
        
        <div className="flex justify-center mb-6">
             <button 
                onClick={generateReport}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-wait w-full md:w-auto"
            >
                {loading ? 'Génération en cours...' : `Générer le Rapport ${periodData.periodName} avec Gemini`}
            </button>
        </div>

        {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md my-4">{error}</p>}
        
        <div className="mt-4 min-h-[300px]">
            {loading ? (
                <div className="flex justify-center items-center h-full">
                    <p className="text-gray-400 animate-pulse">Analyse des données...</p>
                </div>
            ) : report ? (
                <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-white prose-li:text-gray-300 whitespace-pre-wrap">
                    {report.replace(/^#\s/gm, '### ')}
                </div>
            ) : (
                <div className="text-gray-400">
                    <h2 className="text-xl font-semibold text-white">Aperçu des données {periodData.periodName}</h2>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Nouvelles fiches: {periodData.created.length}</li>
                        <li>Réparations terminées: {periodData.completed.length}</li>
                        <li>Autres fiches mises à jour: {periodData.updated.length}</li>
                    </ul>
                    <p className="mt-4">Cliquez sur le bouton ci-dessus pour obtenir une analyse détaillée et des recommandations.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsReport;