
import { useState, useEffect, useCallback } from 'react';
import { RepairTicket, Role, RepairStatus } from '../types.ts';
import { dbGetTickets, dbAddTicket, dbUpdateTicket, dbDeleteTicket, dbBulkPutTickets } from '../services/dbService.ts';
import { sanitizeTicket, sanitizeTickets } from '../utils/sanitize.ts';

const useRepairTickets = (enabled = true) => {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTickets = useCallback(async () => {
    setError(null);
    try {
        const storedTickets = await dbGetTickets();
        const sanitizedTickets = sanitizeTickets(storedTickets);
        const sortedTickets = sanitizedTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTickets(sortedTickets);
    } catch (e) {
        console.error("Failed to load tickets from database:", e);
        setError("Erreur de base de données locale.");
    }
  }, []);
  
  useEffect(() => {
    if (enabled) {
        setLoading(true);
        refreshTickets().finally(() => setLoading(false));
    }
  }, [refreshTickets, enabled]);

  const addTicket = useCallback(async (ticket: Partial<RepairTicket>, role: Role): Promise<RepairTicket> => {
    if (role === 'Facture et Commande') {
        throw new Error(`Rôle non autorisé.`);
    }

    const sanitizedTicket = sanitizeTicket(ticket);
    const newTicket: RepairTicket = {
      ...sanitizedTicket,
      createdAt: sanitizedTicket.createdAt || new Date().toISOString(),
      history: [
        { timestamp: new Date().toISOString(), user: role, action: 'Ouverture du dossier.' },
        ...(sanitizedTicket.history || []),
      ],
    };

    await dbAddTicket(newTicket);
    await refreshTickets();
    window.dispatchEvent(new CustomEvent('requestsync'));
    return newTicket;
  }, [refreshTickets]);

  const updateTicket = useCallback(async (updatedTicket: RepairTicket, oldId?: string) => {
    const sanitizedTicket = sanitizeTicket(updatedTicket);
    try {
        if (oldId && oldId !== sanitizedTicket.id) {
            const existing = await dbGetTickets();
            if (existing.some(t => t.id === sanitizedTicket.id)) {
                alert(`Conflit : Le numéro ${sanitizedTicket.id} est déjà utilisé.`);
                return;
            }
            await dbDeleteTicket(oldId);
        }
        
        await dbUpdateTicket(sanitizedTicket);
        await refreshTickets();
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Update failed:", error);
        alert(`Erreur lors de la mise à jour.`);
        throw error;
    }
  }, [refreshTickets]);

  const bulkUpdateTickets = useCallback(async (ticketsToUpdate: RepairTicket[]) => {
    try {
        await dbBulkPutTickets(ticketsToUpdate);
        await refreshTickets();
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Bulk update failed:", error);
        throw error;
    }
  }, [refreshTickets]);
  
  const deleteTicket = useCallback(async (ticketId: string) => {
    try {
      await dbDeleteTicket(ticketId);
      await refreshTickets();
      window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Delete failed:", error);
        throw error;
    }
  }, [refreshTickets]);

  return { tickets, addTicket, updateTicket, deleteTicket, loading, error, refreshTickets, bulkUpdateTickets };
};

export default useRepairTickets;
