
import React, { useState, useEffect } from 'react';
import Modal from './Modal.tsx';
import { RepairTicket } from '../types.ts';
import useExternalPurchases from '../hooks/useExternalPurchases.ts';
import SmartAutocompleteInput from './SmartAutocompleteInput.tsx';
import { ShoppingCartIcon } from './icons.tsx';
import { playTone } from '../utils/audio.ts';
import { learnFromData } from '../services/suggestionService.ts';
import { useToastContext } from '../context/ToastContext.tsx';

interface ExternalPurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: RepairTicket;
}

const ExternalPurchaseModal: React.FC<ExternalPurchaseModalProps> = ({ isOpen, onClose, ticket }) => {
    const { showToast } = useToastContext();
    const { addPurchase } = useExternalPurchases();
    const [formData, setFormData] = useState({
        item_name: '',
        collaborator_name: '',
        purchase_price: 0,
        sale_price: 0
    });

    // Pré-remplir le prix de vente si une prestation correspondante existe déjà
    useEffect(() => {
        if (isOpen && ticket.services.length > 0) {
            const timer = setTimeout(() => {
                const lastService = ticket.services[ticket.services.length - 1];
                setFormData(prev => ({
                    ...prev,
                    item_name: lastService.name,
                    sale_price: lastService.price
                }));
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isOpen, ticket]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.item_name || !formData.collaborator_name) return;

        try {
            await addPurchase({
                ticket_id: ticket.id,
                item_name: formData.item_name,
                collaborator_name: formData.collaborator_name,
                purchase_price: formData.purchase_price,
                sale_price: formData.sale_price,
                date: new Date().toISOString().split('T')[0]
            });

            await learnFromData({ collaborator_name: formData.collaborator_name }, { collaborator_name: 'collaborator_names' });
            
            playTone(880, 100);
            onClose();
        } catch (error) {
            console.error(error);
            showToast("Erreur lors de l'enregistrement de l'achat.", "error");
        }
    };

    const margin = formData.sale_price - formData.purchase_price;
    const marginPercent = formData.sale_price > 0 ? (margin / formData.sale_price) * 100 : 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} containerClassName="bg-slate-900 border border-white/10 rounded-[40px] shadow-3xl w-full max-w-2xl m-4 overflow-hidden">
            <form onSubmit={handleSave}>
                <header className="p-8 bg-blue-600/10 border-b border-white/5">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-900/40">
                            <ShoppingCartIcon className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Achat Collaborateur 1h</h2>
                    </div>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Dossier technique #{ticket.id}</p>
                </header>

                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Composant / Pièce</label>
                            <input 
                                value={formData.item_name}
                                onChange={e => setFormData({...formData, item_name: e.target.value})}
                                placeholder="ex: Écran iPhone 13"
                                className="w-full p-4 bg-black/40 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Collaborateur (Fournisseur)</label>
                            <SmartAutocompleteInput 
                                category="collaborator_names"
                                value={formData.collaborator_name}
                                onChange={v => setFormData({...formData, collaborator_name: v})}
                                placeholder="ex: Digital Shop Abidjan"
                                className="w-full p-4 bg-black/40 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 p-6 rounded-3xl border border-white/5">
                        <div>
                            <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 ml-1">Prix Achat Confrère (Dépense)</label>
                            <input 
                                type="number"
                                value={formData.purchase_price}
                                onChange={e => setFormData({...formData, purchase_price: Number(e.target.value)})}
                                className="w-full p-4 bg-black/60 border border-rose-500/30 rounded-2xl text-rose-400 font-mono font-black text-xl outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 ml-1">Prix Vente Client (Revenu)</label>
                            <input 
                                type="number"
                                value={formData.sale_price}
                                onChange={e => setFormData({...formData, sale_price: Number(e.target.value)})}
                                className="w-full p-4 bg-black/60 border border-emerald-500/30 rounded-2xl text-emerald-400 font-mono font-black text-xl outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-6 py-4 bg-blue-600/5 border border-blue-500/10 rounded-2xl">
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Bénéfice Net prévisionnel</p>
                            <p className="text-2xl font-black text-white">{margin.toLocaleString()} F CFA</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Marge</p>
                            <p className={`text-xl font-black ${marginPercent > 30 ? 'text-emerald-500' : 'text-yellow-500'}`}>
                                {marginPercent.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>

                <footer className="p-8 bg-black/40 border-t border-white/5 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-6 py-3 text-slate-500 hover:text-white uppercase font-black text-[10px] tracking-widest transition-colors">Annuler</button>
                    <button type="submit" className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-900/40 transition-all active:scale-95">Valider l'Achat Confrère</button>
                </footer>
            </form>
        </Modal>
    );
};

export default ExternalPurchaseModal;
