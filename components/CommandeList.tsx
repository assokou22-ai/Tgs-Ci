
import React, { useState, useEffect } from 'react';
import useCommandes from '../hooks/useCommandes.ts';
import { Commande, DocumentItem } from '../types.ts';
import Modal from './Modal.tsx';
import PrintableDocument from './PrintableDocument.tsx';
import { ArrowLeftIcon, PlusCircleIcon, PrinterIcon, PencilIcon, TrashIcon, PlusIcon, XCircleIcon, ShoppingCartIcon } from './icons.tsx';
import PreviewModal from './PreviewModal.tsx';
import { playTone } from '../utils/audio.ts';

interface CommandeListProps {
  onBack: () => void;
  initialEditId?: string | null;
}

const CommandeList: React.FC<CommandeListProps> = ({ onBack, initialEditId }) => {
    const { commandes, loading, addCommande, updateCommande, deleteCommande } = useCommandes();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [commandeToEdit, setCommandeToEdit] = useState<Commande | null>(null);
    const [commandeToPrint, setCommandeToPrint] = useState<Commande | null>(null);

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'Payé': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            case 'Reçu': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            case 'Commandé': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
            case 'Brouillon': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            case 'Annulé': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
        }
    };

    if (loading) return <div className="text-center py-20 text-slate-500 animate-pulse font-black uppercase tracking-widest">Accès aux registres d'approvisionnement...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center gap-4">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-black uppercase text-xs tracking-widest">
                    <ArrowLeftIcon className="w-5 h-5"/> Retour
                </button>
                <button onClick={() => { setCommandeToEdit(null); setIsFormOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-900/20 uppercase text-xs">
                    <PlusCircleIcon className="w-5 h-5"/> Nouvelle Commande
                </button>
            </div>

            <div className="glass rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4">Réf. Commande</th>
                            <th className="px-6 py-4">Fournisseur / Client</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Total</th>
                            <th className="px-6 py-4">Statut</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                        {commandes.map(c => (
                            <tr key={c.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4 font-mono text-indigo-400 font-bold">{c.numero}</td>
                                <td className="px-6 py-4">
                                    <p className="font-black text-white">{c.supplierName}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{c.clientName || 'Stock Interne'}</p>
                                </td>
                                <td className="px-6 py-4 text-xs">{new Date(c.date).toLocaleDateString('fr-FR')}</td>
                                <td className="px-6 py-4">
                                    {c.isRevenue 
                                        ? <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-black uppercase"><PlusCircleIcon className="w-3 h-3"/> Vente</span> 
                                        : <span className="flex items-center gap-1 text-slate-500 text-[10px] font-black uppercase"><ShoppingCartIcon className="w-3 h-3"/> Achat</span>
                                    }
                                </td>
                                <td className="px-6 py-4 font-mono font-black text-white">{c.total.toLocaleString('fr-FR')} F</td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-widest ${getStatusStyles(c.status)}`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => {setCommandeToEdit(c); setIsFormOpen(true);}} className="p-2 bg-white/5 hover:bg-indigo-600 rounded-xl text-slate-400 hover:text-white transition-all"><PencilIcon className="w-4 h-4"/></button>
                                        <button onClick={() => setCommandeToPrint(c)} className="p-2 bg-white/5 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all"><PrinterIcon className="w-4 h-4"/></button>
                                        <button onClick={() => deleteCommande(c.id)} className="p-2 bg-white/5 hover:bg-rose-600 rounded-xl text-slate-400 hover:text-white transition-all"><TrashIcon className="w-4 h-4"/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} containerClassName="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-5xl m-4 p-8">
                {/* CommandeForm is expected to be present, otherwise replace with actual form */}
                <div className="text-center py-10 text-white font-bold">Éditeur de Commande Avancé</div>
            </Modal>
            
            {commandeToPrint && (
                <PreviewModal isOpen={!!commandeToPrint} onClose={() => setCommandeToPrint(null)} fileName={`CMD-${commandeToPrint.numero}.pdf`}>
                    <PrintableDocument
                        title="Bon de Commande"
                        numero={commandeToPrint.numero}
                        date={commandeToPrint.date}
                        clientLabel="Fournisseur"
                        clientName={commandeToPrint.supplierName}
                        clientPhone={commandeToPrint.clientPhone}
                        macModel={commandeToPrint.macModel}
                        items={commandeToPrint.items}
                        total={commandeToPrint.total}
                        advance={commandeToPrint.advance}
                        message={commandeToPrint.message}
                    />
                </PreviewModal>
            )}
        </div>
    );
};

export default CommandeList;
