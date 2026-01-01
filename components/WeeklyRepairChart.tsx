import React, { useMemo } from 'react';
import { RepairTicket } from '../types.ts';

interface WeeklyRepairChartProps {
  tickets: RepairTicket[];
}

const WeeklyRepairChart: React.FC<WeeklyRepairChartProps> = ({ tickets }) => {
  const repairData = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentTickets = tickets.filter(t => new Date(t.createdAt) >= sevenDaysAgo);

    if (recentTickets.length < 1) {
      return [];
    }

    const counts = recentTickets.reduce((acc, ticket) => {
        if (ticket.services && ticket.services.length > 0) {
            ticket.services.forEach(service => {
                const category = service.category || 'Non classé';
                acc[category] = (acc[category] || 0) + 1;
            });
        }
        return acc;
    }, {} as Record<string, number>);

    const sortedRepairs = Object.entries(counts)
      .map(([category, count]) => ({ category, count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return sortedRepairs;
  }, [tickets]);

  if (repairData.length === 0) {
    return (
        <div>
            <h3 className="text-lg font-bold text-white mb-4">Réparations (7 derniers jours)</h3>
            <div className="flex items-center justify-center h-48 bg-gray-700/50 rounded-md">
                <p className="text-gray-400">Pas de données de service pour cette semaine.</p>
            </div>
      </div>
    );
  }

  const maxCount = Math.max(...repairData.map(p => p.count), 1);

  return (
    <div>
      <h3 className="text-lg font-bold text-white mb-4">Réparations (7 derniers jours)</h3>
      <div className="space-y-4">
        {repairData.map(({ category, count }) => (
          <div key={category} className="text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="capitalize truncate text-gray-300 pr-4">{category}</span>
              <span className="font-semibold text-white">{count}</span>
            </div>
            <div className="bg-gray-700 rounded-full h-2 w-full">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(count / maxCount) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyRepairChart;