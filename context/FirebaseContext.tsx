import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase.ts';
import { useToastContext } from './ToastContext.tsx';
import { initializeSyncService } from '../services/syncService.ts';
import { startFirebaseRealtimeSync } from '../services/realtimeService.ts';
import { checkAndTriggerAutoDailyBackup } from '../services/backupService.ts';
import { 
    getDriveMetadata, 
    saveDriveMetadata, 
    DriveMetadata, 
    DriveSyncStatus 
} from '../services/driveSyncDb.ts';
import { 
    setSecureToken, 
    getSecureToken, 
    clearSecureToken, 
    testTokenViability, 
    getTokenRemainingSeconds 
} from '../services/tokenVault.ts';

interface FirebaseContextType {
    user: User | null;
    authReady: boolean;
    googleAccessToken: string | null;
    googleSyncEnabled: boolean;
    driveSyncStatus: DriveSyncStatus;
    driveMetadata: DriveMetadata;
    isReconnectingGoogle: boolean;
    needGoogleClickToRefresh: boolean;
    signInWithGoogle: (selectAccount?: boolean) => Promise<void>;
    switchGoogleAccount: () => Promise<void>;
    signOutUser: () => Promise<void>;
    disableGoogleSync: () => Promise<void>;
    toggleAutoSync: (enabled: boolean) => Promise<void>;
    dismissGoogleRefreshNotice: (permanent?: boolean) => void;
    refreshDriveTokenSilently: () => Promise<string | null>;
}

const DEFAULT_DRIVE_META: DriveMetadata = {
    driveConnected: false,
    connectedEmail: null,
    lastSyncTime: null,
    autoSyncEnabled: true,
    lastError: null,
    syncStatus: 'action_required',
    pendingCount: 0,
};

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { showToast } = useToastContext();
    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [isReconnectingGoogle, setIsReconnectingGoogle] = useState(false);
    
    // Non-sensitive metadata state restored immediately from IndexedDB
    const [driveMetadata, setDriveMetadata] = useState<DriveMetadata>(DEFAULT_DRIVE_META);
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

    const isCheckingSessionRef = useRef(false);

    // Initial cache restore from IndexedDB (non-blocking)
    useEffect(() => {
        let mounted = true;
        getDriveMetadata().then((meta) => {
            if (mounted) {
                setDriveMetadata(meta);
            }
        }).catch((e) => {
            console.warn('[FirebaseContext] Metadata restore warning:', e);
        });

        // Restore secure token if valid in current session
        getSecureToken().then((token) => {
            if (mounted && token) {
                setGoogleAccessToken(token);
            }
        });

        const handleMetaChanged = (e: Event) => {
            if (e instanceof CustomEvent && e.detail) {
                setDriveMetadata(e.detail);
            }
        };
        window.addEventListener('gdrive-meta-changed', handleMetaChanged);

        return () => {
            mounted = false;
            window.removeEventListener('gdrive-meta-changed', handleMetaChanged);
        };
    }, []);

    // Proactive background session check
    const verifyGoogleSession = useCallback(async (token: string | null, currentUser: User | null) => {
        if (isCheckingSessionRef.current) return;
        isCheckingSessionRef.current = true;

        try {
            if (token) {
                const isValid = await testTokenViability(token);
                if (isValid) {
                    await saveDriveMetadata({
                        driveConnected: true,
                        connectedEmail: currentUser?.email || driveMetadata.connectedEmail,
                        syncStatus: navigator.onLine ? 'synced' : 'offline_pending',
                        lastError: null,
                    });
                } else {
                    console.log('[FirebaseContext] Token expired or revoked by Google.');
                    clearSecureToken();
                    setGoogleAccessToken(null);
                    await saveDriveMetadata({
                        syncStatus: 'action_required',
                        lastError: 'Session expirée (reconnexion requise)',
                    });
                }
            } else if (driveMetadata.driveConnected) {
                // Was connected before, but no active token in memory/session
                await saveDriveMetadata({
                    syncStatus: 'action_required',
                    lastError: 'Autorisation requise pour Google Drive',
                });
            }
        } catch (err) {
            console.warn('[FirebaseContext] Error verifying session:', err);
        } finally {
            isCheckingSessionRef.current = false;
        }
    }, [driveMetadata.connectedEmail, driveMetadata.driveConnected]);

    // Token lifetime management & periodic check
    useEffect(() => {
        if (!googleAccessToken) return;

        const interval = setInterval(async () => {
            const remaining = getTokenRemainingSeconds();
            if (remaining <= 0) {
                console.log('[FirebaseContext] Access token expired.');
                clearSecureToken();
                setGoogleAccessToken(null);
                await saveDriveMetadata({
                    syncStatus: 'action_required',
                    lastError: 'Session Google Drive expirée (1h). Cliquez sur Action requise pour renouveler.',
                });
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [googleAccessToken]);

    // Listen to Firebase Auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            setAuthReady(true);

            if (currentUser) {
                // Initialize background Firestore sync and services
                initializeSyncService();
                startFirebaseRealtimeSync();
                setTimeout(() => {
                    checkAndTriggerAutoDailyBackup();
                }, 3000);

                // Verify Google Drive connection status in background
                const activeToken = await getSecureToken();
                if (activeToken) {
                    setGoogleAccessToken(activeToken);
                    verifyGoogleSession(activeToken, currentUser);
                } else {
                    const currentMeta = await getDriveMetadata();
                    if (currentMeta.driveConnected) {
                        await saveDriveMetadata({
                            syncStatus: 'action_required',
                            connectedEmail: currentUser.email || currentMeta.connectedEmail,
                        });
                    }
                }
            } else {
                setGoogleAccessToken(null);
                clearSecureToken();
            }
        });

        return () => unsubscribe();
    }, [verifyGoogleSession]);

    // Sign in with Google (requests Workspace Drive scopes)
    const signInWithGoogle = async (selectAccount: boolean = false) => {
        setIsReconnectingGoogle(true);
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/drive.file');
        provider.addScope('https://www.googleapis.com/auth/drive');
        provider.addScope('https://www.googleapis.com/auth/contacts');

        if (selectAccount) {
            provider.setCustomParameters({ prompt: 'select_account' });
        }

        try {
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                const token = credential.accessToken;
                await setSecureToken(token, 3600);
                setGoogleAccessToken(token);

                const email = result.user.email || 'thegoodstoreci@gmail.com';
                const updated = await saveDriveMetadata({
                    driveConnected: true,
                    connectedEmail: email,
                    syncStatus: 'synced',
                    lastError: null,
                });
                setDriveMetadata(updated);

                showToast(`✅ Google Drive connecté (${email}) !`, "success");

                // Trigger an immediate initial sync in background
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('manual-gdrive-sync'));
                }, 1000);
            }
        } catch (error: unknown) {
            console.error("Google Auth Error:", error);
            const errCode = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
            if (errCode === 'auth/popup-closed-by-user') {
                showToast("Connexion Google annulée", "info");
            } else {
                showToast("Échec de la connexion Google Workspace", "error");
            }
        } finally {
            setIsReconnectingGoogle(false);
        }
    };

    // Switch account specifically
    const switchGoogleAccount = async () => {
        await signInWithGoogle(true);
    };

    // Sign out completely from Atelier and Drive
    const signOutUser = async () => {
        try {
            clearSecureToken();
            setGoogleAccessToken(null);
            await saveDriveMetadata({
                driveConnected: false,
                syncStatus: 'action_required',
                lastError: null,
            });
            await signOut(auth);
            showToast("Déconnexion réussie", "info");
        } catch (error) {
            console.error("Sign out error:", error);
            showToast("Erreur lors de la déconnexion", "error");
        }
    };

    // Disconnect Google Drive without logging out of the Atelier
    const disableGoogleSync = async () => {
        clearSecureToken();
        setGoogleAccessToken(null);
        const updated = await saveDriveMetadata({
            driveConnected: false,
            syncStatus: 'action_required',
            lastError: null,
        });
        setDriveMetadata(updated);
        showToast("Synchronisation Google Drive déconnectée", "info");
    };

    // Toggle automatic background synchronization
    const toggleAutoSync = async (enabled: boolean) => {
        const updated = await saveDriveMetadata({ autoSyncEnabled: enabled });
        setDriveMetadata(updated);
        showToast(
            enabled ? "Synchronisation automatique activée" : "Synchronisation automatique mise en pause",
            "info"
        );
    };

    const dismissGoogleRefreshNotice = () => {
        // No-op kept for backwards compatibility
    };

    const refreshDriveTokenSilently = async (): Promise<string | null> => {
        const token = await getSecureToken();
        if (token && (await testTokenViability(token))) {
            return token;
        }
        return null;
    };

    return (
        <FirebaseContext.Provider value={{ 
            user, 
            authReady, 
            googleAccessToken, 
            googleSyncEnabled: driveMetadata.driveConnected,
            driveSyncStatus: driveMetadata.syncStatus,
            driveMetadata,
            needGoogleClickToRefresh: driveMetadata.syncStatus === 'action_required',
            isReconnectingGoogle,
            signInWithGoogle, 
            switchGoogleAccount,
            signOutUser, 
            disableGoogleSync,
            toggleAutoSync,
            dismissGoogleRefreshNotice,
            refreshDriveTokenSilently,
        }}>
            {children}
        </FirebaseContext.Provider>
    );
};

export const useFirebase = (): FirebaseContextType => {
    const context = useContext(FirebaseContext);
    if (!context) {
        throw new Error('useFirebase must be used within a FirebaseProvider');
    }
    return context;
};
