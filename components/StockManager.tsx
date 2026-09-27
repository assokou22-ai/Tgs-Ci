
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import useStock from '../hooks/useStock.ts';
import { StockItem, RepairTicket } from '../types.ts';
import { dbGetStock } from '../services/dbService.ts';
import { PrinterIcon, PlusCircleIcon, PencilIcon, BanknotesIcon, ListBulletIcon, WrenchScrewdriverIcon, MagnifyingGlassIcon, TrashIcon, CubeIcon, CheckCircleIcon, SparklesIcon } from './icons.tsx';
import Modal from './Modal.tsx';
import PrintableStockList from './PrintableStockList.tsx';
import { playTone } from '../utils/audio.ts';
import PreviewModal from './PreviewModal.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import PaginationControls from './PaginationControls.tsx';
import TableSkeleton from './skeletons/TableSkeleton.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import { useToastContext } from '../context/ToastContext.tsx';

const StockForm: React.FC<{
    itemToEdit?: StockItem;
    onSave: (item: Omit<StockItem, 'id' | 'updatedAt'> | StockItem) => Promise<void>;
    onCancel: () => void;
    showReference: boolean;
}> = ({ itemToEdit, onSave, onCancel, showReference }) => {
    const { showToast } = useToastContext();
    const [item, setItem] = useState({
        name: itemToEdit?.name || '',
        quantity: itemToEdit?.quantity || 0,
        category: itemToEdit?.category || '',
        reference: itemToEdit?.reference || '',
        cost: itemToEdit?.cost || 0,
        sellingPrice: itemToEdit?.sellingPrice || 0,
        color: itemToEdit?.color || '',
        compatibleModels: itemToEdit?.compatibleModels?.join(', ') || '',
        condition: itemToEdit?.condition || 'Neuf',
        alertThreshold: itemToEdit?.alertThreshold || 1,
        supplier: itemToEdit?.supplier || '',
        location: itemToEdit?.location || '',
        entryDate: itemToEdit?.entryDate || new Date().toISOString().split('T')[0],
        isActive: itemToEdit?.isActive !== undefined ? itemToEdit.isActive : true,
        customFields: itemToEdit?.customFields || {},
    });

    const [transport, setTransport] = useState(0);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        const newValue = type === 'number' ? parseFloat(value) || 0 : 
                         type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        
        setItem(prev => ({ ...prev, [name]: newValue }));
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const finalItem = {
                ...item,
                compatibleModels: item.compatibleModels.split(',').map(s => s.trim()).filter(Boolean)
            };
            await onSave(itemToEdit ? { ...itemToEdit, ...finalItem } : finalItem as StockItem);
        } catch (error) {
            console.error("Failed to save stock item:", error);
            showToast("L'enregistrement du stock a échoué.", "error");
        }
    };

    const totalCost = item.cost + transport;
    const profit = item.sellingPrice > 0 ? item.sellingPrice - totalCost : 0;

    const labelStyle = "block text-[10px] font-black uppercase text-gray-500 mb-1 ml-1 tracking-widest";
    const inputStyle = "w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-black dark:text-white border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 text-white p-2 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black uppercase tracking-tighter italic">
                    {itemToEdit ? 'Éditer l\'article' : 'Nouvel article stock'}
                </h2>
                <div className="flex items-center gap-2">
                    <span className={labelStyle}>Statut Actif</span>
                    <input 
                        type="checkbox" 
                        name="isActive" 
                        checked={item.isActive} 
                        onChange={(e) => setItem(p => ({...p, isActive: e.target.checked}))}
                        className="w-5 h-5 accent-blue-500"
                    />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                        <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Identification</h3>
                        <div>
                            <label className={labelStyle}>Désignation de l'article (Désignation)</label>
                            <input name="name" value={item.name} onChange={handleChange} placeholder="ex: Écran iPhone 13" className={inputStyle} required/>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelStyle}>Catégorie</label>
                                <select name="category" value={item.category} onChange={handleChange} className={inputStyle} required>
                                    <option value="">-- Choisir --</option>
                                    <option value="ECRAN">Écran</option>
                                    <option value="BATTERIE">Batterie</option>
                                    <option value="CLAVIER">Clavier</option>
                                    <option value="TRACKPAD">Trackpad</option>
                                    <option value="CARTE_MERE">Carte Mère</option>
                                    <option value="CONNECTIQUE">Connectique</option>
                                    <option value="AUTRE">Autre</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelStyle}>Couleur</label>
                                <input name="color" list="stock-colors-list" value={item.color} onChange={handleChange} placeholder="Silver, Blush, Citrus, Indigo..." className={inputStyle} />
                                <datalist id="stock-colors-list">
                                    <option value="Silver" />
                                    <option value="Blush" />
                                    <option value="Citrus" />
                                    <option value="Indigo" />
                                    <option value="Gris sidéral" />
                                    <option value="Argent" />
                                    <option value="Minuit" />
                                    <option value="Lumière stellaire" />
                                    <option value="Noir sidéral" />
                                    <option value="Or" />
                                </datalist>
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>Modèles compatibles (modele_compatible)</label>
                            <input name="compatibleModels" value={item.compatibleModels} onChange={handleChange} placeholder="A2338, A2159 (Séparez par virgules)" className={inputStyle} />
                        </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                        <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em] mb-2">Logistique & Inventaire</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className={labelStyle}>Quantité</label>
                                <input name="quantity" type="number" value={item.quantity} onChange={handleChange} className={inputStyle} required/>
                            </div>
                            <div>
                                <label className={labelStyle}>Seuil Alerte (seuil_alerte)</label>
                                <input name="alertThreshold" type="number" value={item.alertThreshold} onChange={handleChange} className={inputStyle} />
                            </div>
                            <div>
                                <label className={labelStyle}>État (etat)</label>
                                <select name="condition" value={item.condition} onChange={handleChange} className={inputStyle}>
                                    <option value="Neuf">Neuf</option>
                                    <option value="Occasion">Occasion</option>
                                    <option value="Reconditionné">Reconditionné</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelStyle}>Fournisseur</label>
                                <input name="supplier" value={item.supplier} onChange={handleChange} className={inputStyle} placeholder="Nom du fournisseur" />
                            </div>
                            <div>
                                <label className={labelStyle}>Emplacement</label>
                                <input name="location" value={item.location} onChange={handleChange} className={inputStyle} placeholder="ex: Bac A2" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/10 space-y-5">
                        <h3 className="text-xs font-black text-emerald-400 uppercase flex items-center gap-2 mb-2">
                            <BanknotesIcon className="w-5 h-5"/> 
                            Analyse Commerciale
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelStyle}>Coût Achat (cout_achat)</label>
                                <input name="cost" type="number" value={item.cost} onChange={handleChange} className={`${inputStyle} text-red-400 font-mono`} />
                            </div>
                            <div>
                                <label className={labelStyle}>Prix Vente (prix_vente)</label>
                                <input name="sellingPrice" type="number" value={item.sellingPrice} onChange={handleChange} className={`${inputStyle} text-emerald-400 font-mono font-black`} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelStyle}>Frais Transport</label>
                                <input type="number" value={transport} onChange={(e) => setTransport(parseFloat(e.target.value) || 0)} className={inputStyle} />
                            </div>
                            <div>
                                <label className={labelStyle}>Date Entrée (date_entree)</label>
                                <input type="date" name="entryDate" value={item.entryDate} onChange={handleChange} className={inputStyle} />
                            </div>
                        </div>

                        <div className="p-5 bg-black/40 rounded-2xl border border-white/5 space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-slate-500 uppercase">Coût de revient :</span>
                                <span className="text-white">{totalCost.toLocaleString()} F</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-slate-500 uppercase">Bénéfice projeté :</span>
                                <span className="text-emerald-400">+{profit.toLocaleString()} F</span>
                            </div>
                        </div>
                    </div>
                    
                    {showReference && (
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <label className={labelStyle}>Référence Constructeur / SKU</label>
                            <input name="reference" value={item.reference} onChange={handleChange} placeholder="Référence Apple..." className={inputStyle}/>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
                <button type="button" onClick={onCancel} className="px-8 py-3 bg-gray-800 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:text-white transition-all">Annuler</button>
                <button type="submit" className="px-12 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-2xl shadow-blue-900/40 text-[10px] uppercase tracking-widest transition-all">Valider l'Article</button>
            </div>
        </form>
    );
};

interface StockManagerProps {
    addLog: (category: 'Service' | 'Stock', type: 'Ajout' | 'Suppression', message: string) => void;
    initialFilter?: string;
    tickets?: RepairTicket[];
}

const StockManager: React.FC<StockManagerProps> = ({ addLog, initialFilter, tickets }) => {
    const { 
        stock, movements, addStockItem, updateStockItem, deleteStockItem, 
        loading,
        currentPage, totalPages, goToPage, setFilter, totalStock
    } = useStock();
    
    const [allStock, setAllStock] = useState<StockItem[]>([]);

    const fetchAllStock = useCallback(async () => {
        try {
            const fullStock = await dbGetStock();
            setTimeout(() => {
                setAllStock(fullStock);
            }, 0);
        } catch (e) {
            console.error("Failed to fetch full stock for stats:", e);
        }
    }, []);

    useEffect(() => {
        fetchAllStock();
    }, [stock, movements, fetchAllStock]);

    // Calculs financiers en temps réel (disponible, vendu, et montant de la remise)
    const stats = useMemo(() => {
        // 1. Stock Disponible
        let dispoQt = 0;
        let dispoValAchat = 0;
        let dispoValVente = 0;

        allStock.forEach(item => {
            if (item.isActive && item.quantity > 0) {
                dispoQt += item.quantity;
                dispoValAchat += item.quantity * (item.cost || 0);
                dispoValVente += item.quantity * (item.sellingPrice || 0);
            }
        });

        // 2. Stock Vendu & Remises (depuis tous les tickets/fiches de réparation)
        let venduQt = 0;
        let venduValVente = 0;
        let venduValAchat = 0;
        let remiseTotal = 0;

        (tickets || []).forEach(ticket => {
            (ticket.ligneVentes || []).forEach(line => {
                if (line.type_ligne === 'article_stock' && line.statut_ligne === 'utilise') {
                    const qte = line.quantite || 0;
                    venduQt += qte;
                    venduValVente += qte * (line.prix_unitaire_final || 0);
                    venduValAchat += qte * (line.prix_achat || 0);

                    if ((line.prix_unitaire_standard || 0) > (line.prix_unitaire_final || 0)) {
                        remiseTotal += qte * ((line.prix_unitaire_standard || 0) - (line.prix_unitaire_final || 0));
                    }
                }
            });
        });

        return {
            dispoQt,
            dispoValAchat,
            dispoValVente,
            venduQt,
            venduValVente,
            venduValAchat,
            remiseTotal,
        };
    }, [allStock, tickets]);

    const { settings } = useAppSettings();
    const [activeTab, setActiveTab] = useState<'inventory' | 'usage'>('inventory');
    const [searchQuery, setSearchQuery] = useState(initialFilter || '');
    const [isFormOpen, setFormOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState<StockItem | undefined>();
    const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    
    const initialHandled = useRef(false);
    useEffect(() => {
        if (!initialHandled.current && initialFilter) {
            const timer = setTimeout(() => {
                setSearchQuery(initialFilter);
                setFilter(initialFilter);
                initialHandled.current = true;
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [initialFilter, setFilter]);
    
    useEffect(() => {
        const handler = setTimeout(() => {
            setFilter(searchQuery);
            goToPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery, setFilter, goToPage]);
    
    const handleSave = async (itemData: Omit<StockItem, 'id' | 'updatedAt'> | StockItem) => {
        if ('id' in itemData) {
            await updateStockItem(itemData);
            addLog('Stock', 'Ajout', `Stock modifié: ${itemData.name} (Qté: ${itemData.quantity})`);
        } else {
            await addStockItem(itemData);
            addLog('Stock', 'Ajout', `Article ajouté: ${itemData.name}`);
        }
        playTone(440, 100);
        setFormOpen(false);
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            const wasDeleted = await deleteStockItem(itemToDelete.id);
            if (wasDeleted) {
                addLog('Stock', 'Suppression', `Article supprimé: ${itemToDelete.name}`);
            }
            setItemToDelete(null);
        }
    };
    
    const handlePrint = () => {
        setIsPreviewOpen(true);
    };

    return (
        <div className="bg-gray-800 p-4 md:p-6 rounded-3xl shadow-2xl border border-white/5 animate-fade-in">
            {/* TABS SELECTOR */}
            <div className="flex border-b border-white/10 mb-8 overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setActiveTab('inventory')}
                    className={`px-8 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-3 shrink-0 ${activeTab === 'inventory' ? 'border-blue-500 text-white bg-blue-600/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    <ListBulletIcon className="w-5 h-5" /> Inventaire Global
                </button>
                <button 
                    onClick={() => setActiveTab('usage')}
                    className={`px-8 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-3 shrink-0 ${activeTab === 'usage' ? 'border-emerald-500 text-white bg-emerald-600/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    <WrenchScrewdriverIcon className="w-5 h-5" /> Journal des Sorties (Fiches)
                </button>
            </div>

            {/* SYSTÈME DE SUPERVISION FINANCIÈRE DE L'INVENTAIRE EN TEMPS RÉEL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in">
                {/* CARD 1: DISPONIBLE */}
                <div className="bg-zinc-950/40 backdrop-blur-md rounded-[24px] border border-white/5 p-5 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-all" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-sans">Stock Disponible</span>
                            <h3 className="text-3xl font-black text-white italic tracking-tighter font-sans flex items-baseline gap-1">
                                {stats.dispoQt}
                                <span className="text-xs font-bold text-zinc-400 not-italic uppercase tracking-normal">PCs</span>
                            </h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl">
                            <CubeIcon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-2 pt-3 border-t border-white/5 font-sans">
                        <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-zinc-500 uppercase">Valeur Achat :</span>
                            <span className="text-white font-mono">{stats.dispoValAchat.toLocaleString()} F</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-zinc-500 uppercase">Valeur Vente Estimée :</span>
                            <span className="text-blue-400 font-mono">{stats.dispoValVente.toLocaleString()} F</span>
                        </div>
                    </div>
                </div>

                {/* CARD 2: VENDU */}
                <div className="bg-zinc-950/40 backdrop-blur-md rounded-[24px] border border-white/5 p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-sans">Pièces Vendues (Fiches)</span>
                            <h3 className="text-3xl font-black text-white italic tracking-tighter font-sans flex items-baseline gap-1">
                                {stats.venduQt}
                                <span className="text-xs font-bold text-zinc-400 not-italic uppercase tracking-normal">PCs</span>
                            </h3>
                        </div>
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
                            <CheckCircleIcon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-2 pt-3 border-t border-white/5 font-sans">
                        <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-zinc-500 uppercase">Chiffre d'Affaire :</span>
                            <span className="text-white font-mono">{stats.venduValVente.toLocaleString()} F</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-zinc-500 uppercase">Bénéfice Net :</span>
                            <span className="text-emerald-400 font-mono">+{ (stats.venduValVente - stats.venduValAchat).toLocaleString() } F</span>
                        </div>
                    </div>
                </div>

                {/* CARD 3: REMISES */}
                <div className="bg-zinc-950/40 backdrop-blur-md rounded-[24px] border border-white/5 p-5 relative overflow-hidden group hover:border-purple-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/10 transition-all" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-sans">Remises Riches Accordées</span>
                            <h3 className="text-3xl font-black text-purple-400 italic tracking-tighter font-sans">
                                {stats.remiseTotal.toLocaleString()} F
                            </h3>
                        </div>
                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl">
                            <SparklesIcon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-2 pt-3 border-t border-white/5 font-sans">
                        <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-zinc-500 uppercase">Taux Réduction Global :</span>
                            <span className="text-zinc-400 font-mono">
                                { (stats.remiseTotal / (stats.venduValVente + stats.remiseTotal || 1) * 100).toFixed(1) }%
                            </span>
                        </div>
                        <div className="flex justify-between text-[11px] font-normal text-zinc-500">
                            <span>Remises temps réel appliquées aux clients</span>
                        </div>
                    </div>
                </div>
            </div>

            {activeTab === 'inventory' ? (
                <>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter italic">Registre d'Inventaire</h2>
                            <p className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">{totalStock} références en base de données</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => { setItemToEdit(undefined); setFormOpen(true); }} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20"><PlusCircleIcon className="w-5 h-5"/>Ajouter Article</button>
                            <button onClick={handlePrint} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/10 transition-all"><PrinterIcon className="w-5 h-5"/>Imprimer</button>
                        </div>
                    </div>

                    <div className="relative mb-6">
                        <input type="text" placeholder="Filtrer par désignation, catégorie, référence ou modèle compatible..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full p-5 pl-14 bg-black/40 border border-white/10 rounded-2xl text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"/>
                        <MagnifyingGlassIcon className="w-6 h-6 absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" />
                    </div>

                    {loading ? <TableSkeleton columns={6} rows={10} /> : (
                        <div className="relative">
                            <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-white/5 bg-white/[0.02] max-h-[calc(100vh-500px)] shadow-inner">
                                <table className="w-full text-sm text-left border-collapse min-w-[1000px]">
                                    <thead className="text-[10px] font-black text-slate-500 uppercase bg-black/60 border-b border-white/10 sticky top-0 z-20 backdrop-blur-md">
                                        <tr>
                                            <th className="px-6 py-5 min-w-[250px]">Désignation & Compatibilité</th>
                                            <th className="px-6 py-5 min-w-[100px]">Couleur</th>
                                            <th className="px-6 py-5 min-w-[120px]">Emplacement</th>
                                            <th className="px-6 py-5 text-center min-w-[100px]">Stock</th>
                                            <th className="px-6 py-5 text-right min-w-[150px]">Prix Vente</th>
                                            <th className="px-6 py-5 text-center min-w-[120px]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {stock.map(item => {
                                            const isLow = item.quantity <= (item.alertThreshold || 0);
                                            return (
                                                <tr key={item.id} className={`hover:bg-white/[0.04] transition-colors group ${!item.isActive ? 'opacity-40 grayscale' : ''} ${isLow && item.isActive ? 'bg-red-500/5 animate-pulse-subtle' : ''}`}>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            {isLow && item.isActive && <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div>}
                                                            <div>
                                                                <p className="font-black text-white uppercase tracking-tight text-sm">{item.name}</p>
                                                                <div className="flex gap-2 mt-1">
                                                                    <span className="text-[9px] font-black text-blue-400 uppercase bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{item.category}</span>
                                                                    {item.compatibleModels && item.compatibleModels.length > 0 && <span className="text-[9px] font-bold text-slate-500 truncate max-w-[150px]">Compat: {item.compatibleModels.join(', ')}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.color || '-'}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{item.location || 'NON RANGÉ'}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-4 py-1 rounded-lg font-black text-sm border ${
                                                            item.quantity > (item.alertThreshold || 0) 
                                                            ? 'text-green-400 bg-green-400/10 border-green-500/20' 
                                                            : item.quantity > 0 
                                                            ? 'text-yellow-400 bg-yellow-400/10 border-yellow-500/20' 
                                                            : 'text-red-400 bg-red-500/10 border-red-500/20'
                                                        }`}>
                                                            {item.quantity}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono font-black text-white">{(item.sellingPrice || 0).toLocaleString()} F</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => { setItemToEdit(item); setFormOpen(true); }} className="p-2.5 bg-white/5 hover:bg-blue-600 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg"><PencilIcon className="w-4 h-4"/></button>
                                                            <button onClick={() => setItemToDelete(item)} className="p-2.5 bg-white/5 hover:bg-rose-600 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg"><TrashIcon className="w-4 h-4"/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-6 border-t border-white/5 pt-6">
                                <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">Historique des Sorties</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Matériel assigné aux dossiers techniques</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-3xl border border-white/5 bg-white/[0.02] shadow-inner">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-black/40 border-b border-white/10 tracking-widest">
                                <tr>
                                    <th className="px-6 py-5">Date</th>
                                    <th className="px-6 py-5">Désignation Matériel</th>
                                    <th className="px-6 py-5">Dossier Destinataire</th>
                                    <th className="px-6 py-5 text-center">Quantité</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {movements.map(m => (
                                    <tr key={m.id} className="hover:bg-white/[0.04] transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                                            {new Date(m.date).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-black text-white uppercase text-sm tracking-tight">{m.stockName}</p>
                                            <p className="text-[8px] text-slate-600 font-bold font-mono">ID: {m.stock_id}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-lg font-black text-xs">
                                                #{m.ticket_id}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-sm font-black text-white bg-white/5 px-3 py-1 rounded-md">x{m.quantite_utilisee}</span>
                                        </td>
                                    </tr>
                                ))}
                                {movements.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-20 text-center opacity-30">
                                            <WrenchScrewdriverIcon className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                                            <p className="text-slate-500 font-black uppercase text-xs tracking-widest">Aucune pièce assignée</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <Modal isOpen={isFormOpen} onClose={() => setFormOpen(false)} containerClassName="bg-slate-900 rounded-[32px] shadow-3xl w-full max-w-5xl m-4 p-8 border border-white/10">
                <StockForm onSave={handleSave} onCancel={() => setFormOpen(false)} itemToEdit={itemToEdit} showReference={settings.stock.showReference} />
            </Modal>
            
            <PreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} fileName="TGS_INVENTAIRE.pdf">
                <PrintableStockList stock={stock} />
            </PreviewModal>

            <ConfirmationModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={confirmDelete}
                title="Retirer du stock ?"
                message={`Effacer définitivement l'article "${itemToDelete?.name}" ?`}
                confirmText="Oui, Supprimer"
            />
        </div>
    );
};

export default StockManager;
