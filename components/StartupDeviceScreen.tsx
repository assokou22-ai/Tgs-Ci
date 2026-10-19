import React, { useState } from 'react';
import { Monitor, Tablet, Smartphone, Check, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { useDeviceProfile, DeviceProfile } from '../context/DeviceProfileContext.tsx';
import { AppleLogo } from './icons.tsx';
import { CoteDIvoireFlag, BeninFlag } from './Flags.tsx';
import BackgroundAnimation from './BackgroundAnimation.tsx';
import { playTone } from '../utils/audio.ts';

interface StartupDeviceScreenProps {
    onConfirm?: (profile: DeviceProfile) => void;
}

export const StartupDeviceScreen: React.FC<StartupDeviceScreenProps> = ({ onConfirm }) => {
    const { deviceProfile, confirmProfile } = useDeviceProfile();
    const [selected, setSelected] = useState<DeviceProfile>(deviceProfile);

    const handleSelect = (profile: DeviceProfile) => {
        setSelected(profile);
        playTone(profile === 'desktop' ? 520 : profile === 'tablet' ? 640 : 780, 80);
    };

    const handleProceed = () => {
        playTone(880, 120);
        if (onConfirm) {
            onConfirm(selected);
        } else {
            confirmProfile(selected);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-between items-center p-4 sm:p-6 md:p-8 text-white relative overflow-hidden bg-[#07080a] selection:bg-apple-blue selection:text-white">
            <BackgroundAnimation />

            {/* Top Bar Branding */}
            <header className="w-full max-w-4xl mx-auto flex items-center justify-between py-2 z-10">
                <div className="flex items-center gap-2.5">
                    <AppleLogo className="w-5 h-5 text-white" />
                    <span className="text-xs font-bold tracking-tight text-white uppercase">TGS-CI Pro 2026</span>
                    <span className="text-zinc-600 text-xs">·</span>
                    <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">Atelier Spécialisé MacBook</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[11px] font-bold text-white tracking-wide">Abidjan, Cocody</span>
                    <CoteDIvoireFlag className="w-4 h-2.5 ml-1" />
                    <BeninFlag className="w-4 h-2.5" />
                </div>
            </header>

            {/* Main Stage */}
            <main className="flex-grow flex flex-col justify-center items-center w-full max-w-3xl py-6 sm:py-10 z-10">
                {/* Visual Header */}
                <div className="text-center mb-6 sm:mb-8 max-w-xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs text-sky-300 font-semibold mb-3.5 backdrop-blur-md shadow-lg shadow-sky-950/20">
                        <Sparkles className="w-4 h-4 text-sky-400 animate-spin-slow" />
                        <span>CONFIGURATION INITIALE DE L'APPAREIL</span>
                    </div>

                    <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                        Quel support utilisez-vous ?
                    </h1>

                    <p className="mt-2.5 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                        L'interface s'ajuste et s'enregistre définitivement sur cet appareil pour vous offrir une ergonomie parfaite en atelier.
                    </p>
                </div>

                {/* The 3-Mode Selector Card matching user requirement & screenshot */}
                <div className="w-full bg-zinc-900/90 border border-white/15 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-2xl">
                    <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/10">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                                    Mode d'affichage au démarrage
                                </h3>
                                <p className="text-[11px] text-zinc-400">
                                    Sélectionnez votre support de travail pour adapter automatiquement l'interface d'atelier.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 3 Interactive Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* 1. Ordinateur (PC / Mac) */}
                        <div
                            onClick={() => handleSelect('desktop')}
                            className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer active:scale-[0.98] ${
                                selected === 'desktop'
                                    ? 'bg-sky-500/15 border-sky-400 ring-2 ring-sky-400/50 shadow-xl shadow-sky-500/20 text-white'
                                    : 'bg-black/50 border-white/10 hover:border-white/20 text-zinc-300 hover:bg-white/[0.02]'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-1 mb-2">
                                    <div className={`p-2.5 rounded-xl ${selected === 'desktop' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'bg-zinc-800 text-zinc-400'}`}>
                                        <Monitor className="w-5 h-5" />
                                    </div>

                                    {selected === 'desktop' ? (
                                        <span className="flex items-center gap-1 text-[10px] font-black uppercase text-sky-400 bg-sky-500/25 px-2.5 py-1 rounded-full border border-sky-400/30">
                                            <Check className="w-3.5 h-3.5" /> Actif
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-medium text-zinc-500">PC / Mac</span>
                                    )}
                                </div>

                                <div className="font-black text-base text-white tracking-tight">Ordinateur</div>
                                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                                    Haute densité, multi-colonnes, raccourcis clavier et grands écrans.
                                </p>
                            </div>
                        </div>

                        {/* 2. Tablette (iPad & Tab) */}
                        <div
                            onClick={() => handleSelect('tablet')}
                            className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer active:scale-[0.98] ${
                                selected === 'tablet'
                                    ? 'bg-indigo-500/20 border-indigo-400 ring-2 ring-indigo-400/50 shadow-xl shadow-indigo-500/20 text-white'
                                    : 'bg-black/50 border-white/10 hover:border-white/20 text-zinc-300 hover:bg-white/[0.02]'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-1 mb-2">
                                    <div className={`p-2.5 rounded-xl ${selected === 'tablet' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' : 'bg-zinc-800 text-zinc-400'}`}>
                                        <Tablet className="w-5 h-5" />
                                    </div>

                                    {selected === 'tablet' ? (
                                        <span className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-300 bg-indigo-500/30 px-2.5 py-1 rounded-full border border-indigo-400/30">
                                            <Check className="w-3.5 h-3.5" /> Actif
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-medium text-zinc-500">iPad & Tab</span>
                                    )}
                                </div>

                                <div className="font-black text-base text-white tracking-tight">Tablette</div>
                                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                                    Boutons élargis (≥48px), colonnes aérées et confort au banc d'essai.
                                </p>
                            </div>
                        </div>

                        {/* 3. Mobile (iPhone / Android) */}
                        <div
                            onClick={() => handleSelect('mobile')}
                            className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer active:scale-[0.98] ${
                                selected === 'mobile'
                                    ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/50 shadow-xl shadow-emerald-500/20 text-white'
                                    : 'bg-black/50 border-white/10 hover:border-white/20 text-zinc-300 hover:bg-white/[0.02]'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-1 mb-2">
                                    <div className={`p-2.5 rounded-xl ${selected === 'mobile' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-zinc-800 text-zinc-400'}`}>
                                        <Smartphone className="w-5 h-5" />
                                    </div>

                                    {selected === 'mobile' ? (
                                        <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-300 bg-emerald-500/30 px-2.5 py-1 rounded-full border border-emerald-400/30">
                                            <Check className="w-3.5 h-3.5" /> Actif
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-medium text-zinc-500">iPhone / Android</span>
                                    )}
                                </div>

                                <div className="font-black text-base text-white tracking-tight">Mobile</div>
                                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                                    Colonnes réduites, fiches cartes tactiles et saisie rapide au pouce.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Explanatory Bottom Line */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-400">
                        <span className="flex items-center gap-1.5">
                            <span>💡</span>
                            <span>
                                {selected === 'desktop' && 'Affichage haute précision avec toutes les colonnes détaillées.'}
                                {selected === 'tablet' && 'Colonnes regroupées en cartes tactiles, touches agrandies pour saisie facile en atelier.'}
                                {selected === 'mobile' && 'Disposition 1 colonne compacte, gros boutons au pouce, zéro défilement horizontal.'}
                            </span>
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500">
                            Modifiable à tout moment
                        </span>
                    </div>
                </div>

                {/* Validation CTA Button */}
                <div className="w-full mt-6 flex flex-col items-center">
                    <button
                        type="button"
                        onClick={handleProceed}
                        className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-500 hover:via-indigo-500 hover:to-sky-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-600/30 active:scale-95 min-h-[54px] cursor-pointer"
                    >
                        <span>Valider et Accéder à l'Atelier</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>

                    <p className="text-[11px] text-zinc-500 mt-2.5 text-center flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ce réglage est mémorisé sur ce navigateur pour tous vos démarrages futurs.</span>
                    </p>
                </div>
            </main>

            {/* Subtle Footer */}
            <footer className="text-xs text-zinc-600 z-10 pb-2 text-center">
                TGSCI Informatique · Hautes Réparations Spécialisées Apple Mac
            </footer>
        </div>
    );
};

export default StartupDeviceScreen;
