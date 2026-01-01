
import React, { useState, useEffect, useRef } from 'react';
import { RepairTicket, Costs, Client, RepairServiceItem, RepairStatus, Role, DiagnosticCheck } from '../types.ts';
import SignaturePad from './SignaturePad.tsx';
import { getSuggestions, addSuggestion } from '../services/suggestionService.ts';
import AiCorrectionButton from './AiCorrectionButton.tsx';
import AiPriceSuggestion from './AiPriceSuggestion.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { PlusIcon, TrashIcon, ExclamationTriangleIcon, PencilIcon, MacbookIcon, UserIcon, WrenchScrewdriverIcon, BanknotesIcon, PrinterIcon, ClockIcon, ShieldCheckIcon, CloudArrowDownIcon } from './icons.tsx';
import { playTone } from '../utils/audio.ts';

interface RepairFormProps {
  tickets: RepairTicket[];
  ticketToEdit?: RepairTicket | null;
  onSave: (ticket: Partial<RepairTicket>, action: 'new' | 'close' | 'print', oldId?: string) => Promise<RepairTicket | void>;
  onCancel: () => void;
  role: Role;
}

const MANDATORY_COMPONENTS = [
  'Écran', 'Clavier', 'Trackpad', 'Batterie', 'Wi-Fi / BT', 'Ports USB-C', 'Haut-parleurs', 'Webcam / Micro', 'Touch Bar / ID', 'SSD'
];

const MACBOOK_MODELS = [
  'A1278', 'A1286', 'A1465', 'A1466', 'A1398', 'A1502', 'A1534', 'A1706', 'A1707', 'A1708', 
  'A1932', 'A1989', 'A1990', 'A2141', 'A2159', 'A2179', 'A2251', 'A2289', 'A2337', 'A2338', 
  'A2442', 'A2485', 'A2681', 'A2779', 'A2780', 'A2941', 'A2991', 'A2992'
];

const initialTicketState: Partial<RepairTicket> = {
  status: RepairStatus.A_DIAGNOSTIQUER,
  client: { name: '', phone: '', email: '', id: '' },
  macBrand: 'APPLE',
  macModel: '',
  problemDescription: '',
  estimatedWorkDelay: '',
  costs: { diagnostic: 0, repair: 0, advance: 0 },
  powersOn: true,
  chargerIncluded: false,
  batteryFunctional: 'unknown',
  warrantyVoidAgreed: true,
  dataBackupAck: true,
  multimediaEnabled: false,
  printDiagnosticIntegrated: false,
  services: [],
  history: [],
  diagnosticReport: MANDATORY_COMPONENTS.map(c => ({ component: c, status: 'Non testé', notes: '' })),
  customFields: {},
};

const RepairForm: React.FC<RepairFormProps> = ({ tickets, ticketToEdit, onSave, onCancel, role }) => {
  const [ticket, setTicket] = useState<Partial<RepairTicket>>({
    ...initialTicketState,
    ...(ticketToEdit || {})
  });
  
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const prefix = `${currentYear}-RM-`;
  
  const [sequence, setSequence] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const signaturePadRef = useRef<{ getSignature: () => string; clear: () => void }>(null);

  useEffect(() => {
    if (ticketToEdit) {
        const parts = ticketToEdit.id.split('-RM-');
        setSequence(parts[1] || '');
    } else {
        let maxCounter = 0;
        tickets.forEach(t => {
            if (t.id && t.id.startsWith(prefix)) {
                const parts = t.id.split('-RM-');
                const numPart = parseInt(parts[1], 10);
                if (!isNaN(numPart) && numPart > maxCounter) {
                    maxCounter = numPart;
                }
            }
        });
        setSequence(String(maxCounter + 1).padStart(5, '0'));
    }
  }, [ticketToEdit, tickets, prefix]);

  useEffect(() => {
    const fetchSuggestions = async () => {
        setSuggestions({
            macModel: await getSuggestions('macModel'),
            clientName: await getSuggestions('clientName'),
            clientPhone: await getSuggestions('clientPhone'),
        });
    };
    fetchSuggestions();
  }, []);

  useEffect(() => {
    const repairCost = ticket.services?.reduce((sum, s) => sum + s.price, 0) || 0;
    if (ticket.costs?.repair !== repairCost) {
      setTicket(prev => ({ ...prev, costs: { ...(prev.costs as Costs), repair: repairCost } }));
    }
  }, [ticket.services]);

  const handleClientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTicket(prev => ({ ...prev, client: { ...(prev.client as Client), [name]: value } }));
  };

  const handleCostsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTicket(prev => ({ ...prev, costs: { ...(prev.costs as Costs), [name]: parseInt(value) || 0 } }));
  };

  const handleSave = async (action: 'new' | 'close' | 'print') => {
      if (isSaving) return;
      if (!sequence.trim()) {
          alert("La séquence numérique est obligatoire.");
          return;
      }
      
      setIsSaving(true);
      try {
        const signature = signaturePadRef.current?.getSignature();
        const finalId = `${prefix}${sequence.trim()}`;
        
        const finalData = { 
            ...ticket,
            id: finalId,
            clientSignature: signature || ticket.clientSignature, 
            updatedAt: new Date().toISOString() 
        };
        await onSave(finalData, action, ticketToEdit?.id);
        playTone(660, 150);
        if (!ticketToEdit) {
            setTicket(initialTicketState);
            signaturePadRef.current?.clear();
        }
      } catch (err) {
          alert("Erreur lors de l'enregistrement.");
      } finally {
          setIsSaving(false);
      }
  };

  const inputStyle = "mt-1 block w-full p-3 rounded-xl bg-slate-900/50 text-white border border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all";
  const labelStyle = "text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 mb-1 block";

  return (
    <div className="space-y-8 pb-32 max-w-6xl mx-auto">
        {/* Header Formulaire */}
        <div className="glass p-6 rounded-2xl border border-white/10 flex justify-between items-center shadow-2xl">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600/20 rounded-xl">
                    <PencilIcon className="w-6 h-6 text-blue-500"/>
                </div>
                <div>
                    <h1 className="text-xl font-black text-white uppercase tracking-tight">
                        {ticketToEdit ? `Modification Fiche ${ticket.id}` : "Ouverture Nouveau Dossier"}
                    </h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Enregistrement administratif & technique</p>
                </div>
            </div>
            <div className="flex gap-3">
                <button onClick={onCancel} className="px-6 py-2.5 text-xs font-black text-slate-400 uppercase hover:text-white transition-colors">Annuler</button>
                <button onClick={() => handleSave('close')} disabled={isSaving} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition-all transform active:scale-95 uppercase">
                    {isSaving ? "Traitement..." : "Valider Dossier"}
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Colonne Gauche - Client & Machine */}
            <div className="lg:col-span-7 space-y-8">
                <section className="glass p-8 rounded-3xl border-t-4 border-blue-600 shadow-xl space-y-6">
                    <h2 className="text-white font-black uppercase text-sm flex items-center gap-3 tracking-widest">
                        <UserIcon className="w-5 h-5 text-blue-500"/> 
                        I. Détails Propriétaire
                    </h2>
                    <div className="space-y-5">
                        {/* Bloc d'Identification */}
                        <div>
                            <label className={labelStyle}>Identifiant de Dossier Unique</label>
                            <div className="flex items-stretch overflow-hidden rounded-xl border-2 border-white/10 shadow-inner bg-slate-900/60 group focus-within:border-blue-500/50 transition-all">
                                <div className="flex items-center px-6 bg-blue-600/10 text-blue-400 font-black text-xl select-none border-r border-white/10 italic">
                                    {prefix}
                                </div>
                                <input 
                                    value={sequence} 
                                    onChange={(e) => setSequence(e.target.value.replace(/\D/g, ''))} 
                                    placeholder="00001"
                                    className="flex-grow p-4 bg-transparent text-white font-black text-3xl outline-none font-mono tracking-tighter focus:bg-white/5 transition-all" 
                                />
                                <div className="flex items-center pr-4 bg-transparent">
                                    <div className="w-1 h-8 bg-blue-500/30 rounded-full animate-pulse"></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className={labelStyle}>Nom Complet / Raison Sociale</label>
                                <input name="name" value={ticket.client?.name} onChange={handleClientChange} className={inputStyle} required />
                            </div>
                            <div>
                                <label className={labelStyle}>Numéro de Contact (WhatsApp)</label>
                                <input name="phone" value={ticket.client?.phone} onChange={handleClientChange} placeholder="Ex: 07 00 00 00 00" className={inputStyle} required />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="glass p-8 rounded-3xl border-t-4 border-purple-600 shadow-xl space-y-6">
                    <h2 className="text-white font-black uppercase text-sm flex items-center gap-3 tracking-widest">
                        <MacbookIcon className="w-5 h-5 text-purple-500"/> 
                        II. Identification Matériel
                    </h2>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className={labelStyle}>Marque</label>
                                <input name="macBrand" value={ticket.macBrand} readOnly className={inputStyle + " font-black opacity-50 cursor-not-allowed"} />
                            </div>
                            <div>
                                <label className={labelStyle}>Modèle (Ex: A2337)</label>
                                <input name="macModel" value={ticket.macModel} onChange={(e) => setTicket(p => ({...p, macModel: e.target.value.toUpperCase()}))} list="mac-models-list" className={inputStyle + " font-black"} required />
                                <datalist id="mac-models-list">
                                    {MACBOOK_MODELS.map(m => <option key={m} value={m} />)}
                                </datalist>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Toggle Allumage */}
                            <div>
                                <label className={labelStyle}>État de mise sous tension</label>
                                <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
                                    <button 
                                        type="button"
                                        onClick={() => setTicket(p => ({...p, powersOn: true}))}
                                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${ticket.powersOn ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        S'allume
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setTicket(p => ({...p, powersOn: false}))}
                                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${!ticket.powersOn ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Inerte (HS)
                                    </button>
                                </div>
                            </div>

                            {/* État Batterie - DEMANDE UTILISATEUR */}
                            <div>
                                <label className={labelStyle}>État Batterie (Déclaré)</label>
                                <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
                                    <button 
                                        type="button"
                                        onClick={() => setTicket(p => ({...p, batteryFunctional: 'unknown'}))}
                                        className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${ticket.batteryFunctional === 'unknown' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                                    >
                                        Inconnu
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setTicket(p => ({...p, batteryFunctional: 'yes'}))}
                                        className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${ticket.batteryFunctional === 'yes' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-500'}`}
                                    >
                                        Fonct.
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setTicket(p => ({...p, batteryFunctional: 'no'}))}
                                        className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${ticket.batteryFunctional === 'no' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500'}`}
                                    >
                                        HS
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className={labelStyle}>Description Exhaustive du Problème</label>
                            <div className="relative group">
                                <textarea 
                                    name="problemDescription" 
                                    value={ticket.problemDescription} 
                                    onChange={(e) => setTicket(p => ({...p, problemDescription: e.target.value}))} 
                                    rows={4} 
                                    className={inputStyle + " resize-none leading-relaxed"} 
                                    placeholder="Symptômes précis constatés..."
                                    required 
                                />
                                <div className="absolute bottom-3 right-3">
                                    <AiCorrectionButton text={ticket.problemDescription || ''} onCorrected={(t) => setTicket(p => ({...p, problemDescription: t}))} fieldName="Panne" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Colonne Droite - Diagnostic & Devis */}
            <div className="lg:col-span-5 space-y-8">
                <section className="glass p-8 rounded-3xl border-t-4 border-yellow-500 shadow-xl space-y-6">
                    <h2 className="text-white font-black uppercase text-sm flex items-center gap-3 tracking-widest">
                        <BanknotesIcon className="w-5 h-5 text-yellow-500"/> 
                        III. Éléments Comptables
                    </h2>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelStyle}>Frais Expertise (F)</label>
                                <input type="number" name="diagnostic" value={ticket.costs?.diagnostic} onChange={handleCostsChange} className={inputStyle + " font-mono font-bold text-center"} />
                            </div>
                            <div>
                                <label className={labelStyle}>Acompte perçu (F)</label>
                                <input type="number" name="advance" value={ticket.costs?.advance} onChange={handleCostsChange} className={inputStyle + " font-mono font-bold text-center text-green-400"} />
                            </div>
                        </div>
                        
                        <div className="bg-slate-900/60 p-6 rounded-2xl border border-white/5 text-center">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Estimation Solde Restant</span>
                            <span className="text-4xl font-black text-blue-500 font-mono tracking-tighter">
                                {((ticket.costs?.diagnostic || 0) + (ticket.costs?.repair || 0) - (ticket.costs?.advance || 0)).toLocaleString('fr-FR')} F
                            </span>
                        </div>
                    </div>
                </section>

                <section className="glass p-8 rounded-3xl border-t-4 border-red-600 shadow-xl space-y-6">
                    <h2 className="text-white font-black uppercase text-sm flex items-center gap-3 tracking-widest">
                        <ShieldCheckIcon className="w-5 h-5 text-red-500"/> 
                        IV. Accord Contractuel TGS CI
                    </h2>
                    <div className="space-y-4">
                        <div className="p-4 bg-red-600/5 rounded-xl border border-red-600/20 flex gap-4">
                            <input type="checkbox" id="legalAck" checked={ticket.dataBackupAck} onChange={(e) => setTicket(p => ({...p, dataBackupAck: e.target.checked}))} className="w-6 h-6 rounded bg-slate-900 border-white/10 text-red-600 mt-1" required />
                            <label htmlFor="legalAck" className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
                                Le client accepte l'obligation de moyens de TGS CI, décharge l'atelier de la responsabilité des données, accepte la garantie de 1 mois (annulée si scellé brisé, oxydation, choc ou tiers) et le retrait sous 30 jours.
                            </label>
                        </div>
                        <div className="space-y-2">
                            <label className={labelStyle}>Signature Électronique du Client</label>
                            <div className="overflow-hidden rounded-xl border border-white/10 shadow-inner">
                                <SignaturePad ref={signaturePadRef} />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>

        {/* Barre de contrôle flottante */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 glass rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 z-[100] animate-fade-in">
             <button type="button" onClick={onCancel} className="px-6 py-2.5 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors">Abandonner</button>
             <div className="w-px h-8 bg-white/10 mx-2"></div>
             <button type="button" onClick={() => handleSave('print')} disabled={isSaving} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl flex items-center gap-2 transition-all group">
                <PrinterIcon className="w-5 h-5 text-slate-400 group-hover:text-white"/> 
                <span className="text-xs font-black uppercase tracking-widest">Imprimer</span>
             </button>
             <button type="button" onClick={() => handleSave('close')} disabled={isSaving} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-[0.1em] text-xs shadow-lg shadow-blue-500/20 transition-all transform active:scale-95">
                {isSaving ? "Synchronisation..." : ticketToEdit ? "Mettre à jour" : "Ouvrir Dossier"}
             </button>
        </div>
    </div>
  );
};

export default RepairForm;
