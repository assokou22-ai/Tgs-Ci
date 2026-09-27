import React, { useState, useEffect, useMemo, useRef } from 'react';
import useRepairTickets from '../hooks/useRepairTickets.ts';
import { dbGetStock, dbGetFactures, dbGetCommandes } from '../services/dbService.ts';
import { RepairTicket, StockItem, Facture, Commande } from '../types.ts';
import { MacbookIcon, DocumentDuplicateIcon, ShoppingCartIcon, WrenchScrewdriverIcon } from './icons.tsx';
import { X, Search, Camera } from 'lucide-react';
import QrScannerModal from './QrScannerModal.tsx';

type SearchResult =
  | { type: 'Fiche'; item: RepairTicket }
  | { type: 'Stock'; item: StockItem }
  | { type: 'Facture'; item: Facture }
  | { type: 'Commande'; item: Commande };

const GlobalSearch: React.FC = () => {
    const [query, setQuery] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('search') || params.get('q') || '';
    });
    const [isFocused, setIsFocused] = useState(false);
    const [isQrOpen, setIsQrOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { tickets } = useRepairTickets();
    const [stock, setStock] = useState<StockItem[]>([]);
    const [factures, setFactures] = useState<Facture[]>([]);
    const [commandes, setCommandes] = useState<Commande[]>([]);

    useEffect(() => {
        const fetchAllSearchableData = async () => {
            try {
                const [allStock, allFactures, allCommandes] = await Promise.all([
                    dbGetStock(),
                    dbGetFactures(),
                    dbGetCommandes()
                ]);
                setStock(allStock);
                setFactures(allFactures);
                setCommandes(allCommandes);
            } catch (error) {
                console.error("GlobalSearch: Error fetching Stock/Factures/Commandes:", error);
            }
        };
        fetchAllSearchableData();
    }, []);

    // Sync input with browser navigation (popstate)
    useEffect(() => {
        const syncQueryFromUrl = () => {
            const params = new URLSearchParams(window.location.search);
            const currentQuery = params.get('search') || params.get('q') || '';
            setQuery(currentQuery);
        };
        window.addEventListener('popstate', syncQueryFromUrl);
        return () => window.removeEventListener('popstate', syncQueryFromUrl);
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Keyboard shortcut '/' to focus, 'Escape' to blur/close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === 'Escape') {
                inputRef.current?.blur();
                setIsFocused(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Immediate and fast real-time search logic inside dropdown matching via useMemo
    const results = useMemo<SearchResult[]>(() => {
        if (query.length < 2) {
            return [];
        }

        const lowerQuery = query.toLowerCase();
        const sanitizedPhoneQuery = lowerQuery.replace(/[\s-/]/g, '');
        const newResults: SearchResult[] = [];

        // 1. Search Tickets
        tickets.forEach(t => {
            if (
                t.id.toLowerCase().includes(lowerQuery) ||
                t.client.name.toLowerCase().includes(lowerQuery) ||
                t.client.phone.replace(/[\s-/]/g, '').includes(sanitizedPhoneQuery) ||
                t.macModel.toLowerCase().includes(lowerQuery) ||
                (t.serialNumber || '').toLowerCase().includes(lowerQuery)
            ) {
                newResults.push({ type: 'Fiche', item: t });
            }
        });

        // 2. Search Stock
        stock.forEach(s => {
            if (s.name.toLowerCase().includes(lowerQuery) || (s.reference || '').toLowerCase().includes(lowerQuery)) {
                newResults.push({ type: 'Stock', item: s });
            }
        });

        // 3. Search Invoices & Orders
        factures.forEach(f => {
            if (f.numero.toLowerCase().includes(lowerQuery) || f.clientName.toLowerCase().includes(lowerQuery)) {
                newResults.push({ type: 'Facture', item: f });
            }
        });
        commandes.forEach(c => {
            if (c.numero.toLowerCase().includes(lowerQuery) || c.supplierName.toLowerCase().includes(lowerQuery)) {
                newResults.push({ type: 'Commande', item: c });
            }
        });

        return newResults.slice(0, 8);
    }, [query, tickets, stock, factures, commandes]);

    const handleQueryChange = (val: string) => {
        setQuery(val);
        const url = new URL(window.location.href);
        if (val) {
            url.searchParams.set('search', val);
        } else {
            url.searchParams.delete('search');
        }
        window.history.pushState({}, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    const handleClear = () => {
        handleQueryChange('');
        inputRef.current?.focus();
    };

    const handleResultClick = (result: SearchResult) => {
        const url = new URL(window.location.href);
        
        if (result.type === 'Fiche') {
            if (!['accueil', 'technicien', 'editeur'].includes(url.searchParams.get('role') || '')) {
                url.searchParams.set('role', 'technicien');
            }
            url.searchParams.set('ticketId', result.item.id);
        } else if (result.type === 'Stock') {
            url.searchParams.set('role', 'editeur');
            url.searchParams.set('view', 'stock');
            url.searchParams.set('stockFilter', result.item.name);
        } else if (result.type === 'Facture') {
            url.searchParams.set('role', 'factureetcommande');
            url.searchParams.set('view', 'factures');
            url.searchParams.set('editId', result.item.id);
        } else if (result.type === 'Commande') {
            url.searchParams.set('role', 'factureetcommande');
            url.searchParams.set('view', 'commandes');
            url.searchParams.set('editId', result.item.id);
        }
        
        window.history.pushState({}, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
        setIsFocused(false);
    };

    return (
        <div ref={containerRef} className="relative w-44 sm:w-64 md:w-80 lg:w-[380px] z-[120]">
            {/* Input persistent container */}
            <div className={`flex items-center gap-2 px-3 py-2 bg-white/5 border rounded-2xl transition-all duration-300 ${
                isFocused 
                ? 'border-apple-blue bg-zinc-950/90 ring-4 ring-apple-blue/10' 
                : 'border-white/10 hover:border-white/20'
            }`}>
                <Search className={`w-4 h-4 shrink-0 transition-colors ${isFocused ? 'text-apple-blue' : 'text-zinc-500'}`} />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onFocus={() => setIsFocused(true)}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Instantané (N°, client, série)..."
                    className="w-full bg-transparent text-xs font-bold text-white outline-none placeholder:text-zinc-600 uppercase tracking-tight"
                />
                
                {query ? (
                    <button 
                        onClick={handleClear}
                        className="p-1 hover:bg-white/10 rounded-full text-zinc-500 hover:text-white transition-colors shrink-0"
                        title="Effacer la recherche"
                    >
                        <X className="w-3 h-3" />
                    </button>
                ) : (
                    <span className="hidden md:block select-none text-[8px] font-black text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 shrink-0">/</span>
                )}

                {/* Cam-Scan QR Code Button */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsQrOpen(true);
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-apple-blue transition-colors shrink-0"
                    title="Scanner un QR Code via la caméra (Fiche éditée)"
                >
                    <Camera className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Dropdown Floating Results panel */}
            {isFocused && query.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[350px] overflow-y-auto z-[200] animate-fade-in custom-scrollbar">
                    <div className="p-2 space-y-1">
                        {results.length > 0 ? (
                            <>
                                <p className="px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-500">Résultats suggérés ({results.length})</p>
                                {results.map((res, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleResultClick(res)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-apple-blue rounded-xl transition-all text-left group"
                                    >
                                        <div className="p-1.5 bg-white/5 rounded-lg group-hover:bg-white/20 transition-colors shrink-0">
                                            {res.type === 'Fiche' && <MacbookIcon className="w-4 h-4 text-blue-400 group-hover:text-white" />}
                                            {res.type === 'Stock' && <WrenchScrewdriverIcon className="w-4 h-4 text-yellow-500 group-hover:text-white" />}
                                            {res.type === 'Facture' && <DocumentDuplicateIcon className="w-4 h-4 text-green-500 group-hover:text-white" />}
                                            {res.type === 'Commande' && <ShoppingCartIcon className="w-4 h-4 text-purple-500 group-hover:text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-extrabold text-xs text-white truncate uppercase tracking-tight group-hover:text-white flex items-center gap-1.5">
                                                <span>
                                                    {res.type === 'Fiche' ? `${res.item.id} • ${res.item.client.name}` : 
                                                     res.type === 'Stock' ? res.item.name : 
                                                     res.item.numero}
                                                </span>
                                                {res.type === 'Fiche' && res.item.serialNumber && (
                                                    <span className="text-[9px] text-zinc-500 group-hover:text-blue-100 font-mono font-normal tracking-tighter truncate max-w-[80px]">
                                                        ({res.item.serialNumber})
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[9px] text-zinc-500 group-hover:text-white/80 truncate uppercase tracking-tight font-bold">
                                                {res.type === 'Fiche' ? `${res.item.macBrand} ${res.item.macModel}` : 
                                                 res.type === 'Stock' ? `${res.item.category} • Qté: ${res.item.quantity}` : 
                                                 res.type === 'Facture' ? `Facture client: ${res.item.clientName}` : 
                                                 `Commande fournisseur: ${res.item.supplierName}`}
                                            </p>
                                        </div>
                                        <span className="text-[7px] font-black uppercase text-zinc-500 group-hover:text-white/70 tracking-widest bg-white/5 px-1.5 py-0.5 rounded border border-white/5 shrink-0">
                                            {res.type}
                                        </span>
                                    </button>
                                ))}
                            </>
                        ) : (
                            <div className="py-8 text-center text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                                Aucun élément trouvé
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Decapsulated live viewport scanning layer */}
            <QrScannerModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} />
        </div>
    );
};

export default GlobalSearch;
