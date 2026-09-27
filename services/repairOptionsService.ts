import { RepairServiceItem } from '../types.ts';

// Cette liste fournit les prestations par défaut basées sur la grille tarifaire TGS-CI.
export const defaultServices: RepairServiceItem[] = [
    {
      "id": "svc-rep-cm-std",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "name": "Réparation de la carte mère",
      "price": 120000,
      "category": "Réparation"
    },
    {
      "id": "svc-remp-cm-std",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "name": "Remplacement de la carte mère",
      "price": 200000,
      "category": "Remplacement"
    },
    {
      "id": "svc-rep-lum-ecran",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "name": "Réparation de la lumière sur l'écran",
      "price": 75000,
      "category": "Réparation"
    },
    {
      "id": "svc-rep-lum-cm",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "name": "Réparation de la lumière sur la carte mère",
      "price": 90000,
      "category": "Réparation"
    },
    {
      "id": "svc-rep-liq-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Désoxydation (dégâts liquides)",
      "price": 50000,
      "category": "Réparation"
    },
    {
      "id": "svc-rep-cm-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Réparation carte mère - Niveau 1",
      "price": 120000,
      "category": "Réparation"
    },
    {
      "id": "svc-rep-cm-2",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Réparation carte mère - Niveau 2",
      "price": 200000,
      "category": "Réparation"
    },
    {
      "id": "svc-r-batt-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement batterie neuve",
      "price": 80000,
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
      "id": "svc-r-trackpad-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement trackpad",
      "price": 60000,
      "category": "Remplacement"
    },
    {
      "id": "svc-r-ecran-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement écran MacBook Air 13 pouces",
      "price": 150000,
      "category": "Remplacement"
    },
    {
      "id": "svc-r-ecran-2",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement écran occasion MacBook Pro 13 pouces",
      "price": 150000,
      "category": "Remplacement"
    },
    {
      "id": "svc-r-ecran-3",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement écran occasion MacBook Pro 15 pouces",
      "price": 180000,
      "category": "Remplacement"
    },
    {
      "id": "svc-r-ecran-4",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Remplacement écran occasion MacBook Air 15 pouces",
      "price": 300000,
      "category": "Remplacement"
    },
    {
      "id": "svc-log-inst-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Installation macOS",
      "price": 20000,
      "category": "Logiciel"
    },
    {
      "id": "svc-log-recup-1",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "name": "Récupération de données (simple)",
      "price": 40000,
      "category": "Logiciel"
    }
];