export const parseUserAgent = () => {
    const ua = navigator.userAgent;
    let browser = 'Inconnu';
    let os = 'Inconnu';

    if (ua.includes('Firefox')) {
        browser = 'Firefox';
    } else if (ua.includes('SamsungBrowser')) {
        browser = 'Samsung Browser';
    } else if (ua.includes('Opera') || ua.includes('OPR')) {
        browser = 'Opera';
    } else if (ua.includes('Trident')) {
        browser = 'Internet Explorer';
    } else if (ua.includes('Edge') || ua.includes('Edg')) {
        browser = 'Microsoft Edge';
    } else if (ua.includes('Chrome')) {
        browser = 'Google Chrome';
    } else if (ua.includes('Safari')) {
        browser = 'Apple Safari';
    }

    if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
    else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
    else if (ua.includes('Windows NT 6.2')) os = 'Windows 8';
    else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return { browser, os };
};

interface IpapiResponse {
    ip?: string;
    city?: string;
    region?: string;
    country_name?: string;
    latitude?: number;
    longitude?: number;
}

export const fetchConnectionDetails = async (): Promise<{
    ipAddress: string;
    location: string;
    coordinates: string;
}> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data: IpapiResponse = await response.json();
            const locationParts = [data.city, data.region, data.country_name].filter(Boolean);
            return {
                ipAddress: data.ip || 'Inconnue',
                location: locationParts.join(', ') || 'Inconnue',
                coordinates: data.latitude && data.longitude ? `${data.latitude}, ${data.longitude}` : 'Inconnues',
            };
        }
    } catch {
        console.warn('ipapi.co failed, trying ipify...');
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            return {
                ipAddress: data.ip || 'Inconnue',
                location: 'Localisation indisponible',
                coordinates: 'Inconnues',
            };
        }
    } catch (e) {
        console.warn('All IP APIs failed', e);
    }

    return {
        ipAddress: 'Inconnue',
        location: 'Localisation indisponible',
        coordinates: 'Inconnues',
    };
};
