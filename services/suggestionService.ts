
import { dbGetSuggestions, dbPutSuggestion, dbClearSuggestions } from './dbService.ts';
import { SuggestionCategory } from '../types.ts';
import { MAC_MODELS_DB } from '../utils/macModelsData.ts';

/**
 * Récupère les suggestions pour une catégorie donnée.
 * Combine les suggestions enregistrées en base avec les données statiques si applicable.
 */
export const getSuggestions = async (category: SuggestionCategory): Promise<string[]> => {
    try {
        const records = await dbGetSuggestions();
        const record = records.find(r => r.category === category);
        const savedValues = record ? record.values : [];

        // Enrichissement statique pour certaines catégories
        if (category === 'mac_models') {
            const staticModels = MAC_MODELS_DB.map(m => m.name);
            // On fusionne et on dédoublonne, les statiques en premier pour la précision
            return Array.from(new Set([...staticModels, ...savedValues]));
        }

        if (category === 'mac_colors') {
            const staticColors = Array.from(new Set(MAC_MODELS_DB.flatMap(m => m.colors)));
            return Array.from(new Set([...staticColors, ...savedValues]));
        }

        if (category === 'service_name' || category === 'customServiceName') {
            const staticServices = [
                "Réparation de la carte mère",
                "Remplacement de la carte mère",
                "Réparation de la lumière sur l'écran",
                "Réparation de la lumière sur la carte mère",
                "Désoxydation (dégâts liquides)",
                "Remplacement batterie neuve",
                "Remplacement clavier",
                "Remplacement trackpad",
                "Remplacement écran"
            ];
            return Array.from(new Set([...staticServices, ...savedValues]));
        }

        return savedValues;
    } catch {
        return [];
    }
};

/**
 * Enregistre une nouvelle valeur dans la mémoire de l'application.
 */
export const addSuggestion = async (category: SuggestionCategory, value: string): Promise<void> => {
    try {
        const cleanedValue = value.trim();
        // On ne stocke que les phrases significatives (ex: "Écran cassé" oui, "e" non)
        if (!cleanedValue || cleanedValue.length < 3) return;

        const records = await dbGetSuggestions();
        const record = records.find(r => r.category === category);

        if (record) {
            // Éviter les doublons (insensible à la casse)
            const exists = record.values.some(v => v.toLowerCase() === cleanedValue.toLowerCase());
            if (!exists) {
                // On garde les 50 dernières suggestions les plus pertinentes/récentes
                const newValues = [cleanedValue, ...record.values].slice(0, 50);
                await dbPutSuggestion({ ...record, values: newValues });
            }
        } else {
            await dbPutSuggestion({ category, values: [cleanedValue] });
        }
    } catch (error) {
        console.warn(`Suggestion non enregistrée [${category}]:`, error);
    }
};

/**
 * Apprend d'un objet (ex: un ticket entier) en extrayant les champs pertinents.
 */
export const learnFromData = async (data: Record<string, unknown>, mappings: Record<string, SuggestionCategory>) => {
    for (const [field, category] of Object.entries(mappings)) {
        const value = data[field];
        if (typeof value === 'string' && value.length > 3) {
            await addSuggestion(category, value);
        }
    }
};

export const clearSuggestions = async (): Promise<void> => {
    await dbClearSuggestions();
};
