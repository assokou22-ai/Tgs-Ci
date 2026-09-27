import React from 'react';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { Cloud, RefreshCw } from 'lucide-react';

export const DriveStatusBadge: React.FC = () => {
    const { 
        driveSyncStatus, 
        driveMetadata, 
        signInWithGoogle, 
        isReconnectingGoogle 
    } = useFirebase();

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

    if (driveSyncStatus === 'syncing') {
        return (
            <div 
                id="header-gdrive-status-badge"
                className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 shrink-0"
                title="Synchronisation vers Google Drive en cours..."
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

    // Default 'synced'
    return (
        <div 
            id="header-gdrive-status-badge"
            className="hidden md:flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/5 text-emerald-400 shrink-0"
            title={`Google Drive synchronisé (${driveMetadata.connectedEmail || 'Actif'})${driveMetadata.lastSyncTime ? ' - Dernier envoi : ' + new Date(driveMetadata.lastSyncTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}`}
        >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="hidden lg:inline">Drive :</span>
            <span>Synchronisé</span>
        </div>
    );
};

export default DriveStatusBadge;
