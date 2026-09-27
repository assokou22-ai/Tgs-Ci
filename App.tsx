import React, { useState, useEffect, ErrorInfo, ReactNode } from 'react';
import { Role } from './types.ts';
import RoleSelection from './components/RoleSelection.tsx';
import StoreSelection from './components/StoreSelection.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import AccueilDashboard from './components/AccueilDashboard.tsx';
import EditorDashboard from './components/EditorDashboard.tsx';
import FactureCommandeDashboard from './components/FactureCommandeDashboard.tsx';
import EngagementsSavDashboard from './components/EngagementsSavDashboard.tsx';
import CustomStyleInjector from './components/CustomStyleInjector.tsx';
import useRepairTickets from './hooks/useRepairTickets.ts';
import useAppointments from './hooks/useAppointments.ts';
import { useTheme } from './hooks/useTheme.ts';
import { initializeSyncService, processSyncQueue } from './services/syncService.ts';
import { initializeRealtimeSync } from './services/realtimeService.ts';
import { dbAddDeviceSession } from './services/dbService.ts';
import LoginScreen from './components/LoginScreen.tsx';
import { checkAndTriggerAutoDailyBackup } from './services/backupService.ts';
import { parseUserAgent, fetchConnectionDetails } from './utils/connectionHelper.ts';
import { auth } from './services/firebase.ts';
import { useGoogleDriveAutoSync } from './hooks/useGoogleDriveAutoSync.ts';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Composant Error Boundary pour capturer les erreurs fatales de l'interface.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App Error Boundary caught an uncaught error:", error, errorInfo);
  }

  render() {
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center font-sans">
          <div className="max-w-md bg-zinc-900 border border-red-900/50 p-10 rounded-[32px] shadow-2xl animate-fade-in">
            <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Instabilité Système</h1>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                Une erreur inattendue a interrompu l'interface. Vos données locales sont protégées et synchronisées.
            </p>
            <div className="flex flex-col gap-3">
                <button 
                    onClick={() => window.location.reload()} 
                    className="w-full py-4 bg-white text-black font-black rounded-2xl uppercase tracking-widest text-xs transition-all shadow-xl hover:bg-zinc-200 active:scale-95"
                >
                    Redémarrer le logiciel
                </button>
                <button 
                    onClick={() => {
                        sessionStorage.clear();
                        localStorage.clear();
                        window.location.href = '/';
                    }} 
                    className="w-full py-4 bg-zinc-800 text-zinc-400 font-black rounded-2xl uppercase tracking-widest text-[10px] transition-all hover:text-white"
                >
                    Réinitialiser la session
                </button>
            </div>
          </div>
        </div>
      );
    }
    
    return children;
  }
}

const AppContent: React.FC = () => {
    useTheme();
    useGoogleDriveAutoSync();

    const [storeId, setStoreId] = useState<string | null>(() => localStorage.getItem('mac-repair-app-storeId'));
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        return localStorage.getItem('tgs-ci-portal-authenticated') === 'true';
    });
    const [role, setRole] = useState<Role | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const roleParam = params.get('role');
        if (roleParam) {
            const roleMap: Record<string, Role> = {
                'accueil': 'Accueil',
                'technicien': 'Technicien',
                'editeur': 'Editeur',
                'factureetcommande': 'Facture et Commande',
                'engagementssav': 'Engagements SAV'
            };
            return roleMap[roleParam.toLowerCase()] || null;
        }
        return null;
    });
    const { tickets, addTicket, updateTicket, deleteTicket, bulkUpdateTickets, loading } = useRepairTickets(!!storeId);
    const { appointments } = useAppointments();
    useGoogleDriveAutoSync();

    useEffect(() => {
        if (storeId) {
            initializeSyncService()
                .then(() => {
                    checkAndTriggerAutoDailyBackup().catch(console.error);
                })
                .catch(console.error);
            initializeRealtimeSync();
            
            const recordSession = async () => {
                const { browser, os } = parseUserAgent();
                let ipDetails = { ipAddress: 'Local/Hors-ligne', location: 'Localisation indisponible', coordinates: 'Inconnues' };
                try {
                    ipDetails = await fetchConnectionDetails();
                } catch (e) {
                    console.error("Échec récupération géolocalisation session:", e);
                }
                
                await dbAddDeviceSession({
                    id: `sess-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    email: auth.currentUser?.email || 'Visiteur Local',
                    browser,
                    os,
                    ipAddress: ipDetails.ipAddress,
                    location: ipDetails.location,
                    coordinates: ipDetails.coordinates
                });
            };
            recordSession().catch(console.error);

            const handleSyncRequest = () => processSyncQueue().catch(console.error);
            window.addEventListener('requestsync', handleSyncRequest);
            return () => window.removeEventListener('requestsync', handleSyncRequest);
        }
    }, [storeId]);

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const roleParam = params.get('role');
            if (roleParam) {
                const roleMap: Record<string, Role> = {
                    'accueil': 'Accueil',
                    'technicien': 'Technicien',
                    'editeur': 'Editeur',
                    'factureetcommande': 'Facture et Commande',
                    'engagementssav': 'Engagements SAV'
                };
                setRole(roleMap[roleParam.toLowerCase()] || null);
            } else {
                setRole(null);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const handleSelectStore = (id: string) => {
        localStorage.setItem('mac-repair-app-storeId', id);
        setStoreId(id);
    };

    const handleSelectRole = (selectedRole: Role) => {
        const roleParam = selectedRole.toLowerCase().replace(/\s/g, '');
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('role', roleParam);
        window.history.pushState({}, '', newUrl);
        setRole(selectedRole);
    };

    if (!storeId) return <StoreSelection onSelectStore={handleSelectStore} />;
    if (!isAuthenticated) return <LoginScreen onSuccess={() => setIsAuthenticated(true)} />;
    if (!role) return <RoleSelection onSelectRole={handleSelectRole} />;

    return (
        <>
            <CustomStyleInjector />
            {role === 'Accueil' && <AccueilDashboard tickets={tickets} addTicket={addTicket} updateTicket={updateTicket} deleteTicket={deleteTicket} loading={loading} />}
            {role === 'Technicien' && <AdminDashboard tickets={tickets} updateTicket={updateTicket} deleteTicket={deleteTicket} loading={loading} />}
            {role === 'Editeur' && <EditorDashboard tickets={tickets} updateTicket={updateTicket} deleteTicket={deleteTicket} appointments={appointments} bulkUpdateTickets={bulkUpdateTickets} />}
            {role === 'Facture et Commande' && <FactureCommandeDashboard />}
            {role === 'Engagements SAV' && <EngagementsSavDashboard />}
        </>
    );
};

import { ToastProvider } from './context/ToastContext.tsx';
import { FirebaseProvider } from './context/FirebaseContext.tsx';

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <ToastProvider>
                <FirebaseProvider>
                    <AppContent />
                </FirebaseProvider>
            </ToastProvider>
        </ErrorBoundary>
    );
};

export default App;