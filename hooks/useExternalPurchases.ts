
import { useState, useEffect, useCallback } from 'react';
import { ExternalPurchase } from '../types.ts';
import { dbGetExternalPurchases, dbAddExternalPurchase, dbDeleteExternalPurchase } from '../services/dbService.ts';

const useExternalPurchases = () => {
    const [purchases, setPurchases] = useState<ExternalPurchase[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPurchases = useCallback(async () => {
        setLoading(true);
        try {
            const data = await dbGetExternalPurchases();
            setPurchases(data.sort((a, b) => b.date.localeCompare(a.date)));
        } catch (error) {
            console.error("External purchase fetch failed:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPurchases();
        window.addEventListener('datareceived', fetchPurchases);
        return () => window.removeEventListener('datareceived', fetchPurchases);
    }, [fetchPurchases]);

    const addPurchase = useCallback(async (data: Omit<ExternalPurchase, 'id'>) => {
        const newPurchase: ExternalPurchase = {
            ...data,
            id: `ext-${Date.now()}`
        };
        await dbAddExternalPurchase(newPurchase);
        fetchPurchases();
        window.dispatchEvent(new CustomEvent('requestsync'));
        return newPurchase;
    }, [fetchPurchases]);

    const deletePurchase = useCallback(async (id: string) => {
        await dbDeleteExternalPurchase(id);
        fetchPurchases();
        window.dispatchEvent(new CustomEvent('requestsync'));
    }, [fetchPurchases]);

    return { purchases, loading, addPurchase, deletePurchase };
};

export default useExternalPurchases;
