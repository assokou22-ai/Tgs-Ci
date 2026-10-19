import React, { useState, useEffect } from 'react';
import { 
    X, 
    Copy, 
    Check, 
    Share2, 
    Globe, 
    Smartphone, 
    MessageSquare, 
    FileText 
} from 'lucide-react';
import { RepairTicket } from '../types.ts';
import { generateSocialAndWebPost } from '../utils/socialPostGenerator.ts';
import { useToastContext } from '../context/ToastContext.tsx';

interface SocialPostModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: RepairTicket;
}

export const SocialPostModal: React.FC<SocialPostModalProps> = ({
    isOpen,
    onClose,
    ticket
}) => {
    const { showToast } = useToastContext();
    const [format, setFormat] = useState<'social' | 'website' | 'simple' | 'short'>('social');
    const [includeHashtags, setIncludeHashtags] = useState(true);
    const [includeShopContact, setIncludeShopContact] = useState(true);
    const [postText, setPostText] = useState('');
    const [copied, setCopied] = useState(false);

    // Mettre à jour le texte à chaque changement de ticket ou d'options
    useEffect(() => {
        if (ticket) {
            const generated = generateSocialAndWebPost(ticket, {
                format,
                includeHashtags,
                includeShopContact
            });
            setPostText(generated);
        }
    }, [ticket, format, includeHashtags, includeShopContact]);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(postText);
            setCopied(true);
            showToast("Texte copié dans le presse-papier ! Prêt à coller sur vos réseaux ou site web.", "success");
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            console.error("Échec copie presse-papier:", err);
            showToast("Veuillez sélectionner et copier le texte manuellement.", "warning");
        }
    };

    const handleWhatsAppShare = () => {
        const encoded = encodeURIComponent(postText);
        window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl text-white relative flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-blue-500/30 rounded-2xl text-blue-400">
                            <Share2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                Texte pour Réseaux Sociaux & Site Web
                            </h2>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Fiche #{ticket.id} • {ticket.macBrand || 'Apple'} {ticket.macModel || 'MacBook'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
                        title="Fermer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content body */}
                <div className="py-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                    {/* Sélecteur de format */}
                    <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
                        <button
                            type="button"
                            onClick={() => setFormat('social')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                format === 'social'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Réseaux Sociaux</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFormat('website')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                format === 'website'
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Site Web & Blog</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFormat('simple')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                format === 'simple'
                                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Texte Pur (5 points)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFormat('short')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                format === 'short'
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Statut WhatsApp / Court</span>
                        </button>
                    </div>

                    {/* Options secondaires */}
                    <div className="flex items-center justify-between gap-4 flex-wrap text-xs text-zinc-400 px-1">
                        <div className="flex items-center gap-4">
                            {format === 'social' && (
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={includeHashtags}
                                        onChange={e => setIncludeHashtags(e.target.checked)}
                                        className="rounded border-zinc-700 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>Hashtags pertinents</span>
                                </label>
                            )}

                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={includeShopContact}
                                    onChange={e => setIncludeShopContact(e.target.checked)}
                                    className="rounded border-zinc-700 text-blue-600 focus:ring-blue-500"
                                />
                                <span>Coordonnées atelier TGS-CI</span>
                            </label>
                        </div>

                        <span className="text-[11px] font-mono text-zinc-500">
                            {postText.length} caractères • {postText.trim().split(/\s+/).length} mots
                        </span>
                    </div>

                    {/* Zone de texte éditable */}
                    <div className="relative">
                        <textarea
                            value={postText}
                            onChange={e => setPostText(e.target.value)}
                            rows={14}
                            className="w-full p-4 bg-black/60 border border-white/10 rounded-2xl text-xs sm:text-sm font-sans leading-relaxed text-zinc-200 outline-none focus:border-blue-500 transition-colors custom-scrollbar resize-none"
                            placeholder="Texte de publication..."
                        />
                        <div className="absolute bottom-3 right-3 text-[10px] text-zinc-500 bg-zinc-900/90 px-2 py-1 rounded-md border border-white/5 pointer-events-none">
                            Vous pouvez modifier ce texte avant de le copier
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={handleWhatsAppShare}
                        className="px-4 py-2.5 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                    >
                        <MessageSquare className="w-4 h-4 text-emerald-400" />
                        <span>Partager WhatsApp</span>
                    </button>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all"
                        >
                            Fermer
                        </button>

                        <button
                            type="button"
                            onClick={handleCopy}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 ${
                                copied
                                    ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                            }`}
                        >
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Copié !</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    <span>Copier le texte</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default SocialPostModal;
