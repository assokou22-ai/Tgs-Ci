// services/serverService.ts

import { BackupData } from '../types.ts';

const SERVER_STORAGE_KEY = 'mac-repair-server-multistore-data';
const SIMULated_LATENCY_MS = 800;

type AllServerData = Record<string, BackupData>;

/**
 * Simule la récupération de l'ensemble de la base de données depuis un serveur distant.
 * @param {string} storeId L'identifiant du magasin pour lequel récupérer les données.
 * @returns {Promise<BackupData | null>} Les données complètes du magasin ou null.
 */
export const fetchDataFromServer = (storeId: string): Promise<BackupData | null> => {
    console.log(`[Serveur Simulé] Requête de récupération des données pour le magasin: ${storeId}...`);
    return new Promise((resolve) => {
        setTimeout(() => {
            const serverDataString = localStorage.getItem(SERVER_STORAGE_KEY);
            if (serverDataString) {
                try {
                    const allServerData: AllServerData = JSON.parse(serverDataString);
                    const storeData = allServerData[storeId] || null;
                    if (storeData) {
                        console.log(`[Serveur Simulé] Données pour ${storeId} trouvées, envoi au client.`);
                    } else {
                        console.log(`[Serveur Simulé] Aucune donnée pour le magasin ${storeId}.`);
                    }
                    resolve(storeData);
                } catch (error) {
                    console.error('[Serveur Simulé] Erreur de parsing des données.', error);
                    resolve(null);
                }
            } else {
                console.log('[Serveur Simulé] Aucune donnée sur le serveur.');
                resolve(null);
            }
        }, SIMULated_LATENCY_MS);
    });
};

/**
 * Simule la sauvegarde de l'ensemble des données d'un magasin sur un serveur distant.
 * @param {string} storeId L'identifiant du magasin à sauvegarder.
 * @param {BackupData} data Les données complètes du magasin.
 * @returns {Promise<void>}
 */
export const saveDataToServer = (storeId: string, data: BackupData): Promise<void> => {
    console.log(`[Serveur Simulé] Requête de sauvegarde pour le magasin: ${storeId}...`);
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                const serverDataString = localStorage.getItem(SERVER_STORAGE_KEY);
                const allServerData: AllServerData = serverDataString ? JSON.parse(serverDataString) : {};
                
                allServerData[storeId] = data;

                localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(allServerData));
                console.log(`[Serveur Simulé] Données pour ${storeId} sauvegardées avec succès.`);
                resolve();
            } catch (error) {
                console.error(`[Serveur Simulé] Erreur de sauvegarde pour ${storeId}.`, error);
                resolve(); // On ne rejette pas pour la simulation
            }
        }, SIMULated_LATENCY_MS);
    });
};
