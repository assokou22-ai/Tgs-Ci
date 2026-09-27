
import React, { useState, useMemo } from 'react';
import Modal from './Modal.tsx';
import useStock from '../hooks/useStock.ts';
import { RepairTicket } from '../types.ts';
import { MagnifyingGlassIcon } from './icons.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import { useToastContext } from '../context/ToastContext.tsx';

interface StockUsageModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: RepairTicket;
}

const StockUsageModal: React.FC<StockUsageModalProps> = ({ isOpen, onClose, ticket }) => {
    const { showToast } = useToastContext();
    const { stock, consumeStock } = useStock();
    const [search, setSearch] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [lowStockInfo, setLowStockInfo] = useState<{ current: number } | null>(null);

    const filteredStock = useMemo(() => {
        const low = search.toLowerCase();
        return stock.filter(s => {
            const nameMatch = s.name.toLowerCase().includes(low);
            const models = s.compatibleModels || [];
            const modelMatch = Array.isArray(models) 
                ? models.some(m => m.toLowerCase().includes(low))
                : false;
            return nameMatch || modelMatch;
        });
    }, [stock, search]);

    const handleAssign = async (force: boolean = false) => {
        if (!selectedId) return;
        const result = await consumeStock({
            stock_id: selectedId,
            ticket_id: ticket.id,
            quantite_utilisee: quantity,
            date: new Date().toISOString().split('T')[0]
        }, force);

        if (result.success) {
            showToast("Matériel assigné avec succès.", "success");
            onClose();
        } else if (result.lowStock) {
            setLowStockInfo({ current: result.currentQuantity || 0 });
        } else {
            showToast(result.error || "Une erreur est survenue.", "error");
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} containerClassName="bg-slate-900 border border-white/10 rounded-[32px] shadow-3xl w-full max-w-2xl m-4 p-8">
            <div className="space-y-6">
                <header>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Sortie de Pièce</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Assigner du matériel au dossier #{ticket.id}</p>
                </header>

                <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-4 top-3.5 w-5 h-5 text-slate-600" />
                    <input 
                        type="text" 
                        placeholder="Chercher écran, batterie, modèle..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                        className="w-full p-3.5 pl-12 bg-black/40 border border-white/10 rounded-2xl text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>

                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {filteredStock.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                selectedId === item.id 
                                ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-900/40' 
                                : 'bg-white/5 border-white/5 hover:bg-white/10'
                            }`}
                        >
                            <div className="text-left overflow-hidden">
                                <p className={`font-black uppercase text-sm ${selectedId === item.id ? 'text-white' : 'text-slate-200'}`}>{item.name}</p>
                                <p className={`text-[9px] font-bold uppercase truncate ${selectedId === item.id ? 'text-blue-100' : 'text-slate-500'}`}>
                                    Compatibilité: {item.compatibleModels || 'UNIVERSEL'}
                                </p>
                            </div>
                            <div className="flex flex-col items-end shrink-0 ml-4">
                                <span className={`text-[10px] font-black uppercase ${selectedId === item.id ? 'text-white' : 'text-blue-400'}`}>Stock: {item.quantity}</span>
                                {item.location && <span className="text-[8px] text-slate-500 font-bold uppercase">{item.location}</span>}
                            </div>
                        </button>
                    ))}
                    {filteredStock.length === 0 && (
                        <p className="text-center py-10 text-slate-600 font-bold uppercase text-[10px] tracking-widest">Aucune pièce disponible</p>
                    )}
                </div>

                {selectedId && (
                    <div className="flex items-center gap-6 p-6 bg-white/5 rounded-3xl border border-white/5 animate-fade-in">
                        <div className="flex-1">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Quantité à prélever</label>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 bg-white/10 rounded-xl font-black text-white hover:bg-white/20">-</button>
                                <span className="text-2xl font-black text-white w-12 text-center">{quantity}</span>
                                <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 bg-white/10 rounded-xl font-black text-white hover:bg-white/20">+</button>
                            </div>
                        </div>
                        <button 
                            onClick={handleAssign}
                            className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-900/40 transition-all active:scale-95"
                        >
                            Confirmer Sortie
                        </button>
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={!!lowStockInfo}
                onClose={() => setLowStockInfo(null)}
                onConfirm={() => { handleAssign(true); setLowStockInfo(null); }}
                title="Stock Insuffisant"
                message={`Il n'y a que ${lowStockInfo?.current} pièce(s) disponible(s) en stock. Voulez-vous forcer la sortie (le stock deviendra négatif) ?`}
                confirmText="Forcer la sortie"
            />
        </Modal>
    );
};

export default StockUsageModal;
