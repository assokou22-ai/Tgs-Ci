import React, { useRef, useState } from 'react';
import { 
    Truck, 
    Store, 
    Upload, 
    FileText, 
    Eye, 
    Trash2, 
    Phone, 
    User, 
    MessageCircle, 
    Camera, 
    X,
    CheckCircle2,
    Calendar
} from 'lucide-react';
import { ReceptionMode, YangoDeliveryInfo } from '../types';
import { compressImage, isPdfDataUrl } from '../utils/fileHelpers';
import { useDeviceProfile } from '../context/DeviceProfileContext';

interface ReceptionModeFieldProps {
    receptionMode: ReceptionMode;
    yangoDetails?: YangoDeliveryInfo;
    onChangeMode: (mode: ReceptionMode) => void;
    onChangeYangoDetails: (details: YangoDeliveryInfo) => void;
    clientName?: string;
    clientPhone?: string;
}

export const ReceptionModeField: React.FC<ReceptionModeFieldProps> = ({
    receptionMode,
    yangoDetails,
    onChangeMode,
    onChangeYangoDetails,
    clientName,
    clientPhone,
}) => {
    const { isTouch } = useDeviceProfile();
    const [previewModalUrl, setPreviewModalUrl] = useState<{ url: string; title: string; isPdf: boolean } | null>(null);
    const [isUploading, setIsUploading] = useState<string | null>(null);

    const whatsappInputRef = useRef<HTMLInputElement>(null);
    const driverInputRef = useRef<HTMLInputElement>(null);
    const proofDocInputRef = useRef<HTMLInputElement>(null);

    // Initialisation ou fusion des détails Yango
    const details: YangoDeliveryInfo = yangoDetails || {
        receptionDate: new Date().toISOString().split('T')[0],
        driverType: 'yango_affilie',
        clientName: clientName || '',
        clientPhone: clientPhone || '',
    };

    const updateDetails = (patch: Partial<YangoDeliveryInfo>) => {
        onChangeYangoDetails({
            ...details,
            ...patch,
        });
    };

    const handleFileUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        target: 'whatsapp' | 'driver' | 'proofDoc'
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(target);
        try {
            const base64 = await compressImage(file);
            if (target === 'whatsapp') {
                updateDetails({ whatsappScreenshot: base64 });
            } else if (target === 'driver') {
                updateDetails({ driverScreenshot: base64 });
            } else if (target === 'proofDoc') {
                updateDetails({ 
                    deliveryProofDoc: base64,
                    deliveryProofDocName: file.name
                });
            }
        } catch (err) {
            console.error("Erreur de lecture du fichier:", err);
        } finally {
            setIsUploading(null);
            e.target.value = '';
        }
    };

    return (
        <div className="bg-slate-900/70 border border-slate-700/80 rounded-2xl p-4 sm:p-6 space-y-5">
            {/* Header de section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                    <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                        <Truck className="w-5 h-5 text-sky-400" />
                        Mode d'arrivée de l'ordinateur à l'atelier
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Indiquez si l'appareil a été déposé en direct ou acheminé par coursier Yango
                    </p>
                </div>
            </div>

            {/* Sélecteur segmenté Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => onChangeMode('depot_atelier')}
                    className={`flex items-center justify-center gap-3 p-3.5 rounded-xl border font-medium text-sm transition-all ${
                        isTouch ? 'min-h-[48px]' : ''
                    } ${
                        receptionMode === 'depot_atelier'
                            ? 'bg-sky-500/15 border-sky-500 text-sky-200 ring-1 ring-sky-500 shadow-md shadow-sky-500/10'
                            : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                    <Store className="w-5 h-5 text-sky-400" />
                    <span>Dépôt direct au comptoir atelier</span>
                    {receptionMode === 'depot_atelier' && (
                        <CheckCircle2 className="w-4 h-4 ml-auto text-sky-400" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => onChangeMode('livraison_yango')}
                    className={`flex items-center justify-center gap-3 p-3.5 rounded-xl border font-medium text-sm transition-all ${
                        isTouch ? 'min-h-[48px]' : ''
                    } ${
                        receptionMode === 'livraison_yango'
                            ? 'bg-amber-500/15 border-amber-500 text-amber-200 ring-1 ring-amber-500 shadow-md shadow-amber-500/10'
                            : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                    <Truck className="w-5 h-5 text-amber-400" />
                    <span>Livraison de l'ordinateur par Yango</span>
                    {receptionMode === 'livraison_yango' && (
                        <CheckCircle2 className="w-4 h-4 ml-auto text-amber-400" />
                    )}
                </button>
            </div>

            {/* Détails spécifiques si Livraison Yango */}
            {receptionMode === 'livraison_yango' && (
                <div className="bg-amber-950/15 border border-amber-500/30 rounded-xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                        <Truck className="w-4 h-4" />
                        Détails & Pièces justificatives de la course Yango
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Date de réception */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                Date de réception par Yango
                            </label>
                            <input
                                type="date"
                                value={details.receptionDate || ''}
                                onChange={(e) => updateDetails({ receptionDate: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                            />
                        </div>

                        {/* Référence ou numéro de course Yango */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                Référence / N° de course Yango (si dispo)
                            </label>
                            <input
                                type="text"
                                placeholder="ex: YNG-98421"
                                value={details.deliveryReference || ''}
                                onChange={(e) => updateDetails({ deliveryReference: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                            />
                        </div>

                        {/* Type de livreur */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                Statut du livreur
                            </label>
                            <select
                                value={details.driverType || 'yango_affilie'}
                                onChange={(e) => updateDetails({ driverType: e.target.value as 'yango_affilie' | 'livreur_independant' })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                            >
                                <option value="yango_affilie">Coursier officiel affilié Yango</option>
                                <option value="livreur_independant">Livreur non affilié / Coursier tiers</option>
                            </select>
                        </div>
                    </div>

                    {/* Informations du livreur si non affilié ou coordonnées complémentaires */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                Nom du livreur {details.driverType === 'livreur_independant' ? '(requis)' : '(ou pseudo Yango)'}
                            </label>
                            <input
                                type="text"
                                placeholder="ex: Mamadou K."
                                value={details.driverName || ''}
                                onChange={(e) => updateDetails({ driverName: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                Téléphone du livreur
                            </label>
                            <input
                                type="tel"
                                placeholder="ex: 07 00 00 00 00"
                                value={details.driverPhone || ''}
                                onChange={(e) => updateDetails({ driverPhone: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Zone des 3 pièces jointes / captures */}
                    <div className="pt-2 space-y-3">
                        <div className="text-xs font-medium text-slate-300">
                            Pièces jointes obligatoires & preuves visuelles :
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* 1. Capture d'écran WhatsApp du formulaire */}
                            <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1">
                                        <MessageCircle className="w-4 h-4 shrink-0" />
                                        <span>1. Capture WhatsApp</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-tight mb-2">
                                        Formulaire renseigné par le client expéditeur
                                    </p>
                                </div>

                                {details.whatsappScreenshot ? (
                                    <div className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black/40">
                                        <img 
                                            src={details.whatsappScreenshot} 
                                            alt="Capture WhatsApp" 
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewModalUrl({
                                                    url: details.whatsappScreenshot!,
                                                    title: "Capture WhatsApp du formulaire client",
                                                    isPdf: false
                                                })}
                                                className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                                                title="Agrandir"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateDetails({ whatsappScreenshot: undefined })}
                                                className="p-1.5 bg-red-900/80 text-red-200 rounded-lg hover:bg-red-800"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => whatsappInputRef.current?.click()}
                                        disabled={isUploading === 'whatsapp'}
                                        className="w-full py-4 border border-dashed border-slate-700 hover:border-emerald-500 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors bg-slate-800/20"
                                    >
                                        <Upload className="w-5 h-5" />
                                        <span className="text-xs">Ajouter capture WhatsApp</span>
                                    </button>
                                )}
                                <input
                                    ref={whatsappInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(e, 'whatsapp')}
                                />
                            </div>

                            {/* 2. Capture du livreur ou photo de la course */}
                            <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1">
                                        <Camera className="w-4 h-4 shrink-0" />
                                        <span>2. Photo / Profil Livreur</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-tight mb-2">
                                        Capture de l'app Yango ou photo physique du livreur
                                    </p>
                                </div>

                                {details.driverScreenshot ? (
                                    <div className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black/40">
                                        <img 
                                            src={details.driverScreenshot} 
                                            alt="Photo Livreur" 
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewModalUrl({
                                                    url: details.driverScreenshot!,
                                                    title: "Capture / Photo du livreur",
                                                    isPdf: false
                                                })}
                                                className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                                                title="Agrandir"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateDetails({ driverScreenshot: undefined })}
                                                className="p-1.5 bg-red-900/80 text-red-200 rounded-lg hover:bg-red-800"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => driverInputRef.current?.click()}
                                        disabled={isUploading === 'driver'}
                                        className="w-full py-4 border border-dashed border-slate-700 hover:border-amber-500 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-amber-400 transition-colors bg-slate-800/20"
                                    >
                                        <Camera className="w-5 h-5" />
                                        <span className="text-xs">Ajouter photo / capture</span>
                                    </button>
                                )}
                                <input
                                    ref={driverInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(e, 'driver')}
                                />
                            </div>

                            {/* 3. Document / Preuve de livraison */}
                            <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 mb-1">
                                        <FileText className="w-4 h-4 shrink-0" />
                                        <span>3. Preuve / Décharge</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-tight mb-2">
                                        Bordereau, reçu de course ou décharge (JPG/PDF)
                                    </p>
                                </div>

                                {details.deliveryProofDoc ? (
                                    <div className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-video bg-slate-850 flex items-center justify-center p-2 text-center">
                                        {isPdfDataUrl(details.deliveryProofDoc) ? (
                                            <div className="flex flex-col items-center text-slate-300">
                                                <FileText className="w-8 h-8 text-red-400 mb-1" />
                                                <span className="text-[11px] truncate max-w-[120px] font-mono">
                                                    {details.deliveryProofDocName || 'preuve_livraison.pdf'}
                                                </span>
                                            </div>
                                        ) : (
                                            <img 
                                                src={details.deliveryProofDoc} 
                                                alt="Preuve livraison" 
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewModalUrl({
                                                    url: details.deliveryProofDoc!,
                                                    title: details.deliveryProofDocName || "Preuve de livraison",
                                                    isPdf: isPdfDataUrl(details.deliveryProofDoc)
                                                })}
                                                className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                                                title="Aperçu"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateDetails({ 
                                                    deliveryProofDoc: undefined,
                                                    deliveryProofDocName: undefined
                                                })}
                                                className="p-1.5 bg-red-900/80 text-red-200 rounded-lg hover:bg-red-800"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => proofDocInputRef.current?.click()}
                                        disabled={isUploading === 'proofDoc'}
                                        className="w-full py-4 border border-dashed border-slate-700 hover:border-sky-500 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-sky-400 transition-colors bg-slate-800/20"
                                    >
                                        <Upload className="w-5 h-5" />
                                        <span className="text-xs">Ajouter document / PDF</span>
                                    </button>
                                )}
                                <input
                                    ref={proofDocInputRef}
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(e, 'proofDoc')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Note facultative */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                            Notes complémentaires sur la livraison
                        </label>
                        <input
                            type="text"
                            placeholder="ex: Colis remis dans sac protecteur noir, livreur a attendu la vérification d'allumage"
                            value={details.deliveryNotes || ''}
                            onChange={(e) => updateDetails({ deliveryNotes: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                </div>
            )}

            {/* Modal d'aperçu d'image / PDF plein écran */}
            {previewModalUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
                    <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800">
                            <h4 className="text-sm font-semibold text-white truncate">
                                {previewModalUrl.title}
                            </h4>
                            <button
                                type="button"
                                onClick={() => setPreviewModalUrl(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-auto flex items-center justify-center flex-1 bg-black/50">
                            {previewModalUrl.isPdf ? (
                                <iframe 
                                    src={previewModalUrl.url} 
                                    className="w-full h-[70vh] border-0 rounded-lg"
                                    title={previewModalUrl.title}
                                />
                            ) : (
                                <img 
                                    src={previewModalUrl.url} 
                                    alt={previewModalUrl.title}
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
