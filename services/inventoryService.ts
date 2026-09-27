// services/inventoryService.ts
import { StockItem, RepairTicket, LigneVenteFiche, MouvementStock, RepairServiceItem } from '../types.ts';
import { dbUpdateStockItem, dbAddMouvementStock, dbGet, dbGetStock } from './dbService.ts';

/**
 * Calcule les prix d'une ligne de vente (prix final, réduction, etc.)
 */
export const calculateLineItemPrices = (
    prix_unitaire_standard: number,
    reduction_active: boolean,
    reduction_type: 'montant' | 'pourcentage' | null,
    reduction_valeur: number,
    quantite: number
) => {
    let prix_unitaire_final = prix_unitaire_standard;

    if (reduction_active && reduction_valeur > 0) {
        if (reduction_type === 'pourcentage') {
            const rVal = Math.min(100, Math.max(0, reduction_valeur));
            prix_unitaire_final = Math.round(prix_unitaire_standard * (1 - rVal / 100));
        } else if (reduction_type === 'montant') {
            const rVal = Math.max(0, reduction_valeur);
            prix_unitaire_final = Math.max(0, prix_unitaire_standard - rVal);
        }
    }

    const total_ligne = prix_unitaire_final * quantite;
    const reduction_totale = (prix_unitaire_standard - prix_unitaire_final) * quantite;

    return {
        prix_unitaire_final,
        total_ligne,
        reduction_totale
    };
};

/**
 * Retourne les articles de stock compatibles triés par disponibilité décroissante
 */
export const getCompatibleStockItems = async (
    macModel: string,
    categoryName: string,
    modelNumber?: string
): Promise<StockItem[]> => {
    try {
        const allItems = await dbGetStock();
        
        // Filtre de compatibilité
        return allItems
            .filter(item => {
                const sameCategory = item.category.toUpperCase() === categoryName.toUpperCase();
                if (!sameCategory || !item.isActive) return false;
                
                // Si pas de modèle spécifié d'article ou modèle "TOUS", compatible
                if (!item.compatibleModels || item.compatibleModels.length === 0) return true;
                
                const normModel = (macModel || '').trim().toUpperCase();
                const normModelNum = (modelNumber || '').trim().toUpperCase();
                return item.compatibleModels.some(model => {
                    const normM = model.trim().toUpperCase();
                    if (normM === 'TOUS' || normM === 'ALL') return true;
                    if (normModel && (normModel === normM || normModel.includes(normM) || normM.includes(normModel))) return true;
                    if (normModelNum && (normModelNum === normM || normModelNum.includes(normM) || normM.includes(normModelNum))) return true;
                    return false;
                });
            })
            .sort((a, b) => {
                // Tri par quantité disponible décroissante, puis par nom
                const qtyA = (a.quantity || 0) - (a.quantite_reservee || 0);
                const qtyB = (b.quantity || 0) - (b.quantite_reservee || 0);
                if (qtyB !== qtyA) return qtyB - qtyA;
                return a.name.localeCompare(b.name, 'fr');
            });
    } catch (error) {
        console.error("Error in getCompatibleStockItems:", error);
        return [];
    }
};

/**
 * Historise un mouvement de stock dans la base locale et synchronisée
 */
export const logStockMovement = async (
    article_stock_id: string,
    fiche_id: string | null,
    type_mouvement: 'reservation' | 'sortie' | 'annulation_reservation' | 'ajustement' | 'entree_achat',
    quantite: number,
    utilisateur: string,
    commentaire?: string,
    designation_article?: string
): Promise<MouvementStock> => {
    const mouvement: MouvementStock = {
        id: `mv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        article_stock_id,
        fiche_id,
        type_mouvement,
        quantite,
        date_mouvement: new Date().toISOString(),
        utilisateur,
        commentaire,
        designation_article
    };
    await dbAddMouvementStock(mouvement);
    return mouvement;
};

/**
 * Gère de manière transactionnelle les changements d'états d'inventaire lors de la modification/création d'une fiche client
 */
export const handleTicketStockTransitions = async (
    oldTicket: RepairTicket | undefined,
    newTicket: RepairTicket,
    activeRole: string
): Promise<void> => {
    const prevLines = oldTicket?.ligneVentes || [];
    const newLines = newTicket.ligneVentes || [];

    // Auto-transition des lignes selon l'état du ticket parent (Terminé/Rendu/Annulé)
    const ticketIsClosed = newTicket.status === 'Terminé' || newTicket.status === 'Rendu';
    const ticketIsCanceled = newTicket.status === 'Annulé' || newTicket.status === 'Non réparable';

    if (ticketIsClosed) {
        newLines.forEach(l => {
            if (l.statut_ligne === 'reserve' || l.statut_ligne === 'prevu') {
                l.statut_ligne = 'utilise';
            }
        });
    } else if (ticketIsCanceled) {
        newLines.forEach(l => {
            if (l.statut_ligne === 'reserve' || l.statut_ligne === 'prevu') {
                l.statut_ligne = 'annule';
            }
        });
    }

    const prevMap = new Map<string, LigneVenteFiche>();
    prevLines.forEach(l => prevMap.set(l.id, l));

    const newMap = new Map<string, LigneVenteFiche>();
    newLines.forEach(l => newMap.set(l.id, l));

    // 1. Gérer les lignes supprimées
    for (const oldL of prevLines) {
        if (!newMap.has(oldL.id)) {
            // Ligne supprimée de la fiche ! Si son état était reservé ou utilisé, on doit restaurer l'inventaire
            if (oldL.type_ligne === 'article_stock' && oldL.article_stock_id) {
                const stockItemDef = await dbGet('stock', oldL.article_stock_id) as unknown as StockItem;
                if (stockItemDef) {
                    const updatedItem = { ...stockItemDef };
                    if (oldL.statut_ligne === 'reserve') {
                        // Annuler réservation
                        updatedItem.quantite_reservee = Math.max(0, (updatedItem.quantite_reservee || 0) - oldL.quantite);
                        
                        await dbUpdateStockItem(updatedItem);
                        await logStockMovement(
                            oldL.article_stock_id,
                            newTicket.id,
                            'annulation_reservation',
                            oldL.quantite,
                            activeRole,
                            `Suppression de la ligne de vente (Fiche #${newTicket.id})`,
                            oldL.designation
                        );
                    } else if (oldL.statut_ligne === 'utilise') {
                        // Sortie de stock annulée
                        updatedItem.quantity = (updatedItem.quantity || 0) + oldL.quantite;
                        
                        await dbUpdateStockItem(updatedItem);
                        await logStockMovement(
                            oldL.article_stock_id,
                            newTicket.id,
                            'ajustement',
                            oldL.quantite,
                            activeRole,
                            `Suppression de l'article utilisé (Fiche #${newTicket.id})`,
                            oldL.designation
                        );
                    }
                }
            }
        }
    }

    // 2. Gérer les lignes ajoutées ou modifiées
    for (const newL of newLines) {
        if (newL.type_ligne !== 'article_stock' || !newL.article_stock_id) {
            continue; // Ignorer les lignes hors stock / prestations
        }

        const oldL = prevMap.get(newL.id);
        const stockItemDef = await dbGet('stock', newL.article_stock_id) as unknown as StockItem;
        if (!stockItemDef) continue;

        const updatedItem = { ...stockItemDef };
        let mustUpdate = false;

        if (!oldL) {
            // AJOUT d'une nouvelle ligne
            if (newL.statut_ligne === 'reserve') {
                updatedItem.quantite_reservee = (updatedItem.quantite_reservee || 0) + newL.quantite;
                mustUpdate = true;
                
                await logStockMovement(
                    newL.article_stock_id,
                    newTicket.id,
                    'reservation',
                    newL.quantite,
                    activeRole,
                    `Réservation pour la fiche #${newTicket.id}`,
                    newL.designation
                );
            } else if (newL.statut_ligne === 'utilise') {
                updatedItem.quantity = Math.max(0, (updatedItem.quantity || 0) - newL.quantite);
                mustUpdate = true;

                await logStockMovement(
                    newL.article_stock_id,
                    newTicket.id,
                    'sortie',
                    newL.quantite,
                    activeRole,
                    `Sortie de stock (Fiche #${newTicket.id})`,
                    newL.designation
                );
            }
        } else {
            // MODIFICATION d'une ligne existante
            const statusChanged = oldL.statut_ligne !== newL.statut_ligne;
            const qtyChanged = oldL.quantite !== newL.quantite;

            if (statusChanged || qtyChanged) {
                // On rembobine d'abord l'effet de l'ancienne ligne
                if (oldL.statut_ligne === 'reserve') {
                    updatedItem.quantite_reservee = Math.max(0, (updatedItem.quantite_reservee || 0) - oldL.quantite);
                } else if (oldL.statut_ligne === 'utilise') {
                    updatedItem.quantity = (updatedItem.quantity || 0) + oldL.quantite;
                }

                // On applique ensuite l'effet de la nouvelle ligne
                if (newL.statut_ligne === 'reserve') {
                    updatedItem.quantite_reservee = (updatedItem.quantite_reservee || 0) + newL.quantite;
                    mustUpdate = true;

                    // Ajout historique de mouvement
                    await logStockMovement(
                        newL.article_stock_id,
                        newTicket.id,
                        'reservation',
                        newL.quantite,
                        activeRole,
                        `Ajustement réservation (Fiche #${newTicket.id})`,
                        newL.designation
                    );
                } else if (newL.statut_ligne === 'utilise') {
                    // C'est une sortie effective (soit depuis réservation soit directe)
                    updatedItem.quantity = Math.max(0, (updatedItem.quantity || 0) - newL.quantite);
                    mustUpdate = true;

                    await logStockMovement(
                        newL.article_stock_id,
                        newTicket.id,
                        'sortie',
                        newL.quantite,
                        activeRole,
                        `Sortie effective (Fiche #${newTicket.id})`,
                        newL.designation
                    );
                } else if (newL.statut_ligne === 'annule' || newL.statut_ligne === 'prevu') {
                    mustUpdate = true;
                    if (oldL.statut_ligne === 'reserve') {
                        await logStockMovement(
                            newL.article_stock_id,
                            newTicket.id,
                            'annulation_reservation',
                            oldL.quantite,
                            activeRole,
                            `Réservation annulée (Fiche #${newTicket.id})`,
                            newL.designation
                        );
                    } else if (oldL.statut_ligne === 'utilise') {
                        await logStockMovement(
                            newL.article_stock_id,
                            newTicket.id,
                            'ajustement',
                            oldL.quantite,
                            activeRole,
                            `Utilisation annulée (Fiche #${newTicket.id})`,
                            newL.designation
                        );
                    }
                }
            }
        }

        if (mustUpdate) {
            await dbUpdateStockItem(updatedItem);
        }
    }
};

/**
 * Synchronise les lignes de vente d'une fiche client vers la liste globale existante 'services'
 * pour une compatibilité à 100% avec les impressions d'invoices / graphiques de performance du reste de l'application.
 */
export const syncSalesLinesToServices = (ligneVentes: LigneVenteFiche[]): RepairServiceItem[] => {
    if (!ligneVentes || ligneVentes.length === 0) return [];
    
    return ligneVentes
        .filter(l => l.statut_ligne !== 'annule')
        .map(l => {
            const hasRemise = l.reduction_active && l.reduction_valeur > 0;
            const detailRemise = hasRemise 
                ? ` [REMISE -${l.reduction_valeur}${l.reduction_type === 'pourcentage' ? '%' : ' FCFA'}]` 
                : '';
            
            return {
                id: l.id,
                updatedAt: new Date().toISOString(),
                // Titre lisible incluant la quantité si > 1
                name: `${l.designation}${l.quantite > 1 ? ` (x${l.quantite})` : ''}${detailRemise}`.toUpperCase(),
                price: l.prix_unitaire_final * l.quantite,
                category: l.categorie
            };
        });
};
