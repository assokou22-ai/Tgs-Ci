import React, { useMemo } from 'react';
import { RepairTicket, RepairStatus } from '../types.ts';
import { ClockIcon, WrenchScrewdriverIcon, CurrencyEuroIcon, BanknotesIcon, ChartBarIcon } from './icons.tsx';
import ProblemFrequencyChart from './ProblemFrequencyChart.tsx';

interface DashboardProps {
    tickets: RepairTicket[];
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-gray-800 p-4 rounded-lg flex items-center shadow-lg">
        <div className="p-3 mr-4 bg-gray-700 rounded-full">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
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
        return `${value.toLocaleString('fr-FR')} F CFA`;
    };


    return (
        <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard 
                    title="En attente" 
                    value={stats.pending} 
                    icon={<ClockIcon className="h-6 w-6 text-yellow-400" />} 
                />
                <StatCard 
                    title="En cours" 
                    value={stats.inProgress} 
                    icon={<WrenchScrewdriverIcon className="h-6 w-6 text-blue-400" />} 
                />
                <StatCard 
                    title="Terminées aujourd'hui" 
                    value={stats.completedToday} 
                    icon={<CurrencyEuroIcon className="h-6 w-6 text-green-400" />} 
                />
                <StatCard 
                    title="Revenu du jour" 
                    value={formatCurrency(stats.revenueToday)}
                    icon={<BanknotesIcon className="h-6 w-6 text-teal-400" />} 
                />
                <StatCard 
                    title="Coût moyen (jour)" 
                    value={formatCurrency(Math.round(stats.averageCostToday))}
                    icon={<ChartBarIcon className="h-6 w-6 text-purple-400" />} 
                />
            </div>
            <div className="mt-6 bg-gray-800 p-4 rounded-lg shadow-lg">
                <ProblemFrequencyChart tickets={tickets} />
            </div>
        </div>
    );
};

export default Dashboard;