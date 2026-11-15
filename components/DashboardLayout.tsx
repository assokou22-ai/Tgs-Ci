import React, { useState, useEffect } from 'react';
import { FeatureId } from '../types.ts';
import SyncStatusIndicator from './SyncStatusIndicator.tsx';
import DriveStatusBadge from './DriveStatusBadge.tsx';
import StorageHealthIndicator from './StorageHealthIndicator.tsx';
import { ArrowLeftIcon, ArrowUturnLeftIcon, AppleLogo } from './icons.tsx';
import { CoteDIvoireFlag, BeninFlag } from './Flags.tsx';
import GlobalSearch from './GlobalSearch.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOutIcon, MenuIcon, ChevronLeft, ChevronRight, LayoutGrid, X } from 'lucide-react';
import { useOrientation } from '../hooks/useOrientation.ts';



export interface NavItem {
    id: string;
    label: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    onClick?: () => void;
    isActive?: boolean;
    badge?: number | string;
    featureId?: FeatureId;
}

interface DashboardLayoutProps {
    title: string;
    subtitle?: string;
    role?: string;
    activeTab?: string;
    onTabChange?: (tabId: string) => void;
    statsBadge?: string;
    navItems: NavItem[];
    children: React.ReactNode;
    sidebarFooter?: React.ReactNode;
    onBack?: () => void;
    onExitRole?: () => void;
}

/** Libellé court pour la barre d'onglets (petits écrans). */
const shortLabel = (label: string) => {
    const clean = label.replace(/\(.*?\)/g, '').trim();
    const words = clean.split(/\s+/);
    if (clean.length <= 11) return clean;
    const first = words[0].length >= 4 ? words[0] : words.slice(0, 2).join(' ');
    return first.length > 12 ? first.slice(0, 11) + '.' : first;
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
    title, 
    subtitle, 
    navItems, 
    children, 
    activeTab, 
    onTabChange, 
    statsBadge, 
    onBack, 
    onExitRole 
}) => {
    const { isFeatureEnabled } = useAppSettings();
    const { user, authReady, signInWithGoogle, signOutUser } = useFirebase();
    const { isMobileLandscape } = useOrientation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Bouton « retour » Android : ferme d'abord le menu « Plus »
    useEffect(() => {
        if (!isMobileMenuOpen) return;
        const onBack = (e: Event) => { e.preventDefault(); setIsMobileMenuOpen(false); };
        window.addEventListener('androidback', onBack);
        return () => window.removeEventListener('androidback', onBack);
    }, [isMobileMenuOpen]);
    
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

    const handleExit = () => {
        setIsMobileMenuOpen(false);
        const url = new URL(window.location.href);
        url.searchParams.delete('role');
        url.searchParams.delete('ticketId');
        window.history.pushState({}, '', url);

        if (onExitRole) {
            try {
                onExitRole();
            } catch (err) {
                console.error("Erreur lors de onExitRole:", err);
            }
        }
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    const handleNavClick = (onClick?: () => void) => {
        if (onClick) onClick();
        setIsMobileMenuOpen(false);
    };

    const visibleItems = navItems
        .filter(item => !item.featureId || isFeatureEnabled(item.featureId))
        .map(item => ({
            ...item,
            isActive: item.isActive !== undefined ? item.isActive : (activeTab ? item.id === activeTab : false),
            onClick: item.onClick ? item.onClick : (onTabChange ? () => onTabChange(item.id) : undefined)
        }));

    // Onglets du bas : 4 premiers modules (+ le module actif s'il est plus loin) et « Plus »
    const MAX_TABS = 4;
    const hasMore = true; // « Plus » donne aussi accès au compte, à la synchro et au changement d'espace
    let tabItems = visibleItems.slice(0, MAX_TABS);
    const activeItem = visibleItems.find(i => i.isActive);
    if (hasMore && activeItem && !tabItems.includes(activeItem)) tabItems = [...tabItems.slice(0, MAX_TABS - 1), activeItem];
    const moreActive = false;
    void moreActive;

    return (
        <div className="min-h-[100dvh] app-bg text-white selection:bg-apple-blue selection:text-white font-sans flex overflow-x-hidden">
            
            {/* COLLAPSIBLE LEFT SIDEBAR FOR DESKTOP */}
            <aside 
                className={`
                    fixed top-0 left-0 bottom-0 z-[110] bg-[#0A0B0F]/95 border-r border-white/5 
                    transition-all duration-300 ease-in-out hidden lg:flex flex-col
                    ${isSidebarOpen ? 'w-64' : 'w-20'}
                `}
            >
                {/* Brand / Logo Section */}
                <div className="h-20 flex items-center justify-between px-5 border-b border-white/[0.06] shrink-0 bg-white/[0.01]">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-3 overflow-hidden">
                            <AppleLogo className="w-5 h-5 text-white shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-xs font-extrabold uppercase tracking-tight text-white flex items-center gap-1.5">
                                    TGS-CI <span className="text-[9px] font-mono text-apple-blue px-1 py-0.5 rounded bg-apple-blue/10 border border-apple-blue/20">PRO</span>
                                </span>
                                <span className="text-[9px] text-zinc-500 font-medium tracking-wide">MacBook Workshop</span>
                            </div>
                        </div>
                    ) : (
                        <div className="mx-auto flex items-center justify-center">
                            <AppleLogo className="w-5 h-5 text-white" />
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
                                        <div className="flex items-center justify-between flex-1 min-w-0">
                                            <span className="text-[10px] font-black uppercase tracking-wider truncate">
                                                {item.label}
                                            </span>
                                            {item.badge !== undefined && (
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                                    isItemActive 
                                                        ? 'bg-white/20 text-white' 
                                                        : 'bg-apple-blue/20 text-apple-blue border border-apple-blue/30'
                                                }`}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>
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
                                    onClick={handleExit}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white border border-white/5 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
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
                                onClick={handleExit}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 border border-white/5 transition-all active:scale-95 cursor-pointer"
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
                    flex-1 flex flex-col min-h-[100dvh] min-w-0 text-white transition-all duration-300 ease-in-out
                    ${isSidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}
                `}
            >
                {/* BARRE DE NAVIGATION EN TÊTE */}
                <header 
                    className={`
                        fixed top-0 right-0 z-[100] ${isMobileLandscape ? 'h-12' : 'h-12 sm:h-14 lg:h-20'} pt-0 flex items-center px-2.5 sm:px-4 lg:px-8 transition-all duration-300 ease-in-out left-0 pointer-events-none select-none
                        ${isSidebarOpen ? 'lg:left-64' : 'lg:left-20'}
                    `}
                >
                    <div className="absolute inset-0 bg-[#090b10]/90 backdrop-blur-xl border-b border-white/[0.06] pointer-events-none"></div>
                    
                    <div className="relative max-w-[1800px] w-full mx-auto flex items-center justify-between gap-2 sm:gap-4 pointer-events-auto">
                        
                        <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
                            {/* HAMBURGER / COLLAPSE BUTTON */}
                            <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleMenuClick}
                                className="hidden lg:flex p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-apple-blue hover:text-white border border-white/5 items-center gap-2 shrink-0 cursor-pointer"
                                title={isSidebarOpen ? "Réduire le menu" : "Agrandir le menu"}
                            >
                                <MenuIcon className="w-4 h-4 shrink-0" />
                                {isSidebarOpen ? (
                                    <ChevronLeft className="w-3.5 h-3.5 hidden lg:inline text-zinc-500" />
                                ) : (
                                    <ChevronRight className="w-3.5 h-3.5 hidden lg:inline text-zinc-500" />
                                )}
                            </motion.button>

                            <div className="w-px h-6 bg-white/10 hidden lg:block"></div>

                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                {(onBack || onExitRole) && (
                                    <motion.button 
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={onBack ? onBack : handleExit}
                                        className="no-min-h flex items-center justify-center w-8 h-8 bg-apple-blue hover:bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20 transition-all shrink-0 cursor-pointer"
                                        title={onBack ? "Retour" : "Quitter le module"}
                                    >
                                        <ArrowLeftIcon className="w-4 h-4" />
                                    </motion.button>
                                )}
                                
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                        <h1 className="text-[0.8rem] sm:text-sm font-black text-white uppercase tracking-[0.08em] sm:tracking-[0.15em] truncate max-w-[38vw] sm:max-w-xs md:max-w-none leading-none">
                                            {title}
                                        </h1>
                                        {statsBadge && (
                                            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-zinc-300 border border-white/10">
                                                {statsBadge}
                                            </span>
                                        )}
                                    </div>
                                    {subtitle ? (
                                        <p className="hidden md:block text-[9px] text-zinc-400 font-medium truncate max-w-[200px] md:max-w-md mt-0.5">
                                            {subtitle}
                                        </p>
                                    ) : !isMobileLandscape ? (
                                        <div className="hidden md:flex items-center gap-2 mt-1">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-apple-blue animate-pulse"></div>
                                                <span className="text-[8px] font-black text-apple-blue uppercase tracking-widest leading-none">Système Actif</span>
                                            </div>
                                            <span className="text-zinc-600 text-[9px]">·</span>
                                            <div className="hidden sm:flex items-center gap-1.5 text-[9px] text-zinc-400 font-medium">
                                                <span>Cocody, Abidjan</span>
                                                <CoteDIvoireFlag className="w-3.5 h-2.5" />
                                                <BeninFlag className="w-3.5 h-2.5" />
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto">
                            <GlobalSearch />

                            {/* Bouton direct visible sur tous les écrans pour quitter vers le portail */}
                            <button
                                onClick={handleExit}
                                className="hidden sm:flex no-min-h items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition-all active:scale-95 shrink-0 cursor-pointer"
                                title="Quitter le module et revenir à la sélection des espaces"
                            >
                                <ArrowUturnLeftIcon className="w-3.5 h-3.5 text-red-400" />
                                <span className="hidden sm:inline">Quitter</span>
                            </button>
                            
                            {/* Unified workspace indicators */}
                            <div className="flex items-center gap-1.5 sm:gap-2">
                                {authReady && !isMobileLandscape && (
                                    user ? (
                                        <button 
                                            onClick={signOutUser}
                                            className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-500 hover:text-red-400 hover:bg-red-500/20 transition-all active:scale-95 shrink-0 cursor-pointer"
                                            title={`Connecté : ${user.displayName || user.email}. Cliquer pour vous déconnecter.`}
                                        >
                                            {user.photoURL && (
                                                <img src={user.photoURL} alt="" className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                                            )}
                                            <span className="hidden xl:inline">Déconnexion</span>
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => signInWithGoogle(false)}
                                            className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-blue-500/10 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10 transition-all active:scale-95 shrink-0 cursor-pointer"
                                            title="Se connecter avec Google pour synchroniser de manière sécurisée"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                            <span>Connexion Google</span>
                                        </button>
                                    )
                                )}
                                <div className="hidden lg:block shrink-0">
                                    <DriveStatusBadge />
                                </div>
                                <div className="hidden lg:block shrink-0" title="Santé Stockage Local">
                                    <StorageHealthIndicator />
                                </div>
                                {/* Syncthing & Stockage maintenu proprement dans l'angle sans gêner */}
                                <div className="shrink-0" title="Synchronisation Cloud & Santé Stockage">
                                    <SyncStatusIndicator />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* MAIN CHRONICLE CHILDREN AREA */}
                <main className={`flex-1 ${isMobileLandscape ? 'pt-12' : 'pt-12 sm:pt-14 lg:pt-20'} flex flex-col min-w-0`}>
                    <div className={`max-w-[1800px] w-full mx-auto ${isMobileLandscape ? 'p-2.5' : 'p-2.5 sm:p-4 lg:p-10'} pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] lg:pb-12`}>
                        {children}
                    </div>
                </main>
            </div>

            {/* BARRE D'ONGLETS MOBILE / TABLETTE (v1.2.0) */}
            <nav className="tabbar lg:hidden" aria-label="Navigation principale">
                <div className="max-w-xl mx-auto grid gap-1" style={{ gridTemplateColumns: `repeat(${tabItems.length + (hasMore ? 1 : 0)}, minmax(0, 1fr))` }}>
                    {tabItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleNavClick(item.onClick)}
                                className={`tabbar-btn relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 px-1 transition-colors ${item.isActive ? 'text-white' : 'text-zinc-500 active:text-zinc-200'}`}
                                aria-current={item.isActive ? 'page' : undefined}
                            >
                                <span className={`flex items-center justify-center rounded-full transition-all ${item.isActive ? 'bg-apple-blue/20 px-3.5 py-1' : 'px-3.5 py-1'}`}>
                                    {Icon && <Icon className={`w-[1.2rem] h-[1.2rem] ${item.isActive ? 'text-apple-blue' : ''}`} />}
                                </span>
                                {!isMobileLandscape && <span className="text-[0.62rem] font-semibold leading-tight truncate max-w-full">{shortLabel(item.label)}</span>}
                                {item.badge !== undefined && item.badge !== 0 && (
                                    <span className="absolute top-0.5 right-[18%] min-w-[1rem] h-4 px-1 rounded-full bg-apple-blue text-white text-[0.55rem] font-bold flex items-center justify-center">{item.badge}</span>
                                )}
                            </button>
                        );
                    })}
                    {hasMore && (
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className={`tabbar-btn flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 px-1 ${isMobileMenuOpen || moreActive ? 'text-white' : 'text-zinc-500'}`}
                        >
                            <span className={`flex items-center justify-center rounded-full px-3.5 py-1 ${moreActive ? 'bg-apple-blue/20' : ''}`}>
                                <LayoutGrid className={`w-[1.2rem] h-[1.2rem] ${moreActive ? 'text-apple-blue' : ''}`} />
                            </span>
                            {!isMobileLandscape && <span className="text-[0.62rem] font-semibold leading-tight">Plus</span>}
                        </button>
                    )}
                </div>
            </nav>

            {/* MENU « PLUS » : feuille compacte en bas d'écran */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[120] bg-black/60 lg:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <div
                            className="sheet-enter absolute left-0 right-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-3xl bg-[#11131a] border-t border-white/10 shadow-2xl pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 bg-[#11131a] pt-2 pb-2 px-4 z-10">
                                <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2.5" />
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0">
                                        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-apple-blue">TGS-CI · {title}</p>
                                        <p className="text-sm font-bold text-white">Tous les modules</p>
                                    </div>
                                    <button onClick={() => setIsMobileMenuOpen(false)} className="no-min-h w-8 h-8 rounded-full bg-white/10 text-zinc-300 flex items-center justify-center" aria-label="Fermer">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="px-3 grid grid-cols-1 xs:grid-cols-2 gap-1.5">
                                {visibleItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => handleNavClick(item.onClick)}
                                            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left border transition-colors ${item.isActive ? 'bg-apple-blue/15 border-apple-blue/40 text-white' : 'bg-white/[0.03] border-white/[0.05] text-zinc-300 active:bg-white/10'}`}
                                        >
                                            <span className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${item.isActive ? 'bg-apple-blue text-white' : 'bg-apple-blue/10 text-apple-blue'}`}>
                                                {Icon && <Icon className="w-4 h-4" />}
                                            </span>
                                            <span className="flex-1 min-w-0 text-[0.8rem] font-semibold leading-tight line-clamp-2">{item.label}</span>
                                            {item.badge !== undefined && (
                                                <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-apple-blue text-white text-[0.6rem] font-bold">{item.badge}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mx-3 mt-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[0.7rem] font-bold text-zinc-300">Cloud & stockage</p>
                                    <p className="text-[0.65rem] text-zinc-500 truncate">{user?.email || 'Non connecté'}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <StorageHealthIndicator />
                                    <SyncStatusIndicator compact={false} />
                                </div>
                            </div>

                            <div className="px-3 mt-3 grid grid-cols-2 gap-2">
                                {authReady && (user ? (
                                    <button onClick={() => { signOutUser(); setIsMobileMenuOpen(false); }} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[0.72rem] font-bold text-zinc-300">
                                        <LogOutIcon className="w-4 h-4" /> Déconnexion
                                    </button>
                                ) : (
                                    <button onClick={() => { signInWithGoogle(false); setIsMobileMenuOpen(false); }} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600/15 border border-blue-500/30 text-[0.72rem] font-bold text-blue-300">
                                        Connexion Google
                                    </button>
                                ))}
                                <button onClick={handleExit} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600/15 border border-red-500/30 text-[0.72rem] font-bold text-red-300 ${authReady ? '' : 'col-span-2'}`}>
                                    <ArrowUturnLeftIcon className="w-4 h-4" /> Changer d'espace
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