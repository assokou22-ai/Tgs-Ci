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

  const handleEditCustomService = (serviceId: string, currentName: string) => {
    const newName = prompt("Modifier le nom du service :", currentName);
    if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
        setSelectedServices(prev =>
            prev.map(s =>
                s.id === serviceId ? { ...s, name: newName.trim(), updatedAt: new Date().toISOString() } : s
            )
        );
    }
  };

  const handleSave = () => {
    onSave(selectedServices);
  };
  
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col h-[80vh] text-white">
        <h2 className="text-2xl font-bold mb-4">Services & Devis</h2>
        
        <div className="grid grid-cols-2 gap-4 flex-grow overflow-y-hidden">
          {/* Left: Available Services */}
          <div className="flex flex-col bg-gray-700 p-3 rounded-lg overflow-y-hidden">
            <h3 className="font-semibold mb-2">Services disponibles</h3>
            <input type="text" placeholder="Filtrer..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full p-2 mb-2 bg-gray-600 rounded-md" />
            <ul className="space-y-2 flex-grow overflow-y-auto">
              {filteredServices.map(s => (
                <li key={s.id} className="p-2 bg-gray-600 rounded-md flex justify-between items-center">
                  <div>
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-sm text-gray-400 ml-2">({s.price.toLocaleString('fr-FR')} F)</span>
                  </div>
                  <button onClick={() => addService(s)} className="p-1 bg-blue-600 rounded-full hover:bg-blue-500"><PlusIcon className="w-4 h-4"/></button>
                </li>
              ))}
            </ul>
          </div>
          {/* Right: Selected Services */}
          <div className="flex flex-col bg-gray-700 p-3 rounded-lg overflow-y-hidden">
            <h3 className="font-semibold mb-2">Services sélectionnés</h3>
            <ul className="space-y-2 flex-grow overflow-y-auto mb-4">
              {selectedServices.map(s => (
                <li key={s.id} className="p-2 bg-gray-800 rounded-md flex justify-between items-center">
                  <div>
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-sm text-gray-400 ml-2">({s.price.toLocaleString('fr-FR')} F)</span>
                  </div>
                  <div className="flex items-center">
                    {s.category === 'Personnalisé' && (
                        <button 
                          onClick={() => handleEditCustomService(s.id, s.name)} 
                          className="p-1 text-blue-400 hover:text-blue-300 mr-1"
                          title="Modifier le nom"
                        >
                          <PencilIcon className="w-4 h-4"/>
                        </button>
                    )}
                    <button onClick={() => removeService(s.id)} className="p-1 text-red-500 hover:text-red-400" title="Supprimer">
                      <TrashIcon className="w-4 h-4"/>
                    </button>
                  </div>
                </li>
              ))}
              {selectedServices.length === 0 && <p className="text-gray-500 text-center py-4">Aucun service sélectionné.</p>}
            </ul>
            <div className="mt-auto pt-4 border-t border-gray-600">
                <h3 className="font-semibold mb-2">Ajouter un service personnalisé</h3>
                <div className="flex gap-2">
                    <input type="text" value={customServiceName} onChange={e => setCustomServiceName(e.target.value)} placeholder="Nom du service" className="flex-grow p-2 bg-gray-600 rounded-md" list="custom-service-names" />
                    <datalist id="custom-service-names">
                        {customServiceSuggestions.map(s => <option key={s} value={s} />)}
                    </datalist>
                    <input type="number" value={customServicePrice} onChange={e => setCustomServicePrice(e.target.value)} placeholder="Prix" className="w-24 p-2 bg-gray-600 rounded-md" />
                    <button onClick={addCustomService} className="p-2 bg-blue-600 rounded-md"><PlusIcon className="w-5 h-5"/></button>
                </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-between items-center">
            <span className="font-bold text-lg">
                Total Devis: {selectedServices.reduce((sum, s) => sum + s.price, 0).toLocaleString('fr-FR')} F CFA
            </span>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-md">Annuler</button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 rounded-md">Enregistrer</button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ServiceSelectionModal;