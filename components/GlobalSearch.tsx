import React, { useState, useEffect, useMemo, useRef } from 'react';
import useRepairTickets from '../hooks/useRepairTickets.ts';
import { dbGetStock, dbGetFactures, dbGetCommandes } from '../services/dbService.ts';
import { Role, RepairTicket, StockItem, Facture, Commande } from '../types.ts';
import { MacbookIcon, DocumentDuplicateIcon, ShoppingCartIcon, WrenchScrewdriverIcon } from './icons.tsx';

type SearchResult =
  | { type: 'Fiche'; item: RepairTicket }
  | { type: 'Stock'; item: StockItem }
  | { type: 'Facture'; item: Facture }
  | { type: 'Commande'; item: Commande };

interface GlobalSearchProps {
    currentRole: Role;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ currentRole }) => {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    // Fetch all necessary data sources for a comprehensive search
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
                console.error("GlobalSearch failed to fetch all data:", error);
            }
        };
        
        fetchAllSearchableData();
        
        window.addEventListener('datareceived', fetchAllSearchableData);
        window.addEventListener('datachanged', fetchAllSearchableData);
        
        return () => {
            window.removeEventListener('datareceived', fetchAllSearchableData);
            window.removeEventListener('datachanged', fetchAllSearchableData);
        };
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(query);
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [query]);

    useEffect(() => {
        if (debouncedQuery.length < 3) {
            setResults([]);
            return;
        }

        const lowerQuery = debouncedQuery.toLowerCase();
        const sanitizedPhoneQuery = lowerQuery.replace(/[\s-/]/g, '');
        const newResults: SearchResult[] = [];

        // Search Tickets (only for allowed roles)
        if (currentRole === 'Accueil' || currentRole === 'Technicien' || currentRole === 'Editeur') {
            tickets.forEach(t => {
                if (
                    t.id.toLowerCase().includes(lowerQuery) ||
                    t.client.name.toLowerCase().includes(lowerQuery) ||
                    t.client.phone.replace(/[\s-/]/g, '').includes(sanitizedPhoneQuery) ||
                    t.macModel.toLowerCase().includes(lowerQuery) ||
                    t.problemDescription.toLowerCase().includes(lowerQuery)
                ) {
                    newResults.push({ type: 'Fiche', item: t });
                }
            });
        }

        // Search Stock (only for Editor)
        if (currentRole === 'Editeur') {
            stock.forEach(s => {
                if (
                    s.name.toLowerCase().includes(lowerQuery) ||
                    s.category.toLowerCase().includes(lowerQuery) ||
                    s.reference?.toLowerCase().includes(lowerQuery)
                ) {
                    newResults.push({ type: 'Stock', item: s });
                }
            });
        }

        // Search Factures & Commandes (only for Facture et Commande role)
        if (currentRole === 'Facture et Commande') {
            factures.forEach(f => {
                if (
                    f.numero.toLowerCase().includes(lowerQuery) ||
                    f.clientName.toLowerCase().includes(lowerQuery)
                ) {
                    newResults.push({ type: 'Facture', item: f });
                }
            });
            commandes.forEach(c => {
                if (
                    c.numero.toLowerCase().includes(lowerQuery) ||
                    c.supplierName.toLowerCase().includes(lowerQuery) ||
                    c.clientName?.toLowerCase().includes(lowerQuery)
                ) {
                    newResults.push({ type: 'Commande', item: c });
                }
            });
        }

        setResults(newResults.slice(0, 15)); // Limit results
    }, [debouncedQuery, tickets, stock, factures, commandes, currentRole]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleResultClick = (result: SearchResult) => {
        const url = new URL(window.location.href);
        
        // Do not modify the 'role' param, just the entity-specific ones.
        url.searchParams.delete('ticketId');
        url.searchParams.delete('view');
        url.searchParams.delete('editId');
        url.searchParams.delete('stockFilter');
    
        switch(result.type) {
            case 'Fiche':
                url.searchParams.set('ticketId', result.item.id);
                break;
            case 'Stock':
                // EditorDashboard will see this and switch view.
                url.searchParams.set('stockFilter', result.item.name);
                break;
            case 'Facture':
                // FactureCommandeDashboard will see this.
                url.searchParams.set('view', 'factures');
                url.searchParams.set('editId', result.item.id);
                break;
            case 'Commande':
                 // FactureCommandeDashboard will see this.
                url.searchParams.set('view', 'commandes');
                url.searchParams.set('editId', result.item.id);
                break;
        }
        
        window.history.pushState({}, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
        
        setQuery('');
        setIsFocused(false);
    };

    const resultIcons = {
        'Fiche': <MacbookIcon className="w-5 h-5 text-blue-400"/>,
        'Stock': <WrenchScrewdriverIcon className="w-5 h-5 text-yellow-400"/>,
        'Facture': <DocumentDuplicateIcon className="w-5 h-5 text-green-400"/>,
        'Commande': <ShoppingCartIcon className="w-5 h-5 text-purple-400"/>,
    }

    const getResultTitle = (result: SearchResult) => {
        switch(result.type) {
            case 'Fiche': return `${result.item.id} - ${result.item.client.name}`;
            case 'Stock': return result.item.name;
            case 'Facture': return `${result.item.numero} - ${result.item.clientName}`;
            case 'Commande': return `${result.item.numero} - ${result.item.supplierName}`;
        }
    }
    
    const getResultSubtitle = (result: SearchResult) => {
        const lowerQuery = debouncedQuery.toLowerCase();
        switch(result.type) {
            case 'Fiche': 
                if (result.item.problemDescription.toLowerCase().includes(lowerQuery)) {
                    return result.item.problemDescription;
                }
                return result.item.macModel;
            case 'Stock': return `Qté: ${result.item.quantity} | ${result.item.category}`;
            case 'Facture': return `${result.item.total.toLocaleString('fr-FR')} F - ${result.item.status}`;
            case 'Commande': return `${result.item.total.toLocaleString('fr-FR')} F - ${result.item.status}`;
        }
    }

    return (
        <div className="relative w-full max-w-lg" ref={searchContainerRef}>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                placeholder="Rechercher une fiche, un produit, une facture..."
                className="w-full p-2 pl-4 pr-10 rounded-full bg-gray-800 text-white border-2 border-transparent focus:border-blue-500 focus:bg-gray-700 outline-none transition-colors"
            />
            {isFocused && query.length > 2 && (
                <div className="absolute top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
                    {results.length > 0 ? (
                        <ul>
                            {results.map((result, index) => (
                                <li
                                    key={`${result.type}-${result.item.id}`}
                                    onClick={() => handleResultClick(result)}
                                    className="p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700/50 flex items-start gap-3"
                                >
                                    <div className="flex-shrink-0 mt-1">{resultIcons[result.type]}</div>
                                    <div>
                                        <p className="font-semibold text-white">{getResultTitle(result)}</p>
                                        <p className="text-sm text-gray-400 truncate" title={getResultSubtitle(result)}>{getResultSubtitle(result)}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="p-4 text-gray-500">
                            {debouncedQuery ? `Aucun résultat pour "${debouncedQuery}"` : "Commencez à taper pour rechercher..."}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export default GlobalSearch;