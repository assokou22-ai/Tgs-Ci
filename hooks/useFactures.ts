import { useState, useEffect, useCallback } from 'react';
import { Facture } from '../types.ts';
import { dbGetFactures, dbAddFacture, dbUpdateFacture, dbDeleteFacture } from '../services/dbService.ts';

const useFactures = () => {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFactures = useCallback(async () => {
    setLoading(true);
    const storedFactures = await dbGetFactures();
    setFactures(storedFactures.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFactures();
    window.addEventListener('datareceived', fetchFactures);
    return () => {
        window.removeEventListener('datareceived', fetchFactures);
    };
  }, [fetchFactures]);

  const addFacture = useCallback(async (factureData: Omit<Facture, 'id' | 'numero' | 'date' | 'updatedAt'>) => {
    try {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const timestamp = Date.now();
        const randomPart = Math.random().toString(36).substring(2, 7);
        const newFacture: Facture = {
          ...factureData,
          id: `fac-${timestamp}-${randomPart}`,
          date: now.toISOString(),
          updatedAt: now.toISOString(),
          numero: `FAC-${year}${month}-${String(timestamp).slice(-5)}`,
        };
        await dbAddFacture(newFacture);
        fetchFactures();
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Failed to add facture:", error);
        alert("L'ajout de la facture a échoué.");
        throw error;
    }
  }, [fetchFactures]);

  const updateFacture = useCallback(async (facture: Facture) => {
    try {
        const updatedFacture = { ...facture, updatedAt: new Date().toISOString() };
        await dbUpdateFacture(updatedFacture);
        fetchFactures();
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Failed to update facture:", error);
        alert("La modification de la facture a échoué.");
        throw error;
    }
  }, [fetchFactures]);

  const deleteFacture = useCallback(async (factureId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette facture ?")) {
      try {
        await dbDeleteFacture(factureId);
        fetchFactures();
        window.dispatchEvent(new CustomEvent('requestsync'));
      } catch (error) {
          console.error("Failed to delete facture:", error);
          alert("La suppression de la facture a échoué.");
      }
    }
  }, [fetchFactures]);

  return { factures, loading, addFacture, updateFacture, deleteFacture };
};

export default useFactures;