import React, { createContext, useContext, useState, useEffect } from 'react';

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

const STORAGE_KEY = 'tgs_device_profile_mode';
const CONFIRMED_KEY = 'tgs_device_profile_confirmed';

const DeviceProfileContext = createContext<DeviceProfileContextType | undefined>(undefined);

export const DeviceProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Détection initiale intelligente ou lecture du stockage
    const [deviceProfile, setDeviceProfileState] = useState<DeviceProfile>(() => {
        const stored = localStorage.getItem(STORAGE_KEY) as DeviceProfile | null;
        if (stored === 'desktop' || stored === 'tablet' || stored === 'mobile') {
            return stored;
        }
        // Détection par largeur d'écran par défaut
        if (typeof window !== 'undefined') {
            const width = window.innerWidth;
            if (width < 640) return 'mobile';
            if (width < 1024) return 'tablet';
        }
        return 'desktop';
    });

    const [hasConfirmedProfile, setHasConfirmedProfile] = useState<boolean>(() => {
        return localStorage.getItem(CONFIRMED_KEY) === 'true';
    });

    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    const setDeviceProfile = (profile: DeviceProfile) => {
        setDeviceProfileState(profile);
        localStorage.setItem(STORAGE_KEY, profile);
        localStorage.setItem(CONFIRMED_KEY, 'true');
        setHasConfirmedProfile(true);
        setIsModalOpen(false);
    };

    const confirmProfile = (profile?: DeviceProfile) => {
        const target = profile || deviceProfile;
        setDeviceProfileState(target);
        localStorage.setItem(STORAGE_KEY, target);
        localStorage.setItem(CONFIRMED_KEY, 'true');
        setHasConfirmedProfile(true);
        setIsModalOpen(false);
    };

    const reopenStartupSelector = () => {
        setHasConfirmedProfile(false);
        setIsModalOpen(false);
    };

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-device-profile', deviceProfile);
            document.documentElement.classList.remove('device-desktop', 'device-tablet', 'device-mobile', 'device-touch');
            document.documentElement.classList.add(`device-${deviceProfile}`);
            if (deviceProfile !== 'desktop') {
                document.documentElement.classList.add('device-touch');
            }
        }
    }, [deviceProfile]);

    const isMobile = deviceProfile === 'mobile';
    const isTablet = deviceProfile === 'tablet';
    const isDesktop = deviceProfile === 'desktop';
    const isTouch = isMobile || isTablet;

    const getDeviceLabel = () => {
        switch (deviceProfile) {
            case 'mobile':
                return 'Smartphone (Android / iPhone)';
            case 'tablet':
                return 'iPad & Tablette tactile';
            case 'desktop':
            default:
                return 'Ordinateur (PC / Mac)';
        }
    };

    return (
        <DeviceProfileContext.Provider
            value={{
                deviceProfile,
                setDeviceProfile,
                hasConfirmedProfile,
                confirmProfile,
                reopenStartupSelector,
                isModalOpen,
                setIsModalOpen,
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
