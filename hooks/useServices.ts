import { useState, useEffect, useCallback } from 'react';
import { RepairServiceItem } from '../types.ts';
import { dbGetServices, dbAddService, dbUpdateService, dbDeleteService } from '../services/dbService.ts';

const useServices = () => {
  const [services, setServices] = useState<RepairServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    const storedServices = await dbGetServices();
    setServices(storedServices.sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchServices();
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
        alert("L'ajout du service a échoué.");
        throw error;
    }
  }, []);

  const updateService = useCallback(async (service: RepairServiceItem) => {
    const updatedService = { ...service, updatedAt: new Date().toISOString() };
    try {
        await dbUpdateService(updatedService);
        setServices(currentServices =>
          currentServices.map(s => (s.id === updatedService.id ? updatedService : s)).sort((a, b) => a.name.localeCompare(b.name))
        );
    } catch (error) {
        console.error("Failed to update service:", error);
        alert("La modification du service a échoué.");
        throw error;
    }
  }, []);

  const deleteService = useCallback(async (serviceId: string) => {
    try {
        await dbDeleteService(serviceId);
        setServices(currentServices => currentServices.filter(s => s.id !== serviceId));
    } catch (error) {
        console.error("Failed to delete service:", error);
        alert("La suppression du service a échoué.");
        throw error;
    }
  }, []);

  return { services, loading, addService, updateService, deleteService };
};

export default useServices;