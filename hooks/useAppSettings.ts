
import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';
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
}

export interface StockSettings {
    showReference: boolean;
    showCost: boolean;
}

export interface AppSettings {
  theme: ThemeType;
  customPalette?: ColorPalette;
  features: AppFeatures;
  print: PrintSettings;
  forms: FormSettings;
  stock: StockSettings;
  customFields: {
    ticket: CustomFieldDef[];
    stock: CustomFieldDef[];
    client: CustomFieldDef[];
  };
}

const SETTINGS_KEY = 'appSettings';

// Valeurs par défaut avec tout activé par défaut (l'utilisateur pourra désactiver ensuite)
const defaultSettings: AppSettings = {
  theme: 'system',
  features: {
      enabled: {
          menu_accueil: true, menu_technicien: true, menu_editeur: true, menu_finance: true,
          tool_ai_reports: true, tool_ai_diag: true, tool_ai_price: true, tool_ai_correction: true, tool_ai_search: true,
          mod_stock: true, mod_clients: true, mod_documents: true, mod_knowledge: true, mod_multimedia: true,
          mod_appointments: true, mod_backup: true, mod_exports: true, mod_legal_folder: true, mod_diagnostic_b: true
      },
      requireSession: {
          menu_accueil: false, menu_technicien: false, menu_editeur: false, menu_finance: false,
          tool_ai_reports: false, tool_ai_diag: false, tool_ai_price: false, tool_ai_correction: false, tool_ai_search: false,
          mod_stock: false, mod_clients: false, mod_documents: false, mod_knowledge: false, mod_multimedia: false,
          mod_appointments: false, mod_backup: false, mod_exports: false, mod_legal_folder: false, mod_diagnostic_b: false
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
  },
  stock: {
      showReference: true,
      showCost: true,
  },
  customFields: {
    ticket: [
        { id: 'ticket_serial_number', label: 'Numéro de série' }
    ],
    stock: [
        { id: 'stock_location', label: 'Emplacement' }
    ],
    client: [
        { id: 'client_id_internal', label: 'ID client' },
        { id: 'client_company', label: 'Nom de la société' },
        { id: 'client_contact_internal', label: 'Numéro de contact interne' },
    ],
  },
};

const deepMerge = (target: any, source: any): any => {
    const output = { ...target };
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return output;
    }
    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];
        if (sourceValue === undefined) return;
        const isPlainObject = (obj: any) => obj && typeof obj === 'object' && !Array.isArray(obj);
        if (Array.isArray(targetValue)) {
            if (Array.isArray(sourceValue)) {
                output[key] = sourceValue;
            }
        } else if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
            output[key] = deepMerge(targetValue, sourceValue);
        } else {
            output[key] = sourceValue;
        }
    });
    return output;
};

interface AppSettingsContextType {
    settings: AppSettings;
    updateSettings: <K extends keyof AppSettings>(category: K, newSettings: Partial<AppSettings[K]>) => void;
    updateCustomFields: (category: keyof AppSettings['customFields'], newFields: CustomFieldDef[]) => void;
    toggleFeature: (id: FeatureId, type: 'enabled' | 'requireSession') => void;
    isFeatureEnabled: (id: FeatureId) => boolean;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(() => {
      const stored = storageService.get<Partial<AppSettings>>(SETTINGS_KEY, defaultSettings);
      return deepMerge(defaultSettings, stored);
  });

  const updateSettings = useCallback(<K extends keyof AppSettings>(category: K, newSettings: any) => {
    setSettings(prev => {
      const updated = {
        ...prev,
        [category]: typeof newSettings === 'object' ? { ...prev[category], ...newSettings } : newSettings
      };
      storageService.set(SETTINGS_KEY, updated);
      return updated;
    });
  }, []);

  const updateCustomFields = useCallback((category: keyof AppSettings['customFields'], newFields: CustomFieldDef[]) => {
      setSettings(prev => {
          const updated = { 
              ...prev, 
              customFields: {
                  ...prev.customFields,
                  [category]: newFields,
              }
          };
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
                  [type]: {
                      ...prev.features[type],
                      [id]: !prev.features[type][id]
                  }
              }
          };
          storageService.set(SETTINGS_KEY, updated);
          return updated;
      });
  }, []);

  const isFeatureEnabled = useCallback((id: FeatureId) => {
      return settings.features.enabled[id] !== false;
  }, [settings.features.enabled]);
  
  const value = { settings, updateSettings, updateCustomFields, toggleFeature, isFeatureEnabled };
  return React.createElement(AppSettingsContext.Provider, { value }, children);
}

export const useAppSettings = (): AppSettingsContextType => {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
};
