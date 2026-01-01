// Fix: Add file extensions to local module imports.
import { RepairServiceItem } from '../types.ts';
import { storageService } from './storageService.ts';
import { defaultServices } from './repairOptionsService.ts';

const SERVICES_KEY = 'repairServices';

export const getServices = (): RepairServiceItem[] => {
    return storageService.get<RepairServiceItem[]>(SERVICES_KEY, defaultServices);
};

export const saveServices = (services: RepairServiceItem[]) => {
    storageService.set(SERVICES_KEY, services);
};