
import React, { useState } from 'react';
import { RepairTicket, RepairStatus, Role, HistoryEntry } from '../types.ts';
import { 
    PencilIcon, PrinterIcon, ChatBubbleLeftRightIcon, 
    ArrowLeftIcon, ShieldCheckIcon, ClockIcon,
    UserIcon, MacbookIcon, BanknotesIcon
} from './icons.tsx';
import NotificationModal from './NotificationModal.tsx';
import PrintableTicket from './PrintableTicket.tsx';
import PreviewModal from './PreviewModal.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';

interface RepairDetailProps {
  ticket: RepairTicket;
  onBack: () => void;
  onUpdate: (ticket: RepairTicket) => void;
  onDelete: (ticketId: string) => void;
  role: Role;
  onEdit?: (ticket: RepairTicket) => void;
}

const RepairDetail: React.FC<RepairDetailProps> = ({ ticket, onBack, onUpdate, onDelete, role, onEdit }) => {
    const [isNotificationModalOpen, setNotificationModalOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    
    const { settings } = useAppSettings();

    const handleUpdateWithFeedback = async (updatedTicket: RepairTicket, actionDescription: string) => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            await onUpdate(updatedTicket);
        } catch (error) {
            console.error(`Failed to ${actionDescription}:`, error);
            alert(`Erreur technique lors de la sauvegarde.`);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value as RepairStatus;
        const newHistoryEntry: HistoryEntry = {
            timestamp: new Date().toISOString(),
            user: role as any,
            action: `Statut changé à "${newStatus}"`,
        };
        await handleUpdateWithFeedback({ ...ticket, status: newStatus, history: [...ticket.history, newHistoryEntry] }, 'changer le statut');
    };
    
    const totalCost = (ticket.costs.diagnostic || 0) + (ticket.costs.repair || 0);
    const balance = totalCost - (ticket.costs.advance || 0);

    const batteryLabel = {
        'unknown': 'Inconnu',
        'yes': 'Fonctionnelle',
        'no': 'Non fonctionnelle'
    }[ticket.batteryFunctional] || 'Inconnu';

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
            {/* Header Technique */}
            <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-2xl">
                <div className="flex items-center gap-5">
                    <button onClick={onBack} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all">
                        <ArrowLeftIcon className="w-6 h-6 text-white" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="px-4 py-1.5 bg-white text-black font-mono text-lg font-black rounded-lg">
                                {ticket.id}
                            </span>
                            <h1 className="text-xl font-black text-white uppercase tracking-tighter">Fiche d'intervention</h1>
                        </div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-2">Dossier technique certifié TGS-CI</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => setNotificationModalOpen(true)} className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-2 uppercase tracking-widest">
                        <ChatBubbleLeftRightIcon className="w-4 h-4"/> Notifier
                    </button>
                    <button onClick={() => setIsPreviewOpen(true)} className="px-6 py-2.5 bg-white hover:bg-slate-200 text-black text-xs font-black rounded-xl transition-all flex items-center gap-2 uppercase tracking-widest">
                        <PrinterIcon className="w-4 h-4"/> Imprimer
                    </button>
                    {onEdit && (
                        <button onClick={() => onEdit(ticket)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-2 uppercase tracking-widest">
                            <PencilIcon className="w-4 h-4"/> Éditer
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Colonne Gauche */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                            <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                                <UserIcon className="w-4 h-4"/> Propriétaire
                            </h2>
                            <div>
                                <p className="text-2xl font-black text-white">{ticket.client.name}</p>
                                <p className="text-lg font-mono text-blue-400 font-bold mt-1 tracking-tighter">{ticket.client.phone}</p>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                            <h2 className="text-[10px] font-black text-purple-500 uppercase tracking-widest flex items-center gap-2">
                                <MacbookIcon className="w-4 h-4"/> Appareil
                            </h2>
                            <div>
                                <p className="text-2xl font-black text-white">{ticket.macModel}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <span className={`px-2 py-1 text-[10px] font-black rounded-md border ${ticket.powersOn ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}`}>
                                        ALLUMAGE: {ticket.powersOn ? 'OK' : 'HS'}
                                    </span>
                                    <span className={`px-2 py-1 text-[10px] font-black rounded-md border ${ticket.batteryFunctional === 'yes' ? 'border-green-500 text-green-400' : ticket.batteryFunctional === 'no' ? 'border-red-500 text-red-400' : 'border-slate-500 text-slate-400'}`}>
                                        BATTERIE: {batteryLabel.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-black border-l-4 border-red-600 p-6 rounded-2xl">
                        <h2 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3">Diagnostic Symptomatique</h2>
                        <p className="text-lg font-bold text-white leading-relaxed italic">
                            "{ticket.problemDescription}"
                        </p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl space-y-6">
                        <h2 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                            <BanknotesIcon className="w-4 h-4"/> Détails Financiers
                        </h2>
                        <div className="space-y-3">
                            <div className="flex justify-between p-4 bg-black/40 rounded-xl border border-slate-800">
                                <span className="text-sm font-bold text-slate-400">Frais Expertise</span>
                                <span className="font-mono font-black text-white">{(ticket.costs.diagnostic || 0).toLocaleString('fr-FR')} F</span>
                            </div>
                            {ticket.services.map((s, i) => (
                                <div key={i} className="flex justify-between p-4 bg-black/40 rounded-xl border border-slate-800">
                                    <span className="text-sm font-bold text-slate-200">{s.name}</span>
                                    <span className="font-mono font-black text-white">{s.price.toLocaleString('fr-FR')} F</span>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                            <div className="p-4 rounded-xl border border-slate-800 text-center">
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Total Devis</p>
                                <p className="text-xl font-mono font-black text-white">{totalCost.toLocaleString('fr-FR')} F</p>
                            </div>
                            <div className="p-4 rounded-xl border border-green-900/30 bg-green-900/10 text-center">
                                <p className="text-[9px] font-black text-green-500 uppercase mb-1">Acompte</p>
                                <p className="text-xl font-mono font-black text-green-400">{ticket.costs.advance.toLocaleString('fr-FR')} F</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white text-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Solde dû</p>
                                <p className="text-xl font-mono font-black text-black">{balance.toLocaleString('fr-FR')} F</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Statut */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contrôle du Statut</h2>
                        <div className="relative">
                            <select 
                                value={ticket.status} 
                                onChange={handleStatusChange} 
                                className="w-full p-4 bg-black text-white border-2 border-slate-800 rounded-xl font-black text-xs uppercase appearance-none focus:border-blue-500 outline-none"
                            >
                                {Object.values(RepairStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-h-[500px] overflow-hidden flex flex-col">
                        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Traçabilité Dossier</h2>
                        <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                           {[...ticket.history].reverse().map((entry, idx) => (
                               <div key={idx} className="pl-4 border-l-2 border-slate-800 pb-4 last:pb-0">
                                   <p className="text-[11px] font-black text-white uppercase">{entry.action}</p>
                                   <div className="flex gap-2 mt-1 text-[9px] font-bold text-slate-500">
                                       <span className="uppercase">{entry.user}</span>
                                       <span>•</span>
                                       <span className="font-mono">{new Date(entry.timestamp).toLocaleDateString('fr-FR')}</span>
                                   </div>
                               </div>
                           ))}
                        </div>
                    </div>
                </div>
            </div>

            <NotificationModal isOpen={isNotificationModalOpen} onClose={() => setNotificationModalOpen(false)} ticket={ticket} onNotified={() => {}} />
            <PreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} fileName={`bon_depot_${ticket.id}.pdf`}>
                <PrintableTicket ticket={ticket} printSettings={settings.print} customFieldDefs={settings.customFields.ticket} />
            </PreviewModal>
        </div>
    );
};

export default RepairDetail;
