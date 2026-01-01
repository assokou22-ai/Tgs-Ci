import { useState, useEffect, useCallback } from 'react';
import { SimpleDocument } from '../types.ts';
import { dbGetSimpleDocuments, dbAddSimpleDocument, dbUpdateSimpleDocument, dbDeleteSimpleDocument } from '../services/dbService.ts';

const useSimpleDocuments = () => {
  const [documents, setDocuments] = useState<SimpleDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await dbGetSimpleDocuments();
      setDocuments(stored.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    window.addEventListener('datareceived', fetchDocuments);
    return () => window.removeEventListener('datareceived', fetchDocuments);
  }, [fetchDocuments]);

  const addDocument = useCallback(async (docData: Omit<SimpleDocument, 'id' | 'updatedAt'>) => {
    const newDoc: SimpleDocument = {
      ...docData,
      id: `doc-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    await dbAddSimpleDocument(newDoc);
    await fetchDocuments();
    window.dispatchEvent(new CustomEvent('requestsync'));
    return newDoc;
  }, [fetchDocuments]);

  const updateDocument = useCallback(async (doc: SimpleDocument) => {
    const updatedDoc = { ...doc, updatedAt: new Date().toISOString() };
    await dbUpdateSimpleDocument(updatedDoc);
    await fetchDocuments();
    window.dispatchEvent(new CustomEvent('requestsync'));
  }, [fetchDocuments]);

  const deleteDocument = useCallback(async (id: string) => {
    if (window.confirm("Supprimer ce document définitivement ?")) {
      await dbDeleteSimpleDocument(id);
      await fetchDocuments();
      window.dispatchEvent(new CustomEvent('requestsync'));
    }
  }, [fetchDocuments]);

  return { documents, loading, addDocument, updateDocument, deleteDocument, refresh: fetchDocuments };
};

export default useSimpleDocuments;