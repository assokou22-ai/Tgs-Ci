
import React, { useState, useEffect, memo, useMemo, useRef } from 'react';
import useFactures from '../hooks/useFactures.ts';
import { Facture, DocumentStatus } from '../types.ts';
import FactureForm from './FactureForm.tsx';
import Modal from './Modal.tsx';
import PrintableDocument from './PrintableDocument.tsx';
import { ArrowLeftIcon, PlusCircleIcon, PrinterIcon, PencilIcon, TrashIcon, WhatsAppIcon, ClockIcon, CalendarDaysIcon } from './icons.tsx';
import PreviewModal from './PreviewModal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import WhatsAppShareModal from './WhatsAppShareModal.tsx';

interface FactureListProps {
  onBack: () => void;
  initialEditId?: string | null;
}

const FactureItem = memo(({ facture, onEdit, onPrint, onDelete, onWhatsApp, onShowHistory, getStatusStyles }: { 
    facture: Facture; 
    onEdit: (f: Facture) => void; 
    onPrint: (f: Facture) => void; 
    onDelete: (f: Facture) => void;
    onWhatsApp: (f: Facture) => void;
    onShowHistory: (f: Facture) => void;
    getStatusStyles: (s: DocumentStatus) => string;
}) => (
    <tr className="hover:bg-white/5 transition-colors group">
        <td className="px-8 py-5">
            <div className="flex justify-center gap-2">
                <button 
                    onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('role', 'engagementssav');
                        url.searchParams.set('action', 'create');
                        if (facture.numero) url.searchParams.set('numeroCommandeOrigine', facture.numero);
                        if (facture.clientName) url.searchParams.set('nomClient', facture.clientName);
                        if (facture.clientPhone) url.searchParams.set('telephoneClient', facture.clientPhone);
                        if (facture.macModel) url.searchParams.set('appareil', facture.macModel);
                        window.history.pushState({}, '', url);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    className="p-3 bg-white/5 hover:bg-yellow-600 rounded-xl text-yellow-500 hover:text-white transition-all shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center font-black text-xs"
                    title="Contrat SAV pour cette facture"
                >
                    SAV
                </button>
                <button onClick={() => onEdit(facture)} className="p-3 bg-white/5 hover:bg-blue-600 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center" title="Modifier"><PencilIcon className="w-5 h-5"/></button>
                <button onClick={() => onShowHistory(facture)} className="p-3 bg-white/5 hover:bg-violet-600 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center" title="Historique de traçabilité"><ClockIcon className="w-5 h-5"/></button>
                <button onClick={() => onWhatsApp(facture)} className="p-3 bg-white/5 hover:bg-emerald-600 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center" title="WhatsApp"><WhatsAppIcon className="w-5 h-5"/></button>
                <button onClick={() => onPrint(facture)} className="p-3 bg-white/5 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center" title="Imprimer"><PrinterIcon className="w-5 h-5"/></button>
                <button onClick={() => onDelete(facture)} className="p-3 bg-white/5 hover:bg-rose-600 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center" title="Supprimer"><TrashIcon className="w-5 h-5"/></button>
            </div>
        </td>
        <td className="px-8 py-5 font-mono text-blue-400 font-bold">{facture.numero}</td>
        <td className="px-8 py-5">
            <p className="font-black text-white uppercase tracking-tight">{facture.clientName}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{facture.macModel}</p>
        </td>
        <td className="px-8 py-5 text-[11px] font-bold text-slate-400">{new Date(facture.date).toLocaleDateString('fr-FR')}</td>
        <td className="px-8 py-5 font-mono font-black text-white">{facture.total.toLocaleString('fr-FR')} F</td>
        <td className="px-8 py-5">
            <span className={`px-3 py-1 text-[9px] font-black rounded-lg border uppercase tracking-[0.2em] ${getStatusStyles(facture.status)}`}>
                {facture.status}
            </span>
        </td>
    </tr>
));

const FactureList: React.FC<FactureListProps> = ({ onBack, initialEditId }) => {
    const { factures, loading, addFacture, updateFacture, deleteFacture } = useFactures();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [factureToEdit, setFactureToEdit] = useState<Facture | null>(null);
    const [factureToPrint, setFactureToPrint] = useState<Facture | null>(null);
    const [factureToDelete, setFactureToDelete] = useState<Facture | null>(null);
    const [whatsappDoc, setWhatsappDoc] = useState<Facture | null>(null);
    const [historyFacture, setHistoryFacture] = useState<Facture | null>(null);

    const sortedFactures = useMemo(() => {
        return [...factures].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [factures]);

    const initialHandled = useRef(false);
    useEffect(() => {
        if (!initialHandled.current && initialEditId && factures.length > 0) {
            const facture = factures.find(f => f.id === initialEditId);
            if (facture) {
                const timer = setTimeout(() => {
                    setFactureToEdit(facture);
                    setIsFormOpen(true);
                    initialHandled.current = true;
                }, 0);
                return () => clearTimeout(timer);
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

    const confirmDelete = async () => {
        if (factureToDelete) {
            await deleteFacture(factureToDelete.id);
            setFactureToDelete(null);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">Chargement des registres...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <button onClick={onBack} className="group flex items-center gap-3 text-slate-400 hover:text-white transition-all font-black uppercase text-[10px] tracking-[0.2em]">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all">
                        <ArrowLeftIcon className="w-4 h-4"/>
                    </div>
                    Retour
                </button>
                <button onClick={() => { setFactureToEdit(null); setIsFormOpen(true); }} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-[20px] transition-all shadow-2xl shadow-blue-900/40 uppercase text-[11px] tracking-widest group">
                    <PlusCircleIcon className="w-5 h-5 group-hover:scale-110 transition-transform"/> Nouvelle Facture
                </button>
            </div>
            
            <div className="glass rounded-[32px] border border-white/10 overflow-hidden shadow-2xl bg-white/[0.02]">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left border-collapse">
                         <thead className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] bg-white/[0.03] border-b border-white/10">
                            <tr>
                                <th className="px-8 py-5 text-center">Actions</th>
                                <th className="px-8 py-5">Référence</th>
                                <th className="px-8 py-5">Client / Société</th>
                                <th className="px-8 py-5">Date Émission</th>
                                <th className="px-8 py-5">Total Facturé</th>
                                <th className="px-8 py-5">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                            {sortedFactures.map(f => (
                                <FactureItem 
                                    key={f.id} 
                                    facture={f} 
                                    onEdit={(facture) => {setFactureToEdit(facture); setIsFormOpen(true);}}
                                    onWhatsApp={setWhatsappDoc}
                                    onPrint={setFactureToPrint}
                                    onDelete={setFactureToDelete}
                                    onShowHistory={setHistoryFacture}
                                    getStatusStyles={getStatusStyles}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
                {factures.length === 0 && (
                    <div className="py-32 text-center">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                            <PlusCircleIcon className="w-10 h-10 text-slate-600" />
                        </div>
                        <p className="text-slate-600 font-black uppercase tracking-[0.3em] text-[10px]">Aucune facture enregistrée</p>
                    </div>
                )}
            </div>

            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} containerClassName="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-4xl m-4 p-8">
                <FactureForm
                    onSave={async (data, action) => {
                        let savedFacture: Facture;
                        if ('id' in data) {
                            await updateFacture(data as Facture);
                            savedFacture = data as Facture;
                        } else {
                            savedFacture = await addFacture(data);
                        }
                        setIsFormOpen(false);
                        if (action === 'print') {
                            setFactureToPrint(savedFacture);
                        }
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
                        documentNature={factureToPrint.documentNature}
                        clientLabel="Client"
                        clientName={factureToPrint.clientName}
                        clientPhone={factureToPrint.clientPhone}
                        macModel={factureToPrint.macModel}
                        macColor={factureToPrint.macColor}
                        macSpecs={factureToPrint.macSpecs}
                        macSerialNumber={factureToPrint.macSerialNumber}
                        macModelNumber={factureToPrint.macModelNumber}
                        macScreenSize={factureToPrint.macScreenSize}
                        macCondition={factureToPrint.macCondition}
                        items={factureToPrint.items}
                        total={factureToPrint.total}
                        warranty={factureToPrint.warranty}
                        warrantyType={factureToPrint.warrantyType}
                        warrantyConditions={factureToPrint.warrantyConditions}
                        includeWarrantyBlock={factureToPrint.includeWarrantyBlock}
                        advance={factureToPrint.advance}
                        message={factureToPrint.message}
                    />
                </PreviewModal>
            )}

            <ConfirmationModal
                isOpen={!!factureToDelete}
                onClose={() => setFactureToDelete(null)}
                onConfirm={confirmDelete}
                title="Supprimer la facture ?"
                message={`Voulez-vous vraiment annuler et effacer définitivement la facture N° ${factureToDelete?.numero} ?`}
                confirmText="Confirmer la suppression"
            />

            {whatsappDoc && (
                <WhatsAppShareModal 
                    isOpen={!!whatsappDoc}
                    onClose={() => setWhatsappDoc(null)}
                    ticket={whatsappDoc}
                />
            )}

            {historyFacture && (
                <Modal isOpen={!!historyFacture} onClose={() => setHistoryFacture(null)}>
                    <div className="space-y-6">
                        <div className="flex justify-between items-center pb-4 border-b border-white/10">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <ClockIcon className="w-6 h-6 text-violet-400" />
                                Historique Traçabilité Facture
                            </h3>
                            <span className="font-mono text-sm text-violet-400 font-bold">{historyFacture.numero}</span>
                        </div>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {(!historyFacture.history || historyFacture.history.length === 0) ? (
                                <p className="text-slate-500 text-center py-8 italic text-xs">Aucun historique disponible pour cette facture.</p>
                            ) : (
                                [...historyFacture.history].reverse().map((entry, idx) => (
                                    <div key={idx} className="pl-4 border-l-2 border-violet-500/30 pb-4 relative">
                                        <div className="absolute w-2.5 h-2.5 rounded-full bg-violet-500 -left-[6px] top-1 shadow-[0_0_8px_rgba(139,92,246,0.8)]"></div>
                                        <p className="text-xs font-bold text-white tracking-tight">{entry.action}</p>
                                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                            <span className="uppercase font-black text-violet-400">{entry.user}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1 font-mono">
                                                <CalendarDaysIcon className="w-3 h-3 opacity-60" /> {new Date(entry.timestamp).toLocaleDateString('fr-FR')}
                                                <ClockIcon className="w-3 h-3 opacity-60 ml-1" /> {new Date(entry.timestamp).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex justify-end pt-4 border-t border-white/10">
                            <button onClick={() => setHistoryFacture(null)} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-all">
                                Fermer
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FactureList;
