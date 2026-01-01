
import React, { useMemo, useState } from 'react';
import { RepairTicket } from '../types.ts';
import { MacbookIcon, ExclamationTriangleIcon } from './icons.tsx';

interface MatrixEntry {
    model: string;
    problem: string;
    count: number;
}

interface ProblemModelMatrixProps {
    tickets: RepairTicket[];
}

const ProblemModelMatrix: React.FC<ProblemModelMatrixProps> = ({ tickets }) => {
    const [search, setSearch] = useState('');

    const matrixData = useMemo(() => {
        const counts: Record<string, number> = {};

        tickets.forEach(t => {
            const model = (t.macModel || 'MODÈLE INCONNU').trim().toUpperCase();
            const problem = (t.problemDescription || 'SANS DESCRIPTION').trim().toUpperCase();
            const key = `${model}|${problem}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        return Object.entries(counts).map(([key, count]) => {
            const [model, problem] = key.split('|');
            return { model, problem, count };
        }).sort((a, b) => b.count - a.count);
    }, [tickets]);

    const filteredData = useMemo(() => {
        if (!search) return matrixData;
        const lowSearch = search.toLowerCase();
        return matrixData.filter(d => 
            d.model.toLowerCase().includes(lowSearch) || 
            d.problem.toLowerCase().includes(lowSearch)
        );
    }, [matrixData, search]);

    return (
        <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-700">
            <div className="p-6 border-b border-gray-700 bg-gray-900/50">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500" />
                            Analyse Croisée : Modèles & Pannes
                        </h2>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-1">Rapport de fréquence des problèmes enregistrés</p>
                    </div>
                    <div className="w-full md:w-72">
                        <input 
                            type="text" 
                            placeholder="Filtrer modèle ou panne..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="text-[10px] font-black uppercase text-gray-500 tracking-widest border-b border-gray-700">
                            <th className="px-6 py-4">Modèle Macbook</th>
                            <th className="px-6 py-4">Problème Enregistré</th>
                            <th className="px-6 py-4 text-center">Occurrences</th>
                            <th className="px-6 py-4 text-right">Poids Stat.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {filteredData.length > 0 ? filteredData.map((entry, idx) => {
                            const percentage = ((entry.count / tickets.length) * 100).toFixed(1);
                            return (
                                <tr key={idx} className="hover:bg-gray-700/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <MacbookIcon className="w-5 h-5 text-gray-600 group-hover:text-blue-500" />
                                            <span className="font-black text-white">{entry.model}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-xs font-bold text-gray-300 leading-relaxed uppercase">
                                            {entry.problem}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-block px-3 py-1 bg-gray-900 text-blue-400 font-black rounded-full border border-blue-900/30 text-sm">
                                            {entry.count}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black text-gray-500 uppercase">{percentage}%</span>
                                            <div className="w-24 h-1.5 bg-gray-900 rounded-full mt-1 overflow-hidden">
                                                <div 
                                                    className="h-full bg-blue-600 rounded-full" 
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={4} className="px-6 py-20 text-center">
                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Aucune donnée correspondante</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-4 bg-gray-900/30 border-t border-gray-700 text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center">
                Total de combinaisons uniques analysées : {filteredData.length}
            </div>
        </div>
    );
};

export default ProblemModelMatrix;
