import React from 'react';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { useSyncStatus } from '../hooks/useSyncStatus.ts';
import { Cloud, RefreshCw, AlertTriangle } from 'lucide-react';

export const DriveStatusBadge: React.FC = () => {
    const { 
        driveSyncStatus, 
        driveMetadata, 
        signInWithGoogle, 
        isReconnectingGoogle 
    } = useFirebase();
    const {
        pendingChanges,
        pendingTickets,
        unsyncedTickets,
        lastPushSucceeded,
        lastError,
        isQuotaExceeded,
        isSyncing,
    } = useSyncStatus();

    const unsentCount = Math.max(pendingTickets, unsyncedTickets.length, pendingChanges);
    const hasUnsentTickets = unsyncedTickets.length > 0 || pendingChanges > 0;
    const hasHardError = Boolean(isQuotaExceeded) || Boolean(lastError) || (!lastPushSucceeded && !hasUnsentTickets);
    const hasCloudPushProblem = hasUnsentTickets || hasHardError;

    if (hasCloudPushProblem && !isSyncing) {
        const badgeLabel = hasUnsentTickets
            ? `${unsentCount} fiche(s) non envoyée(s)`
            : isQuotaExceeded
            ? 'Quota Cloud atteint'
            : 'Erreur sync Cloud';
        const isRedTone = Boolean(isQuotaExceeded) || Boolean(lastError) || !lastPushSucceeded;
        const listPreview = unsyncedTickets.length > 0
            ? ` — ${unsyncedTickets.slice(0, 5).map(t => `${t.id} (${t.clientName} - ${t.macModel})`).join(', ')}${unsyncedTickets.length > 5 ? '…' : ''}`
            : '';

        return (
            <div
                id="header-gdrive-status-badge"
                className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full border shrink-0 ${
                    isRedTone && !hasUnsentTickets
                        ? 'border-red-500/40 bg-red-500/15 text-red-400'
                        : isRedTone
                        ? 'border-red-500/40 bg-red-500/15 text-red-400'
                        : 'border-orange-500/40 bg-orange-500/15 text-orange-400'
                }`}
                title={
                    lastError
                        ? `Échec d'envoi Cloud : ${lastError}${listPreview}`
                        : `${unsentCount} fiche(s) en attente d'envoi vers le Cloud${listPreview}`
                }
            >
                <AlertTriangle className={`w-3 h-3 shrink-0 ${isRedTone ? 'text-red-400' : 'text-orange-400'}`} />
                <span>{badgeLabel}</span>
            </div>
        );
    }

    if (!driveMetadata.driveConnected) {
        return (
            <button
                id="header-gdrive-connect-btn"
                onClick={() => signInWithGoogle(false)}
                disabled={isReconnectingGoogle}
                className="hidden lg:flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10 transition-all active:scale-95 shrink-0"
                title="Connecter Google Drive pour synchronisation permanente"
            >
                <Cloud className="w-3 h-3" />
                <span>Lier Drive</span>
            </button>
        );
    }

    if (driveSyncStatus === 'syncing' || isSyncing) {
        return (
            <div 
                id="header-gdrive-status-badge"
                className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 shrink-0"
                title="Synchronisation vers le Cloud en cours..."
            >
                <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                <span className="hidden sm:inline">Drive :</span>
                <span>Sync en cours</span>
            </div>
        );
    }

    if (driveSyncStatus === 'offline_pending') {
        return (
            <div 
                id="header-gdrive-status-badge"
                className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 shrink-0"
                title={`Mode hors ligne : ${driveMetadata.pendingCount || 1} opération(s) en attente de connexion`}
            >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="hidden sm:inline">Drive :</span>
                <span>En attente hors ligne</span>
            </div>
        );
    }

    if (driveSyncStatus === 'action_required') {
        return (
            <button
                id="header-gdrive-status-badge"
                onClick={() => signInWithGoogle(false)}
                disabled={isReconnectingGoogle}
                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all active:scale-95 shrink-0 cursor-pointer animate-pulse"
                title="Session Google Drive expirée ou autorisation requise. Cliquez pour réautoriser."
            >
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                <span className="hidden sm:inline">Drive :</span>
                <span>Action requise</span>
            </button>
        );
    }

    // Default 'synced' (seulement lorsque Firestore syncQueue est vide, 0 fiche manquante/provisoire et dernier push réussi)
    return (
        <div 
            id="header-gdrive-status-badge"
            className="hidden md:flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/5 text-emerald-400 shrink-0"
            title={`Google Drive & Cloud synchronisés (${driveMetadata.connectedEmail || 'Actif'})${driveMetadata.lastSyncTime ? ' - Dernier envoi : ' + new Date(driveMetadata.lastSyncTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}`}
        >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="hidden lg:inline">Drive :</span>
            <span>Synchronisé</span>
        </div>
    );
};

export default DriveStatusBadge;
