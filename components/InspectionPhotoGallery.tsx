import React, { useState, useRef } from 'react';
import { 
    Camera, 
    Upload, 
    Eye, 
    Trash2, 
    ArrowLeftRight, 
    CheckCircle2, 
    AlertTriangle, 
    X, 
    Truck
} from 'lucide-react';
import { RestitutionDetails } from '../types';
import { compressImage, isPdfDataUrl } from '../utils/fileHelpers';
import { PhotoComparisonModal } from './PhotoComparisonModal';

interface InspectionPhotoGalleryProps {
    intakePhotos: string[];
    restitutionPhotos: string[];
    restitutionDetails?: RestitutionDetails;
    onUpdateIntakePhotos: (photos: string[]) => void;
    onUpdateRestitutionPhotos: (photos: string[]) => void;
    onUpdateRestitutionDetails: (details: RestitutionDetails) => void;
    ticketNumber?: string;
    readOnly?: boolean;
}

export const InspectionPhotoGallery: React.FC<InspectionPhotoGalleryProps> = ({
    intakePhotos = [],
    restitutionPhotos = [],
    restitutionDetails,
    onUpdateIntakePhotos,
    onUpdateRestitutionPhotos,
    onUpdateRestitutionDetails,
    ticketNumber,
    readOnly = false,
}) => {
    const safeIntakePhotos = Array.isArray(intakePhotos) ? intakePhotos : [];
    const safeRestitutionPhotos = Array.isArray(restitutionPhotos) ? restitutionPhotos : [];

    const [activeTab, setActiveTab] = useState<'intake' | 'restitution'>('intake');

    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
    const [singlePreviewModal, setSinglePreviewModal] = useState<{ url: string; title: string; isPdf?: boolean } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Initialisation des détails de restitution
    const details: RestitutionDetails = restitutionDetails || {
        isRepaired: 'oui',
        restitutionMode: 'retrait_atelier',
        restitutionDate: new Date().toISOString().split('T')[0],
        repairedComponents: [],
    };

    const intakeCameraInputRef = useRef<HTMLInputElement>(null);
    const intakeFileInputRef = useRef<HTMLInputElement>(null);
    const restitutionCameraInputRef = useRef<HTMLInputElement>(null);
    const restitutionFileInputRef = useRef<HTMLInputElement>(null);
    const yangoExpeditionProofInputRef = useRef<HTMLInputElement>(null);

    const updateDetails = (patch: Partial<RestitutionDetails>) => {
        onUpdateRestitutionDetails({
            ...details,
            ...patch,
        });
    };

    // Gestion du téléversement de photos
    const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>, target: 'intake' | 'restitution') => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsProcessing(true);
        try {
            const compressedList = await Promise.all(
                files.map(file => compressImage(file))
            );

            if (target === 'intake') {
                onUpdateIntakePhotos([...safeIntakePhotos, ...compressedList]);
            } else {
                onUpdateRestitutionPhotos([...safeRestitutionPhotos, ...compressedList]);
            }
        } catch (err) {
            console.error("Erreur d'import des photos:", err);
        } finally {
            setIsProcessing(false);
            e.target.value = '';
        }
    };

    const handleDeleteIntakePhoto = (index: number) => {
        const updated = safeIntakePhotos.filter((_, idx) => idx !== index);
        onUpdateIntakePhotos(updated);
    };

    const handleDeleteRestitutionPhoto = (index: number) => {
        const updated = safeRestitutionPhotos.filter((_, idx) => idx !== index);
        onUpdateRestitutionPhotos(updated);
    };

    // Composants types fréquents pour sélection rapide
    const commonComponents = [
        'Écran / Dalle LCD',
        'Batterie',
        'Circuit alimentation / USB-C',
        'Carte mère / SMC',
        'Clavier',
        'Trackpad',
        'Haut-parleurs',
        'Ventilateur / Pâte thermique',
        'Connecteur MagSafe'
    ];

    const toggleComponent = (comp: string) => {
        const current = details.repairedComponents || [];
        const exists = current.includes(comp);
        const updated = exists ? current.filter(c => c !== comp) : [...current, comp];
        updateDetails({ repairedComponents: updated });
    };

    return (
        <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 sm:p-6 space-y-5">
            {/* Header de la section Photos */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <Camera className="w-5 h-5 text-sky-400" />
                        Photos & Inspection Avant / Après Intervention
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Traçabilité complète de l'état esthétique et des composants réparés pour éviter tout litige
                    </p>
                </div>

                {/* Bouton de Comparaison Côte à Côte */}
                <button
                    type="button"
                    onClick={() => setIsCompareModalOpen(true)}
                    disabled={safeIntakePhotos.length === 0 && safeRestitutionPhotos.length === 0}
                    className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 transition-all self-start sm:self-auto disabled:opacity-40"
                >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Comparer Avant / Après</span>
                </button>
            </div>

            {/* Onglets de navigation A (Réception) / B (Restitution) */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                    type="button"
                    onClick={() => setActiveTab('intake')}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                        activeTab === 'intake'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>A. À la réception (Avant)</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-700">
                        {safeIntakePhotos.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('restitution')}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                        activeTab === 'restitution'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>B. Avant restitution (Après)</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-700">
                        {safeRestitutionPhotos.length}
                    </span>
                </button>
            </div>

            {/* CONTENU ONGLET A : À LA RÉCEPTION */}
            {activeTab === 'intake' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-950/15 border border-amber-500/20 rounded-xl p-3">
                        <div className="text-xs text-amber-200">
                            <strong>Consignes réception :</strong> Photographiez l'état général, l'écran allumé ou éteint, la coque (rayures, chocs), le clavier, les ports et le numéro de série arrière.
                        </div>

                        {!readOnly && (
                            <div className="flex items-center gap-2 shrink-0">
                                {/* Déclencheur caméra direct (idéal mobile & tablette) */}
                                <button
                                    type="button"
                                    onClick={() => intakeCameraInputRef.current?.click()}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition-colors"
                                >
                                    <Camera className="w-3.5 h-3.5" />
                                    <span>Prendre photo</span>
                                </button>
                                {/* Téléversement fichier (PC ou galerie) */}
                                <button
                                    type="button"
                                    onClick={() => intakeFileInputRef.current?.click()}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Importer fichier</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <input
                        ref={intakeCameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleAddPhotos(e, 'intake')}
                    />
                    <input
                        ref={intakeFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleAddPhotos(e, 'intake')}
                    />

                    {/* Grille de photos Réception */}
                    {safeIntakePhotos.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-900/40">
                            <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                            <p className="text-xs text-slate-400">Aucune photo prise à la réception pour le moment.</p>
                            <p className="text-[11px] text-slate-500 mt-1">Utilisez le bouton « Prendre photo » ou « Importer fichier ».</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {safeIntakePhotos.map((photo, idx) => (
                                <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-700 aspect-square bg-slate-950">
                                    <img src={photo} alt={`Réception ${idx}`} className="w-full h-full object-cover" />
                                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-mono text-amber-300 backdrop-blur-xs">
                                        #Av-{idx + 1}
                                    </div>
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSinglePreviewModal({
                                                url: photo,
                                                title: `Photo de Réception #${idx + 1}`
                                            })}
                                            className="p-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
                                            title="Agrandir"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        {!readOnly && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteIntakePhoto(idx)}
                                                className="p-1.5 rounded-lg bg-red-900/80 text-red-200 hover:bg-red-800"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* CONTENU ONGLET B : AVANT RESTITUTION */}
            {activeTab === 'restitution' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                    {/* STATUT RÉPARÉ : OUI / NON / PRÉCISER */}
                    <div className="bg-slate-850/70 border border-slate-700/80 rounded-xl p-4 space-y-3">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                            Résultat technique de l'intervention *
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* OUI */}
                            <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => updateDetails({ isRepaired: 'oui' })}
                                className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                                    details.isRepaired === 'oui'
                                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500 shadow-md shadow-emerald-500/10'
                                        : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>Réparé : OUI</span>
                            </button>

                            {/* NON */}
                            <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => updateDetails({ isRepaired: 'non' })}
                                className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                                    details.isRepaired === 'non'
                                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-1 ring-rose-500 shadow-md shadow-rose-500/10'
                                        : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <X className="w-4 h-4 text-rose-400" />
                                <span>Réparé : NON</span>
                            </button>

                            {/* PRÉCISER */}
                            <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => updateDetails({ isRepaired: 'preciser' })}
                                className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                                    details.isRepaired === 'preciser'
                                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500 shadow-md shadow-amber-500/10'
                                        : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                <span>Préciser...</span>
                            </button>
                        </div>

                        {/* Champ précision si NON ou PRÉCISER */}
                        {(details.isRepaired === 'non' || details.isRepaired === 'preciser') && (
                            <div className="pt-2 animate-in fade-in">
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    Motif de non-réparation ou précisions techniques requises *
                                </label>
                                <textarea
                                    disabled={readOnly}
                                    rows={2}
                                    placeholder="ex: Carte mère avec perforations multiples, irréparable sans remplacement total du PCB / Devis refusé par le client..."
                                    value={details.repairPrecision || ''}
                                    onChange={(e) => updateDetails({ repairPrecision: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>
                        )}
                    </div>

                    {/* ÉLÉMENTS RÉPARÉS OU REMPLACÉS */}
                    <div className="bg-slate-850/70 border border-slate-700/80 rounded-xl p-4 space-y-3">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                            Composants réparés ou remplacés
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {commonComponents.map((comp) => {
                                const selected = (details.repairedComponents || []).includes(comp);
                                return (
                                    <button
                                        key={comp}
                                        type="button"
                                        disabled={readOnly}
                                        onClick={() => toggleComponent(comp)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                            selected
                                                ? 'bg-sky-500/20 border-sky-500 text-sky-200'
                                                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                    >
                                        {selected ? '✓ ' : '+ '}
                                        {comp}
                                    </button>
                                );
                            })}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                                État général avant remise au client
                            </label>
                            <input
                                type="text"
                                disabled={readOnly}
                                placeholder="ex: Nettoyage ultrasons effectué, coque dépoussiérée, ports testés OK"
                                value={details.generalExitState || ''}
                                onChange={(e) => updateDetails({ generalExitState: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-sky-500"
                            />
                        </div>
                    </div>

                    {/* MODE DE RESTITUTION (COMPTOIR VS YANGO) */}
                    <div className="bg-slate-850/70 border border-slate-700/80 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                <Truck className="w-4 h-4 text-amber-400" />
                                Mode de Restitution
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => updateDetails({ restitutionMode: 'retrait_atelier' })}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                        details.restitutionMode === 'retrait_atelier'
                                            ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                                            : 'bg-slate-800 border-slate-700 text-slate-400'
                                    }`}
                                >
                                    Retrait au comptoir
                                </button>
                                <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => updateDetails({ restitutionMode: 'livraison_yango' })}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                        details.restitutionMode === 'livraison_yango'
                                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                            : 'bg-slate-800 border-slate-700 text-slate-400'
                                    }`}
                                >
                                    Expédition Yango
                                </button>
                            </div>
                        </div>

                        {details.restitutionMode === 'livraison_yango' && (
                            <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg space-y-3 animate-in fade-in">
                                <div className="text-xs text-amber-200">
                                    <strong>Expédition Yango :</strong> Enregistrez les photos du colis emballé avant la remise au livreur et joignez la preuve de livraison.
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] text-slate-300 mb-1">
                                            Nom / Contact du livreur de retour
                                        </label>
                                        <input
                                            type="text"
                                            disabled={readOnly}
                                            placeholder="ex: Yango - Jean K. (07 11 22 33 44)"
                                            value={details.yangoDriverInfo || ''}
                                            onChange={(e) => updateDetails({ yangoDriverInfo: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] text-slate-300 mb-1">
                                            Preuve de livraison remise au client (PDF/Image)
                                        </label>
                                        {details.yangoDeliveryProofDoc ? (
                                            <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs">
                                                <span className="truncate text-white text-[11px]">
                                                    {details.yangoDeliveryProofDocName || 'preuve_restitution.pdf'}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSinglePreviewModal({
                                                            url: details.yangoDeliveryProofDoc!,
                                                            title: "Preuve de livraison Yango (Restitution)",
                                                            isPdf: isPdfDataUrl(details.yangoDeliveryProofDoc)
                                                        })}
                                                        className="p-1 text-sky-400 hover:text-white"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    {!readOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => updateDetails({
                                                                yangoDeliveryProofDoc: undefined,
                                                                yangoDeliveryProofDocName: undefined
                                                            })}
                                                            className="p-1 text-red-400 hover:text-white"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : !readOnly && (
                                            <button
                                                type="button"
                                                onClick={() => yangoExpeditionProofInputRef.current?.click()}
                                                className="w-full py-1.5 px-2 border border-dashed border-amber-500/50 hover:border-amber-400 rounded-lg text-xs text-amber-300 flex items-center justify-center gap-1.5 bg-slate-900/40"
                                            >
                                                <Upload className="w-3.5 h-3.5" />
                                                <span>Joindre preuve de livraison</span>
                                            </button>
                                        )}
                                        <input
                                            ref={yangoExpeditionProofInputRef}
                                            type="file"
                                            accept="image/*,application/pdf"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const base64 = await compressImage(file);
                                                updateDetails({
                                                    yangoDeliveryProofDoc: base64,
                                                    yangoDeliveryProofDocName: file.name
                                                });
                                                e.target.value = '';
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* GALERIE PHOTOS RESTITUTION */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                Clichés avant restitution ({safeRestitutionPhotos.length})
                            </label>

                            {!readOnly && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => restitutionCameraInputRef.current?.click()}
                                        disabled={isProcessing}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition-colors"
                                    >
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>Prendre photo</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => restitutionFileInputRef.current?.click()}
                                        disabled={isProcessing}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>Importer</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <input
                            ref={restitutionCameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handleAddPhotos(e, 'restitution')}
                        />
                        <input
                            ref={restitutionFileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleAddPhotos(e, 'restitution')}
                        />

                        {safeRestitutionPhotos.length === 0 ? (
                            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-900/40">
                                <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                                <p className="text-xs text-slate-400">Aucune photo enregistrée avant restitution.</p>
                                <p className="text-[11px] text-slate-500 mt-1">Photographiez l'ordinateur allumé et réparé avant de le remettre au client ou au coursier Yango.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {safeRestitutionPhotos.map((photo, idx) => (
                                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-700 aspect-square bg-slate-950">
                                        <img src={photo} alt={`Restitution ${idx}`} className="w-full h-full object-cover" />
                                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-mono text-emerald-300 backdrop-blur-xs">
                                            #Ap-{idx + 1}
                                        </div>
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSinglePreviewModal({
                                                    url: photo,
                                                    title: `Photo de Restitution #${idx + 1}`
                                                })}
                                                className="p-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
                                                title="Agrandir"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {!readOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteRestitutionPhoto(idx)}
                                                    className="p-1.5 rounded-lg bg-red-900/80 text-red-200 hover:bg-red-800"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de prévisualisation simple */}
            {singlePreviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
                    <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800">
                            <h4 className="text-sm font-semibold text-white truncate">
                                {singlePreviewModal.title}
                            </h4>
                            <button
                                type="button"
                                onClick={() => setSinglePreviewModal(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-auto flex items-center justify-center flex-1 bg-black/50">
                            {singlePreviewModal.isPdf ? (
                                <iframe 
                                    src={singlePreviewModal.url}
                                    className="w-full h-[70vh] border-0 rounded-lg"
                                    title={singlePreviewModal.title}
                                />
                            ) : (
                                <img
                                    src={singlePreviewModal.url}
                                    alt={singlePreviewModal.title}
                                    className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de comparaison avant/après scindée */}
            <PhotoComparisonModal
                isOpen={isCompareModalOpen}
                onClose={() => setIsCompareModalOpen(false)}
                intakePhotos={intakePhotos}
                restitutionPhotos={restitutionPhotos}
                ticketNumber={ticketNumber}
                restitutionDetails={details}
            />
        </div>
    );
};
