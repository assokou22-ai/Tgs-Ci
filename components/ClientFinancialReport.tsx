import React, { useState, useMemo } from 'react';
import useFactures from '../hooks/useFactures.ts';
import useCommandes from '../hooks/useCommandes.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import { 
    BanknotesIcon, 
    ArrowLeftIcon, 
    PrinterIcon, 
    CalendarDaysIcon,
    UserIcon,
    CheckCircleIcon,
    InfoIcon,
    AppleLogo,
    AlertTriangleIcon,
    CheckBadgeIcon,
    ClockIcon,
    TrashIcon
} from './icons.tsx';
import PreviewModal from './PreviewModal.tsx';

interface ClientFinancialReportProps {
    onBack: () => void;
}

type PeriodType = 'all' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type SubFilterType = 'all' | 'factures_payees' | 'factures_impayees' | 'commandes_soldees' | 'commandes_restantes';

export const ClientFinancialReport: React.FC<ClientFinancialReportProps> = ({ onBack }) => {
    const { factures, loading: loadingFactures, deleteFacture } = useFactures();
    const { commandes, loading: loadingCommandes, deleteCommande } = useCommandes();
    const { showToast } = useToastContext();

    const [selectedClientPhone, setSelectedClientPhone] = useState<string>('');
    const [period, setPeriod] = useState<PeriodType>('all');
    const [subFilter, setSubFilter] = useState<SubFilterType>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'Facture' | 'Commande'; numero: string; total: number; clientName: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Compile an exhaustive, unique list of clients from factures and commandes
    const clientsList = useMemo(() => {
        const map = new Map<string, { name: string; phone: string }>();
        
        // Add a global consolidated option first!
        map.set('all_clients', { name: "RAPPORT FINANCIER GLOBAL (CONSOLIDÉ)", phone: "all_clients" });

        factures.forEach(f => {
            const name = f.clientName?.trim();
            const phone = f.clientPhone?.trim() || '';
            if (name) {
                const key = phone || `name-${name}`;
                map.set(key, { name, phone: key });
            }
        });

        commandes.forEach(c => {
            const name = c.clientName?.trim();
            const phone = c.clientPhone?.trim() || '';
            if (name) {
                const key = phone || `name-${name}`;
                map.set(key, { name, phone: key });
            }
        });

        const list = Array.from(map.values());
        const globalOption = list.find(x => x.phone === 'all_clients');
        const otherOptions = list.filter(x => x.phone !== 'all_clients').sort((a, b) => a.name.localeCompare(b.name));
        
        return globalOption ? [globalOption, ...otherOptions] : otherOptions;
    }, [factures, commandes]);

    // Set initial client if none selected
    React.useEffect(() => {
        if (!selectedClientPhone && clientsList.length > 0) {
            setSelectedClientPhone(clientsList[0].phone);
        }
    }, [clientsList, selectedClientPhone]);

    const activeClient = useMemo(() => {
        return clientsList.find(c => c.phone === selectedClientPhone) || null;
    }, [clientsList, selectedClientPhone]);

    // Date range helpers for current week, month, year
    const dateFilters = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Weekly (Monday to Sunday)
        const day = startOfToday.getDay();
        const diffToMonday = startOfToday.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(startOfToday.setDate(diffToMonday));
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Monthly
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Yearly
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

        return {
            weekly: { start: startOfWeek, end: endOfWeek },
            monthly: { start: startOfMonth, end: endOfMonth },
            yearly: { start: startOfYear, end: endOfYear }
        };
    }, []);

    // Filtered documents & summary calculations for the active client over chosen period
    const reportData = useMemo(() => {
        const defaultStats = {
            items: [],
            totalBilled: 0,
            totalPaid: 0,
            remainingBalance: 0,
            facturesPayeesCount: 0,
            facturesPayeesSum: 0,
            facturesImpayeesCount: 0,
            facturesImpayeesSum: 0,
            facturesImpayeesReste: 0,
            commandesSoldeesCount: 0,
            commandesSoldeesSum: 0,
            commandesRestantesCount: 0,
            commandesRestantesSum: 0,
            commandesRestantesRemaining: 0
        };

        if (!activeClient) return defaultStats;

        const isGlobal = activeClient.phone === 'all_clients';

        // 1. Gather all documents from this client or all clients if global
        const clientFactures = isGlobal
            ? factures
            : factures.filter(f => {
                const key = f.clientPhone || `name-${f.clientName}`;
                return key === activeClient.phone;
            });
        const clientCommandes = (isGlobal
            ? commandes
            : commandes.filter(c => {
                const key = c.clientPhone || `name-${c.clientName}`;
                return key === activeClient.phone;
            })).filter(c => !c.isLinkedToTicket);

        // 2. Map them to a unified statement format
        const unifiedItems = [
            ...clientFactures.map(f => {
                const itemDetails = f.items?.map(it => {
                    const desc = it.description || '';
                    return desc ? `${desc}${it.quantity > 1 ? ` (${it.quantity}x)` : ''}` : '';
                }).filter(Boolean).join(', ') || '';

                const specs = [f.macColor, f.macSpecs].filter(Boolean).join(' • ');
                const details = [specs, itemDetails].filter(Boolean).join(' — ') || specs || itemDetails || '';
                const title = f.macModel 
                    || (f.items && f.items.length > 0 && f.items[0].description)
                    || 'Prestations techniques / Matériels';

                return {
                    id: f.id,
                    type: 'Facture' as const,
                    numero: f.numero,
                    date: f.date,
                    clientName: f.clientName || 'Inconnu',
                    title: title,
                    total: f.total,
                    advance: f.status === 'Payé' ? f.total : (f.advance || 0),
                    status: f.status,
                    itemsCount: f.items?.length || 0,
                    details: details,
                    rawDoc: f
                };
            }),
            ...clientCommandes.map(c => {
                const itemDetails = c.items?.map(it => {
                    const desc = it.description || '';
                    return desc ? `${desc}${it.quantity > 1 ? ` (${it.quantity}x)` : ''}` : '';
                }).filter(Boolean).join(', ') || '';

                const specs = [c.macColor, c.macSpecs].filter(Boolean).join(' • ');
                const details = [specs, itemDetails].filter(Boolean).join(' — ') || specs || itemDetails || '';
                const title = `${c.macModel || 'Commande Pièce/Achat'} (${c.supplierName})`;

                return {
                    id: c.id,
                    type: 'Commande' as const,
                    numero: c.numero,
                    date: c.date,
                    clientName: c.clientName || 'STOCK INTERNE',
                    title: title,
                    total: c.total,
                    advance: c.status === 'Payé' ? c.total : (c.advance || 0),
                    status: c.status,
                    itemsCount: c.items?.length || 0,
                    details: details,
                    rawDoc: c
                };
            })
        ];

        // 3. Apply selected period date criteria
        let startBound: Date | null = null;
        let endBound: Date | null = null;

        if (period === 'weekly') {
            startBound = dateFilters.weekly.start;
            endBound = dateFilters.weekly.end;
        } else if (period === 'monthly') {
            startBound = dateFilters.monthly.start;
            endBound = dateFilters.monthly.end;
        } else if (period === 'yearly') {
            startBound = dateFilters.yearly.start;
            endBound = dateFilters.yearly.end;
        } else if (period === 'custom') {
            if (startDate) {
                startBound = new Date(startDate);
                startBound.setHours(0, 0, 0, 0);
            }
            if (endDate) {
                endBound = new Date(endDate);
                endBound.setHours(23, 59, 59, 999);
            }
        }

        const filteredItems = unifiedItems.filter(item => {
            const itemDate = new Date(item.date);
            if (startBound && itemDate < startBound) return false;
            if (endBound && itemDate > endBound) return false;
            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // 4. Summarize financial numbers
        // Only sum finalized documents toward total debt to prevent non-fiat drafts from showing as due liability
        const calculableItems = filteredItems.filter(it => it.status !== 'Draft' && it.status !== 'Brouillon' && it.status !== 'Refusé' && it.status !== 'Annulé');

        const totalBilled = calculableItems.reduce((sum, it) => sum + it.total, 0);
        const totalPaid = calculableItems.reduce((sum, it) => sum + it.advance, 0);
        const remainingBalance = Math.max(0, totalBilled - totalPaid);

        // Factures Payées vs Impayées
        const facturesItems = calculableItems.filter(it => it.type === 'Facture');
        const facturesPayees = facturesItems.filter(f => f.status === 'Payé' || f.advance >= f.total);
        const facturesImpayees = facturesItems.filter(f => f.status !== 'Payé' && f.advance < f.total);

        const facturesPayeesCount = facturesPayees.length;
        const facturesPayeesSum = facturesPayees.reduce((sum, f) => sum + f.total, 0);

        const facturesImpayeesCount = facturesImpayees.length;
        const facturesImpayeesSum = facturesImpayees.reduce((sum, f) => sum + f.total, 0);
        const facturesImpayeesReste = facturesImpayees.reduce((sum, f) => sum + Math.max(0, f.total - f.advance), 0);

        // Commandes Soldées vs Commandes Restantes (Non-soldées ou En cours)
        const commandesItems = calculableItems.filter(it => it.type === 'Commande');
        const commandesSoldees = commandesItems.filter(c => c.status === 'Payé' || c.advance >= c.total);
        const commandesRestantes = commandesItems.filter(c => c.status !== 'Payé' && c.advance < c.total);

        const commandesSoldeesCount = commandesSoldees.length;
        const commandesSoldeesSum = commandesSoldees.reduce((sum, c) => sum + c.total, 0);

        const commandesRestantesCount = commandesRestantes.length;
        const commandesRestantesSum = commandesRestantes.reduce((sum, c) => sum + c.total, 0);
        const commandesRestantesRemaining = commandesRestantes.reduce((sum, c) => sum + Math.max(0, c.total - c.advance), 0);

        return {
            items: filteredItems,
            totalBilled,
            totalPaid,
            remainingBalance,
            facturesPayeesCount,
            facturesPayeesSum,
            facturesImpayeesCount,
            facturesImpayeesSum,
            facturesImpayeesReste,
            commandesSoldeesCount,
            commandesSoldeesSum,
            commandesRestantesCount,
            commandesRestantesSum,
            commandesRestantesRemaining
        };
    }, [activeClient, factures, commandes, period, startDate, endDate, dateFilters]);

    // Derived memo to apply sub-filtering to table rows
    const visibleItems = useMemo(() => {
        return reportData.items.filter(item => {
            const isDraftOrCancelled = ['Draft', 'Brouillon', 'Refusé', 'Annulé'].includes(item.status);
            
            if (subFilter === 'all') return true;
            if (isDraftOrCancelled) return false;

            const isPaidOrFullySettled = item.status === 'Payé' || item.advance >= item.total;

            if (subFilter === 'factures_payees') {
                return item.type === 'Facture' && isPaidOrFullySettled;
            }
            if (subFilter === 'factures_impayees') {
                return item.type === 'Facture' && !isPaidOrFullySettled;
            }
            if (subFilter === 'commandes_soldees') {
                return item.type === 'Commande' && isPaidOrFullySettled;
            }
            if (subFilter === 'commandes_restantes') {
                return item.type === 'Commande' && !isPaidOrFullySettled;
            }
            return true;
        });
    }, [reportData.items, subFilter]);

    // Detect duplicate items (same type, same client, same total, same date)
    const duplicateIds = useMemo(() => {
        const counts = new Map<string, number>();
        reportData.items.forEach(it => {
            const dateKey = it.date ? it.date.split('T')[0] : '';
            const clientKey = it.clientName.trim().toLowerCase();
            const key = `${it.type}_${clientKey}_${it.total}_${dateKey}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        const dupes = new Set<string>();
        reportData.items.forEach(it => {
            const dateKey = it.date ? it.date.split('T')[0] : '';
            const clientKey = it.clientName.trim().toLowerCase();
            const key = `${it.type}_${clientKey}_${it.total}_${dateKey}`;
            if ((counts.get(key) || 0) > 1) {
                dupes.add(it.id);
            }
        });
        return dupes;
    }, [reportData.items]);

    const hasDuplicatesInList = useMemo(() => {
        return visibleItems.some(item => duplicateIds.has(item.id));
    }, [visibleItems, duplicateIds]);

    const confirmDeleteItem = async () => {
        if (!itemToDelete || isDeleting) return;
        setIsDeleting(true);
        try {
            if (itemToDelete.type === 'Facture') {
                await deleteFacture(itemToDelete.id);
            } else {
                await deleteCommande(itemToDelete.id);
            }
            showToast(`${itemToDelete.type} ${itemToDelete.numero} supprimée avec succès.`, 'success');
            setItemToDelete(null);
        } catch (err) {
            console.error("Erreur suppression:", err);
            showToast("Échec de la suppression de la pièce.", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    const handlePrint = () => {
        if (reportData.items.length === 0) return;
        setIsPrintModalOpen(true);
    };

    if (loadingFactures || loadingCommandes) {
        return (
            <div className="py-20 text-center animate-pulse text-apple-muted font-bold uppercase tracking-widest text-xs">
                Génération des flux financiers...
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header section with Select & Actions */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onBack} 
                            className="p-2.5 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
                            title="Retour au Tableau de Bord"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>
                        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                            <UserIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">Rapport Financier Client (Point Client)</h2>
                            <p className="text-xs text-apple-muted">Générez un relevé financier consolidé (factures & bons de commandes)</p>
                        </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            disabled={!activeClient || reportData.items.length === 0}
                            className="px-4 py-3 bg-white text-black hover:bg-zinc-200 disabled:opacity-40 rounded-xl font-bold uppercase tracking-wider text-[10px] flex items-center gap-2 transition-all active:scale-95 shadow-xl shrink-0"
                        >
                            <PrinterIcon className="w-4 h-4" />
                            <span>Exporter le Point Client</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {/* Select Client */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-wider font-extrabold text-apple-muted">Sélectionner un Client</label>
                        <select
                            value={selectedClientPhone}
                            onChange={(e) => setSelectedClientPhone(e.target.value)}
                            className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-bold outline-none focus:border-blue-500 transition-all select-apple"
                        >
                            {clientsList.length === 0 ? (
                                <option value="">Aucun client enregistré</option>
                            ) : (
                                clientsList.map((c) => (
                                    <option key={c.phone} value={c.phone}>
                                        {c.name.toUpperCase()} ({c.phone})
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    {/* Filter Period */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-wider font-extrabold text-apple-muted">Périodicité du Point</label>
                        <div className="grid grid-cols-5 bg-zinc-900/60 p-1 border border-white/10 rounded-xl">
                            {(['all', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((p) => {
                                const labels: Record<PeriodType, string> = {
                                    all: 'Tous',
                                    weekly: 'Hebdo',
                                    monthly: 'Mensuel',
                                    yearly: 'Annuel',
                                    custom: 'Perso'
                                };
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPeriod(p)}
                                        className={`py-1.5 text-[10px] font-extrabold rounded-lg capitalize transition-all ${
                                            period === p 
                                                ? 'bg-white text-black font-black' 
                                                : 'text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                        {labels[p]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Dynamic dates if custom */}
                    {period === 'custom' ? (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                                <label className="text-[9px] uppercase tracking-wider font-extrabold text-apple-muted">Début</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] uppercase tracking-wider font-extrabold text-apple-muted">Fin</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none font-mono"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="text-zinc-500 text-xs flex items-center gap-2 pl-3 pt-4">
                            <CalendarDaysIcon className="w-4 h-4 text-zinc-600 shrink-0" />
                            <span>
                                {period === 'all' && "Période complète chargée de l'activité."}
                                {period === 'weekly' && `Semaine en cours : du ${dateFilters.weekly.start.toLocaleDateString('fr-FR')} au ${dateFilters.weekly.end.toLocaleDateString('fr-FR')}`}
                                {period === 'monthly' && `Mois en cours : du ${dateFilters.monthly.start.toLocaleDateString('fr-FR')} au ${dateFilters.monthly.end.toLocaleDateString('fr-FR')}`}
                                {period === 'yearly' && `Année en cours : du ${dateFilters.yearly.start.toLocaleDateString('fr-FR')} au ${dateFilters.yearly.end.toLocaleDateString('fr-FR')}`}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Financial Dashboard summaries for selected parameters */}
            {activeClient ? (
                <>
                    {/* Synthèse Financière Globale */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="glass-card p-5 rounded-2xl flex items-center shadow-md border border-white/5 relative overflow-hidden bg-zinc-900/20">
                            <div className="p-3 mr-4 bg-zinc-950 rounded-xl border border-white/10 text-zinc-400">
                                <BanknotesIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mb-0.5">Total Émis Finalisé</p>
                                <p className="text-lg font-black text-white">{reportData.totalBilled.toLocaleString('fr-FR')} F CFA</p>
                            </div>
                        </div>

                        <div className="glass-card p-5 rounded-2xl flex items-center shadow-md border border-white/5 relative overflow-hidden bg-zinc-900/20">
                            <div className="p-3 mr-4 bg-zinc-950 rounded-xl border border-white/10 text-green-400/80">
                                <CheckCircleIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mb-0.5">Total Encaissé / Avances</p>
                                <p className="text-lg font-black text-green-400">{reportData.totalPaid.toLocaleString('fr-FR')} F CFA</p>
                            </div>
                        </div>

                        <div className="glass-card p-5 rounded-2xl flex items-center shadow-md border border-white/5 relative overflow-hidden bg-zinc-900/20">
                            <div className="p-3 mr-4 bg-zinc-950 rounded-xl border border-white/10 text-yellow-500/80">
                                <InfoIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mb-0.5">Solde Global Restant dû</p>
                                <p className={`text-lg font-black ${reportData.remainingBalance > 0 ? 'text-yellow-500 animate-pulse' : 'text-zinc-300'}`}>
                                    {reportData.remainingBalance.toLocaleString('fr-FR')} F CFA
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Comptabilisation détaillée demandée par le client */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Section Factures */}
                        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                            <h3 className="text-xs font-black text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1.5 h-3 bg-blue-500 rounded-sm inline-block"></span>
                                Point des Factures
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-zinc-950/40 p-4 rounded-xl border border-white/5 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Factures Payées</span>
                                        <CheckBadgeIcon className="w-4 h-4 text-green-400" />
                                    </div>
                                    <p className="text-xs font-extrabold text-zinc-400">{reportData.facturesPayeesCount} document(s)</p>
                                    <p className="text-base font-black text-white font-mono">{reportData.facturesPayeesSum.toLocaleString('fr-FR')} F</p>
                                </div>
                                <div className="bg-zinc-950/40 p-4 rounded-xl border border-white/5 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Factures Impayées</span>
                                        <AlertTriangleIcon className="w-4 h-4 text-red-400" />
                                    </div>
                                    <p className="text-xs font-extrabold text-zinc-400">{reportData.facturesImpayeesCount} document(s)</p>
                                    <div className="space-y-0.5">
                                        <p className="text-xs text-zinc-500">Billed: {reportData.facturesImpayeesSum.toLocaleString('fr-FR')} F</p>
                                        <p className="text-sm font-black text-red-400 font-mono">Impayé : {reportData.facturesImpayeesReste.toLocaleString('fr-FR')} F</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section Commandes */}
                        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1.5 h-3 bg-amber-500 rounded-sm inline-block"></span>
                                Point des Commandes
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-zinc-950/40 p-4 rounded-xl border border-white/5 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Commandes Soldées</span>
                                        <CheckBadgeIcon className="w-4 h-4 text-green-400" />
                                    </div>
                                    <p className="text-xs font-extrabold text-zinc-400">{reportData.commandesSoldeesCount} document(s)</p>
                                    <p className="text-base font-black text-white font-mono">{reportData.commandesSoldeesSum.toLocaleString('fr-FR')} F</p>
                                </div>
                                <div className="bg-zinc-950/40 p-4 rounded-xl border border-white/5 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Le Reste / En Cours</span>
                                        <ClockIcon className="w-4 h-4 text-yellow-500" />
                                    </div>
                                    <p className="text-xs font-extrabold text-zinc-400">{reportData.commandesRestantesCount} document(s)</p>
                                    <div className="space-y-0.5">
                                        <p className="text-xs text-zinc-500">Billed: {reportData.commandesRestantesSum.toLocaleString('fr-FR')} F</p>
                                        <p className="text-sm font-black text-yellow-500 font-mono">Restant : {reportData.commandesRestantesRemaining.toLocaleString('fr-FR')} F</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Consolidated items table */}
                    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                        <div className="px-6 py-4.5 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                                    Justificatifs financiers de l'activité
                                </h3>
                                <p className="text-[10px] text-zinc-500 uppercase mt-0.5 font-bold">
                                    {activeClient.name} &middot; {visibleItems.length} ligne(s) affichée(s)
                                </p>
                            </div>
                            
                            {/* Filtres par point comptable */}
                            <div className="flex flex-wrap gap-1.5 bg-zinc-950/60 p-1 border border-white/10 rounded-xl">
                                {[
                                    { id: 'all', label: `Tout (${reportData.items.length})` },
                                    { id: 'factures_payees', label: `Fact. Payées (${reportData.facturesPayeesCount})` },
                                    { id: 'factures_impayees', label: `Fact. Impayées (${reportData.facturesImpayeesCount})` },
                                    { id: 'commandes_soldees', label: `Cmd. Soldées (${reportData.commandesSoldeesCount})` },
                                    { id: 'commandes_restantes', label: `Cmd. Restantes (${reportData.commandesRestantesCount})` }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setSubFilter(tab.id as SubFilterType)}
                                        className={`px-2.5 py-1.5 text-[9px] font-extrabold rounded-lg capitalize transition-all ${
                                            subFilter === tab.id
                                                ? 'bg-white text-black font-black'
                                                : 'text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {hasDuplicatesInList && (
                            <div className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-amber-300 text-xs">
                                <div className="flex items-center gap-2">
                                    <AlertTriangleIcon className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span>
                                        <strong>Doublons financiers détectés :</strong> Plusieurs pièces comptables pour ce client ont un montant et une date identiques (probablement issues de conversions multiples). Vous pouvez supprimer les doublons superflus via l'icône corbeille à droite.
                                    </span>
                                </div>
                            </div>
                        )}

                        {visibleItems.length === 0 ? (
                            <div className="py-16 text-center text-apple-muted text-xs font-semibold">
                                Aucun mouvement financier correspondant dans la période sélectionnée pour ce filtre.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-zinc-950/20 text-apple-muted font-extrabold text-[8px] uppercase tracking-widest">
                                            <th className="px-5 py-3">Type</th>
                                            <th className="px-5 py-3">N° Pièce</th>
                                            {activeClient.phone === 'all_clients' && <th className="px-5 py-3 text-left">Client</th>}
                                            <th className="px-5 py-3">Date</th>
                                            <th className="px-5 py-3">Désignation / Matériels</th>
                                            <th className="px-5 py-3 text-right">Montant Total</th>
                                            <th className="px-5 py-3 text-right">Montant Encaissé</th>
                                            <th className="px-5 py-3 text-right">Reste</th>
                                            <th className="px-5 py-3 text-center">Statut</th>
                                            <th className="px-5 py-3 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {visibleItems.map((item) => {
                                            const total = item.total;
                                            const paid = item.advance;
                                            const due = Math.max(0, total - paid);
                                            const isDupe = duplicateIds.has(item.id);

                                            return (
                                                <tr key={item.id} className="hover:bg-white/5 text-[11px] font-medium transition-colors">
                                                    <td className="px-5 py-3.5">
                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                                            item.type === 'Facture' 
                                                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                        }`}>
                                                            {item.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 font-mono text-zinc-300 font-bold">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span>{item.numero}</span>
                                                            {isDupe && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[8px] font-bold" title="Doublon potentiel : même client, montant et date">
                                                                    <AlertTriangleIcon className="w-2.5 h-2.5" /> Doublon
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {activeClient.phone === 'all_clients' && (
                                                        <td className="px-5 py-3.5 text-white font-extrabold uppercase text-[10px]">
                                                            {item.clientName}
                                                        </td>
                                                    )}
                                                    <td className="px-5 py-3.5 text-zinc-400">{new Date(item.date).toLocaleDateString('fr-FR')}</td>
                                                    <td className="px-5 py-3.5 text-zinc-300 max-w-xs" title={item.details ? `${item.title} — ${item.details}` : item.title}>
                                                        <div className="font-bold text-white leading-tight">{item.title}</div>
                                                        {item.details && (
                                                            <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug break-words">
                                                                {item.details}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-mono text-zinc-200 font-bold">{total.toLocaleString('fr-FR')} F</td>
                                                    <td className="px-5 py-3.5 text-right font-mono text-green-400">{paid.toLocaleString('fr-FR')} F</td>
                                                    <td className="px-5 py-3.5 text-right font-mono text-yellow-500">{due.toLocaleString('fr-FR')} F</td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold ${
                                                            item.status === 'Payé' || item.status === 'Finalisé' || item.status === 'Accepté' || item.status === 'Reçu'
                                                                ? 'bg-green-500/10 text-green-400 border border-green-500/15'
                                                                : item.status === 'Brouillon' || item.status === 'Draft'
                                                                ? 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20'
                                                                : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                                        }`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <button
                                                            onClick={() => setItemToDelete({
                                                                id: item.id,
                                                                type: item.type,
                                                                numero: item.numero,
                                                                total: item.total,
                                                                clientName: item.clientName
                                                            })}
                                                            className="p-1.5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-lg transition-colors group"
                                                            title={`Supprimer cette ${item.type.toLowerCase()} (utile pour nettoyer les doublons)`}
                                                        >
                                                            <TrashIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="py-20 text-center glass-card border border-white/5 rounded-2xl">
                    <p className="text-apple-muted text-sm font-semibold">Aucun client avec factures ou commandes n'a été trouvé.</p>
                </div>
            )}

            {/* PRINT MODAL DESIGN FOR STATEMENT */}
            {isPrintModalOpen && activeClient && (
                <PreviewModal
                    isOpen={isPrintModalOpen}
                    onClose={() => setIsPrintModalOpen(false)}
                    fileName={`POINT_FINANCIER_${activeClient.name.replace(/\s/g, '_')}.pdf`}
                >
                    <div className="printable-page">
                        {/* Print Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', fontFamily: '"Inter", sans-serif' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                    <AppleLogo style={{ width: '22px', height: '22px', color: '#000' }} />
                                    <h1 style={{ fontSize: '20pt', fontWeight: '900', letterSpacing: '0.02em', margin: 0 }}>TGS - CI</h1>
                                </div>
                                <div style={{ fontSize: '6.5pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666' }}>L'excellence de la réparation MacBook & Immobilier</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <h2 style={{ fontSize: '13pt', fontWeight: '900', borderBottom: '2.5pt solid #000', paddingBottom: '3px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Point Financier Client</h2>
                                <div style={{ fontSize: '8pt', color: '#666', marginTop: '3px' }}>Date: {new Date().toLocaleDateString('fr-FR')}</div>
                            </div>
                        </div>

                        {/* Customer & Summary Financial Block */}
                        <div style={{ border: '1pt solid #000', padding: '15px', marginBottom: '15px', background: '#F9F9F9', fontFamily: '"Inter", sans-serif' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '15.5px' }}>
                                <div>
                                    <div style={{ fontSize: '6.5pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666', marginBottom: '4px' }}>Bénéficiaire / Client :</div>
                                    <div style={{ fontSize: '12pt', fontWeight: '900' }}>{activeClient.name.toUpperCase()}</div>
                                    <div style={{ fontSize: '10pt', fontWeight: '700', marginTop: '4px', fontFamily: 'monospace' }}>Tél: {activeClient.phone}</div>
                                    <div style={{ fontSize: '8pt', color: '#666', marginTop: '5px' }}>
                                        Périodicité : 
                                        <strong>
                                            {period === 'all' && " Intégrale (Tout l'historique)"}
                                            {period === 'weekly' && " Hebdomadaire (Cette Semaine)"}
                                            {period === 'monthly' && " Mensuelle (Ce Mois)"}
                                            {period === 'yearly' && " Annuelle (Cette Année)"}
                                            {period === 'custom' && ` Personnalisée (${startDate || 'Debut'} au ${endDate || 'Fin'})`}
                                        </strong>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ fontSize: '6.5pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#666', marginBottom: '4px' }}>Synthèse des Mouvements :</div>
                                    <div style={{ fontSize: '9pt', color: '#333' }}>Total Émis: <strong style={{ fontFamily: 'monospace' }}>{reportData.totalBilled.toLocaleString()} F</strong></div>
                                    <div style={{ fontSize: '9pt', color: '#2f855a' }}>Total Encaissé: <strong style={{ fontFamily: 'monospace' }}>{reportData.totalPaid.toLocaleString()} F</strong></div>
                                    <div style={{ fontSize: '11pt', fontWeight: '900', marginTop: '6px', borderTop: '1pt solid #000', paddingTop: '4px' }}>
                                        RESTE À PERCEVOIR: <span style={{ color: reportData.remainingBalance > 0 ? '#c53030' : '#2f855a', fontFamily: 'monospace' }}>{reportData.remainingBalance.toLocaleString()} F CFA</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Accounting Point for Print */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px', fontFamily: '"Inter", sans-serif', fontSize: '8pt' }}>
                            <div style={{ border: '0.5pt solid #000', padding: '10px', background: '#F5F9FC' }}>
                                <div style={{ fontWeight: 'bold', borderBottom: '0.5pt solid #000', paddingBottom: '3px', marginBottom: '5px', textTransform: 'uppercase', fontSize: '7pt', color: '#1a365d' }}>Point des Factures</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                    <span>Factures Payées ({reportData.facturesPayeesCount}) :</span>
                                    <strong style={{ fontFamily: 'monospace' }}>{reportData.facturesPayeesSum.toLocaleString()} F</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c53030' }}>
                                    <span>Factures Impayées ({reportData.facturesImpayeesCount}) :</span>
                                    <strong style={{ fontFamily: 'monospace' }}>Reste: {reportData.facturesImpayeesReste.toLocaleString()} F</strong>
                                </div>
                            </div>
                            <div style={{ border: '0.5pt solid #000', padding: '10px', background: '#FCFAF5' }}>
                                <div style={{ fontWeight: 'bold', borderBottom: '0.5pt solid #000', paddingBottom: '3px', marginBottom: '5px', textTransform: 'uppercase', fontSize: '7pt', color: '#744210' }}>Point des Commandes (Approvisionnements)</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                    <span>Commandes Soldées ({reportData.commandesSoldeesCount}) :</span>
                                    <strong style={{ fontFamily: 'monospace' }}>{reportData.commandesSoldeesSum.toLocaleString()} F</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#744210' }}>
                                    <span>Restantes / En cours ({reportData.commandesRestantesCount}) :</span>
                                    <strong style={{ fontFamily: 'monospace' }}>Reste: {reportData.commandesRestantesRemaining.toLocaleString()} F</strong>
                                </div>
                            </div>
                        </div>

                        {/* Statement Table of Documents */}
                        <h3 style={{ fontSize: '10pt', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px', borderBottom: '1pt solid #000', paddingBottom: '3px', fontFamily: '"Inter", sans-serif' }}>
                            Détail des Factures & Commandes ({reportData.items.length} lignes)
                        </h3>
                        
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontFamily: '"Inter", sans-serif' }}>
                            <thead>
                                <tr style={{ background: '#000', color: '#FFF' }}>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '7.5pt', fontWeight: 'bold' }}>PIÈCE / TYPE</th>
                                    {activeClient.phone === 'all_clients' && <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '7.5pt', fontWeight: 'bold' }}>CLIENT</th>}
                                    <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '7.5pt', fontWeight: 'bold' }}>DATE</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '7.5pt', fontWeight: 'bold' }}>DESCRIPTION</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '7.5pt', fontWeight: 'bold' }}>TOTAL (F)</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '7.5pt', fontWeight: 'bold' }}>ACQUIT (F)</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '7.5pt', fontWeight: 'bold' }}>RESTE (F)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.items.map((item) => {
                                    const total = item.total;
                                    const paid = item.advance;
                                    const due = Math.max(0, total - paid);

                                    return (
                                        <tr key={item.id} style={{ borderBottom: '0.5pt solid #DDD' }}>
                                            <td style={{ padding: '5.5px 8px', fontSize: '8pt', fontWeight: 'bold' }}>
                                                <span style={{ fontSize: '7pt', color: '#555', marginRight: '5px' }}>[{item.type.toUpperCase()}]</span> 
                                                <span style={{ fontFamily: 'monospace' }}>{item.numero}</span>
                                            </td>
                                            {activeClient.phone === 'all_clients' && (
                                                <td style={{ padding: '5.5px 8px', fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase' }}>
                                                    {item.clientName}
                                                </td>
                                            )}
                                            <td style={{ padding: '5.5px 8px', fontSize: '8pt', color: '#444' }}>{new Date(item.date).toLocaleDateString('fr-FR')}</td>
                                            <td style={{ padding: '5.5px 8px', fontSize: '8pt', color: '#333' }}>
                                                <div style={{ fontWeight: 'bold' }}>{item.title}</div>
                                                {item.details && <div style={{ fontSize: '6.5pt', color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>{item.details}</div>}
                                            </td>
                                            <td style={{ padding: '5.5px 8px', textAlign: 'right', fontSize: '8pt', fontWeight: 'bold', fontFamily: 'monospace' }}>{total.toLocaleString()}</td>
                                            <td style={{ padding: '5.5px 8px', textAlign: 'right', fontSize: '8pt', color: '#2f855a', fontFamily: 'monospace' }}>{paid.toLocaleString()}</td>
                                            <td style={{ padding: '5.5px 8px', textAlign: 'right', fontSize: '8pt', fontWeight: 'bold', color: due > 0 ? '#c53030' : '#2f855a', fontFamily: 'monospace' }}>{due.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Signatures & Footer / Legal Block */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '40px', fontFamily: '"Inter", sans-serif', fontSize: '8pt' }}>
                            <div style={{ border: '0.5pt solid #EEE', padding: '10px', height: '80px' }}>
                                <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '7pt', color: '#666', borderBottom: '0.5pt solid #EEE', paddingBottom: '3px', marginBottom: '5px' }}>Visa de l'Atelier Financier (TGS-CI)</div>
                                <div style={{ fontSize: '6.5pt', color: '#999', fontStyle: 'italic', marginTop: '5px' }}>Cachet, Date et Signature de l'Opérateur</div>
                            </div>
                            <div style={{ border: '0.5pt solid #EEE', padding: '10px', height: '80px', textAlign: 'right' }}>
                                <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '7pt', color: '#666', borderBottom: '0.5pt solid #EEE', paddingBottom: '3px', marginBottom: '5px' }}>Bon pour accord Client</div>
                                <div style={{ fontSize: '6.5pt', color: '#999', fontStyle: 'italic', marginTop: '5px' }}>Mention manuscrite "Lu et Approuvé" suivie de la signature</div>
                            </div>
                        </div>

                        {/* Brand Footer */}
                        <div style={{ marginTop: '55px' }}>
                            <footer style={{ textAlign: 'center', padding: '10px 0', borderTop: '0.5pt solid #EEE', fontSize: '6.5pt', color: '#AAA', fontWeight: 'bold', textTransform: 'uppercase', fontFamily: '"Inter", sans-serif' }}>
                                TGS - CARREFOUR FAYA | DIRECTION COMMERCIALE & FINANCIÈRE | +225 07 57 13 35 07 | WORKSHOP CERTIFIED COCODY
                            </footer>
                        </div>
                    </div>
                </PreviewModal>
            )}

            {/* CONFIRMATION DE SUPPRESSION DE PIÈCE (DOUBLON / ERREUR) */}
            {itemToDelete && (
                <ConfirmationModal
                    isOpen={!!itemToDelete}
                    onClose={() => !isDeleting && setItemToDelete(null)}
                    onConfirm={confirmDeleteItem}
                    title={`Supprimer la ${itemToDelete.type.toLowerCase()} ?`}
                    message={
                        <div className="space-y-3">
                            <p className="text-sm text-slate-200">
                                Êtes-vous sûr de vouloir supprimer cette pièce de la comptabilité ?
                            </p>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Type de document :</span>
                                    <strong className="text-white">{itemToDelete.type}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Numéro de pièce :</span>
                                    <strong className="text-white font-mono">{itemToDelete.numero}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Client :</span>
                                    <strong className="text-white">{itemToDelete.clientName}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Montant total :</span>
                                    <strong className="text-emerald-400 font-mono">{itemToDelete.total.toLocaleString('fr-FR')} F CFA</strong>
                                </div>
                            </div>
                            <p className="text-xs text-amber-300 font-medium">
                                💡 Cette action permet notamment de nettoyer immédiatement les factures créées en double lors d'anciennes conversions multiples.
                            </p>
                        </div>
                    }
                    confirmText={isDeleting ? "Suppression en cours..." : "Supprimer définitivement"}
                    confirmButtonClass="bg-rose-600 hover:bg-rose-700"
                />
            )}
        </div>
    );
};
