import React, { useState } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { SparklesIcon } from './icons.tsx';

interface AiCorrectionButtonProps {
  text: string;
  onCorrected: (correctedText: string) => void;
  fieldName: string;
}

const AiCorrectionButton: React.FC<AiCorrectionButtonProps> = ({ text, onCorrected, fieldName }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCorrection = async () => {
    if (!text || loading) return;

    setLoading(true);
    setError('');

    const prompt = `
        Corrige et reformule le texte suivant pour qu'il soit clair, professionnel et sans fautes d'orthographe.
        Le texte concerne le champ "${fieldName}" d'une fiche de réparation pour un ordinateur Mac.
        Ta réponse DOIT contenir UNIQUEMENT le texte corrigé, sans aucune mise en forme, explication, ou phrase d'introduction.

        Texte à corriger:
        "${text}"
    `;

    try {
        // Fixed: Directly use process.env.API_KEY and gemini-3-flash-preview model
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        const correctedText = response.text ? response.text.trim() : '';
        onCorrected(correctedText);
    } catch (e: any) {
        console.error(e);
        setError("Erreur de l'IA");
    } finally {
        setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCorrection}
      disabled={loading || !text}
      className="p-1 rounded-full text-yellow-400 hover:bg-yellow-400/20 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
      title={error || "Corriger avec l'IA"}
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

export default AiCorrectionButton;