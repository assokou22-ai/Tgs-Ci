
import React, { useState, useMemo } from 'react';
import PreviewModal from './PreviewModal.tsx';
import PrintableSimpleDocument from './PrintableSimpleDocument.tsx';
import PrintableValidationSheet from './PrintableValidationSheet.tsx';
import Modal from './Modal.tsx';
import { 
    PrinterIcon, PlusCircleIcon, TrashIcon, 
    PencilIcon, MagnifyingGlassIcon, 
    ClipboardDocumentCheckIcon, ArrowPathIcon,
    SparklesIcon
} from './icons.tsx';
import { SimpleDocument, RepairTicket } from '../types.ts';
import useSimpleDocuments from '../hooks/useSimpleDocuments.ts';
import useRepairTickets from '../hooks/useRepairTickets.ts';
import { playTone } from '../utils/audio.ts';
import ConfirmationModal from './ConfirmationModal.tsx';
import { useToastContext } from '../context/ToastContext.tsx';

interface SimpleDocumentGeneratorProps {
    onBack?: () => void;
}

type ClientType = 'PARTICULIER' | 'SOCIETE';

const TEMPLATES = [
    // --- CATEGORIE : VALIDATION & CONTRÔLE QUALITÉ (NOUVEAU) ---
    {
        id: 'fiche_validation_client',
        category: 'Validation & Sortie',
        name: 'Fiche de Validation Technique (Checklist)',
        title: 'FICHE DE VALIDATION APRÈS RÉPARATION',
        isSpecial: true,
        specialType: 'validation',
        content: {
            PARTICULIER: `Fiche de contrôle qualité visuelle et technique. Ce document est une checkliste (tableau) permettant au client de valider chaque point de fonctionnement (Clavier, Écran, Son, etc.) avant de signer.`,
            SOCIETE: `Fiche de contrôle qualité visuelle et technique pour parc entreprise. Permet au DSI ou au réceptionnaire de valider la conformité avant le bon de livraison.`
        }
    },
    // --- CATEGORIE : DÉCHARGES & RESTITUTIONS ---
    {
        id: 'restitution_etat',
        category: 'Décharges & Restitutions',
        name: 'Restitution machine "Dans l\'état" (Non Réparé)',
        title: 'PROCÈS-VERBAL DE RESTITUTION (SANS RÉPARATION)',
        content: {
            PARTICULIER: `Je soussigné(e) [NOM_CLIENT], reconnaît récupérer ce jour mon appareil [MODELE_MAC] (S/N: [SN]) déposé le [DATE_DEPOT].

L'appareil m'est restitué DANS L'ÉTAT INITIAL (ou constaté lors du diagnostic), suite à :
[ ] Un refus de devis
[ ] Une impossibilité technique de réparation (Irréparable)
[ ] Une demande de retrait anticipé de ma part

Je certifie avoir vérifié l'intégrité physique de la machine et la présence de mes accessoires. Je décharge TGS-CI de toute responsabilité ultérieure concernant cette panne ou l'état de l'appareil après sa sortie de l'atelier.

Fait à Abidjan, le [DATE]`,
            SOCIETE: `La société [NOM_SOCIETE] récupère ce jour le matériel [MODELE_MAC] (S/N: [SN]).
Le matériel est restitué NON RÉPARÉ. Le client renonce à toute poursuite concernant l'état de fonctionnement de la machine qui est identique à son état d'arrivée ou à l'état décrit dans le rapport technique d'irréparabilité.

Fait à Abidjan, le [DATE]`
        }
    },
    {
        id: 'decharge_donnees',
        category: 'Décharges & Restitutions',
        name: 'Décharge Risque Perte de Données',
        title: 'DÉCHARGE DE RESPONSABILITÉ - DONNÉES',
        content: {
            PARTICULIER: `Je soussigné(e) [NOM_CLIENT], propriétaire du MacBook [MODELE_MAC] (S/N: [SN]), suis informé(e) que l'intervention technique sur la carte mère ou le stockage comporte un risque inhérent de perte de données.

Je déclare avoir effectué une sauvegarde préalable ou accepter le risque de perte totale de mes fichiers. Je décharge formellement TGS-CI de toute responsabilité civile ou pénale en cas d'altération ou de perte de mes données informatiques.

Fait à Abidjan, le [DATE]`,
            SOCIETE: `La société [NOM_SOCIETE] autorise l'intervention sur l'unité [MODELE_MAC]. Elle confirme que la sauvegarde des données sensibles relève de sa propre politique de backup interne et dégage le prestataire TGS-CI de toute responsabilité concernant l'intégrité des données stockées.

Fait à Abidjan, le [DATE]`
        }
    },
    // --- CATEGORIE : CESSION / PROPRIÉTÉ ---
    {
        id: 'cession_standard',
        category: 'Cession & Vente',
        name: 'Acte de Cession (Vente vers TGS)',
        title: 'ACTE DE CESSION DE MATÉRIEL INFORMATIQUE',
        content: {
            PARTICULIER: `ENTRE LES SOUSSIGNÉS :

Le Cédant : M./Mme [NOM_CLIENT], demeurant à [ADRESSE_CLIENT], Tel: [TELEPHONE_CLIENT].
ET
Le Cessionnaire : L'entreprise TGS-CI.

OBJET :
Le Cédant vend et transfère la pleine propriété du matériel suivant :
- Type : [MODELE_MAC]
- Numéro de Série : [SN]
- État : [ETAT_FONCTIONNEL_OU_NON]

PRIX :
La présente cession est consentie et acceptée moyennant le prix de [MONTANT] F CFA, réglé ce jour par [MOYEN_PAIEMENT].

DÉCLARATION SUR L'HONNEUR :
Le Cédant certifie sur l'honneur être le propriétaire légitime et exclusif dudit matériel, qu'il n'est grevé d'aucun gage ni nantissement, et qu'il ne provient pas d'une origine frauduleuse.

Fait à Abidjan, le [DATE] en deux exemplaires.`,
            SOCIETE: `La société [NOM_SOCIETE] cède à titre onéreux le matériel désigné ci-après à l'entreprise TGS-CI pour destruction, recyclage ou reconditionnement.

Matériel : [MODELE_MAC] (S/N: [SN])
Prix de cession : [MONTANT] F CFA HT.

La société cédante garantit la libre disposition du matériel.

Fait à Abidjan, le [DATE]`
        }
    },
    // --- CATEGORIE : CONFIDENTIALITÉ & RGPD ---
    {
        id: 'accord_confidentialite',
        category: 'Confidentialité',
        name: 'Accord de Confidentialité (NDA)',
        title: 'ENGAGEMENT DE CONFIDENTIALITÉ',
        content: {
            PARTICULIER: `TGS-CI s'engage par la présente à garantir la confidentialité absolue des données contenues dans le matériel [MODELE_MAC] (S/N: [SN]) appartenant à [NOM_CLIENT].

Aucune donnée ne sera copiée, consultée (sauf nécessité technique stricte) ou transmise à un tiers.

Fait à Abidjan, le [DATE]`,
            SOCIETE: `ACCORD DE NON-DIVULGATION

Entre [NOM_SOCIETE] et TGS-CI.

Dans le cadre de la maintenance du parc informatique, TGS-CI peut avoir accès à des supports de stockage.
TGS-CI s'engage à :
1. Ne pas divulguer les informations.
2. Utiliser les accès uniquement pour les besoins de la réparation.
3. Détruire toute copie temporaire de données après intervention (si clonage nécessaire).

Cet engagement couvre toute la durée de détention du matériel [MODELE_MAC] et perdure après sa restitution.

Fait à Abidjan, le [DATE]`
        }
    },
    // --- CATEGORIE : CONTRATS CADRES ---
    {
        id: 'contrat_partenariat_tgs',
        category: 'Contrats Cadres',
        name: 'Contrat de Partenariat & Prise en Charge',
        title: 'CONTRAT DE PRISE EN CHARGE ET DE MAINTENANCE',
        content: {
            PARTICULIER: `ENTRE LES SOUSSIGNÉS :
La société TGS-CI, dénommée « le Réparateur »
ET
M./Mme [NOM_CLIENT], dénommé « le Client »

ARTICLE 1 – OBJET
Le présent contrat définit les conditions de réparation du matériel [MODELE_MAC].

ARTICLE 2 – OBLIGATION DE MOYENS
Le Réparateur est soumis à une obligation de moyens. En électronique, le résultat ne peut jamais être garanti à 100% compte tenu de la complexité des circuits.

ARTICLE 3 – PIÈCES
Les pièces remplacées peuvent être neuves ou reconditionnées (qualité origine), sauf demande expresse contraire du client sur le devis.

Fait à Abidjan, le [DATE]`,
            SOCIETE: `CONTRAT DE MAINTENANCE INFORMATIQUE

Entre TGS-CI et [NOM_SOCIETE].

Le présent contrat cadre définit les conditions d'intervention sur le parc de [NOM_SOCIETE].
TGS-CI assure le diagnostic, la réparation et le conseil.
Les factures sont payables à réception sauf accord spécifique.

Fait à Abidjan, le [DATE]`
        }
    }
];

const SimpleDocumentGenerator: React.FC<SimpleDocumentGeneratorProps> = () => {
    const { showToast } = useToastContext();
    const { documents, addDocument, updateDocument, deleteDocument } = useSimpleDocuments();
    const { tickets, updateTicket } = useRepairTickets();
    
    const [editingDoc, setEditingDoc] = useState<(Partial<SimpleDocument> & { isSpecial?: boolean, specialType?: string }) | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
    const [clientType, setClientType] = useState<ClientType>('PARTICULIER');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [docToDelete, setDocToDelete] = useState<SimpleDocument | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    // AI States
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiGenerating, setIsAiGenerating] = useState(false);

    const [manualFields, setManualFields] = useState({
        adresse: '',
        pieceId: '',
        montant: '',
        moyenPaiement: 'Espèces / Wave',
        nouveauModele: '',
        etatFonctionnel: 'Non réparé / En l\'état'
    });

    const categories = useMemo(() => Array.from(new Set(TEMPLATES.map(t => t.category))), []);

    const filteredTickets = useMemo(() => {
        if (!searchQuery) return [];
        const low = searchQuery.toLowerCase();
        return tickets.filter(t => 
            t.client.name.toLowerCase().includes(low) || 
            t.id.toLowerCase().includes(low)
        ).slice(0, 5);
    }, [tickets, searchQuery]);

    const handleSelectTicket = (ticket: RepairTicket) => {
        setSelectedTicket(ticket);
        setClientType(ticket.client.isEnterprise ? 'SOCIETE' : 'PARTICULIER');
        setSearchQuery('');
        if (editingDoc) {
            setEditingDoc({
                ...editingDoc,
                recipientName: ticket.client.name.toUpperCase()
            });
        }
    };

    const handleApplyTemplate = (templateId: string) => {
        const t = TEMPLATES.find(x => x.id === templateId);
        if (t && editingDoc) {
            if (t.isSpecial) {
                setEditingDoc({
                    ...editingDoc,
                    title: t.title,
                    isSpecial: true,
                    specialType: t.specialType,
                    content: t.content[clientType],
                    recipientName: selectedTicket?.client.name.toUpperCase() || editingDoc.recipientName
                });
                return;
            }

            let content = t.content[clientType];
            
            if (selectedTicket) {
                content = content.replace(/\[NOM_CLIENT\]/g, selectedTicket.client.name.toUpperCase());
                content = content.replace(/\[NOM_SOCIETE\]/g, selectedTicket.client.name.toUpperCase());
                content = content.replace(/\[MODELE_MAC\]/g, `${selectedTicket.macBrand} ${selectedTicket.macModel}`.toUpperCase());
                content = content.replace(/\[SN\]/g, selectedTicket.serialNumber || 'NON PRÉCISÉ');
                content = content.replace(/\[ID_TICKET\]/g, selectedTicket.id);
                content = content.replace(/\[DATE_DEPOT\]/g, new Date(selectedTicket.createdAt).toLocaleDateString('fr-FR'));
                content = content.replace(/\[NOM_REPRESENTANT\]/g, selectedTicket.customFields?.deposantName || '....................');
                content = content.replace(/\[TELEPHONE_CLIENT\]/g, selectedTicket.client.phone);
            }

            content = content.replace(/\[ADRESSE_CLIENT\]/g, manualFields.adresse || '....................');
            content = content.replace(/\[ID_PIECE\]/g, manualFields.pieceId || '....................');
            content = content.replace(/\[MONTANT\]/g, manualFields.montant || '....................');
            content = content.replace(/\[MOYEN_PAIEMENT\]/g, manualFields.moyenPaiement);
            content = content.replace(/\[ETAT_FONCTIONNEL_OU_NON\]/g, manualFields.etatFonctionnel);
            content = content.replace(/\[DATE\]/g, new Date().toLocaleDateString('fr-FR'));

            setEditingDoc({
                ...editingDoc,
                title: t.title,
                content: content,
                isSpecial: false,
                recipientName: selectedTicket?.client.name.toUpperCase() || editingDoc.recipientName
            });
        }
    };

    const handleAiGeneration = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiGenerating(true);

        try {
            const response = await fetch("/api/gemini/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: `
                        Tu es un assistant juridique expert pour TGS-CI, une société de réparation informatique à Abidjan (Côte d'Ivoire).
                        Ton but est de rédiger un document juridique formel et professionnel (Contrat, Mise en demeure, Avenant, Décharge, etc.) basé sur la demande de l'utilisateur.
                        
                        Contexte TGS-CI:
                        - Activité: Réparation MacBook, Micro-soudure.
                        - Lieu: Abidjan, Cocody Faya.
                        - Juridiction: Droit Ivoirien / OHADA (implique un ton formel).
                        
                        Demande utilisateur : "${aiPrompt}"
                    `
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to generate content");
            }

            const data = await response.json();
            const text = data.text;
            if (!text) throw new Error("No text generated");
            const json = JSON.parse(text);

            setEditingDoc({
                title: json.title,
                content: json.content,
                date: new Date().toISOString().split('T')[0],
                recipientName: selectedTicket?.client.name.toUpperCase() || 'CLIENT / PARTENAIRE'
            });
            setIsAiModalOpen(false);
            setAiPrompt('');
            playTone(880, 100);

        } catch (error) {
            console.error("AI Generation Error:", error);
            showToast("Erreur lors de la génération par l'IA. Vérifiez votre connexion.", "error");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleJoinToDossier = async () => {
        if (!selectedTicket || !editingDoc?.content) return;
        setIsJoining(true);
        try {
            const updatedTicket: RepairTicket = {
                ...selectedTicket,
                history: [
                    ...selectedTicket.history,
                    { timestamp: new Date().toISOString(), user: 'Système', action: `Document archivé : ${editingDoc.title}` }
                ]
            };
            await updateTicket(updatedTicket);
            playTone(880, 200);
            showToast("Liaison historique effectuée.", "success");
        } finally {
            setIsJoining(false);
        }
    };

    const handleSave = async () => {
        if (!editingDoc?.content || !editingDoc?.title) return;
        if (editingDoc.id) await updateDocument(editingDoc as SimpleDocument);
        else await addDocument(editingDoc as Omit<SimpleDocument, 'id' | 'updatedAt'>);
        playTone(660, 150);
        setEditingDoc(null);
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-apple-surface/50 p-6 rounded-3xl border border-white/5 shadow-inner">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Console Juridique</h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Actes de cession, décharges et contrats TGS-CI</p>
                </div>
                {!editingDoc && (
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setIsAiModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-purple-900/40 transition-all"
                        >
                            <SparklesIcon className="w-5 h-5" /> Assistant IA
                        </button>
                        <button 
                            onClick={() => setEditingDoc({ title: '', content: '', date: new Date().toISOString().split('T')[0], recipientName: '' })} 
                            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-900/40 transition-all"
                        >
                            <PlusCircleIcon className="w-5 h-5"/> Créer un Acte
                        </button>
                    </div>
                )}
            </div>

            {editingDoc ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-slide-up">
                    <div className="lg:col-span-4 space-y-6">
                        <div className="apple-card p-6 border-blue-500/20">
                            <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4">1. Dossier Lié</h3>
                            {!selectedTicket ? (
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Chercher une fiche..."
                                        className="w-full p-3 bg-black/40 text-sm text-white rounded-xl border border-white/10 outline-none"
                                    />
                                    <MagnifyingGlassIcon className="absolute right-3 top-3 w-4 h-4 text-slate-600" />
                                    <div className="mt-2 space-y-1">
                                        {filteredTickets.map(t => (
                                            <button key={t.id} onClick={() => handleSelectTicket(t)} className="w-full text-left p-2.5 bg-white/5 hover:bg-blue-600/20 rounded-lg text-[10px] font-black uppercase text-white truncate border border-transparent hover:border-blue-500/20">#{t.id} - {t.client.name}</button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between bg-blue-600/10 p-3 rounded-xl border border-blue-500/30">
                                    <div>
                                        <p className="text-[10px] font-black text-white">#{selectedTicket.id}</p>
                                        <p className="text-[8px] text-slate-400 uppercase font-bold">{selectedTicket.client.name}</p>
                                    </div>
                                    <button onClick={() => setSelectedTicket(null)} className="text-[8px] font-black text-slate-500 hover:text-white uppercase">Changer</button>
                                </div>
                            )}
                        </div>

                        <div className="apple-card p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">2. Modèles & IA</h3>
                                <button onClick={() => setIsAiModalOpen(true)} className="p-2 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600 hover:text-white transition-all"><SparklesIcon className="w-4 h-4" /></button>
                            </div>
                            <div className="space-y-5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {categories.map(cat => (
                                    <div key={cat} className="space-y-1">
                                        <h4 className="text-[8px] font-black text-slate-500 uppercase mb-2 border-b border-white/5 pb-1">{cat}</h4>
                                        {TEMPLATES.filter(t => t.category === cat).map(t => (
                                            <button key={t.id} onClick={() => handleApplyTemplate(t.id)} className="w-full text-left p-2.5 bg-white/5 hover:bg-emerald-600/20 rounded-lg text-[10px] font-black uppercase text-slate-300 border border-transparent hover:border-emerald-500/20">{t.name}</button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="apple-card p-6 border-amber-500/20">
                            <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-4">3. Injection manuelle</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[8px] font-black text-slate-500 uppercase ml-1">Montant Transaction</label>
                                    <input value={manualFields.montant} onChange={e => setManualFields({...manualFields, montant: e.target.value})} className="w-full p-2 bg-black/40 border border-white/5 rounded-lg text-xs text-white" />
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-500 uppercase ml-1">État (Restitution)</label>
                                    <input value={manualFields.etatFonctionnel} onChange={e => setManualFields({...manualFields, etatFonctionnel: e.target.value})} className="w-full p-2 bg-black/40 border border-white/5 rounded-lg text-xs text-white" />
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-500 uppercase ml-1">Adresse Client</label>
                                    <input value={manualFields.adresse} onChange={e => setManualFields({...manualFields, adresse: e.target.value})} className="w-full p-2 bg-black/40 border border-white/5 rounded-lg text-xs text-white" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                        <div className="flex flex-wrap gap-2">
                             <button onClick={() => setEditingDoc(null)} className="px-6 py-3 bg-white/5 text-slate-400 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:text-white">Annuler</button>
                             <button onClick={() => setIsPreviewOpen(true)} className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/10 flex items-center justify-center gap-2">
                                <PrinterIcon className="w-4 h-4"/> Aperçu / Imprimer
                             </button>
                             {selectedTicket && (
                                <button onClick={handleJoinToDossier} disabled={isJoining} className="px-6 py-3 bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl hover:bg-indigo-500 flex items-center gap-2">
                                    <ClipboardDocumentCheckIcon className="w-4 h-4"/> Lier Historique
                                </button>
                             )}
                             <button onClick={handleSave} className="px-10 py-3 bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl hover:bg-blue-500 transition-all">Archiver Document</button>
                        </div>

                        <div className="apple-card p-10 bg-black/20 space-y-6 shadow-3xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <input type="text" value={editingDoc.title} onChange={(e) => setEditingDoc({...editingDoc, title: e.target.value.toUpperCase()})} placeholder="TITRE OFFICIEL DE L'ACTE" className="w-full p-4 bg-black/60 text-white font-black rounded-xl border border-white/10 outline-none" />
                                <input type="date" value={editingDoc.date} onChange={(e) => setEditingDoc({...editingDoc, date: e.target.value})} className="w-full p-4 bg-black/60 text-white font-mono rounded-xl border border-white/10 outline-none" />
                            </div>
                            {editingDoc.isSpecial && editingDoc.specialType === 'validation' ? (
                                <div className="p-10 bg-white/5 rounded-[40px] border border-white/10 text-center flex flex-col items-center justify-center min-h-[400px]">
                                    <ClipboardDocumentCheckIcon className="w-20 h-20 text-emerald-500 mb-6" />
                                    <h3 className="text-xl font-black text-white uppercase mb-2">Fiche Technique Interactive</h3>
                                    <p className="text-slate-400 max-w-md">Ce document est un formulaire structuré (Checklist). Il ne peut pas être édité comme du texte libre. Utilisez le bouton "Aperçu / Imprimer" pour générer la grille de validation.</p>
                                </div>
                            ) : (
                                <textarea value={editingDoc.content} onChange={(e) => setEditingDoc({...editingDoc, content: e.target.value})} rows={25} className="w-full p-10 bg-black/60 text-slate-200 rounded-[40px] border border-white/10 outline-none font-serif text-lg leading-relaxed shadow-inner" />
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="apple-card overflow-hidden">
                    <div className="p-4 bg-white/5 border-b border-white/10">
                        <div className="relative">
                            <input type="text" placeholder="Chercher dans les actes archivés..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-4 bg-black/40 text-sm text-white rounded-2xl border border-white/10 outline-none pl-12" />
                            <MagnifyingGlassIcon className="absolute left-4 top-4.5 w-5 h-5 text-slate-600" />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                         <table className="w-full text-left text-sm">
                            <thead className="text-[10px] font-black uppercase bg-black/40 text-slate-500 tracking-widest border-b border-white/10">
                                <tr>
                                    <th className="px-8 py-5">Sujet / Acte</th>
                                    <th className="px-8 py-5">Titulaire</th>
                                    <th className="px-8 py-5">Date</th>
                                    <th className="px-8 py-5 text-center">Gestion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {documents.filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()) || (d.recipientName || '').toLowerCase().includes(searchQuery.toLowerCase())).map(doc => (
                                    <tr key={doc.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-8 py-5"><p className="font-black text-white uppercase tracking-tight">{doc.title}</p></td>
                                        <td className="px-8 py-5"><p className="text-[10px] font-bold text-slate-400 uppercase">{doc.recipientName || 'ANONYME'}</p></td>
                                        <td className="px-8 py-5 text-slate-400 font-mono text-xs">{new Date(doc.date).toLocaleDateString('fr-FR')}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100">
                                                <button onClick={() => setEditingDoc(doc)} className="p-2.5 bg-white/5 hover:bg-blue-600 rounded-xl transition-all shadow-lg"><PencilIcon className="w-4 h-4"/></button>
                                                <button onClick={() => setDocToDelete(doc)} className="p-2.5 bg-white/5 hover:bg-red-600 rounded-xl transition-all shadow-lg"><TrashIcon className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} containerClassName="bg-slate-900 border border-purple-500/30 rounded-3xl shadow-2xl w-full max-w-2xl m-4 p-8">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-500/30">
                        <SparklesIcon className="w-8 h-8 text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Assistant Juridique IA</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Décrivez votre besoin spontané, l'IA rédige pour vous.</p>
                </div>
                
                <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Exemple: Rédige une mise en demeure pour le client X qui n'a pas payé sa facture depuis 3 mois. Ton ferme mais courtois."
                    className="w-full h-40 p-4 bg-black/40 border border-white/10 rounded-2xl text-white outline-none focus:border-purple-500 transition-all resize-none mb-6"
                />

                <div className="flex justify-end gap-3">
                    <button onClick={() => setIsAiModalOpen(false)} className="px-6 py-3 text-slate-500 hover:text-white uppercase font-black text-[10px] tracking-widest">Annuler</button>
                    <button 
                        onClick={handleAiGeneration}
                        disabled={isAiGenerating || !aiPrompt.trim()}
                        className="flex items-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-purple-900/40 transition-all disabled:opacity-50"
                    >
                        {isAiGenerating ? <ArrowPathIcon className="w-4 h-4 animate-spin"/> : <SparklesIcon className="w-4 h-4"/>}
                        {isAiGenerating ? 'Rédaction...' : 'Générer le Document'}
                    </button>
                </div>
            </Modal>

            <PreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} fileName={`ACTE_TGS_${editingDoc?.title?.replace(/\s/g, '_')}.pdf`}>
                {editingDoc && (
                    editingDoc.isSpecial && editingDoc.specialType === 'validation' && selectedTicket 
                    ? <PrintableValidationSheet ticket={selectedTicket} />
                    : <PrintableSimpleDocument title={editingDoc.title || ''} content={editingDoc.content || ''} date={editingDoc.date} recipientName={editingDoc.recipientName} />
                )}
            </PreviewModal>

            <ConfirmationModal isOpen={!!docToDelete} onClose={() => setDocToDelete(null)} onConfirm={() => { if(docToDelete) deleteDocument(docToDelete.id); setDocToDelete(null); }} title="Supprimer l'acte ?" message={`Effacer définitivement ce document juridique de vos archives ?`} />
        </div>
    );
};

export default SimpleDocumentGenerator;
