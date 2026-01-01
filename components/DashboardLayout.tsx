
import React from 'react';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { FeatureId } from '../types.ts';
import SyncStatusIndicator from './SyncStatusIndicator.tsx';

export interface NavItem {
    id: string;
    label: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    onClick?: () => void;
    isActive?: boolean;
    featureId?: FeatureId;
}

interface DashboardLayoutProps {
    title: string;
    navItems: NavItem[];
    children: React.ReactNode;
    sidebarFooter?: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ title, navItems, children, sidebarFooter }) => {
    const { isFeatureEnabled } = useAppSettings();

    const filteredNavItems = navItems.filter(item => {
        if (!item.featureId) return true;
        return isFeatureEnabled(item.featureId);
    });

    return (
        <div className="flex flex-col h-full min-h-screen bg-slate-950 text-slate-100">
            {/* Header / Nav Flottante Premium */}
            <div className="sticky top-0 z-50 px-4 py-3">
                <div className="max-w-7xl mx-auto">
                    <div className="glass rounded-2xl shadow-2xl overflow-hidden border border-white/10">
                        <div className="px-6 h-16 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-grow">
                                <div className="hidden lg:flex flex-col flex-shrink-0">
                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] leading-none mb-1">DÉPARTEMENT</span>
                                    <span className="text-sm font-black text-white uppercase tracking-tighter leading-none">{title}</span>
                                </div>
                                <div className="h-8 w-px bg-white/10 hidden lg:block mx-2"></div>
                                <nav className="flex space-x-1 overflow-x-auto no-scrollbar scroll-smooth">
                                    {filteredNavItems.map((item) => {
                                        const isActive = item.isActive;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={item.onClick}
                                                className={`
                                                    flex items-center gap-2 px-4 py-2 font-bold text-[11px] rounded-xl whitespace-nowrap transition-all duration-300
                                                    ${isActive 
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105' 
                                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                                    }
                                                `}
                                            >
                                                <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                                                <span className="uppercase tracking-wider">{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </nav>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:block">
                                    <SyncStatusIndicator />
                                </div>
                                {sidebarFooter && (
                                    <div className="hidden md:flex items-center">
                                        {sidebarFooter}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contenu principal */}
            <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 animate-fade-in">
                {children}
            </main>
        </div>
    );
};

export default DashboardLayout;
