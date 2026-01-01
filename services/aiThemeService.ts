
import { GoogleGenAI, Type } from "@google/genai";
import { ColorPalette } from '../types.ts';

export const generateAiTheme = async (): Promise<ColorPalette> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Génère une palette de couleurs professionnelle et moderne pour une application web de gestion. 
    L'ambiance doit être technologique et épurée.
    Retourne un objet JSON avec les clés suivantes :
    - primary : couleur de marque (boutons, icônes actives)
    - secondary : couleur secondaire contrastée
    - bg : couleur de fond principale (très claire ou très sombre)
    - surface : couleur des cartes/modals
    - text : couleur du texte principal
    - textMuted : couleur du texte discret
    - accent : couleur vive pour les alertes ou éléments clés
    Utilise exclusivement des codes Hexadécimaux.`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    primary: { type: Type.STRING },
                    secondary: { type: Type.STRING },
                    bg: { type: Type.STRING },
                    surface: { type: Type.STRING },
                    text: { type: Type.STRING },
                    textMuted: { type: Type.STRING },
                    accent: { type: Type.STRING }
                },
                required: ['primary', 'bg', 'surface', 'text']
            }
        }
    });

    return JSON.parse(response.text || '{}') as ColorPalette;
};
