import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSyncStatus } from '../hooks/useSyncStatus.ts';
import { useNetworkQuality } from '../hooks/useNetworkQuality.ts';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { dbGetSyncQueue } from '../services/dbService.ts';
import { processSyncQueue, syncFromCloud } from '../services/syncService.ts';
import { SyncQueueItem, EntityType } from '../types.ts';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { 
    ArrowPathIcon, 
    WrenchScrewdriverIcon,
    CurrencyEuroIcon,
    ShoppingCartIcon,
    ClipboardDocumentListIcon,
    ShieldCheckIcon,
    CubeIcon,
    CalendarDaysIcon,
    XIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    GlobeAltIcon,
    ClockIcon
} from './icons.tsx';

const SyncStatusIndicator: React.FC = () => {
    const { showToast } = useToastContext();
    const { user, googleAccessToken, signInWithGoogle, driveSyncStatus, driveMetadata } = useFirebase();
    const isOnline = useOnlineStatus();
    const quality = useNetworkQuality();
    const { isSyncing, pendingChanges } = useSyncStatus();
    const [isForcingSync, setIsForcingSync] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
    const [expandedItem, setExpandedItem] = useState<number | null>(null);

    // Google Drive Manual sync state
    const [gdriveSyncing, setGdriveSyncing] = useState(false);
    const [gdriveLastSyncTime, setGdriveLastSyncTime] = useState<Date | null>(() => {
        const saved = localStorage.getItem('tgs_last_gdrive_sync_time');
        return saved ? new Date(saved) : null;
    });

    useEffect(() => {
        const handleGdriveSyncingState = (e: Event) => {
            if (e instanceof CustomEvent && e.detail) {
                setGdriveSyncing(!!e.detail.syncing);
            }
        };

        const handleGdriveLastSyncTime = (e: Event) => {
            if (e instanceof CustomEvent && e.detail?.time) {
                setGdriveLastSyncTime(new Date(e.detail.time));
            }
        };

        window.addEventListener('gdrive-syncing-state', handleGdriveSyncingState);
        window.addEventListener('gdrive-last-sync-time', handleGdriveLastSyncTime);

        return () => {
            window.removeEventListener('gdrive-syncing-state', handleGdriveSyncingState);
            window.removeEventListener('gdrive-last-sync-time', handleGdriveLastSyncTime);
        };
    }, []);

    const handleForceGdriveSync = () => {
        if (!isOnline) {
            showToast("Connexion internet requise pour sauvegarder sur Google Drive.", "warning");
            return;
        }
        if (!googleAccessToken) {
            showToast("Veuillez d'abord lier votre compte Google (cliquez sur Connexion).", "warning");
            return;
        }
        window.dispatchEvent(new CustomEvent('manual-gdrive-sync'));
    };

    // Track state transitions to avoid showing toasts on initial mount
    const isInitialMount = useRef(true);
    const prevQuality = useRef(quality);

    // Load queue list from IndexedDB
    const loadQueue = async () => {
        try {
            const items = await dbGetSyncQueue();
            setQueueItems(items);
        } catch (e) {
            console.error("Error loading Sync Queue:", e);
        }
    };

    // Trigger reload asynchronously when open or when syncing status changes
    useEffect(() => {
        if (isOpen) {
            setTimeout(loadQueue, 0);
        }
    }, [isOpen, isSyncing, pendingChanges]);

    // Handle background events changing synchronization queue
    useEffect(() => {
        if (!isOpen) return;

        const handleDataChanged = () => {
            setTimeout(loadQueue, 50);
        };
        window.addEventListener('datachanged', handleDataChanged);
        window.addEventListener('requestsync', handleDataChanged);
        window.addEventListener('syncerror', handleDataChanged);
        return () => {
            window.removeEventListener('datachanged', handleDataChanged);
            window.removeEventListener('requestsync', handleDataChanged);
            window.removeEventListener('syncerror', handleDataChanged);
        };
    }, [isOpen]);

    // Warn of connection drops in real-time
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (!isOnline) {
            showToast(
                "Mode Hors Ligne Activé : Vos données sont stockées de manière sécurisée en local. Tout se synchronisera dès le retour du réseau.",
                "info"
            );
        } else {
            showToast(
                "Réseau Détecté : L'appareil s'est reconnecté à Internet. Synchronisation automatique lancée.",
                "success"
            );
        }
    }, [isOnline, showToast]);

    // Warn of degradation of signal quality (elevators, basements, remote sites)
    useEffect(() => {
        if (quality === 0) return; // Monitored by isOnline
        
        if (prevQuality.current !== quality) {
            if (quality <= 2) {
                showToast(
                    "Signal faible détecté (Moyenne 2G/3G). Les transferts cloud peuvent être ralentis, stockage local prioritaire.",
                    "warning"
                );
            }
            prevQuality.current = quality;
        }
    }, [quality, showToast]);

    // Listen to background sync success and error events for user feedback
    useEffect(() => {
        const handleSyncSuccess = (e: Event) => {
            if (e instanceof CustomEvent && e.detail?.message) {
                showToast(e.detail.message, "success");
            }
        };

        const handleSyncError = (e: Event) => {
            if (e instanceof CustomEvent && e.detail?.message) {
                showToast(e.detail.message, "error");
            }
        };

        window.addEventListener('syncsuccess', handleSyncSuccess);
        window.addEventListener('syncerror', handleSyncError);

        return () => {
            window.removeEventListener('syncsuccess', handleSyncSuccess);
            window.removeEventListener('syncerror', handleSyncError);
        };
    }, [showToast]);

    const handleManualSync = async () => {
        if (isSyncing || !isOnline || isForcingSync) return;
        
        setIsForcingSync(true);
        showToast("Synchronisation complète lancée (Envoi + Réception)...", "info");
        
        try {
            await processSyncQueue();
            await syncFromCloud();
            showToast("Synchronisation complète réussie !", "success");
        } catch (error) {
            console.error("Manual sync failed:", error);
            showToast("Échec de la synchronisation", "error");
        } finally {
            setIsForcingSync(false);
            loadQueue();
        }
    };

    // Helper to match custom icons for other types
    const getEntityIcon = (entity: EntityType) => {
        switch (entity) {
            case 'ticket':
                return <WrenchScrewdriverIcon className="w-4 h-4 text-blue-400" />;
            case 'facture':
            case 'proforma':
                return <CurrencyEuroIcon className="w-4 h-4 text-emerald-400" />;
            case 'commande':
                return <ShoppingCartIcon className="w-4 h-4 text-amber-400" />;
            case 'simpleDocument':
            case 'storedDocument':
                return <ClipboardDocumentListIcon className="w-4 h-4 text-indigo-400" />;
            case 'engagementSav':
                return <ShieldCheckIcon className="w-4 h-4 text-purple-400" />;
            case 'stock':
            case 'stockUsage':
                return <CubeIcon className="w-4 h-4 text-teal-400" />;
            case 'appointment':
                return <CalendarDaysIcon className="w-4 h-4 text-pink-400" />;
            default:
                return <ClipboardDocumentListIcon className="w-4 h-4 text-zinc-400" />;
        }
    };

    // Helper to get French entity name
    const getEntityLabel = (entity: EntityType) => {
        switch (entity) {
            case 'ticket': return 'Fiche de réparation';
            case 'facture': return 'Facture';
            case 'proforma': return 'Facture Proforma';
            case 'commande': return 'Commande de pièces';
            case 'simpleDocument': return 'Document Administratif';
            case 'storedDocument': return 'Fichier stocké';
            case 'engagementSav': return 'Engagement SAV';
            case 'stock': return 'Fiche de Stock';
            case 'stockUsage': return 'Consommation Stock';
            case 'appointment': return 'Rendez-vous client';
            default: return 'Fiche d\'activité';
        }
    };

    // Clever parser to display rich metadata from queue payload
    const getItemDescriptionVal = (item: SyncQueueItem): string => {
        const payload = item.payload as Record<string, unknown> | undefined;
        if (!payload) return `Réf : #${item.entityId}`;

        if (typeof payload.customerName === 'string') return `Client : ${payload.customerName}`;
        if (typeof payload.clientName === 'string') return `Client : ${payload.clientName}`;
        if (typeof payload.name === 'string') return payload.name;
        if (typeof payload.title === 'string') return payload.title;
        if (typeof payload.client === 'string') return `Client : ${payload.client}`;
        if (typeof payload.model === 'string') return `Appareil : ${payload.model}`;
        if (typeof payload.number === 'string') return `N° ${payload.number}`;
        
        return `N° de série : #${item.entityId}`;
    };

    // Display Connection state
    const getConnectionQualityLabel = () => {
        if (!isOnline) return { label: 'Déconnecté (Rouge)', color: 'text-red-500 bg-red-500/10 border-red-500/20' };
        switch (quality) {
            case 1:
                return { label: 'Signal très faible (2G/Rouge)', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
            case 2:
                return { label: 'Lenteur détectée (3G/Orange)', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
            case 3:
                return { label: 'Signal Correct (H+/Orange)', color: 'text-orange-300 bg-orange-500/5 border-orange-500/15' };
            default:
                return { label: 'Signal Stable (4G+/Fibre/Vert)', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
        }
    };

    const connectionInfo = getConnectionQualityLabel();

    const isRed = !isOnline || quality <= 1;
    const isOrange = isOnline && (quality === 2 || quality === 3 || isSyncing || isForcingSync || pendingChanges > 0);

    const renderBars = () => {
        if (!isOnline) {
            return (
                <div className="flex gap-0.5 items-end h-3 relative">
                    <div className="w-0.5 h-1 bg-red-600/30"></div>
                    <div className="w-0.5 h-1.5 bg-red-600/30"></div>
                    <div className="w-0.5 h-2 bg-red-600/30"></div>
                    <div className="w-0.5 h-2.5 bg-red-600/30"></div>
                </div>
            );
        }
        return (
            <div className="flex gap-0.5 items-end h-3" title={`Qualité du signal : ${quality}/4`}>
                <div className={`w-0.5 h-1 rounded-sm ${quality >= 1 ? (isRed ? 'bg-red-500' : isOrange ? 'bg-orange-500' : 'bg-emerald-500') : 'bg-zinc-700'}`}></div>
                <div className={`w-0.5 h-1.5 rounded-sm ${quality >= 2 ? (isRed ? 'bg-red-500' : isOrange ? 'bg-orange-500' : 'bg-emerald-500') : 'bg-zinc-700'}`}></div>
                <div className={`w-0.5 h-2 rounded-sm ${quality >= 3 ? (isRed ? 'bg-red-500' : isOrange ? 'bg-orange-500' : 'bg-emerald-500') : 'bg-zinc-700'}`}></div>
                <div className={`w-0.5 h-2.5 rounded-sm ${quality >= 4 ? (isRed ? 'bg-red-500' : isOrange ? 'bg-orange-500' : 'bg-emerald-500') : 'bg-zinc-700'}`}></div>
            </div>
        );
    };

    return (
        <div className="relative">
            {/* Sync Header Trigger Pin */}
            <button
                id="sync-status-trigger-btn"
                onClick={() => setIsOpen(true)}
                className={`flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest px-3.5 py-2.5 rounded-full border transition-all active:scale-95 ${
                    isRed
                    ? 'text-red-400 bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                    : isOrange
                    ? 'text-orange-400 bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10'
                    : 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                }`}
                title={
                    isRed
                    ? "Connexion interrompue ou signal trop faible (Rouge). Cliquez pour inspecter la file d'attente hors ligne."
                    : isOrange
                    ? `${pendingChanges} modifications en attente ou signal instable/sync active (Orange). Cliquez pour voir le panneau.`
                    : "Connexion sécurisée, signal stable, entièrement synchronisé (Vert). Cliquez pour voir de près."
                }
            >
                {/* Visual state dots/spinners */}
                {isRed ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                ) : isOrange ? (
                    isSyncing || isForcingSync ? (
                        <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-orange-400 shrink-0" />
                    ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.6)]"></div>
                    )
                ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                )}

                <span className="font-mono">
                    {isRed 
                        ? 'HORS LIGNE' 
                        : isSyncing || isForcingSync 
                        ? 'SYNC EN COURS' 
                        : pendingChanges > 0 
                        ? `ATTENTE (${pendingChanges})` 
                        : 'SYNC CLOUD OK'
                    }
                </span>

                {/* Micro Signal monitor inline */}
                <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                    {renderBars()}
                </div>
            </button>

            {/* Sidebar Slide-out Drawer Panel (TGS Sync Center) */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop overlay */}
                        <motion.div
                            id="sync-sidebar-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black z-[999]"
                        />

                        {/* Content drawer */}
                        <motion.div
                            id="sync-sidebar-drawer"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-zinc-950 border-l border-white/15 shadow-2xl z-[1000] flex flex-col p-6 overflow-hidden select-none font-sans"
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5 shrink-0">
                                <div className="flex items-center gap-2">
                                    <GlobeAltIcon className="w-5 h-5 text-blue-400" />
                                    <div>
                                        <h2 className="text-sm font-black uppercase tracking-widest text-white italic">Régulateur de Synchronisation</h2>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">SÉCURISATION DES DONNÉES ATELIER</p>
                                    </div>
                                </div>
                                <button
                                    id="sync-drawer-close-btn"
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 px-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/5 transition-all active:scale-90"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Main scrollable body */}
                            <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-1 scrollbar-thin">
                                {/* State 1: Active Connection Status Shield */}
                                <div className="bg-zinc-900/60 rounded-2xl border border-white/5 p-4 space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">État du signal de l&apos;appareil</span>
                                        <div className="flex items-center gap-1.5">
                                            {renderBars()}
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${connectionInfo.color}`}>
                                                {connectionInfo.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Security promise details */}
                                    <div className="p-3 bg-zinc-950/80 rounded-xl border border-white/5 flex gap-2.5">
                                        <ShieldCheckIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <h4 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wide">Architecturation Anti-Bogue de Réseau</h4>
                                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                                                En cas d&apos;interventions dans des zones à faible signal, chaque ajout/modification reste scellé localement dans la base IndexedDB persistante de l&apos;appareil. Zéro perte de données possible.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Google Drive Realtime Sync Section */}
                                <div className="bg-zinc-900/60 rounded-2xl border border-white/5 p-4 space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Archivage Cloud Google Drive</span>
                                        {driveSyncStatus === 'synced' && (
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                Synchronisé
                                            </span>
                                        )}
                                        {driveSyncStatus === 'syncing' && (
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 flex items-center gap-1">
                                                <ArrowPathIcon className="w-2.5 h-2.5 animate-spin text-blue-400" />
                                                Sync en cours
                                            </span>
                                        )}
                                        {driveSyncStatus === 'offline_pending' && (
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                                En attente hors ligne ({driveMetadata.pendingCount || 1})
                                            </span>
                                        )}
                                        {driveSyncStatus === 'action_required' && (
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                                                Action requise
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-3.5 bg-zinc-950/80 rounded-xl border border-white/5 space-y-3">
                                        <div className="flex gap-2.5">
                                            <GlobeAltIcon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <h4 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wide">
                                                    {driveMetadata.driveConnected ? "Synchronisation permanente active" : "Liaison Google Drive requise"}
                                                </h4>
                                                <p className="text-[10px] text-zinc-400 leading-relaxed">
                                                    {driveMetadata.driveConnected ? (
                                                        <>
                                                            Vos fiches de réparations, pièces de stock, commandes et factures sont envoyées automatiquement et discrètement vers Google Drive ({driveMetadata.connectedEmail || user?.email}).
                                                        </>
                                                    ) : (
                                                        <>
                                                            Connectez votre compte Google une seule fois pour archiver automatiquement et discrètement toutes vos données sur Google Drive.
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        {driveMetadata.driveConnected && (
                                            <div className="pt-2 border-t border-white/5 flex flex-col gap-1.5 text-[10px]">
                                                <div className="flex justify-between items-center text-zinc-500">
                                                    <span>Compte lié :</span>
                                                    <span className="font-mono text-zinc-300 font-bold truncate max-w-[180px]">
                                                        {driveMetadata.connectedEmail || user?.email}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-zinc-500">
                                                    <span>Dernière sauvegarde Drive :</span>
                                                    <span className="font-mono text-blue-400 font-black">
                                                        {driveMetadata.lastSyncTime 
                                                            ? new Date(driveMetadata.lastSyncTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
                                                            : gdriveLastSyncTime 
                                                            ? gdriveLastSyncTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                                            : 'En attente...'
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Buttons and triggers */}
                                    {driveSyncStatus === 'action_required' ? (
                                        <button
                                            id="gdrive-reauthorize-drawer-btn"
                                            onClick={() => signInWithGoogle(false)}
                                            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                                        >
                                            <ArrowPathIcon className="w-3.5 h-3.5" />
                                            <span>Réautoriser Google Drive</span>
                                        </button>
                                    ) : driveMetadata.driveConnected ? (
                                        <button
                                            id="gdrive-force-sync-btn"
                                            onClick={handleForceGdriveSync}
                                            disabled={!isOnline || gdriveSyncing}
                                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black rounded-xl uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                                        >
                                            {gdriveSyncing ? (
                                                <>
                                                    <ArrowPathIcon className="w-4 h-4 animate-spin text-white" />
                                                    <span>Sauvegarde en cours...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ArrowPathIcon className="w-3.5 h-3.5" />
                                                    <span>Synchroniser maintenant</span>
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            id="gdrive-connect-and-sync-btn"
                                            onClick={() => signInWithGoogle(false)}
                                            disabled={!isOnline}
                                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 shadow-lg"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                                            <span>Lier Google Drive</span>
                                        </button>
                                    )}
                                </div>

                                {/* Sync Queue Entries Section */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                                            File d&apos;attente ({queueItems.length} en attente)
                                        </span>
                                        {queueItems.length > 0 && (
                                            <span className="text-[9px] text-zinc-500 font-mono italic">
                                                IDB → FIRESTORE CLOUD
                                            </span>
                                        )}
                                    </div>

                                    {queueItems.length === 0 ? (
                                        // Green Success State
                                        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-3">
                                            <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                                                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-zinc-200">Base locale à jour</h4>
                                                <p className="text-[10px] text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                                                    Zéro modification en attente. Toutes vos modifications ont été transférées et stockées avec succès sur l&apos;infrastructure Cloud TGS.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        // Interactive Queue List
                                        <div className="space-y-2">
                                            {queueItems.map((item) => {
                                                const isExpanded = expandedItem === item.id;
                                                const formattedTime = new Date(item.timestamp).toLocaleTimeString();
                                                const displayDesc = getItemDescriptionVal(item);

                                                return (
                                                    <div 
                                                        key={item.id}
                                                        className="bg-zinc-900/40 rounded-xl border border-white/5 overflow-hidden transition-all hover:bg-zinc-900/60"
                                                    >
                                                        {/* Row click triggers payload expand */}
                                                        <div 
                                                            className="p-3.5 flex items-center justify-between cursor-pointer"
                                                            onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="p-1.5 bg-zinc-950 rounded-lg border border-white/5 shrink-0">
                                                                    {getEntityIcon(item.entity)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="text-[10px] font-bold text-zinc-200 truncate uppercase tracking-wide">
                                                                            {getEntityLabel(item.entity)}
                                                                        </span>
                                                                        <span className={`text-[8px] font-black uppercase px-1 rounded-sm ${
                                                                            item.operation === 'delete' ? 'text-red-400 bg-red-400/10' : 'text-green-400 bg-green-400/10'
                                                                        }`}>
                                                                            {item.operation === 'delete' ? 'SUPPR' : 'MÀJ / AJOUT'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] text-zinc-400 truncate font-semibold mt-0.5" title={displayDesc}>
                                                                        {displayDesc}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2 font-mono text-[9px] text-zinc-500 shrink-0">
                                                                <ClockIcon className="w-3 h-3 text-zinc-600" />
                                                                <span>{formattedTime}</span>
                                                            </div>
                                                        </div>

                                                        {/* Collapsible details inspect view */}
                                                        <AnimatePresence>
                                                            {isExpanded && (
                                                                <motion.div
                                                                    initial={{ height: 0 }}
                                                                    animate={{ height: 'auto' }}
                                                                    exit={{ height: 0 }}
                                                                    className="overflow-hidden border-t border-white/5"
                                                                >
                                                                    <div className="p-3 bg-zinc-950 font-mono text-[8px] text-zinc-400 space-y-1 ml-1 select-text">
                                                                        <div>
                                                                            <span className="text-zinc-600">ID Unique local:</span> {item.id}
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-zinc-600">Entity Identifiant:</span> {item.entityId}
                                                                        </div>
                                                                        {item.payload && (
                                                                            <div className="mt-1">
                                                                                <span className="text-zinc-600">Champs modifiés:</span>
                                                                                <pre className="mt-1 p-1.5 bg-zinc-900 border border-white/5 rounded text-zinc-500 max-h-24 overflow-y-auto overflow-x-auto text-[7.5px] leading-tight">
                                                                                    {JSON.stringify(item.payload, null, 2)}
                                                                                </pre>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Drawer action footer */}
                            <div className="border-t border-white/10 pt-4 mt-4 space-y-2 shrink-0">
                                {queueItems.length > 0 && (
                                    <button
                                        id="force-sync-drawer-btn"
                                        onClick={handleManualSync}
                                        disabled={!isOnline || isSyncing || isForcingSync}
                                        className="w-full py-4 bg-white text-black hover:bg-zinc-200 disabled:opacity-40 font-black rounded-xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl"
                                    >
                                        {isSyncing || isForcingSync ? (
                                            <>
                                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                <span>Synchronisation en cours...</span>
                                            </>
                                        ) : !isOnline ? (
                                            <>
                                                <ExclamationTriangleIcon className="w-4 h-4 text-zinc-900" />
                                                <span>Hors Ligne - Attente Connexion</span>
                                            </>
                                        ) : (
                                            <>
                                                <ArrowPathIcon className="w-4 h-4" />
                                                <span>Forcer la synchronisation (${queueItems.length})</span>
                                            </>
                                        )}
                                    </button>
                                )}

                                {!isOnline && (
                                    <div className="p-3 bg-red-950/10 border border-red-500/10 rounded-xl flex gap-2 items-center text-red-400">
                                        <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                                        <span className="text-[10px] font-bold leading-normal">
                                            Réseau indisponible sur votre appareil. L&apos;application continuera de fonctionner localement sans aucun problème.
                                        </span>
                                    </div>
                                )}

                                <div className="text-center">
                                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest font-mono">
                                        🔒 TGSCI SECURE SYNCHRONIZER
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SyncStatusIndicator;
