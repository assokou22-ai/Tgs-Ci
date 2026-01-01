
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { RepairTicket, RepairStatus } from '../types.ts';

interface RepairCostByCategoryChartProps {
  tickets: RepairTicket[];
}

const COLORS = ['#4299E1', '#48BB78', '#ECC94B', '#ED8936', '#9F7AEA', '#F56565'];

const RepairCostByCategoryChart: React.FC<RepairCostByCategoryChartProps> = ({ tickets }) => {
  const data = useMemo(() => {
    const categoryMap: Record<string, number> = {};

    tickets.forEach(ticket => {
      // Only consider completed tickets for realized revenue analysis
      if (ticket.status === RepairStatus.TERMINE || ticket.status === RepairStatus.RENDU) {
        
        // Add Diagnostic Cost
        if (ticket.costs.diagnostic > 0) {
            categoryMap['Diagnostic'] = (categoryMap['Diagnostic'] || 0) + ticket.costs.diagnostic;
        }

        // Add Service Costs
        if (ticket.services && ticket.services.length > 0) {
            ticket.services.forEach(service => {
                const cat = service.category || 'Autre';
                categoryMap[cat] = (categoryMap[cat] || 0) + service.price;
            });
        }
      }
    });

    // Convert to array and sort by Value (Revenue) descending
    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Top 6 categories
  }, [tickets]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400">Pas assez de données financières disponibles.</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
        <div className="p-2 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50">
            <p className="label text-white font-semibold">{label}</p>
            <p className="intro text-blue-300">{`Total : ${payload[0].value.toLocaleString('fr-FR')} F`}</p>
        </div>
        );
    }
    return null;
  };

  return (
    <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-lg shadow-lg h-96 backdrop-blur-sm border border-black/5 flex flex-col">
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Revenus par Catégorie (Terminés)</h3>
      <div className="flex-grow">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#4A5568" opacity={0.3} />
                <XAxis type="number" stroke="#A0AEC0" tickFormatter={(value) => `${(value / 1000)}k`} fontSize={12} />
                <YAxis type="category" dataKey="name" width={100} stroke="#A0AEC0" fontSize={11} tick={{fill: 'currentColor'}} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RepairCostByCategoryChart;
