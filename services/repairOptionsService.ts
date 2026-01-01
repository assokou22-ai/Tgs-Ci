import { RepairServiceItem } from '../types.ts';

// This file provides a default list of common services.
export const defaultServices: RepairServiceItem[] = [
    {
      "id": "svc-log-inst-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Installation macOS",
      "price": 25000,
      "category": "Logiciel"
    },
    {
      "id": "svc-log-recup-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Récupération de données (simple)",
      "price": 40000,
      "category": "Logiciel"
    },
    {
      "id": "svc-r-batt-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement batterie",
      "price": 75000,
      "category": "Remplacement"
    },
    {
      "id": "svc-r-clavier-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement clavier",
      "price": 85000,
      "category": "Remplacement"
    },
    {
      "id": "svc-r-ecran-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement écran MacBook Air 13\"",
      "price": 150000,
      "category": "Remplacement"
    },
    {
      "id": "svc-r-ecran-2",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement écran MacBook Pro 13\"",
      "price": 180000,
      "category": "Remplacement"
    },
    {
      "id": "svc-r-ssd-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement SSD 256GB",
      "price": 90000,
      "category": "Remplacement"
    },
    {
      "id": "svc-r-trackpad-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement trackpad",
      "price": 60000,
      "category": "Remplacement"
    },
    {
      "id": "svc-rep-cm-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Réparation carte mère (Niveau 1)",
      "price": 120000,
      "category": "Réparation"
    },
    {
      "id": "svc-rep-cm-2",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Réparation carte mère (Niveau 2)",
      "price": 200000,
      "category": "Réparation"
    },
    {
      "id": "svc-rep-liq-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Désoxydation (dégâts liquides)",
      "price": 50000,
      "category": "Réparation"
    }
];