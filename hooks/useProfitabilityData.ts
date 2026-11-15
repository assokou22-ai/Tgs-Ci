import { useState, useEffect, useCallback, useMemo } from 'react';
import { StockItem, StockUsage, ExternalPurchase, Commande, Facture } from '../types.ts';
import {
    dbGetStock,
    dbGetStockUsage,
    dbGetExternalPurchases,
    dbGetCommandes,
    dbGetFactures,
} from '../services/dbService.ts';

/**
 * Charge en lecture seule locale (IndexedDB) tout le catalogue stock,
 * les prélèvements stock, les achats confrères, les commandes et factures
 * pour calculer la rentabilité et la trésorerie sans aucune lecture Firestore supplémentaire.
 */
export const useProfitabilityData = () => {
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [stockUsages, setStockUsages] = useState<StockUsage[]>([]);
    const [externalPurchases, setExternalPurchases] = useState<ExternalPurchase[]>([]);
    const [commandes, setCommandes] = useState<Commande[]>([]);
    const [factures, setFactures] = useState<Facture[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const [allStock, allUsages, allPurchases, allCommandes, allFactures] = await Promise.all([
                dbGetStock().catch(() => []),
                dbGetStockUsage().catch(() => []),
                dbGetExternalPurchases().catch(() => []),
                dbGetCommandes().catch(() => []),
                dbGetFactures().catch(() => []),
            ]);
            setStockItems(Array.isArray(allStock) ? allStock : []);
            setStockUsages(Array.isArray(allUsages) ? allUsages : []);
            setExternalPurchases(Array.isArray(allPurchases) ? allPurchases : []);
            setCommandes(Array.isArray(allCommandes) ? allCommandes : []);
            setFactures(Array.isArray(allFactures) ? allFactures : []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        const handleRefresh = () => {
            loadData();
        };
        window.addEventListener('datareceived', handleRefresh);
        window.addEventListener('datachanged', handleRefresh);
        window.addEventListener('tickets-updated', handleRefresh);
        return () => {
            window.removeEventListener('datareceived', handleRefresh);
            window.removeEventListener('datachanged', handleRefresh);
            window.removeEventListener('tickets-updated', handleRefresh);
        };
    }, [loadData]);

    const stockMap = useMemo(() => {
        const map = new Map<string, StockItem>();
        stockItems.forEach((item) => {
            if (item && item.id) {
                map.set(item.id, item);
            }
        });
        return map;
    }, [stockItems]);

    return {
        stockItems,
        stockMap,
        stockUsages,
        externalPurchases,
        commandes,
        factures,
        loading,
        reload: loadData,
    };
};

export default useProfitabilityData;
