
import React, { useState } from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus.ts';
import { useNetworkQuality } from '../hooks/useNetworkQuality.ts';
import NetworkStatusIcon from './NetworkStatusIcon.tsx';
import { ArrowPathIcon, CloudArrowDownIcon } from './icons.tsx';

const SyncStatusIndicator: React.FC = () => {
    const quality = useNetworkQuality();
    const { isSyncing, pendingChanges } = useSyncStatus();
    const [isForcingSync, setIsForcingSync] = useState(false);
    
    const isOffline = quality === 0;

    const handleManualSync = () => {
        if (isSyncing || isOffline || isForcingSync) return;
        
        setIsForcingSync(true);
        // Déclenche l'événement global de synchronisation défini dans App.tsx
        window.dispatchEvent(new CustomEvent('requestsync'));
        
        // Simulation d'un retour visuel même si c'est rapide
        setTimeout(() => setIsForcingSync(false), 2000);
    };

    if (isSyncing || isForcingSync) {
        return (
            <div className="flex items-center gap-2 text-xs font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20 animate-pulse">
                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                <span>Synchronisation Cloud...</span>
            </div>
        );
    }
    
    if (isOffline) {
        return (
            <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest bg-slate-500/10 px-3 py-1.5 rounded-full border border-slate-500/20" title="Mode hors ligne">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                <span>Hors Ligne</span>
            </div>
        );
    }
    
    return (
        <button 
            onClick={handleManualSync}
            className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                pendingChanges > 0 
                ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20' 
                : 'text-green-400 bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
            }`}
            title={pendingChanges > 0 ? `${pendingChanges} modifs en attente. Cliquer pour forcer la synchro cloud.` : 'Tout est synchronisé sur le Cloud Google.'}
        >
            {pendingChanges > 0 ? (
                <ArrowPathIcon className="w-3.5 h-3.5" />
            ) : (
                <CloudArrowDownIcon className="w-3.5 h-3.5" />
            )}
            <span>{pendingChanges > 0 ? `En attente (${pendingChanges})` : 'Cloud Sync OK'}</span>
        </button>
    );
};

export default SyncStatusIndicator;
