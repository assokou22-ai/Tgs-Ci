

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import useStock from '../hooks/useStock.ts';
import { StockItem } from '../types.ts';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, PrinterIcon, PlusCircleIcon, XCircleIcon, PencilIcon, BanknotesIcon } from './icons.tsx';
import Modal from './Modal.tsx';
import PrintableStockList from './PrintableStockList.tsx';
import { playTone } from '../utils/audio.ts';
import PreviewModal from './PreviewModal.tsx';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import PaginationControls from './PaginationControls.tsx';
import TableSkeleton from './skeletons/TableSkeleton.tsx';

const StockForm: React.FC<{
    itemToEdit?: StockItem;
    onSave: (item: Omit<StockItem, 'id' | 'updatedAt'> | StockItem) => Promise<void>;
    onCancel: () => void;
    showReference: boolean;
    showCost: boolean;
}> = ({ itemToEdit, onSave, onCancel, showReference, showCost }) => {
    const { settings } = useAppSettings();
    const stockCustomFields = settings.customFields.stock;

    const [item, setItem] = useState({
        name: itemToEdit?.name || '',
        quantity: itemToEdit?.quantity || 0,
        category: itemToEdit?.category || '',
        reference: itemToEdit?.reference || '',
        cost: itemToEdit?.cost || 0,
        customFields: itemToEdit?.customFields || {},
    });

    // Helper fields for margin calculation
    const [transport, setTransport] = useState(0);
    const [sellingPrice, setSellingPrice] = useState(0);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setItem(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) || 0 : value }));
    };
    
    const handleCustomFieldChange = (fieldId: string, value: string) => {
        setItem(prev => ({
            ...prev,
            customFields: { ...prev.customFields, [fieldId]: value },
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onSave(itemToEdit ? { ...itemToEdit, ...item } : item);
        } catch (error) {
            console.error("Failed to save stock item:", error);
            alert("L'enregistrement a échoué. Veuillez vérifier la console pour plus de détails.");
        }
    };

    const totalCost = item.cost + transport;
    const profit = sellingPrice > 0 ? sellingPrice - totalCost : 0;
    const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-white p-2 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-bold">{itemToEdit ? 'Modifier' : 'Ajouter un'} article</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Nom de l'article</label>
                        <input name="name" value={item.name} onChange={handleChange} placeholder="ex: Écran MacBook A2337" className="w-full p-2 bg-gray-700 border border-gray-600 rounded outline-none focus:ring-2 focus:ring-blue-500" required/>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Catégorie</label>
                        <input name="category" value={item.category} onChange={handleChange} placeholder="ex: Écrans" className="w-full p-2 bg-gray-700 border border-gray-600 rounded outline-none focus:ring-2 focus:ring-blue-500" required/>
                    </div>
                    {showReference && (
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Référence</label>
                            <input name="reference" value={item.reference} onChange={handleChange} placeholder="Référence constructeur" className="w-full p-2 bg-gray-700 border border-gray-600 rounded outline-none focus:ring-2 focus:ring-blue-500"/>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Quantité</label>
                            <input name="quantity" type="number" value={item.quantity} onChange={handleChange} className="w-full p-2 bg-gray-700 border border-gray-600 rounded outline-none focus:ring-2 focus:ring-blue-500" required/>
                        </div>
                        {showCost && (
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Prix Achat Unit. (F CFA)</label>
                                <input name="cost" type="number" value={item.cost} onChange={handleChange} className="w-full p-2 bg-gray-700 border border-gray-600 rounded outline-none focus:ring-2 focus:ring-blue-500"/>
                            </div>
                        )}
                    </div>
                </div>

                {/* Calculateur de rentabilité intégré */}
                <div className="bg-gray-900/50 p-4 rounded-xl border border-blue-900/30 space-y-4">
                    <h3 className="text-xs font-black text-blue-400 uppercase flex items-center gap-2 mb-2">
                        <BanknotesIcon className="w-4 h-4"/> 
                        Calculateur de rentabilité
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Frais Transport</label>
                            <input type="number" value={transport} onChange={(e) => setTransport(parseInt(e.target.value) || 0)} className="w-full p-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Prix de Vente</label>
                            <input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(parseInt(e.target.value) || 0)} className="w-full p-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-blue-400 font-bold" />
                        </div>
                    </div>

                    <div className="p-3 bg-black/40 rounded-lg border border-gray-800 space-y-1">
                        <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500">Coût total (Achat + Transport) :</span>
                            <span className="font-bold text-white">{totalCost.toLocaleString('fr-FR')} F</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500">Bénéfice brut :</span>
                            <span className="font-bold text-green-400">{profit.toLocaleString('fr-FR')} F</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500">Marge brute :</span>
                            <span className="font-bold text-yellow-500">{margin.toFixed(1)} %</span>
                        </div>
                    </div>

                    {/* Exemple concret demandé */}
                    <div className="text-[10px] bg-blue-900/20 p-3 rounded-lg border border-blue-800/30 leading-relaxed text-blue-200 italic">
                        <p className="font-black mb-1 not-italic">🔹 Exemple concret</p>
                        <p>Achat écran : 59 000 F CFA</p>
                        <p>Transport : 15 000 F CFA</p>
                        <p>Vente : 150 000 F CFA</p>
                        <div className="mt-1 space-y-0.5 font-bold not-italic">
                            <p>👉 Coût total : 74 000 F CFA</p>
                            <p>👉 Bénéfice brut : 76 000 F CFA</p>
                            <p>👉 Marge brute : 50,7 %</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {stockCustomFields.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-700">
                    {stockCustomFields.map(field => (
                        <div key={field.id}>
                             <label htmlFor={field.id} className="block text-[10px] font-black uppercase text-gray-400 mb-1">{field.label}</label>
                             <input
                                type="text"
                                id={field.id}
                                value={item.customFields[field.id] || ''}
                                onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                             />
                        </div>
                    ))}
                </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button type="button" onClick={onCancel} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-all uppercase text-xs">Annuler</button>
                <button type="submit" className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-lg shadow-xl transition-all uppercase text-xs">Enregistrer</button>
            </div>
        </form>
    );
};

// Fix: Defined missing StockManagerProps interface to resolve build error.
interface StockManagerProps {
    addLog: (category: 'Service' | 'Stock', type: 'Ajout' | 'Suppression', message: string) => void;
    initialFilter?: string;
}

const StockManager: React.FC<StockManagerProps> = ({ addLog, initialFilter }) => {
    const { 
        stock, addStockItem, updateStockItem, deleteStockItem, 
        setFullStock, loading, error, 
        currentPage, totalPages, goToPage, setFilter, totalStock
    } = useStock();
    
    const { settings } = useAppSettings();
    const [searchQuery, setSearchQuery] = useState(initialFilter || '');
    const [isFormOpen, setFormOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState<StockItem | undefined>();
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    
    useEffect(() => {
        if (initialFilter) {
            setSearchQuery(initialFilter);
            setFilter(initialFilter);
        }
    }, [initialFilter, setFilter]);
    
    useEffect(() => {
        const handler = setTimeout(() => {
            setFilter(searchQuery);
            goToPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery, setFilter, goToPage]);
    
    const importInputRef = useRef<HTMLInputElement>(null);

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

    const handleDelete = async (item: StockItem) => {
        const wasDeleted = await deleteStockItem(item.id);
        if (wasDeleted) {
            addLog('Stock', 'Suppression', `Article supprimé: ${item.name}`);
        }
    };
    
     const handleExport = () => {
        const worksheet = XLSX.utils.json_to_sheet(stock);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock');
        XLSX.writeFile(workbook, 'stock_reparermonmac.xlsx');
    };

    const handleImportChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                const importedStock: StockItem[] = json
                    .map((row, index) => ({
                        id: `stk-import-${Date.now()}-${index}`,
                        updatedAt: new Date().toISOString(),
                        name: row.name?.toString() || '',
                        quantity: Number(row.quantity) || 0,
                        category: row.category?.toString() || 'Importé',
                        reference: row.reference?.toString(),
                        cost: Number(row.cost) || 0,
                        customFields: {},
                    }))
                    .filter(item => item.name);
                
                if (importedStock.length > 0 && window.confirm(`Importer ${importedStock.length} articles ? Cela remplacera entièrement le stock existant.`)) {
                    await setFullStock(importedStock);
                    addLog('Stock', 'Ajout', `${importedStock.length} articles importés.`);
                    alert('Importation réussie !');
                }
            } catch (error) {
                console.error("Erreur d'importation:", error);
                alert("Le fichier semble invalide.");
            }
        };
        reader.readAsArrayBuffer(file);
    };
    
    const handlePrint = () => {
        setIsPreviewOpen(true);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-white mb-4">Gestion du Stock ({totalStock} articles)</h2>
             <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => { setItemToEdit(undefined); setFormOpen(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded-md"><PlusCircleIcon className="w-5 h-5"/>Ajouter</button>
                <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-green-700 rounded-md"><ArrowDownTrayIcon className="w-5 h-5"/>Exporter</button>
                <button onClick={() => importInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 rounded-md"><ArrowUpTrayIcon className="w-5 h-5"/>Importer</button>
                <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 rounded-md"><PrinterIcon className="w-5 h-5"/>Imprimer</button>
                 <input type="file" ref={importInputRef} className="hidden" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleImportChange} />
            </div>
            <input type="text" placeholder="Rechercher dans le stock..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full p-2 mb-4 bg-gray-700 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-white"/>

            {error && <div className="text-center text-red-400">{error}</div>}

            {loading ? <TableSkeleton columns={settings.stock.showReference ? 5 : 4} rows={10} /> : (
                <>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-700/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Nom</th>
                                    <th className="px-4 py-2">Catégorie</th>
                                    {settings.stock.showReference && <th className="px-4 py-2">Référence</th>}
                                    <th className="px-4 py-2 text-center">Quantité</th>
                                    <th className="px-4 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stock.map(item => (
                                    <tr key={item.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                        <td className="px-4 py-2 font-medium text-white">{item.name}</td>
                                        <td className="px-4 py-2">{item.category}</td>
                                        {settings.stock.showReference && <td className="px-4 py-2 font-mono text-xs">{item.reference || '-'}</td>}
                                        <td className="px-4 py-2 text-center font-bold">{item.quantity}</td>
                                        <td className="px-4 py-2 text-right">
                                            <button onClick={() => { setItemToEdit(item); setFormOpen(true); }} className="p-1 hover:text-blue-400 transition-colors"><PencilIcon className="w-4 h-4"/></button>
                                            <button onClick={() => handleDelete(item)} className="p-1 hover:text-red-500 transition-colors"><XCircleIcon className="w-4 h-4"/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
                </>
            )}

            <Modal isOpen={isFormOpen} onClose={() => setFormOpen(false)} containerClassName="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl m-4 p-6 border border-gray-700">
                <StockForm onSave={handleSave} onCancel={() => setFormOpen(false)} itemToEdit={itemToEdit} showCost={settings.stock.showCost} showReference={settings.stock.showReference} />
            </Modal>
            
            <PreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                fileName="liste_stock.pdf"
            >
                <PrintableStockList stock={stock} />
            </PreviewModal>
        </div>
    );
};

export default StockManager;
