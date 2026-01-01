
import React, { useState, useEffect } from 'react';
import useFactures from '../hooks/useFactures.ts';
import { Facture, DocumentStatus } from '../types.ts';
import FactureForm from './FactureForm.tsx';
import Modal from './Modal.tsx';
import PrintableDocument from './PrintableDocument.tsx';
import { ArrowLeftIcon, PlusCircleIcon, PrinterIcon, PencilIcon, TrashIcon } from './icons.tsx';
import PreviewModal from './PreviewModal.tsx';

interface FactureListProps {
  onBack: () => void;
  initialEditId?: string | null;
}

const FactureList: React.FC<FactureListProps> = ({ onBack, initialEditId }) => {
    const { factures, loading, addFacture, updateFacture, deleteFacture } = useFactures();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [factureToEdit, setFactureToEdit] = useState<Facture | null>(null);
    const [factureToPrint, setFactureToPrint] = useState<Facture | null>(null);

    useEffect(() => {
        if (initialEditId && factures.length > 0) {
            const facture = factures.find(f => f.id === initialEditId);
            if (facture) {
                setFactureToEdit(facture);
                setIsFormOpen(true);
            }
        }
    }, [initialEditId, factures]);

    const getStatusStyles = (status: DocumentStatus) => {
        switch (status) {
            case 'Payé': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            case 'Finalisé': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            case 'Brouillon': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            case 'Annulé': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
        }
    };

    if (loading) return <div className="text-center py-20 text-slate-500 font-bold uppercase tracking-widest animate-pulse">Chargement des registres financiers...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center gap-4">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-black uppercase text-xs tracking-widest">
                    <ArrowLeftIcon className="w-5 h-5"/> Retour
                </button>
                <button onClick={() => { setFactureToEdit(null); setIsFormOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-900/20 uppercase text-xs">
                    <PlusCircleIcon className="w-5 h-5"/> Nouvelle Facture
                </button>
            </div>
            
            <div className="glass rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                <table className="w-full text-sm text-left">
                     <thead className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4">Référence</th>
                            <th className="px-6 py-4">Client / Société</th>
                            <th className="px-6 py-4">Date Émission</th>
                            <th className="px-6 py-4">Total Facturé</th>
                            <th className="px-6 py-4">Statut</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                        {factures.map(f => (
                            <tr key={f.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4 font-mono text-blue-400 font-bold">{f.numero}</td>
                                <td className="px-6 py-4">
                                    <p className="font-black text-white">{f.clientName}</p>
                                    <p className="text-[10px] text-slate-500">{f.macModel}</p>
                                </td>
                                <td className="px-6 py-4 text-xs">{new Date(f.date).toLocaleDateString('fr-FR')}</td>
                                <td className="px-6 py-4 font-mono font-black text-white">{f.total.toLocaleString('fr-FR')} F</td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-widest ${getStatusStyles(f.status)}`}>
                                        {f.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => {setFactureToEdit(f); setIsFormOpen(true);}} className="p-2 bg-white/5 hover:bg-blue-600 rounded-xl text-slate-400 hover:text-white transition-all"><PencilIcon className="w-4 h-4"/></button>
                                        <button onClick={() => setFactureToPrint(f)} className="p-2 bg-white/5 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all"><PrinterIcon className="w-4 h-4"/></button>
                                        <button onClick={() => deleteFacture(f.id)} className="p-2 bg-white/5 hover:bg-rose-600 rounded-xl text-slate-400 hover:text-white transition-all"><TrashIcon className="w-4 h-4"/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {factures.length === 0 && (
                    <div className="py-20 text-center text-slate-600 font-bold uppercase tracking-widest">Aucune facture enregistrée</div>
                )}
            </div>

            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} containerClassName="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-4xl m-4 p-8">
                <FactureForm
                    onSave={async (data) => {
                        if ('id' in data) await updateFacture(data as Facture);
                        else await addFacture(data);
                        setIsFormOpen(false);
                    }}
                    onCancel={() => setIsFormOpen(false)}
                    factureToEdit={factureToEdit}
                />
            </Modal>
            
            {factureToPrint && (
                <PreviewModal isOpen={!!factureToPrint} onClose={() => setFactureToPrint(null)} fileName={`FAC-${factureToPrint.numero}.pdf`}>
                    <PrintableDocument
                        title="Facture"
                        numero={factureToPrint.numero}
                        date={factureToPrint.date}
                        clientLabel="Client"
                        clientName={factureToPrint.clientName}
                        clientPhone={factureToPrint.clientPhone}
                        macModel={factureToPrint.macModel}
                        items={factureToPrint.items}
                        total={factureToPrint.total}
                        warranty={factureToPrint.warranty}
                        advance={factureToPrint.advance}
                        message={factureToPrint.message}
                    />
                </PreviewModal>
            )}
        </div>
    );
};

export default FactureList;
