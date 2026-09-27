import { useState, useEffect, useCallback } from 'react';
import { RepairServiceItem } from '../types.ts';
import { dbGetServices, dbAddService, dbUpdateService, dbDeleteService } from '../services/dbService.ts';
import { useToastContext } from '../context/ToastContext.tsx';

const useServices = () => {
  const { showToast } = useToastContext();
  const [services, setServices] = useState<RepairServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = useCallback(async () => {
    const storedServices = await dbGetServices();
    setServices(storedServices.sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchServices();
    };
    load();
    window.addEventListener('datareceived', fetchServices);
    return () => {
        window.removeEventListener('datareceived', fetchServices);
    };
  }, [fetchServices]);

  const addService = useCallback(async (serviceData: Omit<RepairServiceItem, 'id' | 'updatedAt'>) => {
    const newService: RepairServiceItem = {
      ...serviceData,
      id: `svc-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    try {
        await dbAddService(newService);
        setServices(currentServices => [...currentServices, newService].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
        console.error("Failed to add service:", error);
        showToast("L'ajout a échoué.", "error");
        throw error;
    }
  }, [showToast]);

  const updateService = useCallback(async (service: RepairServiceItem) => {
    const updatedService = { ...service, updatedAt: new Date().toISOString() };
    try {
        await dbUpdateService(updatedService);
        setServices(currentServices =>
          currentServices.map(s => (s.id === updatedService.id ? updatedService : s)).sort((a, b) => a.name.localeCompare(b.name))
        );
    } catch (error) {
        console.error("Failed to update service:", error);
        showToast("La modification a échoué.", "error");
        throw error;
    }
  }, [showToast]);

  const deleteService = useCallback(async (serviceId: string) => {
    try {
        await dbDeleteService(serviceId);
        setServices(currentServices => currentServices.filter(s => s.id !== serviceId));
    } catch (error) {
        console.error("Failed to delete service:", error);
        showToast("La suppression a échoué.", "error");
        throw error;
    }
  }, [showToast]);

  return { services, loading, addService, updateService, deleteService };
};

export default useServices;