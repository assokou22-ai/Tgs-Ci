import { dbGetSuggestions, dbPutSuggestion, dbClearSuggestions } from './dbService.ts';
import { SuggestionRecord, SuggestionCategory } from '../types.ts';

export const getSuggestions = async (category: SuggestionCategory): Promise<string[]> => {
    const records = await dbGetSuggestions();
    const record = records.find(r => r.category === category);
    return record ? record.values : [];
};

export const addSuggestion = async (category: SuggestionCategory, value: string): Promise<void> => {
    try {
        let cleanedValue = value.trim();
        if (category === 'clientPhone') {
            cleanedValue = cleanedValue.replace(/[\s/]/g, ''); // Remove spaces and slashes for consistency
        }
        
        if (!cleanedValue || cleanedValue.length < 3) return; // Don't save empty or very short suggestions

        const records = await dbGetSuggestions();
        let record = records.find(r => r.category === category);

        if (record) {
            // Add if not already present (case-insensitive)
            if (!record.values.some(v => v.toLowerCase() === cleanedValue.toLowerCase())) {
                record.values.push(cleanedValue);
                // Optional: sort or limit the number of suggestions
                record.values.sort();
                await dbPutSuggestion(record);
            }
        } else {
            // Create new record
            const newRecord: SuggestionRecord = {
                category,
                values: [cleanedValue]
            };
            await dbPutSuggestion(newRecord);
        }
    } catch (error) {
        console.error(`Failed to add suggestion for category "${category}":`, error);
        // This is a non-critical background task, so we just log the error.
    }
};

export const clearSuggestions = async (): Promise<void> => {
    if (window.confirm("Êtes-vous sûr de vouloir réinitialiser toutes les suggestions de saisie automatique ? Cette action est irréversible.")) {
        try {
            await dbClearSuggestions();
            alert("Les suggestions ont été réinitialisées.");
        } catch (error) {
            console.error("Failed to clear suggestions:", error);
            alert("La réinitialisation des suggestions a échoué.");
        }
    }
};