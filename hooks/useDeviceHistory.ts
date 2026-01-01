import { useState, useEffect } from 'react';
import { DeviceSession } from '../types.ts';
import { dbGetDeviceSessions } from '../services/dbService.ts';

const useDeviceHistory = () => {
    const [sessions, setSessions] = useState<DeviceSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchHistory = async () => {
            setLoading(true);
            const data = await dbGetDeviceSessions();
            if (isMounted) {
                // Sort with the most recent session first
                setSessions(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
                setLoading(false);
            }
        };

        fetchHistory();

        return () => {
            isMounted = false;
        };
    }, []);

    return { sessions, loading };
};

export default useDeviceHistory;