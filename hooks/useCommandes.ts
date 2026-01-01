
import { useState, useEffect, useCallback } from 'react';
import { Commande } from '../types.ts';
import { dbGetCommandes, dbAddCommande, dbUpdateCommande, dbDeleteCommande } from '../services/dbService.ts';

const useCommandes = () => {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommandes = useCallback(async () => {
    setLoading(true);
    const storedCommandes = await dbGetCommandes();
    // Tri robuste : Newest First en utilisant la comparaison de chaînes ISO
    const sorted = [...storedCommandes].sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
    });
    setCommandes(sorted);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCommandes();
    window.addEventListener('datareceived', fetchCommandes);
    return () => {
        window.removeEventListener('datareceived', fetchCommandes);
    };
  }, [fetchCommandes]);

  const addCommande = useCallback(async (commandeData: Omit<Commande, 'id' | 'numero' | 'date' | 'updatedAt'>) => {
    try {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const timestamp = Date.now();
        const randomPart = Math.random().toString(36).substring(2, 7);
        const newCommande: Commande = {
          ...commandeData,
          id: `cmd-${timestamp}-${randomPart}`,
          date: now.toISOString(),
          updatedAt: now.toISOString(),
          numero: `CMD-${year}${month}-${String(timestamp).slice(-5)}`,
        };
        await dbAddCommande(newCommande);
        fetchCommandes();
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Failed to add commande:", error);
        alert("L'ajout de la commande a échoué.");
        throw error;
    }
  }, [fetchCommandes]);

  const updateCommande = useCallback(async (commande: Commande) => {
    try {
        const updatedCommande = { ...commande, updatedAt: new Date().toISOString() };
        await dbUpdateCommande(updatedCommande);
        fetchCommandes();
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Failed to update commande:", error);
        alert("La modification de la commande a échoué.");
        throw error;
    }
  }, [fetchCommandes]);

  const deleteCommande = useCallback(async (commandeId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette commande ?")) {
      try {
        await dbDeleteCommande(commandeId);
        fetchCommandes();
        window.dispatchEvent(new CustomEvent('requestsync'));
      } catch (error) {
        console.error("Failed to delete commande:", error);
        alert("La suppression de la commande a échoué.");
      }
    }
  }, [fetchCommandes]);

  return { commandes, loading, addCommande, updateCommande, deleteCommande };
};

export default useCommandes;
