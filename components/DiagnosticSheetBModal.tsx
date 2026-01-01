


import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal.tsx';
import { RepairTicket, DiagnosticSheetBData, DiagnosticPoint, TensionValue, EntryCondition } from '../types.ts';
import { PlusCircleIcon, TrashIcon, ExclamationTriangleIcon, CloudArrowDownIcon } from './icons.tsx';

interface DiagnosticSheetBModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DiagnosticSheetBData) => void;
  ticket: RepairTicket;
}

const defaultVoltages: TensionValue[] = [
    { line: 'DC IN (Adapter)', value: '', status: 'Correct' },
    { line: 'PPBUS_G3H', value: '', status: 'Correct' },
    { line: 'PP3V3_G3H (LDO)', value: '', status: 'Correct' },
    { line: 'PP5V_S5 / S4', value: '', status: 'Correct' },
    { line: 'PP3V3_S5 / S4', value: '', status: 'Correct' },
    { line: 'PPVCC_S0 (CPU)', value: '', status: 'Correct' },
];

const defaultSheetBData: DiagnosticSheetBData = {
  entryCondition: EntryCondition.NO_POWER,
  testDuration: '',
  repairDelay: '',
  diagnosticPoints: [
    { item: 'Inspection visuelle (Corrosion)', notes: '' },
    { item: 'Consommation Ampères (USB-C Meter)', notes: '' },
    { item: 'État SMC / T2 / M1-M2 Security', notes: '' },
    { item: 'Signal Allumage (PM_PWRBTN_L)', notes: '' },
  ],
  tensionValues: defaultVoltages,
  visualInspection: '',
  images: [],
};

const DiagnosticSheetBModal: React.FC<DiagnosticSheetBModalProps> = ({ isOpen, onClose, onSave, ticket }) => {
  const [data, setData] = useState<DiagnosticSheetBData>(defaultSheetBData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (ticket.diagnosticSheetB) {
          setData({ ...defaultSheetBData, ...ticket.diagnosticSheetB, images: ticket.diagnosticSheetB.images || [] });
      } else {
          const initialCondition = ticket.powersOn ? EntryCondition.BOOT_DISPLAY : EntryCondition.NO_POWER;
          setData({ ...defaultSheetBData, entryCondition: initialCondition });
      }
    }
  }, [isOpen, ticket.diagnosticSheetB, ticket.powersOn]);
  
  const handleMainChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setData(prev => ({...prev, [name]: value}));
  };

  const handleTensionChange = (index: number, field: keyof TensionValue, value: string) => {
    const newTensions = [...data.tensionValues];
    newTensions[index] = { ...newTensions[index], [field]: value };
    setData({ ...data, tensionValues: newTensions });
  };

  const handlePointChange = (index: number, field: keyof DiagnosticPoint, value: string) => {
    const newPoints = [...data.diagnosticPoints];
    newPoints[index] = { ...newPoints[index], [field]: value };
    setData({ ...data, diagnosticPoints: newPoints });
  };

  const addTension = () => setData({...data, tensionValues: [...data.tensionValues, { line: '', value: '', status: 'Correct' }]});
  const removeTension = (index: number) => setData({...data, tensionValues: data.tensionValues.filter((_, i) => i !== index)});

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Fix: Explicitly typing 'file' as Blob to resolve "Argument of type 'unknown' is not assignable to parameter of type 'Blob'" error
    Array.from(files).forEach((file: Blob) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setData(prev => ({
                ...prev, 
                images: [...(prev.images || []), base64].slice(0, 6)
            }));
        };
        reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setData(prev => ({
        ...prev,
        images: (prev.images || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = () => {
    onSave(data);
  };
  
  if (!isOpen) return null;

  const inputStyle = "mt-1 block w-full rounded-md border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-700 text-white text-sm";

  return (
    <Modal isOpen={isOpen} onClose={onClose} containerClassName="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl m-4 p-6 border border-gray-700">
      <div className="flex flex-col h-[85vh]">
        <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-white">Expertise Électronique (Carte Mère)</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-2 space-y-6 custom-scrollbar">
          {/* ÉTATS D'ARRIVÉE */}
          <div className="bg-gray-900/50 p-4 rounded-lg border border-blue-900/30">
              <h3 className="text-blue-400 font-bold text-sm uppercase mb-3 flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4"/> État d'Arrivée de l'Appareil
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.values(EntryCondition).map(cond => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setData({...data, entryCondition: cond})}
                        className={`p-3 rounded-md text-xs font-semibold border transition-all text-left ${
                            data.entryCondition === cond 
                            ? 'bg-blue-600 border-blue-400 text-white shadow-lg' 
                            : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-650'
                        }`}
                      >
                          {cond}
                      </button>
                  ))}
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
                <h3 className="text-gray-300 font-bold text-sm uppercase border-b border-gray-700 pb-2">Mesures de tensions (Logic Board)</h3>
                <div className="space-y-2">
                    {data.tensionValues.map((t, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-700/30 p-2 rounded border border-gray-700">
                            <input 
                                value={t.line} 
                                onChange={e => handleTensionChange(idx, 'line', e.target.value)} 
                                className="col-span-5 bg-transparent border-none focus:ring-0 text-white font-mono text-xs" 
                                placeholder="Ligne"
                            />
                            <input 
                                value={t.value} 
                                onChange={e => handleTensionChange(idx, 'value', e.target.value)} 
                                className="col-span-3 bg-gray-800 border-gray-600 rounded text-center text-xs text-blue-300 font-bold" 
                                placeholder="ex: 12.6V"
                            />
                            <select 
                                value={t.status} 
                                onChange={e => handleTensionChange(idx, 'status', e.target.value as any)}
                                className={`col-span-3 bg-transparent border-none text-[10px] ${t.status === 'Correct' ? 'text-green-400' : 'text-red-400'}`}
                            >
                                <option value="Correct">Correct</option>
                                <option value="Anormal">Anormal</option>
                                <option value="Absent">Absent</option>
                            </select>
                            <button onClick={() => removeTension(idx)} className="col-span-1 text-red-500 hover:text-red-400">&times;</button>
                        </div>
                    ))}
                    <button onClick={addTension} className="text-xs text-blue-400 flex items-center gap-1 hover:underline"><PlusCircleIcon className="w-4 h-4"/>Ajouter une ligne de tension</button>
                </div>
             </div>

             <div className="space-y-4">
                <h3 className="text-gray-300 font-bold text-sm uppercase border-b border-gray-700 pb-2">Vérifications Techniques</h3>
                <div className="space-y-3">
                    {data.diagnosticPoints.map((p, idx) => (
                        <div key={idx} className="space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold uppercase">{p.item}</label>
                            <input 
                                value={p.notes} 
                                onChange={e => handlePointChange(idx, 'notes', e.target.value)} 
                                placeholder="Observations détaillées..." 
                                className={inputStyle}
                            />
                        </div>
                    ))}
                </div>
             </div>
          </div>

          {/* INSPECTION VISUELLE ET DÉTAILS */}
          <div className="space-y-4">
                <h3 className="text-gray-300 font-bold text-sm uppercase border-b border-gray-700 pb-2">Rapport d'expertise et délais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-400">Durée réelle de l'expertise (h/m)</label>
                        <input name="testDuration" value={data.testDuration} onChange={handleMainChange} className={inputStyle} placeholder="ex: 1h 30min"/>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">Délai estimé de réparation</label>
                        <input name="repairDelay" value={data.repairDelay} onChange={handleMainChange} className={inputStyle} placeholder="ex: 3 à 5 jours"/>
                    </div>
                </div>
                <div>
                    <label className="text-xs text-gray-400 font-bold">Commentaires visuels et conclusion technique</label>
                    <textarea 
                        name="visualInspection" 
                        value={data.visualInspection} 
                        onChange={handleMainChange} 
                        rows={3} 
                        className={inputStyle + " resize-none"} 
                        placeholder="Détaillez ici toute trace d'oxydation, composants brûlés, ou interventions antérieures visibles..."
                    />
                </div>
          </div>

          {/* SECTION IMAGES EXPERTISE */}
          <div className="bg-gray-900/30 p-4 rounded-lg border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
                      <CloudArrowDownIcon className="w-5 h-5 text-purple-400"/>
                      Photos Expertise Carte Mère ({data.images?.length || 0}/6)
                  </h3>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-md transition-all"
                  >
                      Capturer des preuves
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
              </div>

              {(data.images?.length || 0) > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      {data.images?.map((img, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-600">
                              <img src={img} alt="Microscopie/Expertise" className="w-full h-full object-cover" />
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
                      Preuves visuelles (oxydation sous microscope, composants fondus, etc.)
                  </p>
              )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-4 pt-4 border-t border-gray-700">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 text-sm">
            Fermer sans enregistrer
          </button>
          <button type="button" onClick={handleSubmit} className="px-8 py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-500 shadow-lg shadow-blue-900/20 text-sm">
            Enregistrer l'Expertise
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DiagnosticSheetBModal;
