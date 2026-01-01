
import React, { useState, useEffect, useRef } from 'react';
import useProformas from '../hooks/useProformas.ts';
import { Proforma, DocumentItem } from '../types.ts';
import Modal from './Modal.tsx';
import PrintableDocument from './PrintableDocument.tsx';
import { ArrowLeftIcon, PlusCircleIcon, PrinterIcon, PencilIcon, TrashIcon, PlusIcon, XCircleIcon } from './icons.tsx';
import PreviewModal from './PreviewModal.tsx';
import { playTone } from '../utils/audio.ts';

// --- ProformaForm Component ---
interface ProformaFormProps {
  onSave: (proformaData: Omit<Proforma, 'id' | 'numero' | 'date' | 'updatedAt'> | Proforma) => Promise<void>;
  onCancel: () => void;
  proformaToEdit: Proforma | null;
}

const ProformaForm: React.FC<ProformaFormProps> = ({ onSave, onCancel, proformaToEdit }) => {
    const [formData, setFormData] = useState<Omit<Proforma, 'id' | 'numero' | 'date' | 'updatedAt'>>(
        proformaToEdit ? { ...proformaToEdit } : {
            clientName: '',
            clientPhone: '',
            macModel: '',
            macColor: '',
            macSpecs: '',
            items: [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
            total: 0,
            status: 'Brouillon',
            message: 'Valable 15 jours à compter de la date d\'émission.'
        }
    );

    useEffect(() => {
        const total = formData.items.reduce((sum, item) => sum + item.totalPrice, 0);
        setFormData(prev => ({ ...prev, total }));
    }, [formData.items]);

    const handleMainChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleItemChange = (index: number, field: keyof DocumentItem, value: string | number) => {
        const newItems = [...formData.items];
        const item = { ...newItems[index], [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
            item.totalPrice = item.quantity * item.unitPrice;
        }
        newItems[index] = item;
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => setFormData(prev => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }] }));
    const removeItem = (index: number) => setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onSave(proformaToEdit ? { ...proformaToEdit, ...formData } : formData);
            playTone(660, 150);
        } catch (error) {
            console.error("Failed to save proforma:", error);
            alert("L'enregistrement a échoué. Veuillez vérifier la console pour plus de détails.");
        }
    };

    const statusOptions: Proforma['status'][] = ['Brouillon', 'Envoyé', 'Accepté', 'Refusé'];
    const inputStyle = "w-full p-2 bg-gray-100 dark:bg-gray-700 rounded text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 outline-none";
    const labelStyle = "block text-xs font-black uppercase text-gray-500 mb-1";

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            <h2 className="text-2xl font-bold text-white">{proformaToEdit ? 'Modifier la' : 'Nouvelle'} Proforma</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelStyle}>Nom du Client</label>
                    <input name="clientName" value={formData.clientName} onChange={handleMainChange} className={inputStyle} required />
                </div>
                <div>
                    <label className={labelStyle}>Contacte du Client</label>
                    <input name="clientPhone" value={formData.clientPhone} onChange={handleMainChange} className={inputStyle} required />
                </div>
                <div>
                    <label className={labelStyle}>Modèle (Obligatoire)</label>
                    <input name="macModel" value={formData.macModel} onChange={handleMainChange} className={inputStyle} placeholder="ex: MacBook Pro 14" required />
                </div>
                <div>
                    <label className={labelStyle}>Couleur (Facultatif)</label>
                    <input name="macColor" value={formData.macColor} onChange={handleMainChange} className={inputStyle} placeholder="ex: Argent" />
                </div>
                <div className="md:col-span-2">
                    <label className={labelStyle}>Caractéristiques (Facultatif)</label>
                    <input name="macSpecs" value={formData.macSpecs} onChange={handleMainChange} className={inputStyle} placeholder="ex: Puce M2 Pro, 512GB" />
                </div>
                <div className="md:col-span-2">
                    <label className={labelStyle}>Statut</label>
                    <select name="status" value={formData.status} onChange={handleMainChange} className={inputStyle}>
                        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>
            <div className="space-y-2 border-t border-gray-700 pt-4">
                 <h3 className="font-bold text-white uppercase text-sm">Articles / Prestations</h3>
                 {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <input type="text" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} placeholder="Description" className="col-span-6 p-1 rounded bg-white dark:bg-gray-600" required />
                        <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="col-span-2 p-1 rounded bg-white dark:bg-gray-600 text-center" />
                        <input type="number" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', Number(e.target.value))} className="col-span-2 p-1 rounded bg-white dark:bg-gray-600 text-right" />
                        <span className="col-span-1 text-right font-mono text-sm text-white">{(item.quantity * item.unitPrice).toLocaleString('fr-FR')}</span>
                        <button type="button" onClick={() => removeItem(index)} className="col-span-1 flex justify-center"><XCircleIcon className="w-5 h-5 text-red-500"/></button>
                    </div>
                ))}
            </div>
            <button type="button" onClick={addItem} className="text-sm text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1"><PlusIcon className="w-4 h-4" /> Ajouter une ligne</button>
            <div className="text-right font-bold text-xl text-white border-t border-gray-700 pt-2">Total Estimé: {formData.total.toLocaleString('fr-FR')} F</div>
            <div>
                <label className={labelStyle}>Notes / Conditions de l'offre</label>
                <textarea name="message" value={formData.message} onChange={handleMainChange} rows={2} className={inputStyle} />
            </div>
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-700">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md font-bold">Valider la Proforma</button>
            </div>
        </form>
    );
};


// --- ProformaList Component ---
interface ProformaListProps {
  onBack: () => void;
}

const ProformaList: React.FC<ProformaListProps> = ({ onBack }) => {
    const { proformas, loading, addProforma, updateProforma, deleteProforma } = useProformas();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [proformaToEdit, setProformaToEdit] = useState<Proforma | null>(null);
    const [proformaToPrint, setProformaToPrint] = useState<Proforma | null>(null);

    const handleSave = async (proformaData: Omit<Proforma, 'id' | 'numero' | 'date' | 'updatedAt'> | Proforma) => {
        if ('id' in proformaData) {
            await updateProforma(proformaData);
        } else {
            await addProforma(proformaData);
        }
        setIsFormOpen(false);
        setProformaToEdit(null);
    };

    const handleEdit = (proforma: Proforma) => {
        setProformaToEdit(proforma);
        setIsFormOpen(true);
    };
    
    const handlePrint = (proforma: Proforma) => {
        setProformaToPrint(proforma);
    };

    if (loading) return <div>Chargement des proformas...</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-4">
                <button onClick={onBack} className="flex items-center gap-2 text-blue-400 hover:underline"><ArrowLeftIcon className="w-5 h-5"/>Retour</button>
                <button onClick={() => { setProformaToEdit(null); setIsFormOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md"><PlusCircleIcon className="w-6 h-6"/>Nouvelle Proforma</button>
            </div>
             <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                    <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-4 py-3">Numéro</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proformas.map(p => (
                            <tr key={p.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-2 font-mono">{p.numero}</td>
                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{p.clientName}</td>
                                <td className="px-4 py-2">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                                <td className="px-4 py-2 font-mono">{p.total.toLocaleString('fr-FR')} F</td>
                                <td className="px-4 py-2">{p.status}</td>
                                <td className="px-4 py-2 text-center">
                                    <button onClick={() => handleEdit(p)} className="p-1 mx-1"><PencilIcon className="w-4 h-4 text-blue-500 dark:text-blue-400"/></button>
                                    <button onClick={() => handlePrint(p)} className="p-1 mx-1"><PrinterIcon className="w-4 h-4 text-gray-500 dark:text-gray-400"/></button>
                                    <button onClick={() => deleteProforma(p.id)} className="p-1 mx-1"><TrashIcon className="w-4 h-4 text-red-500"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)}>
                <ProformaForm onSave={handleSave} onCancel={() => { setIsFormOpen(false); setProformaToEdit(null); }} proformaToEdit={proformaToEdit}/>
            </Modal>
            
            {proformaToPrint && (
                <PreviewModal
                    isOpen={!!proformaToPrint}
                    onClose={() => setProformaToPrint(null)}
                    fileName={`proforma_${proformaToPrint.numero.replace(/\//g, '-')}.pdf`}
                >
                    <PrintableDocument
                        title="Facture Proforma"
                        numero={proformaToPrint.numero}
                        date={proformaToPrint.date}
                        clientLabel="Client"
                        clientName={proformaToPrint.clientName}
                        clientPhone={proformaToPrint.clientPhone}
                        macModel={proformaToPrint.macModel}
                        macColor={proformaToPrint.macColor}
                        macSpecs={proformaToPrint.macSpecs}
                        items={proformaToPrint.items}
                        total={proformaToPrint.total}
                        message={proformaToPrint.message}
                    />
                </PreviewModal>
            )}
        </div>
    );
};

export default ProformaList;
