import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSyncStatus } from '../hooks/useSyncStatus.ts';
import { useNetworkQuality } from '../hooks/useNetworkQuality.ts';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { 
    dbGetSyncQueue, 
    dbClearSyncQueue,
    dbGetTickets, 
    dbGetAppointments, 
    dbGetStock, 
    dbGetFactures, 
    dbGetCommandes 
} from '../services/dbService.ts';
import { processSyncQueue, syncFromCloud, requeueRecentLocalRecords, pushMissingLocalTicketsToCloud, CatchUpTicketsReport } from '../services/syncService.ts';
import { runSyncIntegritySelfTests, SyncSelfTestSuiteResult } from '../utils/syncIntegrityRunner.ts';
import { SyncQueueItem, EntityType } from '../types.ts';
import { getSyncLogs, clearSyncLogs, SyncLogEntry } from '../utils/syncLogHelper.ts';
import { 
    Database, 
    Wifi, 
    WifiOff, 
    RefreshCw, 
    AlertTriangle, 
    CheckCircle2, 
    List, 
    Server, 
    FileText, 
    Layers, 
    ShieldAlert,
    ChevronDown,
    ChevronUp,
    Check,
    History,
    Search,
    Trash2,
    Info,
    LogIn,
    Upload
} from 'lucide-react';

export const SyncDiagnosticPanel: React.FC = () => {
    const { showToast } = useToastContext();
    const { user, authReady, signInWithGoogle, isReconnectingGoogle } = useFirebase();
    const isOnline = useOnlineStatus();
    const networkQuality = useNetworkQuality();
    const { pendingChanges, pendingTickets, unsyncedTickets, lastIntegrityCheckAt, lastSync, lastPushSucceeded, lastError, isQuotaExceeded } = useSyncStatus();

    // Local state for counts
    const [counts, setCounts] = useState({
        tickets: 0,
        appointments: 0,
        stock: 0,
        factures: 0,
        commandes: 0
    });
    
    // UI Local sync progress
    const [localSyncingState, setLocalSyncingState] = useState<'idle' | 'sending' | 'receiving' | 'done' | 'error'>('idle');
    const [localQueue, setLocalQueue] = useState<SyncQueueItem[]>([]);
    const [showQueueDetails, setShowQueueDetails] = useState(false);
    const [showSystemVolume, setShowSystemVolume] = useState(false);
    const [confirmClearQueue, setConfirmClearQueue] = useState(false);
    const [isCatchingUp, setIsCatchingUp] = useState(false);
    const [catchUpProgress, setCatchUpProgress] = useState('');
    const [catchUpReport, setCatchUpReport] = useState<CatchUpTicketsReport | null>(null);
    const [isRunningSelfTest, setIsRunningSelfTest] = useState(false);
    const [selfTestSuite, setSelfTestSuite] = useState<SyncSelfTestSuiteResult | null>(null);
    
    // New States for Sync Logs
    const [showSyncLogs, setShowSyncLogs] = useState(false);
    const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
    const [searchLogQuery, setSearchLogQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');

    // Load local database entity counts
    const loadLocalDatabaseCounts = async () => {
        try {
            const [tickets, appointments, stock, factures, commandes, queue] = await Promise.all([
                dbGetTickets().catch(() => []),
                dbGetAppointments().catch(() => []),
                dbGetStock().catch(() => []),
                dbGetFactures().catch(() => []),
                dbGetCommandes().catch(() => []),
                dbGetSyncQueue().catch(() => [])
            ]);

            setCounts({
                tickets: tickets.length,
                appointments: appointments.length,
                stock: stock.length,
                factures: factures.length,
                commandes: commandes.length
            });
            setLocalQueue(queue);
        } catch (error) {
            console.error("Failed to load local database counts for diagnostics:", error);
        }
    };

    useEffect(() => {
        loadLocalDatabaseCounts();

        // Refresh counts on data updates
        const handleDataChange = () => {
            loadLocalDatabaseCounts();
        };

        window.addEventListener('datareceived', handleDataChange);
        window.addEventListener('datachanged', handleDataChange);
        window.addEventListener('requestsync', handleDataChange);
        window.addEventListener('syncerror', handleDataChange);

        return () => {
            window.removeEventListener('datareceived', handleDataChange);
            window.removeEventListener('datachanged', handleDataChange);
            window.removeEventListener('requestsync', handleDataChange);
            window.removeEventListener('syncerror', handleDataChange);
        };
    }, []);

    // Load and subscribe to sync logs
    useEffect(() => {
        const loadLogs = () => {
            setSyncLogs(getSyncLogs());
        };
        loadLogs();

        window.addEventListener('synclogs_updated', loadLogs);
        return () => {
            window.removeEventListener('synclogs_updated', loadLogs);
        };
    }, []);

    const handleClearLogs = () => {
        clearSyncLogs();
        showToast("Historique des événements de synchronisation effacé.", "success");
    };

    const handleClearQueue = async () => {
        if (!confirmClearQueue) {
            setConfirmClearQueue(true);
            showToast("Cliquez à nouveau pour CONFIRMER la suppression de la file d'attente.", "warning");
            setTimeout(() => setConfirmClearQueue(false), 4000); // Reset after 4 seconds
            return;
        }

        try {
            await dbClearSyncQueue();
            setConfirmClearQueue(false);
            showToast("La file d'attente de synchronisation locale a été vidée.", "success");
            await loadLocalDatabaseCounts();
            // Dispatch event to inform other components
            window.dispatchEvent(new CustomEvent('datachanged'));
        } catch (err) {
            console.error("Failed to clear sync queue:", err);
            showToast("Échec du vidage de la file d'attente.", "error");
        }
    };

    const filteredLogs = useMemo(() => {
        return syncLogs.filter(log => {
            const matchesSearch = 
                log.details.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
                log.operator.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
                log.type.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
                log.action.toLowerCase().includes(searchLogQuery.toLowerCase());
            
            const matchesStatus = 
                statusFilter === 'all' || 
                log.status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });
    }, [syncLogs, searchLogQuery, statusFilter]);

    const handleForceSync = async () => {
        if (!isOnline) {
            showToast("La synchronisation requiert une connexion Internet active.", "warning");
            return;
        }
        if (!user) {
            showToast("Veuillez d'abord connecter votre compte Google pour synchroniser avec le Cloud.", "warning");
            await signInWithGoogle(false);
            return;
        }
        if (localSyncingState !== 'idle' && localSyncingState !== 'done' && localSyncingState !== 'error') return;

        setLocalSyncingState('sending');
        showToast("Lancement de la synchronisation complète (Envoi + Réception)...", "info");

        try {
            // Étape 0 : réindexer les fiches des dernières 48h éventuellement manquantes de la file
            await requeueRecentLocalRecords(48);

            // Étape 1 : envoyer les modifications locales vers le Cloud
            const pushResult = await processSyncQueue(true);
            if (!pushResult.ok) {
                throw new Error(pushResult.error || "Certaines fiches n'ont pas pu être envoyées.");
            }

            // Étape 2 : télécharger les modifications distantes
            setLocalSyncingState('receiving');
            await syncFromCloud(true);

            setLocalSyncingState('done');
            showToast("Base de données synchronisée avec succès !", "success");

            window.dispatchEvent(new CustomEvent('datareceived'));
            await loadLocalDatabaseCounts();
        } catch (error) {
            console.error("Diagnostic manual sync failed:", error);
            setLocalSyncingState('error');
            const errMsg = error instanceof Error ? error.message : "Erreur de synchronisation. Veuillez réessayer.";
            showToast(errMsg, "error");
            await loadLocalDatabaseCounts();
        } finally {
            setTimeout(() => {
                setLocalSyncingState('idle');
            }, 3000);
        }
    };

    const handleRequeueRecent = async () => {
        try {
            const count = await requeueRecentLocalRecords(48);
            await loadLocalDatabaseCounts();
            if (count > 0) {
                showToast(`${count} fiche(s) récente(s) replacée(s) en file d'attente pour synchronisation.`, "success");
                if (user && isOnline) {
                    processSyncQueue(true).catch(console.error);
                }
            } else {
                showToast("Toutes les fiches des dernières 48h sont déjà indexées.", "info");
            }
        } catch (err) {
            console.error("Requeue recent failed:", err);
            showToast("Impossible de réindexer les fiches récentes.", "error");
        }
    };

    const handlePushMissingTickets = async () => {
        if (!isOnline) {
            showToast("Connexion Internet requise pour envoyer les fiches en attente.", "warning");
            return;
        }
        if (!user) {
            showToast("Veuillez d'abord connecter votre compte Google pour comparer avec le Cloud.", "warning");
            await signInWithGoogle(false);
            return;
        }
        if (isCatchingUp) return;

        setIsCatchingUp(true);
        setCatchUpProgress('Comparaison des fiches locales avec le Cloud...');
        try {
            const report = await pushMissingLocalTicketsToCloud((msg) => setCatchUpProgress(msg));
            setCatchUpReport(report);
            await loadLocalDatabaseCounts();

            if (report.missingFound === 0) {
                showToast("Toutes les fiches locales sont déjà présentes dans le Cloud.", "success");
            } else if (report.failed.length === 0) {
                showToast(
                    `${report.sent.length} fiche(s) manquante(s) envoyée(s) vers le Cloud${report.renumbered.length > 0 ? ` (${report.renumbered.length} renumérotée(s))` : ''}.`,
                    "success"
                );
            } else {
                showToast(
                    `Rattrapage partiel : ${report.sent.length} envoyée(s), ${report.failed.length} en échec.`,
                    "error"
                );
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            showToast(`Échec du rattrapage Cloud : ${errMsg}`, "error");
        } finally {
            setIsCatchingUp(false);
            setCatchUpProgress('');
        }
    };

    const handleRunSelfTest = async () => {
        if (isRunningSelfTest) return;
        setIsRunningSelfTest(true);
        try {
            const suite = await runSyncIntegritySelfTests();
            setSelfTestSuite(suite);
            if (suite.allPassed) {
                showToast('Auto-test synchro : 4/4 scénarios validés en mémoire (0 écriture Cloud).', 'success');
            } else {
                showToast('Auto-test synchro : au moins un scénario a échoué.', 'error');
            }
        } catch (err) {
            showToast(`Erreur auto-test : ${err instanceof Error ? err.message : String(err)}`, 'error');
        } finally {
            setIsRunningSelfTest(false);
        }
    };

    // Helper to format Date beautifully
    const formatSyncDate = (date: Date | null | string) => {
        if (!date) return 'Aucune enregistrée';
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Date non valide';
        return d.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Connection Quality Label formatting
    const connectionQualityLabel = useMemo(() => {
        if (!isOnline) {
            return {
                text: 'Hors Ligne (Mode Local Actif)',
                color: 'text-red-400',
                bgColor: 'bg-red-500/10',
                borderColor: 'border-red-500/20'
            };
        }
        switch (networkQuality) {
            case 1:
                return {
                    text: 'Débit très faible (2G)',
                    color: 'text-rose-400',
                    bgColor: 'bg-rose-500/10',
                    borderColor: 'border-rose-500/20'
                };
            case 2:
                return {
                    text: 'Connexion lente (3G)',
                    color: 'text-orange-400',
                    bgColor: 'bg-orange-500/10',
                    borderColor: 'border-orange-500/20'
                };
            case 3:
                return {
                    text: 'Connexion correcte (H+/4G moyenne)',
                    color: 'text-amber-400',
                    bgColor: 'bg-amber-500/5',
                    borderColor: 'border-amber-500/15'
                };
            case 4:
            default:
                return {
                    text: 'Connexion stable (4G LTE / Fibre)',
                    color: 'text-emerald-400',
                    bgColor: 'bg-emerald-500/10',
                    borderColor: 'border-emerald-500/25'
                };
        }
    }, [isOnline, networkQuality]);

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
            default: return `Dossier ${entity}`;
        }
    };

    const getItemDescription = (item: SyncQueueItem): string => {
        const payload = item.payload as Record<string, unknown> | undefined;
        if (!payload) return `ID: ${item.entityId}`;

        if (typeof payload.customerName === 'string') return `Client: ${payload.customerName}`;
        if (typeof payload.clientName === 'string') return `Client: ${payload.clientName}`;
        if (typeof payload.name === 'string') return payload.name;
        if (typeof payload.title === 'string') return payload.title;
        if (typeof payload.client === 'string') return `Client: ${payload.client}`;
        if (typeof payload.model === 'string') return `Modèle: ${payload.model}`;
        if (typeof payload.number === 'string') return `Numéro: ${payload.number}`;
        
        return `ID Dossier: ${item.entityId}`;
    };

    const getActionTypeLabel = (operation?: 'put' | 'delete' | string) => {
        switch (operation) {
            case 'put': return { text: 'MÀJ / AJOUT', style: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
            case 'delete': return { text: 'SUPPR', style: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };
            case 'CREATE': return { text: 'Nouveau', style: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
            case 'UPDATE': return { text: 'Modification', style: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' };
            case 'DELETE': return { text: 'Suppression', style: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };
            default: return { text: operation || 'MODIF', style: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20' };
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-zinc-900/45 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden shadow-2xl p-6 md:p-8 space-y-6"
        >
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 text-white shadow-inner">
                        <Database className="w-6 h-6 text-apple-blue animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Console de Diagnostic Cloud</h3>
                        <p className="text-apple-muted text-xs font-bold uppercase tracking-widest mt-0.5">Vérification de l&apos;intégrité et synchronisation Firebase</p>
                    </div>
                </div>

                {/* Network Quality Capsule */}
                <div className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border ${connectionQualityLabel.bgColor} ${connectionQualityLabel.borderColor}`}>
                    {isOnline ? (
                        <Wifi className={`w-4 h-4 ${connectionQualityLabel.color}`} />
                    ) : (
                        <WifiOff className="w-4 h-4 text-red-400" />
                    )}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${connectionQualityLabel.color}`}>
                        {connectionQualityLabel.text}
                    </span>
                </div>
            </div>

            {/* Quick Diagnostic Status Cards */}
            {(() => {
                const queuedTicketIds = new Set(
                    localQueue.filter(q => q.entity === 'ticket').map(q => q.entityId.trim().toUpperCase()),
                );
                const extraUnsyncedCount = unsyncedTickets.filter(
                    u => !queuedTicketIds.has(u.id.trim().toUpperCase()),
                ).length;
                const combinedQueueCount = localQueue.length + extraUnsyncedCount;
                const effectivePendingCount = Math.max(pendingTickets, pendingChanges, unsyncedTickets.length, combinedQueueCount);
                const hasUnsentItems = effectivePendingCount > 0;
                const hasRedIncident = !isOnline || Boolean(isQuotaExceeded) || Boolean(lastError) || (!lastPushSucceeded && !hasUnsentItems);
                const hasOrangeUnsent = !hasRedIncident && hasUnsentItems;
                const needsAuthWarning = !hasRedIncident && !hasOrangeUnsent && ((authReady && !user) || (!lastSync && counts.tickets === 0));
                const isTrulyUpToDate = !hasRedIncident && !hasOrangeUnsent && !needsAuthWarning && unsyncedTickets.length === 0;

                return (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* CARD 1: Sync Health */}
                        <div className={`border p-5 rounded-2xl flex items-start gap-4 ${
                            hasRedIncident
                                ? 'bg-red-950/20 border-red-500/30'
                                : (hasOrangeUnsent || needsAuthWarning)
                                ? 'bg-orange-950/20 border-orange-500/35'
                                : 'bg-white/5 border-white/5'
                        }`}>
                            <div className="mt-1">
                                {hasRedIncident ? (
                                    <div className="p-2.5 bg-red-500/15 rounded-xl border border-red-500/30">
                                        <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
                                    </div>
                                ) : (hasOrangeUnsent || needsAuthWarning) ? (
                                    <div className="p-2.5 bg-orange-500/15 rounded-xl border border-orange-500/30">
                                        <AlertTriangle className="w-5 h-5 text-orange-400 animate-pulse" />
                                    </div>
                                ) : (
                                    <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-apple-muted">État Global</span>
                                <h4 className={`text-sm font-black uppercase tracking-tight ${
                                    hasRedIncident
                                        ? 'text-red-300'
                                        : hasOrangeUnsent
                                        ? 'text-orange-300'
                                        : 'text-white'
                                }`}>
                                    {hasUnsentItems
                                        ? `${effectivePendingCount} fiche(s) non envoyée(s)`
                                        : !isOnline
                                        ? "Mode Hors Ligne Actif"
                                        : isQuotaExceeded
                                        ? "Quota Cloud Journalier Atteint"
                                        : (!lastPushSucceeded || lastError)
                                        ? "Échec d'envoi vers le Cloud"
                                        : authReady && !user
                                        ? "Connexion Google Requise"
                                        : !lastSync && counts.tickets === 0
                                        ? "Synchronisation Initiale Requise"
                                        : isTrulyUpToDate
                                        ? "Instance Parfaitement à Jour"
                                        : "Synchronisation Requise"}
                                </h4>
                                <p className={`text-xs leading-relaxed ${
                                    hasRedIncident
                                        ? 'text-red-200/90'
                                        : hasOrangeUnsent
                                        ? 'text-orange-200/90'
                                        : 'text-zinc-400'
                                }`}>
                                    {lastError
                                        ? lastError
                                        : hasUnsentItems
                                        ? (!isOnline
                                            ? "Appareil hors ligne : ces fiches sont sécurisées en local et partiront dès le retour du réseau."
                                            : "Des fiches locales ou provisoires ne sont pas encore confirmées sur Firestore.")
                                        : !isOnline
                                        ? "Stockage autonome hors ligne actif. Reconnectez-vous pour synchroniser."
                                        : authReady && !user
                                        ? "Cet appareil n'est pas connecté à Google. Connectez votre compte atelier pour télécharger et envoyer les fiches."
                                        : isQuotaExceeded
                                        ? "Le quota journalier de lectures Cloud Firestore est temporairement dépassé. Vos fiches locales sont protégées et restent en attente."
                                        : !lastPushSucceeded
                                        ? "Le dernier envoi vers le Cloud n'a pas été confirmé."
                                        : !lastSync && counts.tickets === 0
                                        ? "Aucune fiche locale pour le moment. Connectez Google et lancez la synchronisation."
                                        : "Toutes vos modifications ont bien été transmises et confirmées sur le Cloud."}
                                </p>
                            </div>
                        </div>

                        {/* CARD 2: Last cloud verification */}
                        <div className="bg-white/5 border border-white/5 p-5 rounded-2xl flex items-start gap-4">
                            <div className="mt-1 p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                <Server className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-apple-muted">Dernière Connexion</span>
                                <h4 className="text-sm font-black text-white uppercase tracking-tight">
                                    {user ? (lastSync ? "Cloud Vérifié" : "Connecté — En attente") : "Non Connecté"}
                                </h4>
                                <p className="text-xs text-zinc-300 font-semibold">
                                    {user ? (user.email || formatSyncDate(lastSync)) : 'Compte Google non lié'}
                                </p>
                                <p className="text-[10px] text-zinc-400">
                                    {user && lastSync
                                        ? `Dernier échange : ${formatSyncDate(lastSync)}`
                                        : "La vérification télécharge les changements d'autres postes de travail."}
                                </p>
                            </div>
                        </div>

                        {/* CARD 3: Forced Trigger Action + Catch-up */}
                        <div className="bg-white/5 border border-white/5 p-5 rounded-2xl flex flex-col justify-between gap-2.5">
                            <div className="space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-apple-muted">Action Manuelle</span>
                                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                                    {authReady && !user ? "Lier cet appareil au Cloud" : "Mise à jour & rattrapage"}
                                </h4>
                                <p className="text-[10px] text-zinc-400 leading-normal">
                                    {authReady && !user
                                        ? "Connectez votre compte Google autorisé pour récupérer immédiatement toutes les fiches sur cet ordinateur."
                                        : "Comparez les fiches locales avec le Cloud ou forcez un cycle complet Envoi + Réception."}
                                </p>
                            </div>

                            {authReady && !user ? (
                                <button
                                    onClick={() => signInWithGoogle(false)}
                                    disabled={!isOnline || isReconnectingGoogle}
                                    className="mt-2 w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-xl disabled:opacity-40"
                                >
                                    <LogIn className="w-3.5 h-3.5" />
                                    <span>{isReconnectingGoogle ? "Connexion..." : "Connecter Google & Synchroniser"}</span>
                                </button>
                            ) : (
                                <div className="space-y-2 mt-1">
                                    <button
                                        onClick={handlePushMissingTickets}
                                        disabled={!isOnline || isCatchingUp}
                                        className="w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white active:scale-95 shadow-lg"
                                    >
                                        {isCatchingUp ? (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span className="truncate">{catchUpProgress || 'Envoi en cours...'}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-3.5 h-3.5" />
                                                <span>Envoyer les fiches en attente</span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={handleForceSync}
                                        disabled={localSyncingState !== 'idle' && localSyncingState !== 'done' && localSyncingState !== 'error'}
                                        className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${
                                            localSyncingState === 'sending' || localSyncingState === 'receiving'
                                                ? 'bg-amber-600 text-white cursor-wait'
                                                : localSyncingState === 'done'
                                                ? 'bg-emerald-600 text-white'
                                                : localSyncingState === 'error'
                                                ? 'bg-red-600 text-white'
                                                : 'bg-white text-black hover:bg-zinc-200 active:scale-95 shadow-xl'
                                        }`}
                                    >
                                        {localSyncingState === 'sending' && (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Transfert des fiches...</span>
                                            </>
                                        )}
                                        {localSyncingState === 'receiving' && (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Réception depuis le Cloud...</span>
                                            </>
                                        )}
                                        {localSyncingState === 'done' && (
                                            <>
                                                <Check className="w-3.5 h-3.5" />
                                                <span>Synchronisation Réussie !</span>
                                            </>
                                        )}
                                        {localSyncingState === 'error' && (
                                            <>
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                <span>Échec, Réessayez</span>
                                            </>
                                        )}
                                        {localSyncingState === 'idle' && (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5" />
                                                <span>Forcer la synchronisation</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={handleRunSelfTest}
                                disabled={isRunningSelfTest}
                                className="w-full py-2 px-4 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-200 disabled:opacity-50"
                                title="Exécute 4 tests strictement en mémoire sans modifier ni lire le Cloud réel"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{isRunningSelfTest ? 'Tests en cours...' : 'Auto-test synchro'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Liste explicite en orange des fiches locales non envoyées / provisoires */}
                    {unsyncedTickets.length > 0 && (
                        <div className="bg-orange-950/25 border border-orange-500/35 rounded-2xl p-5 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-orange-300 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                                        {effectivePendingCount} fiche(s) non envoyée(s)
                                    </h4>
                                    <p className="text-[11px] text-orange-200/80 mt-0.5">
                                        Ces fiches locales sont absentes du Cloud ou encore marquées provisoires.
                                        {lastIntegrityCheckAt ? ` Dernière vérification : ${formatSyncDate(lastIntegrityCheckAt)}.` : ''}
                                    </p>
                                </div>
                                <button
                                    onClick={handlePushMissingTickets}
                                    disabled={!isOnline || isCatchingUp}
                                    className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-black font-black text-[10px] uppercase tracking-wider transition-all"
                                >
                                    Envoyer les fiches en attente
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                                {unsyncedTickets.map((t) => (
                                    <div key={t.id} className="p-2.5 rounded-xl bg-black/40 border border-orange-500/25 flex items-center justify-between gap-2 text-xs">
                                        <div className="min-w-0">
                                            <div className="font-mono font-bold text-orange-200 truncate">{t.id}</div>
                                            <div className="text-[11px] text-white font-semibold truncate">{t.clientName}</div>
                                            <div className="text-[10px] text-zinc-400 truncate">{t.macModel}</div>
                                        </div>
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 shrink-0">
                                            {t.isProvisional ? 'Provisoire' : 'Absente Cloud'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    </>
                );
            })()}

            {/* Résultats Auto-test synchro (strictement en mémoire) */}
            {selfTestSuite && (
                <div className={`rounded-2xl border p-5 space-y-3 ${
                    selfTestSuite.allPassed
                        ? 'bg-emerald-950/15 border-emerald-500/30'
                        : 'bg-red-950/20 border-red-500/30'
                }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-white">
                                Auto-test synchro (en mémoire — 0 écriture Cloud)
                            </h4>
                            <p className="text-[11px] text-zinc-400">
                                Exécuté le {formatSyncDate(selfTestSuite.executedAt)} — {selfTestSuite.results.filter(r => r.passed).length}/{selfTestSuite.results.length} réussi(s)
                            </p>
                        </div>
                        <button
                            onClick={() => setSelfTestSuite(null)}
                            className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/5"
                        >
                            Fermer
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {selfTestSuite.results.map((res) => (
                            <div
                                key={res.id}
                                className={`p-3 rounded-xl border text-xs space-y-1 ${
                                    res.passed
                                        ? 'bg-black/30 border-emerald-500/25'
                                        : 'bg-red-950/30 border-red-500/35'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-white">
                                        Test ({res.id}) : {res.title}
                                    </span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                        res.passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                                    }`}>
                                        {res.passed ? 'OK' : 'ÉCHEC'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-zinc-300 leading-relaxed">{res.details}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Rapport de rattrapage des fiches manquantes */}
            {catchUpReport && (
                <div className={`rounded-2xl border p-5 space-y-3 ${
                    catchUpReport.failed.length > 0
                        ? 'bg-red-950/20 border-red-500/30'
                        : 'bg-emerald-950/15 border-emerald-500/25'
                }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-white">
                                Rapport d&apos;envoi des fiches manquantes
                            </h4>
                            <p className="text-[11px] text-zinc-400">
                                Comparaison : {catchUpReport.totalLocal} fiche(s) locales vs {catchUpReport.totalCloud} dans le Cloud — {catchUpReport.missingFound} manquante(s) détectée(s).
                            </p>
                        </div>
                        <button
                            onClick={() => setCatchUpReport(null)}
                            className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/5"
                        >
                            Fermer
                        </button>
                    </div>

                    {catchUpReport.missingFound === 0 ? (
                        <p className="text-xs text-emerald-300 font-semibold">
                            Toutes les fiches locales sont déjà présentes dans le Cloud.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div className="bg-black/30 border border-emerald-500/20 rounded-xl p-3 space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                                    Envoyées ({catchUpReport.sent.length})
                                </span>
                                {catchUpReport.sent.length === 0 ? (
                                    <p className="text-zinc-500 text-[11px]">Aucune</p>
                                ) : (
                                    <p className="text-zinc-200 font-mono text-[11px] break-all">
                                        {catchUpReport.sent.join(', ')}
                                    </p>
                                )}
                            </div>

                            <div className="bg-black/30 border border-blue-500/20 rounded-xl p-3 space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block">
                                    Renumérotées ({catchUpReport.renumbered.length})
                                </span>
                                {catchUpReport.renumbered.length === 0 ? (
                                    <p className="text-zinc-500 text-[11px]">Aucune collision</p>
                                ) : (
                                    <ul className="space-y-0.5 text-[11px] font-mono text-blue-200">
                                        {catchUpReport.renumbered.map((r) => (
                                            <li key={`${r.oldId}-${r.newId}`}>
                                                {r.oldId} &rarr; {r.newId}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="bg-black/30 border border-red-500/20 rounded-xl p-3 space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-red-400 block">
                                    Échouées ({catchUpReport.failed.length})
                                </span>
                                {catchUpReport.failed.length === 0 ? (
                                    <p className="text-zinc-500 text-[11px]">Aucun échec</p>
                                ) : (
                                    <ul className="space-y-1 text-[11px] text-red-300">
                                        {catchUpReport.failed.map((f) => (
                                            <li key={f.id} className="break-words">
                                                <strong className="font-mono">{f.id}</strong> : {f.reason}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Sub-panels triggers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/5">
                {/* Trigger 1: System volumes counters */}
                <button
                    onClick={() => {
                        setShowSystemVolume(!showSystemVolume);
                        setShowQueueDetails(false);
                        setShowSyncLogs(false);
                    }}
                    className={`flex items-center justify-between p-4 rounded-2xl bg-zinc-900/40 border transition-all text-left ${
                        showSystemVolume ? 'border-apple-blue/50 bg-white/5' : 'border-white/5 hover:border-white/10 text-white'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <Layers className={`w-4 h-4 ${showSystemVolume ? 'text-apple-blue' : 'text-zinc-400'}`} />
                        <div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-apple-muted block leading-none mb-1">Volume local</span>
                            <span className="text-xs font-bold text-white uppercase tracking-tight">Fiches stockées en local</span>
                        </div>
                    </div>
                    {showSystemVolume ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                </button>

                {/* Trigger 2: Offline file contents list */}
                <button
                    onClick={() => {
                        setShowQueueDetails(!showQueueDetails);
                        setShowSystemVolume(false);
                        setShowSyncLogs(false);
                    }}
                    className={`flex items-center justify-between p-4 rounded-2xl bg-zinc-900/40 border transition-all text-left ${
                        showQueueDetails ? 'border-amber-500/50 bg-white/5' : 'border-white/5 hover:border-white/10 text-white'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <List className={`w-4 h-4 ${showQueueDetails ? 'text-amber-400' : 'text-zinc-400'}`} />
                        <div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-apple-muted block leading-none mb-1">File d&apos;attente</span>
                            <span className={`text-xs font-bold uppercase tracking-tight ${
                                Math.max(pendingTickets, pendingChanges, unsyncedTickets.length, localQueue.length) > 0
                                    ? 'text-orange-300'
                                    : 'text-white'
                            }`}>
                                {Math.max(pendingTickets, pendingChanges, unsyncedTickets.length, localQueue.length) === 0
                                    ? "Aucune en attente"
                                    : `${Math.max(pendingTickets, pendingChanges, unsyncedTickets.length, localQueue.length)} fiche(s) en attente`}
                            </span>
                        </div>
                    </div>
                    {showQueueDetails ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                </button>

                {/* Trigger 3: Sync event logs history */}
                <button
                    onClick={() => {
                        setShowSyncLogs(!showSyncLogs);
                        setShowSystemVolume(false);
                        setShowQueueDetails(false);
                    }}
                    className={`flex items-center justify-between p-4 rounded-2xl bg-zinc-900/40 border transition-all text-left ${
                        showSyncLogs ? 'border-purple-500/50 bg-white/5' : 'border-white/5 hover:border-white/10 text-white'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <History className={`w-4 h-4 ${showSyncLogs ? 'text-purple-400' : 'text-zinc-400'}`} />
                        <div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-apple-muted block leading-none mb-1">Historique</span>
                            <span className="text-xs font-bold text-white uppercase tracking-tight">Logs de synchronisation</span>
                        </div>
                    </div>
                    {showSyncLogs ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                </button>
            </div>

            {/* Expandable Panel 1: Data volumes details */}
            <AnimatePresence>
                {showSystemVolume && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden bg-black/30 border border-white/5 rounded-2xl p-5"
                    >
                        <h5 className="text-[10px] font-black text-apple-muted uppercase tracking-widest mb-4">Volume des données enregistrées dans l&apos;appareil</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                            <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-white/5 text-center space-y-1">
                                <FileText className="w-4 h-4 mx-auto text-blue-400" />
                                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest block">Fiches</span>
                                <span className="text-lg font-black text-white">{counts.tickets}</span>
                            </div>
                            <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-white/5 text-center space-y-1">
                                <Layers className="w-4 h-4 mx-auto text-emerald-400" />
                                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest block">Factures</span>
                                <span className="text-lg font-black text-white">{counts.factures}</span>
                            </div>
                            <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-white/5 text-center space-y-1">
                                <Layers className="w-4 h-4 mx-auto text-amber-400" />
                                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest block">Commandes</span>
                                <span className="text-lg font-black text-white">{counts.commandes}</span>
                            </div>
                            <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-white/5 text-center space-y-1">
                                <FileText className="w-4 h-4 mx-auto text-pink-400" />
                                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest block">RDVs</span>
                                <span className="text-lg font-black text-white">{counts.appointments}</span>
                            </div>
                            <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-white/5 text-center space-y-1 col-span-2 sm:col-span-1">
                                <Database className="w-4 h-4 mx-auto text-teal-400" />
                                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest block">Pièces Stock</span>
                                <span className="text-lg font-black text-white">{counts.stock}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 italic mt-3 text-center">
                            Ces chiffres correspondent au contenu stocké dans l&apos;IndexedDB locale de ce navigateur. Ils doivent idéalement correspondre à ceux de vos collègues après synchronisation.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Expandable Panel 2: Sync Queue Details */}
            <AnimatePresence>
                {showQueueDetails && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden bg-black/30 border border-white/5 rounded-2xl p-5"
                    >
                        {/* Header & Clear Queue Trigger */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
                            <div>
                                <h5 className="text-[10px] font-black text-apple-muted uppercase tracking-widest">Modifications locales en attente d&apos;envoi vers Firebase</h5>
                                <p className="text-[10px] text-zinc-400 mt-0.5">Ces modifications sont conservées sur l&apos;appareil en attente de synchronisation.</p>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={handleRequeueRecent}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider border bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/20 transition-all"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Réindexer fiches (48h)
                                </button>
                                {localQueue.length > 0 && (
                                    <button
                                        onClick={handleClearQueue}
                                        className={`self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider border transition-all ${
                                            confirmClearQueue 
                                                ? 'bg-red-600 hover:bg-red-700 text-white border-red-500 animate-pulse' 
                                                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                                        }`}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        {confirmClearQueue ? 'Confirmer la suppression ?' : 'Vider la file d\'attente'}
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {unsyncedTickets.length > 0 && (
                            <div className="mb-4 p-3 rounded-xl bg-orange-950/25 border border-orange-500/30 space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-orange-300 block">
                                    {unsyncedTickets.length} fiche(s) non envoyée(s) / provisoire(s)
                                </span>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                    {unsyncedTickets.map((t) => (
                                        <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-orange-500/20 text-xs">
                                            <div className="min-w-0">
                                                <span className="font-mono font-bold text-orange-200">{t.id}</span>
                                                <span className="text-zinc-300 ml-2">{t.clientName}</span>
                                                <span className="text-zinc-400 ml-2">({t.macModel})</span>
                                            </div>
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 shrink-0">
                                                {t.isProvisional ? 'Provisoire' : 'Absente Cloud'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {localQueue.length === 0 && unsyncedTickets.length === 0 ? (
                            <div className="text-center py-6 text-zinc-500 space-y-2">
                                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/50 animate-bounce" />
                                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Aucune modification en file d&apos;attente</p>
                                <p className="text-[10px] text-zinc-500">Toutes les opérations effectuées sur ce poste de travail sont sauvegardées sur Firebase.</p>
                            </div>
                        ) : localQueue.length === 0 ? null : (
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                                {localQueue.map((item, index) => {
                                    const actionType = getActionTypeLabel(item.operation);
                                    return (
                                        <div 
                                            key={`${item.id}-${index}`}
                                            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5 text-xs text-white"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${actionType.style}`}>
                                                    {actionType.text}
                                                </span>
                                                <div>
                                                    <span className="font-bold block text-white">{getEntityLabel(item.entity)}</span>
                                                    <span className="text-[10px] text-zinc-400 font-medium">{getItemDescription(item)}</span>
                                                    {(item.retries && item.retries > 0) || item.lastError ? (
                                                        <span className="text-[9.5px] text-red-400 font-bold block mt-0.5">
                                                            ⚠️ {item.retries ? `Tentatives: ${item.retries}` : 'En attente'}{item.lastError ? ` (${item.lastError})` : ''}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">ID: #{item.entityId.substring(0, 8)}</span>
                                                <span className="text-[8px] text-zinc-600 block">{formatSyncDate(item.timestamp)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Expandable Panel 3: Sync Logs Details */}
            <AnimatePresence>
                {showSyncLogs && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden bg-black/30 border border-white/5 rounded-2xl p-5 space-y-4"
                    >
                        {/* Panel Header & Clear Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                            <div>
                                <h5 className="text-[10px] font-black text-apple-muted uppercase tracking-widest">Journal d&apos;activité et Audit Temps Réel</h5>
                                <p className="text-[10px] text-zinc-400 mt-0.5">Suivi précis des transactions Push / Pull avec Firebase</p>
                            </div>

                            <button
                                onClick={handleClearLogs}
                                disabled={syncLogs.length === 0}
                                className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 disabled:bg-white/5 disabled:opacity-40 disabled:text-zinc-500 text-red-400 border border-red-500/20 disabled:border-white/5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all"
                            >
                                <Trash2 className="w-3 h-3" />
                                Effacer l&apos;historique
                            </button>
                        </div>

                        {/* Search & Filter Controls */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 relative">
                                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="Rechercher un événement, opérateur ou mot-clé..."
                                    value={searchLogQuery}
                                    onChange={(e) => setSearchLogQuery(e.target.value)}
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                                />
                            </div>

                            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5 text-[10px] font-bold uppercase tracking-wider">
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-3 py-1.5 rounded-lg transition-all ${
                                        statusFilter === 'all'
                                            ? 'bg-purple-600 text-white shadow-md'
                                            : 'text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    Tous
                                </button>
                                <button
                                    onClick={() => setStatusFilter('success')}
                                    className={`px-3 py-1.5 rounded-lg transition-all ${
                                        statusFilter === 'success'
                                            ? 'bg-emerald-600 text-white shadow-md'
                                            : 'text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    Succès
                                </button>
                                <button
                                    onClick={() => setStatusFilter('error')}
                                    className={`px-3 py-1.5 rounded-lg transition-all ${
                                        statusFilter === 'error'
                                            ? 'bg-red-600 text-white shadow-md'
                                            : 'text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    Échecs
                                </button>
                            </div>
                        </div>

                        {/* Logs List Container */}
                        {filteredLogs.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500 space-y-2 bg-zinc-900/20 border border-white/5 rounded-xl">
                                <Info className="w-6 h-6 mx-auto text-zinc-600" />
                                <p className="text-xs font-semibold text-zinc-400">Aucun log disponible</p>
                                <p className="text-[10px] text-zinc-500 max-w-sm mx-auto">
                                    {searchLogQuery || statusFilter !== 'all' 
                                        ? "Aucun enregistrement ne correspond à vos filtres de recherche actuels." 
                                        : "L'historique est vide. Les prochains événements de synchronisation apparaîtront ici en temps réel."}
                                </p>
                            </div>
                        ) : (
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                                {filteredLogs.map((log) => {
                                    const isError = log.status === 'error';
                                    return (
                                        <div
                                            key={log.id}
                                            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs transition-colors ${
                                                isError 
                                                    ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10' 
                                                    : 'bg-zinc-950/40 border-white/5 hover:bg-zinc-950/60'
                                            }`}
                                        >
                                            <div className="space-y-1.5 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {/* Status Badge */}
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                                        isError 
                                                            ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    }`}>
                                                        {isError ? 'Échec' : 'Succès'}
                                                    </span>

                                                    {/* Type / Channel Badge */}
                                                    <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest bg-white/5 text-zinc-300 border border-white/5">
                                                        {log.type}
                                                    </span>

                                                    {/* Action Badge */}
                                                    <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                                        {log.action}
                                                    </span>

                                                    {/* Operator */}
                                                    <span className="text-[10px] text-zinc-500 font-medium italic">
                                                        par {log.operator}
                                                    </span>
                                                </div>

                                                {/* Log Message Details */}
                                                <p className={`text-xs font-medium leading-relaxed ${isError ? 'text-red-300' : 'text-zinc-200'}`}>
                                                    {log.details}
                                                </p>
                                            </div>

                                            {/* Timestamp Column */}
                                            <div className="text-right whitespace-nowrap self-end sm:self-start">
                                                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                                                    {formatSyncDate(log.timestamp)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

