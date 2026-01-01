import React, { useMemo } from 'react';
import { RepairTicket, RepairServiceItem, RepairStatus } from '../types.ts';
import Modal from './Modal.tsx';

interface GlobalPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: RepairTicket[];
  services: RepairServiceItem[];
}

const StatCard: React.FC<{ title: string; value: string | number; description?: string }> = ({ title, value, description }) => (
    <div className="bg-gray-700 p-4 rounded-lg shadow-md">
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
);

const getTicketTotal = (ticket: RepairTicket) => {
    const diagnosticCost = ticket.costs?.diagnostic || 0;
    const repairCost = ticket.costs?.repair || 0;
    return diagnosticCost + repairCost;
};

const GlobalPerformanceModal: React.FC<GlobalPerformanceModalProps> = ({ isOpen, onClose, tickets, services }) => {
    const stats = useMemo(() => {
        if (!tickets || tickets.length === 0) {
            return {
                totalRevenue: 0,
                totalTickets: 0,
                averageCost: 0,
                statusCounts: {},
                topServicesByRevenue: [],
                topServicesByFrequency: [],
            };
        }

        const totalRevenue = tickets.reduce((sum, ticket) => sum + getTicketTotal(ticket), 0);
        const totalTickets = tickets.length;
        const averageCost = totalRevenue / totalTickets;

        const statusCounts = tickets.reduce((acc, ticket) => {
            acc[ticket.status] = (acc[ticket.status] || 0) + 1;
            return acc;
        }, {} as Record<RepairStatus, number>);

        const serviceAnalytics = new Map<string, { name: string, count: number, revenue: number }>();
        tickets.forEach(ticket => {
            ticket.services?.forEach(service => {
                const existing = serviceAnalytics.get(service.name) || { name: service.name, count: 0, revenue: 0 };
                existing.count += 1;
                existing.revenue += service.price;
                serviceAnalytics.set(service.name, existing);
            });
        });

        const analyticsArray = Array.from(serviceAnalytics.values());
        const topServicesByRevenue = [...analyticsArray].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
        const topServicesByFrequency = [...analyticsArray].sort((a, b) => b.count - a.count).slice(0, 5);
        
        return {
            totalRevenue,
            totalTickets,
            averageCost,
            statusCounts,
            topServicesByRevenue,
            topServicesByFrequency,
        };
    }, [tickets, services]);
    
    const ListItem: React.FC<{ label: string; value: string | number; index: number }> = ({ label, value, index }) => (
        <li className="flex justify-between items-center p-2 rounded-md bg-gray-700/50">
            <div className="flex items-center">
                <span className="text-sm font-bold text-gray-400 w-6">{index + 1}.</span>
                <span className="text-white">{label}</span>
            </div>
            <span className="font-mono text-gray-300">{value}</span>
        </li>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} containerClassName="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl m-4 p-6">
             <div className="flex flex-col h-[80vh]">
                 <div className="flex-shrink-0 flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Performances Globales</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto space-y-6 pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard title="Revenu Total" value={`${stats.totalRevenue.toLocaleString('fr-FR')} F`} />
                        <StatCard title="Fiches Totales" value={stats.totalTickets} />
                        <StatCard title="Coût Moyen / Fiche" value={`${Math.round(stats.averageCost).toLocaleString('fr-FR')} F`} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Top Services par Revenu</h3>
                            <ul className="space-y-2">
                                {stats.topServicesByRevenue.map((s, i) => (
                                    <ListItem key={s.name} index={i} label={s.name} value={`${s.revenue.toLocaleString('fr-FR')} F`} />
                                ))}
                            </ul>
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold mb-2">Top Services par Fréquence</h3>
                             <ul className="space-y-2">
                                {stats.topServicesByFrequency.map((s, i) => (
                                    <ListItem key={s.name} index={i} label={s.name} value={`${s.count} fois`} />
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Répartition par Statut</h3>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(stats.statusCounts).map(([status, count]) => (
                                <div key={status} className="bg-gray-700 rounded-full px-3 py-1 text-sm">
                                    {status}: <span className="font-bold">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
             </div>
        </Modal>
    );
};

export default GlobalPerformanceModal;