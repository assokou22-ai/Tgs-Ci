import React, { useState } from 'react';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SparklesIcon } from './icons.tsx';

interface AiPriceSuggestionProps {
  problemDescription: string;
  macModel: string;
  onSuggestion: (price: number, serviceName: string) => void;
}

const AiPriceSuggestion: React.FC<AiPriceSuggestionProps> = ({ problemDescription, macModel, onSuggestion }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSuggestion = async () => {
    if (!problemDescription || !macModel || loading) return;

    setLoading(true);
    setError('');

    const prompt = `
        En te basant sur les détails de réparation de Mac suivants, suggère UN SEUL nom de service probable et son prix en Francs CFA.
        Modèle de Mac: "${macModel}"
        Problème: "${problemDescription}"

        Réponds avec un objet JSON qui suit ce schéma. Le prix doit être un nombre entier.
    `;

    try {
        // Fixed: Directly use process.env.API_KEY and gemini-3-flash-preview model
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  serviceName: { type: Type.STRING, description: "Le nom du service de réparation suggéré." },
                  price: { type: Type.NUMBER, description: "Le prix suggéré en Francs CFA (nombre entier)." },
                },
                required: ['serviceName', 'price'],
              },
            }
        });

        try {
            const jsonString = response.text ? response.text.trim() : '';
            const result = JSON.parse(jsonString);

            if (result.price && result.serviceName) {
                onSuggestion(Number(result.price), result.serviceName);
            } else {
                setError("Réponse IA invalide.");
            }
        } catch (parseError) {
            console.error("Failed to parse AI response:", parseError);
            setError("La réponse de l'IA est malformée.");
        }
    } catch (e: any) {
        console.error("Erreur de suggestion de prix IA :", e);
        setError("La suggestion de l'IA a échoué. Réessayez ou vérifiez la connexion.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSuggestion}
      disabled={loading || !problemDescription || !macModel}
      className="p-1 rounded-full text-yellow-400 hover:bg-yellow-400/20 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
      title={error || "Suggérer un prix avec l'IA"}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <SparklesIcon className="w-4 h-4" />
      )}
    </button>
  );
};

export default AiPriceSuggestion;