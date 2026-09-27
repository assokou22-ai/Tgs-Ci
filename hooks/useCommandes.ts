
import { useState, useEffect, useCallback } from 'react';
import { Commande, Role, HistoryEntry } from '../types.ts';
import { dbGetCommandes, dbAddCommande, dbUpdateCommande, dbDeleteCommande } from '../services/dbService.ts';
import { useToastContext } from '../context/ToastContext.tsx';

const useCommandes = () => {
  const { showToast } = useToastContext();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);

  const getCurrentRole = useCallback((): Role => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam) {
      const roleMap: Record<string, Role> = {
        'accueil': 'Accueil',
        'technicien': 'Technicien',
        'editeur': 'Editeur',
        'factureetcommande': 'Facture et Commande',
        'systeme': 'Système'
      };
      return roleMap[roleParam.toLowerCase()] || 'Système';
    }
    return 'Système';
  }, []);

  const fetchCommandes = useCallback(async () => {
    const storedCommandes = await dbGetCommandes();
    const sorted = [...storedCommandes].sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
    });
    setCommandes(sorted);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchCommandes();
    };
    init();
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

        const role = getCurrentRole();
        const initialHistory: HistoryEntry[] = [
          {
            timestamp: now.toISOString(),
            user: role,
            action: `Création initiale de la commande`
          }
        ];

        const newCommande: Commande = {
          ...commandeData,
          id: `cmd-${timestamp}-${randomPart}`,
          date: now.toISOString(),
          updatedAt: now.toISOString(),
          numero: `CMD-${year}${month}-${String(timestamp).slice(-5)}`,
          history: initialHistory,
        };
        await dbAddCommande(newCommande);
        fetchCommandes();
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Failed to add commande:", error);
        showToast("L'ajout a échoué.", "error");
        throw error;
    }
  }, [fetchCommandes, showToast, getCurrentRole]);

  const updateCommande = useCallback(async (commande: Commande) => {
    try {
        const role = getCurrentRole();
        const updateHistoryEntry: HistoryEntry = {
          timestamp: new Date().toISOString(),
          user: role,
          action: `Modification de la commande (Nouveau Statut : ${commande.status})`
        };

        const updatedCommande = { 
          ...commande, 
          updatedAt: new Date().toISOString(),
          history: [...(commande.history || []), updateHistoryEntry]
        };
        await dbUpdateCommande(updatedCommande);
        fetchCommandes();
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Failed to update commande:", error);
        showToast("La modification a échoué.", "error");
        throw error;
    }
  }, [fetchCommandes, showToast, getCurrentRole]);

  const deleteCommande = useCallback(async (commandeId: string) => {
    try {
      await dbDeleteCommande(commandeId);
      fetchCommandes();
      window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
      console.error("Failed to delete commande:", error);
      showToast("La suppression a échoué.", "error");
    }
  }, [fetchCommandes, showToast]);

  return { commandes, loading, addCommande, updateCommande, deleteCommande };
};

export default useCommandes;
