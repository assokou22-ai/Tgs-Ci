import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { RepairTicket } from '../types.ts';

interface RepairTypesFrequencyChartProps {
  tickets: RepairTicket[];
}

const COLORS = ['#3182CE', '#319795', '#D69E2E', '#DD6B20', '#805AD5', '#E53E3E'];

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 bg-gray-750 border border-gray-650 rounded-lg shadow-xl text-xs">
                <p className="font-bold text-white text-sm mb-1">{payload[0].name}</p>
                <p className="text-cyan-400 font-semibold">{`Fréquence : ${payload[0].value} réparation(s)`}</p>
            </div>
        );
    }
    return null;
};

const RepairTypesFrequencyChart: React.FC<RepairTypesFrequencyChartProps> = ({ tickets }) => {
    const chartData = useMemo(() => {
        const counts: Record<string, number> = {};

        tickets.forEach(ticket => {
            if (ticket.services && ticket.services.length > 0) {
                ticket.services.forEach(service => {
                    const cat = service.category || 'Autre';
                    counts[cat] = (counts[cat] || 0) + 1;
                });
            } else if (ticket.problemDescription) {
                // Robust fallback to keyword extraction if service categories are empty
                const desc = ticket.problemDescription.toLowerCase();
                if (desc.includes('écran') || desc.includes('ecran') || desc.includes('vitre') || desc.includes('dalle') || desc.includes('afficheur')) {
                    counts['Écran / Remplacement'] = (counts['Écran / Remplacement'] || 0) + 1;
                } else if (desc.includes('batterie') || desc.includes('charge') || desc.includes('connecteur') || desc.includes('alimentation')) {
                    counts['Batterie / Alimentation'] = (counts['Batterie / Alimentation'] || 0) + 1;
                } else if (desc.includes('clavier') || desc.includes('trackpad') || desc.includes('touche') || desc.includes('bouton')) {
                    counts['Clavier / Périphérique'] = (counts['Clavier / Périphérique'] || 0) + 1;
                } else if (desc.includes('surchauffe') || desc.includes('ventilateur') || desc.includes('pâte thermique') || desc.includes('nettoyage')) {
                    counts['Maintenance / Nettoyage'] = (counts['Maintenance / Nettoyage'] || 0) + 1;
                } else if (desc.includes('liquide') || desc.includes('eau') || desc.includes('oxydation') || desc.includes('soudure') || desc.includes('court-circuit') || desc.includes('carte mère')) {
                    counts['Micro-soudure / CM'] = (counts['Micro-soudure / CM'] || 0) + 1;
                } else if (desc.includes('disque') || desc.includes('ssd') || desc.includes('mémoire') || desc.includes('ram') || desc.includes('stockage')) {
                    counts['Disque / Systèmes / RAM'] = (counts['Disque / Systèmes / RAM'] || 0) + 1;
                } else {
                    counts['Diagnostic / Divers'] = (counts['Diagnostic / Divers'] || 0) + 1;
                }
            }
        });

        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6); // Top 6 categories
    }, [tickets]);

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg h-96 flex flex-col justify-between">
            <div>
                <h3 className="text-lg font-bold text-white mb-1">Pannes de Réparation Fréquentes</h3>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Répartition par catégorie de service</p>
            </div>
            {chartData.length > 0 ? (
                <div className="flex-grow h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#4A5568" opacity={0.3} />
                            <XAxis type="number" stroke="#A0AEC0" tick={{ fontSize: 10 }} allowDecimals={false} />
                            <YAxis type="category" dataKey="name" width={110} stroke="#A0AEC0" tick={{ fontSize: 9 }} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="flex-grow flex items-center justify-center">
                    <p className="text-gray-500 text-sm">Aucune donnée de réparation disponible.</p>
                </div>
            )}
        </div>
    );
};

export default RepairTypesFrequencyChart;
