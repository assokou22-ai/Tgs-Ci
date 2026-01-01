import React, { useState, useMemo } from 'react';
import { RepairTicket, RepairStatus, RepairServiceItem } from '../types.ts';
import WeeklyRepairChart from './WeeklyRepairChart.tsx';
import GlobalPerformanceModal from './GlobalPerformanceModal.tsx';
import { exportToExcel, exportCompiledReportToExcel } from '../services/exportService.ts';
import useServices from '../hooks/useServices.ts';

interface StatisticsDashboardProps {
    tickets: RepairTicket[];
}

const StatCard: React.FC<{ title: string; value: string | number; description: string }> = ({ title, value, description }) => (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
);

const StatisticsDashboard: React.FC<StatisticsDashboardProps> = ({ tickets }) => {
    const { services } = useServices();
    const [isPerfModalOpen, setIsPerfModalOpen] = useState(false);

    const stats = useMemo(() => {
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();

        const ticketsThisMonth = tickets.filter(t => {
            const date = new Date(t.createdAt);
            return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
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
            revenueThisMonth: totalRevenueThisMonth.toLocaleString('fr-FR') + ' F CFA',
            unrepairableRate: tickets.length > 0 ? `${((tickets.filter(t => t.status === RepairStatus.NON_REPARABLE).length / tickets.length) * 100).toFixed(1)}%` : '0%',
            averageRepairDays: `${averageRepairDays} jours`,
        };
    }, [tickets]);

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2 className="text-xl font-bold text-white">Statistiques et Rapports</h2>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setIsPerfModalOpen(true)} className="px-4 py-2 bg-indigo-600 rounded-md text-sm">Voir Performances Globales</button>
                    <button onClick={() => exportCompiledReportToExcel(tickets)} className="px-4 py-2 bg-green-700 rounded-md text-sm">Exporter Rapport Compilé</button>
                    <button onClick={() => exportToExcel(tickets, 'toutes_les_fiches.xlsx')} className="px-4 py-2 bg-teal-600 rounded-md text-sm">Exporter Toutes les Fiches</button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard title="Nouvelles Fiches" value={stats.newTicketsThisMonth} description="Ce mois-ci" />
                <StatCard title="Revenu" value={stats.revenueThisMonth} description="Ce mois-ci" />
                <StatCard title="Taux d'Irréparable" value={stats.unrepairableRate} description="Global" />
                <StatCard title="Temps de Réparation Moyen" value={stats.averageRepairDays} description="Pour les fiches terminées" />
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
                <WeeklyRepairChart tickets={tickets} />
            </div>
            
            <GlobalPerformanceModal
                isOpen={isPerfModalOpen}
                onClose={() => setIsPerfModalOpen(false)}
                tickets={tickets}
                services={services}
            />
        </div>
    );
};

export default StatisticsDashboard;