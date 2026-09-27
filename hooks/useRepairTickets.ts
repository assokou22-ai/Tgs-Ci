
import { useState, useEffect, useCallback } from 'react';
import { RepairTicket, Role } from '../types.ts';
import { 
    dbGetTickets, 
    dbAddTicket, 
    dbUpdateTicket, 
    dbDeleteTicket, 
    dbBulkPutTickets, 
    dbGet,
    dbGetAppointments,
    dbUpdateAppointment,
    dbGetEngagementsSav,
    dbUpdateEngagementSav,
    dbGetCommandes,
    dbUpdateCommande
} from '../services/dbService.ts';
import { sanitizeTicket, sanitizeTickets } from '../utils/sanitize.ts';
import { generateNextTicketSequence, isFallbackTicketId, extractTicketSequenceNumber } from '../utils/idGenerator.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { useAppSettings } from './useAppSettings.ts';
import { createGoogleContactFromRepairTicket } from '../services/googleContactsService.ts';
import { handleTicketStockTransitions } from '../services/inventoryService.ts';
import { optimizeTicketForFirestore } from '../utils/imageCompression.ts';


const useRepairTickets = (enabled = true) => {
  const { showToast } = useToastContext();
  const { googleAccessToken } = useFirebase();
  const { settings } = useAppSettings();
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTickets = useCallback(async () => {
    setError(null);
    try {
        const storedTickets = await dbGetTickets();

        // Réconciliation automatique sécurisée pour l'incident RM-fallback-1789484260343
        const fallbackTarget = storedTickets.find(
          t => t.id === 'RM-fallback-1789484260343' || t.id === 'RM-FALLBACK-1789484260343'
        );
        if (fallbackTarget && !storedTickets.some(t => t.id === '26-RM-0672')) {
          console.log("[Migration] Rattrapage automatique de RM-fallback-1789484260343 vers 26-RM-0672");
          const correctedTicket: RepairTicket = {
            ...fallbackTarget,
            id: '26-RM-0672',
            updatedAt: new Date().toISOString(),
            history: [
              ...(fallbackTarget.history || []),
              {
                timestamp: new Date().toISOString(),
                user: 'Système',
                action: "Correction automatique de l'identifiant erroné RM-fallback-1789484260343 vers le numéro officiel 26-RM-0672."
              }
            ]
          };
          await dbDeleteTicket(fallbackTarget.id);
          await dbUpdateTicket(correctedTicket);

          // Propagation aux liaisons dépendantes
          try {
            const [appointments, engagementsSav, commandes] = await Promise.all([
              dbGetAppointments().catch(() => []),
              dbGetEngagementsSav().catch(() => []),
              dbGetCommandes().catch(() => [])
            ]);
            for (const appt of appointments) {
              if (appt.ticketId === fallbackTarget.id) {
                await dbUpdateAppointment({ ...appt, ticketId: '26-RM-0672' });
              }
            }
            for (const eng of engagementsSav) {
              if (eng.numeroFicheOrigine === fallbackTarget.id) {
                await dbUpdateEngagementSav({ ...eng, numeroFicheOrigine: '26-RM-0672' });
              }
            }
            for (const cmd of commandes) {
              if (cmd.linkedTicketId === fallbackTarget.id) {
                await dbUpdateCommande({ ...cmd, linkedTicketId: '26-RM-0672' });
              }
            }
          } catch (cascadeErr) {
            console.warn("Cascade error on auto-reconciliation:", cascadeErr);
          }

          // Remplacement direct dans la liste locale
          const idx = storedTickets.findIndex(t => t.id === fallbackTarget.id);
          if (idx !== -1) storedTickets[idx] = correctedTicket;

          // Mise à jour de l'URL si l'utilisateur consultait ce ticket
          if (typeof window !== 'undefined' && window.location.search.includes('RM-fallback-1789484260343')) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('ticketId', '26-RM-0672');
            window.history.replaceState({}, '', newUrl);
          }
        }

        const sanitizedTickets = sanitizeTickets(storedTickets);
        const sortedTickets = sanitizedTickets.sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          if (timeA !== timeB) return timeB - timeA;
          const numA = extractTicketSequenceNumber(a.id) ?? 0;
          const numB = extractTicketSequenceNumber(b.id) ?? 0;
          if (numA !== numB) return numB - numA;
          return b.id.localeCompare(a.id, 'fr', { numeric: true });
        });
        setTickets(sortedTickets);
    } catch (e) {
        console.error("Failed to load tickets from database:", e);
        setError("Erreur de base de données locale.");
    }
  }, []);
  
    useEffect(() => {
        const init = async () => {
            if (enabled) {
                await refreshTickets();
                setLoading(false);
            }
        };
        init();
        
        window.addEventListener('datareceived', refreshTickets);
        return () => window.removeEventListener('datareceived', refreshTickets);
    }, [refreshTickets, enabled]);

  const regroupOlderTicketsForTechnician = useCallback(async (currentTicket: RepairTicket) => {
    if (currentTicket.client?.clientType !== 'subcontractor' || !currentTicket.client?.technicianName) {
      return;
    }

    const techName = currentTicket.client.technicianName.trim().toUpperCase();
    const techPhone = currentTicket.client.technicianPhone?.trim() || '';

    try {
        const allTickets = await dbGetTickets();
        const updatedTickets: RepairTicket[] = [];

        allTickets.forEach(t => {
            if (t.id === currentTicket.id) return;

            const isAlreadyFullySet = t.client?.clientType === 'subcontractor' && 
                                      t.client?.technicianName?.trim().toUpperCase() === techName &&
                                      t.client?.technicianPhone?.trim() === techPhone;

            if (isAlreadyFullySet) return;

            let isMatch = false;

            const tClientName = t.client?.name?.trim().toUpperCase() || '';
            const tClientFirstName = t.client?.firstName?.trim().toUpperCase() || '';
            const tClientCompany = t.client?.company?.trim().toUpperCase() || '';
            const tTechName = t.client?.technicianName?.trim().toUpperCase() || '';

            if (techName) {
                if (tTechName === techName) {
                    isMatch = true;
                } else if (tClientName === techName || tClientFirstName === techName || tClientCompany === techName) {
                    isMatch = true;
                }
            }

            const tPhone = t.client?.phone?.trim() || '';
            const tTelephone = t.client?.telephone?.trim() || '';
            const tTechPhone = t.client?.technicianPhone?.trim() || '';

            if (techPhone) {
                if (tPhone === techPhone || tTelephone === techPhone || tTechPhone === techPhone) {
                    isMatch = true;
                }
            }

            if (isMatch) {
                const updatedTicket: RepairTicket = {
                    ...t,
                    client: {
                        ...t.client,
                        clientType: 'subcontractor',
                        technicianName: currentTicket.client?.technicianName || t.client?.technicianName || techName,
                        technicianPhone: techPhone || t.client?.technicianPhone || t.client?.phone || t.client?.telephone || '',
                        finalClientName: t.client?.finalClientName || 
                                         (tClientName !== techName ? t.client?.name : '')
                    },
                    updatedAt: new Date().toISOString(),
                    history: [
                        ...(t.history || []),
                        {
                            timestamp: new Date().toISOString(),
                            user: 'Système',
                            action: `Regroupement automatique intelligent : Fiche associée au technicien partenaire "${currentTicket.client?.technicianName}".`
                        }
                    ]
                };
                updatedTickets.push(updatedTicket);
            }
        });

        if (updatedTickets.length > 0) {
            await dbBulkPutTickets(updatedTickets);
            showToast(`${updatedTickets.length} ancienne(s) fiches(s) regroupée(s) intelligemment sous le technicien ${currentTicket.client.technicianName} !`, "success");
        }
    } catch (e) {
        console.error("Failed to auto-group older tickets:", e);
    }
  }, [showToast]);

  const addTicket = useCallback(async (ticket: Partial<RepairTicket>, role: Role): Promise<RepairTicket> => {
    if (role === 'Facture et Commande') {
        throw new Error(`Rôle non autorisé.`);
    }

    // Récupérer les tickets existants pour garantir un ID séquentiel officiel unique
    const existingTickets = await dbGetTickets();
    const isEnterprise = Boolean(ticket.client?.isEnterprise);

    let cleanId = (ticket.id || '').trim().toUpperCase();
    if (!cleanId || isFallbackTicketId(cleanId) || existingTickets.some(t => t.id === cleanId)) {
        const targetYear = ticket.createdAt ? new Date(ticket.createdAt).getFullYear() : undefined;
        cleanId = generateNextTicketSequence(existingTickets, isEnterprise, targetYear);
    }

    const ticketWithCleanId = {
        ...ticket,
        id: cleanId
    };

    const sanitizedTicket = sanitizeTicket(ticketWithCleanId);
    const now = new Date().toISOString();
    
    // On utilise la date de création fournie (saisie manuelle) ou maintenant
    const depositDate = sanitizedTicket.createdAt || now;

    const newTicket: RepairTicket = {
      ...sanitizedTicket,
      createdAt: depositDate,
      updatedAt: now,
      history: [
        { 
            timestamp: now, 
            user: role, 
            action: `Ouverture du dossier officiel #${cleanId} (Dépôt effectif déclaré au ${new Date(depositDate).toLocaleDateString('fr-FR')}).` 
        },
        ...(sanitizedTicket.history || []),
      ],
    };

    const compressedTicket = await optimizeTicketForFirestore(newTicket);

    try {
        await handleTicketStockTransitions(undefined, compressedTicket, role);
    } catch (invError) {
        console.error("Failed to transition stock on ticket addition:", invError);
        showToast("Attention: Erreur lors de la réservation de stock liée à cette fiche.", "warning");
    }

    await dbAddTicket(compressedTicket);
    if (compressedTicket.client?.clientType === 'subcontractor' && compressedTicket.client?.technicianName) {
        await regroupOlderTicketsForTechnician(compressedTicket);
    }
    await refreshTickets();
    window.dispatchEvent(new CustomEvent('requestsync'));

    // Synchronisation facultative vers Google Contacts
    if (settings.forms.autoCreateGoogleContact) {
        if (!googleAccessToken) {
            showToast("Fiche enregistrée, contact Google non synchronisé (non connecté).", "warning");
        } else {
            (async () => {
                try {
                    const res = await createGoogleContactFromRepairTicket(compressedTicket, googleAccessToken);
                    if (res.success) {
                        showToast(`Fiche enregistrée. ${res.message}`, "success");
                    } else {
                        console.warn("[Google Contacts Sync] Failed:", res.message);
                        showToast("Fiche enregistrée, contact Google non synchronisé.", "warning");
                    }
                } catch (err) {
                    console.error("[Google Contacts Sync] Erreur inattendue:", err);
                    showToast("Fiche enregistrée, contact Google non synchronisé.", "warning");
                }
            })();
        }
    }

    return compressedTicket;
  }, [refreshTickets, googleAccessToken, showToast, settings.forms.autoCreateGoogleContact, regroupOlderTicketsForTechnician]);

  const updateTicket = useCallback(async (updatedTicket: RepairTicket, oldId?: string, role?: Role) => {
    // Force set the updatedAt timestamp to current time to ensure real-time merge latest-wins works correctly on other devices
    const ticketWithTimestamp = { ...updatedTicket, updatedAt: new Date().toISOString() };
    const sanitizedTicket = sanitizeTicket(ticketWithTimestamp);
    const compressedTicket = await optimizeTicketForFirestore(sanitizedTicket);
    
    // Auto-déterminer le rôle actif depuis les paramètres de l'URL si non spécifié
    let activeRole: Role = role || 'Administrateur';
    if (!role && typeof window !== 'undefined') {
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
            activeRole = roleMap[roleParam.toLowerCase()] || 'Administrateur';
        }
    }

    try {
        const targetId = oldId || compressedTicket.id;
        const oldTicket = await dbGet('tickets', targetId) as unknown as RepairTicket || undefined;

        try {
            await handleTicketStockTransitions(oldTicket, compressedTicket, activeRole);
        } catch (invError) {
            console.error("Failed to transition stock on ticket update:", invError);
            showToast("Attention: Erreur de mise à jour des stocks liée à cette fiche.", "warning");
        }

        if (oldId && oldId !== compressedTicket.id) {
            const existing = await dbGetTickets();
            if (existing.some(t => t.id === compressedTicket.id)) {
                showToast(`Conflit : Le numéro ${compressedTicket.id} est déjà utilisé.`, "error");
                return;
            }
            await dbDeleteTicket(oldId);

            // Mettre à jour les références dépendantes (rendez-vous, engagements SAV, commandes)
            try {
                const [appointments, engagementsSav, commandes] = await Promise.all([
                    dbGetAppointments().catch(() => []),
                    dbGetEngagementsSav().catch(() => []),
                    dbGetCommandes().catch(() => [])
                ]);

                for (const appt of appointments) {
                    if (appt.ticketId === oldId) {
                        await dbUpdateAppointment({ ...appt, ticketId: compressedTicket.id });
                    }
                }

                for (const eng of engagementsSav) {
                    if (eng.numeroFicheOrigine === oldId) {
                        await dbUpdateEngagementSav({ ...eng, numeroFicheOrigine: compressedTicket.id });
                    }
                }

                for (const cmd of commandes) {
                    if (cmd.linkedTicketId === oldId) {
                        await dbUpdateCommande({ ...cmd, linkedTicketId: compressedTicket.id });
                    }
                }
            } catch (refErr) {
                console.warn("Could not cascade ticket ID update to linked records:", refErr);
            }
        }
        
        await dbUpdateTicket(compressedTicket);
        if (compressedTicket.client?.clientType === 'subcontractor' && compressedTicket.client?.technicianName) {
            await regroupOlderTicketsForTechnician(compressedTicket);
        }
        await refreshTickets();
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Update failed:", error);
        showToast(`Erreur lors de la mise à jour.`, "error");
        throw error;
    }
  }, [refreshTickets, showToast, regroupOlderTicketsForTechnician]);

  const bulkUpdateTickets = useCallback(async (ticketsToUpdate: RepairTicket[]) => {
    try {
        await dbBulkPutTickets(ticketsToUpdate);
        await refreshTickets();
        window.dispatchEvent(new CustomEvent('requestsync'));
    } catch (error) {
        console.error("Bulk update failed:", error);
        showToast("Échec de la mise à jour groupée.", "error");
        throw error;
    }
  }, [refreshTickets, showToast]);
  
  const deleteTicket = useCallback(async (ticketId: string) => {
    try {
      const oldTicket = await dbGet('tickets', ticketId) as unknown as RepairTicket || undefined;
      if (oldTicket) {
          try {
              // Transitionner vers zéro lignes pour libérer l'inventaire
              await handleTicketStockTransitions(oldTicket, { ...oldTicket, ligneVentes: [] }, 'Administrateur');
          } catch (invError) {
              console.error("Failed to release stock on file deletion:", invError);
          }
      }

      await dbDeleteTicket(ticketId);
      await refreshTickets();
      window.dispatchEvent(new CustomEvent('requestsync'));
      showToast("Dossier supprimé.", "success");
    } catch (error) {
        console.error("Delete failed:", error);
        showToast("Échec de la suppression.", "error");
        throw error;
    }
  }, [refreshTickets, showToast]);

  return { tickets, addTicket, updateTicket, deleteTicket, loading, error, refreshTickets, bulkUpdateTickets };
};

export default useRepairTickets;
