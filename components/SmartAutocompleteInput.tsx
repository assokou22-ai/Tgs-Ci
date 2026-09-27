
import React, { useState, useEffect, useRef } from 'react';
import { SuggestionCategory } from '../types.ts';
import { getSuggestions } from '../services/suggestionService.ts';
import { SparklesIcon } from './icons.tsx';

interface SmartAutocompleteInputProps {
    category: SuggestionCategory;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    multiline?: boolean;
    rows?: number;
}

const SmartAutocompleteInput: React.FC<SmartAutocompleteInputProps> = ({ 
    category, value, onChange, placeholder, className, multiline = false, rows = 1 
}) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [filtered, setFiltered] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const load = async () => {
            const data = await getSuggestions(category);
            setSuggestions(data);
        };
        load();
    }, [category]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!value || value.length < 2) {
                setFiltered([]);
                setIsOpen(false);
                return;
            }
            const lower = value.toLowerCase();
            const matches = suggestions.filter(s => 
                s.toLowerCase().includes(lower) && s.toLowerCase() !== lower
            ).slice(0, 6);
            
            setFiltered(matches);
            setIsOpen(matches.length > 0);
        }, 0);
        return () => clearTimeout(timer);
    }, [value, suggestions]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            selectSuggestion(filtered[activeIndex]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const selectSuggestion = (s: string) => {
        onChange(s);
        setIsOpen(false);
        setActiveIndex(-1);
    };

    const InputComponent = multiline ? 'textarea' : 'input';

    return (
        <div ref={containerRef} className="relative w-full">
            <InputComponent
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => value.length >= 2 && filtered.length > 0 && setIsOpen(true)}
                placeholder={placeholder}
                rows={rows}
                className={className}
                spellCheck={false}
                autoComplete="off"
            />
            
            {isOpen && (
                <div className="absolute left-0 right-0 z-[100] mt-2 bg-apple-surface/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                    <div className="p-2 border-b border-white/5 flex items-center gap-2">
                        <SparklesIcon className="w-3 h-3 text-blue-500" />
                        <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Suggestions Intelli-TGS</span>
                    </div>
                    <ul className="max-h-60 overflow-y-auto no-scrollbar">
                        {filtered.map((s, idx) => (
                            <li key={idx}>
                                <button
                                    onClick={() => selectSuggestion(s)}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors border-l-4 ${
                                        activeIndex === idx 
                                        ? 'bg-blue-600 text-white border-white' 
                                        : 'text-slate-300 border-transparent hover:bg-white/5'
                                    }`}
                                >
                                    {s}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SmartAutocompleteInput;
