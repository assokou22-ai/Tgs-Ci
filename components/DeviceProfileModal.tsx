import React, { useState } from 'react';
import { Monitor, Tablet, Smartphone, Check, Sparkles, X } from 'lucide-react';
import { useDeviceProfile, DeviceProfile } from '../context/DeviceProfileContext';

export const DeviceProfileModal: React.FC = () => {
    const { deviceProfile, setDeviceProfile, isModalOpen, setIsModalOpen } = useDeviceProfile();
    const [selectedProfile, setSelectedProfile] = useState<DeviceProfile>(deviceProfile);

    if (!isModalOpen) return null;

    const handleConfirm = () => {
        setDeviceProfile(selectedProfile);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
                            <Sparkles className="w-4 h-4" />
                            Optimisation d'affichage TGS-CI
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                            Sur quel appareil utilisez-vous l'application ?
                        </h2>
                        <p className="text-slate-400 text-xs sm:text-sm mt-1">
                            Choisissez votre support pour adapter instantanément la disposition, la taille des boutons tactiles et la simplicité des écrans.
                        </p>
                    </div>
                    {/* Bouton fermer si ce n'est pas le tout premier choix obligatoire */}
                    {localStorage.getItem('tgs_device_profile_mode') && (
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                            aria-label="Fermer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Options Cards */}
                <div className="p-6 space-y-3 overflow-y-auto flex-1">
                    {/* Option 1: Ordinateur */}
                    <div
                        onClick={() => setSelectedProfile('desktop')}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4 ${
                            selectedProfile === 'desktop'
                                ? 'bg-sky-500/10 border-sky-500 ring-1 ring-sky-500'
                                : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/80 hover:border-slate-600'
                        }`}
                    >
                        <div className={`p-3 rounded-xl shrink-0 ${
                            selectedProfile === 'desktop' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'bg-slate-800 text-slate-300'
                        }`}>
                            <Monitor className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-semibold text-white text-base">
                                    Ordinateur (PC / Mac)
                                </h3>
                                {selectedProfile === 'desktop' && (
                                    <span className="flex items-center gap-1 text-xs font-medium text-sky-400 bg-sky-500/20 px-2 py-0.5 rounded-full">
                                        <Check className="w-3.5 h-3.5" /> Sélectionné
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-300 text-xs leading-relaxed">
                                Affichage complet haute résolution, raccourcis clavier, vue multi-colonnes, tableaux financiers détaillés et gestion globale.
                            </p>
                        </div>
                    </div>

                    {/* Option 2: iPad & Tablette */}
                    <div
                        onClick={() => setSelectedProfile('tablet')}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4 ${
                            selectedProfile === 'tablet'
                                ? 'bg-indigo-500/10 border-indigo-500 ring-1 ring-indigo-500'
                                : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/80 hover:border-slate-600'
                        }`}
                    >
                        <div className={`p-3 rounded-xl shrink-0 ${
                            selectedProfile === 'tablet' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-300'
                        }`}>
                            <Tablet className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-semibold text-white text-base">
                                    iPad & Tablette tactile
                                </h3>
                                {selectedProfile === 'tablet' && (
                                    <span className="flex items-center gap-1 text-xs font-medium text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full">
                                        <Check className="w-3.5 h-3.5" /> Sélectionné
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-300 text-xs leading-relaxed">
                                Ergonomie tactile optimisée, boutons larges (≥ 44px), formulaires spacieux et prise de photos rapide au banc de réparation.
                            </p>
                        </div>
                    </div>

                    {/* Option 3: Téléphone (iPhone / Android) */}
                    <div
                        onClick={() => setSelectedProfile('mobile')}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4 ${
                            selectedProfile === 'mobile'
                                ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500'
                                : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/80 hover:border-slate-600'
                        }`}
                    >
                        <div className={`p-3 rounded-xl shrink-0 ${
                            selectedProfile === 'mobile' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-300'
                        }`}>
                            <Smartphone className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-semibold text-white text-base">
                                    Téléphone portable (Android / iPhone)
                                </h3>
                                {selectedProfile === 'mobile' && (
                                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                                        <Check className="w-3.5 h-3.5" /> Sélectionné
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-300 text-xs leading-relaxed">
                                Interface simplifiée et épurée, gros boutons au pouce, accès instantané à la caméra pour photos et captures WhatsApp/Yango.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-400 text-center sm:text-left">
                        Vous pourrez changer ce mode à tout moment d'un simple clic dans l'en-tête de l'application.
                    </p>
                    <button
                        onClick={handleConfirm}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2"
                    >
                        Appliquer ce profil
                    </button>
                </div>
            </div>
        </div>
    );
};
