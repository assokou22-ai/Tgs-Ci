
import React, { useState } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GlobeAltIcon, XCircleIcon, SparklesIcon, MacbookIcon } from './icons.tsx';

const MacModelWebSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [sources, setSources] = useState<{ uri: string, title: string }[]>([]);
    const [error, setError] = useState('');

    const handleSearch = async () => {
        if (!query.trim()) return;

        // Check for API Key first (Gemini 3 Pro with Search needs it)
        try {
            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                if (!hasKey) {
                    await window.aistudio.openSelectKey();
                }
            }
        } catch (err) {
            console.warn("AI Studio key check skipped due to environment:", err);
        }

        setIsLoading(true);
        setError('');
        setResult('');
        setSources([]);

        try {
            const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: [{
                    role: 'user',
                    parts: [{
                        text: `Trouve les spécifications techniques exactes du MacBook modèle ${query}.
                        Réponds avec cette structure claire :
                        1. Identification précise (Nom, processeur, année)
                        2. Compatibilité Batterie (Référence AXXXX exacte)
                        3. Compatibilité Chargeur (Puissance en W et type de connecteur)
                        4. Autres notes (Type d'écran, SSD soudé ou non).
                        Sois extrêmement précis sur les références techniques de batterie.`
                    }]
                }],
                config: {
                    tools: [{ googleSearch: {} }]
                }
            });

            if (response.text) {
                setResult(response.text);
                
                // Extract sources from grounding metadata
                const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if (chunks) {
                    const extractedSources = chunks
                        .filter((chunk: { web?: { uri: string; title: string } }) => chunk.web)
                        .map((chunk: { web: { uri: string; title: string } }) => ({
                            uri: chunk.web.uri,
                            title: chunk.web.title
                        }));
                    setSources(extractedSources);
                }
            } else {
                setError("Aucune information précise trouvée pour ce modèle.");
            }

        } catch (e) {
            console.error("Erreur Recherche Web:", e);
            const err = e as { message?: string };
            const win = window as unknown as { aistudio?: { openSelectKey: () => Promise<void> } };
            if (err.message?.includes("Requested entity was not found") && win.aistudio) {
                await win.aistudio.openSelectKey();
            }
            setError("Erreur lors de l'interrogation des bases de données mondiales.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
            {/* Header Lab */}
            <div className="bg-blue-600/10 border border-blue-500/30 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-6 shadow-2xl">
                <div className="p-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-900/40">
                    <GlobeAltIcon className="w-10 h-10 text-white" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">Vérificateur Hardware Mondial</h2>
                    <p className="text-blue-400 font-bold uppercase text-[10px] tracking-widest mt-1">Live Technical Database Access (Apple Service Network)</p>
                </div>
            </div>

            {/* Input Spot */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[32px] blur opacity-10 group-hover:opacity-25 transition duration-1000"></div>
                <div className="relative bg-apple-surface rounded-[30px] border border-white/10 p-4 flex items-center gap-4 shadow-2xl">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Entrez un modèle (ex: A3113, A2338, MacBook Pro M2...)"
                        className="flex-1 bg-transparent text-xl font-black text-white outline-none placeholder:text-slate-700 px-4"
                    />
                    {query && (
                        <button onClick={() => setQuery('')} className="p-2 text-slate-500 hover:text-white transition-colors">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    )}
                    <button
                        onClick={handleSearch}
                        disabled={isLoading || !query.trim()}
                        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl uppercase text-xs tracking-widest transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <GlobeAltIcon className="w-4 h-4" />
                        )}
                        <span>Identifier</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-6 bg-red-600/10 border border-red-500/20 rounded-3xl text-center">
                    <p className="text-red-400 font-bold uppercase text-[10px] tracking-widest">{error}</p>
                </div>
            )}

            <div className="min-h-[400px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center pt-20">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.4em] animate-pulse">Scan des serveurs Apple Repair...</p>
                    </div>
                ) : result ? (
                    <div className="space-y-8 animate-slide-up">
                        {/* Fiche de compatibilité */}
                        <div className="apple-card p-10 bg-white/[0.02] border-blue-500/10 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <MacbookIcon className="w-48 h-48 text-white rotate-12" />
                            </div>
                            
                            <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-8 flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4" /> Spécifications Certifiées
                            </h3>
                            
                            <div className="prose prose-invert max-w-none prose-p:text-lg prose-p:leading-relaxed prose-strong:text-blue-400 prose-li:text-slate-300">
                                <div className="whitespace-pre-wrap text-slate-200 font-medium">
                                    {result}
                                </div>
                            </div>
                        </div>

                        {/* Sources */}
                        {sources.length > 0 && (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Sources Techniques Vérifiées</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {sources.map((s, idx) => (
                                        <a 
                                            key={idx} 
                                            href={s.uri} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-4 p-4 bg-apple-surface border border-white/5 rounded-2xl hover:border-blue-500/40 transition-all group shadow-lg"
                                        >
                                            <div className="p-3 bg-black/40 rounded-xl group-hover:bg-blue-600/10 transition-colors">
                                                <GlobeAltIcon className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-white font-bold text-xs truncate uppercase tracking-tight">{s.title || "Documentation Technique"}</p>
                                                <p className="text-[9px] text-slate-500 truncate">{s.uri}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center opacity-10">
                        <MacbookIcon className="w-32 h-32 text-slate-500 mb-8" />
                        <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.5em]">Prêt pour l'identification hardware</p>
                    </div>
                )}
            </div>
            
            <div className="p-6 bg-yellow-600/5 border border-yellow-500/10 rounded-2xl text-center">
                 <p className="text-yellow-500/70 text-[9px] font-bold uppercase tracking-widest">
                    Note : Les informations sont issues de bases de données publiques de réparation. Vérifiez toujours physiquement la pièce avant commande.
                 </p>
            </div>
        </div>
    );
};

export default MacModelWebSearch;
