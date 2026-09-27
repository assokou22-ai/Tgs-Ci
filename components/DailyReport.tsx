import React, { useMemo, useState } from 'react';
import { GoogleGenAI } from "@google/genai";
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
            case 'weekly': {
                const dayOfWeek = now.getDay();
                const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                startDate = new Date(now.getFullYear(), now.getMonth(), diff);
                startDate.setHours(0, 0, 0, 0);
                break;
            }
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
        const completedInPeriod = tickets.filter(t => (t.status === RepairStatus.TERMINE || t.status === RepairStatus.RENDU) && t.updatedAt >= startDateISO);

        return {
            created: createdInPeriod,
            completed: completedInPeriod,
            periodName: periodNameMap[period]
        };
    }, [tickets, period]);

    const generateReport = async () => {
        setLoading(true);
        setError('');
        setReport('');

        const prompt = `
            Génère un rapport ${periodData.periodName} concis et professionnel pour un technicien en réparation de Mac. 
            Voici les données :
            - Fiches créées: ${periodData.created.length}
            - Fiches terminées: ${periodData.completed.length}
            - Modèles: ${[...new Set(periodData.created.map(t => t.macModel))].join(', ') || 'Aucun'}
            
            Structure : Chiffres clés, Tendances de pannes, Conseils stock.
        `;

        try {
            const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });
            setReport(response.text || '');
        } catch (e) {
            console.error("Erreur IA:", e);
            setError("Impossible de générer le rapport. Vérifiez votre connexion.");
        } finally {
            setLoading(false);
        }
    };

  return (
    <div className="p-4 max-w-4xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-apple-blue hover:underline mb-4 font-bold uppercase text-[10px] tracking-widest">
          <ArrowLeftIcon className="w-5 h-5" /> Retour
        </button>
      <div className="apple-card p-6">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <h1 className="text-xl font-black text-white uppercase tracking-tighter">Analyse d'Activité</h1>
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
                {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${period === p ? 'bg-apple-blue text-white shadow-lg' : 'text-apple-muted hover:text-white'}`}
                    >
                        {p === 'daily' ? 'Jour' : p === 'weekly' ? 'Semaine' : 'Mois'}
                    </button>
                ))}
            </div>
        </div>
        
        <div className="flex justify-center mb-8">
             <button 
                onClick={generateReport}
                disabled={loading}
                className="px-8 py-4 bg-white text-black font-black rounded-2xl uppercase text-xs tracking-widest hover:bg-gray-200 transition-all shadow-xl disabled:opacity-50"
            >
                {loading ? 'Consultation Gemini...' : `Générer le Rapport ${periodData.periodName}`}
            </button>
        </div>

        {error && <p className="text-red-400 bg-red-900/20 border border-red-900/30 p-4 rounded-xl text-xs font-bold uppercase text-center mb-6">{error}</p>}
        
        <div className="min-h-[200px]">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-40">
                    <div className="w-8 h-8 border-2 border-apple-blue border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-apple-muted text-[10px] font-black uppercase tracking-widest">Calcul des probabilités...</p>
                </div>
            ) : report ? (
                <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed bg-black/20 p-6 rounded-2xl border border-white/5 whitespace-pre-wrap font-medium">
                    {report}
                </div>
            ) : (
                <div className="text-center py-10 opacity-30">
                    <p className="text-apple-muted text-xs font-black uppercase tracking-[0.2em]">Prêt pour l'analyse sémantique</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsReport;