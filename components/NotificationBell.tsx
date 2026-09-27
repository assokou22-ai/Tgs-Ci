import React, { useState, useEffect } from 'react';
import { isNotificationSupported, requestNotificationPermission } from '../services/notificationService.ts';
import { BellIcon, BellSlashIcon } from './icons.tsx';
import { useToastContext } from '../context/ToastContext.tsx';

const NotificationBell: React.FC = () => {
    const { showToast } = useToastContext();
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (isNotificationSupported()) {
            const timer = setTimeout(() => {
                setPermission(Notification.permission);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClick = async () => {
        if (permission === 'default') {
            const newPermission = await requestNotificationPermission();
            setPermission(newPermission);
        } else if (permission === 'denied') {
            showToast("Les notifications sont bloquées. Veuillez les autoriser dans les paramètres du navigateur.", "warning");
        }
    };

    if (!isNotificationSupported()) {
        return null; // Do not render if the browser doesn't support notifications
    }

    const getTooltip = () => {
        switch (permission) {
            case 'granted':
                return 'Notifications activées';
            case 'denied':
                return 'Notifications bloquées par le navigateur';
            case 'default':
                return 'Cliquez pour activer les notifications';
        }
    };
    
    const renderIcon = () => {
        switch (permission) {
            case 'granted':
                return <BellIcon className="w-6 h-6 text-yellow-400" />;
            case 'denied':
                return <BellSlashIcon className="w-6 h-6 text-red-500" />;
            case 'default':
            default:
                return <BellIcon className="w-6 h-6 text-gray-500" />;
        }
    };

    return (
        <button onClick={handleClick} className="p-2 hover:bg-gray-700 rounded-full" title={getTooltip()}>
            {renderIcon()}
        </button>
    );
};

export default NotificationBell;
