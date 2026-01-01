
import { useState, useEffect, useCallback } from 'react';
import { Facture, Proforma, Commande } from '../types.ts';
import {
    dbGetFactures, dbAddFacture, dbUpdateFacture, dbDeleteFacture,
    dbGetProformas, dbAddProforma, dbUpdateProforma, dbDeleteProforma,
    dbGetCommandes, dbAddCommande, dbUpdateCommande, dbDeleteCommande
} from '../services/dbService.ts';

export const useFinanceData = () => {
    const [factures, setFactures] = useState<Facture[]>([]);
    const [proformas, setProformas] = useState<Proforma[]>([]);
    const [commandes, setCommandes] = useState<Commande[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [fetchedFactures, fetchedProformas, fetchedCommandes] = await Promise.all([
                dbGetFactures(),
                dbGetProformas(),
                dbGetCommandes()
            ]);

            setFactures(fetchedFactures.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setProformas(fetchedProformas.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setCommandes(fetchedCommandes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (err) {
            console.error("Erreur lors du chargement des données financières:", err);
            setError("Impossible de charger les données financières.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
        const handleDataReceived = () => fetchAllData();
        window.addEventListener('datareceived', handleDataReceived);
        
        return () => {
            window.removeEventListener('datareceived', handleDataReceived);
        };
    }, [fetchAllData]);

    // --- Factures ---
    const addFacture = useCallback(async (data: Omit<Facture, 'id' | 'numero' | 'date' | 'updatedAt'>) => {
        try {
            const now = new Date();
            const year = now.getFullYear().toString().slice(-2);
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const timestamp = Date.now();
            const randomPart = Math.random().toString(36).substring(2, 7);
            
            const newFacture: Facture = {
                ...data,
                id: `fac-${timestamp}-${randomPart}`,
                date: now.toISOString(),
                updatedAt: now.toISOString(),
                numero: `FAC-${year}${month}-${String(timestamp).slice(-5)}`,
            };
            
            await dbAddFacture(newFacture);
            await fetchAllData();
            window.dispatchEvent(new CustomEvent('requestsync'));
        } catch (err) {
            console.error("Erreur ajout facture:", err);
            throw new Error("L'ajout de la facture a échoué.");
        }
    }, [fetchAllData]);

    const updateFacture = useCallback(async (facture: Facture) => {
        try {
            const updated = { ...facture, updatedAt: new Date().toISOString() };
            await dbUpdateFacture(updated);
            await fetchAllData();
            window.dispatchEvent(new CustomEvent('requestsync'));
        } catch (err) {
            console.error("Erreur maj facture:", err);
            throw new Error("La mise à jour de la facture a échoué.");
        }
    }, [fetchAllData]);

    const deleteFacture = useCallback(async (id: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette facture ?")) {
            try {
                await dbDeleteFacture(id);
                await fetchAllData();
                window.dispatchEvent(new CustomEvent('requestsync'));
            } catch (err) {
                console.error("Erreur suppression facture:", err);
                throw new Error("La suppression de la facture a échoué.");
            }
        }
    }, [fetchAllData]);

    // --- Proformas ---
    const addProforma = useCallback(async (data: Omit<Proforma, 'id' | 'numero' | 'date' | 'updatedAt'>) => {
        try {
            const now = new Date();
            const year = now.getFullYear().toString().slice(-2);
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const timestamp = Date.now();
            const randomPart = Math.random().toString(36).substring(2, 7);

            const newProforma: Proforma = {
                ...data,
                id: `pro-${timestamp}-${randomPart}`,
                date: now.toISOString(),
                updatedAt: now.toISOString(),
                numero: `PRO-${year}${month}-${String(timestamp).slice(-5)}`,
            };

            await dbAddProforma(newProforma);
            await fetchAllData();
            window.dispatchEvent(new CustomEvent('requestsync'));
        } catch (err) {
            console.error("Erreur ajout proforma:", err);
            throw new Error("L'ajout de la proforma a échoué.");
        }
    }, [fetchAllData]);

    const updateProforma = useCallback(async (proforma: Proforma) => {
        try {
            const updated = { ...proforma, updatedAt: new Date().toISOString() };
            await dbUpdateProforma(updated);
            await fetchAllData();
            window.dispatchEvent(new CustomEvent('requestsync'));
        } catch (err) {
            console.error("Erreur maj proforma:", err);
            throw new Error("La mise à jour de la proforma a échoué.");
        }
    }, [fetchAllData]);

    const deleteProforma = useCallback(async (id: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette proforma ?")) {
            try {
                await dbDeleteProforma(id);
                await fetchAllData();
                window.dispatchEvent(new CustomEvent('requestsync'));
            } catch (err) {
                console.error("Erreur suppression proforma:", err);
                throw new Error("La suppression de la proforma a échoué.");
            }
        }
    }, [fetchAllData]);

    // --- Commandes ---
    const addCommande = useCallback(async (data: Omit<Commande, 'id' | 'numero' | 'date' | 'updatedAt'>) => {
        try {
            const now = new Date();
            const year = now.getFullYear().toString().slice(-2);
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const timestamp = Date.now();
            const randomPart = Math.random().toString(36).substring(2, 7);

            const newCommande: Commande = {
                ...data,
                id: `cmd-${timestamp}-${randomPart}`,
                date: now.toISOString(),
                updatedAt: now.toISOString(),
                numero: `CMD-${year}${month}-${String(timestamp).slice(-5)}`,
            };

            await dbAddCommande(newCommande);
            await fetchAllData();
            window.dispatchEvent(new CustomEvent('requestsync'));
        } catch (err) {
            console.error("Erreur ajout commande:", err);
            throw new Error("L'ajout de la commande a échoué.");
        }
    }, [fetchAllData]);

    const updateCommande = useCallback(async (commande: Commande) => {
        try {
            const updated = { ...commande, updatedAt: new Date().toISOString() };
            await dbUpdateCommande(updated);
            await fetchAllData();
            window.dispatchEvent(new CustomEvent('requestsync'));
        } catch (err) {
            console.error("Erreur maj commande:", err);
            throw new Error("La mise à jour de la commande a échoué.");
        }
    }, [fetchAllData]);

    const deleteCommande = useCallback(async (id: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette commande ?")) {
            try {
                await dbDeleteCommande(id);
                await fetchAllData();
                window.dispatchEvent(new CustomEvent('requestsync'));
            } catch (err) {
                console.error("Erreur suppression commande:", err);
                throw new Error("La suppression de la commande a échoué.");
            }
        }
    }, [fetchAllData]);

    return {
        factures,
        proformas,
        commandes,
        loading,
        error,
        refresh: fetchAllData,
        // Actions Factures
        addFacture,
        updateFacture,
        deleteFacture,
        // Actions Proformas
        addProforma,
        updateProforma,
        deleteProforma,
        // Actions Commandes
        addCommande,
        updateCommande,
        deleteCommande,
    };
};
