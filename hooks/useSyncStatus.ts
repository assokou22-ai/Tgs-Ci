import { useState, useEffect } from 'react';
import { getSyncState, syncStateEmitter } from '../services/syncService.ts';

export const useSyncStatus = () => {
    const [status, setStatus] = useState(getSyncState());

    useEffect(() => {
        const handler = (e: Event) => {
            if (e instanceof CustomEvent) {
                setStatus(e.detail);
            }
        };
        syncStateEmitter.addEventListener('syncstatechange', handler);
        return () => syncStateEmitter.removeEventListener('syncstatechange', handler);
    }, []);

    return status;
};