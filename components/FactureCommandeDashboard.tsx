
import React, { useState, useMemo, useEffect } from 'react';
import { useToastContext } from '../context/ToastContext.tsx';
import FactureList from './FactureList.tsx';
import ProformaList from './ProformaList.tsx';
import CommandeList from './CommandeList.tsx';
import MonthlyRevenueChart from './MonthlyRevenueChart.tsx';
import RevenueAndUnpaidEvolutionChart from './RevenueAndUnpaidEvolutionChart.tsx';
import OrdersBySupplierChart from './OrdersBySupplierChart.tsx';
import RepairTypesFrequencyChart from './RepairTypesFrequencyChart.tsx';
import BackupManager from './BackupManager.tsx';
import SimpleDocumentGenerator from './SimpleDocumentGenerator.tsx';
import { ClientFinancialReport } from './ClientFinancialReport.tsx';
import useFactures from '../hooks/useFactures.ts';
import useCommandes from '../hooks/useCommandes.ts';
import useRepairTickets from '../hooks/useRepairTickets.ts';
import { DocumentDuplicateIcon, BanknotesIcon, ShoppingCartIcon, ArrowPathIcon, ChartBarIcon, BookOpenIcon, UserIcon, ExclamationTriangleIcon, PhoneIcon, CheckCircleIcon, ClockIcon } from './icons.tsx';
import DashboardLayout, { NavItem } from './DashboardLayout.tsx';


type View = 'dashboard' | 'factures' | 'proformas' | 'commandes' | 'backup' | 'documents' | 'client_statement';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="glass-card p-6 rounded-2xl flex items-center shadow-xl border border-white/5">
        <div className="p-4 mr-5 bg-white/5 rounded-2xl">
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-black text-apple-muted uppercase tracking-widest mb-1">{title}</p>
            <p className="text-2xl font-black text-white">{value}</p>
        </div>
    </div>
);

const DashboardContent: React.FC = () => {
    const { factures, loading: facturesLoading } = useFactures();
    const { commandes, loading: commandesLoading } = useCommandes();
    const { tickets, loading: ticketsLoading } = useRepairTickets();
    const { showToast } = useToastContext();

    // Alerte automatique pour les commandes impayées de plus de 30 jours
    useEffect(() => {
        if (commandesLoading || !commandes || commandes.length === 0) return;

        const now = new Date();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        commandes.forEach(c => {
            // Est-elle impayée ?
            if (c.status === 'Payé' || c.status === 'Annulé') return;
            const unpaidAmount = c.total - (c.advance || 0);
            if (unpaidAmount <= 0) return;

            if (!c.date) return;
            const orderDate = new Date(c.date);
            if (isNaN(orderDate.getTime())) return;

            const diffMs = now.getTime() - orderDate.getTime();
            if (diffMs > thirtyDaysMs) {
                const sessionKey = `warned-overdue-order-${c.id || c.numero}`;
                if (!sessionStorage.getItem(sessionKey)) {
                    sessionStorage.setItem(sessionKey, 'true');
                    const supplierLabel = c.supplierName ? ` [Fournisseur: ${c.supplierName}]` : '';
                    const deviceLabel = c.macModel ? ` (${c.macModel})` : '';
                    showToast(
                        `Commande impayée en retard (+30 jours) : N° ${c.numero}${deviceLabel}${supplierLabel} - Solde restant dû : ${unpaidAmount.toLocaleString('fr-FR')} F`,
                        'warning'
                    );
                }
            }
        });
    }, [commandes, commandesLoading, showToast]);

    const [activeAlertTab, setActiveAlertTab] = useState<'factures' | 'commandes' | 'fiches'>('factures');
    const [collapsedAlerts, setCollapsedAlerts] = useState(false);

    // Dynamic extraction of all years present in the dataset
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        years.add(new Date().getFullYear()); // Always include current year as active option
        factures.forEach(f => {
            if (f.date) {
                const y = new Date(f.date).getFullYear();
                if (!isNaN(y)) years.add(y);
            }
        });
        commandes.forEach(c => {
            if (c.date) {
                const y = new Date(c.date).getFullYear();
                if (!isNaN(y)) years.add(y);
            }
        });
        tickets.forEach(t => {
            if (t.createdAt) {
                const y = new Date(t.createdAt).getFullYear();
                if (!isNaN(y)) years.add(y);
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [factures, commandes, tickets]);

    const currentYearStr = new Date().getFullYear().toString();
    const currentMonthStr = (new Date().getMonth() + 1).toString();

    const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
    const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

    const stats = useMemo(() => {
        const filterFn = (dateStr: string) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return false;
            
            const yr = d.getFullYear().toString();
            const mo = (d.getMonth() + 1).toString();
            
            if (selectedYear !== 'all' && yr !== selectedYear) return false;
            if (selectedMonth !== 'all' && mo !== selectedMonth) return false;
            return true;
        };

        const invoiceRevenue = factures
            .filter(f => (f.status === 'Finalisé' || f.status === 'Payé') && filterFn(f.date))
            .reduce((sum, f) => sum + f.total, 0);
            
        const orderRevenue = commandes
            .filter(c => c.isRevenue && (c.status === 'Payé' || c.status === 'Reçu') && !c.isLinkedToTicket && filterFn(c.date))
            .reduce((sum, c) => sum + c.total, 0);

        const revenueForPeriod = invoiceRevenue + orderRevenue;
        
        const pendingInvoices = factures.filter(f => f.status === 'Brouillon' && filterFn(f.date)).length;
        
        const ordersForPeriod = commandes
            .filter(c => !c.isRevenue && (c.status === 'Commandé' || c.status === 'Reçu' || c.status === 'Payé') && filterFn(c.date))
            .reduce((sum, c) => sum + c.total, 0);

        return { revenueForPeriod, pendingInvoices, ordersForPeriod };
    }, [factures, commandes, selectedYear, selectedMonth]);

    const overdueData = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const filterFn = (dateStr: string) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return false;
            
            const yr = d.getFullYear().toString();
            const mo = (d.getMonth() + 1).toString();
            
            if (selectedYear !== 'all' && yr !== selectedYear) return false;
            if (selectedMonth !== 'all' && mo !== selectedMonth) return false;
            return true;
        };

        // Factures > 15 jours avec solde restant dû (exclut Brouillon et Annulé)
        const overdueInvoices = factures.filter(f => {
            if (f.status === 'Payé' || f.status === 'Annulé' || f.status === 'Brouillon') return false;
            const due = f.total - (f.advance || 0);
            if (due <= 0) return false;

            const itemDate = new Date(f.date);
            itemDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
            
            return diffDays > 15 && filterFn(f.date);
        }).map(f => {
            const itemDate = new Date(f.date);
            itemDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
            return {
                id: f.id,
                numero: f.numero,
                clientName: f.clientName || 'Inconnu',
                clientPhone: f.clientPhone || 'Aucun',
                macModel: f.macModel || 'Non spécifié',
                total: f.total,
                advance: f.advance || 0,
                due: f.total - (f.advance || 0),
                diffDays,
                date: f.date
            };
        });

        // Commandes > 30 jours avec solde restant dû (exclut Payé et Annulé)
        const overdueOrders = commandes.filter(c => {
            if (c.status === 'Payé' || c.status === 'Annulé' || c.isLinkedToTicket) return false;
            const due = c.total - (c.advance || 0);
            if (due <= 0) return false;

            const itemDate = new Date(c.date);
            itemDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
            
            return diffDays > 30 && filterFn(c.date);
        }).map(c => {
            const itemDate = new Date(c.date);
            itemDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
            return {
                id: c.id,
                numero: c.numero,
                clientName: c.clientName || 'STOCK INTERNE',
                clientPhone: c.clientPhone || 'Aucun',
                macModel: c.macModel,
                total: c.total,
                advance: c.advance || 0,
                due: c.total - (c.advance || 0),
                diffDays,
                date: c.date
            };
        });

        // Fiches > 10 jours avec solde restant dû (exclut Annulé)
        const overdueTickets = tickets.filter(t => {
            if (t.status === 'Annulé') return false;
            const total = (t.costs?.diagnostic || 0) + (t.costs?.repair || 0);
            const due = total - (t.costs?.advance || 0);
            if (due <= 0) return false;

            const itemDate = new Date(t.createdAt);
            itemDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
            
            return diffDays > 10 && filterFn(t.createdAt);
        }).map(t => {
            const itemDate = new Date(t.createdAt);
            itemDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
            return {
                id: t.id,
                numero: `FICHE-${t.id.slice(-5).toUpperCase()}`,
                clientName: t.client?.name || 'Inconnu',
                clientPhone: t.client?.phone || 'Aucun',
                macModel: t.macModel || 'Non spécifié',
                total: (t.costs?.diagnostic || 0) + (t.costs?.repair || 0),
                advance: t.costs?.advance || 0,
                due: ((t.costs?.diagnostic || 0) + (t.costs?.repair || 0)) - (t.costs?.advance || 0),
                diffDays,
                date: t.createdAt.split('T')[0]
            };
        });

        const sumInvoicesDue = overdueInvoices.reduce((sum, f) => sum + f.due, 0);
        const sumOrdersDue = overdueOrders.reduce((sum, c) => sum + c.due, 0);
        const sumTicketsDue = overdueTickets.reduce((sum, t) => sum + t.due, 0);
        const totalOutstanding = sumInvoicesDue + sumOrdersDue + sumTicketsDue;
        const totalCount = overdueInvoices.length + overdueOrders.length + overdueTickets.length;

        return {
            invoices: overdueInvoices,
            orders: overdueOrders,
            tickets: overdueTickets,
            sumInvoicesDue,
            sumOrdersDue,
            sumTicketsDue,
            totalOutstanding,
            totalCount
        };
    }, [factures, commandes, tickets, selectedYear, selectedMonth]);

    // KPI Globaux et Temps Réel (Demande utilisateur)
    const kpis = useMemo(() => {
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;

        // 1. Chiffre d'affaires du mois en cours (factures et commandes revenus de ce mois civil)
        const invRev = factures
            .filter(f => {
                if (f.status !== 'Finalisé' && f.status !== 'Payé') return false;
                if (!f.date) return false;
                const fd = new Date(f.date);
                return fd.getFullYear() === curYear && (fd.getMonth() + 1) === curMonth;
            })
            .reduce((sum, f) => sum + f.total, 0);

        const ordRev = commandes
            .filter(c => {
                if (!c.isRevenue) return false;
                if (c.status !== 'Payé' && c.status !== 'Reçu') return false;
                if (c.isLinkedToTicket) return false;
                if (!c.date) return false;
                const cd = new Date(c.date);
                return cd.getFullYear() === curYear && (cd.getMonth() + 1) === curMonth;
            })
            .reduce((sum, c) => sum + c.total, 0);

        const currentMonthRevenue = invRev + ordRev;

        // 2. Chiffre total des impayés (toutes factures, commandes, et fiches avec solde restant)
        const unpaidFactures = factures
            .filter(f => f.status !== 'Payé' && f.status !== 'Annulé' && f.status !== 'Brouillon')
            .reduce((sum, f) => sum + (f.total - (f.advance || 0)), 0);

        const unpaidCommandes = commandes
            .filter(c => c.status !== 'Payé' && c.status !== 'Annulé' && !c.isLinkedToTicket)
            .reduce((sum, c) => sum + (c.total - (c.advance || 0)), 0);

        const unpaidTickets = tickets
            .filter(t => t.status !== 'Annulé')
            .reduce((sum, t) => {
                const totalComp = (t.costs?.diagnostic || 0) + (t.costs?.repair || 0);
                const advance = t.costs?.advance || 0;
                return sum + (totalComp - advance);
            }, 0);

        const totalImpayes = unpaidFactures + unpaidCommandes + unpaidTickets;

        // 3. Nombre de commandes en attente de paiement
        const pendingPaymentOrdersCount = commandes
            .filter(c => c.status !== 'Payé' && c.status !== 'Annulé' && !c.isLinkedToTicket && (c.total - (c.advance || 0)) > 0)
            .length;

        return {
            currentMonthRevenue,
            totalImpayes,
            pendingPaymentOrdersCount
        };
    }, [factures, commandes, tickets]);

    const getPeriodLabel = (baseLabel: string) => {
        const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        if (selectedMonth === 'all' && selectedYear === 'all') {
            return `${baseLabel} (Toutes périodes)`;
        }
        if (selectedMonth !== 'all' && selectedYear !== 'all') {
            return `${baseLabel} (${months[parseInt(selectedMonth) - 1]} ${selectedYear})`;
        }
        if (selectedMonth !== 'all' && selectedYear === 'all') {
            return `${baseLabel} (${months[parseInt(selectedMonth) - 1]} - Global)`;
        }
        return `${baseLabel} (${selectedYear})`;
    };

    if (facturesLoading || commandesLoading || ticketsLoading) return <div className="py-20 text-center animate-pulse text-apple-muted font-bold uppercase tracking-widest flex flex-col justify-center items-center gap-3">
        <ArrowPathIcon className="h-8 w-8 text-indigo-400 animate-spin" />
        Calcul des indicateurs financiers...
    </div>;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Widgets de Résumé / Indicateurs Clés Globaux */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Chiffre d'affaires du mois en cours */}
                <div id="kpi-revenue-current-month" className="glass-card p-6 rounded-2xl flex items-center shadow-xl border border-white/5 relative overflow-hidden bg-gradient-to-br from-zinc-900/40 via-emerald-950/10 to-zinc-900/40">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-3xl -mr-10 -mt-10"></div>
                    <div className="p-4 mr-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
                        <BanknotesIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                            CA MOIS EN COURS ({new Date().toLocaleString('fr-FR', { month: 'long' })})
                        </p>
                        <p className="text-2xl font-black text-white">{kpis.currentMonthRevenue.toLocaleString('fr-FR')} F</p>
                        <p className="text-[9px] text-zinc-400 mt-1 font-bold uppercase">Prestations &amp; Matériels réglés ou finalisés</p>
                    </div>
                </div>

                {/* 2. Total des impayés */}
                <div id="kpi-unpaid-total" className="glass-card p-6 rounded-2xl flex items-center shadow-xl border border-white/5 relative overflow-hidden bg-gradient-to-br from-zinc-900/40 via-rose-950/10 to-zinc-900/40">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full filter blur-3xl -mr-10 -mt-10"></div>
                    <div className="p-4 mr-5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Total des impayés (Créances)</p>
                        <p className="text-2xl font-black text-rose-500">{kpis.totalImpayes.toLocaleString('fr-FR')} F</p>
                        <p className="text-[9px] text-zinc-400 mt-1 font-bold uppercase">Factures, fiches &amp; commandes dues</p>
                    </div>
                </div>

                {/* 3. Nombre de commandes en attente de paiement */}
                <div id="kpi-pending-orders" className="glass-card p-6 rounded-2xl flex items-center shadow-xl border border-white/5 relative overflow-hidden bg-gradient-to-br from-zinc-900/40 via-indigo-950/10 to-zinc-900/40">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full filter blur-3xl -mr-10 -mt-10"></div>
                    <div className="p-4 mr-5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                        <ShoppingCartIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Commandes en attente de paiement</p>
                        <p className="text-2xl font-black text-white">{kpis.pendingPaymentOrdersCount} commande{kpis.pendingPaymentOrdersCount > 1 ? 's' : ''}</p>
                        <p className="text-[9px] text-zinc-400 mt-1 font-bold uppercase">Dépenses d'achat matériel non soldées</p>
                    </div>
                </div>
            </div>

            {/* Filtre de Période / Sélecteur Temporel */}
            <div className="glass-card p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-950/25">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                        <ClockIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest leading-none">
                            FILTRE SPÉCIFIQUE DES FLUX &amp; ENCOURS
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 leading-relaxed">
                            Ajustez la période pour consulter les chiffres d'affaires, dépenses et créances
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Quick presets */}
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 text-[9px] font-black uppercase">
                        <button
                            onClick={() => {
                                setSelectedMonth(currentMonthStr);
                                setSelectedYear(currentYearStr);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg transition-all ${
                                selectedMonth === currentMonthStr && selectedYear === currentYearStr
                                    ? 'bg-indigo-600 text-white shadow'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Ce mois
                        </button>
                        <button
                            onClick={() => {
                                setSelectedMonth('all');
                                setSelectedYear(currentYearStr);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg transition-all ${
                                selectedMonth === 'all' && selectedYear === currentYearStr
                                    ? 'bg-indigo-600 text-white shadow'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Cette année
                        </button>
                        <button
                            onClick={() => {
                                setSelectedMonth('all');
                                setSelectedYear('all');
                            }}
                            className={`px-2.5 py-1.5 rounded-lg transition-all ${
                                selectedMonth === 'all' && selectedYear === 'all'
                                    ? 'bg-indigo-600 text-white shadow'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Tout
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold uppercase tracking-wider focus:outline-none focus:border-indigo-500 transition-all flex-1 sm:flex-none"
                        >
                            <option value="all">Tous les mois</option>
                            <option value="1">Janvier</option>
                            <option value="2">Février</option>
                            <option value="3">Mars</option>
                            <option value="4">Avril</option>
                            <option value="5">Mai</option>
                            <option value="6">Juin</option>
                            <option value="7">Juillet</option>
                            <option value="8">Août</option>
                            <option value="9">Septembre</option>
                            <option value="10">Octobre</option>
                            <option value="11">Novembre</option>
                            <option value="12">Décembre</option>
                        </select>

                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-indigo-500 transition-all flex-1 sm:flex-none"
                        >
                            <option value="all">Toutes les années</option>
                            {availableYears.map(year => (
                                <option key={year} value={year.toString()}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title={getPeriodLabel("Entrées")} value={`${stats.revenueForPeriod.toLocaleString('fr-FR')} F`} icon={<BanknotesIcon className="h-6 w-6 text-green-400" />} />
                <StatCard title={getPeriodLabel("Brouillons")} value={stats.pendingInvoices.toString()} icon={<DocumentDuplicateIcon className="h-6 w-6 text-yellow-400" />} />
                <StatCard title={getPeriodLabel("Dépenses")} value={`${stats.ordersForPeriod.toLocaleString('fr-FR')} F`} icon={<ShoppingCartIcon className="h-6 w-6 text-blue-400" />} />
            </div>

            {/* Notification Visuelle de Retard de Paiement et de Solde Impayé */}
            <div className="glass-card rounded-2xl border border-rose-500/10 shadow-2xl overflow-hidden relative bg-rose-950/5">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-amber-500 to-rose-600 animate-pulse"></div>
                <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5">
                    <div className="flex gap-3 items-center">
                        <div className="p-2.5 bg-rose-500/15 rounded-xl border border-rose-500/20 text-rose-400">
                            <ExclamationTriangleIcon className="w-5 h-5 animate-bounce" />
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-rose-400 uppercase tracking-widest leading-none flex items-center gap-2 flex-wrap">
                                DÉTECTION DES RETARDS ({getPeriodLabel("").replace(/[()]/g, "")})
                                <span className="px-1.5 py-0.5 bg-rose-500/15 text-rose-300 text-[8.5px] font-black rounded border border-rose-500/25">
                                    {overdueData.totalCount} Alertes
                                </span>
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 leading-relaxed">
                                Suivi automatisé : Factures de plus de 15j, Commandes de plus de 30j &amp; Fiches de plus de 10j avec un solde impayé
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 self-end md:self-auto">
                        <div className="text-right">
                            <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block">Solde Impayé Cumulé Retard</span>
                            <strong className="text-sm font-black text-rose-400 font-mono">
                                {overdueData.totalOutstanding.toLocaleString('fr-FR')} F CFA
                            </strong>
                        </div>
                        <button
                            onClick={() => setCollapsedAlerts(!collapsedAlerts)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                            {collapsedAlerts ? 'Ouvrir les Détails' : 'Masquer les Détails'}
                        </button>
                    </div>
                </div>

                {!collapsedAlerts && (
                    <div className="p-5 space-y-4 animate-fade-in bg-zinc-950/20">
                        {/* Tab Headers */}
                        <div className="flex flex-wrap gap-1.5 p-1 bg-zinc-950/50 border border-white/5 rounded-xl self-start">
                            {[
                                { id: 'factures', label: 'Factures (>15j)', count: overdueData.invoices.length, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', amount: overdueData.sumInvoicesDue },
                                { id: 'commandes', label: 'Commandes (>30j)', count: overdueData.orders.length, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', amount: overdueData.sumOrdersDue },
                                { id: 'fiches', label: 'Fiches Repair (>10j)', count: overdueData.tickets.length, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', amount: overdueData.sumTicketsDue }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveAlertTab(tab.id as 'factures' | 'commandes' | 'fiches')}
                                    className={`px-3 py-2 text-[9px] font-black rounded-lg transition-all border flex items-center gap-1.5 ${
                                        activeAlertTab === tab.id
                                            ? 'bg-white text-black border-white font-black shadow-lg'
                                            : 'text-slate-400 hover:text-white border-transparent'
                                    }`}
                                >
                                    <span className={`${activeAlertTab === tab.id ? 'text-zinc-900 font-black' : tab.color}`}>{tab.label}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono ${
                                        activeAlertTab === tab.id ? 'bg-zinc-950 text-white font-black' : 'bg-white/5 text-slate-300 border border-white/5'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* List rendering */}
                        {(() => {
                            const list = activeAlertTab === 'factures' 
                                ? overdueData.invoices 
                                : activeAlertTab === 'commandes' 
                                    ? overdueData.orders 
                                    : overdueData.tickets;

                            if (list.length === 0) {
                                return (
                                    <div className="py-8 text-center flex flex-col items-center justify-center text-apple-muted text-xs font-semibold gap-2 border border-white/5 rounded-xl bg-white/[0.01]">
                                        <CheckCircleIcon className="w-8 h-8 text-emerald-400" />
                                        <span>Parfait ! Aucun retard de paiement détecté pour cet onglet.</span>
                                    </div>
                                );
                            }

                            return (
                                <div className="overflow-x-auto border border-white/5 rounded-xl bg-zinc-950/40">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/[0.01]">
                                                <th className="py-3 px-4">Référence</th>
                                                <th className="py-3 px-4">Client</th>
                                                <th className="py-3 px-4">Téléphone / Contact</th>
                                                <th className="py-3 px-4">Modèle Appareil</th>
                                                <th className="py-3 px-4 text-right">Mnt. Total</th>
                                                <th className="py-3 px-4 text-right">Mnt. Versé</th>
                                                <th className="py-3 px-4 text-right text-rose-400">Reste Dû</th>
                                                <th className="py-3 px-4 text-center">Durée Retard</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-slate-300 font-semibold font-mono text-xs">
                                            {list.map((item) => (
                                                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-3 px-4 text-indigo-400 font-black">{item.numero}</td>
                                                    <td className="py-3 px-4 text-white uppercase font-sans font-extrabold text-[11px]">{item.clientName}</td>
                                                    <td className="py-3 px-4 font-sans text-slate-400 flex items-center gap-1.5">
                                                        <PhoneIcon className="w-3.5 h-3.5 text-rose-400/70" />
                                                        <span>{item.clientPhone}</span>
                                                    </td>
                                                    <td className="py-3 px-4 font-sans">
                                                        <span className="px-2 py-0.5 bg-white/5 rounded border border-white/5 text-[9px] font-bold text-slate-300 uppercase">
                                                            {item.macModel}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-white font-bold">{item.total.toLocaleString()} F</td>
                                                    <td className="py-3 px-4 text-right text-emerald-400">{item.advance.toLocaleString()} F</td>
                                                    <td className="py-3 px-4 text-right text-rose-400 font-black text-[13px]">{item.due.toLocaleString()} F</td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black rounded-lg uppercase tracking-wider inline-flex items-center justify-center gap-1">
                                                            <ClockIcon className="w-3 h-3 text-red-400" />
                                                            {item.diffDays} Jours
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            
                                            {/* Subtotal row */}
                                            <tr className="bg-white/[0.02] font-black border-t border-white/10 text-white font-sans">
                                                <td colSpan={4} className="py-3.5 px-4 uppercase text-[9px] tracking-widest text-[#a1a1aa] font-extrabold">
                                                    Cumul de la catégorie sélectionnée
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-mono text-indigo-300 text-xs font-black">
                                                    {list.reduce((sum, item) => sum + item.total, 0).toLocaleString()} F
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-mono text-emerald-400 text-xs font-black">
                                                    {list.reduce((sum, item) => sum + item.advance, 0).toLocaleString()} F
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-mono text-rose-400 text-xs font-black">
                                                    {list.reduce((sum, item) => sum + item.due, 0).toLocaleString()} F
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 text-[8.5px] rounded border border-rose-500/25 uppercase font-black tracking-wider">SOMME</span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-2">
                    <RevenueAndUnpaidEvolutionChart factures={factures} commandes={commandes} tickets={tickets} />
                </div>
                <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-1">
                    <RepairTypesFrequencyChart tickets={tickets} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-2">
                    <MonthlyRevenueChart factures={factures} />
                </div>
                <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-1">
                    <OrdersBySupplierChart commandes={commandes} />
                </div>
            </div>
        </div>
    );
};


const FactureCommandeDashboard: React.FC = () => {
  const [view, setView] = useState<View>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const viewFromUrl = urlParams.get('view') as View;
    if (viewFromUrl && ['factures', 'proformas', 'commandes', 'backup', 'documents', 'client_statement'].includes(viewFromUrl)) {
        return viewFromUrl;
    }
    return 'dashboard';
  });

  const [initialEditId] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('editId');
  });

  useEffect(() => {
    // URL Cleanup after parsing initial state if needed
    // But usually we want to keep it in the URL for refreshes.
    // However, if we want to avoid re-triggering we can leave it.
  }, []);

  const handleBack = () => {
      if (view !== 'dashboard') {
          setView('dashboard');
          const url = new URL(window.location.href);
          url.searchParams.delete('view');
          url.searchParams.delete('editId');
          window.history.pushState({}, '', url);
          window.dispatchEvent(new PopStateEvent('popstate'));
      }
  };

  const handleExitRole = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('role');
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const navItems: NavItem[] = [
      { id: 'dashboard', label: 'Vue Globale', icon: ChartBarIcon, isActive: view === 'dashboard', onClick: () => setView('dashboard') },
      { id: 'factures', label: 'Factures', icon: BanknotesIcon, isActive: view === 'factures', onClick: () => setView('factures') },
      { id: 'proformas', label: 'Proformas', icon: DocumentDuplicateIcon, isActive: view === 'proformas', onClick: () => setView('proformas') },
      { id: 'commandes', label: 'Commandes', icon: ShoppingCartIcon, isActive: view === 'commandes', onClick: () => setView('commandes') },
      { id: 'documents', label: 'Courriers', icon: BookOpenIcon, isActive: view === 'documents', onClick: () => setView('documents') },
      { id: 'client_statement', label: 'Point Client', icon: UserIcon, isActive: view === 'client_statement', onClick: () => setView('client_statement') },
      { id: 'backup', label: 'Sauvegarde', icon: ArrowPathIcon, isActive: view === 'backup', onClick: () => setView('backup') },
  ];

  const viewLabels: Record<View, string | undefined> = {
      dashboard: undefined,
      factures: 'Facturation',
      proformas: 'Devis Proforma',
      commandes: 'Approvisionnement',
      documents: 'Registre Courriers',
      client_statement: 'Point Financier Client',
      backup: 'Archivage Cloud'
  };

  const renderContent = () => {
    switch (view) {
      case 'factures': return <FactureList onBack={handleBack} initialEditId={initialEditId} />;
      case 'proformas': return <ProformaList onBack={handleBack} />;
      case 'commandes': return <CommandeList onBack={handleBack} initialEditId={initialEditId} />;
      case 'documents': return <SimpleDocumentGenerator onBack={handleBack} />;
      case 'client_statement': return <ClientFinancialReport onBack={handleBack} />;
      case 'backup': return <BackupManager />;
      case 'dashboard':
      default: return <DashboardContent />;
    }
  };

  return (
    <DashboardLayout 
        title="Finance" 
        subtitle={viewLabels[view]}
        navItems={navItems}
        onBack={view !== 'dashboard' ? handleBack : undefined}
        onExitRole={handleExitRole}
    >
        {renderContent()}
    </DashboardLayout>
  );
};

export default FactureCommandeDashboard;
