import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { EngagementSav, EngagementSavStatus } from '../types.ts';
import { 
    dbGetEngagementsSav, 
    dbAddEngagementSav, 
    dbUpdateEngagementSav, 
    dbDeleteEngagementSav 
} from '../services/dbService.ts';
import DashboardLayout, { NavItem } from './DashboardLayout.tsx';
import { 
    WrenchScrewdriverIcon, 
    PlusCircleIcon, 
    PencilIcon, 
    TrashIcon, 
    ArrowPathIcon,
    ExclamationTriangleIcon
} from './icons.tsx';
import Modal from './Modal.tsx';
import { useToastContext } from '../context/ToastContext.tsx';

type FilterType = 'OUVERTS' | 'EN_RETARD' | 'AUJOURDHUI' | 'CETTE_SEMAINE' | 'SANS_PROCHAINE' | 'CLOS';

const STATUS_LABELS: Record<EngagementSavStatus, string> = {
    'A_OUVRIR': 'À Ouvrir',
    'PIECE_A_COMMANDER': 'Pièce à commander',
    'PIECE_COMMANDEE': 'Pièce commandée',
    'PIECE_RECUE': 'Pièce reçue',
    'CLIENT_A_APPELER': 'Client à appeler',
    'RDV_FIXE': 'Rdv fixé',
    'REMPLACEMENT_EFFECTUE': 'Remplacement effectué',
    'CLOS': 'Clos',
    'ANNULE': 'Annulé'
};

const STATUS_BG: Record<EngagementSavStatus, string> = {
    'A_OUVRIR': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'PIECE_A_COMMANDER': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'PIECE_COMMANDEE': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'PIECE_RECUE': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    'CLIENT_A_APPELER': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'RDV_FIXE': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    'REMPLACEMENT_EFFECTUE': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'CLOS': 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    'ANNULE': 'bg-rose-500/10 text-rose-400 border-rose-500/20'
};

const STATUS_PROGRESS: Record<EngagementSavStatus, number> = {
    'A_OUVRIR': 12,
    'PIECE_A_COMMANDER': 25,
    'PIECE_COMMANDEE': 40,
    'PIECE_RECUE': 55,
    'CLIENT_A_APPELER': 70,
    'RDV_FIXE': 85,
    'REMPLACEMENT_EFFECTUE': 95,
    'CLOS': 100,
    'ANNULE': 100
};

const STATUS_PROGRESS_COLOR: Record<EngagementSavStatus, string> = {
    'A_OUVRIR': 'bg-blue-500',
    'PIECE_A_COMMANDER': 'bg-amber-500',
    'PIECE_COMMANDEE': 'bg-purple-500',
    'PIECE_RECUE': 'bg-teal-500',
    'CLIENT_A_APPELER': 'bg-orange-500',
    'RDV_FIXE': 'bg-pink-500',
    'REMPLACEMENT_EFFECTUE': 'bg-emerald-500',
    'CLOS': 'bg-emerald-500',
    'ANNULE': 'bg-rose-500'
};

const generateSavId = (existing: EngagementSav[]): string => {
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const prefix = `SAV-${yyyy}${mm}${dd}-`;
    
    const todaysNums = existing
        .map(item => item.id)
        .filter(id => id.startsWith(prefix))
        .map(id => {
            const parts = id.split('-');
            const numStr = parts[parts.length - 1];
            return parseInt(numStr, 10);
        })
        .filter(n => !isNaN(n));
        
    const nextNum = todaysNums.length > 0 ? Math.max(...todaysNums) + 1 : 1;
    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
};

const getRowAesthetic = (item: EngagementSav) => {
    if (item.statut === 'CLOS' || item.statut === 'ANNULE') {
        return 'text-zinc-500 border-l-[6px] border-zinc-700 bg-zinc-950/20';
    }
    if (!item.prochaineDateAction) {
        return 'border-l-[6px] border-transparent';
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const actionDate = new Date(item.prochaineDateAction);
    actionDate.setHours(0, 0, 0, 0);
    
    if (actionDate < today) {
        return 'bg-red-950/10 text-red-200 border-l-[6px] border-red-600/80';
    }
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    if (actionDate.getTime() === today.getTime() || actionDate.getTime() === tomorrow.getTime()) {
        return 'bg-orange-950/10 text-orange-200 border-l-[6px] border-orange-500/80';
    }
    
    return 'border-l-[6px] border-transparent';
};

const isThisWeek = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const target = new Date(dateStr);
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))); 
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return target >= startOfWeek && target <= endOfWeek;
};

const EngagementsSavDashboard: React.FC = () => {
    const { showToast } = useToastContext();
    const [engagements, setEngagements] = useState<EngagementSav[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('OUVERTS');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<EngagementSav | null>(null);

    // States for persistent warning notifications on overdue (> 48h) items
    const [overdueItems, setOverdueItems] = useState<EngagementSav[]>([]);
    const [showOverdueBanner, setShowOverdueBanner] = useState(false);

    // Helper to calculate exact hours since the target Next-Action Date (in local timezone)
    const getEngagementAgeInHours = (prochaineDateAction: string): number => {
        if (!prochaineDateAction) return 0;
        try {
            const parts = prochaineDateAction.split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                const actionDate = new Date(year, month, day);
                const now = new Date();
                const diffMs = now.getTime() - actionDate.getTime();
                return diffMs / (1000 * 60 * 60);
            }
        } catch (err) {
            console.error("Error calculating engagement age in hours:", err);
        }
        return 0;
    };

    // Initial item blueprint
    const [form, setForm] = useState<Partial<EngagementSav>>({
        numeroFicheOrigine: '',
        numeroCommandeOrigine: '',
        clientId: '',
        nomClient: '',
        telephoneClient: '',
        appareil: '',
        pieceAremplacer: '',
        motif: '',
        datePromesse: '',
        prochaineDateAction: '',
        statut: 'A_OUVRIR',
        responsable: '',
        noteInterne: ''
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await dbGetEngagementsSav();
            setEngagements(data);

            // Conduct automatic verification on loaded engagements
            const overdue = data.filter(item => {
                const isOpen = item.statut !== 'CLOS' && item.statut !== 'ANNULE';
                if (!isOpen || !item.prochaineDateAction) return false;
                return getEngagementAgeInHours(item.prochaineDateAction) > 48;
            });

            if (overdue.length > 0) {
                setOverdueItems(overdue);
                setShowOverdueBanner(true);
                showToast(`Alerte de Suivi : ${overdue.length} engagement(s) SAV dépassent la date d'action de plus de 48h !`, "warning");
            } else {
                setOverdueItems([]);
                setShowOverdueBanner(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    // Parse pre-fill details from URL and subscribe to real-time events
    useEffect(() => {
        loadData();
        window.addEventListener('datareceived', loadData);

        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        if (action === 'create') {
            const numeroFicheOrigine = urlParams.get('numeroFicheOrigine') || '';
            const numeroCommandeOrigine = urlParams.get('numeroCommandeOrigine') || '';
            const nomClient = urlParams.get('nomClient') || '';
            const telephoneClient = urlParams.get('telephoneClient') || '';
            const appareil = urlParams.get('appareil') || '';

            setForm({
                numeroFicheOrigine,
                numeroCommandeOrigine,
                clientId: '',
                nomClient,
                telephoneClient,
                appareil,
                pieceAremplacer: '',
                motif: '',
                datePromesse: new Date().toISOString().split('T')[0],
                prochaineDateAction: new Date().toISOString().split('T')[0],
                statut: 'A_OUVRIR',
                responsable: 'Technicien Principal',
                noteInterne: ''
            });
            setEditingItem(null);
            setIsModalOpen(true);

            // Clean URL
            const url = new URL(window.location.href);
            url.searchParams.delete('action');
            url.searchParams.delete('numeroFicheOrigine');
            url.searchParams.delete('numeroCommandeOrigine');
            url.searchParams.delete('nomClient');
            url.searchParams.delete('telephoneClient');
            url.searchParams.delete('appareil');
            window.history.pushState({}, '', url);
        }

        return () => {
            window.removeEventListener('datareceived', loadData);
        };
    }, [loadData]);

    // Summary counters
    const counters = useMemo(() => {
        let totalOpen = 0;
        let overdue = 0;
        let clientsToCall = 0;
        let partsOrdered = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        engagements.forEach(item => {
            const isOpen = item.statut !== 'CLOS' && item.statut !== 'ANNULE';
            if (isOpen) {
                totalOpen++;
                if (item.prochaineDateAction) {
                    const actionDate = new Date(item.prochaineDateAction);
                    actionDate.setHours(0, 0, 0, 0);
                    if (actionDate < today) {
                        overdue++;
                    }
                }
            }
            if (item.statut === 'CLIENT_A_APPELER') {
                clientsToCall++;
            }
            if (item.statut === 'PIECE_COMMANDEE') {
                partsOrdered++;
            }
        });

        return { totalOpen, overdue, clientsToCall, partsOrdered };
    }, [engagements]);

    // Handle save / update
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.prochaineDateAction) {
            alert('La prochaine date d\'action est obligatoire pour le suivi de dossier.');
            return;
        }

        const storeId = localStorage.getItem('mac-repair-app-storeId') || null;

        if (editingItem) {
            const updated: EngagementSav = {
                ...editingItem,
                ...form,
                updatedAt: new Date().toISOString(),
                isSynced: false
            } as EngagementSav;
            await dbUpdateEngagementSav(updated);
        } else {
            const newId = generateSavId(engagements);
            const created: EngagementSav = {
                ...form,
                id: newId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isSynced: false,
                atelierId: storeId
            } as EngagementSav;
            await dbAddEngagementSav(created);
        }

        setIsModalOpen(false);
        loadData();
    };

    const handleEditItem = (item: EngagementSav) => {
        setEditingItem(item);
        setForm({ ...item });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Voulez-vous vraiment supprimer cet engagement SAV ?')) {
            await dbDeleteEngagementSav(id);
            loadData();
        }
    };

    const handleExitRole = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('role');
        window.history.pushState({}, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    const navItems: NavItem[] = [
        { id: 'list', label: 'Suivi Engagements', icon: WrenchScrewdriverIcon, isActive: true }
    ];

    // Filter and search logic
    const filteredEngagements = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        let list = engagements;

        // Apply quick filter tabs
        const todayStr = new Date().toISOString().split('T')[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (activeFilter === 'OUVERTS') {
            list = list.filter(item => item.statut !== 'CLOS' && item.statut !== 'ANNULE');
        } else if (activeFilter === 'EN_RETARD') {
            list = list.filter(item => {
                const isOpen = item.statut !== 'CLOS' && item.statut !== 'ANNULE';
                if (!isOpen || !item.prochaineDateAction) return false;
                const actionDate = new Date(item.prochaineDateAction);
                actionDate.setHours(0, 0, 0, 0);
                return actionDate < today;
            });
        } else if (activeFilter === 'AUJOURDHUI') {
            list = list.filter(item => item.prochaineDateAction === todayStr);
        } else if (activeFilter === 'CETTE_SEMAINE') {
            list = list.filter(item => isThisWeek(item.prochaineDateAction));
        } else if (activeFilter === 'SANS_PROCHAINE') {
            list = list.filter(item => !item.prochaineDateAction);
        } else if (activeFilter === 'CLOS') {
            list = list.filter(item => item.statut === 'CLOS' || item.statut === 'ANNULE');
        }

        // Apply textual search
        if (query) {
            list = list.filter(item => 
                item.id.toLowerCase().includes(query) ||
                (item.numeroFicheOrigine && item.numeroFicheOrigine.toLowerCase().includes(query)) ||
                (item.numeroCommandeOrigine && item.numeroCommandeOrigine.toLowerCase().includes(query)) ||
                item.nomClient.toLowerCase().includes(query) ||
                item.telephoneClient.toLowerCase().includes(query)
            );
        }

        // Sort descending by updatedAt
        return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }, [engagements, searchQuery, activeFilter]);

    return (
        <DashboardLayout 
            title="Engagements SAV" 
            navItems={navItems}
            onExitRole={handleExitRole}
        >
            <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-6 animate-fade-in text-white">
                
                {/* Visual Title Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">ENGAGEMENTS SAV</h1>
                        <p className="text-xs md:text-sm text-apple-muted font-bold text-slate-400 mt-1 uppercase tracking-wide">
                            Suivi des promesses de remplacement, prises en charge SAV et relances clients
                        </p>
                    </div>
                    <button 
                        onClick={() => {
                            setEditingItem(null);
                            setForm({
                                numeroFicheOrigine: '',
                                numeroCommandeOrigine: '',
                                clientId: '',
                                nomClient: '',
                                telephoneClient: '',
                                appareil: '',
                                pieceAremplacer: '',
                                motif: '',
                                datePromesse: new Date().toISOString().split('T')[0],
                                prochaineDateAction: new Date().toISOString().split('T')[0],
                                statut: 'A_OUVRIR',
                                responsable: 'Technicien Principal',
                                noteInterne: ''
                            });
                            setIsModalOpen(true);
                        }}
                        className="px-5 py-3 bg-apple-blue hover:bg-blue-600 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 Transition-all shadow-xl shadow-blue-500/20 shrink-0 self-start md:self-center"
                    >
                        <PlusCircleIcon className="w-5 h-5" />
                        <span>Créer engagement SAV</span>
                    </button>
                </div>

                {/* Persistent Overdue SAV Notification Banner */}
                {showOverdueBanner && overdueItems.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl animate-fade-in relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                        <div className="flex items-start md:items-center gap-4">
                            <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400 shrink-0">
                                <ExclamationTriangleIcon className="w-5 h-5 animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">Alerte : Engagements SAV en Souffrance ({overdueItems.length})</h4>
                                <p className="text-[11px] text-amber-100/80 mt-1 leading-relaxed">
                                    Ces dossiers de suivi ont dépassé la date de prochaine action de plus de 48 heures. Veuillez prendre des mesures de relance client.
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {overdueItems.slice(0, 3).map(item => (
                                        <div key={item.id} className="bg-amber-500/20 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] font-mono font-bold text-amber-300">
                                            {item.id} - {item.nomClient}
                                        </div>
                                    ))}
                                    {overdueItems.length > 3 && (
                                        <span className="bg-amber-500/10 px-2 py-0.5 rounded text-[9px] font-bold text-amber-400">
                                            + {overdueItems.length - 3} autres
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            <button
                                type="button"
                                onClick={() => setActiveFilter('EN_RETARD')}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-black text-[9px] uppercase tracking-wider rounded-lg transition-all"
                            >
                                Filtrer les retards
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowOverdueBanner(false)}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-amber-300/80 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                            >
                                Masquer
                            </button>
                        </div>
                    </div>
                )}

                {/* Counters Panel */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <div className="apple-card p-5 bg-white/[0.02] rounded-2xl border border-white/5 flex items-center shadow-xl">
                        <div className="p-3 mr-4 bg-blue-500/10 rounded-xl text-blue-400">
                            <WrenchScrewdriverIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Ouverts</p>
                            <p className="text-xl md:text-2xl font-black">{counters.totalOpen}</p>
                        </div>
                    </div>
                    <div className="apple-card p-5 bg-white/[0.02] rounded-2xl border border-white/5 flex items-center shadow-xl">
                        <div className="p-3 mr-4 bg-red-500/10 rounded-xl text-red-400">
                            <ExclamationTriangleIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">En retard</p>
                            <p className="text-xl md:text-2xl font-black text-rose-400">{counters.overdue}</p>
                        </div>
                    </div>
                    <div className="apple-card p-5 bg-white/[0.02] rounded-2xl border border-white/5 flex items-center shadow-xl">
                        <div className="p-3 mr-4 bg-orange-500/10 rounded-xl text-orange-400">
                            <PlusCircleIcon className="h-6 w-6 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">À relancer</p>
                            <p className="text-xl md:text-2xl font-black text-orange-400">{counters.clientsToCall}</p>
                        </div>
                    </div>
                    <div className="apple-card p-5 bg-white/[0.02] rounded-2xl border border-white/5 flex items-center shadow-xl">
                        <div className="p-3 mr-4 bg-purple-500/10 rounded-xl text-purple-400">
                            <ArrowPathIcon className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Pièces commandées</p>
                            <p className="text-xl md:text-2xl font-black text-purple-400">{counters.partsOrdered}</p>
                        </div>
                    </div>
                </div>

                {/* Filters, Search and List panel */}
                <div className="apple-card bg-zinc-950/40 rounded-2xl border border-white/5 p-4 md:p-6 shadow-2xl relative">
                    
                    {/* Header Controls */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                        {/* Search Input */}
                        <div className="relative w-full lg:max-w-md">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Recherche par ID, fiche, commande, client ou tél..."
                                className="w-full pl-9 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex flex-wrap lg:flex-nowrap gap-1.5 overflow-x-auto no-scrollbar py-1">
                            {(['OUVERTS', 'EN_RETARD', 'AUJOURDHUI', 'CETTE_SEMAINE', 'SANS_PROCHAINE', 'CLOS'] as FilterType[]).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setActiveFilter(filter)}
                                    className={`
                                        px-3 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-wider border whitespace-nowrap transition-all
                                        ${activeFilter === filter 
                                            ? 'bg-apple-blue border-blue-400 text-white font-bold' 
                                            : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                                        }
                                    `}
                                >
                                    {filter.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table View */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Chargement du SAV...</p>
                        </div>
                    ) : filteredEngagements.length === 0 ? (
                        <div className="text-center py-20 bg-white/[0.01] rounded-2xl border border-dashed border-white/5">
                            <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">Aucun engagement SAV trouvé</p>
                            <p className="text-[10px] text-slate-600 mt-1 uppercase">Modifiez vos filtres ou créez une fiche de suivi</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/5">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-white/[0.04] text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-white/5">
                                    <tr>
                                        <th className="px-5 py-4 text-center">Actions</th>
                                        <th className="px-5 py-4">N° Engagement</th>
                                        <th className="px-5 py-4">N° Fiche / Commande</th>
                                        <th className="px-5 py-4">Client / Contact</th>
                                        <th className="px-5 py-4">Appareil</th>
                                        <th className="px-5 py-4">Pièce à remplacer</th>
                                        <th className="px-5 py-4">Date promesse</th>
                                        <th className="px-5 py-4">Prochaine action</th>
                                        <th className="px-5 py-4">Statut</th>
                                        <th className="px-5 py-4">Responsable</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-medium">
                                    {filteredEngagements.map(item => {
                                        const aestheticClass = getRowAesthetic(item);
                                        return (
                                            <tr 
                                                key={item.id} 
                                                className={`hover:bg-white/5 transition-all group ${aestheticClass}`}
                                            >
                                                {/* Actions block */}
                                                <td className="px-5 py-4 text-center">
                                                    <div className="flex justify-center gap-1.5">
                                                        <button 
                                                            onClick={() => handleEditItem(item)}
                                                            className="p-2.5 bg-white/5 hover:bg-blue-600 rounded-lg text-slate-400 hover:text-white transition-all shadow-md min-h-[38px] min-w-[38px] flex items-center justify-center border border-white/5"
                                                            title="Modifier"
                                                        >
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(item.id)}
                                                            className="p-2.5 bg-white/5 hover:bg-rose-600 rounded-lg text-slate-400 hover:text-white transition-all shadow-md min-h-[38px] min-w-[38px] flex items-center justify-center border border-white/5"
                                                            title="Supprimer"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                                {/* Engagement reference */}
                                                <td className="px-5 py-4 font-mono font-bold text-apple-blue">{item.id}</td>
                                                {/* File references */}
                                                <td className="px-5 py-4">
                                                    <div className="space-y-0.5">
                                                        {item.numeroFicheOrigine ? (
                                                            <div className="text-[10px]"><span className="text-slate-500 uppercase font-black">Fiche:</span> <span className="font-mono text-zinc-300 font-bold">{item.numeroFicheOrigine}</span></div>
                                                        ) : null}
                                                        {item.numeroCommandeOrigine ? (
                                                            <div className="text-[10px]"><span className="text-slate-500 uppercase font-black font-semibold">Cmd:</span> <span className="font-mono text-indigo-400 font-bold">{item.numeroCommandeOrigine}</span></div>
                                                        ) : null}
                                                        {!item.numeroFicheOrigine && !item.numeroCommandeOrigine && (
                                                            <span className="text-[10px] text-zinc-600 font-black uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded border border-white/5">INDEPENDANTE</span>
                                                        )}
                                                    </div>
                                                </td>
                                                {/* Client */}
                                                <td className="px-5 py-4">
                                                    <p className="font-black text-white uppercase tracking-tight">{item.nomClient}</p>
                                                    {item.telephoneClient && (
                                                        <p className="text-[10px] text-blue-400 font-mono font-bold mt-0.5">{item.telephoneClient}</p>
                                                    )}
                                                </td>
                                                {/* Appareil */}
                                                <td className="px-5 py-4 uppercase font-bold text-slate-200">{item.appareil || '-'}</td>
                                                {/* Piece replace */}
                                                <td className="px-5 py-4">
                                                    <p className="font-black text-white uppercase">{item.pieceAremplacer || 'À DÉTERMINER'}</p>
                                                    {item.motif && (
                                                        <p className="text-[10px] text-slate-500 truncate mt-0.5 max-w-[150px]">{item.motif}</p>
                                                    )}
                                                </td>
                                                {/* Date promesse */}
                                                <td className="px-5 py-4 font-mono text-[10px] text-zinc-400 font-bold">
                                                    {item.datePromesse ? new Date(item.datePromesse).toLocaleDateString('fr-FR') : '-'}
                                                </td>
                                                {/* Prochaine action */}
                                                <td className="px-5 py-4 font-mono text-[10px] font-black">
                                                    {item.prochaineDateAction ? new Date(item.prochaineDateAction).toLocaleDateString('fr-FR') : '-'}
                                                </td>
                                                {/* Status */}
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col gap-1.5 min-w-[130px]">
                                                        <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg border uppercase tracking-wider text-center ${STATUS_BG[item.statut]}`}>
                                                            {STATUS_LABELS[item.statut]}
                                                        </span>
                                                        <div className="w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden mt-0.5">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-500 ${STATUS_PROGRESS_COLOR[item.statut]}`}
                                                                style={{ width: `${STATUS_PROGRESS[item.statut]}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                                            <span>Progression</span>
                                                            <span>{STATUS_PROGRESS[item.statut]}%</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Responsable */}
                                                <td className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight">{item.responsable || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Form Modal for Create & Edit */}
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)}
                    containerClassName="bg-[#0e0e11] border border-white/10 rounded-3xl shadow-2xl w-full max-w-3xl m-4 p-6 shrink-0 text-white"
                >
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="border-b border-white/5 pb-4">
                            <h2 className="text-xl font-black uppercase tracking-tight text-white">
                                {editingItem ? `Modifier Engagement : ${editingItem.id}` : 'Créer Engagement SAV'}
                            </h2>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">
                                Saisissez les promesses clients & pièces de rechanges en relance
                            </p>
                        </div>

                        {/* Originate Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">N° Fiche Atelier Origine</label>
                                <input
                                    type="text"
                                    value={form.numeroFicheOrigine || ''}
                                    onChange={e => setForm({ ...form, numeroFicheOrigine: e.target.value })}
                                    className="w-full p-2.5 bg-white/[0.03] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-white/10"
                                    placeholder="Ex: TGS-YYYYMMDD-XXX (optionnel)"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">N° Facture/Commande Origine</label>
                                <input
                                    type="text"
                                    value={form.numeroCommandeOrigine || ''}
                                    onChange={e => setForm({ ...form, numeroCommandeOrigine: e.target.value })}
                                    className="w-full p-2.5 bg-white/[0.03] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-white/10"
                                    placeholder="Ex: CMD-YYYYMMDD-XXX (optionnel)"
                                />
                            </div>
                        </div>

                        {/* Client details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">Nom du Client</label>
                                <input
                                    type="text"
                                    value={form.nomClient || ''}
                                    onChange={e => setForm({ ...form, nomClient: e.target.value })}
                                    className="w-full p-2.5 bg-white/[0.03] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-white/10"
                                    placeholder="Entrez le nom complet"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">Téléphone Client</label>
                                <input
                                    type="text"
                                    value={form.telephoneClient || ''}
                                    onChange={e => setForm({ ...form, telephoneClient: e.target.value })}
                                    className="w-full p-2.5 bg-white/[0.03] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-white/10"
                                    placeholder="Ex: +225 07..."
                                />
                            </div>
                        </div>

                        {/* Device and replacements */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">Appareil (Machine)</label>
                                <input
                                    type="text"
                                    value={form.appareil || ''}
                                    onChange={e => setForm({ ...form, appareil: e.target.value })}
                                    className="w-full p-2.5 bg-white/[0.03] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-white/10"
                                    placeholder="Ex: MacBook Air M2"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">Pièce à remplacer</label>
                                <input
                                    type="text"
                                    value={form.pieceAremplacer || ''}
                                    onChange={e => setForm({ ...form, pieceAremplacer: e.target.value })}
                                    className="w-full p-2.5 bg-white/[0.03] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-white/10"
                                    placeholder="Ex: Écran LCD original MacBook Pro A2442"
                                />
                            </div>
                        </div>

                        {/* Motives and reasons */}
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">Motif / Promesse faite</label>
                            <input
                                type="text"
                                value={form.motif || ''}
                                onChange={e => setForm({ ...form, motif: e.target.value })}
                                className="w-full p-2.5 bg-white/[0.03] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-white/10"
                                placeholder="Détails du motif (ex: Écran défectueux sous garantie constructeur, échange requis)"
                            />
                        </div>

                        {/* Dates and statut */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">Date promesse</label>
                                <input
                                    type="date"
                                    value={form.datePromesse || ''}
                                    onChange={e => setForm({ ...form, datePromesse: e.target.value })}
                                    className="w-full p-2.5 bg-white/[0.03] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-white/10"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">Prochaine action * (Obligatoire)</label>
                                <input
                                    type="date"
                                    value={form.prochaineDateAction || ''}
                                    onChange={e => setForm({ ...form, prochaineDateAction: e.target.value })}
                                    className="w-full p-2.5 bg-white/[0.03] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-orange-500/50"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">Statut initial</label>
                                <select
                                    value={form.statut || 'A_OUVRIR'}
                                    onChange={e => setForm({ ...form, statut: e.target.value as EngagementSavStatus })}
                                    className="w-full p-2.5 bg-[#141419] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-white/10"
                                >
                                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Technician response & Internal Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">Responsable SAV</label>
                                <input
                                    type="text"
                                    value={form.responsable || ''}
                                    onChange={e => setForm({ ...form, responsable: e.target.value })}
                                    className="w-full p-2.5 bg-white/[0.03] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-white/10"
                                    placeholder="Ex: Technicien Principal"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 ml-1">Notes Internes de suivi</label>
                                <input
                                    type="text"
                                    value={form.noteInterne || ''}
                                    onChange={e => setForm({ ...form, noteInterne: e.target.value })}
                                    className="w-full p-2.5 bg-white/[0.03] rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-white border border-white/10"
                                    placeholder="Historique des relances, devis fournisseur, détails de livraison, etc."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-slate-300 transition-all"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2.5 bg-apple-blue hover:bg-blue-600 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all shadow-xl shadow-blue-500/20"
                            >
                                Enregistrer
                            </button>
                        </div>
                    </form>
                </Modal>
            </div>
        </DashboardLayout>
    );
};

export default EngagementsSavDashboard;
