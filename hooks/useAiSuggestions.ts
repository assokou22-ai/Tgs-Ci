import { useState } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

interface AiSuggestionHook {
    suggestion: string;
    isLoading: boolean;
    error: string | null;
    getDiagnosisSuggestion: (problem: string) => Promise<void>;
}

export const useAiSuggestions = (): AiSuggestionHook => {
    const [suggestion, setSuggestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getDiagnosisSuggestion = async (problem: string) => {
        if (!problem) return;

        setIsLoading(true);
        setError(null);
        setSuggestion('');

        const prompt = `
            En tant qu'expert en réparation de MacBook, analyse le problème suivant décrit par un client.
            Suggère les 3 causes les plus probables, de la plus à la moins probable.
            Pour chaque cause, fournis une brève explication (1 sentence) et une suggestion d'étape de diagnostic concrète (1 sentence).
            Formate ta réponse de manière claire et concise en utilisant des listes.

            Problème décrit : "${problem}"
        `;

        try {
            // Fixed: Directly use process.env.API_KEY and gemini-3-flash-preview model
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });
            setSuggestion(response.text || '');
        } catch (e) {
            console.error("AI suggestion error:", e);
            setError("La suggestion de l'IA a échoué. Veuillez réessayer.");
        } finally {
            setIsLoading(false);
        }
    };

    return { suggestion, isLoading, error, getDiagnosisSuggestion };
};