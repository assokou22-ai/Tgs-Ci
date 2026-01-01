import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Facture } from '../types.ts';

interface MonthlyRevenueChartProps {
  factures: Facture[];
}

const MonthlyRevenueChart: React.FC<MonthlyRevenueChartProps> = ({ factures }) => {
    const chartData = useMemo(() => {
        const data: { [key: string]: number } = {};
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
        twelveMonthsAgo.setDate(1);
        twelveMonthsAgo.setHours(0, 0, 0, 0);

        // Initialize last 12 months with 0 revenue
        for (let i = 0; i < 12; i++) {
            const date = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + i, 1);
            const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            data[monthKey] = 0;
        }

        factures.forEach(facture => {
            if (facture.status === 'Finalisé' || facture.status === 'Payé') {
                const date = new Date(facture.date);
                if (date >= twelveMonthsAgo) {
                    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                    data[monthKey] = (data[monthKey] || 0) + facture.total;
                }
            }
        });

        return Object.entries(data).map(([month, revenu]) => ({
            name: new Date(month + '-02').toLocaleString('fr-FR', { month: 'short', year: '2-digit' }),
            monthKey: month, // Keep a sortable key
            Revenu: revenu,
        })).sort((a,b) => a.monthKey.localeCompare(b.monthKey));

    }, [factures]);
    
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
            <div className="p-2 bg-gray-700 border border-gray-600 rounded-md shadow-lg">
                <p className="label text-white">{`${label}`}</p>
                <p className="intro text-cyan-400">{`Revenu : ${payload[0].value.toLocaleString('fr-FR')} F`}</p>
            </div>
            );
        }
        return null;
    };


    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg h-96">
            <h3 className="text-lg font-bold text-white mb-4">Revenus Mensuels (12 derniers mois)</h3>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                        <XAxis dataKey="name" stroke="#A0AEC0" tick={{ fontSize: 12 }} />
                        <YAxis stroke="#A0AEC0" tick={{ fontSize: 12 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(113, 128, 150, 0.2)' }}/>
                        <Bar dataKey="Revenu" fill="#4299E1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">Aucune donnée de revenu à afficher.</p>
                </div>
            )}
        </div>
    );
};

export default MonthlyRevenueChart;