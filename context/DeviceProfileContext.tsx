import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type DeviceProfile = 'desktop' | 'tablet' | 'mobile';

interface DeviceProfileContextType {
    deviceProfile: DeviceProfile;
    setDeviceProfile: (profile: DeviceProfile) => void;
    hasConfirmedProfile: boolean;
    confirmProfile: (profile?: DeviceProfile) => void;
    reopenStartupSelector: () => void;
    isModalOpen: boolean;
    setIsModalOpen: (open: boolean) => void;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isTouch: boolean;
    getDeviceLabel: () => string;
}

const DeviceProfileContext = createContext<DeviceProfileContextType | undefined>(undefined);

const detectCurrentProfile = (): { profile: DeviceProfile; isTouch: boolean } => {
    if (typeof window === 'undefined') {
        return { profile: 'desktop', isTouch: false };
    }
    const width = window.innerWidth;
    const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
    
    if (width < 640) {
        return { profile: 'mobile', isTouch: true };
    }
    if (width < 1024) {
        return { profile: 'tablet', isTouch: hasTouch || width < 1024 };
    }
    return { profile: 'desktop', isTouch: hasTouch };
};

export const DeviceProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [{ profile, isTouch }, setDetectState] = useState(() => detectCurrentProfile());

    useEffect(() => {
        const handleResize = () => {
            const detected = detectCurrentProfile();
            setDetectState(prev => {
                if (prev.profile !== detected.profile || prev.isTouch !== detected.isTouch) {
                    return detected;
                }
                return prev;
            });
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, []);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-device-profile', profile);
            document.documentElement.classList.remove('device-desktop', 'device-tablet', 'device-mobile', 'device-touch');
            document.documentElement.classList.add(`device-${profile}`);
            if (isTouch) {
                document.documentElement.classList.add('device-touch');
            }
        }
    }, [profile, isTouch]);

    const isMobile = profile === 'mobile';
    const isTablet = profile === 'tablet';
    const isDesktop = profile === 'desktop';

    const getDeviceLabel = useCallback(() => {
        switch (profile) {
            case 'mobile':
                return 'Smartphone';
            case 'tablet':
                return 'Tablette';
            case 'desktop':
            default:
                return 'Ordinateur';
        }
    }, [profile]);

    return (
        <DeviceProfileContext.Provider
            value={{
                deviceProfile: profile,
                setDeviceProfile: () => {},
                hasConfirmedProfile: true, // Toujours vrai pour ne jamais bloquer l'accès avec un écran de choix
                confirmProfile: () => {},
                reopenStartupSelector: () => {},
                isModalOpen: false,
                setIsModalOpen: () => {},
                isMobile,
                isTablet,
                isDesktop,
                isTouch,
                getDeviceLabel
            }}
        >
            {children}
        </DeviceProfileContext.Provider>
    );
};

export const useDeviceProfile = () => {
    const context = useContext(DeviceProfileContext);
    if (!context) {
        throw new Error('useDeviceProfile must be used within a DeviceProfileProvider');
    }
    return context;
};
