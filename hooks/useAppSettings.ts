
import React, { useState, useCallback, createContext, useContext, ReactNode, useMemo } from 'react';
import { storageService } from '../services/storageService.ts';
import { CustomFieldDef, ThemeType, ColorPalette, AppFeatures, FeatureId } from '../types.ts';

export interface PrintSettings {
  showTechnicianNotes: boolean;
  showDiagnosticReport: boolean;
  showCustomFields: boolean;
  diagnosticOnSeparatePage: boolean;
}

export interface FormSettings {
    showClientEmail: boolean;
    showMachineDetails: boolean;
    autoCreateGoogleContact: boolean;
}

export interface PrinterConfig {
  id: string;
  name: string;
  type: 'thermal_80' | 'thermal_58' | 'office_a4' | 'labels_zebra' | 'other';
  connection: 'browser' | 'network' | 'bluetooth' | 'usb';
  address?: string;
  paperWidth?: number;
  marginOffset?: number; // offset in mm
  isDefaultTickets?: boolean;
  isDefaultInvoices?: boolean;
  fontContrast?: 'standard' | 'high' | 'ultra';
}

export interface DeviceOptimizationSettings {
  touchMode: boolean;
  keyboardShortcuts: boolean;
  forceMobileView: boolean;
  imageCompression: boolean;
  lowDataMode: boolean;
  density: 'condensed' | 'normal';
  autoFocusSearch: boolean;
  directQrScan: boolean;
}

export interface WorkshopSettings {
  name: string;
  phone: string;
  address: string;
  email: string;
  register: string;
  currency: string;
  tvaRate: number;
  defaultWarrantyMonths: number;
}

export interface AppSettings {
  theme: ThemeType;
  customPalette?: ColorPalette;
  customCss: string;
  features: AppFeatures;
  print: PrintSettings;
  forms: FormSettings;
  clauses: string[]; // Nouvelles clauses dynamiques
  stock: {
      showReference: boolean;
      showCost: boolean;
  };
  customFields: {
    ticket: CustomFieldDef[];
    stock: CustomFieldDef[];
    client: CustomFieldDef[];
  };
  printers: PrinterConfig[];
  device: DeviceOptimizationSettings;
  workshop: WorkshopSettings;
  syncEmails?: string[];
  backupAppIdentifier?: string;
}

const SETTINGS_KEY = 'appSettings';

const defaultSettings: AppSettings = {
  theme: 'sombre',
  customCss: '',
  features: {
      enabled: {
          menu_accueil: true, menu_technicien: true, menu_editeur: true, menu_finance: true, menu_engagements_sav: true,
          tool_ai_reports: true, tool_ai_diag: true, tool_ai_price: true, tool_ai_correction: true, tool_ai_search: true,
          mod_stock: true, mod_clients: true, mod_documents: true, mod_knowledge: true, mod_multimedia: true,
          mod_appointments: true, mod_backup: true, mod_exports: true, mod_legal_folder: true, mod_diagnostic_b: true,
          // Fix: Added missing 'mod_enterprise_clients' property to satisfy Record<FeatureId, boolean> type
          mod_enterprise_clients: true
      },
      requireSession: {
          menu_accueil: false, menu_technicien: false, menu_editeur: false, menu_finance: false, menu_engagements_sav: false,
          tool_ai_reports: false, tool_ai_diag: false, tool_ai_price: false, tool_ai_correction: false, tool_ai_search: false,
          mod_stock: false, mod_clients: false, mod_documents: false, mod_knowledge: false, mod_multimedia: false,
          mod_appointments: false, mod_backup: false, mod_exports: false, mod_legal_folder: false, mod_diagnostic_b: false,
          // Fix: Added missing 'mod_enterprise_clients' property to satisfy Record<FeatureId, boolean> type
          mod_enterprise_clients: false
      }
  },
  print: {
    showTechnicianNotes: true,
    showDiagnosticReport: true,
    showCustomFields: true,
    diagnosticOnSeparatePage: false,
  },
  forms: {
      showClientEmail: true,
      showMachineDetails: true,
      autoCreateGoogleContact: false,
  },
  clauses: [
    "Diagnostic : Forfait fixe de 5 000 F CFA dû dès l'ouverture de l'appareil.",
    "Garantie Constructeur : Le client reconnaît que l'intervention technique sur les circuits électroniques par nos soins peut annuler la garantie constructeur d'origine.",
    "Limitation de Responsabilité : TGS-CI est tenu à une obligation de moyens. En raison de la complexité des circuits électroniques, l'atelier ne peut être tenu responsable des pannes intermittentes ou des défauts de structure (oxydation cachée, micro-fissures) révélés lors du démontage.",
    "Sauvegarde : La responsabilité des données stockées incombe exclusivement au client. TGS-CI ne garantit pas la récupération des données en cas de défaillance critique du support de stockage ou de la carte mère.",
    "Abandon : Tout matériel non récupéré dans un délai de 90 jours après notification est considéré comme abandonné et pourra être recyclé pour couvrir les frais engagés."
  ],
  stock: {
      showReference: true,
      showCost: true,
  },
  customFields: {
    ticket: [{ id: 'ticket_serial_number', label: 'Numéro de série' }],
    stock: [{ id: 'stock_location', label: 'Emplacement' }],
    client: [
        { id: 'client_id_internal', label: 'ID client' },
        { id: 'client_company', label: 'Nom de la société' }
    ],
  },
  printers: [
    {
      id: 'default_system',
      name: 'Imprimante Standard (Navigateur/A4)',
      type: 'office_a4',
      connection: 'browser',
      isDefaultInvoices: true,
      isDefaultTickets: false
    },
    {
      id: 'default_thermal',
      name: 'Imprimante Ticket Thermique (80mm)',
      type: 'thermal_80',
      connection: 'browser',
      isDefaultInvoices: false,
      isDefaultTickets: true,
      marginOffset: 0,
      fontContrast: 'standard'
    }
  ],
  device: {
    touchMode: false,
    keyboardShortcuts: true,
    forceMobileView: false,
    imageCompression: true,
    lowDataMode: false,
    density: 'normal',
    autoFocusSearch: true,
    directQrScan: true
  },
  workshop: {
    name: 'TGS-CI',
    phone: '+225 07 57 13 35 07',
    address: 'Cocody Faya, Carrefour Coq Ivoir, Abidjan',
    email: 'contact@tgs-ci.com',
    register: 'SARL au Capital de 1.000.000 F CFA | RCCM CI-ABJ-03-2023-B13-05421',
    currency: 'F CFA',
    tvaRate: 18,
    defaultWarrantyMonths: 3
  },
  syncEmails: ['contact@tgs-ci.com'],
  backupAppIdentifier: 'RM_MACBOOK'
};

const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown> | Partial<AppSettings>): Record<string, unknown> => {
    const output = { ...target };
    if (!source || typeof source !== 'object' || Array.isArray(source)) return output;
    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = (source as Record<string, unknown>)[key];
        if (sourceValue === undefined) return;
        if (Array.isArray(targetValue)) {
            if (Array.isArray(sourceValue)) output[key] = sourceValue;
        } else if (targetValue && typeof targetValue === 'object' && sourceValue && typeof sourceValue === 'object') {
            output[key] = deepMerge(targetValue, sourceValue);
        } else {
            output[key] = sourceValue;
        }
    });
    return output;
};

interface AppSettingsContextType {
    settings: AppSettings;
    updateSettings: <K extends keyof AppSettings>(category: K, newSettings: Partial<AppSettings[K]> | AppSettings[K]) => void;
    updateCustomFields: (category: keyof AppSettings['customFields'], newFields: CustomFieldDef[]) => void;
    toggleFeature: (id: FeatureId, type: 'enabled' | 'requireSession') => void;
    isFeatureEnabled: (id: FeatureId) => boolean;
}

const AppSettingsContext = createContext<AppSettingsContextType | null>(null);

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(() => {
      const stored = storageService.get<Partial<AppSettings>>(SETTINGS_KEY, defaultSettings);
      return deepMerge(defaultSettings, stored);
    });

    const updateSettings = useCallback(<K extends keyof AppSettings>(category: K, newSettings: Partial<AppSettings[K]> | AppSettings[K]) => {
        setSettings(prev => {
            const updatedValue = typeof newSettings === 'object' && newSettings !== null && !Array.isArray(newSettings)
                ? { ...(prev[category] as Record<string, unknown>), ...newSettings } 
                : newSettings;
            const updated = { ...prev, [category]: updatedValue as AppSettings[K] };
            storageService.set(SETTINGS_KEY, updated);
            return updated;
        });
    }, []);

    const updateCustomFields = useCallback((category: keyof AppSettings['customFields'], newFields: CustomFieldDef[]) => {
        setSettings(prev => {
            const updated = { ...prev, customFields: { ...prev.customFields, [category]: newFields } };
            storageService.set(SETTINGS_KEY, updated);
            return updated;
        });
    }, []);

    const toggleFeature = useCallback((id: FeatureId, type: 'enabled' | 'requireSession') => {
        setSettings(prev => {
            const updated = {
                ...prev,
                features: {
                    ...prev.features,
                    [type]: { ...prev.features[type], [id]: !prev.features[type][id] }
                }
            };
            storageService.set(SETTINGS_KEY, updated);
            return updated;
        });
    }, []);

    const isFeatureEnabled = useCallback((id: FeatureId) => {
        return settings.features.enabled[id] !== false;
    }, [settings.features.enabled]);

    const value = useMemo(() => ({
        settings, updateSettings, updateCustomFields, toggleFeature, isFeatureEnabled
    }), [settings, updateSettings, updateCustomFields, toggleFeature, isFeatureEnabled]);

    return React.createElement(AppSettingsContext.Provider, { value }, children);
};

export const useAppSettings = (): AppSettingsContextType => {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
};
