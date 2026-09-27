
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { RepairTicket } from '../types.ts';

interface MacbookModelTrendsChartProps {
  tickets: RepairTicket[];
}

const MacbookModelTrendsChart: React.FC<MacbookModelTrendsChartProps> = ({ tickets }) => {
  const trendsData = useMemo(() => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Filtrage des tickets sur les 3 derniers mois
    const recentTickets = tickets.filter(t => new Date(t.createdAt) >= threeMonthsAgo);

    const counts = recentTickets.reduce((acc, ticket) => {
      const model = (ticket.macModel || 'Inconnu').trim().toUpperCase();
      acc[model] = (acc[model] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 modèles
  }, [tickets]);

  if (trendsData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-white/5 rounded-2xl border border-white/5 border-dashed p-10">
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Données insuffisantes sur les 3 derniers mois</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-3xl shadow-2xl border border-white/10 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Tendances Modèles</h3>
        <p className="text-xl font-black text-white tracking-tight mt-1">Volumes des 90 derniers jours</p>
      </div>
      
      <div className="flex-grow min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trendsData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" hide />
            <YAxis 
                dataKey="name" 
                type="category" 
                stroke="#86868b" 
                fontSize={10} 
                fontWeight={800} 
                tickLine={false} 
                axisLine={false}
                width={70}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              contentStyle={{ backgroundColor: '#1c1c21', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
              itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
            />
            <Bar dataKey="count" name="Appareils" radius={[0, 4, 4, 0]} barSize={20}>
              {trendsData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? '#0071e3' : '#323237'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MacbookModelTrendsChart;
