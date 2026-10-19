import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal.tsx';
import { 
    AlertTriangle, Wrench, Clock, Calendar, 
    Send, CheckCircle, Copy, Sparkles, User, RefreshCw, Printer, ShieldAlert,
    Key, Cpu, Split, Wand2, Loader2
} from 'lucide-react';
import { WhatsAppIcon } from './icons.tsx';
import { RepairTicket, TechnicalBlockageReport, Role } from '../types.ts';
import { addDaysExcludingSundaysAndHolidays } from '../utils/dateCalculator.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { formatWhatsAppPhone, generateWhatsAppUrl } from '../utils/formatters.ts';
import { 
    WorkshopTemplateId, 
    generateWorkshopMessage, 
    detectCivility
} from '../services/workshopCommunicationService.ts';

interface TechnicalBlockageModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: RepairTicket;
    onSaveReport: (updatedTicket: RepairTicket) => Promise<void>;
    role: Role;
    onPrintNote?: (ticket: RepairTicket) => void;
}

const COMMON_REPLACED_COMPONENTS = [
    "Puce d'alimentation USB-C (CD3215 / CD3217)",
    "Contrôleur de charge & gestion batterie (ISL9240 / ISL9239)",
    "Ligne PPBUS_G3H (Condensateurs de filtrage céramique)",
    "MOSFET d'entrée d'alimentation (High-Side / Low-Side)",
    "Régulateur 3V3_G3H / 5V_G3H",
    "Contrôleur de rétroéclairage (Backlight Driver LP8550)",
    "Puce de gestion système SMC / T2 Power IC",
    "Connecteur écran LCD / Nappe eDP",
    "Batterie d'origine de banc de test",
    "Nappe clavier / trackpad / flex board"
];

const COMMON_BLOCKAGE_SYMPTOMS = [
    "Ne prend toujours pas la charge (5V 0.00A / 5V 0.03A persistant)",
    "Tension 20V présente mais consommation nulle (0.01A - 0.04A en boucle DFU)",
    "Démarrage instable : coupure brutale après quelques secondes de mise sous tension",
    "Boucle de redémarrage perpétuelle (Bootloop / Clignotement du logo Apple)",
    "Ventilateurs tournent à pleine vitesse sans affichage ni rétroéclairage",
    "Court-circuit secondaire résiduel sur rail mémoire (PP1V1_S3) ou GPU/CPU",
    "Surchauffe anormale d'un micro-composant en amont lors du passage sous caméra thermique"
];

export const TechnicalBlockageModal: React.FC<TechnicalBlockageModalProps> = ({
    isOpen,
    onClose,
    ticket,
    onSaveReport,
    role,
    onPrintNote
}) => {
    const { showToast } = useToastContext();

    const existingReport = ticket.technicalBlockageReport;

    const [technicianName, setTechnicianName] = useState(
        existingReport?.technicianName || 
        localStorage.getItem('mac-repair-tech-name') || 
        'Technicien TGS'
    );
    const [selectedComponents, setSelectedComponents] = useState<string[]>(
        existingReport?.replacedComponents || []
    );
    const [customComponents, setCustomComponents] = useState(
        existingReport?.customComponentsText || ''
    );
    const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(
        existingReport?.symptoms || []
    );
    const [technicalDetails, setTechnicalDetails] = useState(
        existingReport?.technicalDetails || ''
    );
    const [requestedDays, setRequestedDays] = useState<number>(
        existingReport?.requestedDays || 3
    );
    const [customDaysInput, setCustomDaysInput] = useState<string>(
        existingReport?.requestedDays ? String(existingReport.requestedDays) : '3'
    );
    const [clientExplanation, setClientExplanation] = useState(
        existingReport?.clientExplanation || ''
    );
    const [blockageStatus, setBlockageStatus] = useState<'DEMANDEE' | 'CLIENT_INFORME' | 'ACCEPTEE' | 'REFUSEE'>(
        existingReport?.status || 'DEMANDEE'
    );
    const [isSaving, setIsSaving] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // Modèles TGS CI Réparer Mon MacBook
    const initialCivility = detectCivility(ticket.client?.name || ticket.clientName);
    const [civility, setCivility] = useState<'Monsieur' | 'Madame'>(initialCivility);
    const [selectedTemplate, setSelectedTemplate] = useState<WorkshopTemplateId>('two_options_t2_nand');
    const [partnerMotherboardSpec, setPartnerMotherboardSpec] = useState('Core i7, 16 Go de RAM, SSD 512 Go');
    const [partnerMotherboardPrice, setPartnerMotherboardPrice] = useState('200 000 F CFA');
    const [ppbusVoltage, setPpbusVoltage] = useState('12,6 V (PPBUS)');
    const [s5s4Voltage, setS5s4Voltage] = useState('3,3 V (S5 / S4) et 5 V (S5 / S4)');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    // Date calculée en jours ouvrés excluant dimanches et jours fériés
    const calculatedFutureDateObj = useMemo(() => {
        const days = Math.max(1, requestedDays || 1);
        return addDaysExcludingSundaysAndHolidays(new Date(), days);
    }, [requestedDays]);

    const formattedCalculatedDate = useMemo(() => {
        const y = calculatedFutureDateObj.getFullYear();
        const m = String(calculatedFutureDateObj.getMonth() + 1).padStart(2, '0');
        const d = String(calculatedFutureDateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }, [calculatedFutureDateObj]);

    const displayReadableCalculatedDate = useMemo(() => {
        return calculatedFutureDateObj.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }, [calculatedFutureDateObj]);

    // Application directe du modèle sélectionné
    const applyTemplate = (templateId: WorkshopTemplateId, customCivility?: 'Monsieur' | 'Madame') => {
        setSelectedTemplate(templateId);
        const civ = customCivility || civility;
        const msg = generateWorkshopMessage(templateId, ticket, {
            civility: civ,
            daysExtension: requestedDays,
            resumeDateFormatted: displayReadableCalculatedDate,
            partnerMotherboardSpec,
            partnerMotherboardPrice,
            ppbusVoltage,
            s5s4Voltage,
            replacedChips: selectedComponents.length > 0 ? selectedComponents : undefined
        });
        setClientExplanation(msg);
        showToast("Modèle TGS CI appliqué au message.", "success");
    };

    // Génération assistée par IA basée sur les 3 exemples réels TGS CI
    const handleGenerateAIMessage = async () => {
        setIsGeneratingAI(true);
        try {
            const res = await fetch('/api/gemini/generate-client-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: ticket.id,
                    clientName: ticket.client?.name || ticket.clientName,
                    civility,
                    macModel: ticket.macModel,
                    technicalNotes: technicalDetails,
                    componentsReplaced: selectedComponents,
                    symptoms: selectedSymptoms,
                    requestedDays,
                    calculatedDate: displayReadableCalculatedDate,
                    scenario: selectedTemplate === 'two_options_t2_nand' ? 'two_options' 
                            : selectedTemplate === 'nand_voltages_dataloss' ? 'voltages_nand'
                            : selectedTemplate === 'apple_session_password' ? 'session_password'
                            : 'auto'
                })
            });
            const data = await res.json();
            if (data.message) {
                setClientExplanation(data.message);
                showToast("Message rédigé avec l'excellence et le ton TGS CI !", "success");
            } else {
                throw new Error(data.error || 'Erreur');
            }
        } catch (err) {
            console.warn("AI generation fallback to static template:", err);
            applyTemplate(selectedTemplate);
        } finally {
            setIsGeneratingAI(false);
        }
    };

    // Initialiser l'explication si vide
    useEffect(() => {
        if (!existingReport?.clientExplanation && !clientExplanation && isOpen) {
            applyTemplate('two_options_t2_nand');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const toggleComponent = (comp: string) => {
        setSelectedComponents(prev => 
            prev.includes(comp) ? prev.filter(c => c !== comp) : [...prev, comp]
        );
    };

    const toggleSymptom = (sym: string) => {
        setSelectedSymptoms(prev => 
            prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
        );
    };

    const handleSelectQuickDays = (days: number) => {
        setRequestedDays(days);
        setCustomDaysInput(String(days));
    };

    const handleSave = async (andShareWhatsApp: boolean = false) => {
        if (selectedComponents.length === 0 && !customComponents.trim()) {
            showToast("Veuillez sélectionner ou mentionner au moins un composant remplacé.", "error");
            return;
        }

        if (selectedSymptoms.length === 0 && !technicalDetails.trim()) {
            showToast("Veuillez renseigner le symptôme ou le motif du blocage.", "error");
            return;
        }

        setIsSaving(true);
        try {
            const now = new Date().toISOString();
            const reportId = existingReport?.id || `blockage-${Date.now()}`;
            
            const newBlockageReport: TechnicalBlockageReport = {
                id: reportId,
                createdAt: existingReport?.createdAt || now,
                updatedAt: now,
                technicianName: technicianName.trim() || 'Technicien TGS',
                replacedComponents: selectedComponents,
                customComponentsText: customComponents.trim(),
                symptoms: selectedSymptoms,
                technicalDetails: technicalDetails.trim(),
                clientExplanation: clientExplanation.trim(),
                requestedDays,
                previousRdvDate: ticket.rendezVousDate || '',
                calculatedRdvDate: formattedCalculatedDate,
                calculatedRdvTime: '10:00',
                status: andShareWhatsApp ? 'CLIENT_INFORME' : blockageStatus,
                notifiedViaWhatsApp: andShareWhatsApp ? true : existingReport?.notifiedViaWhatsApp || false,
                notifiedViaCall: existingReport?.notifiedViaCall || false,
                notifiedViaSms: existingReport?.notifiedViaSms || false
            };

            const allCompNames = [...selectedComponents, ...(customComponents.trim() ? [customComponents.trim()] : [])].join(', ');
            const allSymptoms = [...selectedSymptoms, ...(technicalDetails.trim() ? [technicalDetails.trim()] : [])].join(', ');

            const historyNote = `Demande de rallonge de délai technique (+${requestedDays} jours ouvrés) déposée par ${technicianName.trim() || role}. Composants remplacés : [${allCompNames}]. Blocage/Instabilité : [${allSymptoms}]. Nouveau RDV calculé : ${formattedCalculatedDate} (10:00). Statut : ${newBlockageReport.status}.`;

            const updatedTicket: RepairTicket = {
                ...ticket,
                updatedAt: now,
                rendezVousDate: formattedCalculatedDate,
                rendezVousTime: '10:00',
                estimatedWorkDelay: `+${requestedDays} jours ouvrés (Rallonge technique)`,
                technicalBlockageReport: newBlockageReport,
                history: [
                    ...(ticket.history || []),
                    {
                        timestamp: now,
                        user: role,
                        action: historyNote
                    }
                ]
            };

            await onSaveReport(updatedTicket);
            localStorage.setItem('mac-repair-tech-name', technicianName.trim());
            showToast("Rapport de blocage et calcul de rallonge enregistrés avec succès !", "success");

            if (andShareWhatsApp) {
                const rawPhone = ticket.client?.phone || '';
                const cleanPhone = formatWhatsAppPhone(rawPhone);
                if (cleanPhone) {
                    const waUrl = generateWhatsAppUrl(cleanPhone, clientExplanation);
                    window.open(waUrl, '_blank');
                    showToast("Lien WhatsApp ouvert avec le message prêt à l'envoi.", "success");
                } else {
                    showToast("Numéro WhatsApp du client introuvable ou incomplet.", "error");
                }
            }

            onClose();
        } catch (err) {
            console.error("Erreur enregistrement rapport de blocage :", err);
            showToast("Erreur lors de l'enregistrement du rapport de blocage.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyMessage = () => {
        if (!clientExplanation) return;
        navigator.clipboard.writeText(clientExplanation);
        setIsCopied(true);
        showToast("Message client copié dans le presse-papier !", "success");
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-1 no-scrollbar text-left font-sans">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-white/10 gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 shrink-0">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">
                                    Rapport de Blocage & Rallonge
                                </h2>
                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase rounded border border-amber-500/30">
                                    En cours de travaux
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Dossier <span className="text-white font-mono font-bold">N°{ticket.id}</span> • {ticket.client?.name} • <span className="text-amber-300 font-bold">{ticket.macModel}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                        {onPrintNote && (
                            <button
                                type="button"
                                onClick={() => onPrintNote(ticket)}
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-white/10 flex items-center gap-1.5"
                                title="Imprimer la note d'étape d'atelier"
                            >
                                <Printer className="w-4 h-4 text-slate-400" />
                                <span className="hidden sm:inline">Note Étape</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Nom du technicien */}
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <User className="w-4 h-4 text-apple-blue" />
                        <span>Technicien intervenant :</span>
                    </div>
                    <input
                        type="text"
                        value={technicianName}
                        onChange={(e) => setTechnicianName(e.target.value)}
                        placeholder="Nom ou prénom du technicien..."
                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold text-xs outline-none focus:border-apple-blue transition-all sm:w-64"
                    />
                </div>

                {/* Section 1 : Composants déjà remplacés ou testés */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-emerald-400" />
                            1. Composants déjà remplacés ou testés sur la machine
                        </label>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">
                            {selectedComponents.length} sélectionné(s)
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {COMMON_REPLACED_COMPONENTS.map((comp) => {
                            const isSelected = selectedComponents.includes(comp);
                            return (
                                <button
                                    key={comp}
                                    type="button"
                                    onClick={() => toggleComponent(comp)}
                                    className={`text-left p-2.5 rounded-xl text-[11px] font-bold transition-all border flex items-center justify-between gap-2 ${
                                        isSelected 
                                            ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50 shadow-md' 
                                            : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    <span className="truncate">{comp}</span>
                                    <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-black shrink-0 ${
                                        isSelected ? 'bg-emerald-500 text-black' : 'border border-slate-700'
                                    }`}>
                                        {isSelected ? '✓' : ''}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <input
                        type="text"
                        value={customComponents}
                        onChange={(e) => setCustomComponents(e.target.value)}
                        placeholder="Autre composant spécifique (ex: Puce Audio CS42L83, Ligne 1.8V, Bobine L7030...)"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500 transition-all font-mono"
                    />
                </div>

                {/* Section 2 : Nature du blocage & Symptômes persistants */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-red-400" />
                            2. Nature précise du blocage & Symptômes persistants
                        </label>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">
                            {selectedSymptoms.length} sélectionné(s)
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        {COMMON_BLOCKAGE_SYMPTOMS.map((sym) => {
                            const isSelected = selectedSymptoms.includes(sym);
                            return (
                                <button
                                    key={sym}
                                    type="button"
                                    onClick={() => toggleSymptom(sym)}
                                    className={`w-full text-left p-2.5 rounded-xl text-[11px] font-bold transition-all border flex items-center justify-between gap-2 ${
                                        isSelected 
                                            ? 'bg-red-600/20 text-red-300 border-red-500/50 shadow-md' 
                                            : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    <span className="truncate">{sym}</span>
                                    <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-black shrink-0 ${
                                        isSelected ? 'bg-red-500 text-white' : 'border border-slate-700'
                                    }`}>
                                        {isSelected ? '✓' : ''}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <textarea
                        rows={2}
                        value={technicalDetails}
                        onChange={(e) => setTechnicalDetails(e.target.value)}
                        placeholder="Détails techniques internes pour l'équipe (ex: court-circuit franc dissipé après retrait du MOSFET, mais chute de tension anormale sur PP3V3_S5 lors de l'injection 1V 2A...)"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-red-500 transition-all font-mono leading-relaxed"
                    />
                </div>

                {/* Section 3 : Rallonge demandée & Calcul automatique de la prochaine date */}
                <div className="p-4 bg-gradient-to-br from-amber-500/10 via-slate-900 to-black rounded-3xl border border-amber-500/30 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <label className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-400" />
                                3. Rallonge de délai demandée (Jours ouvrés)
                            </label>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                Calcule automatiquement la prochaine date en excluant dimanches et jours fériés nationaux.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 5, 7].map((days) => (
                            <button
                                key={days}
                                type="button"
                                onClick={() => handleSelectQuickDays(days)}
                                className={`py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-wider ${
                                    requestedDays === days
                                        ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30 scale-102 border border-amber-400'
                                        : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
                                }`}
                            >
                                +{days} jour{days > 1 ? 's' : ''}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">
                            Ou nombre de jours personnalisé :
                        </span>
                        <input
                            type="number"
                            min="1"
                            max="60"
                            value={customDaysInput}
                            onChange={(e) => {
                                setCustomDaysInput(e.target.value);
                                const parsed = parseInt(e.target.value, 10);
                                if (!isNaN(parsed) && parsed > 0) setRequestedDays(parsed);
                            }}
                            className="w-24 bg-black/50 border border-white/20 rounded-xl px-3 py-1.5 text-center text-white font-mono font-bold text-sm outline-none focus:border-amber-400"
                        />
                        <span className="text-xs text-amber-400 font-bold">jours ouvrés</span>
                    </div>

                    {/* Résultat du calcul automatique de la date */}
                    <div className="bg-black/50 p-4 rounded-2xl border border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                                    Prochaine Date de Rendez-vous / Retrait Calculée
                                </p>
                                <p className="text-base font-black text-white font-mono capitalize mt-0.5">
                                    {displayReadableCalculatedDate}
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                                    Heure recommandée : 10 h 00 • Fiche atelier & calendrier synchronisés
                                </p>
                            </div>
                        </div>

                        <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-300 font-mono text-xs font-black">
                            {formattedCalculatedDate}
                        </div>
                    </div>
                </div>

                {/* Section 4 : Explication vulgarisée pour le client (WhatsApp/SMS) */}
                <div className="space-y-4 bg-gradient-to-br from-slate-900/90 via-slate-900 to-black p-5 rounded-3xl border border-white/10 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                        <div>
                            <label className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                4. Communication Client d'Atelier (Modèles TGS CI)
                            </label>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                Sélectionnez le scénario technique rencontré ou laissez l'IA formuler le message avec courtoisie et rigueur.
                            </p>
                        </div>

                        {/* Civilité Monsieur / Madame */}
                        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider px-2">Civilité :</span>
                            <button
                                type="button"
                                onClick={() => { setCivility('Monsieur'); applyTemplate(selectedTemplate, 'Monsieur'); }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                    civility === 'Monsieur' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Monsieur
                            </button>
                            <button
                                type="button"
                                onClick={() => { setCivility('Madame'); applyTemplate(selectedTemplate, 'Madame'); }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                    civility === 'Madame' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Madame
                            </button>
                        </div>
                    </div>

                    {/* Sélecteur de scénario technique réel TGS CI */}
                    <div className="space-y-2">
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                            Sélectionnez le scénario correspondant à l'incident :
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* Modèle 1 : 2 Options */}
                            <button
                                type="button"
                                onClick={() => applyTemplate('two_options_t2_nand')}
                                className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                                    selectedTemplate === 'two_options_t2_nand'
                                        ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/30'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-400'
                                }`}
                            >
                                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5">
                                    <Split className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-black text-white uppercase tracking-tight">2 Options Claires</span>
                                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[8px] font-black uppercase rounded">Apple / T2 / NAND</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                        Propose au client soit la reprise approfondie à date, soit le remplacement CM sous 72h chiffré.
                                    </p>
                                </div>
                            </button>

                            {/* Modèle 2 : Tensions & NAND */}
                            <button
                                type="button"
                                onClick={() => applyTemplate('nand_voltages_dataloss')}
                                className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                                    selectedTemplate === 'nand_voltages_dataloss'
                                        ? 'bg-red-500/15 border-red-500/50 ring-1 ring-red-500/30'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-400'
                                }`}
                            >
                                <div className="p-2 bg-red-500/20 text-red-400 rounded-xl shrink-0 mt-0.5">
                                    <Cpu className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-black text-white uppercase tracking-tight">Point Tensions & NAND</span>
                                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 text-[8px] font-black uppercase rounded">Perte Données</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                        Tensions 12.6V / 3.3V / 5V OK, blocage lecture NAND, délai approvisionnement & effacement total.
                                    </p>
                                </div>
                            </button>

                            {/* Modèle 3 : Mot de passe Apple */}
                            <button
                                type="button"
                                onClick={() => applyTemplate('apple_session_password')}
                                className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                                    selectedTemplate === 'apple_session_password'
                                        ? 'bg-blue-500/15 border-blue-500/50 ring-1 ring-blue-500/30'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-400'
                                }`}
                            >
                                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl shrink-0 mt-0.5">
                                    <Key className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-black text-white uppercase tracking-tight">Mot de Passe Session</span>
                                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-[8px] font-black uppercase rounded">Activation Apple</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                        MacBook redémarré après remplacement puces. Mot de passe requis pour activation Apple & tests complets.
                                    </p>
                                </div>
                            </button>

                            {/* Modèle 4 : Rallonge standard */}
                            <button
                                type="button"
                                onClick={() => applyTemplate('standard_delay_extension')}
                                className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                                    selectedTemplate === 'standard_delay_extension'
                                        ? 'bg-purple-500/15 border-purple-500/50 ring-1 ring-purple-500/30'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-400'
                                }`}
                            >
                                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl shrink-0 mt-0.5">
                                    <Clock className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-black text-white uppercase tracking-tight">Rallonge Atelier Standard</span>
                                        <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[8px] font-black uppercase rounded">Microscope</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                        Mesures approfondies sur étages secondaires après remplacement des premiers composants d'alimentation.
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Paramètres dynamiques rapides selon le modèle */}
                    {selectedTemplate === 'two_options_t2_nand' && (
                        <div className="p-3.5 bg-black/50 border border-amber-500/30 rounded-2xl space-y-2.5 animate-fade-in">
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                                Paramètres de l'Option 2 (Carte Mère de rechange) :
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Config / Processeur / RAM / SSD :</label>
                                    <input
                                        type="text"
                                        value={partnerMotherboardSpec}
                                        onChange={(e) => setPartnerMotherboardSpec(e.target.value)}
                                        placeholder="Core i7, 16 Go de RAM, SSD 512 Go"
                                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Tarif tout compris (F CFA) :</label>
                                    <input
                                        type="text"
                                        value={partnerMotherboardPrice}
                                        onChange={(e) => setPartnerMotherboardPrice(e.target.value)}
                                        placeholder="200 000 F CFA"
                                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400 font-mono font-bold text-amber-300"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => applyTemplate('two_options_t2_nand')}
                                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-500/30"
                            >
                                Mettre à jour le texte avec ces valeurs
                            </button>
                        </div>
                    )}

                    {selectedTemplate === 'nand_voltages_dataloss' && (
                        <div className="p-3.5 bg-black/50 border border-red-500/30 rounded-2xl space-y-2.5 animate-fade-in">
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block">
                                Tensions rétablies mesurées :
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Rail d'alimentation principal (PPBUS) :</label>
                                    <input
                                        type="text"
                                        value={ppbusVoltage}
                                        onChange={(e) => setPpbusVoltage(e.target.value)}
                                        placeholder="12,6 V (PPBUS)"
                                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-red-400 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Lignes secondaires S5 / S4 :</label>
                                    <input
                                        type="text"
                                        value={s5s4Voltage}
                                        onChange={(e) => setS5s4Voltage(e.target.value)}
                                        placeholder="3,3 V (S5 / S4) et 5 V (S5 / S4)"
                                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-red-400 font-mono"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => applyTemplate('nand_voltages_dataloss')}
                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-[10px] font-black uppercase tracking-wider border border-red-500/30"
                            >
                                Mettre à jour le texte avec ces tensions
                            </button>
                        </div>
                    )}

                    {/* Zone de texte & Actions */}
                    <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Texte du message prêt à être envoyé au client :
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleGenerateAIMessage}
                                    disabled={isGeneratingAI}
                                    className="px-3 py-1 bg-gradient-to-r from-purple-600/30 to-amber-600/30 hover:from-purple-600/40 hover:to-amber-600/40 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-purple-500/30 flex items-center gap-1.5 shadow-md disabled:opacity-50"
                                    title="Générer un message sur-mesure combinant toutes les données du ticket avec l'IA"
                                >
                                    {isGeneratingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" /> : <Wand2 className="w-3.5 h-3.5 text-amber-300" />}
                                    <span>{isGeneratingAI ? "Rédaction en cours..." : "Rédiger avec IA (Style TGS)"}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyTemplate(selectedTemplate)}
                                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border border-white/10 flex items-center gap-1.5"
                                    title="Réinitialiser avec le modèle officiel"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Réinitialiser
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyMessage}
                                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border border-white/10 flex items-center gap-1.5"
                                >
                                    {isCopied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    {isCopied ? 'Copié' : 'Copier'}
                                </button>
                            </div>
                        </div>

                        <textarea
                            rows={10}
                            value={clientExplanation}
                            onChange={(e) => setClientExplanation(e.target.value)}
                            placeholder="Message courtois et rassurant destiné au client..."
                            className="w-full bg-black/60 border border-white/15 rounded-2xl p-4 text-xs sm:text-[13px] text-slate-200 placeholder-slate-600 outline-none focus:border-amber-400 transition-all font-sans leading-relaxed shadow-inner"
                        />
                    </div>

                    {/* Statut de la démarche */}
                    <div className="bg-black/40 p-3.5 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Statut de la démarche client :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { id: 'DEMANDEE' as const, label: 'Rallonge demandée', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                                { id: 'CLIENT_INFORME' as const, label: 'Client notifié', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
                                { id: 'ACCEPTEE' as const, label: 'Accord client confirmé', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                                { id: 'REFUSEE' as const, label: 'Client refuse / Point requis', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
                            ].map((st) => (
                                <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => setBlockageStatus(st.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                                        blockageStatus === st.id ? `${st.color} ring-1 ring-white/20` : 'bg-white/5 text-slate-500 border-transparent hover:text-white'
                                    }`}
                                >
                                    {st.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-white/10">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="w-full sm:w-auto px-5 py-3.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                    >
                        Annuler
                    </button>

                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto sm:ml-auto">
                        <button
                            type="button"
                            onClick={() => handleSave(false)}
                            disabled={isSaving}
                            className="w-full sm:w-auto px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all border border-white/10 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Send className="w-4 h-4 text-amber-400" />
                            <span>Enregistrer la rallonge</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSave(true)}
                            disabled={isSaving}
                            className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-xl shadow-emerald-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <WhatsAppIcon className="w-4 h-4" />
                            <span>Enregistrer & Ouvrir WhatsApp</span>
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default TechnicalBlockageModal;
