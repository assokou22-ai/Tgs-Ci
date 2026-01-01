import { useState, useEffect } from 'react';

// Déclare la propriété 'connection' sur le type Navigator pour une meilleure compatibilité TypeScript
declare global {
    interface Navigator {
        connection?: {
            effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
            addEventListener: (type: 'change', listener: () => void) => void;
            removeEventListener: (type: 'change', listener: () => void) => void;
        };
    }
}

/**
 * Hook to monitor network quality.
 * @returns A quality score from 0 to 4:
 * - 0: Offline
 * - 1: Slow-2g
 * - 2: 2g
 * - 3: 3g
 * - 4: 4g or better
 */
export const useNetworkQuality = (): number => {
    const [quality, setQuality] = useState<number>(4);

    useEffect(() => {
        const updateQuality = () => {
            if (!navigator.onLine) {
                setQuality(0);
                return;
            }
            
            const connection = navigator.connection;
            if (!connection) {
                setQuality(4); // Assume good quality if API is not supported
                return;
            }

            switch (connection.effectiveType) {
                case '4g':
                    setQuality(4);
                    break;
                case '3g':
                    setQuality(3);
                    break;
                case '2g':
                    setQuality(2);
                    break;
                case 'slow-2g':
                    setQuality(1);
                    break;
                default:
                    setQuality(4);
            }
        };

        updateQuality();

        const connection = navigator.connection;

        window.addEventListener('online', updateQuality);
        window.addEventListener('offline', updateQuality);
        connection?.addEventListener('change', updateQuality);

        return () => {
            window.removeEventListener('online', updateQuality);
            window.removeEventListener('offline', updateQuality);
            connection?.removeEventListener('change', updateQuality);
        };
    }, []);

    return quality;
};
