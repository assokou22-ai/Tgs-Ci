
import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal.tsx';
import { RepairTicket, RepairServiceItem } from '../types.ts';
import useServices from '../hooks/useServices.ts';
import { getSuggestions, addSuggestion } from '../services/suggestionService.ts';
import { PlusIcon, TrashIcon, PencilIcon } from './icons.tsx';

interface ServiceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (services: RepairServiceItem[]) => void;
  ticket: RepairTicket;
}

const ServiceSelectionModal: React.FC<ServiceSelectionModalProps> = ({ isOpen, onClose, onSave, ticket }) => {
  const { services: allServices } = useServices();
  const [selectedServices, setSelectedServices] = useState<RepairServiceItem[]>(ticket.services || []);
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');
  const [filter, setFilter] = useState('');
  const [customServiceSuggestions, setCustomServiceSuggestions] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<RepairServiceItem | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', price: '' });

  useEffect(() => {
    const fetchSuggestions = async () => {
        if (isOpen) {
            setCustomServiceSuggestions(await getSuggestions('customServiceName'));
        }
    };
    fetchSuggestions();
  }, [isOpen]);

  const availableServices = useMemo(() => {
    const selectedIds = new Set(selectedServices.map(s => s.id));
    return allServices.filter(s => !selectedIds.has(s.id));
  }, [allServices, selectedServices]);
  
  const filteredServices = useMemo(() => {
      if (!filter) return availableServices;
      return availableServices.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()));
  }, [availableServices, filter]);

  const addService = (service: RepairServiceItem) => {
    setSelectedServices(prev => [...prev, service]);
  };

  const removeService = (serviceId: string) => {
    setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
  };

  const addCustomService = () => {
    if (customServiceName && customServicePrice) {
      const price = parseInt(customServicePrice, 10);
      if (!isNaN(price)) {
        const newService: RepairServiceItem = {
          id: `custom-${Date.now()}`,
          updatedAt: new Date().toISOString(),
          name: customServiceName,
          price: price,
          category: 'Personnalisé',
        };
        addService(newService);
        addSuggestion('customServiceName', customServiceName);
        setCustomServiceName('');
        setCustomServicePrice('');
      }
    }
  };

  const handleEditItem = (service: RepairServiceItem) => {
    setEditingItem(service);
    setEditFormData({ name: service.name, price: service.price.toString() });
  };

  const confirmEditItem = () => {
    if (!editingItem || !editFormData.name.trim() || !editFormData.price) return;
    const price = parseInt(editFormData.price, 10);
    if (!isNaN(price)) {
      setSelectedServices(prev =>
        prev.map(s =>
          s.id === editingItem.id ? { ...s, name: editFormData.name.trim(), price, updatedAt: new Date().toISOString() } : s
        )
      );
    }
    setEditingItem(null);
  };

  const handleSave = () => {
    onSave(selectedServices);
  };
  
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} containerClassName="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-5xl m-4 p-0 overflow-hidden">
      <div className="flex flex-col h-[85vh] text-white">
        <header className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Gestion du Devis</h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Composer et ajuster les prestations</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-2xl font-bold">&times;</button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 flex-grow overflow-hidden">
          {/* Gauche: Catalogue */}
          <div className="flex flex-col border-r border-white/5 bg-black/20 p-6 overflow-hidden">
            <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest mb-4">Catalogue Services</h3>
            <div className="relative mb-4">
                <input 
                    type="text" 
                    placeholder="Chercher dans le catalogue..." 
                    value={filter} 
                    onChange={e => setFilter(e.target.value)} 
                    className="w-full p-3 pl-4 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-blue-500 transition-all" 
                />
            </div>
            <ul className="space-y-2 flex-grow overflow-y-auto pr-2 custom-scrollbar">
              {filteredServices.map(s => (
                <li key={s.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex justify-between items-center hover:border-blue-500/30 transition-all group">
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-200">{s.name}</p>
                    <p className="text-[9px] text-slate-500 font-black uppercase">{s.category}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-black text-blue-400 text-sm">{s.price.toLocaleString('fr-FR')} F</span>
                    <button onClick={() => addService(s)} className="p-2 bg-blue-600 rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-900/20"><PlusIcon className="w-4 h-4 text-white"/></button>
                  </div>
                </li>
              ))}
              {filteredServices.length === 0 && <div className="py-20 text-center text-slate-600 text-[10px] font-black uppercase tracking-widest">Aucun résultat</div>}
            </ul>
          </div>

          {/* Droite: Sélection actuelle */}
          <div className="flex flex-col p-6 overflow-hidden bg-slate-900">
            <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4">Services Sélectionnés</h3>
            <ul className="space-y-3 flex-grow overflow-y-auto mb-4 pr-2 custom-scrollbar">
              {selectedServices.map(s => (
                <li key={s.id} className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex justify-between items-center animate-slide-up group">
                  <div className="flex-1">
                    <p className="font-black text-sm text-white uppercase tracking-tight">{s.name}</p>
                    <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">{s.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-white">{s.price.toLocaleString('fr-FR')} F</span>
                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditItem(s)} 
                          className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                          title="Modifier libellé ou prix"
                        >
                          <PencilIcon className="w-4 h-4"/>
                        </button>
                        <button 
                          onClick={() => removeService(s.id)} 
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all" 
                          title="Supprimer"
                        >
                          <TrashIcon className="w-4 h-4"/>
                        </button>
                    </div>
                  </div>
                </li>
              ))}
              {selectedServices.length === 0 && (
                  <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                      <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">Sélection vide</p>
                  </div>
              )}
            </ul>
            
            <div className="mt-auto pt-6 border-t border-white/5">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ajout Manuel ou Rapide</h3>
                </div>
                {/* Raccourcis pour prestations directes */}
                <div className="flex flex-wrap gap-1 mb-2.5">
                    {[
                        { name: "Réparation de la carte mère", price: "120000" },
                        { name: "Remplacement de la carte mère", price: "200000" },
                        { name: "Réparation de la lumière sur l'écran", price: "75000" },
                        { name: "Réparation de la lumière sur la carte mère", price: "90000" }
                    ].map(preset => (
                        <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                                setCustomServiceName(preset.name);
                                setCustomServicePrice(preset.price);
                            }}
                            className="text-[8px] font-bold bg-white/5 hover:bg-blue-600/20 hover:border-blue-500/40 text-slate-300 hover:text-white px-2 py-1 rounded-lg border border-white/5 transition-all"
                        >
                            ⚡ {preset.name}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={customServiceName} 
                        onChange={e => setCustomServiceName(e.target.value)} 
                        placeholder="Désignation..." 
                        className="flex-grow p-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" 
                        list="custom-service-names" 
                    />
                    <datalist id="custom-service-names">
                        {customServiceSuggestions.map(s => <option key={s} value={s} />)}
                    </datalist>
                    <input 
                        type="number" 
                        value={customServicePrice} 
                        onChange={e => setCustomServicePrice(e.target.value)} 
                        placeholder="Prix" 
                        className="w-24 p-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none font-mono text-emerald-400 font-bold" 
                    />
                    <button onClick={addCustomService} className="p-3 bg-white text-black font-black rounded-xl hover:opacity-90 transition-all shadow-xl">+</button>
                </div>
            </div>
          </div>
        </div>
        
        <footer className="p-6 border-t border-white/5 bg-black/40 flex justify-between items-center">
            <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Devis Prévisionnel</span>
                <span className="font-mono font-black text-3xl text-white tracking-tighter">
                    {selectedServices.reduce((sum, s) => sum + s.price, 0).toLocaleString('fr-FR')} F CFA
                </span>
            </div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-white transition-colors">Annuler</button>
            <button type="button" onClick={handleSave} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl uppercase text-xs tracking-widest shadow-xl shadow-blue-900/20 transition-all">Valider la sélection</button>
          </div>
        </footer>

        <Modal isOpen={!!editingItem} onClose={() => setEditingItem(null)} containerClassName="bg-slate-800 border border-white/10 rounded-3xl shadow-2xl w-full max-w-sm m-4 p-6 overflow-hidden">
            <div className="space-y-4 text-white">
                <h3 className="text-lg font-bold uppercase tracking-tight">Modifier Prestation</h3>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Libellé</label>
                    <input 
                        type="text" 
                        autoFocus
                        value={editFormData.name} 
                        onChange={e => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl text-sm outline-none focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Montant (F CFA)</label>
                    <input 
                        type="number" 
                        value={editFormData.price} 
                        onChange={e => setEditFormData(prev => ({ ...prev, price: e.target.value }))}
                        className="w-full p-2.5 bg-black/40 border border-white/10 rounded-xl text-sm outline-none focus:border-blue-500 font-mono"
                    />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-xs font-bold uppercase text-slate-400 hover:text-white">Annuler</button>
                    <button onClick={confirmEditItem} className="px-6 py-2 bg-blue-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all">Appliquer</button>
                </div>
            </div>
        </Modal>
      </div>
    </Modal>
  );
};

export default ServiceSelectionModal;
