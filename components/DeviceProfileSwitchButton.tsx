import React from 'react';
import { Monitor, Tablet, Smartphone } from 'lucide-react';
import { useDeviceProfile } from '../context/DeviceProfileContext.tsx';

export const DeviceProfileSwitchButton: React.FC<{ className?: string }> = ({ className = '' }) => {
    const { deviceProfile, reopenStartupSelector, getDeviceLabel } = useDeviceProfile();

    const getIcon = () => {
        switch (deviceProfile) {
            case 'mobile':
                return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
            case 'tablet':
                return <Tablet className="w-3.5 h-3.5 text-indigo-400" />;
            case 'desktop':
            default:
                return <Monitor className="w-3.5 h-3.5 text-sky-400" />;
        }
    };

    return (
        <button
            type="button"
            onClick={reopenStartupSelector}
            title={`Mode d'affichage actuel : ${getDeviceLabel()} (Cliquer pour reconfigurer le support de l'atelier)`}
            className={`flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto p-2 sm:px-2.5 sm:py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 ${className}`}
        >
            {getIcon()}
            <span className="hidden sm:inline text-[11px] font-bold">
                {deviceProfile === 'mobile' ? 'Mobile' : deviceProfile === 'tablet' ? 'Tablette' : 'PC/Mac'}
            </span>
        </button>
    );
};
