import React, { useMemo } from 'react';
import { RepairTicket, RepairStatus } from '../types.ts';
import { ClockIcon, WrenchScrewdriverIcon, CurrencyEuroIcon, BanknotesIcon, ChartBarIcon } from './icons.tsx';
import ProblemFrequencyChart from './ProblemFrequencyChart.tsx';
import { SyncDiagnosticPanel } from './SyncDiagnosticPanel.tsx';
import { motion } from 'framer-motion';

interface DashboardProps {
    tickets: RepairTicket[];
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; delay: number }> = ({ title, value, icon, color, delay }) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        whileHover={{ y: -5, transition: { duration: 0.2 } }}
        className="relative overflow-hidden bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-[32px] shadow-2xl group"
    >
        <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-10 blur-3xl transition-all group-hover:opacity-20 ${color}`}></div>
        
        <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 text-white group-hover:scale-110 transition-transform duration-500`}>
                {icon}
            </div>
            <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-apple-muted mb-1">Status</span>
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${color.replace('bg-', 'bg-')}`}></div>
                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Live</span>
                </div>
            </div>
        </div>
        
        <div>
            <p className="text-[11px] font-black text-apple-muted uppercase tracking-[0.2em] mb-1">{title}</p>
            <p className="text-3xl font-black text-white tracking-tighter leading-none">
                {value}
            </p>
        </div>
        
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Mise à jour à l'instant</span>
            <div className="w-8 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`h-full ${color.replace('bg-', 'bg-')}`}
                ></motion.div>
            </div>
        </div>
    </motion.div>
);

const Dashboard: React.FC<DashboardProps> = ({ tickets }) => {
    const stats = useMemo(() => {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const pending = tickets.filter(t => t.status === RepairStatus.A_DIAGNOSTIQUER).length;
        const inProgressStatuses = [
            RepairStatus.DIAGNOSTIC_EN_COURS,
            RepairStatus.DEVIS_APPROUVE,
            RepairStatus.EN_ATTENTE_DE_PIECES,
            RepairStatus.REPARATION_EN_COURS,
            RepairStatus.TESTS_EN_COURS,
        ];
        const inProgress = tickets.filter(t => inProgressStatuses.includes(t.status)).length;


        const ticketsCompletedToday = tickets.filter(t => {
            if (t.status !== RepairStatus.TERMINE && t.status !== RepairStatus.RENDU) return false;
            const updatedAt = new Date(t.updatedAt);
            return updatedAt >= startOfToday;
        });
        
        const completedTodayCount = ticketsCompletedToday.length;
        
        const revenueToday = ticketsCompletedToday.reduce((sum, ticket) => {
            const diagnosticCost = ticket.costs?.diagnostic || 0;
            const repairCost = ticket.costs?.repair || 0;
            return sum + diagnosticCost + repairCost;
        }, 0);

        const averageCostToday = completedTodayCount > 0 ? revenueToday / completedTodayCount : 0;

        return { pending, inProgress, completedToday: completedTodayCount, revenueToday, averageCostToday };
    }, [tickets]);

    const formatCurrency = (value: number) => {
        return `${value.toLocaleString('fr-FR')} F`;
    };


    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <StatCard 
                    title="En attente" 
                    value={stats.pending} 
                    icon={<ClockIcon className="h-6 w-6 text-yellow-500" />} 
                    color="bg-yellow-500"
                    delay={0.1}
                />
                <StatCard 
                    title="En cours" 
                    value={stats.inProgress} 
                    icon={<WrenchScrewdriverIcon className="h-6 w-6 text-blue-500" />} 
                    color="bg-blue-500"
                    delay={0.2}
                />
                <StatCard 
                    title="Terminées" 
                    value={stats.completedToday} 
                    icon={<CurrencyEuroIcon className="h-6 w-6 text-emerald-500" />} 
                    color="bg-emerald-500"
                    delay={0.3}
                />
                <StatCard 
                    title="Revenu Jour" 
                    value={formatCurrency(stats.revenueToday)}
                    icon={<BanknotesIcon className="h-6 w-6 text-purple-500" />} 
                    color="bg-purple-500"
                    delay={0.4}
                />
                <StatCard 
                    title="Panier Moyen" 
                    value={formatCurrency(Math.round(stats.averageCostToday))}
                    icon={<ChartBarIcon className="h-6 w-6 text-pink-500" />} 
                    color="bg-pink-500"
                    delay={0.5}
                />
            </div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-[40px] shadow-2xl"
            >
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Analyse des Pannes</h3>
                        <p className="text-apple-muted text-xs font-bold uppercase tracking-widest mt-1">Fréquence des problèmes signalés</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                        <ChartBarIcon className="w-6 h-6 text-apple-blue" />
                    </div>
                </div>
                <div className="h-[400px]">
                    <ProblemFrequencyChart tickets={tickets} />
                </div>
            </motion.div>

            <SyncDiagnosticPanel />
        </div>
    );
};

export default Dashboard;