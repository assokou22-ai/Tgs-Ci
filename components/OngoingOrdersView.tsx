
import React, { useState, useMemo } from 'react';
import useCommandes from '../hooks/useCommandes.ts';
import { ShoppingCartIcon, PrinterIcon, ArrowPathIcon, ExclamationTriangleIcon } from './icons.tsx';
import PreviewModal from './PreviewModal.tsx';
import PrintableOngoingOrdersList from './PrintableOngoingOrdersList.tsx';

const OngoingOrdersView: React.FC = () => {
    const { commandes, loading } = useCommandes();
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // On considère "en cours" les commandes qui ne sont pas : Reçues, Payées ou Annulées
    const ongoingCommandes = useMemo(() => {
        return commandes.filter(c => 
            c.status === 'Brouillon' || c.status === 'Commandé'
        );
    }, [commandes]);

    const totalOutstanding = useMemo(() => {
        return ongoingCommandes.reduce((sum, c) => sum + (c.total - (c.advance || 0)), 0);
    }, [ongoingCommandes]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <ArrowPathIcon className="w-12 h-12 text-slate-700 animate-spin mb-4" />
                <p className="text-slate-500 font-black uppercase text-xs tracking-widest">Analyse du flux logistique...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* HEADER ET STATS RAPIDES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="apple-card p-6 bg-blue-600/10 border-blue-500/20 flex items-center gap-5">
                    <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-900/30">
                        <ShoppingCartIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">En attente</p>
                        <p className="text-2xl font-black text-white">{ongoingCommandes.length} Commandes</p>
                    </div>
                </div>

                <div className="apple-card p-6 bg-emerald-600/10 border-emerald-500/20 flex items-center gap-5">
                    <div className="p-3 bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-900/30">
                        <ArrowPathIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Reliquat Dû</p>
                        <p className="text-2xl font-black text-white">{totalOutstanding.toLocaleString()} F</p>
                    </div>
                </div>

                <div className="flex items-center justify-end">
                    <button 
                        onClick={() => setIsPreviewOpen(true)}
                        disabled={ongoingCommandes.length === 0}
                        className="flex items-center gap-2 px-8 py-4 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <PrinterIcon className="w-5 h-5" />
                        Imprimer Liste Logistique
                    </button>
                </div>
            </div>

            {/* LISTE DES COMMANDES */}
            <div className="apple-card overflow-hidden border-white/5">
                <div className="p-6 bg-white/[0.02] border-b border-white/5">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Détails des commandes non livrées</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-black/40 border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4">Réf. Cmd</th>
                                <th className="px-6 py-4">Entité / Projet</th>
                                <th className="px-6 py-4">Désignation Matériel</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Reste à Payer</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {ongoingCommandes.length > 0 ? ongoingCommandes.map(c => (
                                <tr key={c.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-blue-400 font-bold">{c.numero}</td>
                                    <td className="px-6 py-4">
                                        <p className="font-black text-white uppercase">{c.supplierName}</p>
                                        <p className="text-[10px] text-slate-500">{c.clientName || 'Stock Interne'}</p>
                                    </td>
                                    <td className="px-6 py-4 text-slate-300 font-medium">{c.macModel}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 text-[9px] font-black rounded-lg border uppercase tracking-widest ${
                                            c.status === 'Commandé' ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-amber-600/20 text-amber-400 border-amber-500/30'
                                        }`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-black text-white">
                                        {(c.total - (c.advance || 0)).toLocaleString()} F
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <ExclamationTriangleIcon className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                        <p className="text-slate-600 font-black uppercase text-xs tracking-widest">Toutes les commandes sont à jour (Livrées)</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PREVIEW MODAL */}
            <PreviewModal 
                isOpen={isPreviewOpen} 
                onClose={() => setIsPreviewOpen(false)} 
                fileName={`TGS_COMMANDES_EN_COURS_${new Date().toISOString().split('T')[0]}.pdf`}
            >
                <PrintableOngoingOrdersList commandes={ongoingCommandes} />
            </PreviewModal>
        </div>
    );
};

export default OngoingOrdersView;
