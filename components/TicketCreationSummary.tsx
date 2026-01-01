import React, { useMemo } from 'react';
import { RepairTicket } from '../types.ts';
import { CalendarDaysIcon } from './icons.tsx';

interface TicketCreationSummaryProps {
    tickets: RepairTicket[];
}

const TicketCreationSummary: React.FC<TicketCreationSummaryProps> = ({ tickets }) => {
    const stats = useMemo(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Calculate start of current week (Monday)
        const currentDay = now.getDay(); // 0 is Sunday
        const distanceToMonday = (currentDay + 6) % 7;
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - distanceToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        let dayCount = 0;
        let weekCount = 0;
        let monthCount = 0;
        let yearCount = 0;
        
        const dailyCounts: Record<string, number> = {};

        tickets.forEach(t => {
            const tDate = new Date(t.createdAt);
            const tDateStr = tDate.toISOString().split('T')[0];
            
            // Increment daily history
            dailyCounts[tDateStr] = (dailyCounts[tDateStr] || 0) + 1;

            // Increment period counters
            if (tDateStr === todayStr) dayCount++;
            if (tDate >= startOfWeek) weekCount++;
            if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) monthCount++;
            if (tDate.getFullYear() === currentYear) yearCount++;
        });

        // Get last 7 active days for display, sorted by date descending
        const history = Object.entries(dailyCounts)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 7)
            .map(([date, count]) => ({ date, count }));

        return { dayCount, weekCount, monthCount, yearCount, history };
    }, [tickets]);

    const StatBox = ({ label, count, colorClass }: { label: string, count: number, colorClass: string }) => (
        <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600 flex flex-col items-center justify-center">
            <span className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-center mb-1">{label}</span>
            <span className={`text-2xl font-bold ${colorClass}`}>{count}</span>
        </div>
    );

    return (
        <div className="bg-white/50 dark:bg-gray-800/50 p-5 rounded-lg shadow-lg backdrop-blur-sm border border-black/5">
            <div className="flex items-center gap-2 mb-4 text-gray-800 dark:text-white">
                <CalendarDaysIcon className="w-5 h-5 text-blue-500"/>
                <h3 className="text-lg font-bold">Point des Enregistrements</h3>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatBox label="Aujourd'hui" count={stats.dayCount} colorClass="text-blue-500 dark:text-blue-400" />
                <StatBox label="Cette Semaine" count={stats.weekCount} colorClass="text-green-500 dark:text-green-400" />
                <StatBox label="Ce Mois" count={stats.monthCount} colorClass="text-yellow-500 dark:text-yellow-400" />
                <StatBox label="Cette Année" count={stats.yearCount} colorClass="text-purple-500 dark:text-purple-400" />
            </div>

            <div className="mt-4">
                <h4 className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-3">Activité récente (au jour le jour)</h4>
                <div className="space-y-2">
                    {stats.history.length > 0 ? (
                        stats.history.map((item) => (
                            <div key={item.date} className="flex justify-between items-center text-sm p-2 bg-white/60 dark:bg-gray-700/30 rounded border-b border-gray-200 dark:border-gray-700/50">
                                <span className="text-gray-700 dark:text-gray-300 capitalize">
                                    {new Date(item.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </span>
                                <span className="font-mono font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded text-xs">
                                    {item.count} fiche{item.count > 1 ? 's' : ''}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-sm italic text-center py-2">Aucune activité récente.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TicketCreationSummary;