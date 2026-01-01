import React, { useMemo } from 'react';
import { RepairTicket } from '../types.ts';

interface ProblemFrequencyChartProps {
  tickets: RepairTicket[];
}

const ProblemFrequencyChart: React.FC<ProblemFrequencyChartProps> = ({ tickets }) => {
  const problemData = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTickets = tickets.filter(t => new Date(t.createdAt) >= thirtyDaysAgo);

    if (recentTickets.length < 1) {
      return [];
    }

    const counts = recentTickets.reduce((acc, ticket) => {
      // Normalize the problem description to group similar entries
      const problem = ticket.problemDescription.trim().toLowerCase();
      if (problem) {
        acc[problem] = (acc[problem] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const sortedProblems = Object.entries(counts)
      .map(([problem, count]) => ({ problem, count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Display top 5 problems

    return sortedProblems;
  }, [tickets]);

  if (problemData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-700/50 rounded-md">
        <p className="text-gray-400">Pas assez de données pour afficher les tendances.</p>
      </div>
    );
  }

  const maxCount = Math.max(...problemData.map(p => p.count), 1); // Avoid division by zero

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">Pannes fréquentes (30 derniers jours)</h3>
      <div className="space-y-4">
        {problemData.map(({ problem, count }) => (
          <div key={problem} className="text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="capitalize truncate text-gray-300 pr-4">{problem}</span>
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

export default ProblemFrequencyChart;