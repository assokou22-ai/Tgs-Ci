// Client IA unique : imite `new GoogleGenAI(...).models.generateContent` mais passe par le
// serveur de l'application (/api/gemini/proxy). La clé Gemini n'est jamais dans le navigateur
// ni dans l'APK, et les fonctions IA marchent à l'identique sur PC, iPad et Android.
import type { GenerateContentResponse } from '@google/genai';

export interface AiGenerateParams {
    model?: string;
    contents: unknown;
    config?: Record<string, unknown>;
}

export const createAI = () => ({
    models: {
        generateContent: async (params: AiGenerateParams): Promise<GenerateContentResponse> => {
            let r: Response;
            try {
                r = await fetch('/api/gemini/proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: params.model, contents: params.contents, config: params.config }),
                });
            } catch {
                throw new Error("Serveur IA injoignable. Vérifiez la connexion Internet.");
            }
            let j: { text?: string; candidates?: unknown[]; error?: string } = {};
            try { j = await r.json(); } catch { /* réponse vide */ }
            if (!r.ok) throw new Error(j.error || `Erreur IA (${r.status})`);
            return { text: j.text || '', candidates: j.candidates || [] } as unknown as GenerateContentResponse;
        },
    },
});
