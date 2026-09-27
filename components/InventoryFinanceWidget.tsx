import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RepairTicket, StockItem } from '../types.ts';
import { dbGetStock } from '../services/dbService.ts';
import { BanknotesIcon, CubeIcon, SparklesIcon, ArrowPathIcon } from './icons.tsx';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface InventoryFinanceWidgetProps {
    tickets: RepairTicket[];
}

const InventoryFinanceWidget: React.FC<InventoryFinanceWidgetProps> = ({ tickets }) => {
    const [allStock, setAllStock] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch stock from local database
    const fetchFinanceData = useCallback(async () => {
        try {
            setRefreshing(true);
            const stockData = await dbGetStock();
            setAllStock(stockData);
        } catch (error) {
            console.error("Error loading stock for ERP finance widget:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Load initially and listen to active updates (datareceived)
    useEffect(() => {
        fetchFinanceData();

        const handleDataChange = () => {
            fetchFinanceData();
        };

        window.addEventListener('datareceived', handleDataChange);
        return () => {
            window.removeEventListener('datareceived', handleDataChange);
        };
    }, [fetchFinanceData]);

    // Financial Analysis
    const financeStats = useMemo(() => {
        // 1. Available Stock Value (Current active items)
        let dispoQt = 0;
        let dispoValAchat = 0;
        let dispoValVente = 0;
        const categoryCostMap: Record<string, number> = {};
        const categoryVenteMap: Record<string, number> = {};

        allStock.forEach(item => {
            if (item.isActive && (item.quantity ?? 0) > 0) {
                const qty = item.quantity ?? 0;
                const cost = item.cost ?? 0;
                const price = item.sellingPrice ?? 0;
                const cat = item.category || 'AUTRE';

                dispoQt += qty;
                dispoValAchat += qty * cost;
                dispoValVente += qty * price;

                categoryCostMap[cat] = (categoryCostMap[cat] || 0) + (qty * cost);
                categoryVenteMap[cat] = (categoryVenteMap[cat] || 0) + (qty * price);
            }
        });

        // Convert category breakdown to array for Recharts
        const categoryBreakdown = Object.keys(categoryVenteMap).map(cat => ({
            name: cat.replace('_', ' '),
            Disponible: categoryVenteMap[cat],
            Investissement: categoryCostMap[cat] || 0,
        })).sort((a, b) => b.Disponible - a.Disponible);

        // 2. Sold Items & Revenue from tickets
        let soldQt = 0;
        let soldValVente = 0;
        let soldValAchat = 0;
        let totalDiscountsGiven = 0;
        const soldPartsList: Record<string, { name: string; qty: number; revenue: number; profit: number; cat: string }> = {};

        tickets.forEach(ticket => {
            if (ticket.status === 'Annulé') return;
            (ticket.ligneVentes || []).forEach(line => {
                if (line.type_ligne === 'article_stock' && line.statut_ligne === 'utilise') {
                    const qty = line.quantite || 0;
                    const finalPrice = line.prix_unitaire_final || 0;
                    const standardPrice = line.prix_unitaire_standard || 0;
                    const costPrice = line.prix_achat || 0;

                    soldQt += qty;
                    soldValVente += qty * finalPrice;
                    soldValAchat += qty * costPrice;

                    // Accumulated Discounts
                    if (standardPrice > finalPrice) {
                        totalDiscountsGiven += qty * (standardPrice - finalPrice);
                    }

                    // Top sold items tracking
                    const key = line.article_stock_id || line.designation;
                    if (key) {
                        if (!soldPartsList[key]) {
                            soldPartsList[key] = {
                                name: line.designation,
                                qty: 0,
                                revenue: 0,
                                profit: 0,
                                cat: line.categorie || 'AUTRE',
                            };
                        }
                        soldPartsList[key].qty += qty;
                        soldPartsList[key].revenue += qty * finalPrice;
                        soldPartsList[key].profit += qty * (finalPrice - costPrice);
                    }
                }
            });
        });

        const topSoldItems = Object.values(soldPartsList)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);

        // Net profit of sold items
        const netProfit = soldValVente - soldValAchat;
        // Profit margin of sold database items
        const profitMargin = soldValVente > 0 ? (netProfit / soldValVente) * 100 : 0;
        // Discount rate relative to potential full price
        const totalPotentialRetail = soldValVente + totalDiscountsGiven;
        const discountPercentage = totalPotentialRetail > 0 ? (totalDiscountsGiven / totalPotentialRetail) * 100 : 0;

        return {
            dispoQt,
            dispoValAchat,
            dispoValVente,
            categoryBreakdown,
            soldQt,
            soldValVente,
            soldValAchat,
            totalDiscountsGiven,
            topSoldItems,
            netProfit,
            profitMargin,
            discountPercentage,
        };
    }, [allStock, tickets]);

    if (loading) {
        return (
            <div className="glass-card p-8 rounded-3xl border border-white/5 bg-zinc-950/20 text-center flex flex-col items-center justify-center min-h-[160px]">
                <div className="animate-spin text-blue-500 mb-3">
                    <ArrowPathIcon className="w-8 h-8" />
                </div>
                <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest font-mono">Chargement des données d'inventaire...</p>
            </div>
        );
    }

    return (
        <div id="financial-inventory-widget" className="glass-card p-6 md:p-8 rounded-3xl border border-white/5 bg-zinc-950/40 shadow-2xl space-y-8 relative overflow-hidden font-sans">
            {/* Ambient subtle decorative light */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Title Header with live sync state */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-white/5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <h2 className="text-lg font-black uppercase text-white tracking-tight italic">
                            Valorisation Financière du Stock & Ventes
                        </h2>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium">Analyse bidirectionnelle en temps réel : inventaire disponible vs. pièces écoulées sur fiches.</p>
                </div>

                <button 
                    onClick={fetchFinanceData}
                    disabled={refreshing}
                    className={`flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] uppercase tracking-widest font-black transition-all border border-white/10 ${refreshing ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Mise à jour' : 'Actualiser'}
                </button>
            </div>

            {/* Dynamic Grid of Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. STOCK DISPONIBLE (CAPITAL ACTIF) */}
                <div className="bg-gradient-to-br from-blue-900/10 to-zinc-900 rounded-2xl border border-blue-500/15 p-5 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Valeur Stock Actuel</span>
                            <h3 className="text-2xl font-black text-white italic tracking-tight font-mono">
                                {financeStats.dispoValVente.toLocaleString('fr-FR')} F
                            </h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                            <CubeIcon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="pt-3 border-t border-white/5 space-y-2 text-xs">
                        <div className="flex justify-between font-medium">
                            <span className="text-zinc-400">Total Pièces en Stock:</span>
                            <span className="text-white font-mono font-bold bg-white/5 px-2 py-0.5 rounded">{financeStats.dispoQt} pcs</span>
                        </div>
                        <div className="flex justify-between font-medium">
                            <span className="text-zinc-400">Coût d'Acquisition (Achat):</span>
                            <span className="text-zinc-300 font-mono">{financeStats.dispoValAchat.toLocaleString('fr-FR')} F</span>
                        </div>
                        <div className="flex justify-between font-medium pt-1">
                            <span className="text-zinc-400">Bénéfice Restant Estimé:</span>
                            <span className="text-emerald-400 font-mono font-bold">+{(financeStats.dispoValVente - financeStats.dispoValAchat).toLocaleString('fr-FR')} F</span>
                        </div>
                    </div>
                </div>

                {/* 2. PIÈCES VENDUES SUR FICHES REPARATION */}
                <div className="bg-gradient-to-br from-emerald-900/10 to-zinc-900 rounded-2xl border border-emerald-500/15 p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Ventes Réalisées (Fiches)</span>
                            <h3 className="text-2xl font-black text-white italic tracking-tight font-mono">
                                {financeStats.soldValVente.toLocaleString('fr-FR')} F
                            </h3>
                        </div>
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                            <BanknotesIcon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="pt-3 border-t border-white/5 space-y-2 text-xs">
                        <div className="flex justify-between font-medium">
                            <span className="text-zinc-400">Nombre de Pièces Vendues:</span>
                            <span className="text-white font-mono font-bold bg-white/5 px-2 py-0.5 rounded">{financeStats.soldQt} pcs</span>
                        </div>
                        <div className="flex justify-between font-medium">
                            <span className="text-zinc-400">Coût total d'achat:</span>
                            <span className="text-zinc-300 font-mono">{financeStats.soldValAchat.toLocaleString('fr-FR')} F</span>
                        </div>
                        <div className="flex justify-between font-medium pt-1">
                            <span className="text-zinc-400">Marge de Profit Nette:</span>
                            <span className="text-emerald-400 font-mono font-bold">
                                +{financeStats.netProfit.toLocaleString('fr-FR')} F {' '}
                                <span className="text-[10px] text-zinc-400 italic">({financeStats.profitMargin.toFixed(1)}%)</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. TOTAL ACCUMULATED DISCOUNTS (REMISES ACCORDÉES) */}
                <div className="bg-gradient-to-br from-purple-900/10 to-zinc-900 rounded-2xl border border-purple-500/15 p-5 relative overflow-hidden group hover:border-purple-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Remises Accordées</span>
                            <h3 className="text-2xl font-black text-purple-300 italic tracking-tight font-mono">
                                - {financeStats.totalDiscountsGiven.toLocaleString('fr-FR')} F
                            </h3>
                        </div>
                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                            <SparklesIcon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="pt-3 border-t border-white/5 space-y-2 text-xs">
                        <div className="flex justify-between font-medium">
                            <span className="text-zinc-400">Chiffre Potential d'Origine:</span>
                            <span className="text-zinc-300 font-mono">{(financeStats.soldValVente + financeStats.totalDiscountsGiven).toLocaleString('fr-FR')} F</span>
                        </div>
                        <div className="flex justify-between font-medium">
                            <span className="text-zinc-400">Taux Moyen d'Effet Remise:</span>
                            <span className="text-purple-300 font-mono font-bold">{financeStats.discountPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between font-medium pt-1">
                            <span className="text-zinc-400">Ration par pièce vendue:</span>
                            <span className="text-zinc-300 font-mono">
                                {financeStats.soldQt > 0 ? (financeStats.totalDiscountsGiven / financeStats.soldQt).toFixed(0).toLocaleString() : '0'} F / pc
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Content / Visualization Bento */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                
                {/* Available Stock Category Distribution chart */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                    <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-4">Répartition Financière par Catégorie de Stock (Disponible)</h4>
                    {financeStats.categoryBreakdown.length === 0 ? (
                        <div className="text-center py-10 text-xs text-zinc-500 font-medium italic">
                            Aucun item actif en stock pour segmenter la valeur.
                        </div>
                    ) : (
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={financeStats.categoryBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} fontWeight={700} tickLine={false} />
                                    <YAxis stroke="#64748b" fontSize={9} tickFormatter={(val) => `${val/1000}k`} tickLine={false} />
                                    <Tooltip 
                                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} 
                                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }} 
                                    />
                                    <Bar dataKey="Disponible" name="Valeur Vente (F)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Investissement" name="Coût d'Achat (F)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Top Sold Parts & Assets List */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                        <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-4">Top 5 Pièces de Stock les Plus Écoulées</h4>
                        {financeStats.topSoldItems.length === 0 ? (
                            <div className="text-center py-10 text-xs text-zinc-500 font-medium italic">
                                Aucune sortie de pièce enregistrée sur les fiches de réparation.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {financeStats.topSoldItems.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between text-xs p-2.5 bg-black/20 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <span className="flex-shrink-0 w-6 h-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center font-bold text-[10px]">
                                                #{index + 1}
                                            </span>
                                            <div>
                                                <p className="font-bold text-white truncate max-w-[170px] xl:max-w-[200px]" title={item.name}>{item.name}</p>
                                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono">{item.cat.replace('_', ' ')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right font-mono">
                                            <p className="font-extrabold text-white text-xs">{item.qty} pcs</p>
                                            <p className="text-[10px] text-emerald-400 font-medium">+{item.revenue.toLocaleString()} F</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default InventoryFinanceWidget;
