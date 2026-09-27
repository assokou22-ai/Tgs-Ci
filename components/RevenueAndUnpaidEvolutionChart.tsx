import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Facture, Commande, RepairTicket } from '../types.ts';

interface RevenueAndUnpaidEvolutionChartProps {
  factures: Facture[];
  commandes: Commande[];
  tickets: RepairTicket[];
}

interface TooltipPayloadItem {
    name: string;
    value: number;
    color?: string;
    stroke?: string;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3 bg-zinc-950/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">{label}</p>
                {payload.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 mt-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color || item.stroke }} />
                        <span className="text-[10px] uppercase font-black text-slate-300 tracking-wider">
                            {item.name} :
                        </span>
                        <span className="text-xs font-mono font-black text-white ml-auto">
                            {item.value.toLocaleString('fr-FR')} F
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const RevenueAndUnpaidEvolutionChart: React.FC<RevenueAndUnpaidEvolutionChartProps> = ({ factures, commandes, tickets }) => {
    
    const chartData = useMemo(() => {
        const monthsData: { monthKey: string; name: string; revenue: number; unpaid: number }[] = [];
        const now = new Date();

        // Generate list of the last 6 months in chronological order
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            const name = d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }).toUpperCase();
            monthsData.push({
                monthKey,
                name: name.replace('.', ''),
                revenue: 0,
                unpaid: 0
            });
        }

        // Helper function to check if date string falls in our 6-month list
        const getMonthIndex = (dateStr: string) => {
            if (!dateStr) return -1;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return -1;
            const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            return monthsData.findIndex(item => item.monthKey === key);
        };

        // 1. Process Factures
        factures.forEach(f => {
            const idx = getMonthIndex(f.date);
            if (idx !== -1) {
                // Revenue
                if (f.status === 'Finalisé' || f.status === 'Payé') {
                    monthsData[idx].revenue += f.total || 0;
                }
                // Unpaid balance
                if (f.status !== 'Payé' && f.status !== 'Annulé' && f.status !== 'Brouillon') {
                    const due = (f.total || 0) - (f.advance || 0);
                    if (due > 0) {
                        monthsData[idx].unpaid += due;
                    }
                }
            }
        });

        // 2. Process Commandes
        commandes.forEach(c => {
            if (c.isLinkedToTicket) return;
            const idx = getMonthIndex(c.date);
            if (idx !== -1) {
                // Revenue (Vendor incoming revenue)
                if (c.isRevenue && (c.status === 'Payé' || c.status === 'Reçu')) {
                    monthsData[idx].revenue += c.total || 0;
                }
                // Unpaid dépenses or purchases (Unpaid suppliers or unpaid standard non-revenue orders)
                if (!c.isRevenue && c.status !== 'Payé' && c.status !== 'Annulé') {
                    const due = (c.total || 0) - (c.advance || 0);
                    if (due > 0) {
                        monthsData[idx].unpaid += due;
                    }
                }
            }
        });

        // 3. Process Repair Tickets (Fiches)
        tickets.forEach(t => {
            const idx = getMonthIndex(t.createdAt);
            if (idx !== -1) {
                // Unpaid tickets
                if (t.status !== 'Annulé') {
                    const totalCost = (t.costs?.diagnostic || 0) + (t.costs?.repair || 0);
                    const advance = t.costs?.advance || 0;
                    const due = totalCost - advance;
                    if (due > 0) {
                        monthsData[idx].unpaid += due;
                    }
                }
            }
        });

        return monthsData;
    }, [factures, commandes, tickets]);

    const hasData = useMemo(() => {
        return chartData.some(d => d.revenue > 0 || d.unpaid > 0);
    }, [chartData]);

    return (
        <div id="chart-revenue-unpaid-evolution" className="flex flex-col h-full min-h-[360px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 border-b border-white/5 pb-4">
                <div>
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest leading-none flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        Évolution Chiffre d'Affaires &amp; Créances
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 leading-relaxed">
                        Analyse comparée des revenus récoltés et des soldes restants dus sur les 6 derniers mois
                    </p>
                </div>
                <div className="flex items-center gap-4 text-[9px] font-black uppercase text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-1 bg-emerald-400 rounded" />
                        <span>REVENUS : {chartData.reduce((sum, d) => sum + d.revenue, 0).toLocaleString('fr-FR')} F</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-1 bg-rose-400 rounded" />
                        <span>CRÉANCES : {chartData.reduce((sum, d) => sum + d.unpaid, 0).toLocaleString('fr-FR')} F</span>
                    </div>
                </div>
            </div>

            {hasData ? (
                <div className="flex-1 min-h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                            <XAxis 
                                dataKey="name" 
                                stroke="#71717a" 
                                tickLine={false}
                                tick={{ fontSize: 9, fontWeight: 900, fill: '#a1a1aa' }} 
                            />
                            <YAxis 
                                stroke="#71717a" 
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 9, fontWeight: 900, fill: '#a1a1aa' }} 
                                tickFormatter={(value) => `${(value / 1000).toLocaleString('fr-FR')}k`} 
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                                iconSize={8}
                                iconType="circle"
                                wrapperStyle={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 10 }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="revenue" 
                                name="Chiffre d'Affaires" 
                                stroke="#34d399" 
                                strokeWidth={3}
                                activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
                                dot={{ r: 3, strokeWidth: 2, stroke: '#34d399', fill: '#09090b' }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="unpaid" 
                                name="Impayés Cumulés" 
                                stroke="#f43f5e" 
                                strokeWidth={3}
                                activeDot={{ r: 6, stroke: '#e11d48', strokeWidth: 2, fill: '#fff' }}
                                dot={{ r: 3, strokeWidth: 2, stroke: '#f43f5e', fill: '#09090b' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl bg-zinc-950/20 text-center p-6">
                    <p className="text-slate-400 font-extrabold uppercase text-[10px] tracking-widest mb-1">Aucune donnée disponible</p>
                    <p className="text-slate-500 font-bold uppercase text-[8px]">Enregistrez des factures professionnelles ou fiches SAV pour tracer l'activité</p>
                </div>
            )}
        </div>
    );
};

export default RevenueAndUnpaidEvolutionChart;
