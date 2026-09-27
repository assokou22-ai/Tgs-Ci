import React, { useState, useMemo } from 'react';
import { RepairTicket, RepairStatus } from '../types.ts';
import WeeklyRepairChart from './WeeklyRepairChart.tsx';
import GlobalPerformanceModal from './GlobalPerformanceModal.tsx';
import { exportToExcel, exportCompiledReportToExcel } from '../services/exportService.ts';
import { motion } from 'framer-motion';
import { TrendingUpIcon, DollarSignIcon, AlertTriangleIcon, TimerIcon, DownloadIcon, BarChart3Icon } from 'lucide-react';

interface StatisticsDashboardProps {
    tickets: RepairTicket[];
}

const StatCard: React.FC<{ title: string; value: string | number; description: string; icon: React.ReactNode; color: string; delay: number }> = ({ title, value, description, icon, color, delay }) => (
    <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay }}
        className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-[32px] shadow-2xl relative overflow-hidden group"
    >
        <div className={`absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 rounded-full opacity-5 blur-2xl group-hover:opacity-10 transition-opacity ${color}`}></div>
        <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 ${color.replace('bg-', 'text-')}`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black text-apple-muted uppercase tracking-[0.2em]">{title}</p>
                <p className="text-2xl font-black text-white tracking-tighter">{value}</p>
            </div>
        </div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{description}</p>
    </motion.div>
);

const StatisticsDashboard: React.FC<StatisticsDashboardProps> = ({ tickets }) => {
    const [isPerfModalOpen, setIsPerfModalOpen] = useState(false);

    const stats = useMemo(() => {
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();

        const ticketsThisMonth = tickets.filter(t => {
            const date = new Date(t.createdAt);
            return date.getMonth() === thisMonth && date.getFullYear() === thisYear && t.status !== RepairStatus.ANNULE;
        });

        const totalRevenueThisMonth = ticketsThisMonth.reduce((sum, t) => {
            const ticketTotal = (t.costs.diagnostic || 0) + (t.costs.repair || 0);
            return sum + ticketTotal;
        }, 0);
        
        const completedTickets = tickets.filter(t => t.status === RepairStatus.TERMINE || t.status === RepairStatus.RENDU);
        
        const averageRepairTimeMs = completedTickets.reduce((sum, t) => {
             const created = new Date(t.createdAt).getTime();
             const updated = new Date(t.updatedAt).getTime();
             return sum + (updated - created);
        }, 0) / (completedTickets.length || 1);
        
        const averageRepairDays = Math.round(averageRepairTimeMs / (1000 * 60 * 60 * 24));


        return {
            newTicketsThisMonth: ticketsThisMonth.length,
            revenueThisMonth: totalRevenueThisMonth.toLocaleString('fr-FR') + ' F',
            unrepairableRate: tickets.length > 0 ? `${((tickets.filter(t => t.status === RepairStatus.NON_REPARABLE).length / tickets.length) * 100).toFixed(1)}%` : '0%',
            averageRepairDays: `${averageRepairDays} jours`,
        };
    }, [tickets]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Statistiques & Rapports</h2>
                    <p className="text-apple-muted text-xs font-bold uppercase tracking-widest mt-1">Analyse de performance de l'atelier</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={() => setIsPerfModalOpen(true)} 
                        className="flex items-center gap-2 px-6 py-3 bg-apple-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
                    >
                        <TrendingUpIcon className="w-4 h-4" />
                        Performances Globales
                    </button>
                    <button 
                        onClick={() => exportCompiledReportToExcel(tickets)} 
                        className="flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all border border-white/5"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Rapport Compilé
                    </button>
                    <button 
                        onClick={() => exportToExcel(tickets, 'toutes_les_fiches.xlsx')} 
                        className="flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all border border-white/5"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Toutes les Fiches
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Nouvelles Fiches" 
                    value={stats.newTicketsThisMonth} 
                    description="Ce mois-ci" 
                    icon={<BarChart3Icon className="w-6 h-6" />}
                    color="bg-blue-500"
                    delay={0.1}
                />
                <StatCard 
                    title="Revenu" 
                    value={stats.revenueThisMonth} 
                    description="Ce mois-ci" 
                    icon={<DollarSignIcon className="h-6 w-6" />}
                    color="bg-emerald-500"
                    delay={0.2}
                />
                <StatCard 
                    title="Taux Irréparable" 
                    value={stats.unrepairableRate} 
                    description="Moyenne globale" 
                    icon={<AlertTriangleIcon className="h-6 w-6" />}
                    color="bg-amber-500"
                    delay={0.3}
                />
                <StatCard 
                    title="Délai Moyen" 
                    value={stats.averageRepairDays} 
                    description="Temps de traitement" 
                    icon={<TimerIcon className="h-6 w-6" />}
                    color="bg-purple-500"
                    delay={0.4}
                />
            </div>
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-[40px] shadow-2xl"
            >
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Activité Hebdomadaire</h3>
                        <p className="text-apple-muted text-xs font-bold uppercase tracking-widest mt-1">Volume de réparations sur les 7 derniers jours</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                        <TrendingUpIcon className="w-6 h-6 text-apple-blue" />
                    </div>
                </div>
                <div className="h-[400px]">
                    <WeeklyRepairChart tickets={tickets} />
                </div>
            </motion.div>
            
            <GlobalPerformanceModal
                isOpen={isPerfModalOpen}
                onClose={() => setIsPerfModalOpen(false)}
                tickets={tickets}
            />
        </div>
    );
};

export default StatisticsDashboard;