import React, { useState } from 'react';
import { FeatureId } from '../types.ts';
import SyncStatusIndicator from './SyncStatusIndicator.tsx';
import DriveStatusBadge from './DriveStatusBadge.tsx';
import StorageHealthIndicator from './StorageHealthIndicator.tsx';
import { ArrowLeftIcon, ArrowUturnLeftIcon } from './icons.tsx';
import GlobalSearch from './GlobalSearch.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOutIcon, MenuIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useOrientation } from '../hooks/useOrientation.ts';

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
    subtitle?: string;
    navItems: NavItem[];
    children: React.ReactNode;
    sidebarFooter?: React.ReactNode;
    onBack?: () => void;
    onExitRole?: () => void;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ title, navItems, children, onBack, onExitRole }) => {
    const { isFeatureEnabled } = useAppSettings();
    const { user, authReady, signInWithGoogle, signOutUser } = useFirebase();
    const { isMobileLandscape } = useOrientation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    // Persistent desktop sidebar state (default expanded)
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
        const stored = localStorage.getItem('tgs_sidebar_open');
        return stored !== 'false';
    });

    const toggleSidebar = () => {
        setIsSidebarOpen(prev => {
            const next = !prev;
            localStorage.setItem('tgs_sidebar_open', String(next));
            return next;
        });
    };

    const handleMenuClick = () => {
        if (window.innerWidth < 1024) {
            setIsMobileMenuOpen(prev => !prev);
        } else {
            toggleSidebar();
        }
    };

    const handleNavClick = (onClick?: () => void) => {
        if (onClick) onClick();
        setIsMobileMenuOpen(false);
    };

    const visibleItems = navItems.filter(item => !item.featureId || isFeatureEnabled(item.featureId));

    return (
        <div className="min-h-screen bg-black text-white selection:bg-apple-blue selection:text-white font-sans flex overflow-x-hidden">
            
            {/* COLLAPSIBLE LEFT SIDEBAR FOR DESKTOP */}
            <aside 
                className={`
                    fixed top-0 left-0 bottom-0 z-[110] bg-[#0A0A0C] border-r border-white/5 
                    transition-all duration-300 ease-in-out hidden lg:flex flex-col
                    ${isSidebarOpen ? 'w-64' : 'w-20'}
                `}
            >
                {/* Brand / Logo Section */}
                <div className="h-20 flex items-center justify-between px-5 border-b border-white/5 shrink-0">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-[13px] font-black uppercase tracking-wider text-white">
                                REPARER<span className="text-apple-blue font-black tracking-widest text-[9px] uppercase ml-1 border border-apple-blue/30 px-1.5 py-0.5 rounded bg-apple-blue/10">MONMAC</span>
                            </span>
                        </div>
                    ) : (
                        <div className="mx-auto flex items-center justify-center">
                            <span className="text-[11px] font-black text-apple-blue tracking-tighter uppercase">RMM</span>
                        </div>
                    )}
                </div>

                {/* Modules Navigation list */}
                <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5 no-scrollbar">
                    <div className="hidden lg:block mb-4 px-2">
                        {isSidebarOpen ? (
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Options de navigation</span>
                        ) : (
                            <div className="h-2 border-b border-white/5"></div>
                        )}
                    </div>
                    {visibleItems.map((item) => {
                        const Icon = item.icon;
                        const isItemActive = item.isActive;
                        return (
                            <div key={item.id} className="relative group">
                                <button
                                    onClick={() => handleNavClick(item.onClick)}
                                    className={`
                                        w-full flex items-center rounded-2xl transition-all duration-200 border text-xs font-black uppercase tracking-wider
                                        ${isSidebarOpen ? 'px-4 py-3 gap-3.5 text-left' : 'py-3.5 justify-center'}
                                        ${isItemActive 
                                            ? 'bg-apple-blue border-blue-400 text-white shadow-lg shadow-blue-500/20' 
                                            : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/10'
                                        }
                                    `}
                                >
                                    {Icon && (
                                        <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isItemActive ? 'text-white' : 'text-apple-blue'}`} />
                                    )}
                                    
                                    {isSidebarOpen && (
                                        <span className="text-[10px] font-black uppercase tracking-wider truncate">
                                            {item.label}
                                        </span>
                                    )}
                                </button>

                                {/* Tooltip when sidebar is collapsed */}
                                {!isSidebarOpen && (
                                    <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-zinc-950 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.15em] px-3 py-2 rounded-xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none shadow-2xl space-x-1 whitespace-nowrap z-[120]">
                                        <span>{item.label}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Sidebar Footer details */}
                <div className="p-4 border-t border-white/5 bg-zinc-950/40 shrink-0">
                    {isSidebarOpen ? (
                        <div className="space-y-4">
                            {/* Firebase Session status */}
                            {authReady && user && (
                                <div className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/5">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-apple-blue/20" referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-apple-blue/10 flex items-center justify-center text-apple-blue font-black text-[9px]">
                                            {user.email?.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-black text-white truncate leading-tight">
                                            {user.displayName || 'Utilisateur'}
                                        </span>
                                        <span className="text-[8px] text-zinc-500 truncate lowercase">
                                            {user.email}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Navigation Core exits */}
                            <div className="flex gap-2">
                                <button
                                    onClick={onExitRole}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white border border-white/5 text-[9px] font-black uppercase tracking-widest transition-all"
                                    title="Quitter le module actuel"
                                >
                                    <ArrowUturnLeftIcon className="w-3 h-3 text-apple-blue" />
                                    <span>Quitter</span>
                                </button>
                                {authReady && user && (
                                    <button
                                        onClick={signOutUser}
                                        className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-500 border border-red-500/20 transition-all active:scale-95 shrink-0"
                                        title="Déconnexion standard"
                                    >
                                        <LogOutIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3.5 py-1">
                            {authReady && user && (
                                <div className="relative group">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-apple-blue/15" referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-apple-blue/10 flex items-center justify-center text-apple-blue font-black text-[9px]">
                                            {user.email?.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-zinc-950 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.15em] px-3.5 py-1.5 rounded-xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all pointer-events-none whitespace-nowrap z-[120]">
                                        {user.displayName || user.email}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={onExitRole}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 border border-white/5 transition-all active:scale-95"
                                title="Quitter le module actuel"
                            >
                                <ArrowUturnLeftIcon className="w-3.5 h-3.5 text-apple-blue" />
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* MAIN PORTFOLIO PANELS AREA */}
            <div 
                className={`
                    flex-1 flex flex-col min-h-screen bg-black text-white transition-all duration-300 ease-in-out
                    ${isSidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}
                `}
            >
                {/* BARRE DE NAVIGATION EN TÊTE */}
                <header 
                    className={`
                        fixed top-0 right-0 z-[100] ${isMobileLandscape ? 'h-14' : 'h-20'} flex items-center px-4 md:px-8 transition-all duration-300 ease-in-out left-0
                        ${isSidebarOpen ? 'lg:left-64' : 'lg:left-20'}
                    `}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl border-b border-white/5"></div>
                    
                    <div className="relative max-w-[1800px] w-full mx-auto flex items-center justify-between gap-4">
                        
                        <div className="flex items-center gap-4 shrink-0">
                            {/* HAMBURGER / COLLAPSE BUTTON */}
                            <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleMenuClick}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-apple-blue hover:text-white border border-white/5 flex items-center gap-2 px-3 shrink-0"
                                title={isSidebarOpen ? "Réduire le menu" : "Agrandir le menu"}
                            >
                                <MenuIcon className="w-4 h-4 shrink-0" />
                                {isSidebarOpen ? (
                                    <ChevronLeft className="w-3.5 h-3.5 hidden lg:inline text-zinc-500" />
                                ) : (
                                    <ChevronRight className="w-3.5 h-3.5 hidden lg:inline text-zinc-500" />
                                )}
                            </motion.button>

                            <div className="w-px h-8 bg-white/10 hidden sm:block"></div>

                            <div className="flex items-center gap-3">
                                {onBack && (
                                    <motion.button 
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={onBack}
                                        className="flex items-center justify-center w-8 h-8 bg-apple-blue rounded-xl text-white shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition-all shrink-0"
                                    >
                                        <ArrowLeftIcon className="w-4 h-4" />
                                    </motion.button>
                                )}
                                
                                <div className="flex flex-col">
                                    <h1 className="text-[10px] md:text-sm font-black text-white uppercase tracking-[0.2em] italic truncate max-w-[120px] md:max-w-none leading-none">
                                        {title}
                                    </h1>
                                    {!isMobileLandscape && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-apple-blue animate-pulse"></div>
                                            <span className="text-[8px] font-black text-apple-blue uppercase tracking-widest leading-none">Système Actif</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 shrink-0">
                            <GlobalSearch />
                            
                            {/* Unified workspace indicators (visible on desktop and tablet screens for fluent display) */}
                            <div className="flex items-center gap-2.5 sm:gap-3">
                                {authReady && !isMobileLandscape && (
                                    user ? (
                                        <button 
                                            onClick={signOutUser}
                                            className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-500 hover:text-red-400 hover:bg-red-500/20 transition-all active:scale-95 shrink-0"
                                            title={`Connecté : ${user.displayName || user.email}. Cliquer pour vous déconnecter.`}
                                        >
                                            {user.photoURL && (
                                                <img src={user.photoURL} alt="" className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                                            )}
                                            <span className="hidden xl:inline">Déconnexion</span>
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={signInWithGoogle}
                                            className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-blue-500/10 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10 transition-all active:scale-95 shrink-0"
                                            title="Se connecter avec Google pour synchroniser de manière sécurisée"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                            <span>Connexion Google</span>
                                        </button>
                                    )
                                )}
                                <div className="hidden xs:block sm:block shrink-0">
                                    <DriveStatusBadge />
                                </div>
                                <div className="hidden xs:block sm:block shrink-0">
                                    <StorageHealthIndicator />
                                </div>
                                <div className="shrink-0">
                                    <SyncStatusIndicator />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* MAIN CHRONICLE CHILDREN AREA */}
                <main className={`flex-1 ${isMobileLandscape ? 'mt-14' : 'mt-20'} flex flex-col`}>
                    <div className={`max-w-[1800px] w-full mx-auto ${isMobileLandscape ? 'p-3' : 'p-4 md:p-10'}`}>
                        {children}
                    </div>
                </main>
                
                {/* Micro-devices action bar */}
                <div className="sm:hidden fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]">
                    <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-full p-2.5 shadow-2xl flex items-center gap-4">
                        <SyncStatusIndicator />
                        <div className="w-px h-4 bg-white/10"></div>
                        <StorageHealthIndicator />
                    </div>
                </div>
            </div>

            {/* OVERLAY MENU MOBILE */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-3xl flex flex-col pt-24 px-6 pb-12 overflow-y-auto"
                    >
                        <div className="max-w-lg mx-auto w-full space-y-12">
                            <div className="text-center space-y-2">
                                <p className="text-apple-blue font-black uppercase tracking-[0.4em] text-[10px]">REPARERMONMAC Ecosystem</p>
                                <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">Navigation</h2>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                {visibleItems.map((item) => (
                                    <motion.button
                                        key={item.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleNavClick(item.onClick)}
                                        className={`
                                            flex flex-col items-center justify-center aspect-square rounded-[40px] border transition-all gap-4 p-6
                                            ${item.isActive 
                                                ? 'bg-apple-blue border-blue-400 text-white shadow-2xl shadow-blue-500/30' 
                                                : 'bg-white/5 border-white/5 text-apple-muted hover:bg-white/10 hover:border-white/10'
                                            }
                                        `}
                                    >
                                        <div className={`p-4 rounded-2xl ${item.isActive ? 'bg-white/20' : 'bg-apple-blue/10'}`}>
                                            <item.icon className={`w-8 h-8 ${item.isActive ? 'text-white' : 'text-apple-blue'}`} />
                                        </div>
                                        <span className="text-[11px] font-black uppercase text-center leading-tight tracking-widest">{item.label}</span>
                                    </motion.button>
                                ))}
                            </div>

                            <div className="pt-12 border-t border-white/5 flex flex-col gap-4">
                                {authReady && (
                                    user ? (
                                        <button 
                                            onClick={() => { signOutUser(); setIsMobileMenuOpen(false); }}
                                            className="flex items-center justify-center gap-3 w-full py-5 bg-red-600/10 border border-red-500/20 rounded-3xl text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-500/20 transition-all"
                                        >
                                            {user.photoURL && <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />}
                                            <span>Déconnexion ({user.displayName || 'Google'})</span>
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => { signInWithGoogle(); setIsMobileMenuOpen(false); }}
                                            className="flex items-center justify-center gap-3 w-full py-5 bg-blue-600/10 border border-blue-500/20 rounded-3xl text-xs font-black uppercase tracking-widest text-blue-400 hover:bg-blue-500/20 transition-all"
                                        >
                                            Connexion Google Sync
                                        </button>
                                    )
                                )}
                                <button 
                                    onClick={onExitRole}
                                    className="flex items-center justify-center gap-3 w-full py-5 bg-zinc-900 border border-white/5 rounded-3xl text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all"
                                >
                                    <LogOutIcon className="w-4 h-4" />
                                    <span>Quitter le module</span>
                                </button>
                                <button 
                                    onClick={() => setIsMobileMenuOpen(false)} 
                                    className="w-full py-5 text-xs font-black uppercase text-slate-500 hover:text-white transition-colors tracking-[0.3em]"
                                >
                                    Fermer le menu
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DashboardLayout;