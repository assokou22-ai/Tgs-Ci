
import React, { useState, useEffect, useMemo, useRef, ErrorInfo, ReactNode, Component } from 'react';
import AdminDashboard from './components/AdminDashboard.tsx';
import AccueilDashboard from './components/AccueilDashboard.tsx';
import RoleSelection from './components/RoleSelection.tsx';
import EditorDashboard from './components/EditorDashboard.tsx';
import Clock from './components/Clock.tsx';
import { ArrowUturnLeftIcon, BuildingStorefrontIcon, ExclamationTriangleIcon } from './components/icons.tsx';
import GlobalSearch from './components/GlobalSearch.tsx';
import { compileFullBackupData, restoreFullDatabase } from './services/backupService.ts';
import { initializeSyncService } from './services/syncService.ts';
import { initializeRealtimeSync } from './services/realtimeService.ts';
import SyncStatusIndicator from './components/SyncStatusIndicator.tsx';
import FactureCommandeDashboard from './components/FactureCommandeDashboard.tsx';
import BackupStatus from './components/BackupStatus.tsx';
import { Role, RepairStatus, RepairTicket, SyncQueueItem, Appointment, FeatureId } from './types.ts';
import useRepairTickets from './hooks/useRepairTickets.ts';
import { dbAddDeviceSession, dbDeleteOldTickets, dbGetStock, dbGetTickets } from './services/dbService.ts';
import ErrorMessage from './components/ErrorMessage.tsx';
import NotificationBell from './components/NotificationBell.tsx';
import { fetchDataFromServer, saveDataToServer } from './services/serverService.ts';
import StoreSelection from './components/StoreSelection.tsx';
import { sendNotification } from './services/notificationService.ts';
import useAppointments from './hooks/useAppointments.ts';
import { useTheme } from './hooks/useTheme.ts';
import { useAppSettings } from './hooks/useAppSettings.ts';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Fix: Use React.Component explicitly to resolve TypeScript inheritance and property recognition issues.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Removed 'override' modifier as the compiler was failing to verify the base class extension.
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render(): ReactNode {
    // Fix: Using this.state correctly now that the property is recognized by TypeScript.
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Une erreur inattendue est survenue</h1>
          <p className="text-gray-400 mb-4 text-center max-w-md">L'application a rencontré un problème critique.</p>
          <pre className="bg-gray-800 p-4 rounded text-xs text-red-300 overflow-auto max-w-2xl w-full mb-6 border border-red-900">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold transition-colors"
          >
            Recharger l'application
          </button>
        </div>
      );
    }
    // Fix: this.props.children is now correctly recognized due to explicit React.Component extension.
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  useTheme();
  const { settings, isFeatureEnabled } = useAppSettings();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Démarrage de l\'application...');
  const { tickets, loading, error, addTicket, updateTicket, deleteTicket, refreshTickets, bulkUpdateTickets } = useRepairTickets(!initialLoading);
  const { appointments } = useAppointments();
  const syncInProgress = useRef(false);
  
  useEffect(() => {
    const persistedStoreId = sessionStorage.getItem('mac-repair-app-storeId');
    if (persistedStoreId) {
        setStoreId(persistedStoreId);
    } else {
        setInitialLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (!storeId) return;

    const handleUrlChange = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const roleFromUrl = urlParams.get('role');
        
        let targetRole: Role | null = null;
        if (roleFromUrl === 'factureetcommande' && isFeatureEnabled('menu_finance')) {
            targetRole = 'Facture et Commande';
        } else if (roleFromUrl === 'accueil' && isFeatureEnabled('menu_accueil')) {
            targetRole = 'Accueil';
        } else if (roleFromUrl === 'technicien' && isFeatureEnabled('menu_technicien')) {
            targetRole = 'Technicien';
        } else if (roleFromUrl === 'editeur' && isFeatureEnabled('menu_editeur')) {
            targetRole = 'Editeur';
        }

        if (targetRole) {
            setRole(targetRole);
            
            const featureIdMap: Record<Role, FeatureId> = {
                'Accueil': 'menu_accueil',
                'Technicien': 'menu_technicien',
                'Editeur': 'menu_editeur',
                'Facture et Commande': 'menu_finance'
            };
            
            const featureId = featureIdMap[targetRole];
            if (settings.features.requireSession[featureId]) {
                dbAddDeviceSession({ id: `session-${targetRole.toLowerCase()}-${Date.now()}`, timestamp: new Date().toISOString() });
            }
        } else if (roleFromUrl) {
            switchRole();
        }
    };
    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [storeId, isFeatureEnabled, settings.features.requireSession]);
  
  useEffect(() => {
      if (!storeId) return;
      
      const checkAndLoadData = async () => {
          setInitialLoading(true);
          const localTickets = await dbGetTickets();
          if (localTickets.length === 0) {
              setLoadingMessage(`Initialisation des données depuis le Cloud...`);
              const serverData = await fetchDataFromServer(storeId);
              if (serverData && serverData.tickets && serverData.tickets.length > 0) {
                  try {
                      await restoreFullDatabase(serverData);
                      await refreshTickets();
                  } catch (e) {
                      console.error(`Échec de l'initialisation Cloud:`, e);
                  }
              }
          }
          setInitialLoading(false);
          setLoadingMessage('');
      };
      checkAndLoadData();
  }, [storeId, refreshTickets]);

  useEffect(() => {
    if (!storeId) return;

    const handleSyncRequest = async () => {
      if (syncInProgress.current) return;
      syncInProgress.current = true;
      try {
          const backupData = await compileFullBackupData();
          await saveDataToServer(storeId, backupData);
          const nowISO = new Date().toISOString();
          localStorage.setItem('mac-repair-app-lastBackupDate', nowISO);
          window.dispatchEvent(new CustomEvent('backupCompleted', { detail: nowISO }));
      } catch (error) {
          console.error(`Sync failed:`, error);
      } finally {
          syncInProgress.current = false;
      }
    };

    window.addEventListener('requestsync', handleSyncRequest);
    return () => window.removeEventListener('requestsync', handleSyncRequest);
  }, [storeId]);
  
  useEffect(() => {
    initializeSyncService();
    initializeRealtimeSync();
  }, []);

  useEffect(() => {
    if (!refreshTickets) return;
    const handleDataReceived = (event: Event) => {
      if (event instanceof CustomEvent && Array.isArray(event.detail)) {
        const changes = event.detail as SyncQueueItem[];
        const existingTicketIds = new Set(tickets.map(t => t.id));
        changes.forEach(change => {
          if (change.entity === 'ticket' && change.operation === 'put' && change.payload) {
            const ticket = change.payload as RepairTicket;
            if (!existingTicketIds.has(ticket.id)) {
              const isUrgent = ['urgent', 'urgence'].some(keyword => ticket.problemDescription.toLowerCase().includes(keyword));
              if (isUrgent) {
                sendNotification('🚨 URGENCE - Nouvelle Fiche', {
                  body: `Fiche n°${ticket.id} (${ticket.client.name}) : "${ticket.problemDescription}"`,
                  tag: `urgent-${ticket.id}`,
                  requireInteraction: true
                });
              }
            }
          }
        });
      }
      refreshTickets();
    };
    window.addEventListener('datareceived', handleDataReceived);
    return () => window.removeEventListener('datareceived', handleDataReceived);
  }, [tickets, refreshTickets]);

  useEffect(() => {
      const logDeviceSession = async () => {
          try {
              await dbAddDeviceSession({ id: `boot-${Date.now()}`, timestamp: new Date().toISOString() });
              await dbDeleteOldTickets();
          } catch (error) {
              console.error("Maintenance failed:", error);
          }
      };
      logDeviceSession();
  }, []);

  const handleStoreSelect = (selectedStoreId: string) => {
    setStoreId(selectedStoreId);
    sessionStorage.setItem('mac-repair-app-storeId', selectedStoreId);
  };

  const handleRoleSelect = (selectedRole: Role) => {
    setRole(selectedRole);
    const url = new URL(window.location.href);
    url.searchParams.set('role', selectedRole.toLowerCase().replace(/\s/g, ''));
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const switchRole = () => {
    setRole(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('role');
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const switchStore = () => {
    if (window.confirm("Voulez-vous changer de magasin ? Vous serez déconnecté de la session actuelle.")) {
      sessionStorage.removeItem('mac-repair-app-storeId');
      setStoreId(null);
      setRole(null);
      const url = new URL(window.location.href);
      url.search = '';
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  if (initialLoading) {
      return (
          <div className="flex justify-center items-center h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-white">
              <div className="text-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-4 text-gray-500 dark:text-gray-400">{loadingMessage}</p>
              </div>
          </div>
      );
  }

  if (!storeId) return <StoreSelection onSelectStore={handleStoreSelect} />;
  
  if (!role) {
    return (
      <div className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-300 min-h-screen flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2">
                <BuildingStorefrontIcon className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                <span className="font-bold">{storeId}</span>
            </div>
            <Clock />
            <button onClick={switchStore} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <ArrowUturnLeftIcon className="w-4 h-4" /> Changer de magasin
            </button>
        </header>
        <main className="flex-grow flex flex-col">
          <RoleSelection onSelectRole={handleRoleSelect} />
        </main>
      </div>
    );
  }

  const renderDashboard = () => {
    switch (role) {
      case 'Accueil': return isFeatureEnabled('menu_accueil') ? <AccueilDashboard tickets={tickets} addTicket={addTicket} updateTicket={updateTicket} deleteTicket={deleteTicket} /> : null;
      case 'Technicien': return isFeatureEnabled('menu_technicien') ? <AdminDashboard tickets={tickets} updateTicket={updateTicket} deleteTicket={deleteTicket} /> : null;
      case 'Editeur': return isFeatureEnabled('menu_editeur') ? <EditorDashboard tickets={tickets} updateTicket={updateTicket} deleteTicket={deleteTicket} appointments={appointments} bulkUpdateTickets={bulkUpdateTickets} /> : null;
      case 'Facture et Commande': return isFeatureEnabled('menu_finance') ? <FactureCommandeDashboard /> : null;
      default: return null;
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-300 min-h-screen flex flex-col">
      <header className="flex justify-between items-center p-2 sm:p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 bg-gray-100/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={switchRole} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" title="Changer de rôle">
            <ArrowUturnLeftIcon className="w-5 h-5"/><span className="hidden sm:inline">Changer de rôle</span>
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700"></div>
          <div className="font-bold text-gray-900 dark:text-white text-lg">{role} @ {storeId}</div>
        </div>
        <div className="flex-1 flex justify-center px-4"><GlobalSearch currentRole={role} /></div>
        <div className="flex items-center gap-2 sm:gap-4">
            <NotificationBell /><SyncStatusIndicator /><Clock />
             <button onClick={switchStore} className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" title="Changer de magasin">
                <BuildingStorefrontIcon className="w-5 h-5"/>
            </button>
        </div>
      </header>
      <main className="p-0 sm:p-4 flex-grow">
        {error && <ErrorMessage title="Erreur de chargement" message={error} />}
        {loading && !error ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : renderDashboard()}
      </main>
      <footer className="p-2 bg-gray-100/80 dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm">
        <BackupStatus />
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
