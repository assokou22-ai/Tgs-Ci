
import { useState, useEffect, useCallback } from 'react';
import { StockItem, StockUsage } from '../types.ts';
import { 
    dbGetPaginatedStock, dbAddStockItem, dbUpdateStockItem, dbDeleteStockItem, 
    bulkPut, dbGetStockUsage, dbAddStockUsage, dbGet
} from '../services/dbService.ts';

const PAGE_SIZE = 25;

const useStock = () => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStock, setTotalStock] = useState(0);
  const [filter, setFilter] = useState('');

  const totalPages = Math.ceil(totalStock / PAGE_SIZE);

  const fetchStock = useCallback(async (page: number, query: string) => {
    setError(null);
    try {
        const { items, totalCount } = await dbGetPaginatedStock({ query, page, pageSize: PAGE_SIZE });
        setStock(items);
        setTotalStock(totalCount);
        
        const usageData = await dbGetStockUsage();
        setMovements(usageData.sort((a,b) => b.date.localeCompare(a.date)));
    } catch(e) {
        console.error("Failed to fetch stock data:", e);
        setError("Impossible de charger les données d'inventaire.");
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStock(currentPage, filter);
  }, [currentPage, filter, fetchStock]);

  useEffect(() => {
    const handleData = () => fetchStock(currentPage, filter);
    window.addEventListener('datareceived', handleData);
    return () => window.removeEventListener('datareceived', handleData);
  }, [fetchStock, currentPage, filter]);

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const addStockItem = useCallback(async (itemData: Omit<StockItem, 'id' | 'updatedAt'>) => {
    try {
        const newItem: StockItem = {
          ...itemData,
          id: `stk-${Date.now()}`,
          updatedAt: new Date().toISOString(),
        };
        await dbAddStockItem(newItem);
        fetchStock(currentPage, filter);
    } catch (error) {
        console.error("Failed to add stock item:", error);
        throw error;
    }
  }, [currentPage, filter, fetchStock]);

  const updateStockItem = useCallback(async (item: StockItem) => {
    try {
        const updatedItem = { ...item, updatedAt: new Date().toISOString() };
        await dbUpdateStockItem(updatedItem);
        fetchStock(currentPage, filter);
    } catch (error) {
        console.error("Failed to update stock item:", error);
        throw error;
    }
  }, [currentPage, filter, fetchStock]);

  const consumeStock = useCallback(async (usage: Omit<StockUsage, 'id'>, force: boolean = false) => {
      try {
          const item = await dbGet('stock', usage.stock_id) as StockItem;
          if (!item) throw new Error("Pièce introuvable en stock");
          
          if (item.quantity < usage.quantite_utilisee && !force) {
              return { success: false, lowStock: true, currentQuantity: item.quantity };
          }

          const newUsage: StockUsage = {
              ...usage,
              id: `use-${Date.now()}`,
              stockName: item.name
          };

          const updatedItem = {
              ...item,
              quantity: item.quantity - usage.quantite_utilisee,
              updatedAt: new Date().toISOString()
          };

          await dbAddStockUsage(newUsage);
          await dbUpdateStockItem(updatedItem);
          fetchStock(currentPage, filter);
          return { success: true };
      } catch (err) {
          console.error("Stock consumption error:", err);
          return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
      }
  }, [currentPage, filter, fetchStock]);

  const deleteStockItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      await dbDeleteStockItem(itemId);
      fetchStock(currentPage, filter);
      return true;
    } catch (error) {
        console.error("Failed to delete stock item:", error);
        return false;
    }
  }, [fetchStock, currentPage, filter]);

  const setFullStock = useCallback(async (newStock: StockItem[]) => {
      await bulkPut('stock', newStock);
      fetchStock(1, '');
  }, [fetchStock]);

  return { 
      stock, 
      movements,
      loading, 
      error,
      addStockItem, 
      updateStockItem, 
      consumeStock,
      deleteStockItem, 
      setFullStock,
      currentPage,
      totalPages,
      goToPage,
      setFilter,
      totalStock
  };
};

export default useStock;
