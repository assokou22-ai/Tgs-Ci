import React from 'react';
import { Monitor, Tablet, Smartphone, Check, Sparkles } from 'lucide-react';
import { useDeviceProfile, DeviceProfile } from '../context/DeviceProfileContext.tsx';
import { playTone } from '../utils/audio.ts';

interface DeviceProfileStartupSelectorProps {
    variant?: 'hero' | 'compact' | 'inline';
    className?: string;
    showDescription?: boolean;
}

export const DeviceProfileStartupSelector: React.FC<DeviceProfileStartupSelectorProps> = ({
    variant = 'hero',
    className = '',
    showDescription = true
}) => {
    const { deviceProfile, setDeviceProfile, isTouch } = useDeviceProfile();

    const handleSelect = (profile: DeviceProfile) => {
        if (profile === deviceProfile) return;
        playTone(profile === 'desktop' ? 520 : profile === 'tablet' ? 640 : 780, 80);
        setDeviceProfile(profile);
    };

    if (variant === 'compact') {
        return (
            <div className={`inline-flex items-center p-1 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 ${className}`}>
                <button
                    type="button"
                    onClick={() => handleSelect('desktop')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        deviceProfile === 'desktop'
                            ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                    title="Mode Ordinateur (PC / Mac) : Affichage étendu et haute densité"
                >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>PC / Mac</span>
                </button>

                <button
                    type="button"
                    onClick={() => handleSelect('tablet')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        deviceProfile === 'tablet'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                    title="Mode Tablette (iPad) : Boutons larges et saisie atelier"
                >
                    <Tablet className="w-3.5 h-3.5" />
                    <span>Tablette</span>
                </button>

                <button
                    type="button"
                    onClick={() => handleSelect('mobile')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        deviceProfile === 'mobile'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                    title="Mode Mobile (Smartphone) : Colonnes réduites et gros boutons tactiles"
                >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                </button>
            </div>
        );
    }

    // Default 'hero' variant: visually prominent card for start-up / login / role selection
    return (
        <div className={`w-full max-w-3xl mx-auto bg-zinc-900/90 border border-white/10 rounded-3xl p-3 sm:p-4 shadow-2xl backdrop-blur-xl ${className}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                            Mode d'affichage au démarrage
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                            Sélectionnez votre support de travail pour adapter automatiquement l'interface d'atelier.
                        </p>
                    </div>
                </div>

                {isTouch && (
                    <span className="self-start sm:self-center px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        Tactile Atelier Actif
                    </span>
                )}
            </div>

            {/* 3 Interactive Mode Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3">
                {/* 1. Ordinateur */}
                <button
                    type="button"
                    onClick={() => handleSelect('desktop')}
                    className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer min-h-[95px] active:scale-[0.98] ${
                        deviceProfile === 'desktop'
                            ? 'bg-sky-500/15 border-sky-500 ring-2 ring-sky-500/40 shadow-lg shadow-sky-500/15 text-white'
                            : 'bg-black/40 border-white/10 hover:border-white/20 text-zinc-300 hover:bg-white/[0.03]'
                    }`}
                >
                    <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                            <div className={`p-2 rounded-xl ${deviceProfile === 'desktop' ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                                <Monitor className="w-4 h-4" />
                            </div>
                            {deviceProfile === 'desktop' ? (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-sky-400 bg-sky-500/20 px-2 py-0.5 rounded-full">
                                    <Check className="w-3 h-3" /> Actif
                                </span>
                            ) : (
                                <span className="text-[10px] text-zinc-500 font-medium">PC / Mac</span>
                            )}
                        </div>
                        <div className="font-black text-sm text-white">Ordinateur</div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                            Haute densité, multi-colonnes, raccourcis clavier et grands écrans.
                        </p>
                    </div>
                </button>

                {/* 2. Tablette */}
                <button
                    type="button"
                    onClick={() => handleSelect('tablet')}
                    className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer min-h-[95px] active:scale-[0.98] ${
                        deviceProfile === 'tablet'
                            ? 'bg-indigo-500/20 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-500/15 text-white'
                            : 'bg-black/40 border-white/10 hover:border-white/20 text-zinc-300 hover:bg-white/[0.03]'
                    }`}
                >
                    <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                            <div className={`p-2 rounded-xl ${deviceProfile === 'tablet' ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                                <Tablet className="w-4 h-4" />
                            </div>
                            {deviceProfile === 'tablet' ? (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-300 bg-indigo-500/30 px-2 py-0.5 rounded-full">
                                    <Check className="w-3 h-3" /> Actif
                                </span>
                            ) : (
                                <span className="text-[10px] text-zinc-500 font-medium">iPad & Tab</span>
                            )}
                        </div>
                        <div className="font-black text-sm text-white">Tablette</div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                            Boutons élargis (≥48px), colonnes aérées et confort au banc d'essai.
                        </p>
                    </div>
                </button>

                {/* 3. Mobile */}
                <button
                    type="button"
                    onClick={() => handleSelect('mobile')}
                    className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer min-h-[95px] active:scale-[0.98] ${
                        deviceProfile === 'mobile'
                            ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/15 text-white'
                            : 'bg-black/40 border-white/10 hover:border-white/20 text-zinc-300 hover:bg-white/[0.03]'
                    }`}
                >
                    <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                            <div className={`p-2 rounded-xl ${deviceProfile === 'mobile' ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                                <Smartphone className="w-4 h-4" />
                            </div>
                            {deviceProfile === 'mobile' ? (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-300 bg-emerald-500/30 px-2 py-0.5 rounded-full">
                                    <Check className="w-3 h-3" /> Actif
                                </span>
                            ) : (
                                <span className="text-[10px] text-zinc-500 font-medium">iPhone / Android</span>
                            )}
                        </div>
                        <div className="font-black text-sm text-white">Mobile</div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                            Colonnes réduites, fiches cartes tactiles et saisie rapide au pouce.
                        </p>
                    </div>
                </button>
            </div>

            {showDescription && (
                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>
                        💡 {deviceProfile === 'desktop' 
                            ? 'Affichage haute précision avec toutes les colonnes détaillées.' 
                            : deviceProfile === 'tablet' 
                            ? 'Colonnes regroupées en cartes tactiles, touches agrandies pour saisie facile en atelier.' 
                            : 'Disposition 1 colonne compacte, gros boutons au pouce, zéro défilement horizontal.'}
                    </span>
                    <span className="hidden md:inline font-mono text-[10px] text-zinc-600">
                        Modifiable à tout moment
                    </span>
                </div>
            )}
        </div>
    );
};

export default DeviceProfileStartupSelector;
