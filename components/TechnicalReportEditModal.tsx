import React, { useState, useEffect } from 'react';
import { RepairTicket, TechnicalReportLevel, TechnicalInterventionReport } from '../types.ts';
import { DocumentMagnifyingGlassIcon } from './icons.tsx';

// Clean inline SVG icons
const XMarkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

const CheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);

const ArrowPathIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const ClipboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375-7.5-7.5" />
  </svg>
);

const PrinterIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
  </svg>
);

const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>
);

interface TechnicalReportEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: RepairTicket;
  onSave: (updatedCustomFields: Record<string, string>, technicalReport?: TechnicalInterventionReport) => Promise<void>;
  onOpenPreview?: () => void;
}

const TechnicalReportEditModal: React.FC<TechnicalReportEditModalProps> = ({
  isOpen,
  onClose,
  ticket,
  onSave,
  onOpenPreview
}) => {
  const [level, setLevel] = useState<TechnicalReportLevel>('expert_p3');
  const [reportTitle, setReportTitle] = useState("RAPPORT DE FIN D'INTERVENTION (P3)");
  const [interventionsDone, setInterventionsDone] = useState('');
  const [result, setResult] = useState('');
  const [observation, setObservation] = useState('');
  const [faultCause, setFaultCause] = useState('');
  const [importantNotes, setImportantNotes] = useState('');
  const [retraitDateInfo, setRetraitDateInfo] = useState('');
  const [nextRdvInfo, setNextRdvInfo] = useState('');
  const [technicianName, setTechnicianName] = useState('');

  // Legacy fields
  const [technicalVerdict, setTechnicalVerdict] = useState('');
  const [technicalMeasures, setTechnicalMeasures] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  useEffect(() => {
    if (isOpen && ticket) {
      const rep = ticket.technicalReport;
      if (rep) {
        setLevel(rep.level || 'expert_p3');
        setReportTitle(rep.reportTitle || "RAPPORT DE FIN D'INTERVENTION (P3)");
        setInterventionsDone(rep.interventionsDone || '');
        setResult(rep.result || '');
        setObservation(rep.observation || '');
        setFaultCause(rep.faultCause || '');
        setImportantNotes(rep.importantNotes || '');
        setRetraitDateInfo(rep.retraitDateInfo || '');
        setNextRdvInfo(rep.nextRdvInfo || '');
        setTechnicianName(rep.technicianName || '');
      } else {
        // Chargement modèle initial par défaut calqué sur le PDF TGS-CI
        applyPresetA2485();
      }

      setTechnicalVerdict(ticket.customFields?.technicalVerdict || '');
      setTechnicalMeasures(ticket.customFields?.technicalMeasures || '');
    }
  }, [isOpen, ticket]);

  if (!isOpen) return null;

  // Modèle 1 : A2338 (M2) — Remplacement NAND + PMU + SoC ROM + Mot de passe session requis (Exemple fourni par l'utilisateur)
  const applyPresetA2338 = () => {
    setLevel('expert_p3');
    setReportTitle("RAPPORT DE FIN D'INTERVENTION (P3)");
    setInterventionsDone(
      "• Remplacement des NAND de stockage\n• Remplacement de la PMU (Power Management Unit)\n• Remplacement des SoC ROM"
    );
    setResult(
      "• Le MacBook démarre. Il doit maintenant être restauré complètement pour être activé par les serveurs Apple."
    );
    setObservation(
      "• Défaut initial de lecture des NAND et de communication avec la mémoire unifiée suite au premier diagnostic."
    );
    setFaultCause(
      "• Défaut connu sur le modèle A2338 (Apple Silicon M2) : les puces programmables perdent leur activité après une inactivité prolongée en état OFF."
    );
    setImportantNotes(
      "• Mot de passe requis : Apple exigera obligatoirement l'ancien mot de passe de session (bureau) pour valider l'activation de votre MacBook auprès de ses serveurs. Sans ce mot de passe, la restauration ne pourra pas aboutir et les tests de confirmation ne pourront être finalisés.\n• Concernant vos données : Le remplacement des NAND entraîne l'effacement complet des données. Les anciennes puces retirées de votre carte vous seront remises.\n• Tests de confirmation de fin de travaux : Réalisés ligne par ligne (affichage, clavier, trackpad, ports USB-C, Wi-Fi, Bluetooth, caméra, son, batterie, charge, NAND)."
    );
    setRetraitDateInfo("Vendredi à partir de 10 h, selon votre disponibilité (après confirmation du mot de passe).");
    setNextRdvInfo("Contrôle technique préventif dans 30 jours à l'atelier.");
  };

  // Modèle 2 : A2485 (M1 Pro) — Corrosion avancée, PMU, SoC ROM (Exact modèle du PDF officiel TGS-CI fourni)
  const applyPresetA2485 = () => {
    setLevel('expert_p3');
    setReportTitle("RAPPORT DE FIN D'INTERVENTION (P3)");
    setInterventionsDone(
      "• Correction de plusieurs composants alimentant la NAND de stockage, les tensions de démarrage et les alimentations secondaires.\n• Remplacement de la PMU (Power Management Unit).\n• Remplacement de la ROM de démarrage du SoC."
    );
    setResult(
      "• Le MacBook démarre et affiche normalement."
    );
    setObservation(
      "• Défaillance de la batterie : elle semble complètement affaiblie."
    );
    setFaultCause(
      "• Corrosion\n• Humidité\n• Poussière"
    );
    setImportantNotes(
      "• Un niveau de corrosion avancé a été corrigé, mais il peut réapparaître sous des puces aujourd'hui parfaitement fonctionnelles.\n• Effectuez des sauvegardes régulières de vos données utilisées sur cette machine.\n• Prévoyez une mise à disposition de la machine tous les 30 jours, pour un contrôle de 48 h minimum dans nos locaux.\n• Un suivi particulier doit être assuré sur cette machine pendant au moins 3 mois."
    );
    setRetraitDateInfo("Vendredi à partir de 12 h, selon votre disponibilité.");
    setNextRdvInfo("À prévoir dans votre planning sous 30 jours, pour une durée de 48 h minimum.");
  };

  // Modèle 3 : Niveau 2 (Standard / Intermédiaire)
  const applyPresetStandard = () => {
    setLevel('standard');
    setReportTitle("RAPPORT D'INTERVENTION STANDARD");
    setInterventionsDone(
      "• Remplacement du module défaillant et révision du circuit d'alimentation secondaire.\n• Dépoussiérage complet, désoxydation localisée et remplacement de la pâte thermique haute performance."
    );
    setResult(
      "• Le système démarre sans anomalie. L'ensemble des tests matériel et périphériques sont conformes."
    );
    setObservation(
      "• Tension stable observée lors des cycles de charge et de décharge."
    );
    setFaultCause(
      "• Fatigue thermique naturelle d'un composant passif."
    );
    setImportantNotes(
      "• Conservez des sauvegardes Time Machine régulières.\n• Évitez l'utilisation sur des surfaces textiles obstruant les ouïes d'aération."
    );
    setRetraitDateInfo("Machine prête pour retrait immédiat à notre atelier.");
    setNextRdvInfo("Révision préventive annuelle conseillée.");
  };

  // Modèle 4 : Niveau 1 (Synthétique / Express)
  const applyPresetExpress = () => {
    setLevel('express');
    setReportTitle("RAPPORT DE SERVICE EXPRESS");
    setInterventionsDone(
      "• Remplacement de la pièce d'usure (Batterie / Clavier / Écran / Connecteur de charge)."
    );
    setResult(
      "• Fonctionnement nominal validé sur banc d'essai."
    );
    setObservation("");
    setFaultCause("• Usure normale d'usage.");
    setImportantNotes("• Garantie pièces et main d'œuvre applicable selon nos conditions générales.");
    setRetraitDateInfo("Disponible pour retrait dès notification.");
    setNextRdvInfo("Aucun rendez-vous ultérieur requis.");
  };

  // Génération du texte pour WhatsApp
  const handleCopyWhatsApp = async () => {
    const lines: string[] = [];
    lines.push(`Bonjour Monsieur / Madame,`);
    lines.push(``);
    lines.push(`📄 *Rapport d'intervention — Fiche N° ${ticket.id}*`);
    lines.push(`💻 *Appareil :* ${ticket.macBrand} ${ticket.macModel} ${ticket.modelNumber ? `(Réf. ${ticket.modelNumber})` : ''}`);
    lines.push(``);
    
    if (interventionsDone.trim()) {
      lines.push(`*Interventions réalisées :*`);
      lines.push(interventionsDone.trim());
      lines.push(``);
    }

    if (result.trim()) {
      lines.push(`*Résultat :*`);
      lines.push(result.trim());
      lines.push(``);
    }

    if (observation.trim()) {
      lines.push(`*Constat :*`);
      lines.push(observation.trim());
      lines.push(``);
    }

    if (faultCause.trim()) {
      lines.push(`*Cause du défaut :*`);
      lines.push(faultCause.trim());
      lines.push(``);
    }

    if (importantNotes.trim()) {
      lines.push(`⚠ *Important — précautions et suivi :*`);
      lines.push(importantNotes.trim());
      lines.push(``);
    }

    if (retraitDateInfo.trim() || nextRdvInfo.trim()) {
      lines.push(`*Retrait & Suivi :*`);
      if (retraitDateInfo.trim()) lines.push(`📅 *Retrait de la machine :* ${retraitDateInfo.trim()}`);
      if (nextRdvInfo.trim()) lines.push(`🔄 *Prochain rendez-vous :* ${nextRdvInfo.trim()}`);
      lines.push(``);
    }

    lines.push(`_TGS-CI Réparation & Expertise Électronique_`);

    const fullText = lines.join('\n');

    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 3000);
    } catch (err) {
      console.error("Erreur copie clipboard", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const reportData: TechnicalInterventionReport = {
        enabled: true,
        level,
        reportTitle: reportTitle.trim() || "RAPPORT DE FIN D'INTERVENTION (P3)",
        interventionsDone: interventionsDone.trim(),
        result: result.trim(),
        observation: observation.trim(),
        faultCause: faultCause.trim(),
        importantNotes: importantNotes.trim(),
        retraitDateInfo: retraitDateInfo.trim(),
        nextRdvInfo: nextRdvInfo.trim(),
        technicianName: technicianName.trim(),
        updatedAt: new Date().toISOString()
      };

      const updatedFields = {
        ...(ticket.customFields || {}),
        technicalVerdict: technicalVerdict.trim(),
        technicalMeasures: technicalMeasures.trim()
      };

      await onSave(updatedFields, reportData);
      onClose();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du rapport technique:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex justify-center items-center p-3 md:p-6 overflow-y-auto">
      <div 
        className="bg-[#18181b] border border-white/10 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EN-TÊTE MODAL */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-[#27272a]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/20">
              <DocumentMagnifyingGlassIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Rapport de Fin d'Intervention & Expertise
                </h2>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase rounded-lg border border-emerald-500/30">
                  Dossier #{ticket.id}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Appareil : {ticket.macBrand} {ticket.macModel} · Client : {ticket.client?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                copiedNotification 
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30' 
                  : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
              }`}
              title="Copier le message formaté prêt à être collé dans WhatsApp"
            >
              {copiedNotification ? (
                <>
                  <CheckIcon className="w-4 h-4" /> Copié !
                </>
              ) : (
                <>
                  <ClipboardIcon className="w-4 h-4" /> Copier WhatsApp
                </>
              )}
            </button>

            {onOpenPreview && (
              <button
                type="button"
                onClick={onOpenPreview}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider border border-white/10 flex items-center gap-1.5 transition-all"
                title="Aperçu d'impression P3"
              >
                <PrinterIcon className="w-4 h-4 text-blue-400" /> Aperçu P3
              </button>
            )}

            <button 
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors ml-1"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CORPS DE LA MODAL AVEC SCROLL */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
          
          {/* BARRE DE SÉLECTION DU NIVEAU DE RAPPORT (LES 3 OPTIONS DEMANDÉES) */}
          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <SparklesIcon className="w-4 h-4 text-blue-400" /> Niveau de complexité du rapport
                </label>
                <p className="text-[10px] text-slate-500">
                  Adaptez la structure et la densité du rapport technique au cas précis du client.
                </p>
              </div>

              {/* 3 ONGLETS DE NIVEAU */}
              <div className="flex bg-black/60 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setLevel('express')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    level === 'express' 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Niveau 1 · Synthétique
                </button>
                <button
                  type="button"
                  onClick={() => setLevel('standard')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    level === 'standard' 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Niveau 2 · Standard
                </button>
                <button
                  type="button"
                  onClick={() => setLevel('expert_p3')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    level === 'expert_p3' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Niveau 3 · Expert P3
                </button>
              </div>
            </div>

            {/* MODÈLES PRÉ-DÉFINIS RAPIDES */}
            <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mr-1">
                Charger un modèle :
              </span>
              <button
                type="button"
                onClick={applyPresetA2338}
                className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 rounded-lg text-[9px] font-bold tracking-tight transition-all"
                title="Modèle A2338 M2 : Remplacement NAND + PMU + Mot de passe requis + Remise puces"
              >
                📋 Cas A2338 (NAND M2 + PMU)
              </button>
              <button
                type="button"
                onClick={applyPresetA2485}
                className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-lg text-[9px] font-bold tracking-tight transition-all"
                title="Modèle A2485 M1 Pro : Corrosion avancée + PMU + SoC ROM + Suivi 30j/3 mois"
              >
                📋 Cas A2485 (Corrosion + Suivi 3 mois)
              </button>
              <button
                type="button"
                onClick={applyPresetStandard}
                className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-lg text-[9px] font-bold tracking-tight transition-all"
              >
                📋 Standard Composant
              </button>
              <button
                type="button"
                onClick={applyPresetExpress}
                className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded-lg text-[9px] font-bold tracking-tight transition-all"
              >
                📋 Express Pièce / Écran
              </button>
            </div>
          </div>

          {/* TITRE DU RAPPORT */}
          <div>
            <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1">
              Titre du document imprimable
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full px-4 py-2 bg-black/40 border border-white/10 focus:border-blue-500 rounded-xl text-white text-xs font-bold"
              placeholder="Ex: RAPPORT DE FIN D'INTERVENTION (P3)"
            />
          </div>

          {/* SECTION 1 : INTERVENTIONS RÉALISÉES */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                1. Interventions réalisées (Une action par ligne)
              </label>
              <span className="text-[9px] text-slate-500 font-bold">Chaque ligne deviendra une puce</span>
            </div>
            <textarea
              value={interventionsDone}
              onChange={(e) => setInterventionsDone(e.target.value)}
              placeholder="• Remplacement des NAND de stockage&#10;• Remplacement de la PMU&#10;• Remplacement des SoC ROM"
              rows={3}
              className="w-full px-4 py-3 bg-black/40 border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-2xl text-slate-200 text-xs font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-y"
            />
          </div>

          {/* SECTION 2 : RÉSULTAT */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-wider">
              2. Résultat
            </label>
            <textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="• Le MacBook démarre. Il doit maintenant être restauré complètement pour être activé par les serveurs Apple."
              rows={2}
              className="w-full px-4 py-3 bg-black/40 border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-2xl text-slate-200 text-xs font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-y"
            />
          </div>

          {/* SECTIONS 3 & 4 (Affichées pour Standard et Expert) */}
          {(level === 'standard' || level === 'expert_p3') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SECTION 3 : CONSTAT */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                  3. Constat
                </label>
                <textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  placeholder="• Défaillance de la batterie : elle semble complètement affaiblie."
                  rows={3}
                  className="w-full px-4 py-3 bg-black/40 border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-2xl text-slate-200 text-xs font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-y"
                />
              </div>

              {/* SECTION 4 : CAUSE DU DÉFAUT */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                  4. Cause du défaut
                </label>
                <textarea
                  value={faultCause}
                  onChange={(e) => setFaultCause(e.target.value)}
                  placeholder="• Corrosion&#10;• Humidité&#10;• Poussière"
                  rows={3}
                  className="w-full px-4 py-3 bg-black/40 border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-2xl text-slate-200 text-xs font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-y"
                />
              </div>
            </div>
          )}

          {/* SECTION 5 : IMPORTANT — PRÉCAUTIONS ET SUIVI */}
          <div className="space-y-1.5 bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                5. Important — Précautions & Suivi
              </label>
              <span className="text-[9px] text-amber-400/80 font-bold">Encadré beige soigné sur l'impression</span>
            </div>
            <textarea
              value={importantNotes}
              onChange={(e) => setImportantNotes(e.target.value)}
              placeholder="• Mot de passe de session requis pour validation Apple&#10;• Données effacées lors du changement de NAND (anciennes puces remises)&#10;• Contrôle technique préventif tous les 30 jours"
              rows={4}
              className="w-full px-4 py-3 bg-black/40 border border-white/5 hover:border-white/10 focus:border-amber-500 rounded-2xl text-slate-200 text-xs font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all resize-y"
            />
          </div>

          {/* SECTION 6 : RETRAIT ET SUIVI (TABLEAU 2 COLONNES) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/30 p-4 rounded-2xl border border-white/5">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                6.A Retrait de la machine
              </label>
              <input
                type="text"
                value={retraitDateInfo}
                onChange={(e) => setRetraitDateInfo(e.target.value)}
                placeholder="Vendredi 18 septembre, à partir de 12 h, selon votre disponibilité."
                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-emerald-500 rounded-xl text-white text-xs font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                6.B Prochain rendez-vous / Contrôle
              </label>
              <input
                type="text"
                value={nextRdvInfo}
                onChange={(e) => setNextRdvInfo(e.target.value)}
                placeholder="À partir du 19 octobre — à prévoir dans votre planning, durée 48 h min."
                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-emerald-500 rounded-xl text-white text-xs font-medium"
              />
            </div>
          </div>

          {/* NOM DU TECHNICIEN POUR LA SIGNATURE */}
          <div>
            <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1">
              Nom du Technicien / Validateur (Optionnel pour visa)
            </label>
            <input
              type="text"
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
              placeholder="Ex: Technicien TGS-CI / R. Kouamé"
              className="w-full px-4 py-2 bg-black/40 border border-white/10 focus:border-blue-500 rounded-xl text-white text-xs font-medium"
            />
          </div>
        </form>

        {/* PIED DE MODAL AVEC ACTIONS */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-white/10 bg-[#27272a]/60 shrink-0">
          <div className="text-[10px] text-slate-400">
            💡 Document imprimable au format officiel TGS-CI
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" /> Enregistrement...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" /> Enregistrer le Rapport
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicalReportEditModal;
