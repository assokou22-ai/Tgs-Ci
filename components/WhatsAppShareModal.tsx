import React, { useState, useCallback, useEffect } from 'react';
import Modal from './Modal.tsx';
import { 
    X, CheckCircle2, Clipboard, 
    Sparkles, ChevronRight, FileText, 
    Clock, AlertTriangle, MessageSquare, Phone, Link2
} from 'lucide-react';
import { WhatsAppIcon } from './icons.tsx';
import { useToastContext } from '../context/ToastContext.tsx';
import { formatWhatsAppPhone, formatDisplayPhone, generateWhatsAppUrl } from '../utils/formatters.ts';

interface WhatsAppShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ticket: any; // Flexible to accept RepairTicket, Facture, or Commande
}

type TemplateType = 'reception' | 'diagnostic' | 'progress' | 'ready' | 'unrepairable' | 'reminder' | 'review' | 'custom';

interface MessageTemplate {
    id: TemplateType;
    label: string;
    description: string;
    icon: React.ReactNode;
}

const templates: MessageTemplate[] = [
    { id: 'ready', label: 'Appareil Prêt', description: 'Prêt pour retrait / livraison avec solde', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
    { id: 'reception', label: 'Réception', description: 'Confirmation de prise en charge atelier', icon: <FileText className="w-4 h-4 text-blue-400" /> },
    { id: 'diagnostic', label: 'Devis / Diagnostic', description: 'Bilan technique et devis à valider', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
    { id: 'progress', label: 'En cours', description: 'Suivi et avancement de l\'intervention', icon: <Clock className="w-4 h-4 text-amber-400" /> },
    { id: 'reminder', label: 'Rappel Solde', description: 'Paiement restant / facture en attente', icon: <ChevronRight className="w-4 h-4 text-yellow-400" /> },
    { id: 'unrepairable', label: 'Irréparable', description: 'Rapport d\'impossibilité technique', icon: <AlertTriangle className="w-4 h-4 text-red-500" /> },
    { id: 'review', label: 'Avis Client', description: 'Lien Google Maps & Satisfaction', icon: <MessageSquare className="w-4 h-4 text-cyan-400" /> },
];

const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({ isOpen, onClose, ticket }) => {
    const { showToast } = useToastContext();
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('ready');
    const [customMessages, setCustomMessages] = useState<Partial<Record<TemplateType, string>>>({});
    const [isCopied, setIsCopied] = useState(false);
    const [isLinkCopied, setIsLinkCopied] = useState(false);

    // Numéro de téléphone cible éditable avec détection automatique
    const [targetPhone, setTargetPhone] = useState<string>('');

    useEffect(() => {
        if (ticket) {
            const raw = ticket.client?.phone || ticket.clientPhone || ticket.telephone || ticket.phone || '';
            setTargetPhone(raw);
            // Default to 'ready' if ticket is finished
            if (ticket.status === 'Terminé' || ticket.status === 'Rendu') {
                setSelectedTemplate('ready');
            } else if (ticket.status === 'Devis à valider' || ticket.status === 'Diagnostic en cours') {
                setSelectedTemplate('diagnostic');
            } else if (ticket.status === 'Non réparable') {
                setSelectedTemplate('unrepairable');
            }
        }
    }, [ticket]);

    const formattedTargetPhone = formatWhatsAppPhone(targetPhone);
    const displayFormatted = formatDisplayPhone(targetPhone);

    const getTemplateMessage = useCallback((type: TemplateType) => {
        if (!ticket) return '';
        const clientName = ticket.client?.name || ticket.clientName || 'Client';
        const model = ticket.macModel || 'MacBook';
        const id = ticket.id || ticket.numero || 'N/A';
        const total = ticket.costs ? ((ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0)) : (ticket.total || 0);
        const advance = (ticket.costs?.advance || ticket.advance || 0);
        const balance = Math.max(0, total - advance);
        
        let msg = `*TGS CI - RÉPARER MON MACBOOK*\n📌 *DÉTAILS N°${id}*\n👤 *CLIENT :* ${clientName}\n\n`;

        switch (type) {
            case 'ready':
                msg += `✅ *BONNE NOUVELLE : VOTRE APPAREIL EST PRÊT !*\n\nBonjour ${clientName},\nVotre *${model}* est entièrement réparé, testé et disponible dans nos ateliers.\n\n💰 *Total des travaux :* ${total.toLocaleString('fr-FR')} F CFA\n💳 *Acompte versé :* ${advance.toLocaleString('fr-FR')} F CFA\n💵 *SOLDE À RÉGLER AU RETRAIT :* ${balance.toLocaleString('fr-FR')} F CFA\n\n📍 *Atelier TGS CI :* Cocody Faya, Abidjan\n📞 *Contact :* +225 07 57 13 35 07\n\nVous pouvez passer le récupérer aux horaires d'ouverture. Merci de votre confiance !`;
                break;
            case 'reception':
                msg += `Bonjour ${clientName}, votre *${model}* a été bien réceptionné dans nos ateliers sous la fiche N°${id}.\n\nNos techniciens experts certifiés vont procéder au diagnostic complet.\nVous recevrez une notification dès que l'expertise technique sera finalisée.\n\nMerci de votre confiance.`;
                break;
            case 'diagnostic':
                msg += `🔍 *BILAN DU DIAGNOSTIC TECHNIQUE*\n\nBonjour ${clientName},\nL'expertise de votre *${model}* est terminée.\n\n🛠 *TRAVAUX / CONSTAT :* ${ticket.diagnosticReport || ticket.problemDescription || 'Intervention sur carte mère / composants'}\n💰 *DEVIS ESTIMÉ :* ${total.toLocaleString('fr-FR')} F CFA\n\nMerci de nous répondre directement par WhatsApp pour confirmer votre accord et démarrer la réparation.`;
                break;
            case 'progress':
                msg += `⚙️ *SUIVI DE VOTRE RÉPARATION*\n\nBonjour ${clientName},\nVotre *${model}* est actuellement sur le banc technique de nos experts.\n\nL'intervention suit son cours normal. Nous vous notifierons dès la fin des tests de validation.`;
                break;
            case 'reminder':
                msg += `💰 *RAPPEL DE PAIEMENT / FACTURE*\n\nBonjour ${clientName},\nNous vous informons qu'un solde restant de *${balance.toLocaleString('fr-FR')} F CFA* est en attente pour le dossier N°${id} (${model}).\n\nMerci de nous contacter pour finaliser le règlement.`;
                break;
            case 'unrepairable':
                msg += `⚠️ *RAPPORT D'EXPERTISE TECHNIQUE*\n\nBonjour ${clientName},\nAprès analyse approfondie de votre *${model}*, nous avons le regret de vous informer que l'appareil n'est pas réparable.\n\n*Motif technique :* ${ticket.technicianNotes || 'Dommages irréversibles sur la carte logique'}.\n\nVous pouvez vous présenter à l'atelier pour récupérer votre machine.`;
                break;
            case 'review':
                msg += `🌟 *VOTRE AVIS EST PRÉCIEUX*\n\nBonjour ${clientName},\nVous avez récemment récupéré votre *${model}* réparé chez TGS CI.\n\nSi vous êtes satisfait de notre accueil et de notre expertise, pourriez-vous nous laisser 5 étoiles et un mot sur Google ?\n👉 [LIEN AVIS GOOGLE TGS-CI]\n\nMerci pour votre fidélité !`;
                break;
            default:
                msg = '';
        }
        return msg;
    }, [ticket]);

    const displayMessage = customMessages[selectedTemplate] !== undefined 
        ? customMessages[selectedTemplate]! 
        : getTemplateMessage(selectedTemplate);

    const handleCopy = () => {
        navigator.clipboard.writeText(displayMessage);
        setIsCopied(true);
        showToast("Message copié dans le presse-papier", "success");
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleCopyLink = () => {
        if (!formattedTargetPhone) {
            showToast("Veuillez renseigner un numéro valide", "error");
            return;
        }
        const url = generateWhatsAppUrl(formattedTargetPhone, displayMessage);
        navigator.clipboard.writeText(url);
        setIsLinkCopied(true);
        showToast("Lien direct WhatsApp copié !", "success");
        setTimeout(() => setIsLinkCopied(false), 2000);
    };

    const handleShare = () => {
        if (!formattedTargetPhone) {
            showToast("Numéro de téléphone introuvable ou invalide", "error");
            return;
        }
        const url = generateWhatsAppUrl(formattedTargetPhone, displayMessage);
        window.open(url, '_blank');
        showToast(`WhatsApp ouvert pour le +${formattedTargetPhone}`, "success");
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="w-full max-w-4xl bg-[#0a0a0b] text-white overflow-hidden rounded-3xl border border-white/10 shadow-2xl animate-fade-in mx-4">
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                            <WhatsAppIcon className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-black uppercase tracking-widest">Envoi WhatsApp Client</h2>
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest rounded-full border border-emerald-500/30">
                                    Direct API wa.me
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                {ticket?.id ? `Dossier N°${ticket.id} — ${ticket.client?.name || ticket.clientName}` : 'Notification client'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Target Phone Selector Bar */}
                <div className="px-6 py-3.5 bg-emerald-950/20 border-b border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <Phone className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                Numéro WhatsApp Destinataire
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-mono font-black text-emerald-300">
                                    🇨🇮 +{formattedTargetPhone || 'Non défini'}
                                </span>
                                {displayFormatted && displayFormatted !== 'N/A' && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        ({displayFormatted})
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={targetPhone}
                            onChange={(e) => setTargetPhone(e.target.value)}
                            placeholder="07 XX XX XX XX"
                            className="px-3 py-1.5 bg-black/60 border border-emerald-500/30 rounded-xl text-xs text-white font-mono font-bold outline-none focus:border-emerald-400 w-44 sm:w-48 placeholder:text-slate-600"
                        />
                        {ticket?.client?.secondaryPhone && ticket.client.secondaryPhone !== targetPhone && (
                            <button
                                type="button"
                                onClick={() => setTargetPhone(ticket.client.secondaryPhone)}
                                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-wider"
                                title="Utiliser le numéro secondaire"
                            >
                                Sec: {ticket.client.secondaryPhone}
                            </button>
                        )}
                        {ticket?.client?.smsPhone && ticket.client.smsPhone !== targetPhone && (
                            <button
                                type="button"
                                onClick={() => setTargetPhone(ticket.client.smsPhone)}
                                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-wider"
                                title="Utiliser le numéro SMS"
                            >
                                SMS: {ticket.client.smsPhone}
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12">
                    {/* Left Rail: Templates */}
                    <div className="lg:col-span-5 border-r border-white/5 p-4 space-y-2 max-h-[460px] overflow-y-auto custom-scrollbar bg-black/20">
                        <p className="px-3 py-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">Modèles prédéfinis</p>
                        {templates.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTemplate(t.id)}
                                className={`w-full text-left p-3.5 rounded-2xl transition-all flex items-start gap-3.5 border group ${
                                    selectedTemplate === t.id 
                                    ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-950/20' 
                                    : 'bg-white/5 border-transparent hover:border-white/10 hover:bg-white/[0.07]'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                    selectedTemplate === t.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-black/40 text-slate-500 group-hover:text-slate-300'
                                }`}>
                                    {t.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className={`text-xs font-black uppercase tracking-tight ${selectedTemplate === t.id ? 'text-emerald-400' : 'text-slate-200'}`}>
                                        {t.label}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5 truncate">{t.description}</p>
                                </div>
                                {selectedTemplate === t.id && (
                                    <div className="ml-auto flex items-center shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Right Panel: Editor & Actions */}
                    <div className="lg:col-span-7 p-5 sm:p-6 flex flex-col gap-4 bg-black/40">
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Message à envoyer
                                </label>
                                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">
                                    Édition libre autorisée
                                </span>
                            </div>
                            <textarea
                                value={displayMessage}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomMessages(prev => ({ ...prev, [selectedTemplate]: val }));
                                }}
                                rows={11}
                                className="w-full bg-[#050506] border border-white/10 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-mono focus:border-emerald-500/50 outline-none resize-none shadow-inner"
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5">
                            <button
                                onClick={handleCopy}
                                className="py-3 px-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 text-slate-300 hover:text-white"
                                title="Copier le texte brut"
                            >
                                {isCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                                <span>Copier texte</span>
                            </button>

                            <button
                                onClick={handleCopyLink}
                                className="py-3 px-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 text-slate-300 hover:text-white"
                                title="Copier le lien complet wa.me"
                            >
                                {isLinkCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
                                <span>Copier Lien</span>
                            </button>

                            <button
                                onClick={handleShare}
                                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-600/30 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all active:scale-95 group"
                            >
                                <WhatsAppIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                <span>Lancer WhatsApp Web / App</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default WhatsAppShareModal;

