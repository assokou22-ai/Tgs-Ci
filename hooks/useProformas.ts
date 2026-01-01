import { useState, useEffect, useCallback } from 'react';
import { Proforma } from '../types.ts';
import { dbGetProformas, dbAddProforma, dbUpdateProforma, dbDeleteProforma } from '../services/dbService.ts';

const useProformas = () => {
  const [proformas, setProformas] = useState<Proforma[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProformas = useCallback(async () => {
    setLoading(true);
    const storedProformas = await dbGetProformas();
    setProformas(storedProformas.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProformas();
    window.addEventListener('datareceived', fetchProformas);
    return () => {
        window.removeEventListener('datareceived', fetchProformas);
    };
  }, [fetchProformas]);

  const addProforma = useCallback(async (proformaData: Omit<Proforma, 'id' | 'numero' | 'date' | 'updatedAt'>) => {
    try {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const timestamp = Date.now();
        const randomPart = Math.random().toString(36).substring(2, 7);
        const newProforma: Proforma = {
          ...proformaData,
          id: `pro-${timestamp}-${randomPart}`,
          date: now.toISOString(),
          updatedAt: now.toISOString(),
          numero: `PRO-${year}${month}-${String(timestamp).slice(-5)}`,
        };
        await dbAddProforma(newProforma);
        fetchProformas();
    } catch (error) {
        console.error("Failed to add proforma:", error);
        alert("L'ajout de la proforma a échoué.");
        throw error;
    }
  }, [fetchProformas]);

  const updateProforma = useCallback(async (proforma: Proforma) => {
    try {
        const updatedProforma = { ...proforma, updatedAt: new Date().toISOString() };
        await dbUpdateProforma(updatedProforma);
        fetchProformas();
    } catch (error) {
        console.error("Failed to update proforma:", error);
        alert("La modification de la proforma a échoué.");
        throw error;
    }
  }, [fetchProformas]);

  const deleteProforma = useCallback(async (proformaId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette proforma ?")) {
      try {
        await dbDeleteProforma(proformaId);
        fetchProformas();
      } catch (error) {
          console.error("Failed to delete proforma:", error);
          alert("La suppression de la proforma a échoué.");
      }
    }
  }, [fetchProformas]);

  return { proformas, loading, addProforma, updateProforma, deleteProforma };
};

export default useProformas;