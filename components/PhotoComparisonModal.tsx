import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, ArrowLeftRight, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { RestitutionDetails } from '../types';

interface PhotoComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    intakePhotos: string[];
    restitutionPhotos: string[];
    ticketNumber?: string;
    restitutionDetails?: RestitutionDetails;
}

export const PhotoComparisonModal: React.FC<PhotoComparisonModalProps> = ({
    isOpen,
    onClose,
    intakePhotos = [],
    restitutionPhotos = [],
    ticketNumber,
    restitutionDetails,
}) => {
    const [selectedIntakeIdx, setSelectedIntakeIdx] = useState<number>(0);
    const [selectedRestitutionIdx, setSelectedRestitutionIdx] = useState<number>(0);
    const [zoomLevel, setZoomLevel] = useState<number>(1);

    if (!isOpen) return null;

    const currentIntakePhoto = intakePhotos[selectedIntakeIdx] || intakePhotos[0];
    const currentRestitutionPhoto = restitutionPhotos[selectedRestitutionIdx] || restitutionPhotos[0];

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.3, 2.5));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.3, 1));
    const handleResetZoom = () => setZoomLevel(1);

    const getRepairedBadge = () => {
        if (!restitutionDetails) return null;
        if (restitutionDetails.isRepaired === 'oui') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Réparé : OUI
                </span>
            );
        } else if (restitutionDetails.isRepaired === 'non') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <X className="w-3.5 h-3.5" /> Réparé : NON
                </span>
            );
        } else {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" /> Statut : Précisé
                </span>
            );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-7xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col h-[95vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            <ArrowLeftRight className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <span>Comparateur d'inspection Avant / Après</span>
                                {ticketNumber && (
                                    <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                                        Fiche #{ticketNumber}
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-slate-400">
                                Vérification de l'état esthétique et des éléments remplacés pour la traçabilité officielle
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Contrôles de zoom */}
                        <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                            <button
                                type="button"
                                onClick={handleZoomOut}
                                disabled={zoomLevel <= 1}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-40"
                                title="Zoom arrière"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-mono text-slate-300 px-2">
                                {Math.round(zoomLevel * 100)}%
                            </span>
                            <button
                                type="button"
                                onClick={handleZoomIn}
                                disabled={zoomLevel >= 2.5}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-40"
                                title="Zoom avant"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleResetZoom}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
                                title="Réinitialiser zoom"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Split View Canvas */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 min-h-0 bg-slate-950/70 overflow-hidden">
                    {/* Colonne GAUCHE : À la réception (Avant) */}
                    <div className="flex flex-col border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                        <div className="p-3 bg-slate-850/80 border-b border-slate-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                                    A. À la réception (Avant intervention)
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                                Photo {intakePhotos.length > 0 ? selectedIntakeIdx + 1 : 0} sur {intakePhotos.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-auto flex items-center justify-center p-3 relative bg-black/40">
                            {currentIntakePhoto ? (
                                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                    <img
                                        src={currentIntakePhoto}
                                        alt="Inspection Réception"
                                        style={{ transform: `scale(${zoomLevel})` }}
                                        className="max-h-full max-w-full object-contain rounded-lg transition-transform duration-150 origin-center"
                                    />
                                </div>
                            ) : (
                                <div className="text-center p-6 text-slate-500 text-xs">
                                    Aucune photo enregistrée à la réception
                                </div>
                            )}
                        </div>

                        {/* Sélecteur de miniatures Réception */}
                        {intakePhotos.length > 1 && (
                            <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex gap-2 overflow-x-auto shrink-0">
                                {intakePhotos.map((img, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setSelectedIntakeIdx(idx)}
                                        className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                                            selectedIntakeIdx === idx
                                                ? 'border-amber-400 ring-2 ring-amber-400/30'
                                                : 'border-slate-700 opacity-60 hover:opacity-100'
                                        }`}
                                    >
                                        <img src={img} alt={`Miniature ${idx}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Colonne DROITE : Avant restitution (Après) */}
                    <div className="flex flex-col border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                        <div className="p-3 bg-slate-850/80 border-b border-slate-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                                    B. Avant restitution (Après intervention)
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {getRepairedBadge()}
                                <span className="text-[11px] text-slate-400">
                                    Photo {restitutionPhotos.length > 0 ? selectedRestitutionIdx + 1 : 0} sur {restitutionPhotos.length}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto flex items-center justify-center p-3 relative bg-black/40">
                            {currentRestitutionPhoto ? (
                                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                    <img
                                        src={currentRestitutionPhoto}
                                        alt="Inspection Restitution"
                                        style={{ transform: `scale(${zoomLevel})` }}
                                        className="max-h-full max-w-full object-contain rounded-lg transition-transform duration-150 origin-center"
                                    />
                                </div>
                            ) : (
                                <div className="text-center p-6 text-slate-500 text-xs">
                                    Aucune photo enregistrée pour la restitution
                                </div>
                            )}
                        </div>

                        {/* Sélecteur de miniatures Restitution */}
                        {restitutionPhotos.length > 1 && (
                            <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex gap-2 overflow-x-auto shrink-0">
                                {restitutionPhotos.map((img, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setSelectedRestitutionIdx(idx)}
                                        className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                                            selectedRestitutionIdx === idx
                                                ? 'border-emerald-400 ring-2 ring-emerald-400/30'
                                                : 'border-slate-700 opacity-60 hover:opacity-100'
                                        }`}
                                    >
                                        <img src={img} alt={`Miniature ${idx}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer récapitulatif */}
                {restitutionDetails && (
                    <div className="p-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>
                                <strong>Éléments réparés / remplacés :</strong>{' '}
                                {restitutionDetails.repairedComponents && restitutionDetails.repairedComponents.length > 0
                                    ? restitutionDetails.repairedComponents.join(', ')
                                    : 'Non spécifiés'}
                            </span>
                        </div>
                        {restitutionDetails.repairPrecision && (
                            <div className="text-slate-400 italic">
                                Note : {restitutionDetails.repairPrecision}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
