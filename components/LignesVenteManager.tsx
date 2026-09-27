// components/LignesVenteManager.tsx
import React, { useState, useEffect } from 'react';
import { RepairTicket, LigneVenteFiche, StockItem } from '../types.ts';
import { getCompatibleStockItems, calculateLineItemPrices } from '../services/inventoryService.ts';
import { dbGetStock } from '../services/dbService.ts';
import { TrashIcon, PlusIcon, BanknotesIcon, ExclamationTriangleIcon, PencilIcon, SparklesIcon } from './icons.tsx';
import { isLegacyTicket } from '../utils/ticketHelpers.ts';

// Détermine si la fiche est soumise à la nouvelle politique de stock stricte (créée le 18 Juin 2026 ou après)
const isNewStockPolicy = (ticketCreatedAt?: string): boolean => {
    if (!ticketCreatedAt) return true; // Les ébauches de nouvelles fiches entrent sous la nouvelle politique
    return !isLegacyTicket({ createdAt: ticketCreatedAt });
};

const PRESET_PRESTATIONS = [
    { label: "Réparation de la carte mère", value: "RÉPARATION DE LA CARTE MÈRE", defaultPrice: 120000, category: "CARTE MÈRE" },
    { label: "Remplacement de la carte mère", value: "REMPLACEMENT DE LA CARTE MÈRE", defaultPrice: 200000, category: "CARTE MÈRE" },
    { label: "Réparation de la lumière sur l'écran", value: "RÉPARATION DE LA LUMIÈRE SUR L'ÉCRAN", defaultPrice: 75000, category: "ÉCRAN" },
    { label: "Réparation de la lumière sur la carte mère", value: "RÉPARATION DE LA LUMIÈRE SUR LA CARTE MÈRE", defaultPrice: 90000, category: "CARTE MÈRE" },
    { label: "Désoxydation (dégâts liquides)", value: "DÉSOXYDATION (DÉGÂTS LIQUIDES)", defaultPrice: 50000, category: "DÉSOXYDATION" },
    { label: "Remplacement batterie neuve", value: "REMPLACEMENT BATTERIE NEUVE", defaultPrice: 80000, category: "BATTERIE" },
    { label: "Remplacement clavier", value: "REMPLACEMENT CLAVIER", defaultPrice: 85000, category: "CLAVIER" },
    { label: "Remplacement trackpad", value: "REMPLACEMENT TRACKPAD", defaultPrice: 60000, category: "TRACKPAD" },
    { label: "Remplacement écran complet", value: "REMPLACEMENT ÉCRAN COMPLET", defaultPrice: 150000, category: "ÉCRAN" },
    { label: "Installation macOS & Sauvegarde", value: "INSTALLATION MACOS & SAUVEGARDE", defaultPrice: 25000, category: "LOGICIEL" },
    { label: "Récupération de données", value: "RÉCUPÉRATION DE DONNÉES", defaultPrice: 40000, category: "LOGICIEL" },
];

function generateLineId(): string {
    return `l-${Date.now()}-${Math.floor(Math.random() * 100)}`;
}

interface LignesVenteManagerProps {
    ticket: Partial<RepairTicket>;
    onChange: (ligneVentes: LigneVenteFiche[]) => void;
}

export const LignesVenteManager: React.FC<LignesVenteManagerProps> = ({ ticket, onChange }) => {
    const lines = ticket.ligneVentes || [];
    const isNewPolicy = isNewStockPolicy(ticket.createdAt);

    // State pour l'ajout/modification d'une ligne
    const [isAdding, setIsAdding] = useState(false);
    const [editingLineId, setEditingLineId] = useState<string | null>(null);
    const [typeLigne, setTypeLigne] = useState<'article_stock' | 'article_hors_stock' | 'prestation'>('article_stock');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);
    const [compatibleStockList, setCompatibleStockList] = useState<StockItem[]>([]);

    // Inputs formulaire
    const [designation, setDesignation] = useState('');
    const [prixStandard, setPrixStandard] = useState(0);
    const [quantite, setQuantite] = useState(1);
    const [statutLigne, setStatutLigne] = useState<'prevu' | 'reserve' | 'utilise'>('prevu');
    
    // Réductions
    const [reductionActive, setReductionActive] = useState(false);
    const [reductionType, setReductionType] = useState<'montant' | 'pourcentage'>('pourcentage');
    const [reductionValeur, setReductionValeur] = useState(0);
    const [motifReduction, setMotifReduction] = useState('');
    const [prixAchat, setPrixAchat] = useState(0); // Pour le calcul de marge

    // Charger les articles de stock compatibles quand la catégorie change
    useEffect(() => {
        let active = true;
        if (typeLigne === 'article_stock' && selectedCategoryId) {
            getCompatibleStockItems(ticket.macModel || '', selectedCategoryId, ticket.modelNumber || '').then(items => {
                if (active) {
                    setStockItems(items);
                    // Préserver l'article sélectionné lors de l'édition ou du chargement de catégorie
                    setSelectedStockItem(prev => {
                        if (prev) {
                            const found = items.find(i => i.id === prev.id);
                            if (found) return found;
                            // Conserver l'objet précédent (même s'il est hors stock/hors filtres temporairement) pour ne pas vider la saisie
                            return prev;
                        }
                        return null;
                    });
                }
            });
        } else {
            Promise.resolve().then(() => {
                if (active) {
                    setStockItems([]);
                }
            });
        }
        return () => {
            active = false;
        };
    }, [selectedCategoryId, typeLigne, ticket.macModel, ticket.modelNumber]);

    // Charger globalement toutes les pièces compatibles liées au modèle (sans filtre de catégorie)
    useEffect(() => {
        let active = true;
        const loadCompatibleItems = async () => {
            try {
                const allItems = await dbGetStock();
                if (!active) return;
                const normModel = (ticket.macModel || '').trim().toUpperCase();
                const normModelNum = (ticket.modelNumber || '').trim().toUpperCase();
                
                // Filtre de compatibilité global
                const matches = allItems.filter(item => {
                    if (!item.isActive) return false;
                    // Si pas de modèle spécifié d'article ou modèle "TOUS", compatible
                    if (!item.compatibleModels || item.compatibleModels.length === 0) return true;
                    
                    return item.compatibleModels.some(model => {
                        const normM = model.trim().toUpperCase();
                        if (normM === 'TOUS' || normM === 'ALL') return true;
                        if (normModel && (normModel === normM || normModel.includes(normM) || normM.includes(normModel))) return true;
                        if (normModelNum && (normModelNum === normM || normModelNum.includes(normM) || normM.includes(normModelNum))) return true;
                        return false;
                    });
                });
                
                setCompatibleStockList(matches);
            } catch (e) {
                console.error("Failed to load compatible stock items:", e);
            }
        };
        
        loadCompatibleItems();
        return () => {
            active = false;
        };
    }, [ticket.macModel, ticket.modelNumber]);

    // Lorsqu'on sélectionne un article de stock
    const handleSelectStockItem = (item: StockItem) => {
        setSelectedStockItem(item);
        setDesignation(item.name);
        setPrixStandard(item.sellingPrice || 0);
        setPrixAchat(item.cost || 0);
        
        // Auto statut intelligent (réservé si du stock est dispo)
        const dispo = (item.quantity || 0) - (item.quantite_reservee || 0);
        if (dispo >= 1) {
            setStatutLigne('reserve');
        } else {
            setStatutLigne('prevu');
        }
    };

    // Calcul en temps réel pour le preview
    const { prix_unitaire_final, total_ligne, reduction_totale } = calculateLineItemPrices(
        prixStandard,
        reductionActive,
        reductionType,
        reductionValeur,
        quantite
    );

    // Estimation de la marge brute
    let margeBrute: number | null = null;
    let warningMargeDangereuse = false;
    if (prix_unitaire_final > 0 && prixAchat > 0) {
        margeBrute = (prix_unitaire_final - prixAchat) / prix_unitaire_final;
        if (margeBrute < 0.2) { // En dessous de 20%
            warningMargeDangereuse = true;
        }
    }

    const handleAddLine = (e: React.FormEvent) => {
        e.preventDefault();
        if (!designation.trim()) return;

        const newLine: LigneVenteFiche = {
            id: editingLineId || generateLineId(),
            fiche_id: ticket.id || '',
            type_ligne: typeLigne,
            article_stock_id: typeLigne === 'article_stock' ? selectedStockItem?.id || null : null,
            designation: designation.toUpperCase(),
            modele_compatible: typeLigne === 'article_stock' && selectedStockItem?.compatibleModels?.join(', ')
                ? selectedStockItem.compatibleModels.join(', ')
                : (ticket.macModel || 'GÉNÉRIQUE').toUpperCase(),
            categorie: typeLigne === 'article_stock' ? selectedCategoryId : 'HORS_STOCK',
            quantite: quantite,
            prix_unitaire_standard: prixStandard,
            reduction_active: reductionActive,
            reduction_type: reductionActive ? reductionType : null,
            reduction_valeur: reductionActive ? reductionValeur : 0,
            prix_unitaire_final: prix_unitaire_final,
            motif_reduction: reductionActive ? motifReduction : '',
            statut_ligne: statutLigne,
            prix_achat: prixAchat
        };

        if (editingLineId) {
            onChange(lines.map(l => l.id === editingLineId ? newLine : l));
        } else {
            onChange([...lines, newLine]);
        }
        resetForm();
    };

    const resetForm = () => {
        setIsAdding(false);
        setEditingLineId(null);
        setTypeLigne('article_stock');
        setSelectedCategoryId('');
        setSelectedStockItem(null);
        setDesignation('');
        setPrixStandard(0);
        setPrixAchat(0);
        setQuantite(1);
        setStatutLigne('prevu');
        setReductionActive(false);
        setReductionType('pourcentage');
        setReductionValeur(0);
        setMotifReduction('');
    };

    const handleStartEdit = (l: LigneVenteFiche) => {
        setEditingLineId(l.id);
        setIsAdding(true);
        setTypeLigne(l.type_ligne);
        setSelectedCategoryId(l.categorie === 'HORS_STOCK' ? '' : l.categorie || '');
        
        if (l.type_ligne === 'article_stock' && l.article_stock_id) {
            setSelectedStockItem({
                id: l.article_stock_id,
                name: l.designation,
                cost: l.prix_achat || 0,
                sellingPrice: l.prix_unitaire_standard
            } as unknown as StockItem);
        } else {
            setSelectedStockItem(null);
        }
        
        setDesignation(l.designation);
        setPrixStandard(l.prix_unitaire_standard);
        setPrixAchat(l.prix_achat || 0);
        setQuantite(l.quantite);
        setStatutLigne(l.statut_ligne);
        setReductionActive(l.reduction_active);
        setReductionType(l.reduction_type || 'pourcentage');
        setReductionValeur(l.reduction_valeur || 0);
        setMotifReduction(l.motif_reduction || '');
    };

    const handleDeleteLine = (idToDelete: string) => {
        onChange(lines.filter(l => l.id !== idToDelete));
    };

    const totalFiche = lines.reduce((acc, l) => acc + (l.prix_unitaire_final * l.quantite), 0);
    const totalStandardFiche = lines.reduce((acc, l) => acc + (l.prix_unitaire_standard * l.quantite), 0);
    const totalRemiseFiche = totalStandardFiche - totalFiche;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <BanknotesIcon className="w-4 h-4 text-emerald-400" />
                    Articles & Services facturés (Stock & Labor)
                </h4>
                {!isAdding && (
                    <button 
                        type="button"
                        onClick={() => setIsAdding(true)}
                        className="px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 text-[9px] font-black text-blue-400 rounded-lg uppercase tracking-wider hover:bg-blue-600/20 transition-all flex items-center gap-1.5"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Ajouter un élément
                    </button>
                )}
            </div>

            {/* Formulaire d'ajout */}
            {isAdding && (
                <form onSubmit={handleAddLine} className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4 animate-fade-in text-slate-300">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                            {editingLineId ? "Modification de la ligne" : "Nouveau chiffrage"}
                        </span>
                        <button 
                            type="button" 
                            onClick={resetForm}
                            className="text-[10px] font-black uppercase text-red-500 hover:text-red-400"
                        >
                            Annuler
                        </button>
                    </div>

                    {/* BANNIÈRE MODE HISTORIQUE */}
                    {!isNewPolicy && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 text-xs flex gap-2 w-full animate-fade-in">
                            <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-extrabold uppercase text-[9px] tracking-wider text-amber-400">Mode de saisie Historique (Fiche antérieure au 18 Juin 2026)</p>
                                <p className="text-[10px] text-amber-500/90 leading-snug">
                                    Cette fiche bénéficie d'une flexibilité totale. La liaison au stock n'est pas obligatoire pour vos anciennes fiches pour éviter d'impacter les stocks actuels.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* TABLEAU DES ARTICLES COMPATIBLES DANS L'INVENTAIRE POUR CLIQUE RAPIDE */}
                    {compatibleStockList.length > 0 && (
                        <div className="p-4 bg-zinc-950/40 backdrop-blur-md border border-blue-500/15 rounded-2xl space-y-2.5 animate-fade-in">
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-400 uppercase tracking-widest">
                                <SparklesIcon className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                                <span>Raccourci Compatibilité Stock ({ticket.macModel || ticket.modelNumber || 'Générique'})</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 font-medium">
                                Cliquez sur une pièce disponible ci-dessous pour remplir automatiquement le chiffrage (prix, catégorie, etc.). Vous pourrez modifier la tarification ou accorder une remise en dessous sans modifier le prix du stock de base.
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1 max-h-[150px] overflow-y-auto pr-1">
                                {compatibleStockList.map(item => {
                                    const dispo = (item.quantity || 0) - (item.quantite_reservee || 0);
                                    const isSelected = selectedStockItem?.id === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setTypeLigne('article_stock');
                                                setSelectedCategoryId(item.category.toUpperCase());
                                                handleSelectStockItem(item);
                                            }}
                                            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-left group ${
                                                isSelected 
                                                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/10 scale-[1.02]' 
                                                    : 'bg-zinc-900 border-white/5 text-slate-300 hover:border-white/20 hover:bg-zinc-800'
                                            }`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-black uppercase text-[10px] tracking-tight group-hover:text-white transition-colors">
                                                    {item.name}
                                                </span>
                                                <span className="text-[8.5px] text-zinc-400 font-mono mt-0.5">
                                                    Stock: <strong className={dispo > 0 ? "text-green-400" : "text-red-400"}>{dispo}</strong> • Prix: <strong>{item.sellingPrice?.toLocaleString() || 0} F</strong>
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Type d'article */}
                        <div>
                            <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wider mb-1">Type d'imputation</label>
                            <select 
                                value={typeLigne}
                                onChange={(e) => {
                                    setTypeLigne(e.target.value as 'article_stock' | 'article_hors_stock' | 'prestation');
                                    setSelectedCategoryId('');
                                    setSelectedStockItem(null);
                                    setDesignation('');
                                    setPrixStandard(0);
                                    setPrixAchat(0);
                                }}
                                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase font-bold focus:border-blue-500 focus:outline-none"
                            >
                                <option value="article_stock">🛒 Pièce de l'Inventaire</option>
                                <option value="article_hors_stock">📦 Pièce Hors-Stock</option>
                                <option value="prestation">⚙️ Main d'œuvre / Prestation</option>
                            </select>
                        </div>

                        {/* Catégorie (pour lier au stock) */}
                        {typeLigne === 'article_stock' && (
                            <div>
                                <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wider mb-1">Catégorie Pièce</label>
                                <select 
                                    value={selectedCategoryId}
                                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase font-bold focus:border-blue-500 focus:outline-none"
                                    required={isNewPolicy}
                                >
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
                        )}

                        {/* Sélection de l'article de stock compatible */}
                        {typeLigne === 'article_stock' && selectedCategoryId && (
                            <div>
                                <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wider mb-1">Sélectionner la pièce</label>
                                <select 
                                    value={selectedStockItem?.id || ''}
                                    onChange={(e) => {
                                        const item = stockItems.find(i => i.id === e.target.value) || (selectedStockItem?.id === e.target.value ? selectedStockItem : null);
                                        if (item) handleSelectStockItem(item);
                                    }}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase font-bold focus:border-blue-500 focus:outline-none"
                                    required={isNewPolicy}
                                >
                                    <option value="">-- Sélectionner ({stockItems.length} comp.) --</option>
                                    {selectedStockItem && !stockItems.some(i => i.id === selectedStockItem.id) && (
                                        <option value={selectedStockItem.id}>
                                             {selectedStockItem.name} ({selectedStockItem.color || 'Gris'} - {selectedStockItem.condition || 'OEM'}) - stock: {(selectedStockItem.quantity || 0) - (selectedStockItem.quantite_reservee || 0)}
                                        </option>
                                    )}
                                    {stockItems.map(item => {
                                        const dispo = (item.quantity || 0) - (item.quantite_reservee || 0);
                                        return (
                                            <option key={item.id} value={item.id}>
                                                {item.name} ({item.color || 'Gris'} - {item.condition || 'OEM'}) - stock: {dispo} {dispo <= 0 ? '(⚠️ HORS STOCK)' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}

                        {/* Sélection rapide de prestation pré-configurée */}
                        {typeLigne === 'prestation' && (
                            <div className="md:col-span-2">
                                <label className="block text-[8px] font-black text-blue-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <SparklesIcon className="w-3.5 h-3.5 text-blue-400" />
                                        Sélection Prestation Recommandée (ou Saisie Libre)
                                    </span>
                                    <span className="text-[8px] text-slate-500 font-bold">Sélection ou saisie manuelle libre</span>
                                </label>
                                <select 
                                    value={PRESET_PRESTATIONS.some(p => p.value === designation) ? designation : ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val) {
                                            const preset = PRESET_PRESTATIONS.find(p => p.value === val);
                                            if (preset) {
                                                setDesignation(preset.value);
                                                if (!prixStandard || prixStandard === 0) {
                                                    setPrixStandard(preset.defaultPrice);
                                                }
                                            }
                                        }
                                    }}
                                    className="w-full bg-zinc-900 border border-blue-500/30 rounded-xl px-3 py-2.5 text-xs text-blue-200 font-bold focus:border-blue-400 focus:outline-none"
                                >
                                    <option value="">-- Choisir une prestation dans la liste (ou saisie manuelle ci-dessous) --</option>
                                    <optgroup label="⭐ Prestations Clés TGS-CI">
                                        <option value="RÉPARATION DE LA CARTE MÈRE">⚡ RÉPARATION DE LA CARTE MÈRE (120 000 F)</option>
                                        <option value="REMPLACEMENT DE LA CARTE MÈRE">⚡ REMPLACEMENT DE LA CARTE MÈRE (200 000 F)</option>
                                        <option value="RÉPARATION DE LA LUMIÈRE SUR L'ÉCRAN">⚡ RÉPARATION DE LA LUMIÈRE SUR L'ÉCRAN (75 000 F)</option>
                                        <option value="RÉPARATION DE LA LUMIÈRE SUR LA CARTE MÈRE">⚡ RÉPARATION DE LA LUMIÈRE SUR LA CARTE MÈRE (90 000 F)</option>
                                    </optgroup>
                                    <optgroup label="Autres Réparations & Services">
                                        {PRESET_PRESTATIONS.slice(4).map(p => (
                                            <option key={p.value} value={p.value}>
                                                {p.label} {p.defaultPrice > 0 ? `(${p.defaultPrice.toLocaleString()} F)` : ''}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Inputs manuels ou pré-remplis */}
                    {(typeLigne !== 'article_stock' || selectedStockItem || !isNewPolicy) && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 animate-fade-in">
                            <div className="md:col-span-2 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wider">
                                        Désignation du Service / Article *
                                    </label>
                                    {typeLigne === 'prestation' && (
                                        <span className="text-[8px] font-bold text-blue-400 uppercase tracking-wider">
                                            Sélection liste ou ajout manuel libre
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    <input 
                                        value={designation}
                                        onChange={(e) => setDesignation(e.target.value.toUpperCase())}
                                        placeholder={typeLigne === 'prestation' ? "Ex: RÉPARATION DE LA CARTE MÈRE ou saisie libre..." : "Libellé libre..."}
                                        list="preset-prestations-datalist"
                                        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase font-bold font-sans focus:border-blue-500 focus:outline-none pr-8"
                                        required
                                    />
                                    {designation && (
                                        <button
                                            type="button"
                                            onClick={() => setDesignation('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs font-bold p-1"
                                            title="Effacer pour saisie manuelle"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {/* Datalist pour suggestions automatiques */}
                                <datalist id="preset-prestations-datalist">
                                    {PRESET_PRESTATIONS.map(p => (
                                        <option key={p.value} value={p.value}>
                                            {p.label} {p.defaultPrice > 0 ? `(${p.defaultPrice.toLocaleString()} F)` : ''}
                                        </option>
                                    ))}
                                </datalist>

                                {/* Raccourcis directs 1-clic pour les 4 prestations demandées */}
                                {typeLigne === 'prestation' && (
                                    <div className="pt-1">
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider mr-1">Raccourcis :</span>
                                            {PRESET_PRESTATIONS.slice(0, 4).map(preset => {
                                                const isSelected = designation.trim() === preset.value;
                                                return (
                                                    <button
                                                        key={preset.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setDesignation(preset.value);
                                                            if (!prixStandard || prixStandard === 0) {
                                                                setPrixStandard(preset.defaultPrice);
                                                            }
                                                        }}
                                                        className={`text-[8.5px] font-black px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                                                            isSelected 
                                                                ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-500/20 scale-[1.02]' 
                                                                : 'bg-zinc-800/90 border-white/10 text-slate-300 hover:text-white hover:border-blue-500/50 hover:bg-zinc-800'
                                                        }`}
                                                    >
                                                        <span>⚡</span>
                                                        <span>{preset.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wider mb-1">Prix Standard (F CFA)</label>
                                <input 
                                    type="number"
                                    value={prixStandard}
                                    onChange={(e) => setPrixStandard(Number(e.target.value))}
                                    placeholder="Tarif unitaire standard..."
                                    disabled={typeLigne === 'article_stock' && isNewPolicy}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono font-black focus:border-blue-500 focus:outline-none disabled:opacity-60"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wider mb-1">Quantité</label>
                                    <input 
                                        type="number"
                                        min="1"
                                        value={quantite}
                                        onChange={(e) => setQuantite(Math.max(1, Number(e.target.value)))}
                                        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-center text-white font-mono font-black focus:border-blue-500 focus:outline-none"
                                        required
                                    />
                                </div>
                                {typeLigne === 'article_stock' && (
                                    <div>
                                        <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wider mb-1">Statut ligne</label>
                                        <select 
                                            value={statutLigne}
                                            onChange={(e) => setStatutLigne(e.target.value as 'prevu' | 'reserve' | 'utilise')}
                                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-2 py-2.5 text-[10px] text-center text-white font-black uppercase focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="prevu">Prévu</option>
                                            <option value="reserve">Réservé</option>
                                            <option value="utilise">Utilisé (Rendu)</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Zone Réduction */}
                    {designation && (
                        <div className="bg-black/20 p-4 rounded-xl space-y-3 border border-white/5 animate-fade-in">
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="remiseCheck" 
                                    checked={reductionActive} 
                                    onChange={(e) => setReductionActive(e.target.checked)}
                                    className="w-4 h-4 accent-blue-500 cursor-pointer"
                                />
                                <label htmlFor="remiseCheck" className="text-[10px] font-black uppercase tracking-wider text-slate-300 cursor-pointer">
                                    Appliquer une remise exceptionnelle
                                </label>
                            </div>

                            {reductionActive && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 animate-fade-in text-slate-300">
                                    <div>
                                        <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wider mb-1">Type de remise</label>
                                        <div className="flex gap-2">
                                            <button 
                                                type="button" 
                                                onClick={() => setReductionType('pourcentage')}
                                                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${reductionType === 'pourcentage' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-900 border-white/10 text-gray-400'}`}
                                            >
                                                Pourcentage (%)
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => setReductionType('montant')}
                                                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${reductionType === 'montant' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-900 border-white/10 text-gray-400'}`}
                                            >
                                                FCFA fixe
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wider mb-1">Valeur de la remise</label>
                                        <input 
                                            type="number"
                                            value={reductionValeur}
                                            onChange={(e) => setReductionValeur(Math.max(0, Number(e.target.value)))}
                                            placeholder={reductionType === 'pourcentage' ? "ex: 15%" : "ex: 15000 FCFA"}
                                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono font-black focus:border-blue-500 focus:outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-black text-gray-400 uppercase tracking-wider mb-1">Motif justificatif</label>
                                        <input 
                                            value={motifReduction}
                                            onChange={(e) => setMotifReduction(e.target.value)}
                                            placeholder="ex: geste commercial, client VIP..."
                                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-sans focus:border-blue-500 focus:outline-none"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Synthèse Tarification ligne en cours */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-black/40 px-4 py-3 rounded-lg border border-white/5 gap-2 text-xs text-slate-300">
                                <div>
                                    <span className="text-[9px] text-gray-400 font-bold uppercase block">Simulation</span>
                                    <span className="font-mono text-slate-400">Normal : {prixStandard.toLocaleString()} F</span>
                                    {reductionActive && reductionValeur > 0 && (
                                        <span className="font-mono text-emerald-400 ml-3">
                                            Accordé : {prix_unitaire_final.toLocaleString()} F (-{reduction_totale.toLocaleString()} F)
                                        </span>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-[9px] text-gray-400 font-bold uppercase block">Total élément</span>
                                    <span className="font-mono text-base font-black text-blue-400">{total_ligne.toLocaleString()} F</span>
                                </div>
                            </div>

                            {/* Alerte et Marge */}
                            {warningMargeDangereuse && margeBrute !== null && (
                                <div className="p-3 bg-red-600/10 border border-red-500/20 rounded-xl text-red-400 flex items-start gap-2.5 animate-bounce">
                                    <ExclamationTriangleIcon className="w-5 h-5 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider">Alerte de marge faible detected !</p>
                                        <p className="text-xs font-medium">La marge brute de cet article ({Math.round(margeBrute * 100)}%) est sous le seuil d'éco-profitabilité de 20% (Prix d'achat: {prixAchat.toLocaleString()} F CFA). S'assurer de justifier dans le motif.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                        <button 
                            type="button" 
                            onClick={resetForm}
                            className="px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
                        >
                            Fermer
                        </button>
                        <button 
                            type="submit" 
                            disabled={!designation}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-xs font-black uppercase tracking-wider shadow-lg disabled:opacity-50 transition-colors"
                        >
                            {editingLineId ? "Enregistrer les modifications" : "Enregistrer la ligne"}
                        </button>
                    </div>
                </form>
            )}

            {/* Liste des lignes de vente chiffrées */}
            <div className="apple-card p-5 bg-black/40 border border-white/5 space-y-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Récapitulatif des lignes (Fiches)</div>
                
                {lines.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 pb-2 text-[9px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">
                                    <th className="py-2">Imputation</th>
                                    <th className="py-2">Libellé / Désignation</th>
                                    <th className="py-2 text-center">Quantité</th>
                                    <th className="py-2 text-right">Standard</th>
                                    <th className="py-2 text-right">Remise</th>
                                    <th className="py-2 text-right">Prix Net</th>
                                    <th className="py-2 text-center rounded-r-xl">Statut</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                                {lines.map((l) => {
                                    const totalLigne = l.prix_unitaire_final * l.quantite;
                                    const diffTotal = (l.prix_unitaire_standard - l.prix_unitaire_final) * l.quantite;
                                    
                                    return (
                                        <tr key={l.id} className="group hover:bg-white/5 transition-colors">
                                            <td className="py-3 font-semibold text-[10px] uppercase text-gray-400">
                                                {l.type_ligne === 'article_stock' ? '🛒 Stock' : l.type_ligne === 'article_hors_stock' ? '📦 Hors-Stk' : '⚙️ Labor'}
                                            </td>
                                            <td className="py-3">
                                                <div className="flex items-center justify-between gap-3 mr-3 pr-2">
                                                    <div>
                                                        <div className="font-black text-white">{l.designation}</div>
                                                        <div className="text-[9px] text-gray-400 font-sans tracking-wide">
                                                            Compat: {l.modele_compatible || 'TOUS'}
                                                        </div>
                                                        {l.motif_reduction && (
                                                            <div className="text-[9.5px] text-emerald-500 font-sans italic">
                                                                Note: {l.motif_reduction}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleStartEdit(l)} 
                                                            className="p-1.5 text-blue-400 hover:bg-blue-600/15 rounded-md transition-all min-h-[32px] min-w-[32px] flex items-center justify-center border border-transparent hover:border-blue-500/20"
                                                            title="Modifier"
                                                        >
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleDeleteLine(l.id)} 
                                                            className="p-1.5 text-red-500 hover:bg-red-600/15 rounded-md transition-all min-h-[32px] min-w-[32px] flex items-center justify-center border border-transparent hover:border-red-500/20"
                                                            title="Supprimer"
                                                        >
                                                            <TrashIcon className="w-4.5 h-4.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 text-center font-mono font-black">{l.quantite}</td>
                                            <td className="py-3 text-right font-mono text-gray-400">
                                                {(l.prix_unitaire_standard * l.quantite).toLocaleString()} F
                                            </td>
                                            <td className="py-3 text-right font-mono text-emerald-400">
                                                {diffTotal > 0 ? `-${diffTotal.toLocaleString()} F` : '0 F'}
                                            </td>
                                            <td className="py-3 text-right font-mono font-black text-blue-400">
                                                 {totalLigne.toLocaleString()} F
                                             </td>
                                             <td className="py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase text-center ${
                                                    l.statut_ligne === 'utilise' 
                                                        ? 'bg-green-600/15 border border-green-500/25 text-green-400' 
                                                        : l.statut_ligne === 'reserve' 
                                                            ? 'bg-purple-600/15 border border-purple-500/25 text-purple-400' 
                                                            : l.statut_ligne === 'annule'
                                                                ? 'bg-red-600/15 border border-red-500/25 text-red-400'
                                                                : 'bg-yellow-600/15 border border-yellow-500/25 text-yellow-400'
                                                }`}>
                                                    {l.statut_ligne === 'utilise' ? 'Utilisé' : l.statut_ligne === 'reserve' ? 'Réservé' : l.statut_ligne === 'annule' ? 'Annulé' : 'Prévu'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-6 text-center text-[10px] font-black uppercase italic text-gray-500">
                        Aucun article ou prestation de stock n'a été rattaché
                    </div>
                )}

                {/* Synthèse Totale Fiche */}
                {lines.length > 0 && (
                    <div className="border-t border-white/5 pt-4 text-xs font-medium space-y-1.5 text-right font-sans text-slate-300">
                        <div>Tarification Catalogue Hors Taxes : <span className="font-mono font-semibold text-gray-400">{totalStandardFiche.toLocaleString()} F CFA</span></div>
                        {totalRemiseFiche > 0 && (
                            <div className="text-emerald-400">Remise Exceptionnelle Appliquée : <span className="font-mono font-black">-{totalRemiseFiche.toLocaleString()} F CFA</span></div>
                        )}
                        <div className="text-base font-black text-white">Montant Total des Prestations : <span className="font-mono text-xl tracking-tight text-blue-400">{totalFiche.toLocaleString()} F CFA</span></div>
                    </div>
                )}
            </div>
        </div>
    );
};
