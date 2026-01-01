import React, { useMemo } from 'react';
import { RepairTicket, Appointment, RepairStatus } from '../types.ts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { WrenchScrewdriverIcon, CalendarDaysIcon, ChartBarIcon, CubeIcon } from './icons.tsx';
import RepairCostByCategoryChart from './RepairCostByCategoryChart.tsx';
import TicketCreationSummary from './TicketCreationSummary.tsx';

// Props definition
interface ERPDashboardProps {
    tickets: RepairTicket[];
    appointments: Appointment[];
}

// Stat Card component Premium
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; colorClass: string }> = ({ title, value, icon, colorClass }) => (
    <div className="glass-card p-6 rounded-2xl flex items-center shadow-xl transition-transform hover:scale-[1.02] border border-white/10">
        <div className={`p-4 mr-5 ${colorClass} bg-opacity-20 rounded-2xl shadow-inner`}>
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</p>
            <p className="text-3xl font-black text-white tracking-tighter">{value}</p>
        </div>
    </div>
);

// Main Dashboard Component
const ERPDashboard: React.FC<ERPDashboardProps> = ({ tickets, appointments }) => {
    
    // Welcome Message Data
    const welcomeData = useMemo(() => {
        const ongoingStatuses = [
            RepairStatus.DIAGNOSTIC_EN_COURS, RepairStatus.DEVIS_APPROUVE, RepairStatus.EN_ATTENTE_DE_PIECES,
            RepairStatus.REPARATION_EN_COURS, RepairStatus.TESTS_EN_COURS,
        ];
        const ongoingRepairs = tickets.filter(t => ongoingStatuses.includes(t.status)).length;
        
        const today = new Date().toISOString().split('T')[0];
        const todayAppointments = appointments.filter(a => a.date === today).length;

        return { ongoingRepairs, todayAppointments };
    }, [tickets, appointments]);

    // Main Stats Data
    const stats = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const ticketsThisMonth = tickets.filter(t => new Date(t.createdAt) >= startOfMonth);

        const completedStatuses = [RepairStatus.TERMINE, RepairStatus.RENDU];
        const completedTickets = tickets.filter(t => completedStatuses.includes(t.status));
        const completionRate = tickets.length > 0 ? `${((completedTickets.length / tickets.length) * 100).toFixed(0)}%` : '0%';

        return {
            ticketsThisMonth: ticketsThisMonth.length,
            completionRate,
        };
    }, [tickets]);

    // Frequent Models Chart Data
    const frequentModelsData = useMemo(() => {
        const modelCounts = tickets.reduce((acc, ticket) => {
            const model = ticket.macModel.trim().toUpperCase() || 'Non spécifié';
            acc[model] = (acc[model] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(modelCounts)
            .map(([name, count]) => ({ name, count: Number(count) }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [tickets]);

    return (
        <div className="space-y-8">
            {/* Header / Welcome */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic text-gradient">Console Supervision</h1>
                    <p className="text-slate-400 font-medium">Monitoring en temps réel de l'activité atelier TGS-CI.</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-blue-600/10 border border-blue-500/20 px-4 py-2 rounded-xl">
                        <span className="text-blue-400 font-black text-xl">{welcomeData.ongoingRepairs}</span>
                        <span className="text-[10px] font-bold text-blue-500 ml-2 uppercase">Réparations</span>
                    </div>
                    <div className="bg-purple-600/10 border border-purple-500/20 px-4 py-2 rounded-xl">
                        <span className="text-purple-400 font-black text-xl">{welcomeData.todayAppointments}</span>
                        <span className="text-[10px] font-bold text-purple-500 ml-2 uppercase">RDV Jour</span>
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Entrées (Mois)" value={stats.ticketsThisMonth} icon={<ChartBarIcon className="w-8 h-8 text-blue-500"/>} colorClass="bg-blue-500" />
                <StatCard title="Taux Réussite" value={stats.completionRate} icon={<WrenchScrewdriverIcon className="w-8 h-8 text-green-500"/>} colorClass="bg-green-500" />
                <StatCard title="Modèle Phare" value={frequentModelsData[0]?.name || 'N/A'} icon={<CubeIcon className="w-8 h-8 text-yellow-500"/>} colorClass="bg-yellow-500" />
                <StatCard title="Affluence" value={welcomeData.todayAppointments} icon={<CalendarDaysIcon className="w-8 h-8 text-purple-500"/>} colorClass="bg-purple-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <TicketCreationSummary tickets={tickets} />
                </div>
                <div className="lg:col-span-2">
                    <div className="glass-card p-6 rounded-2xl shadow-2xl h-full border border-white/10">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Popularité des Modèles MacBook</h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={frequentModelsData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} fontWeight={800} tickLine={false} axisLine={false} width={80} />
                                    <Tooltip cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                                    <Bar dataKey="count" name="Quantité" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1">
                <RepairCostByCategoryChart tickets={tickets} />
            </div>
        </div>
    );
};

export default ERPDashboard;