
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { knowledgeBase } from '../services/knowledgeBase.ts';
import { dbGetStoredDocuments } from '../services/dbService.ts';
import { StoredDocument } from '../types.ts';
import { SparklesIcon, FolderMagnifyingGlassIcon, DocumentArrowDownIcon, XCircleIcon } from './icons.tsx';

// Simple retrieval function updated to include stored documents
const retrieveRelevantInfo = (query: string, docs: StoredDocument[]): { content: string, source: string, type: 'text' | 'file', fileData?: StoredDocument }[] => {
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    if (queryWords.size === 0) return [];

    const results: { content: string, source: string, score: number, type: 'text' | 'file', fileData?: StoredDocument }[] = [];

    // 1. Search in KnowledgeBase (Text)
    knowledgeBase.forEach(doc => {
        let score = 0;
        queryWords.forEach(word => {
            if (doc.content.toLowerCase().includes(word)) score++;
        });
        doc.keywords.forEach(kw => {
            queryWords.forEach(word => {
                if (kw.includes(word)) score += 2;
            });
        });
        if (score > 0) {
            results.push({ content: doc.content, source: "Manuel Interne", score, type: 'text' });
        }
    });

    // 2. Search in Stored Documents (Files) based on Name/Description
    docs.forEach(doc => {
        let score = 0;
        const textToSearch = (doc.name + ' ' + doc.description + ' ' + doc.category).toLowerCase();
        
        queryWords.forEach(word => {
            if (textToSearch.includes(word)) score += 3; // High weight for file matches
        });

        if (score > 0) {
            results.push({ 
                content: `Fichier disponible : "${doc.name}" (Catégorie: ${doc.category}). Description : ${doc.description}`, 
                source: `Fichier: ${doc.name}`, 
                score, 
                type: 'file',
                fileData: doc
            });
        }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, 5);
};

const InternalDocSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [answer, setAnswer] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [retrievedContext, setRetrievedContext] = useState<{ content: string, source: string, type: 'text' | 'file', fileData?: StoredDocument }[]>([]);
    const [storedDocs, setStoredDocs] = useState<StoredDocument[]>([]);

    useEffect(() => {
        const loadDocs = async () => {
            const docs = await dbGetStoredDocuments();
            setStoredDocs(docs);
        };
        loadDocs();
    }, []);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsLoading(true);
        setError('');
        setAnswer('');
        setRetrievedContext([]);

        try {
            const relevantInfo = retrieveRelevantInfo(query, storedDocs);
            setRetrievedContext(relevantInfo);

            if (relevantInfo.length === 0) {
                setError("Aucun document correspondant trouvé.");
                setIsLoading(false);
                return;
            }

            const contextText = relevantInfo.map(info => `[Source: ${info.source}] ${info.content}`).join('\n\n');
            
            const prompt = `
                Assistant expert MacBook. Réponds exclusivement selon le contexte fourni.
                Mentionne s'il y a un fichier correspondant.
                CONTEXTE: ${contextText}
                QUESTION: ${query}
            `;
            
            const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });

            setAnswer(response.text || '');

        } catch (e) {
            console.error("Erreur de recherche IA:", e);
            setError("Service momentanément indisponible.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = (doc: StoredDocument) => {
        const link = document.createElement('a');
        link.href = doc.data;
        link.download = doc.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-fade-in">
            {/* BARRE DE RECHERCHE STYLE SPOTLIGHT */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[32px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-apple-surface/90 backdrop-blur-2xl rounded-[30px] border border-white/10 shadow-2xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-600/10 rounded-2xl">
                        <FolderMagnifyingGlassIcon className="w-8 h-8 text-blue-500" />
                    </div>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Rechercher une procédure, un schéma ou un manuel..."
                        className="flex-1 bg-transparent text-xl font-black text-white outline-none placeholder:text-slate-600"
                    />
                    {query && (
                        <button onClick={() => {setQuery(''); setAnswer('');}} className="p-2 text-slate-500 hover:text-white transition-colors">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    )}
                    <button
                        onClick={handleSearch}
                        disabled={isLoading || !query.trim()}
                        className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/40 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <SparklesIcon className="w-4 h-4" />
                        )}
                        <span>Chercher</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-600/10 border border-red-500/20 p-6 rounded-3xl text-center">
                    <p className="text-red-400 font-bold uppercase text-[10px] tracking-widest">{error}</p>
                </div>
            )}

            <div className="space-y-8 min-h-[300px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center pt-20">
                        <div className="relative w-16 h-16 mb-6">
                            <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.3em] animate-pulse">Exploration des archives...</p>
                    </div>
                ) : answer && (
                    <div className="space-y-8">
                        {/* RÉPONSE IA */}
                        <div className="apple-card p-8 bg-white/[0.02] border-white/5 shadow-2xl">
                             <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4" /> Synthèse Intelligente
                             </h3>
                            <div className="text-slate-200 text-lg leading-relaxed whitespace-pre-wrap font-medium">
                                {answer}
                            </div>
                        </div>
                        
                        {/* FICHIERS TROUVÉS */}
                        {retrievedContext.some(c => c.type === 'file') && (
                             <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Documents techniques détectés</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {retrievedContext.filter(c => c.type === 'file' && c.fileData).map((ctx, index) => (
                                        <div key={index} className="flex items-center gap-5 p-5 bg-apple-surface border border-white/5 rounded-3xl group hover:border-blue-500/30 transition-all shadow-xl">
                                            <div className="p-4 bg-black/40 rounded-2xl group-hover:bg-blue-600/10 transition-colors">
                                                <DocumentArrowDownIcon className="w-8 h-8 text-blue-400"/>
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="font-black text-white uppercase text-xs truncate mb-1">{ctx.fileData!.name}</p>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{ctx.fileData!.category} • {ctx.fileData!.type.split('/')[1].toUpperCase()}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleDownload(ctx.fileData!)}
                                                className="p-4 bg-white/5 hover:bg-blue-600 text-slate-400 hover:text-white rounded-2xl transition-all active:scale-90"
                                                title="Télécharger le fichier"
                                            >
                                                <DocumentArrowDownIcon className="w-6 h-6"/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {!isLoading && !answer && !error && (
                    <div className="py-20 flex flex-col items-center justify-center opacity-20">
                         <FolderMagnifyingGlassIcon className="w-20 h-20 text-slate-500 mb-6" />
                         <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.4em]">Indexation complète terminée</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InternalDocSearch;
