import React, { useState, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { knowledgeBase } from '../services/knowledgeBase.ts';
import { dbGetStoredDocuments } from '../services/dbService.ts';
import { StoredDocument } from '../types.ts';
import { SparklesIcon, DocumentArrowDownIcon } from './icons.tsx';

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
            // 1. Retrieval (Mixing KB text and File Metadata)
            const relevantInfo = retrieveRelevantInfo(query, storedDocs);
            setRetrievedContext(relevantInfo);

            if (relevantInfo.length === 0) {
                setError("Aucune information pertinente trouvée dans la documentation ou les fichiers.");
                setIsLoading(false);
                return;
            }

            // 2. Augmentation & Generation
            const contextText = relevantInfo.map(info => `[Source: ${info.source}] ${info.content}`).join('\n\n');
            
            const prompt = `
                Tu es un assistant expert pour l'atelier de réparation "Réparer Mon Macbook".
                Réponds à la question de l'utilisateur en te basant EXCLUSIVEMENT sur le contexte fourni ci-dessous.
                Le contexte peut contenir des extraits de procédures ou des références à des fichiers (Excel, PDF, etc.).
                
                Si le contexte mentionne un fichier pertinent, indique clairement à l'utilisateur qu'il peut consulter le fichier "${relevantInfo.find(i => i.type === 'file')?.source}" ci-dessous.
                Si la réponse ne se trouve pas dans le contexte, indique que l'information n'est pas disponible.

                --- CONTEXTE ---
                ${contextText}
                ---

                Question de l'utilisateur: "${query}"
            `;
            
            // Fixed: Directly use process.env.API_KEY and gemini-3-flash-preview model
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });

            setAnswer(response.text || '');

        } catch (e: any) {
            console.error("Erreur lors de la recherche sémantique:", e);
            setError("Une erreur est survenue lors de la communication avec le service d'IA.");
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
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Documents & Recherche IA</h2>
            <p className="text-gray-400 mb-6">
                Posez une question sur les procédures, les tarifs, ou demandez si un document spécifique (ex: "Grille salariale") existe dans la base de connaissance.
            </p>

            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Ex: A-t-on un document sur les salaires ?"
                    className="flex-grow p-3 bg-gray-700 text-white rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                    onClick={handleSearch}
                    disabled={isLoading || !query.trim()}
                    className="px-5 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-wait flex items-center gap-2"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <SparklesIcon className="w-5 h-5" />
                    )}
                    <span>Demander</span>
                </button>
            </div>

            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md my-4">{error}</p>}

            <div className="mt-6 min-h-[200px]">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                        <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p>Recherche dans les documents et fichiers...</p>
                    </div>
                )}
                {answer && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Réponse de l'IA</h3>
                            <div className="prose prose-invert prose-p:text-gray-300 prose-li:text-gray-300 whitespace-pre-wrap bg-gray-900/50 p-4 rounded-md">
                                {answer}
                            </div>
                        </div>
                        
                        {/* Display File Attachments if found in context */}
                        {retrievedContext.some(c => c.type === 'file') && (
                             <div>
                                <h3 className="text-md font-semibold text-blue-400 mb-2">Fichiers pertinents trouvés</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {retrievedContext.filter(c => c.type === 'file' && c.fileData).map((ctx, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded border border-gray-600">
                                            <div className="overflow-hidden">
                                                <p className="font-bold text-white truncate">{ctx.fileData!.name}</p>
                                                <p className="text-xs text-gray-400">{ctx.fileData!.description}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleDownload(ctx.fileData!)}
                                                className="ml-2 p-2 bg-blue-600 hover:bg-blue-500 rounded text-white"
                                                title="Télécharger"
                                            >
                                                <DocumentArrowDownIcon className="w-5 h-5"/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Display Text Sources */}
                        {retrievedContext.some(c => c.type === 'text') && (
                             <div>
                                <h3 className="text-md font-semibold text-gray-400 mb-2">Sources textuelles</h3>
                                <div className="space-y-2 text-sm text-gray-500 border-l-2 border-gray-600 pl-4">
                                    {retrievedContext.filter(c => c.type === 'text').map((ctx, index) => (
                                        <p key={index} className="italic">"{ctx.source}"</p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InternalDocSearch;