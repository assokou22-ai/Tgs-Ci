
import React, { useState, useEffect, useMemo } from 'react';
import useCommandes from '../hooks/useCommandes.ts';
import { Commande, DocumentItem, PurchaseType } from '../types.ts';
import Modal from './Modal.tsx';
import PrintableDocument from './PrintableDocument.tsx';
import { ArrowLeftIcon, PlusCircleIcon, PrinterIcon, PencilIcon, TrashIcon, PlusIcon, XCircleIcon, SparklesIcon, UserIcon, ExclamationTriangleIcon, BanknotesIcon, AppleLogo, ClockIcon, CalendarDaysIcon } from './icons.tsx';
import PreviewModal from './PreviewModal.tsx';
import { playTone } from '../utils/audio.ts';
import ConfirmationModal from './ConfirmationModal.tsx';
import { findMacByModel } from '../utils/macModelsData.ts';

interface CommandeFormProps {
    onSave: (data: Omit<Commande, 'id' | 'numero' | 'date' | 'updatedAt'> | Commande, action: 'save' | 'print') => Promise<void>;
    onCancel: () => void;
    commandeToEdit: Commande | null;
    defaultIsRevenue?: boolean;
}

const getSmartDescription = (
    purchaseType: string,
    macModel: string,
    macColor?: string,
    macDetails?: Commande['macDetails'],
    partDetails?: Commande['partDetails']
): string => {
    if (!purchaseType) return '';

    const modelPart = macModel ? `A${macModel.replace(/^A/i, '').toUpperCase()}` : '';
    let detailsStr = '';

    if (purchaseType === 'Carte Mère') {
        const parts = [];
        if (modelPart) parts.push(modelPart);
        if (partDetails?.processor) parts.push(partDetails.processor);
        if (partDetails?.ram) parts.push(`RAM ${partDetails.ram}`);
        if (partDetails?.ssd) parts.push(`SSD ${partDetails.ssd}`);
        if (partDetails?.condition) parts.push(`(${partDetails.condition})`);
        detailsStr = parts.join(' - ');
        return `Carte Mère MacBook ${detailsStr}`.trim();
    }

    if (purchaseType === 'Écran') {
        const parts = [];
        if (modelPart) parts.push(modelPart);
        if (partDetails?.size) parts.push(partDetails.size);
        const color = partDetails?.color || macColor;
        if (color) parts.push(color);
        if (partDetails?.condition) parts.push(`(${partDetails.condition})`);
        detailsStr = parts.join(' - ');
        return `Écran Complet MacBook ${detailsStr}`.trim();
    }

    if (purchaseType === 'MacBook Pro' || purchaseType === 'MacBook Air') {
        const parts = [];
        if (modelPart) parts.push(modelPart);
        if (macDetails?.processor) parts.push(macDetails.processor);
        if (macDetails?.ram) parts.push(`RAM ${macDetails.ram}`);
        if (macDetails?.ssd) parts.push(`SSD ${macDetails.ssd}`);
        if (macColor) parts.push(macColor);
        const conds = [];
        if (macDetails?.condition) conds.push(macDetails.condition);
        if (macDetails?.hasBox === 'Oui') conds.push('Avec Boîte');
        if (conds.length > 0) parts.push(`(${conds.join(' - ')})`);
        detailsStr = parts.join(' - ');
        return `${purchaseType} ${detailsStr}`.trim();
    }

    if (purchaseType === 'Batterie' || purchaseType === 'Clavier') {
        const parts = [];
        if (modelPart) parts.push(modelPart);
        if (partDetails?.condition) parts.push(`(${partDetails.condition})`);
        detailsStr = parts.join(' - ');
        return `${purchaseType} pour MacBook ${detailsStr}`.trim();
    }

    // Default
    const parts = [];
    if (modelPart) parts.push(modelPart);
    if (macColor) parts.push(macColor);
    detailsStr = parts.join(' - ');
    return `${purchaseType} ${detailsStr}`.trim();
};

const CommandeForm: React.FC<CommandeFormProps> = ({ onSave, onCancel, commandeToEdit, defaultIsRevenue = false }) => {
    const [formData, setFormData] = useState<Omit<Commande, 'id' | 'numero' | 'date' | 'updatedAt'>>(
        commandeToEdit ? { ...commandeToEdit } : {
            supplierName: '',
            clientName: '',
            clientPhone: '',
            macModel: '',
            macColor: '',
            items: [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
            total: 0,
            status: 'Brouillon',
            advance: 0,
            isRevenue: defaultIsRevenue,
            message: '',
            purchaseType: 'Autre',
            deliveryDelay: '15 jours ouvrables',
            warranty: '1 mois',
            macDetails: { condition: 'Occasion', hasBox: 'Non' },
            partDetails: { condition: 'Occasion' }
        }
    );

    const [isDescManual, setIsDescManual] = useState(!!commandeToEdit);

    const computedDescription = useMemo(() => {
        return getSmartDescription(
            formData.purchaseType || '',
            formData.macModel,
            formData.macColor,
            formData.macDetails,
            formData.partDetails
        );
    }, [formData.purchaseType, formData.macModel, formData.macColor, formData.macDetails, formData.partDetails]);

    const detectedColors = useMemo(() => {
        if (formData.macModel && formData.macModel.length >= 4) {
            const info = findMacByModel(formData.macModel);
            return info?.colors || [];
        }
        return [];
    }, [formData.macModel]);

    const total = useMemo(() => formData.items.reduce((sum, item) => sum + item.totalPrice, 0), [formData.items]);

    const updateWithSmartDescription = (newData: Omit<Commande, 'id' | 'numero' | 'date' | 'updatedAt'>, forceReset = false) => {
        if (!isDescManual || forceReset) {
            const desc = getSmartDescription(
                newData.purchaseType || '',
                newData.macModel,
                newData.macColor,
                newData.macDetails,
                newData.partDetails
            );
            if (newData.items.length > 0) {
                const newItems = [...newData.items];
                newItems[0] = { ...newItems[0], description: desc };
                newData.items = newItems;
            }
        }
        return newData;
    };

    const handleMainChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const newValue = type === 'number' ? Number(value) : (name === 'isRevenue' ? value === 'true' : value);
        
        setFormData(prev => {
            let updated = { ...prev };
            if (name === 'purchaseType') {
                updated.purchaseType = value as PurchaseType;
                updated.macDetails = (value === 'MacBook Pro' || value === 'MacBook Air') ? { condition: 'Occasion', hasBox: 'Non' } : undefined;
                updated.partDetails = (value === 'Écran' || value === 'Batterie' || value === 'Clavier' || value === 'Carte Mère') ? { condition: 'Occasion' } : undefined;
            } else if (name === 'status' && value === 'Payé') {
                updated.status = value;
                updated.advance = total;
            } else {
                updated = { ...updated, [name]: newValue };
            }
            return updateWithSmartDescription(updated);
        });
    };

    const handleNestedChange = (parent: 'macDetails' | 'partDetails', field: string, value: string | number | boolean) => {
        setFormData(prev => {
            const updated = {
                ...prev,
                [parent]: { ...(prev[parent] || {}), [field]: value }
            };
            return updateWithSmartDescription(updated);
        });
    };

    const handleItemChange = (index: number, field: keyof DocumentItem, value: string | number) => {
        const newItems = [...formData.items];
        const item = { ...newItems[index], [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
            item.totalPrice = item.quantity * item.unitPrice;
        }
        if (index === 0 && field === 'description') {
            setIsDescManual(true);
        }
        newItems[index] = item;
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => setFormData(prev => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }] }));
    const removeItem = (index: number) => setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const action = (window as Window & { _commandeAction?: 'save' | 'print' })._commandeAction || 'save';
        
        // Populate clientName for proper tabular rendering and filters
        const finalData = {
            ...formData,
            advance: formData.status === 'Payé' ? total : formData.advance,
            clientName: formData.isRevenue ? formData.supplierName : 'STOCK INTERNE'
        };
        await onSave(commandeToEdit ? { ...commandeToEdit, ...finalData, total } : { ...finalData, total }, action);
        playTone(660, 150);
    };

    const inputStyle = "w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-black dark:text-white border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all";
    const labelStyle = "block text-[10px] font-black uppercase text-gray-500 mb-1 ml-1";

    const isMacbook = formData.purchaseType === 'MacBook Pro' || formData.purchaseType === 'MacBook Air';
    const warrantyOptions = isMacbook 
        ? ['Sans garantie', '1 mois', '2 mois', '3 mois', '6 mois', '12 mois']
        : ['Sans garantie', '1 mois', '2 mois', '3 mois'];

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar p-2">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Gestion Approvisionnement</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${formData.isRevenue ? 'text-emerald-400' : 'text-blue-400'}`}>
                        {formData.isRevenue ? '🛍️ COMMANDE CLIENT (REVENU PIÈCES)' : '📦 COMMANDE TGS CI (ACHAT POUR LE STOCK)'}
                    </p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className={labelStyle}>Sélecteur d'Opération (Dissociation)</label>
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <button 
                            type="button" 
                            onClick={() => setFormData(p => ({...p, isRevenue: false}))} 
                            className={`flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${!formData.isRevenue ? 'bg-white dark:bg-gray-700 text-blue-500 shadow-sm' : 'text-gray-500'}`}
                        >
                            📦 Commande TGS CI (Achat Stock Personnel)
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setFormData(p => ({...p, isRevenue: true}))} 
                            className={`flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${formData.isRevenue ? 'bg-white dark:bg-gray-700 text-emerald-500 shadow-sm' : 'text-gray-500'}`}
                        >
                            🛍️ Commande Client (Revenu / Pièce)
                        </button>
                    </div>
                </div>

                <div>
                    <label className={labelStyle}>{formData.isRevenue ? 'Nom du Client' : 'Nom du Fournisseur'}</label>
                    <input name="supplierName" value={formData.supplierName} onChange={handleMainChange} className={inputStyle} placeholder={formData.isRevenue ? "ex: Jean Dupont" : "Fournisseur / Entité"} required />
                </div>
                <div>
                    <label className={labelStyle}>{formData.isRevenue ? 'Numéro du Client / Contact' : 'Numéro du Fournisseur'}</label>
                    <input name="clientPhone" value={formData.clientPhone} onChange={handleMainChange} className={inputStyle} placeholder="07 XX XX XX XX" />
                </div>
                
                <div className="md:col-span-2">
                    <label className={labelStyle}>Type de Matériel</label>
                    <select name="purchaseType" value={formData.purchaseType} onChange={handleMainChange} className={inputStyle}>
                        {['Écran', 'MacBook Pro', 'MacBook Air', 'Batterie', 'Clavier', 'Carte Mère', 'Autre'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                {isMacbook && (
                    <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 animate-fade-in shadow-inner">
                        <div className="col-span-full font-black text-[10px] uppercase text-blue-400 mb-2 border-b border-white/5 pb-1">Spécifications MacBook</div>
                        <div>
                            <label className={labelStyle}>Modèle (AXXXX)</label>
                            <input value={formData.macModel} name="macModel" onChange={handleMainChange} className={inputStyle} placeholder="ex: A2442" />
                        </div>
                        <div>
                            <label className={labelStyle}>Puce / CPU</label>
                            <input value={formData.macDetails?.processor || ''} onChange={e => handleNestedChange('macDetails', 'processor', e.target.value)} className={inputStyle} placeholder="ex: M1 Pro" />
                        </div>
                        <div>
                            <label className={labelStyle}>Couleur</label>
                            <input 
                                value={formData.macColor || ''} 
                                name="macColor"
                                onChange={handleMainChange} 
                                className={inputStyle} 
                                placeholder="Sideral" 
                                list="macbook-colors"
                            />
                            {detectedColors.length > 0 && (
                                <div className="text-[9px] text-emerald-400 font-bold mt-1 flex items-center gap-1 animate-fade-in">
                                    <SparklesIcon className="w-3 h-3" /> Couleurs : {detectedColors.join(', ')}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className={labelStyle}>RAM (Go)</label>
                            <input value={formData.macDetails?.ram || ''} onChange={e => handleNestedChange('macDetails', 'ram', e.target.value)} className={inputStyle} placeholder="16" />
                        </div>
                        <div>
                            <label className={labelStyle}>SSD (Go/To)</label>
                            <input value={formData.macDetails?.ssd || ''} onChange={e => handleNestedChange('macDetails', 'ssd', e.target.value)} className={inputStyle} placeholder="512" />
                        </div>
                        <div>
                            <label className={labelStyle}>État / Boîte</label>
                            <div className="flex gap-1">
                                <select value={formData.macDetails?.condition || ''} onChange={e => handleNestedChange('macDetails', 'condition', e.target.value)} className={inputStyle}>
                                    <option value="Neuf">Neuf</option>
                                    <option value="Occasion">Occasion</option>
                                </select>
                                <select value={formData.macDetails?.hasBox || ''} onChange={e => handleNestedChange('macDetails', 'hasBox', e.target.value)} className={inputStyle}>
                                    <option value="Non">Sans Boîte</option>
                                    <option value="Oui">Avec Boîte</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {formData.purchaseType === 'Écran' && (
                    <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 animate-fade-in shadow-inner">
                        <div className="col-span-full font-black text-[10px] uppercase text-yellow-500 mb-2 border-b border-white/5 pb-1">Détails de l'Écran</div>
                        <div>
                            <label className={labelStyle}>Taille</label>
                            <input value={formData.partDetails?.size || ''} onChange={e => handleNestedChange('partDetails', 'size', e.target.value)} className={inputStyle} placeholder="ex: 13.3 pouces" />
                        </div>
                        <div>
                            <label className={labelStyle}>MacBook Cible</label>
                            <input value={formData.macModel} name="macModel" onChange={handleMainChange} className={inputStyle} placeholder="AXXXX" />
                        </div>
                        <div>
                            <label className={labelStyle}>Couleur</label>
                            <input 
                                value={formData.partDetails?.color || ''} 
                                onChange={e => handleNestedChange('partDetails', 'color', e.target.value)} 
                                className={inputStyle} 
                                placeholder="Silver" 
                                list="screen-colors"
                            />
                            {detectedColors.length > 0 && (
                                <div className="text-[9px] text-emerald-400 font-bold mt-1 flex items-center gap-1 animate-fade-in">
                                    <SparklesIcon className="w-3 h-3" /> Dispo : {detectedColors.join('/')}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className={labelStyle}>État</label>
                            <select value={formData.partDetails?.condition || ''} onChange={e => handleNestedChange('partDetails', 'condition', e.target.value)} className={inputStyle}>
                                <option value="Neuf">Neuf</option>
                                <option value="Occasion">Occasion</option>
                            </select>
                        </div>
                    </div>
                )}

                {(formData.purchaseType === 'Batterie' || formData.purchaseType === 'Clavier' || formData.purchaseType === 'Carte Mère') && (
                    <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 animate-fade-in shadow-inner">
                        <div className="col-span-full font-black text-[10px] uppercase text-emerald-400 mb-2 border-b border-white/5 pb-1">Détails Composant</div>
                        <div>
                            <label className={labelStyle}>MacBook Cible (AXXXX)</label>
                            <input value={formData.macModel} name="macModel" onChange={handleMainChange} className={inputStyle} placeholder="ex: A2337" />
                        </div>
                        <div>
                            <label className={labelStyle}>État Matériel</label>
                            <select value={formData.partDetails?.condition || ''} onChange={e => handleNestedChange('partDetails', 'condition', e.target.value)} className={inputStyle}>
                                <option value="Neuf">Neuf</option>
                                <option value="Occasion">Occasion</option>
                            </select>
                        </div>

                        {formData.purchaseType === 'Carte Mère' && (
                            <div className="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 animate-fade-in">
                                <div className="col-span-full font-black text-[9px] uppercase text-amber-400 flex items-center gap-2">
                                    <span>⚠️ CONFIGURATION DE LA CARTE MÈRE</span>
                                </div>
                                
                                <div>
                                    <label className={labelStyle}>RAM Carte Mère *</label>
                                    <div className="flex flex-wrap gap-1 mb-1">
                                        {['8 Go', '16 Go', '18 Go', '24 Go', '32 Go', '64 Go', '128 Go'].map(ramOption => (
                                            <button
                                                key={ramOption}
                                                type="button"
                                                onClick={() => handleNestedChange('partDetails', 'ram', ramOption)}
                                                className={`px-2 py-1 text-[9px] font-bold rounded-md border transition-all ${
                                                    formData.partDetails?.ram === ramOption
                                                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                                        : 'bg-black/20 border-white/5 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {ramOption}
                                            </button>
                                        ))}
                                    </div>
                                    <input 
                                        type="text" 
                                        value={formData.partDetails?.ram || ''} 
                                        onChange={e => handleNestedChange('partDetails', 'ram', e.target.value)} 
                                        placeholder="Préciser la RAM..." 
                                        className={`${inputStyle} text-xs p-2`} 
                                    />
                                </div>

                                <div>
                                    <label className={labelStyle}>Processeur (CPU) *</label>
                                    <div className="flex flex-wrap gap-1 mb-1">
                                        {['i5', 'i7', 'i9', 'M1', 'M2', 'M3', 'M4'].map(cpuOption => (
                                            <button
                                                key={cpuOption}
                                                type="button"
                                                onClick={() => handleNestedChange('partDetails', 'processor', cpuOption)}
                                                className={`px-2.5 py-1 text-[9px] font-bold rounded-md border transition-all ${
                                                    formData.partDetails?.processor === cpuOption
                                                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                                        : 'bg-black/20 border-white/5 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {cpuOption}
                                            </button>
                                        ))}
                                    </div>
                                    <input 
                                        type="text" 
                                        value={formData.partDetails?.processor || ''} 
                                        onChange={e => handleNestedChange('partDetails', 'processor', e.target.value)} 
                                        placeholder="Préciser le CPU..." 
                                        className={`${inputStyle} text-xs p-2`} 
                                    />
                                </div>

                                <div>
                                    <label className={labelStyle}>SSD *</label>
                                    <div className="flex flex-wrap gap-1 mb-1">
                                        {['128 Go', '256 Go', '512 Go', '1 To', '2 To'].map(ssdOption => (
                                            <button
                                                key={ssdOption}
                                                type="button"
                                                onClick={() => handleNestedChange('partDetails', 'ssd', ssdOption)}
                                                className={`px-2 py-1 text-[9px] font-bold rounded-md border transition-all ${
                                                    formData.partDetails?.ssd === ssdOption
                                                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                                        : 'bg-black/20 border-white/5 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {ssdOption}
                                            </button>
                                        ))}
                                    </div>
                                    <input 
                                        type="text" 
                                        value={formData.partDetails?.ssd || ''} 
                                        onChange={e => handleNestedChange('partDetails', 'ssd', e.target.value)} 
                                        placeholder="Préciser le SSD..." 
                                        className={`${inputStyle} text-xs p-2`} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <datalist id="macbook-colors">
                    {detectedColors.map(c => <option key={c} value={c} />)}
                </datalist>
                <datalist id="screen-colors">
                    {detectedColors.map(c => <option key={c} value={c} />)}
                </datalist>

                <div className="grid grid-cols-2 gap-4 md:col-span-2">
                    <div>
                        <label className={labelStyle}>Délai de Livraison</label>
                        <select name="deliveryDelay" value={formData.deliveryDelay} onChange={handleMainChange} className={inputStyle}>
                            {['5 jours ouvrables', '10 jours ouvrables', '15 jours ouvrables', '20 jours ouvrables', '25 jours ouvrables', '30 jours ouvrables', 'Immédiat'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelStyle}>Garantie Proposée</label>
                        <select name="warranty" value={formData.warranty} onChange={handleMainChange} className={inputStyle}>
                            {warrantyOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className={labelStyle}>Statut Actuel</label>
                    <select name="status" value={formData.status} onChange={handleMainChange} className={inputStyle}>
                        {['Brouillon', 'Commandé', 'Reçu', 'Payé', 'Annulé'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div className="space-y-3 border-t border-white/5 pt-6">
                <h3 className="font-black text-xs text-white uppercase tracking-widest flex items-center gap-2">
                    <PlusIcon className="w-4 h-4 text-blue-500" />
                    Lignes de Commandes
                </h3>
                {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-center p-3 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/20 transition-all">
                        <div className="col-span-6 flex items-center gap-2">
                            <input 
                                type="text" 
                                value={item.description} 
                                onChange={e => handleItemChange(index, 'description', e.target.value)} 
                                placeholder="Description" 
                                className="w-full bg-transparent text-white text-sm outline-none font-bold" 
                                required 
                            />
                            {index === 0 && isDescManual && computedDescription && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsDescManual(false);
                                        playTone(520, 80);
                                    }}
                                    title="Rétablir la description intelligente"
                                    className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/20 transition-all shrink-0 flex items-center justify-center"
                                >
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="col-span-2 bg-gray-800 rounded-lg p-2 text-center text-white text-sm font-mono" />
                        <input type="number" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', Number(e.target.value))} className="col-span-3 bg-gray-800 rounded-lg p-2 text-right text-white text-sm font-mono" />
                        <button type="button" onClick={() => removeItem(index)} className="col-span-1 flex justify-center text-gray-600 hover:text-red-500 transition-colors"><XCircleIcon className="w-5 h-5"/></button>
                    </div>
                ))}
                <button type="button" onClick={addItem} className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 px-2 py-1">
                    + Ajouter une ligne
                </button>
            </div>

            <div className="border-t border-white/5 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                <div className="bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/10">
                    <label className={labelStyle}>Avance Versée (F CFA)</label>
                    <input 
                        type="number" 
                        name="advance" 
                        value={formData.advance} 
                        onChange={handleMainChange} 
                        className="w-full p-4 bg-black/40 border border-emerald-500/30 rounded-2xl text-emerald-400 font-mono font-black text-2xl outline-none" 
                        placeholder="Acompte"
                    />
                </div>
                <div className="flex flex-col items-end">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-4 mb-2">
                        <span>Total: {total.toLocaleString()} F</span>
                        <span>Avance: - {formData.advance.toLocaleString()} F</span>
                    </div>
                    <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] mb-1">RESTE À RÉGLER (SOLDE)</p>
                    <p className={`text-5xl font-black tracking-tighter ${total - (formData.advance || 0) <= 0 ? 'text-emerald-500' : 'text-blue-500'}`}>
                        {(total - (formData.advance || 0)).toLocaleString()} <span className="text-xl">F CFA</span>
                    </p>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-white/5 pb-24 md:pb-0">
                <button type="button" onClick={onCancel} className="px-6 py-3 bg-gray-800 text-slate-400 font-black rounded-2xl text-xs uppercase hover:text-white transition-all">Annuler</button>
                <button type="submit" onClick={() => (window as Window & { _commandeAction?: string })._commandeAction = 'save'} className="px-8 py-3 bg-gray-700 text-white font-black rounded-2xl text-xs uppercase transition-all hidden md:block">Enregistrer</button>
                <button type="submit" onClick={() => (window as Window & { _commandeAction?: string })._commandeAction = 'print'} className="px-12 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-xs uppercase shadow-xl shadow-blue-900/40 transition-all hidden md:block">Enr. & Imprimer</button>
            </div>

            {/* Mobile Fixed Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-white/10 z-[100] flex md:hidden gap-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
                <button type="submit" onClick={() => (window as Window & { _commandeAction?: string })._commandeAction = 'save'} className="flex-1 py-4 bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest border border-white/10">
                    Enregistrer
                </button>
                <button type="submit" onClick={() => (window as Window & { _commandeAction?: string })._commandeAction = 'print'} className="flex-[2] py-4 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/40">
                    Enr. & Imprimer
                </button>
            </div>
        </form>
    );
};

interface CommandeListProps {
  onBack: () => void;
  initialEditId?: string | null;
}

const CommandeList: React.FC<CommandeListProps> = ({ onBack, initialEditId }) => {
    const { commandes, loading, addCommande, updateCommande, deleteCommande } = useCommandes();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [commandeToEdit, setCommandeToEdit] = useState<Commande | null>(null);
    const [commandeToPrint, setCommandeToPrint] = useState<Commande | null>(null);
    const [commandeToDelete, setCommandeToDelete] = useState<Commande | null>(null);
    const [isReportPrintOpen, setIsReportPrintOpen] = useState(false);
    const [showSummaryTable, setShowSummaryTable] = useState(true);
    const [activeTab, setActiveTab] = useState<'clients' | 'tgsci' | 'all'>('clients');
    const [historyCommande, setHistoryCommande] = useState<Commande | null>(null);

    // Counts for badge notifications
    const countClients = useMemo(() => commandes.filter(c => c.isRevenue === true).length, [commandes]);
    const countTgsCi = useMemo(() => commandes.filter(c => !c.isRevenue).length, [commandes]);
    const countAll = commandes.length;

    // Filtered list based on active tab select
    const filteredCommandes = useMemo(() => {
        if (activeTab === 'clients') {
            return commandes.filter(c => c.isRevenue === true);
        }
        if (activeTab === 'tgsci') {
            return commandes.filter(c => !c.isRevenue);
        }
        return commandes;
    }, [commandes, activeTab]);

    const reportData = useMemo(() => {
        // Exclude Cancelled (Annulé) orders for proper accounting
        const activeCmds = filteredCommandes.filter(c => c.status !== 'Annulé');
        
        const totalBilled = activeCmds.reduce((sum, c) => sum + (c.total || 0), 0);
        // If status is 'Payé', they are fully paid, so amount paid is considered equal to c.total
        const totalPaid = activeCmds.reduce((sum, c) => sum + (c.status === 'Payé' ? (c.total || 0) : (c.advance || 0)), 0);
        const remainingBalance = activeCmds.reduce((sum, c) => sum + (c.status === 'Payé' ? 0 : Math.max(0, (c.total || 0) - (c.advance || 0))), 0);

        return {
            items: activeCmds,
            totalBilled,
            totalPaid,
            remainingBalance,
            count: activeCmds.length
        };
    }, [filteredCommandes]);

    const initialHandled = React.useRef(false);
    useEffect(() => {
        if (!initialHandled.current && initialEditId && commandes.length > 0) {
            const cmd = commandes.find(c => c.id === initialEditId);
            if (cmd) {
                const timer = setTimeout(() => {
                    setCommandeToEdit(cmd);
                    setIsFormOpen(true);
                    initialHandled.current = true;
                }, 0);
                return () => clearTimeout(timer);
            }
        }
    }, [initialEditId, commandes]);

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

    const confirmDelete = async () => {
        if (commandeToDelete) {
            await deleteCommande(commandeToDelete.id);
            setCommandeToDelete(null);
        }
    };

    if (loading) return <div className="text-center py-20 text-slate-500 animate-pulse font-black uppercase tracking-widest">Accès aux serveurs logistiques...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center gap-4">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-black uppercase text-xs tracking-widest">
                    <ArrowLeftIcon className="w-5 h-5"/> Retour
                </button>
                <button onClick={() => { setCommandeToEdit(null); setIsFormOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-900/20 uppercase text-xs tracking-widest">
                    <PlusCircleIcon className="w-5 h-5"/> Nouvelle Commande
                </button>
            </div>

            {/* SÉLECTEUR DE FILTRE DE COMMANDE DISSOCIÉE */}
            <div className="p-1.5 bg-slate-950/40 rounded-2xl border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-1.5">
                <button 
                    onClick={() => setActiveTab('clients')} 
                    className={`px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'clients' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <div className="flex items-center gap-2">
                        <span>🛍️ Commandes Clients (Revenu)</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${activeTab === 'clients' ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}>{countClients}</span>
                    </div>
                    <span className="text-[8px] opacity-70 normal-case font-semibold">Pièces détachées MacBook (Écran, Clavier, Batterie, etc.)</span>
                </button>
                <button 
                    onClick={() => setActiveTab('tgsci')} 
                    className={`px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'tgsci' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <div className="flex items-center gap-2">
                        <span>📦 Commandes TGS CI (Stock)</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${activeTab === 'tgsci' ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}>{countTgsCi}</span>
                    </div>
                    <span className="text-[8px] opacity-70 normal-case font-semibold">Approvisionnements internes pour le stock de l'atelier</span>
                </button>
                <button 
                    onClick={() => setActiveTab('all')} 
                    className={`px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <div className="flex items-center gap-2">
                        <span>🌐 Toutes les Commandes</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}>{countAll}</span>
                    </div>
                    <span className="text-[8px] opacity-70 normal-case font-semibold">Affichage consolidé de tous les flux d'approvisionnement</span>
                </button>
            </div>

            {/* Nouveau : Point Financier & Comptable Automatisé des Commandes */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h2 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-3 bg-indigo-400 rounded-sm inline-block"></span>
                            POINT COMPTABLE ET FINANCIER DES COMMANDES
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Calcul et cumul automatiques des encours par client et fournisseur</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsReportPrintOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-black uppercase tracking-wider transition-all"
                            title="Imprimer le point financier"
                        >
                            <PrinterIcon className="w-4 h-4 text-slate-300" />
                            Imprimer le Point
                        </button>
                        <button 
                            onClick={() => setShowSummaryTable(!showSummaryTable)}
                            className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/20 text-xs font-black uppercase tracking-wider transition-all"
                        >
                            {showSummaryTable ? 'Masquer la Synthèse' : 'Afficher la Synthèse'}
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* TOTAL COMMANDÉ */}
                    <div className="glass p-5 rounded-2xl flex items-center border border-white/10 shadow-xl bg-slate-900/40 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <div className="p-3 mr-4 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                            <SparklesIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Montant Total Commandé</p>
                            <p className="text-lg font-black text-white font-mono">
                                {reportData.totalBilled.toLocaleString('fr-FR')} F CFA
                            </p>
                            <span className="text-[9px] font-bold text-slate-500 uppercase">{reportData.count} commande(s) active(s)</span>
                        </div>
                    </div>

                    {/* TOTAL VERSÉ */}
                    <div className="glass p-5 rounded-2xl flex items-center border border-white/10 shadow-xl bg-slate-900/40 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                        <div className="p-3 mr-4 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                            <BanknotesIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Montant Total Versé (Acomptes)</p>
                            <p className="text-lg font-black text-emerald-400 font-mono">
                                {reportData.totalPaid.toLocaleString('fr-FR')} F CFA
                            </p>
                            <span className="text-[9px] font-bold text-emerald-500/80 uppercase">Financé à {reportData.totalBilled > 0 ? Math.round((reportData.totalPaid / reportData.totalBilled) * 100) : 0}%</span>
                        </div>
                    </div>

                    {/* RESTE DÛ */}
                    <div className="glass p-5 rounded-2xl flex items-center border border-white/10 shadow-xl bg-slate-900/40 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                        <div className="p-3 mr-4 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20">
                            <ExclamationTriangleIcon className="h-6 w-6 text-amber-500 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Montant Total Reste Dû</p>
                            <p className="text-lg font-black text-amber-400 font-mono animate-pulse">
                                {reportData.remainingBalance.toLocaleString('fr-FR')} F CFA
                            </p>
                            <span className="text-[9px] font-bold text-amber-500/80 uppercase">Cumul des soldes restant à percevoir / régulariser</span>
                        </div>
                    </div>
                </div>

                {/* Synthèse Tableau Détaillée */}
                {showSummaryTable && (
                    <div className="glass rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-zinc-950/20 p-5 space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center bg-white/[0.02] -mx-5 -mt-5 px-5 py-4 border-b border-white/5">
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <UserIcon className="w-5 h-5 text-indigo-400" />
                                Rapport Simplifié de l'Encours des Commandes par Client & Modèle
                            </h3>
                            <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 border border-emerald-500/20 rounded-lg uppercase tracking-wider">
                                Comptabilité Automatisée
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/[0.01]">
                                        <th className="py-3 px-3">N° Réf.</th>
                                        <th className="py-3 px-3">Client Bénéficiaire</th>
                                        <th className="py-3 px-3">Contact Client</th>
                                        <th className="py-3 px-3">Modèle Appareil</th>
                                        <th className="py-3 px-3 text-right">Mnt. Total</th>
                                        <th className="py-3 px-3 text-right">Mnt. Versé</th>
                                        <th className="py-3 px-3 text-right">Reste Dû</th>
                                        <th className="py-3 px-3 text-center">Statut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-slate-300 font-semibold font-mono">
                                    {reportData.items.map((it) => {
                                        const dueAmount = it.status === 'Payé' ? 0 : Math.max(0, it.total - (it.advance || 0));
                                        const paidAmount = it.status === 'Payé' ? it.total : (it.advance || 0);
                                        return (
                                            <tr key={it.id} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-3 text-indigo-400 font-bold">{it.numero}</td>
                                                <td className="py-3 px-3 text-white uppercase font-sans text-[11px]">{it.clientName || 'STOCK INTERNE'}</td>
                                                <td className="py-3 px-3 text-slate-400 font-sans">{it.clientPhone || 'Aucun'}</td>
                                                <td className="py-3 px-3 font-sans">
                                                    <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[9px] text-indigo-300 font-bold uppercase">
                                                        {it.macModel || 'PIÈCE / AUTRE'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right text-white font-bold">{it.total.toLocaleString()} F</td>
                                                <td className="py-3 px-3 text-right text-emerald-400">{paidAmount.toLocaleString()} F</td>
                                                <td className={`py-3 px-3 text-right font-black ${dueAmount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                                                    {dueAmount.toLocaleString()} F
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className={`px-2 py-0.5 font-sans font-bold text-[8.5px] rounded border uppercase tracking-wider ${
                                                        it.status === 'Payé' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                                    }`}>
                                                        {it.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    
                                    {/* AUTOMATED TOTALS ROW (LIGNE DES TOTAUX) */}
                                    <tr className="bg-white/[0.04] font-black border-t-2 border-white/15 text-white font-sans text-xs">
                                        <td colSpan={4} className="py-4 px-3 uppercase text-[10px] tracking-widest text-slate-400">
                                            Cumul total des encours calculé automatiquement
                                        </td>
                                        <td className="py-4 px-3 text-right font-mono text-indigo-400 text-sm font-black">
                                            {reportData.totalBilled.toLocaleString()} F
                                        </td>
                                        <td className="py-4 px-3 text-right font-mono text-emerald-400 text-sm font-black">
                                            {reportData.totalPaid.toLocaleString()} F
                                        </td>
                                        <td className="py-4 px-3 text-right font-mono text-amber-500 text-sm font-black">
                                            {reportData.remainingBalance.toLocaleString()} F
                                        </td>
                                        <td className="py-4 px-3 text-center">
                                            <span className="px-2 py-1 bg-indigo-600 rounded text-white text-[8px] uppercase font-black tracking-wider">SOMME</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-4">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Registre des Commandes Actives</h3>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Liste complète pour gestion logistique</span>
            </div>

            <div className="glass rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4 text-center">Actions</th>
                            <th className="px-6 py-4">Référence</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Provenance / Destination</th>
                            <th className="px-6 py-4">Modèle</th>
                            <th className="px-6 py-4">Matériel & Type</th>
                            <th className="px-6 py-4">Garantie & Délai</th>
                            <th className="px-6 py-4">Total (Solde)</th>
                            <th className="px-6 py-4">Statut</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                        {filteredCommandes.map(c => {
                                                           const balance = c.status === 'Payé' ? 0 : c.total - (c.advance || 0);
                                                           return (
                                <tr key={c.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button 
                                                onClick={() => {
                                                    const url = new URL(window.location.href);
                                                    url.searchParams.set('role', 'engagementssav');
                                                    url.searchParams.set('action', 'create');
                                                    if (c.numero) url.searchParams.set('numeroCommandeOrigine', c.numero);
                                                    if (c.clientName || c.supplierName) url.searchParams.set('nomClient', c.clientName || c.supplierName);
                                                    if (c.clientPhone) url.searchParams.set('telephoneClient', c.clientPhone);
                                                    if (c.macModel) url.searchParams.set('appareil', c.macModel);
                                                    window.history.pushState({}, '', url);
                                                    window.dispatchEvent(new PopStateEvent('popstate'));
                                                }}
                                                className="p-3 bg-white/5 hover:bg-yellow-600 rounded-xl text-yellow-500 hover:text-white transition-all min-h-[44px] min-w-[44px] flex items-center justify-center font-black text-xs"
                                                title="Contrat SAV pour cette commande"
                                            >
                                                SAV
                                            </button>
                                            <button onClick={() => {setCommandeToEdit(c); setIsFormOpen(true);}} className="p-3 bg-white/5 hover:bg-indigo-600 rounded-xl text-slate-400 hover:text-white transition-all min-h-[44px] min-w-[44px] flex items-center justify-center" title="Modifier"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => setHistoryCommande(c)} className="p-3 bg-white/5 hover:bg-violet-600 rounded-xl text-slate-400 hover:text-white transition-all min-h-[44px] min-w-[44px] flex items-center justify-center" title="Historique de traçabilité"><ClockIcon className="w-5 h-5"/></button>
                                            <button onClick={() => setCommandeToPrint(c)} className="p-3 bg-white/5 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all min-h-[44px] min-w-[44px] flex items-center justify-center" title="Imprimer"><PrinterIcon className="w-5 h-5"/></button>
                                            <button onClick={() => setCommandeToDelete(c)} className="p-3 bg-white/5 hover:bg-rose-600 rounded-xl text-slate-400 hover:text-white transition-all min-h-[44px] min-w-[44px] flex items-center justify-center" title="Supprimer"><TrashIcon className="w-5 h-5"/></button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-indigo-400 font-bold">{c.numero}</td>
                                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{new Date(c.date).toLocaleDateString('fr-FR')}</td>
                                    <td className="px-6 py-4">
                                        {c.isRevenue ? (
                                            <>
                                                <p className="font-black text-emerald-400 uppercase flex items-center gap-1 text-[11px]">
                                                    <span>🛍️ Client :</span>
                                                    <span>{c.supplierName}</span>
                                                </p>
                                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Pièces de réparation</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="font-black text-blue-400 uppercase flex items-center gap-1 text-[11px]">
                                                    <span>📦 Stock :</span>
                                                    <span>{c.supplierName}</span>
                                                </p>
                                                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">{c.clientName || 'Ravitaillement TGS-CI'}</p>
                                            </>
                                        )}
                                        {c.clientPhone && <p className="text-[9px] text-zinc-400 font-mono font-bold mt-1">📞 {c.clientPhone}</p>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {c.macModel ? (
                                            <span className="px-2 py-1 bg-white/5 rounded text-[10px] border border-white/5 font-black text-blue-400 uppercase">{c.macModel}</span>
                                        ) : (
                                            <span className="text-slate-600">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-black text-white text-xs uppercase">{c.purchaseType || 'MATÉRIEL'}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-[10px] font-bold text-emerald-400 uppercase">Gar: {c.warranty || '30J'}</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-black">{c.deliveryDelay}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-mono font-black text-white text-xs">{c.total.toLocaleString()} F</p>
                                        {balance > 0 && <p className="text-[9px] text-orange-400 font-bold">Dû: {balance.toLocaleString()} F</p>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-widest ${getStatusStyles(c.status)}`}>
                                            {c.status}
                                         </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} containerClassName="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-5xl m-4 p-8">
                <CommandeForm 
                    commandeToEdit={commandeToEdit} 
                    defaultIsRevenue={activeTab === 'clients'}
                    onCancel={() => setIsFormOpen(false)} 
                    onSave={async (data, action) => {
                        let savedCmd: Commande;
                        if ('id' in data) {
                            await updateCommande(data as Commande);
                            savedCmd = data as Commande;
                        } else {
                            savedCmd = await addCommande(data);
                        }
                        setIsFormOpen(false);
                        if (action === 'print') {
                            setCommandeToPrint(savedCmd);
                        }
                    }} 
                />
            </Modal>
            
            {commandeToPrint && (
                <PreviewModal isOpen={!!commandeToPrint} onClose={() => setCommandeToPrint(null)} fileName={`CMD-${commandeToPrint.numero}.pdf`}>
                    <PrintableDocument
                        title={commandeToPrint.isRevenue ? "Bon de Commande Pièce Client" : "Bon de Commande Stock TGS-CI"}
                        numero={commandeToPrint.numero}
                        date={commandeToPrint.date}
                        clientLabel={commandeToPrint.isRevenue ? "Destinataire / Client" : "Fournisseur Officiel"}
                        clientName={commandeToPrint.supplierName}
                        clientPhone={commandeToPrint.clientPhone}
                        macModel={commandeToPrint.macModel}
                        items={commandeToPrint.items}
                        total={commandeToPrint.total}
                        advance={commandeToPrint.status === 'Payé' ? commandeToPrint.total : (commandeToPrint.advance || 0)}
                        warranty={commandeToPrint.warranty}
                        message={commandeToPrint.message}
                    />
                </PreviewModal>
            )}

            <ConfirmationModal
                isOpen={!!commandeToDelete}
                onClose={() => setCommandeToDelete(null)}
                onConfirm={confirmDelete}
                title="Supprimer la commande ?"
                message={`Cette action effacera définitivement le document N° ${commandeToDelete?.numero}. Confirmer ?`}
                confirmText="Oui, Supprimer"
            />

            {isReportPrintOpen && (
                <PreviewModal
                    isOpen={isReportPrintOpen}
                    onClose={() => setIsReportPrintOpen(false)}
                    fileName={`POINT_FINANCIER_COMMANDES_${new Date().toISOString().split('T')[0]}.pdf`}
                >
                    <div className="printable-page">
                        {/* Print Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', fontFamily: '"Inter", sans-serif' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                    <AppleLogo style={{ width: '22px', height: '22px', color: '#000' }} />
                                    <h1 style={{ fontSize: '20pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
                                </div>
                                <div style={{ fontSize: '6.5pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666' }}>L'excellence de la réparation MacBook &amp; Immobilier</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <h4 style={{ fontSize: '10pt', fontWeight: '900', textTransform: 'uppercase', margin: 0, color: '#111' }}>
                                    {activeTab === 'all' 
                                        ? "Point Financier Général (Consolidé)" 
                                        : activeTab === 'clients' 
                                            ? "Point Financier Pièces Clients (Revenu)" 
                                            : "Point Financier Appro Stock (TGS-CI)"}
                                </h4>
                                <div style={{ fontSize: '7pt', color: '#666', marginTop: '2px' }}>G&eacute;n&eacute;r&eacute; le: {new Date().toLocaleDateString('fr-FR')} &agrave; {new Date().toLocaleTimeString('fr-FR')}</div>
                            </div>
                        </div>

                        {/* Summary Block */}
                        <div style={{ border: '1pt solid #000', padding: '15px', marginBottom: '20px', background: '#F9F9F9', fontFamily: '"Inter", sans-serif' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15.5px', textAlign: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '6.5pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666', marginBottom: '2px' }}>Montant Total Commandé</div>
                                    <strong style={{ fontSize: '11pt', fontFamily: 'monospace' }}>{reportData.totalBilled.toLocaleString()} F CFA</strong>
                                </div>
                                <div style={{ borderLeft: '0.5pt solid #ccc', borderRight: '0.5pt solid #ccc' }}>
                                    <div style={{ fontSize: '6.5pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666', marginBottom: '2px' }}>Total Cumulé Versé</div>
                                    <strong style={{ fontSize: '11pt', color: '#1b4d3e', fontFamily: 'monospace' }}>{reportData.totalPaid.toLocaleString()} F CFA</strong>
                                </div>
                                <div>
                                    <div style={{ fontSize: '6.5pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666', marginBottom: '2px' }}>Solde Reste Dû</div>
                                    <strong style={{ fontSize: '11pt', color: '#8c0000', fontFamily: 'monospace' }}>{reportData.remainingBalance.toLocaleString()} F CFA</strong>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <h3 style={{ fontSize: '9pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1pt solid #000', paddingBottom: '3px', fontFamily: '"Inter", sans-serif' }}>
                            D&eacute;tail Comptable des Commandes ({reportData.items.length} lignes active(s))
                        </h3>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt', fontFamily: '"Inter", sans-serif' }}>
                            <thead>
                                <tr style={{ borderBottom: '1pt solid #000', textTransform: 'uppercase', fontWeight: 'bold', background: '#F0F0F0' }}>
                                    <th style={{ padding: '6px 4px', textAlign: 'left' }}>R&eacute;f. N&deg;</th>
                                    <th style={{ padding: '6px 4px', textAlign: 'left' }}>Client</th>
                                    <th style={{ padding: '6px 4px', textAlign: 'left' }}>Contact</th>
                                    <th style={{ padding: '6px 4px', textAlign: 'left' }}>Mod&egrave;le d'appareil</th>
                                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>Total (F)</th>
                                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>Vers&eacute; (F)</th>
                                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>Reste (F)</th>
                                    <th style={{ padding: '6px 4px', textAlign: 'center' }}>Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.items.map((it) => {
                                    const dueAmount = Math.max(0, it.total - (it.advance || 0));
                                    return (
                                        <tr key={it.id} style={{ borderBottom: '0.5pt solid #eee' }}>
                                            <td style={{ padding: '6px 4px', fontFamily: 'monospace', fontWeight: 'bold' }}>{it.numero}</td>
                                            <td style={{ padding: '6px 4px', textTransform: 'uppercase' }}>{it.clientName || 'STOCK INTERNE'}</td>
                                            <td style={{ padding: '6px 4px' }}>{it.clientPhone || 'Aucun'}</td>
                                            <td style={{ padding: '6px 4px', textTransform: 'uppercase', fontStyle: 'italic' }}>{it.macModel || 'PI&Egrave;CE / AUTRE'}</td>
                                            <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{it.total.toLocaleString()}</td>
                                            <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', color: '#2b5a2b' }}>{it.advance.toLocaleString()}</td>
                                            <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: dueAmount > 0 ? '#b27b00' : '#444' }}>{dueAmount.toLocaleString()}</td>
                                            <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: '6.5pt', textTransform: 'uppercase' }}>{it.status}</td>
                                        </tr>
                                    );
                                })}

                                {/* PRINT TOTALS ROW */}
                                <tr style={{ borderTop: '1.5pt solid #000', fontWeight: '900', background: '#F5F5F5' }}>
                                    <td colSpan={4} style={{ padding: '8px 4px', textTransform: 'uppercase', fontSize: '7pt' }}>TOTAL CUMUL&Eacute; DU POINT :</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace', fontSize: '8pt' }}>{reportData.totalBilled.toLocaleString()} F</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace', fontSize: '8pt', color: '#2b5a2b' }}>{reportData.totalPaid.toLocaleString()} F</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace', fontSize: '8pt', color: '#8c0000' }}>{reportData.remainingBalance.toLocaleString()} F</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center' }}>-</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Signatures */}
                        <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px', fontSize: '8pt' }}>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontWeight: 'bold', textDecoration: 'underline', margin: '0 0 45px 0' }}>Signature Direction Financi&egrave;re</p>
                                <p style={{ fontSize: '7pt', color: '#777' }}>(Visa pour r&eacute;glement et encaissements)</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontWeight: 'bold', textDecoration: 'underline', margin: '0 0 45px 0' }}>Visa de l'Agent de Caisse / TGS-CI</p>
                                <p style={{ fontSize: '7pt', color: '#777' }}>(G&eacute;n&eacute;r&eacute; num&eacute;riquement de mani&egrave;re conforme)</p>
                            </div>
                        </div>
                    </div>
                </PreviewModal>
            )}

            {historyCommande && (
                <Modal isOpen={!!historyCommande} onClose={() => setHistoryCommande(null)}>
                    <div className="space-y-6">
                        <div className="flex justify-between items-center pb-4 border-b border-white/10">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <ClockIcon className="w-6 h-6 text-violet-400" />
                                Historique Traçabilité Commande
                            </h3>
                            <span className="font-mono text-sm text-violet-400 font-bold">{historyCommande.numero}</span>
                        </div>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {(!historyCommande.history || historyCommande.history.length === 0) ? (
                                <p className="text-slate-500 text-center py-8 italic text-xs">Aucun historique disponible pour cette commande.</p>
                            ) : (
                                [...historyCommande.history].reverse().map((entry, idx) => (
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
                            <button onClick={() => setHistoryCommande(null)} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-all">
                                Fermer
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default CommandeList;
