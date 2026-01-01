


import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal.tsx';
import { DiagnosticCheck, RepairTicket, EntryCondition } from '../types.ts';
import { PlusCircleIcon, ExclamationTriangleIcon, TrashIcon, CloudArrowDownIcon } from './icons.tsx';

interface DiagnosticFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (report: DiagnosticCheck[], images: string[]) => void;
  ticket: RepairTicket;
}

const MANDATORY_COMPONENTS = [
  'Écran (Affichage/Rétro)', 'Clavier (Toutes touches)', 'Trackpad (Clic/Force)', 'Batterie (Cycles/Santé)', 
  'Ports USB-C / Thunderbolt', 'Wi-Fi / Bluetooth', 'Haut-parleurs (L/R)', 'Webcam / Micro', 'Touch Bar / ID', 'SSD (Vitesse/Santé)'
];

const DiagnosticFormModal: React.FC<DiagnosticFormModalProps> = ({ isOpen, onClose, onSave, ticket }) => {
  const [report, setReport] = useState<DiagnosticCheck[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [newComponentName, setNewComponentName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entryCondition = ticket.diagnosticSheetB?.entryCondition || EntryCondition.NO_POWER;

  useEffect(() => {
    if (isOpen) {
      const initialReport = ticket.diagnosticReport && ticket.diagnosticReport.length > 0
        ? [...ticket.diagnosticReport]
        : MANDATORY_COMPONENTS.map(name => ({
            component: name,
            status: (entryCondition === EntryCondition.NO_POWER) ? 'Non testable (état machine)' : 'Non testé' as any,
            notes: '',
          }));
      setReport(initialReport);
      setImages(ticket.diagnosticImages || []);
    }
  }, [isOpen, ticket.diagnosticReport, ticket.diagnosticImages, entryCondition]);

  const handleItemChange = (index: number, field: keyof DiagnosticCheck, value: string) => {
    const updatedReport = [...report];
    updatedReport[index] = { ...updatedReport[index], [field]: value };
    setReport(updatedReport);
  };

  const handleAddNewComponent = () => {
    if (newComponentName.trim() && !report.some(item => item.component === newComponentName.trim())) {
      setReport([...report, { component: newComponentName.trim(), status: 'Non testé', notes: '' }]);
      setNewComponentName('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Fix: Explicitly typing 'file' as Blob to resolve "Argument of type 'unknown' is not assignable to parameter of type 'Blob'" error
    Array.from(files).forEach((file: Blob) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setImages(prev => [...prev, base64].slice(0, 6)); // Max 6 images
        };
        reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    onSave(report, images);
  };
  
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} containerClassName="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl m-4 p-6 border border-gray-700">
      <div className="flex flex-col h-[85vh]">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h2 className="text-2xl font-bold text-white">Diagnostic Fonctionnel Appareil</h2>
                <div className="mt-1 flex items-center gap-2 px-2 py-0.5 bg-blue-900/30 text-blue-300 border border-blue-800 rounded text-xs">
                    <ExclamationTriangleIcon className="w-3 h-3" />
                    <span>Mode : {entryCondition}</span>
                </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div className="flex-grow overflow-y-auto pr-2 space-y-6 custom-scrollbar">
          {/* Section Tests */}
          <div className="space-y-3">
            {report.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors">
                <div className="md:col-span-4 flex items-center">
                    <span className="font-semibold text-gray-200 text-sm">{item.component}</span>
                </div>
                <div className="md:col-span-3">
                    <select
                    value={item.status}
                    onChange={(e) => handleItemChange(index, 'status', e.target.value)}
                    className={`block w-full text-xs rounded-md border-gray-600 shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-800 text-white ${
                        item.status === 'OK' ? 'text-green-400' : 
                        item.status === 'Problème' ? 'text-red-400' : 
                        item.status === 'Non testable (état machine)' ? 'text-orange-400' : 'text-gray-400'
                    }`}
                    >
                    <option value="Non testé">Non testé</option>
                    <option value="OK">OK / Fonctionnel</option>
                    <option value="Problème">Défaut / Problème</option>
                    <option value="Non testable (état machine)">Non testable (État d'arrivée)</option>
                    </select>
                </div>
                <div className="md:col-span-5">
                    <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                    placeholder="Notes précises sur l'état..."
                    className="block w-full text-xs rounded-md border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-800 text-white"
                    />
                </div>
                </div>
            ))}
          </div>

          {/* Section Images */}
          <div className="bg-gray-900/30 p-4 rounded-lg border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
                      <CloudArrowDownIcon className="w-5 h-5 text-blue-400"/>
                      Photos de Diagnostic ({images.length}/6)
                  </h3>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-md transition-all"
                  >
                      Ajouter des photos
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
              </div>

              {images.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      {images.map((img, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-600">
                              <img src={img} alt="Diagnostic" className="w-full h-full object-cover" />
                              <button 
                                onClick={() => removeImage(idx)}
                                className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  <TrashIcon className="w-3 h-3" />
                              </button>
                          </div>
                      ))}
                  </div>
              ) : (
                  <p className="text-center text-gray-500 text-xs py-4 border-2 border-dashed border-gray-700 rounded-lg">
                      Aucune photo jointe. Indispensable pour documenter l'oxydation ou les dommages physiques.
                  </p>
              )}
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Ajouter un point de contrôle spécifique</h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newComponentName}
                        onChange={(e) => setNewComponentName(e.target.value)}
                        placeholder="Ex: Lecteur carte SD, Port HDMI..."
                        className="flex-grow px-3 py-2 text-sm border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 outline-none"
                    />
                    <button
                        type="button"
                        onClick={handleAddNewComponent}
                        className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-500"
                        disabled={!newComponentName.trim()}
                    >
                        <PlusCircleIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div className="flex items-end justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 text-sm">
                Annuler
              </button>
              <button type="button" onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-500 shadow-lg shadow-blue-900/20 text-sm">
                Valider le Diagnostic
              </button>
            </div>
        </div>
      </div>
    </Modal>
  );
};

export default DiagnosticFormModal;