import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Commande } from '../types.ts';

interface OrdersBySupplierChartProps {
  commandes: Commande[];
}

const COLORS = ['#4299E1', '#4FD1C5', '#F6E05E', '#F56565', '#B794F4'];

const OrdersBySupplierChart: React.FC<OrdersBySupplierChartProps> = ({ commandes }) => {
    const chartData = useMemo(() => {
        const data: { [key: string]: number } = {};
        commandes.forEach(commande => {
            if (commande.status === 'Commandé' || commande.status === 'Reçu') {
                const supplier = commande.supplierName || 'Inconnu';
                data[supplier] = (data[supplier] || 0) + commande.total;
            }
        });
        return Object.entries(data).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    }, [commandes]);
    
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
            <div className="p-2 bg-gray-700 border border-gray-600 rounded-md shadow-lg">
                <p className="label text-white">{`${payload[0].name} : ${payload[0].value.toLocaleString('fr-FR')} F`}</p>
            </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg h-96">
            <h3 className="text-lg font-bold text-white mb-4">Dépenses par Fournisseur</h3>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={110}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />}/>
                        <Legend wrapperStyle={{fontSize: "12px", paddingTop: "20px"}}/>
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">Aucune commande à afficher.</p>
                </div>
            )}
        </div>
    );
};

export default OrdersBySupplierChart;