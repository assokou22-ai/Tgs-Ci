
import React, { useState, useEffect, useRef } from 'react';
import { RepairTicket, RepairStatus, RepairServiceItem } from '../types.ts';
import { mergeUpdates } from '../utils/merge.ts';
import { MacbookIcon, BuildingStorefrontIcon, BanknotesIcon, PlusIcon, SparklesIcon, TrashIcon, DocumentArrowDownIcon } from './icons.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableTicket from './PrintableTicket.tsx';
import PrintableEnterpriseBon from './PrintableEnterpriseBon.tsx';
import SignaturePad from './SignaturePad.tsx';
import { playTone } from '../utils/audio.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { generateNextTicketSequence, isFallbackTicketId } from '../utils/idGenerator.ts';

interface EnterpriseRepairFormProps {
  tickets: RepairTicket[];
  ticketToEdit?: RepairTicket | null;
  onSave: (ticket: Partial<RepairTicket>, action: 'new' | 'close' | 'print', oldId?: string) => Promise<RepairTicket | void>;
  onCancel: () => void;
}

const EnterpriseRepairForm: React.FC<EnterpriseRepairFormProps> = ({ tickets, ticketToEdit, onSave, onCancel }) => {
  const { showToast } = useToastContext();
  const isEditMode = !!ticketToEdit;
  
  const [ticket, setTicket] = useState<Partial<RepairTicket>>({
    status: RepairStatus.A_DIAGNOSTIQUER,
    client: { name: '', phone: '', email: '', isEnterprise: true, customFields: {} },
    macBrand: 'APPLE',
    macModel: '',
    macColor: '',
    problemDescription: '',
    powersOn: false,
    powerOnStatus: 'non',
    chargerIncluded: false,
    bagIncluded: false,
    bagDescription: '',
    costs: { diagnostic: 5000, repair: 0, advance: 0 },
    services: [],
    history: [],
    attachments: [],
    isReIntervention: false,
    customFields: {
        exitBonRef: '',
        deposantName: '',
        deposantFunction: '',
        bonEmissionDate: new Date().toISOString().split('T')[0],
        powerOnDetails: '',
        constatsParticuliers: '',
        diagnostic: '',
        chargerWatts: '',
        hasCable: 'non',
        diagAccepted: 'false',
        devisAccepted: 'false',
        luEtApprouve: '',
        machineBrand: 'Apple',
        modelA: '',
        rccm: '',
        compteContribuable: '',
        poRef: '',
        screenBroken: 'non',
        traceChoc: 'non',
        traceLiquid: 'non',
        keyboardDamaged: 'non',
        missingScrews: 'non',
        foundScrewsCount: ''
    },
    ...(ticketToEdit || {})
  });

  const lastUpdatedAtRef = useRef<string | undefined>(ticketToEdit?.updatedAt);

  useEffect(() => {
    if (ticketToEdit && ticketToEdit.id === ticket.id) {
      if (ticketToEdit.updatedAt !== lastUpdatedAtRef.current) {
        lastUpdatedAtRef.current = ticketToEdit.updatedAt;
        setTicket(prev => {
          const merged = mergeUpdates('ticket', prev as RepairTicket, ticketToEdit);
          return merged;
        });
        showToast("Mise à jour simultanée : Les modifications apportées par un autre technicien ont été intégrées en temps réel.", "info");
      }
    }
  }, [ticketToEdit, ticket.id, showToast]);

  const [quickServiceName, setQuickServiceName] = useState('');
  const [quickServicePrice, setQuickServicePrice] = useState('');
  const [fullTicketId, setFullTicketId] = useState<string>(() => {
    if (ticketToEdit?.id) return ticketToEdit.id;
    return generateNextTicketSequence(tickets, true);
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const signaturePadRef = useRef<{ getSignature: () => string }>(null);

  const getPreviewTicket = (): RepairTicket => {
    const signature = signaturePadRef.current?.getSignature() || ticket.clientSignature;
    const servicesSum = ticket.services?.reduce((sum, s) => sum + s.price, 0) || 0;
    const currentId = (fullTicketId && fullTicketId.trim()) || ticketToEdit?.id || 'NOUVEAU';
    
    return {
      ...ticket,
      id: currentId,
      modelNumber: ticket.customFields?.modelA || ticket.modelNumber,
      costs: {
        diagnostic: ticket.costs?.diagnostic || 0,
        repair: servicesSum,
        advance: ticket.costs?.advance || 0
      },
      createdAt: ticketToEdit?.createdAt || new Date().toISOString(),
      clientSignature: signature,
      history: ticket.history || [],
      client: {
        name: ticket.client?.name || '',
        phone: ticket.client?.phone || '',
        email: ticket.client?.email || '',
        id: ticket.client?.id || '',
        isEnterprise: true,
        customFields: ticket.client?.customFields || {}
      }
    } as RepairTicket;
  };

  useEffect(() => {
    if (!isEditMode) {
      const nextSeq = generateNextTicketSequence(tickets, true);
      setFullTicketId(nextSeq);
    }
  }, [tickets, isEditMode]);

  const handleQuickAddService = () => {
    const price = parseInt(quickServicePrice);
    if (quickServiceName && !isNaN(price)) {
        const newService: RepairServiceItem = {
            id: `svc-${Date.now()}`,
            updatedAt: new Date().toISOString(),
            name: quickServiceName.toUpperCase(),
            price: price,
            category: 'Prestation Entreprise'
        };
        const updatedServices = [...(ticket.services || []), newService];
        setTicket(p => ({ 
            ...p, 
            services: updatedServices,
            costs: { ...p.costs!, repair: updatedServices.reduce((sum, s) => sum + s.price, 0) }
        }));
        setQuickServiceName('');
        setQuickServicePrice('');
    }
  };

  const handleSave = async (action: 'new' | 'close' | 'print') => {
    if (!ticket.client?.name || !ticket.customFields?.deposantName) {
        showToast("Nom de l'entreprise et déposant requis.", "warning");
        return;
    }
    if (!isEditMode && ticket.customFields?.luEtApprouve?.toLowerCase() !== 'lu et approuvé') {
        showToast("Veuillez saisir 'Lu et approuvé' avant de signer.", "warning");
        return;
    }
    
    setIsSaving(true);
    try {
        const signature = signaturePadRef.current?.getSignature() || ticket.clientSignature;
        let cleanId = fullTicketId.trim().toUpperCase();
        if (!cleanId || (!isEditMode && isFallbackTicketId(cleanId))) {
            cleanId = generateNextTicketSequence(tickets, true);
            setFullTicketId(cleanId);
        }

        const finalTicket = {
            ...ticket,
            id: cleanId,
            modelNumber: ticket.customFields?.modelA || ticket.modelNumber,
            clientSignature: signature,
            createdAt: ticketToEdit ? ticketToEdit.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        if (ticket.isReIntervention && !ticketToEdit?.isReIntervention) {
             finalTicket.history = [
                 ...(finalTicket.history || []),
                 { timestamp: new Date().toISOString(), user: 'Accueil', action: "Marqué comme RÉ-INTERVENTION ENTREPRISE." }
             ];
         }
        
        await onSave(finalTicket, action, ticketToEdit?.id);
        playTone(880, 150);
    } catch (err) {
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const totalCalculated = (ticket.costs?.diagnostic || 0) + (ticket.services?.reduce((sum, s) => sum + s.price, 0) || 0);

  const inputStyle = "w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-bold outline-none focus:border-purple-500 transition-all";
  const labelStyle = "block text-[9px] font-black text-slate-500 uppercase mb-1 ml-1 tracking-widest";
  const sectionTitle = "text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3";

  return (
    <div className="space-y-6 animate-fade-in pb-20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-apple-surface p-6 rounded-[32px] border border-white/10 glass shadow-2xl sticky top-20 z-40">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-600 rounded-2xl shadow-lg">
                    <BuildingStorefrontIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">Fiche Entreprise</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID Dossier :</p>
                        <input
                            type="text"
                            value={fullTicketId}
                            onChange={(e) => setFullTicketId(e.target.value.toUpperCase())}
                            className="bg-black/40 border border-white/10 rounded-lg px-2 py-0.5 font-mono text-purple-400 font-bold text-xs uppercase focus:border-purple-500 outline-none w-32"
                        />
                        {!isEditMode && (
                            <button
                                type="button"
                                onClick={() => {
                                    const next = generateNextTicketSequence(tickets, true);
                                    setFullTicketId(next);
                                    showToast(`Numéro Entreprise régénéré : ${next}`, "info");
                                }}
                                className="text-[10px] font-bold text-slate-400 hover:text-purple-400"
                                title="Régénérer automatique"
                            >
                                🔄
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <button type="button" onClick={() => setIsPreviewOpen(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-purple-900/40 flex items-center gap-1.5">
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    <span>Export PDF Rapide</span>
                </button>
                <button onClick={onCancel} className="px-6 py-3 text-slate-400 hover:text-white uppercase font-black text-[10px] tracking-widest">Annuler</button>
                <button onClick={() => handleSave('close')} disabled={isSaving} className="px-6 py-3 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Enregistrer</button>
                <button onClick={() => handleSave('print')} disabled={isSaving} className="px-8 py-3 bg-purple-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/40">Enregistrer & Imprimer</button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
                {/* 1. RÉFÉRENCES & SOCIÉTÉ */}
                <div className="apple-card p-8 bg-white/[0.02]">
                    <h3 className={sectionTitle}><BuildingStorefrontIcon className="w-5 h-5"/> Entité Entreprise</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 flex items-center justify-between">
                            <div className="flex-1 mr-6">
                                <label className={labelStyle}>Nom de l'entreprise *</label>
                                <input placeholder="RAISON SOCIALE" value={ticket.client?.name} onChange={e => setTicket({...ticket, client: {...ticket.client!, name: e.target.value.toUpperCase()}})} className={inputStyle} />
                            </div>
                            <div className="w-48">
                                <label className="flex items-center gap-3 p-3 bg-red-600/5 border border-red-500/20 rounded-xl cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={ticket.isReIntervention} 
                                        onChange={e => setTicket({...ticket, isReIntervention: e.target.checked})}
                                        className="w-5 h-5 accent-red-600"
                                    />
                                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-tight">Retour SAV</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>Nom du Déposant / Représentant *</label>
                            <input placeholder="NOM Prénom" value={ticket.customFields?.deposantName} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, deposantName: e.target.value}})} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Fonction du Déposant *</label>
                            <input placeholder="ex: Responsable IT, Gérant, Comptable..." value={ticket.customFields?.deposantFunction} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, deposantFunction: e.target.value}})} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Téléphone contact direct *</label>
                            <input placeholder="ex: 07 00 00 00 00" value={ticket.client?.phone} onChange={e => setTicket({...ticket, client: {...ticket.client!, phone: e.target.value}})} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Email de l'entreprise / Contact</label>
                            <input placeholder="ex: contact@entreprise.com" value={ticket.client?.email} onChange={e => setTicket({...ticket, client: {...ticket.client!, email: e.target.value}})} className={inputStyle} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Numéro pour notifications SMS</label>
                            <div className="flex items-center gap-2">
                                {!ticket.client?.useWhatsAppForSms && (
                                    <input 
                                        placeholder="07 XX XX XX XX" 
                                        value={ticket.client?.smsPhone || ''} 
                                        onChange={e => setTicket(p => ({...p, client: {...p.client!, smsPhone: e.target.value}}))} 
                                        className="flex-1 p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-mono font-bold outline-none focus:border-purple-500 transition-all" 
                                    />
                                )}
                                <label className={`flex items-center gap-2 p-3 ${ticket.client?.useWhatsAppForSms ? 'bg-purple-500/10 border-purple-500/30' : 'bg-black/20 border-white/5'} border rounded-xl cursor-pointer transition-all flex-1`}>
                                    <input 
                                        type="checkbox" 
                                        checked={ticket.client?.useWhatsAppForSms || false} 
                                        onChange={e => {
                                            const useWA = e.target.checked;
                                            setTicket(p => ({
                                                ...p, 
                                                client: {
                                                    ...p.client!, 
                                                    useWhatsAppForSms: useWA,
                                                    smsPhone: useWA ? p.client!.phone : ''
                                                }
                                            }));
                                        }}
                                        className="w-4 h-4 accent-purple-500"
                                    />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Idem Contact</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>N° Bon de Commande / PO Interne</label>
                            <input placeholder="Réf. Commande Entreprise" value={ticket.customFields?.poRef} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, poRef: e.target.value.toUpperCase()}})} className={inputStyle + " font-mono text-purple-400"} />
                        </div>
                        <div>
                            <label className={labelStyle}>Registre du Commerce (RCCM)</label>
                            <input placeholder="ex: CI-ABJ-01-XXXX-X" value={ticket.customFields?.rccm} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, rccm: e.target.value.toUpperCase()}})} className={inputStyle + " font-mono"} />
                        </div>
                        <div>
                            <label className={labelStyle}>Compte Contribuable (N° CC)</label>
                            <input placeholder="ex: 1234567 X" value={ticket.customFields?.compteContribuable} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, compteContribuable: e.target.value.toUpperCase()}})} className={inputStyle + " font-mono"} />
                        </div>
                    </div>
                </div>
                {/* ... suite du formulaire identique ... */}
                {/* 2. IDENTIFICATION MATÉRIEL */}
                <div className="apple-card p-8">
                    <h3 className={sectionTitle}><MacbookIcon className="w-5 h-5"/> Identification Matériel</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className={labelStyle}>Modèle (AXXXX) *</label>
                            <input value={ticket.customFields?.modelA} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, modelA: e.target.value.toUpperCase()}})} placeholder="ex: A2338" className={inputStyle + " font-mono"} />
                        </div>
                        <div>
                            <label className={labelStyle}>Nom Modèle Commercial *</label>
                            <input value={ticket.macModel} onChange={e => setTicket({...ticket, macModel: e.target.value.toUpperCase()})} placeholder="ex: MACBOOK PRO 14" className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Couleur *</label>
                            <input list="enterprise-colors-list" value={ticket.macColor} onChange={e => setTicket({...ticket, macColor: e.target.value.toUpperCase()})} placeholder="ex: SILVER, BLUSH, CITRUS..." className={inputStyle} />
                            <datalist id="enterprise-colors-list">
                                <option value="SILVER" />
                                <option value="BLUSH" />
                                <option value="CITRUS" />
                                <option value="INDIGO" />
                                <option value="GRIS SIDÉRAL" />
                                <option value="ARGENT" />
                                <option value="MINUIT" />
                                <option value="LUMIÈRE STELLAIRE" />
                                <option value="NOIR SIDÉRAL" />
                                <option value="OR" />
                            </datalist>
                        </div>
                        <div className="md:col-span-3">
                            <label className={labelStyle}>Numéro de série (S/N)</label>
                            <input placeholder="S/N" value={ticket.serialNumber} onChange={e => setTicket({...ticket, serialNumber: e.target.value.toUpperCase()})} className={inputStyle + " font-mono text-blue-400"} />
                        </div>
                    </div>
                </div>
                {/* 3. ÉTAT TECHNIQUE DÉTAILLÉ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="apple-card p-8 bg-purple-600/5">
                        <h3 className={sectionTitle}><SparklesIcon className="w-5 h-5"/> S'allume : État</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                                <label className="text-[10px] font-black uppercase text-slate-300">Machine s'allume ?</label>
                                <input type="checkbox" checked={ticket.powersOn} onChange={e => setTicket({...ticket, powersOn: e.target.checked})} className="w-6 h-6 accent-purple-500" />
                            </div>
                            
                            {ticket.powersOn && (
                                <div className="space-y-3 animate-fade-in">
                                    <label className={labelStyle}>Préciser le comportement</label>
                                    <select 
                                        value={ticket.customFields?.powerOnDetails} 
                                        onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, powerOnDetails: e.target.value}})}
                                        className={inputStyle}
                                    >
                                        <option value="">-- Sélectionner l'état --</option>
                                        <option value="Charge le bureau">Charge le bureau</option>
                                        <option value="Redémarre sans arrêt">Redémarre sans arrêt</option>
                                        <option value="S'allume et s'éteint sans charger le système">S'allume et s'éteint sans charger</option>
                                        <option value="Écran cassé - Aucune visibilité possible">Écran cassé - Aucune visibilité possible</option>
                                        <option value="Autre">Préciser autre problème...</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="apple-card p-8">
                        <h3 className={sectionTitle}><PlusIcon className="w-5 h-5"/> Accessoires Reçus</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">Chargeur</span>
                                    <input type="checkbox" checked={ticket.chargerIncluded} onChange={e => setTicket({...ticket, chargerIncluded: e.target.checked})} className="accent-purple-500" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                                <span className="text-[10px] font-bold text-slate-300 uppercase">Câble d'alimentation</span>
                                <input type="checkbox" checked={ticket.customFields?.hasCable === 'oui'} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, hasCable: e.target.checked ? 'oui' : 'non'}})} className="accent-purple-500" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">Sac / Housse</span>
                                    <input type="checkbox" checked={ticket.bagIncluded} onChange={e => setTicket({...ticket, bagIncluded: e.target.checked})} className="accent-purple-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. INSPECTION PHYSIQUE & VISUELLE B2B (Logique Juridique & Protection) */}
                <div className="apple-card p-8 bg-white/[0.02]">
                    <h3 className={sectionTitle}>🔍 Inspection Physique de l'Appareil (Protection Atelier & Client)</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6 -mt-3">
                        Ces constats visuels engagent l'entreprise et la déchargent de toute réclamation sur des défauts préexistants.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="flex items-center justify-between p-3.5 bg-black/30 border border-white/5 rounded-xl">
                            <div>
                                <span className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">Écran Cassé / Fissuré</span>
                                <span className="text-[8px] text-slate-500 font-bold uppercase">Défaut d'affichage, rayures majeures</span>
                            </div>
                            <select 
                                value={ticket.customFields?.screenBroken || 'non'} 
                                onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, screenBroken: e.target.value}})}
                                className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-black"
                            >
                                <option value="non">NON</option>
                                <option value="oui">OUI</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between p-3.5 bg-black/30 border border-white/5 rounded-xl">
                            <div>
                                <span className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">Traces de Chocs / Déformation</span>
                                <span className="text-[8px] text-slate-500 font-bold uppercase">Coins enfoncés, châssis tordu</span>
                            </div>
                            <select 
                                value={ticket.customFields?.traceChoc || 'non'} 
                                onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, traceChoc: e.target.value}})}
                                className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-black"
                            >
                                <option value="non">NON</option>
                                <option value="oui">OUI</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between p-3.5 bg-black/30 border border-white/5 rounded-xl">
                            <div>
                                <span className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">Traces de Liquide / Oxydation</span>
                                <span className="text-[8px] text-slate-500 font-bold uppercase">Indicateurs de contact liquide actifs</span>
                            </div>
                            <select 
                                value={ticket.customFields?.traceLiquid || 'non'} 
                                onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, traceLiquid: e.target.value}})}
                                className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-black"
                            >
                                <option value="non">NON</option>
                                <option value="oui">OUI</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between p-3.5 bg-black/30 border border-white/5 rounded-xl">
                            <div>
                                <span className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">Clavier / Trackpad HS</span>
                                <span className="text-[8px] text-slate-500 font-bold uppercase">Touches manquantes ou bloquées</span>
                            </div>
                            <select 
                                value={ticket.customFields?.keyboardDamaged || 'non'} 
                                onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, keyboardDamaged: e.target.value}})}
                                className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-black"
                            >
                                <option value="non">NON</option>
                                <option value="oui">OUI</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-3 p-3.5 bg-black/30 border border-white/5 rounded-xl sm:col-span-2">
                            <div className="flex items-center justify-between w-full">
                                <div>
                                    <span className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">Vis de capot manquantes sous le châssis</span>
                                    <span className="text-[8px] text-slate-500 font-bold uppercase">Appareil déjà ouvert par un tiers ou choc antérieur</span>
                                </div>
                                <select 
                                    value={ticket.customFields?.missingScrews || 'non'} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        setTicket({
                                            ...ticket, 
                                            customFields: {
                                                ...ticket.customFields, 
                                                missingScrews: val,
                                                foundScrewsCount: val === 'non' ? '' : (ticket.customFields?.foundScrewsCount || '')
                                            }
                                        });
                                    }}
                                    className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-black"
                                >
                                    <option value="non">NON (Toutes présentes)</option>
                                    <option value="oui">OUI (Une ou plusieurs vis manquantes)</option>
                                </select>
                            </div>
                            {ticket.customFields?.missingScrews === 'oui' && (
                                <div className="mt-2 pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <span className="block text-[10px] font-black text-purple-400 uppercase tracking-wider">Préciser le nombre de vis trouvées sous le châssis *</span>
                                        <span className="text-[8px] text-slate-400 font-bold uppercase">Saisissez le nombre ou la description (ex: "6 vis trouvées")</span>
                                    </div>
                                    <input 
                                        type="text"
                                        placeholder="ex: 6 vis trouvées"
                                        value={ticket.customFields?.foundScrewsCount || ''}
                                        onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, foundScrewsCount: e.target.value}})}
                                        className="bg-purple-900/40 text-xs text-purple-200 py-1.5 px-3 rounded-lg border border-purple-500/20 outline-none font-bold w-full sm:w-64 focus:border-purple-500 transition-all placeholder:text-purple-300/40"
                                        required={ticket.customFields?.missingScrews === 'oui'}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="apple-card p-8 space-y-6">
                    <div>
                        <h3 className={sectionTitle}>📜 Problème signalé par le client</h3>
                        <textarea rows={3} value={ticket.problemDescription} onChange={e => setTicket({...ticket, problemDescription: e.target.value})} className={inputStyle + " font-normal resize-none"} placeholder="Détails des symptômes..." />
                    </div>
                </div>

                <div className="apple-card p-8 bg-purple-600/5 border-purple-500/20">
                    <h3 className={sectionTitle}><BanknotesIcon className="w-5 h-5"/> Coût de la prestation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className={labelStyle}>Forfait Expertise / Diagnostic (F CFA)</label>
                            <input 
                                type="number" 
                                value={ticket.costs?.diagnostic} 
                                onChange={e => setTicket({...ticket, costs: {...ticket.costs!, diagnostic: Number(e.target.value)}})} 
                                className={inputStyle + " text-blue-400 font-mono text-lg"} 
                            />
                        </div>
                        <div className="bg-black/20 p-4 rounded-2xl flex flex-col items-end justify-center">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Cumulé (Diag + Services)</p>
                            <p className="text-3xl font-black text-white font-mono">{totalCalculated.toLocaleString()} F</p>
                        </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                        {ticket.services?.length ? ticket.services.map((s, i) => (
                            <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-purple-500/20 transition-all">
                                <div className="flex-1 mr-4">
                                    <span className="text-xs font-black text-white uppercase">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-mono font-black text-purple-400">{s.price.toLocaleString()} F</span>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const updatedServices = ticket.services?.filter((_, idx) => idx !== i) || [];
                                            setTicket(p => ({ 
                                                ...p, 
                                                services: updatedServices,
                                                costs: { ...p.costs!, repair: updatedServices.reduce((sum, s) => sum + s.price, 0) }
                                            }));
                                        }} 
                                        className="p-2 text-red-500 hover:bg-red-600/20 rounded-xl transition-all"
                                    >
                                        <TrashIcon className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="py-6 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-20">
                                <p className="text-[10px] font-black uppercase italic">Aucune prestation chiffrée</p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 p-2 bg-black/40 rounded-2xl border border-white/5">
                        <input placeholder="Libellé prestation..." value={quickServiceName} onChange={e => setQuickServiceName(e.target.value)} className="flex-1 bg-transparent px-4 py-2 text-xs text-white outline-none font-bold" />
                        <input type="number" placeholder="Prix" value={quickServicePrice} onChange={e => setQuickServicePrice(e.target.value)} className="w-24 bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono text-center" />
                        <button onClick={handleQuickAddService} className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-500 transition-all"><PlusIcon className="w-5 h-5"/></button>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
                <div className="apple-card p-6 bg-yellow-600/5 border border-yellow-500/20">
                    <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-4">Acceptations & Clauses B2B</h3>
                    
                    {/* Rappel des conditions légales */}
                    <div className="p-3.5 bg-black/40 border border-yellow-500/10 rounded-xl space-y-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-6">
                        <div className="flex gap-2">
                            <span className="text-yellow-500">✔</span>
                            <p><span className="text-white">Habilitation :</span> Le déposant certifie engager juridiquement l'entreprise pour cette intervention.</p>
                        </div>
                        <div className="flex gap-2">
                            <span className="text-yellow-500">✔</span>
                            <p><span className="text-white">Garantie Apple :</span> L'ouverture matérielle annule définitivement la garantie constructeur d'origine.</p>
                        </div>
                        <div className="flex gap-2">
                            <span className="text-yellow-500">✔</span>
                            <p><span className="text-white">Données (SSD) :</span> La sauvegarde incombe exclusivement au client (puces SSD soudées).</p>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        <label className="flex items-start gap-3 p-3 bg-black/40 rounded-xl cursor-pointer border border-white/5 hover:border-purple-500/30 transition-all">
                            <input type="checkbox" checked={ticket.customFields?.diagAccepted === 'true'} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, diagAccepted: e.target.checked ? 'true' : 'false'}})} className="mt-1 w-4 h-4 accent-purple-500" />
                            <span className="text-[10px] font-bold text-slate-300 uppercase leading-tight">Diagnostic 5 000 F accepté</span>
                        </label>
                        <label className="flex items-start gap-3 p-3 bg-black/40 rounded-xl cursor-pointer border border-white/5 hover:border-purple-500/30 transition-all">
                            <input type="checkbox" checked={ticket.customFields?.devisAccepted === 'true'} onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, devisAccepted: e.target.checked ? 'true' : 'false'}})} className="mt-1 w-4 h-4 accent-purple-500" />
                            <span className="text-[10px] font-bold text-slate-300 uppercase leading-tight">Conditions Générales B2B acceptées</span>
                        </label>
                    </div>

                    <div className="space-y-4">
                        {!isEditMode && (
                            <>
                                <div>
                                    <label className={labelStyle}>Taper "Lu et approuvé" pour signer</label>
                                    <input 
                                        value={ticket.customFields?.luEtApprouve} 
                                        onChange={e => setTicket({...ticket, customFields: {...ticket.customFields, luEtApprouve: e.target.value}})}
                                        placeholder="..." 
                                        className={inputStyle + " text-center italic"} 
                                    />
                                </div>
                                <div className={`bg-black/40 rounded-2xl border-2 transition-all ${ticket.customFields?.luEtApprouve?.toLowerCase() === 'lu et approuvé' ? 'border-purple-500' : 'border-white/5 opacity-30 pointer-events-none'}`}>
                                    <SignaturePad ref={signaturePadRef} />
                                </div>
                            </>
                        )}
                        {isEditMode && ticket.clientSignature && (
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center">
                                <p className="text-[8px] font-black uppercase text-slate-500 mb-2">Signature du dépôt enregistrée</p>
                                <img src={ticket.clientSignature} className="max-h-20 opacity-60" alt="Signature client" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {isPreviewOpen && (
            <PreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} fileName={`bon_entreprise_rapide_${getPreviewTicket().id}.pdf`}>
                <div className="flex flex-col text-black">
                    <PrintableTicket ticket={getPreviewTicket()} />
                    <PrintableEnterpriseBon ticket={getPreviewTicket()} />
                </div>
            </PreviewModal>
        )}
    </div>
  );
};

export default EnterpriseRepairForm;
