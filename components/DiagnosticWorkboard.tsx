
import React, { useState, useMemo } from 'react';
import { RepairTicket, RepairStatus, DiagnosticCheck, DiagnosticSheetBData } from '../types.ts';
import { DocumentMagnifyingGlassIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon, MacbookIcon } from './icons.tsx';
import DiagnosticFormModal from './DiagnosticFormModal.tsx';
import DiagnosticSheetBModal from './DiagnosticSheetBModal.tsx';

interface DiagnosticWorkboardProps {
    tickets: RepairTicket[];
    onSelectTicket: (ticket: RepairTicket) => void;
    onUpdateTicket: (ticket: RepairTicket) => Promise<void>;
}

const DiagnosticWorkboard: React.FC<DiagnosticWorkboardProps> = ({ tickets, onSelectTicket, onUpdateTicket }) => {
    const [filter, setFilter] = useState('');
    const [activeTicketForDiag, setActiveTicketForDiag] = useState<RepairTicket | null>(null);
    const [activeTicketForSheetB, setActiveTicketForSheetB] = useState<RepairTicket | null>(null);

    // Filter tickets that need diagnostic attention
    const diagnosticTickets = useMemo(() => {
        const statusesNeedingDiag = [
            RepairStatus.A_DIAGNOSTIQUER,
            RepairStatus.DIAGNOSTIC_EN_COURS,
            RepairStatus.DEVIS_A_VALIDER,
            RepairStatus.REPARATION_EN_COURS
        ];
        
        let filtered = tickets.filter(t => statusesNeedingDiag.includes(t.status));

        if (filter) {
            const lowFilter = filter.toLowerCase();
            filtered = filtered.filter(t => 
                t.client.name.toLowerCase().includes(lowFilter) ||
                t.id.toLowerCase().includes(lowFilter) ||
                t.macModel.toLowerCase().includes(lowFilter)
            );
        }

        return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [tickets, filter]);

    const handleSaveDiagnostic = async (report: DiagnosticCheck[], images: string[]) => {
        if (!activeTicketForDiag) return;
        
        const updatedTicket = { 
            ...activeTicketForDiag, 
            diagnosticReport: report,
            diagnosticImages: images,
            status: activeTicketForDiag.status === RepairStatus.A_DIAGNOSTIQUER ? RepairStatus.DIAGNOSTIC_EN_COURS : activeTicketForDiag.status,
            history: [
                ...activeTicketForDiag.history,
                { timestamp: new Date().toISOString(), user: 'Technicien' as any, action: 'Mise à jour du rapport de diagnostic standard avec photos.' }
            ]
        };
        
        await onUpdateTicket(updatedTicket);
        setActiveTicketForDiag(null);
    };

    const handleSaveSheetB = async (data: DiagnosticSheetBData) => {
        if (!activeTicketForSheetB) return;

        const updatedTicket = { 
            ...activeTicketForSheetB, 
            diagnosticSheetB: data,
            status: activeTicketForSheetB.status === RepairStatus.A_DIAGNOSTIQUER ? RepairStatus.DIAGNOSTIC_EN_COURS : activeTicketForSheetB.status,
            history: [
                ...activeTicketForSheetB.history,
                { timestamp: new Date().toISOString(), user: 'Technicien' as any, action: 'Mise à jour de l\'expertise électronique (Fiche B) avec photos.' }
            ]
        };

        await onUpdateTicket(updatedTicket);
        setActiveTicketForSheetB(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <DocumentMagnifyingGlassIcon className="w-6 h-6 text-blue-400"/>
                        Centre de Diagnostic Technique
                    </h2>
                    <p className="text-sm text-gray-400">Gérez et rédigez les expertises pour les machines en attente.</p>
                </div>
                <div className="w-64">
                    <input 
                        type="text" 
                        placeholder="Rechercher une fiche..." 
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            {diagnosticTickets.length === 0 ? (
                <div className="bg-gray-800 p-12 text-center rounded-lg border border-gray-700 border-dashed">
                    <MacbookIcon className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-20"/>
                    <p className="text-gray-500">Aucune machine ne nécessite de diagnostic pour le moment.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {diagnosticTickets.map(ticket => {
                        const hasDiag = ticket.diagnosticReport && ticket.diagnosticReport.length > 0;
                        const hasSheetB = !!ticket.diagnosticSheetB;

                        return (
                            <div key={ticket.id} className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden flex flex-col hover:border-blue-500/50 transition-colors">
                                <div className="p-4 flex-grow">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full uppercase">{ticket.id}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            ticket.status === RepairStatus.A_DIAGNOSTIQUER ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'
                                        }`}>
                                            {ticket.status}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white truncate">{ticket.client.name}</h3>
                                    <p className="text-sm text-blue-400 font-semibold mb-3">{ticket.macModel}</p>
                                    
                                    <div className="bg-gray-900/50 p-2 rounded text-xs text-gray-300 italic mb-4 line-clamp-2 min-h-[40px]">
                                        "{ticket.problemDescription}"
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold uppercase tracking-wider">
                                        <div className={`p-2 rounded border ${hasDiag ? 'border-green-800 bg-green-900/20 text-green-400' : 'border-gray-700 bg-gray-800 text-gray-500'}`}>
                                            Rapport Standard: {hasDiag ? 'OK' : 'ABSENT'}
                                        </div>
                                        <div className={`p-2 rounded border ${hasSheetB ? 'border-green-800 bg-green-900/20 text-green-400' : 'border-gray-700 bg-gray-800 text-gray-500'}`}>
                                            Expertise B: {hasSheetB ? 'OK' : 'ABSENTE'}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-900/30 p-2 border-t border-gray-700 grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setActiveTicketForDiag(ticket)}
                                        className="flex items-center justify-center gap-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-all shadow-lg shadow-indigo-900/20"
                                    >
                                        <DocumentMagnifyingGlassIcon className="w-4 h-4"/> Diag Standard
                                    </button>
                                    <button 
                                        onClick={() => setActiveTicketForSheetB(ticket)}
                                        className="flex items-center justify-center gap-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold transition-all shadow-lg shadow-purple-900/20"
                                    >
                                        <ClipboardDocumentListIcon className="w-4 h-4"/> Expertise B
                                    </button>
                                    <button 
                                        onClick={() => onSelectTicket(ticket)}
                                        className="col-span-2 py-1.5 text-gray-500 hover:text-white text-xs transition-colors"
                                    >
                                        Consulter la fiche complète
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {activeTicketForDiag && (
                <DiagnosticFormModal 
                    isOpen={true} 
                    onClose={() => setActiveTicketForDiag(null)} 
                    onSave={handleSaveDiagnostic} 
                    ticket={activeTicketForDiag} 
                />
            )}

            {activeTicketForSheetB && (
                <DiagnosticSheetBModal 
                    isOpen={true} 
                    onClose={() => setActiveTicketForSheetB(null)} 
                    onSave={handleSaveSheetB} 
                    ticket={activeTicketForSheetB} 
                />
            )}
        </div>
    );
};

export default DiagnosticWorkboard;
