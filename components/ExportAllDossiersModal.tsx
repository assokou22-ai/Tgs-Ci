import React, { useState } from 'react';
import { 
    Archive, 
    Download, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle, 
    X, 
    Loader2, 
    FileText, 
    FolderArchive,
    RefreshCw,
    ShieldAlert
} from 'lucide-react';
import { exportAllDossiersToZip, ExportProgress, triggerBrowserDownload } from '../services/dossiersExportService.ts';
import { RepairTicket } from '../types.ts';

interface ExportAllDossiersModalProps {
    isOpen: boolean;
    onClose: () => void;
    tickets?: RepairTicket[];
}

export const ExportAllDossiersModal: React.FC<ExportAllDossiersModalProps> = ({
    isOpen,
    onClose,
    tickets
}) => {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<ExportProgress | null>(null);
    const [showWarningsDetails, setShowWarningsDetails] = useState(false);

    if (!isOpen) return null;

    const handleStartExport = async () => {
        // Bloquer tout double-clic
        if (isRunning) return;

        setIsRunning(true);
        setShowWarningsDetails(false);

        try {
            await exportAllDossiersToZip((prog) => {
                setProgress(prog);
            }, tickets);
        } catch (err) {
            console.error("Erreur lancement export:", err);
        } finally {
            // Réactiver le bouton après réussite ou erreur
            setIsRunning(false);
        }
    };

    const isFinished = progress && (progress.stage === 'completed' || progress.stage === 'partial' || progress.stage === 'failed');

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl text-white relative flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-2xl text-blue-400">
                            <Archive className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                Exporter tous les dossiers
                            </h2>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Archive ZIP complète autonome • Fiche PDF & HTML par dossier • Photos originales classées
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isRunning}
                        className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Fermer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content body */}
                <div className="py-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                    {/* Présentation initiale si pas encore lancé */}
                    {!progress && !isRunning && (
                        <div className="space-y-4">
                            <div className="p-4 bg-zinc-800/60 rounded-2xl border border-white/5 space-y-3">
                                <h3 className="text-xs font-black uppercase text-blue-400 tracking-wider flex items-center gap-2">
                                    <FolderArchive className="w-4 h-4" /> Structure de l'archive générée
                                </h3>
                                <ul className="text-xs text-zinc-300 space-y-2 list-disc list-inside">
                                    <li><strong>Un sous-dossier par numéro de fiche</strong> (ex. : <code className="text-blue-300 bg-black/40 px-1 py-0.5 rounded font-mono">26RM751/</code>).</li>
                                    <li><strong>Fiche complète en PDF</strong> avec en-tête officiel, client, appareil, panne, diagnostic, prestations chiffrées, règlements et solde.</li>
                                    <li><strong>Fiche complète en HTML autonome</strong> avec galerie photos cliquable, détails livraison Yango et design moderne.</li>
                                    <li><strong>Photos originales extraites</strong> classées selon leurs catégories : <span className="text-zinc-400">reception, restitution, livraison_yango, justificatifs_paiements, generales</span>.</li>
                                    <li><strong>Portail d'accueil index.html</strong> à la racine permettant la recherche et consultation 100% hors-ligne après décompression.</li>
                                    <li><strong>Journal d'audit Erreurs_export.txt</strong> certifiant l'exhaustivité des données et notifiant les fichiers manquants.</li>
                                </ul>
                            </div>

                            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-200/90 leading-relaxed">
                                    <strong>Volume & Intégrité des données :</strong> L'export récupère toutes les fiches de la base de données. Si le volume est important, l'archive est automatiquement répartie en parties numérotées pour garantir la fluidité.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Affichage de la progression en cours */}
                    {isRunning && progress && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                                    <span className="text-sm font-black text-white uppercase tracking-tight">
                                        {progress.stage === 'zipping' ? 'Compression ZIP...' : 'Extraction des dossiers...'}
                                    </span>
                                </div>
                                <span className="text-lg font-black text-blue-400 font-mono">
                                    {progress.percent}%
                                </span>
                            </div>

                            {/* Barre de progression */}
                            <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden border border-white/5">
                                <div 
                                    className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${Math.max(progress.percent, 3)}%` }}
                                />
                            </div>

                            {/* Statut textuel détaillé */}
                            <div className="p-4 bg-zinc-800/80 rounded-2xl border border-white/5 space-y-1.5">
                                <div className="text-xs text-zinc-300 font-medium flex items-center justify-between">
                                    <span>{progress.message}</span>
                                    {progress.totalTickets > 0 && (
                                        <span className="text-[11px] font-mono text-zinc-400">
                                            {progress.currentTicketIndex} / {progress.totalTickets}
                                        </span>
                                    )}
                                </div>
                                {progress.warningCount > 0 && (
                                    <div className="text-[11px] text-amber-400 flex items-center gap-1.5 pt-1">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{progress.warningCount} élément(s) source(s) manquant(s) logué(s) dans le rapport d'audit</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Affichage du résultat final */}
                    {isFinished && progress && (
                        <div className="space-y-5 animate-fade-in">
                            {/* Bannière de résultat */}
                            {progress.stage === 'completed' && (
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-tight text-emerald-400">
                                            Exportation Complète Réussie (100%)
                                        </h4>
                                        <p className="text-xs text-emerald-200/90 mt-1">
                                            Tous les dossiers ({progress.totalTickets}), fiches PDF, HTML, photos classées et l'index hors-ligne ont été générés sans aucune anomalie.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {progress.stage === 'partial' && (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
                                    <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-tight text-amber-400">
                                            Exportation Partielle Réussie (Avec Avertissements)
                                        </h4>
                                        <p className="text-xs text-amber-200/90 mt-1">
                                            L'export s'est poursuivi avec succès pour toutes les données récupérables ({progress.totalTickets} dossiers). {progress.warningCount} ressource(s) manquante(s) ou photos inaccessibles ont été recensées dans le fichier <strong>Erreurs_export.txt</strong>.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {progress.stage === 'failed' && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3">
                                    <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-tight text-rose-400">
                                            Échec de l'Exportation
                                        </h4>
                                        <p className="text-xs text-rose-200/90 mt-1">
                                            Une anomalie critique a empêché la finalisation. {progress.message}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Liste des archives générées avec boutons de re-téléchargement */}
                            {progress.generatedParts.length > 0 && (
                                <div className="p-4 bg-zinc-800/80 rounded-2xl border border-white/5 space-y-3">
                                    <h4 className="text-xs font-black uppercase text-zinc-300 tracking-wider flex items-center justify-between">
                                        <span>Archives ZIP générées ({progress.generatedParts.length})</span>
                                        <span className="text-[10px] text-zinc-500 font-normal">Téléchargement automatique initié</span>
                                    </h4>
                                    <div className="space-y-2">
                                        {progress.generatedParts.map((part, pIdx) => {
                                            const sizeMb = (part.sizeBytes / (1024 * 1024)).toFixed(1);
                                            return (
                                                <div 
                                                    key={pIdx} 
                                                    className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl border border-white/5"
                                                >
                                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                                        <FolderArchive className="w-4 h-4 text-blue-400 shrink-0" />
                                                        <div className="truncate">
                                                            <div className="text-xs font-mono font-bold text-white truncate">
                                                                {part.fileName}
                                                            </div>
                                                            <div className="text-[10px] text-zinc-500">
                                                                Taille : {sizeMb} Mo
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => triggerBrowserDownload(part.blob, part.fileName)}
                                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                                                    >
                                                        <Download className="w-3.5 h-3.5" /> Télécharger
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Section détails des avertissements */}
                            {progress.warningCount > 0 && (
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowWarningsDetails(!showWarningsDetails)}
                                        className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 underline underline-offset-4"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        {showWarningsDetails ? 'Masquer la liste des avertissements' : `Voir la liste des ${progress.warningCount} avertissement(s)`}
                                    </button>

                                    {showWarningsDetails && (
                                        <div className="p-3 bg-black/50 border border-amber-500/20 rounded-xl max-h-48 overflow-y-auto font-mono text-[11px] text-zinc-300 space-y-1">
                                            {progress.warnings.map((w, idx) => (
                                                <div key={idx} className="text-amber-200/80">
                                                    • {w}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer action buttons */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isRunning}
                        className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isFinished ? 'Fermer' : 'Annuler'}
                    </button>

                    <button
                        type="button"
                        onClick={handleStartExport}
                        disabled={isRunning}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg ${
                            isRunning
                                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                                : isFinished
                                ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                        }`}
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Exportation en cours...
                            </>
                        ) : isFinished ? (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                Recommencer l'export
                            </>
                        ) : (
                            <>
                                <Archive className="w-4 h-4" />
                                Lancer l'exportation
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
export default ExportAllDossiersModal;
