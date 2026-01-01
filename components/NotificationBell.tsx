import React, { useState, useEffect } from 'react';
import { isNotificationSupported, requestNotificationPermission } from '../services/notificationService.ts';
import { BellIcon, BellSlashIcon } from './icons.tsx';

const NotificationBell: React.FC = () => {
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (isNotificationSupported()) {
            setPermission(Notification.permission);
        }
    }, []);

    const handleClick = async () => {
        if (permission === 'default') {
            const newPermission = await requestNotificationPermission();
            setPermission(newPermission);
        } else if (permission === 'denied') {
            alert("Les notifications sont bloquées. Veuillez les autoriser dans les paramètres de votre navigateur (généralement via l'icône de cadenas dans la barre d'adresse).");
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
