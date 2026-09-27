
import { useState, useEffect, useCallback } from 'react';
import { Facture, Role, HistoryEntry } from '../types.ts';
import { dbGetFactures, dbAddFacture, dbUpdateFacture, dbDeleteFacture } from '../services/dbService.ts';
import { useToastContext } from '../context/ToastContext.tsx';

const useFactures = () => {
  const { showToast } = useToastContext();
  const [factures, setFactures] = useState<Facture[]>([]);
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

  const fetchFactures = useCallback(async () => {
    const storedFactures = await dbGetFactures();
    setFactures(storedFactures.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchFactures();
    };
    init();
    window.addEventListener('datareceived', fetchFactures);
    return () => {
        window.removeEventListener('datareceived', fetchFactures);
    };
  }, [fetchFactures]);

  const addFacture = useCallback(async (factureData: Omit<Facture, 'id' | 'numero' | 'date' | 'updatedAt'>): Promise<Facture> => {
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
            action: `Création initiale de la facture`
          }
        ];

        const newFacture: Facture = {
          ...factureData,
          id: `fac-${timestamp}-${randomPart}`,
          date: now.toISOString(),
          updatedAt: now.toISOString(),
          numero: `FAC-${year}${month}-${String(timestamp).slice(-5)}`,
          history: initialHistory,
        };
        await dbAddFacture(newFacture);
        fetchFactures();
        window.dispatchEvent(new CustomEvent('requestsync'));
        return newFacture;
    } catch (error) {
        console.error("Failed to add facture:", error);
        showToast("L'ajout a échoué.", "error");
        throw error;
    }
  }, [fetchFactures, showToast, getCurrentRole]);

  const updateFacture = useCallback(async (facture: Facture) => {
    try {
        const role = getCurrentRole();
        const updateHistoryEntry: HistoryEntry = {
          timestamp: new Date().toISOString(),
          user: role,
          action: `Modification de la facture (Nouveau Statut : ${facture.status})`
        };

        const updatedFacture = { 
          ...facture, 
          updatedAt: new Date().toISOString(),
          history: [...(facture.history || []), updateHistoryEntry]
        };
        await dbUpdateFacture(updatedFacture);
        fetchFactures();
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Failed to update facture:", error);
        showToast("La modification a échoué.", "error");
        throw error;
    }
  }, [fetchFactures, showToast, getCurrentRole]);

  const deleteFacture = useCallback(async (factureId: string) => {
    try {
      await dbDeleteFacture(factureId);
      fetchFactures();
      window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Failed to delete facture:", error);
        showToast("La suppression a échoué.", "error");
    }
  }, [fetchFactures, showToast]);

  return { factures, loading, addFacture, updateFacture, deleteFacture };
};

export default useFactures;
