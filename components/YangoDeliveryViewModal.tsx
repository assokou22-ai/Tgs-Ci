import React, { useState } from 'react';
import { 
    X, 
    Truck, 
    Calendar, 
    User, 
    Phone, 
    MessageCircle, 
    Camera, 
    FileText, 
    Eye, 
    Download,
    Store
} from 'lucide-react';
import { YangoDeliveryInfo, ReceptionMode } from '../types';
import { isPdfDataUrl } from '../utils/fileHelpers';

interface YangoDeliveryViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    receptionMode?: ReceptionMode;
    yangoDetails?: YangoDeliveryInfo;
    ticketId: string;
    clientName?: string;
    clientPhone?: string;
}

export const YangoDeliveryViewModal: React.FC<YangoDeliveryViewModalProps> = ({
    isOpen,
    onClose,
    receptionMode = 'depot_atelier',
    yangoDetails,
    ticketId,
    clientName,
    clientPhone,
}) => {
    const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; isPdf: boolean } | null>(null);

    if (!isOpen) return null;

    const isYango = receptionMode === 'livraison_yango';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isYango ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'}`}>
                            {isYango ? <Truck className="w-6 h-6" /> : <Store className="w-6 h-6" />}
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <span>{isYango ? "Dossier de Livraison Yango" : "Dépôt Direct au Comptoir"}</span>
                                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                    #{ticketId}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400">
                                {isYango 
                                    ? "Traçabilité complète de l'acheminement, captures WhatsApp et contact du livreur" 
                                    : "L'appareil a été déposé physiquement au comptoir par le client"}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
                    {!isYango ? (
                        <div className="p-6 bg-slate-800/40 border border-slate-700 rounded-xl text-center space-y-2">
                            <Store className="w-10 h-10 text-sky-400 mx-auto mb-2" />
                            <h4 className="font-semibold text-white text-base">Dépôt physique à l'atelier</h4>
                            <p className="text-xs text-slate-300 max-w-md mx-auto">
                                Cet ordinateur a été déposé directement par le client ({clientName || 'Client'} - {clientPhone || 'N/A'}) au comptoir de l'atelier TGS-CI.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Informations de la course */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="p-3.5 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                        Date de réception
                                    </span>
                                    <p className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-amber-400" />
                                        <span>{yangoDetails?.receptionDate || 'Non spécifiée'}</span>
                                    </p>
                                </div>

                                <div className="p-3.5 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                        Référence / N° de course
                                    </span>
                                    <p className="text-sm font-mono font-bold text-amber-300 mt-1">
                                        {yangoDetails?.deliveryReference || 'Non spécifiée'}
                                    </p>
                                </div>

                                <div className="p-3.5 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                        Type de coursier
                                    </span>
                                    <p className="text-xs font-semibold text-white mt-1">
                                        {yangoDetails?.driverType === 'yango_affilie'
                                            ? 'Livreur officiel Yango'
                                            : 'Coursier non affilié / Tiers'}
                                    </p>
                                </div>
                            </div>

                            {/* Contact Livreur */}
                            <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2">
                                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Identité du livreur ayant déposé l'appareil
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-slate-400">Nom du livreur :</span>{' '}
                                        <span className="font-semibold text-white">
                                            {yangoDetails?.driverName || 'Non renseigné'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Téléphone livreur :</span>{' '}
                                        {yangoDetails?.driverPhone ? (
                                            <a 
                                                href={`tel:${yangoDetails.driverPhone}`}
                                                className="font-mono font-bold text-amber-300 hover:underline inline-flex items-center gap-1"
                                            >
                                                <Phone className="w-3.5 h-3.5" />
                                                <span>{yangoDetails.driverPhone}</span>
                                            </a>
                                        ) : (
                                            <span className="text-slate-500 italic">Non renseigné</span>
                                        )}
                                    </div>
                                </div>
                                {yangoDetails?.deliveryNotes && (
                                    <div className="text-xs text-slate-300 pt-1 border-t border-amber-500/20">
                                        <span className="text-slate-400">Notes :</span> {yangoDetails.deliveryNotes}
                                    </div>
                                )}
                            </div>

                            {/* Captures & Pièces jointes */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Captures d'écran & Preuves numériques de la livraison
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* 1. WhatsApp Screenshot */}
                                    <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl space-y-2 flex flex-col justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                                            <MessageCircle className="w-4 h-4" />
                                            <span>Capture WhatsApp Formulaire</span>
                                        </div>

                                        {yangoDetails?.whatsappScreenshot ? (
                                            <div className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black/40">
                                                <img 
                                                    src={yangoDetails.whatsappScreenshot} 
                                                    alt="WhatsApp" 
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewDoc({
                                                            url: yangoDetails.whatsappScreenshot!,
                                                            title: "Capture WhatsApp du formulaire client",
                                                            isPdf: false
                                                        })}
                                                        className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                                                        title="Agrandir"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <a
                                                        href={yangoDetails.whatsappScreenshot}
                                                        download={`whatsapp_${ticketId}`}
                                                        className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                                                        title="Télécharger"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-700 rounded-lg">
                                                Aucune capture WhatsApp jointe
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Driver Screenshot */}
                                    <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl space-y-2 flex flex-col justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                                            <Camera className="w-4 h-4" />
                                            <span>Photo / Profil du Livreur</span>
                                        </div>

                                        {yangoDetails?.driverScreenshot ? (
                                            <div className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black/40">
                                                <img 
                                                    src={yangoDetails.driverScreenshot} 
                                                    alt="Livreur" 
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewDoc({
                                                            url: yangoDetails.driverScreenshot!,
                                                            title: "Photo / Capture du livreur",
                                                            isPdf: false
                                                        })}
                                                        className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                                                        title="Agrandir"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <a
                                                        href={yangoDetails.driverScreenshot}
                                                        download={`livreur_${ticketId}`}
                                                        className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                                                        title="Télécharger"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-700 rounded-lg">
                                                Aucune photo de coursier jointe
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Delivery Proof Document */}
                                    <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl space-y-2 flex flex-col justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                                            <FileText className="w-4 h-4" />
                                            <span>Preuve / Décharge de livraison</span>
                                        </div>

                                        {yangoDetails?.deliveryProofDoc ? (
                                            <div className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-video bg-slate-850 flex items-center justify-center p-2">
                                                {isPdfDataUrl(yangoDetails.deliveryProofDoc) ? (
                                                    <div className="flex flex-col items-center text-slate-300">
                                                        <FileText className="w-8 h-8 text-red-400 mb-1" />
                                                        <span className="text-[11px] truncate max-w-[120px] font-mono">
                                                            {yangoDetails.deliveryProofDocName || 'preuve_livraison.pdf'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <img 
                                                        src={yangoDetails.deliveryProofDoc} 
                                                        alt="Preuve livraison" 
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewDoc({
                                                            url: yangoDetails.deliveryProofDoc!,
                                                            title: yangoDetails.deliveryProofDocName || "Preuve de livraison",
                                                            isPdf: isPdfDataUrl(yangoDetails.deliveryProofDoc)
                                                        })}
                                                        className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                                                        title="Aperçu"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <a
                                                        href={yangoDetails.deliveryProofDoc}
                                                        download={yangoDetails.deliveryProofDocName || `preuve_${ticketId}`}
                                                        className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                                                        title="Télécharger"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-700 rounded-lg">
                                                Aucune décharge jointe
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            </div>

            {/* Modal sous-jacent d'agrandissement d'image ou PDF */}
            {previewDoc && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
                    <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800">
                            <h4 className="text-sm font-semibold text-white truncate">
                                {previewDoc.title}
                            </h4>
                            <button
                                type="button"
                                onClick={() => setPreviewDoc(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-auto flex items-center justify-center flex-1 bg-black/50">
                            {previewDoc.isPdf ? (
                                <iframe 
                                    src={previewDoc.url}
                                    className="w-full h-[70vh] border-0 rounded-lg"
                                    title={previewDoc.title}
                                />
                            ) : (
                                <img
                                    src={previewDoc.url}
                                    alt={previewDoc.title}
                                    className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
