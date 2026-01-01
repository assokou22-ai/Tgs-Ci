import { useState, useEffect, useCallback } from 'react';
import { StockItem } from '../types.ts';
import { dbGetPaginatedStock, dbAddStockItem, dbUpdateStockItem, dbDeleteStockItem, dbClearStock, bulkPut } from '../services/dbService.ts';

const PAGE_SIZE = 25;

const useStock = () => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStock, setTotalStock] = useState(0);
  const [filter, setFilter] = useState('');

  const totalPages = Math.ceil(totalStock / PAGE_SIZE);

  const fetchStock = useCallback(async (page: number, query: string) => {
    setLoading(true);
    setError(null);
    try {
        const { items, totalCount } = await dbGetPaginatedStock({ query, page, pageSize: PAGE_SIZE });
        setStock(items);
        setTotalStock(totalCount);
    } catch(e) {
        console.error("Failed to fetch paginated stock:", e);
        setError("Impossible de charger le stock.");
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStock(currentPage, filter);
  }, [currentPage, filter, fetchStock]);

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
        fetchStock(currentPage, filter); // Refetch to see the new item
    } catch (error) {
        console.error("Failed to add stock item:", error);
        alert("L'ajout de l'article a échoué.");
        throw error;
    }
  }, [currentPage, filter, fetchStock]);

  const updateStockItem = useCallback(async (item: StockItem) => {
    try {
        const updatedItem = { ...item, updatedAt: new Date().toISOString() };
        await dbUpdateStockItem(updatedItem);
        fetchStock(currentPage, filter); // Refetch to see changes
    } catch (error) {
        console.error("Failed to update stock item:", error);
        alert("La modification de l'article a échoué.");
        throw error;
    }
  }, [currentPage, filter, fetchStock]);

  const deleteStockItem = useCallback(async (itemId: string): Promise<boolean> => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet article du stock ?")) {
      try {
        await dbDeleteStockItem(itemId);
        // If the last item on a page is deleted, go to the previous page
        if (stock.length === 1 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
        } else {
            fetchStock(currentPage, filter);
        }
        return true;
      } catch (error) {
          console.error("Failed to delete stock item:", error);
          alert("La suppression de l'article a échoué.");
          return false;
      }
    }
    return false;
  }, [stock.length, currentPage, filter, fetchStock]);

  const setFullStock = useCallback(async (newStock: StockItem[]) => {
      await dbClearStock();
      await bulkPut('stock', newStock);
      setCurrentPage(1); // Reset to first page
      setFilter('');
      fetchStock(1, '');
  }, [fetchStock]);

  return { 
      stock, 
      loading, 
      error,
      addStockItem, 
      updateStockItem, 
      deleteStockItem, 
      setFullStock,
      // Pagination props
      currentPage,
      totalPages,
      goToPage,
      setFilter,
      totalStock
  };
};

export default useStock;