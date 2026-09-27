
import React, { useState } from 'react';
import useProformas from '../hooks/useProformas.ts';
import useFactures from '../hooks/useFactures.ts';
import { Proforma, DocumentItem, DocumentNature } from '../types.ts';
import Modal from './Modal.tsx';
import PrintableDocument from './PrintableDocument.tsx';
import { ArrowLeftIcon, PlusCircleIcon, PrinterIcon, PencilIcon, TrashIcon, PlusIcon, XCircleIcon, BanknotesIcon } from './icons.tsx';
import PreviewModal from './PreviewModal.tsx';
import { playTone } from '../utils/audio.ts';
import ConfirmationModal from './ConfirmationModal.tsx';
import { useToastContext } from '../context/ToastContext.tsx';
import WarrantyConfigSection from './WarrantyConfigSection.tsx';
import { WARRANTY_PRESETS } from '../utils/warrantyPresets.ts';

interface ProformaFormProps {
  onSave: (proformaData: Omit<Proforma, 'id' | 'numero' | 'date' | 'updatedAt'> | Proforma) => Promise<void>;
  onCancel: () => void;
  proformaToEdit: Proforma | null;
}

const ProformaForm: React.FC<ProformaFormProps> = ({ onSave, onCancel, proformaToEdit }) => {
    const { showToast } = useToastContext();
    const [formData, setFormData] = useState<Omit<Proforma, 'id' | 'numero' | 'date' | 'updatedAt'>>(
        proformaToEdit ? { 
            documentNature: proformaToEdit.documentNature || (proformaToEdit.macModel ? 'macbook' : 'pieces'),
            warranty: proformaToEdit.warranty ?? (proformaToEdit.macModel ? '6 Mois SAV Local' : '30 Jours'),
            warrantyConditions: proformaToEdit.warrantyConditions ?? '',
            includeWarrantyBlock: proformaToEdit.includeWarrantyBlock ?? true,
            advance: proformaToEdit.advance ?? 0,
            ...proformaToEdit 
        } : {
            clientName: '',
            clientPhone: '',
            documentNature: 'macbook',
            macModel: '',
            macColor: '',
            macSpecs: '',
            macSerialNumber: '',
            macModelNumber: '',
            macScreenSize: '',
            macCondition: 'Occasion',
            items: [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
            total: 0,
            status: 'Brouillon',
            warranty: '6 Mois SAV Local',
            warrantyConditions: WARRANTY_PRESETS.macbook.conditions,
            includeWarrantyBlock: true,
            advance: 0,
            message: 'Valable 15 jours à compter de la date d\'émission.'
        }
    );

    const total = React.useMemo(() => formData.items.reduce((sum, item) => sum + item.totalPrice, 0), [formData.items]);

    const handleMainChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: name === 'advance' ? Number(value) : value 
        }));
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
            await onSave(proformaToEdit ? { ...proformaToEdit, ...formData, total } : { ...formData, total });
            playTone(660, 150);
            showToast("Proforma enregistrée", "success");
        } catch (error) {
            console.error("Failed to save proforma:", error);
            showToast("L'enregistrement a échoué.", "error");
        }
    };

    const statusOptions: Proforma['status'][] = ['Brouillon', 'Envoyé', 'Accepté', 'Refusé'];
    const inputStyle = "w-full p-2.5 bg-gray-100 dark:bg-gray-700/80 rounded-xl text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 outline-none text-xs focus:border-blue-500 transition-colors";
    const labelStyle = "block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-1";

    const currentNature: DocumentNature = formData.documentNature || 'macbook';

    return (
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {proformaToEdit ? `Modifier Proforma N° ${proformaToEdit.numero}` : 'Nouvelle Facture Proforma'}
                </h2>
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold">
                    Devis Proforma
                </span>
            </div>

            {/* 1. Client */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={labelStyle}>Nom du Client / Entreprise *</label>
                    <input name="clientName" value={formData.clientName} onChange={handleMainChange} className={inputStyle} placeholder="ex: Cabinet Kouassi / M. Traoré" required />
                </div>
                <div>
                    <label className={labelStyle}>Contact Téléphonique *</label>
                    <input name="clientPhone" value={formData.clientPhone} onChange={handleMainChange} className={inputStyle} placeholder="ex: +225 07 00 00 00 00" required />
                </div>
            </div>

            {/* 2. Nature & Garantie 100% Modifiables */}
            <WarrantyConfigSection
                documentNature={currentNature}
                onChangeDocumentNature={(nature) => setFormData(prev => ({ ...prev, documentNature: nature }))}
                warranty={formData.warranty || ''}
                onChangeWarranty={(warranty) => setFormData(prev => ({ ...prev, warranty }))}
                warrantyConditions={formData.warrantyConditions || ''}
                onChangeWarrantyConditions={(warrantyConditions) => setFormData(prev => ({ ...prev, warrantyConditions }))}
                includeWarrantyBlock={formData.includeWarrantyBlock ?? true}
                onChangeIncludeWarrantyBlock={(include) => setFormData(prev => ({ ...prev, includeWarrantyBlock: include }))}
                isProforma={true}
            />

            {/* 3. Détails Matériel / Appareil / Pièces (dynamique) */}
            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/60 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">
                        {currentNature === 'reparation' ? 'Appareil Pris en Charge / Diagnostic' : currentNature === 'pieces' ? 'Désignation Pièce ou Machine Compatible' : 'Détails MacBook & Équipement'}
                    </span>
                    <span className="text-[10px] text-gray-400">Ne sera imprimé que ce qui est renseigné</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                        <label className={labelStyle}>
                            {currentNature === 'pieces' ? 'Pièce / Machine compatible' : currentNature === 'reparation' ? 'Modèle Appareil' : 'Modèle MacBook'}
                        </label>
                        <input 
                            name="macModel" 
                            value={formData.macModel} 
                            onChange={handleMainChange} 
                            className={inputStyle} 
                            placeholder={currentNature === 'pieces' ? "ex: Écran MacBook Pro 14 A2442 Original" : "ex: MacBook Pro 14 M3 Pro, MacBook Air M2..."} 
                        />
                    </div>
                    <div>
                        <label className={labelStyle}>Couleur (Facultatif)</label>
                        <input name="macColor" list="proforma-colors-list" value={formData.macColor || ''} onChange={handleMainChange} className={inputStyle} placeholder="Silver, Blush, Citrus, Indigo..." />
                        <datalist id="proforma-colors-list">
                            <option value="Silver" />
                            <option value="Blush" />
                            <option value="Citrus" />
                            <option value="Indigo" />
                            <option value="Gris Sidéral" />
                            <option value="Argent" />
                            <option value="Minuit" />
                            <option value="Lumière Stellaire" />
                            <option value="Noir Sidéral" />
                            <option value="Or" />
                        </datalist>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className={labelStyle}>Numéro de Série S/N (Facultatif)</label>
                        <input name="macSerialNumber" value={formData.macSerialNumber || ''} onChange={handleMainChange} className={inputStyle} placeholder="ex: C02..." />
                    </div>
                    <div>
                        <label className={labelStyle}>Modèle AXXXX (Facultatif)</label>
                        <input name="macModelNumber" value={formData.macModelNumber || ''} onChange={handleMainChange} className={inputStyle} placeholder="ex: A2338 / A2442" />
                    </div>
                    <div>
                        <label className={labelStyle}>Taille Écran</label>
                        <select name="macScreenSize" value={formData.macScreenSize || ''} onChange={handleMainChange} className={inputStyle}>
                            <option value="">Non spécifié</option>
                            <option value="13 pouces">13 pouces</option>
                            <option value="13.3 pouces">13.3 pouces</option>
                            <option value="13.6 pouces">13.6 pouces</option>
                            <option value="14 pouces">14 pouces</option>
                            <option value="15 pouces">15 pouces</option>
                            <option value="16 pouces">16 pouces</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelStyle}>État du Matériel</label>
                        <select name="macCondition" value={formData.macCondition || ''} onChange={handleMainChange} className={inputStyle}>
                            <option value="">Non spécifié</option>
                            <option value="Occasion">Occasion</option>
                            <option value="Reconditionné">Reconditionné</option>
                            <option value="Neuf">Neuf</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className={labelStyle}>Caractéristiques Détaillées (RAM, SSD, Processeur...)</label>
                    <input name="macSpecs" value={formData.macSpecs || ''} onChange={handleMainChange} className={inputStyle} placeholder="ex: 18Go Mémoire Unifiée | 512Go SSD | Batterie 100% | Clavier Azerty" />
                </div>
            </div>

            {/* 4. Articles & Prestations */}
            <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                 <div className="flex items-center justify-between">
                     <h3 className="font-bold text-gray-900 dark:text-white uppercase text-xs">Articles / Prestations du Devis</h3>
                     <span className="text-[11px] text-gray-400">Sélection ou saisie manuelle libre</span>
                 </div>
                 <datalist id="proforma-prestation-presets">
                     <option value="Réparation de la carte mère" />
                     <option value="Remplacement de la carte mère" />
                     <option value="Réparation de la lumière sur l'écran" />
                     <option value="Réparation de la lumière sur la carte mère" />
                     <option value="Désoxydation (dégâts liquides)" />
                     <option value="Remplacement batterie neuve" />
                     <option value="Remplacement clavier" />
                     <option value="Remplacement écran" />
                     <option value="Installation macOS" />
                     <option value="Récupération de données" />
                 </datalist>
                 {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600/40">
                        <input type="text" list="proforma-prestation-presets" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} placeholder="Désignation de l'article ou de l'intervention" className="col-span-12 sm:col-span-6 p-2 rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 outline-none" required />
                        <div className="col-span-4 sm:col-span-2">
                            <input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="w-full p-2 rounded-lg bg-white dark:bg-gray-800 text-xs text-center text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 outline-none" placeholder="Qté" />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                            <input type="number" min="0" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', Number(e.target.value))} className="w-full p-2 rounded-lg bg-white dark:bg-gray-800 text-xs text-right text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 outline-none" placeholder="P.U." />
                        </div>
                        <span className="col-span-3 sm:col-span-1 text-right font-mono text-xs font-bold text-gray-900 dark:text-white">{(item.quantity * item.unitPrice).toLocaleString('fr-FR')} F</span>
                        <button type="button" onClick={() => removeItem(index)} className="col-span-1 flex justify-center text-red-500 hover:text-red-400 transition-colors" title="Supprimer la ligne">
                            <XCircleIcon className="w-5 h-5"/>
                        </button>
                    </div>
                ))}
            </div>
            
            <div className="flex items-center justify-between">
                <button type="button" onClick={addItem} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                    <PlusIcon className="w-4 h-4" /> Ajouter une ligne
                </button>
                <div className="text-right font-black text-lg text-gray-900 dark:text-white">
                    TOTAL TTC : <span className="text-blue-600 dark:text-blue-400 font-mono">{total.toLocaleString('fr-FR')} F CFA</span>
                </div>
            </div>

            {/* 5. Acompte & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                    <label className={labelStyle}>Acompte / Avance reçue (Facultatif)</label>
                    <input 
                        type="number" 
                        min="0" 
                        name="advance" 
                        value={formData.advance || ''} 
                        onChange={handleMainChange} 
                        className={inputStyle} 
                        placeholder="0 F CFA" 
                    />
                    {Number(formData.advance) > 0 && (
                        <p className="text-[10px] text-emerald-500 font-bold mt-1">
                            Reste à régler : {(total - Number(formData.advance)).toLocaleString('fr-FR')} F CFA
                        </p>
                    )}
                </div>
                <div>
                    <label className={labelStyle}>Statut du Devis</label>
                    <select name="status" value={formData.status} onChange={handleMainChange} className={inputStyle}>
                        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className={labelStyle}>Notes / Précisions complémentaires / Validité de l'offre</label>
                <textarea 
                    name="message" 
                    value={formData.message || ''} 
                    onChange={handleMainChange} 
                    rows={2} 
                    className={inputStyle} 
                    placeholder="Ex: Valable 15 jours à compter de la date d'émission. Délais de livraison : 24h ouvrées."
                />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 pb-24 md:pb-0">
                <button type="button" onClick={onCancel} className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    Annuler
                </button>
                <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-900/30 hover:bg-blue-500 transition-all hidden md:block">
                    {proformaToEdit ? 'Enregistrer les Modifications' : 'Créer la Proforma'}
                </button>
            </div>

            {/* Mobile Fixed Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-white/10 z-[100] flex md:hidden gap-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
                <button type="button" onClick={onCancel} className="flex-1 py-4 bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest border border-white/10">
                    Annuler
                </button>
                <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/40">
                    Valider
                </button>
            </div>
        </form>
    );
};

interface ProformaListProps {
  onBack: () => void;
}

const ProformaList: React.FC<ProformaListProps> = ({ onBack }) => {
    const { proformas, loading, addProforma, updateProforma, deleteProforma } = useProformas();
    const { addFacture } = useFactures();
    const { showToast } = useToastContext();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [proformaToEdit, setProformaToEdit] = useState<Proforma | null>(null);
    const [proformaToPrint, setProformaToPrint] = useState<Proforma | null>(null);
    const [proformaToDelete, setProformaToDelete] = useState<Proforma | null>(null);
    const [proformaToConvert, setProformaToConvert] = useState<Proforma | null>(null);
    const [isConverting, setIsConverting] = useState(false);

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

    const executeConvertToFacture = async () => {
        if (!proformaToConvert || isConverting) return;
        setIsConverting(true);
        try {
            const createdFacture = await addFacture({
                clientName: proformaToConvert.clientName,
                clientPhone: proformaToConvert.clientPhone,
                documentNature: proformaToConvert.documentNature || 'macbook',
                macModel: proformaToConvert.macModel || '',
                macColor: proformaToConvert.macColor || '',
                macSpecs: proformaToConvert.macSpecs || '',
                macSerialNumber: proformaToConvert.macSerialNumber || '',
                macModelNumber: proformaToConvert.macModelNumber || '',
                macScreenSize: proformaToConvert.macScreenSize || '',
                macCondition: proformaToConvert.macCondition,
                items: proformaToConvert.items,
                total: proformaToConvert.total,
                status: 'Finalisé',
                warranty: proformaToConvert.warranty || '30 Jours',
                warrantyType: proformaToConvert.warrantyType,
                warrantyConditions: proformaToConvert.warrantyConditions,
                includeWarrantyBlock: proformaToConvert.includeWarrantyBlock ?? true,
                advance: proformaToConvert.advance || 0,
                proformaNumero: proformaToConvert.numero,
                proformaId: proformaToConvert.id,
                message: proformaToConvert.message || 'Facture émise sur base du devis proforma N° ' + proformaToConvert.numero
            });
            // Marquer la proforma comme Acceptée et sauvegarder la facture générée
            await updateProforma({
                ...proformaToConvert,
                status: 'Accepté',
                convertedFactureNumero: createdFacture?.numero,
                convertedFactureId: createdFacture?.id
            });
            playTone(880, 200);
            showToast(`Facture ${createdFacture?.numero || ''} générée avec succès depuis la proforma ${proformaToConvert.numero} !`, "success");
            setProformaToConvert(null);
        } catch (err) {
            console.error("Erreur conversion en facture:", err);
            showToast("Erreur lors de la conversion en facture.", "error");
        } finally {
            setIsConverting(false);
        }
    };

    const confirmDelete = async () => {
        if (proformaToDelete) {
            await deleteProforma(proformaToDelete.id);
            setProformaToDelete(null);
        }
    };

    if (loading) return <div className="text-center py-20 text-slate-500 font-bold uppercase tracking-widest animate-pulse">Chargement...</div>;

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
                            <th className="px-4 py-3 text-center">Actions</th>
                            <th className="px-4 py-3">Numéro</th>
                            <th className="px-4 py-3">Client</th>
                            <th className="px-4 py-3">Type & Matériel</th>
                            <th className="px-4 py-3">Garantie</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Total</th>
                            <th className="px-4 py-3">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proformas.map(p => (
                            <tr key={p.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-2 text-center">
                                    <div className="flex justify-center items-center gap-1">
                                        <button onClick={() => handleEdit(p)} className="p-2 hover:bg-blue-500/10 rounded-full transition-colors group" title="Modifier">
                                            <PencilIcon className="w-4 h-4 text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform"/>
                                        </button>
                                        <button onClick={() => handlePrint(p)} className="p-2 hover:bg-gray-500/10 rounded-full transition-colors group" title="Imprimer / PDF">
                                            <PrinterIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:scale-110 transition-transform"/>
                                        </button>
                                        <button 
                                            onClick={() => setProformaToConvert(p)} 
                                            className={`p-2 rounded-full transition-colors group ${
                                                p.convertedFactureNumero || p.status === 'Accepté'
                                                    ? 'hover:bg-amber-500/10 text-amber-500'
                                                    : 'hover:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
                                            }`} 
                                            title={p.convertedFactureNumero ? `Facture déjà émise (${p.convertedFactureNumero}) - Cliquer pour détails/ré-émission` : "Convertir en Facture officielle"}
                                        >
                                            <BanknotesIcon className="w-4 h-4 group-hover:scale-110 transition-transform"/>
                                        </button>
                                        <button onClick={() => setProformaToDelete(p)} className="p-2 hover:bg-red-500/10 rounded-full transition-colors group" title="Supprimer">
                                            <TrashIcon className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform"/>
                                        </button>
                                    </div>
                                </td>
                                <td className="px-4 py-2 font-mono font-bold text-xs">{p.numero}</td>
                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                                    <div>{p.clientName}</div>
                                    <div className="text-xs text-gray-400 font-mono">{p.clientPhone}</div>
                                </td>
                                <td className="px-4 py-2 text-xs">
                                    <div className="font-bold text-gray-800 dark:text-gray-200">
                                        {p.macModel || (p.documentNature === 'pieces' ? 'Pièces détachées' : 'Devis Matériel')}
                                    </div>
                                    {(p.macColor || p.macSpecs) && (
                                        <div className="text-[11px] text-gray-400 truncate max-w-[180px]">
                                            {p.macColor} {p.macSpecs ? `• ${p.macSpecs}` : ''}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-xs">
                                    {p.includeWarrantyBlock === false ? (
                                        <span className="text-gray-400 italic">Non affichée</span>
                                    ) : (
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            {p.warranty || 'Non précisée'}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-xs">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                                <td className="px-4 py-2 font-mono font-bold text-gray-900 dark:text-white">{p.total.toLocaleString('fr-FR')} F</td>
                                <td className="px-4 py-2 text-xs">
                                    <div className="flex flex-col gap-1 items-start">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            p.status === 'Accepté' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                            p.status === 'Refusé' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                                            p.status === 'Envoyé' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                        }`}>
                                            {p.status}
                                        </span>
                                        {p.convertedFactureNumero && (
                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title={`Facture officielle générée : ${p.convertedFactureNumero}`}>
                                                📄 {p.convertedFactureNumero}
                                            </span>
                                        )}
                                    </div>
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
                        documentNature={proformaToPrint.documentNature}
                        macModel={proformaToPrint.macModel}
                        macColor={proformaToPrint.macColor}
                        macSpecs={proformaToPrint.macSpecs}
                        macSerialNumber={proformaToPrint.macSerialNumber}
                        macModelNumber={proformaToPrint.macModelNumber}
                        macScreenSize={proformaToPrint.macScreenSize}
                        macCondition={proformaToPrint.macCondition}
                        items={proformaToPrint.items}
                        total={proformaToPrint.total}
                        warranty={proformaToPrint.warranty}
                        warrantyConditions={proformaToPrint.warrantyConditions}
                        includeWarrantyBlock={proformaToPrint.includeWarrantyBlock}
                        advance={proformaToPrint.advance}
                        message={proformaToPrint.message}
                    />
                </PreviewModal>
            )}

            {proformaToConvert && (
                <ConfirmationModal
                    isOpen={!!proformaToConvert}
                    onClose={() => !isConverting && setProformaToConvert(null)}
                    onConfirm={executeConvertToFacture}
                    title={proformaToConvert.convertedFactureNumero || proformaToConvert.status === 'Accepté' ? "Attention : Doublon de Facture" : "Convertir en Facture Officielle"}
                    message={
                        proformaToConvert.convertedFactureNumero || proformaToConvert.status === 'Accepté' ? (
                            <div className="space-y-3">
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                                    ⚠️ <strong>Attention :</strong> Ce devis proforma (<strong>{proformaToConvert.numero}</strong>) a déjà été converti en facture officielle.
                                    {proformaToConvert.convertedFactureNumero && (
                                        <div className="mt-2 font-mono font-bold text-sm text-white">
                                            Facture liée : <span className="text-amber-400">{proformaToConvert.convertedFactureNumero}</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Si vous confirmez à nouveau, une <strong>deuxième facture officielle</strong> de <strong className="text-white">{proformaToConvert.total.toLocaleString('fr-FR')} F CFA</strong> sera créée pour ce client, ce qui générera un <strong>doublon financier</strong> sur son relevé.
                                </p>
                                <p className="text-xs text-amber-200">
                                    Souhaitez-vous quand même créer une facture supplémentaire ?
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-200">
                                    Confirmez-vous la conversion du devis proforma <strong className="text-white font-mono">{proformaToConvert.numero}</strong> en <strong>Facture Officielle</strong> ?
                                </p>
                                <div className="text-xs text-slate-300 bg-white/5 border border-white/10 rounded-xl p-3 space-y-1.5">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Client :</span>
                                        <span className="font-bold text-white">{proformaToConvert.clientName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Matériel / Réf :</span>
                                        <span className="font-medium text-white">{proformaToConvert.macModel || 'Prestation / Matériel'}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-white/5">
                                        <span className="text-slate-400">Montant Total :</span>
                                        <span className="font-mono font-extrabold text-emerald-400">{proformaToConvert.total.toLocaleString('fr-FR')} F CFA</span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 italic">
                                    La facture officielle sera créée avec l'ensemble des détails du devis et le devis sera marqué comme "Accepté".
                                </p>
                            </div>
                        )
                    }
                    confirmText={isConverting ? "Génération en cours..." : (proformaToConvert.convertedFactureNumero || proformaToConvert.status === 'Accepté') ? "Créer quand même un doublon" : "Oui, Créer la Facture"}
                    confirmButtonClass={(proformaToConvert.convertedFactureNumero || proformaToConvert.status === 'Accepté') ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}
                />
            )}

            <ConfirmationModal
                isOpen={!!proformaToDelete}
                onClose={() => setProformaToDelete(null)}
                onConfirm={confirmDelete}
                title="Supprimer la proforma ?"
                message={`Voulez-vous vraiment effacer définitivement le devis proforma N° ${proformaToDelete?.numero} ?`}
                confirmText="Supprimer définitivement"
            />
        </div>
    );
};

export default ProformaList;
