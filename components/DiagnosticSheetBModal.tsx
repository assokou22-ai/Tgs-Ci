
import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal.tsx';
import { RepairTicket, DiagnosticSheetBData, DiagnosticPoint, TensionValue, EntryCondition } from '../types.ts';
import { PlusCircleIcon, TrashIcon, ExclamationTriangleIcon, CloudArrowDownIcon, SparklesIcon, ArrowPathIcon } from './icons.tsx';
import { useToastContext } from '../context/ToastContext.tsx';
import { compressImageBase64 } from '../utils/imageCompression.ts';

interface DiagnosticSheetBModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DiagnosticSheetBData) => void;
  ticket: RepairTicket;
}

const calculateVoltageStatus = (measured: string, nominal?: number): 'Correct' | 'Anormal' | 'Absent' => {
  if (!measured || measured.trim() === '') return 'Absent';
  
  const val = parseFloat(measured.replace(',', '.').replace(/[^\d.]/g, ''));
  if (isNaN(val) || val <= 0.1) return 'Absent';
  if (nominal === undefined) return 'Correct';

  const diff = Math.abs(val - nominal);
  const tolerance = nominal * 0.05;
  if (diff <= tolerance) return 'Correct';
  return 'Anormal';
};

const defaultVoltages: TensionValue[] = [
    { line: 'DC IN (Adapter)', value: '', status: 'Absent', nominalValue: 20.0 },
    { line: 'PPBUS_G3H', value: '', status: 'Absent', nominalValue: 12.6 },
    { line: 'PP3V3_G3H (LDO)', value: '', status: 'Absent', nominalValue: 3.3 },
    { line: 'PP5V_S5 / S4', value: '', status: 'Absent', nominalValue: 5.0 },
    { line: 'PP3V3_S5 / S4', value: '', status: 'Absent', nominalValue: 3.3 },
    { line: 'PPVCC_S0 (CPU)', value: '', status: 'Absent', nominalValue: 0.8 },
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
  const { showToast } = useToastContext();
  const [data, setData] = useState<DiagnosticSheetBData>(defaultSheetBData);
  const [deviceType, setDeviceType] = useState<'pro' | 'air'>(ticket.macModel.toLowerCase().includes('air') ? 'air' : 'pro');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (ticket.diagnosticSheetB) {
            setData({ ...defaultSheetBData, ...ticket.diagnosticSheetB, images: ticket.diagnosticSheetB.images || [] });
        } else {
            const initialCondition = ticket.powersOn ? EntryCondition.BOOT_DISPLAY : EntryCondition.NO_POWER;
            const initialVoltages = defaultVoltages.map(v => {
                if (v.line === 'PPBUS_G3H') {
                    return { ...v, nominalValue: deviceType === 'air' ? 8.6 : 12.6 };
                }
                return v;
            });
            setData({ ...defaultSheetBData, entryCondition: initialCondition, tensionValues: initialVoltages });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, ticket.diagnosticSheetB, ticket.powersOn, deviceType]);
  
  const handleMainChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setData(prev => ({...prev, [name]: value}));
  };

  const handleTensionChange = (index: number, field: keyof TensionValue, value: string) => {
    const newTensions = [...data.tensionValues];
    const current = newTensions[index];
    
    const updated = { ...current, [field]: value };
    
    if (field === 'value') {
        updated.status = calculateVoltageStatus(value, updated.nominalValue);
    }
    
    newTensions[index] = updated;
    setData({ ...data, tensionValues: newTensions });
  };

  const handlePointChange = (index: number, field: keyof DiagnosticPoint, value: string) => {
    const newPoints = [...data.diagnosticPoints];
    newPoints[index] = { ...newPoints[index], [field]: value };
    setData({ ...data, diagnosticPoints: newPoints });
  };

  const addTension = () => setData({...data, tensionValues: [...data.tensionValues, { line: '', value: '', status: 'Absent' }]});
  const removeTension = (index: number) => setData({...data, tensionValues: data.tensionValues.filter((_, i) => i !== index)});

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: Blob) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            const compressed = await compressImageBase64(base64);
            setData(prev => ({
                ...prev, 
                images: [...(prev.images || []), compressed].slice(0, 6)
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

  const generateAiConclusion = async () => {
    if (isGeneratingAi) return;
    setIsGeneratingAi(true);

    try {
        const voltagesContext = data.tensionValues
            .filter(t => t.value)
            .map(t => `${t.line}: ${t.value} (Cible: ${t.nominalValue}V) -> État: ${t.status}`)
            .join('\n');

        const technicalContext = data.diagnosticPoints
            .filter(p => p.notes)
            .map(p => `${p.item}: ${p.notes}`)
            .join('\n');

        const prompt = `
            APPAREIL: ${ticket.macModel} (${deviceType.toUpperCase()})
            SYMPTÔME D'ARRIVÉE: ${data.entryCondition}

            RELEVÉS DE TENSIONS:
            ${voltagesContext || 'Aucune tension mesurée.'}

            VÉRIFICATIONS TECHNIQUES:
            ${technicalContext || 'Aucune vérification technique saisie.'}

            INSPECTION VISUELLE PRÉLIMINAIRE:
            ${data.visualInspection || 'Non spécifiée.'}
        `;

        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                systemPrompt: `Tu es un expert senior en micro-soudure et diagnostic électronique MacBook (TGS-CI Logic Board specialist). 
                Analyse RIGOUREUSEMENT les mesures de tensions et les points de vérification technique fournis.
                Ton objectif est de générer une conclusion technique et des commentaires visuels structurés.
                1. Analyse les anomalies de tensions (rails absents ou anormaux).
                2. Fais le lien avec les vérifications techniques (SMC, Consommation, Oxydation).
                3. Propose une conclusion technique précise (ex: Court-circuit sur PPBUS_G3H du à un condensateur, ou Problème de négociation USB-C CD3215).
                Rédige en français, style professionnel, sans fioritures, maximum 150 mots.`,
                responseMimeType: "text/plain"
            })
        });

        if (!response.ok) throw new Error('Erreur lors de la génération AI');
        const result = await response.json();
        
        setData(prev => ({ 
            ...prev, 
            visualInspection: (prev.visualInspection ? prev.visualInspection + "\n\n" : "") + "--- CONCLUSION IA ---\n" + result.text 
        }));
        showToast("Conclusion technique générée par IA", "success");
    } catch (error) {
        console.error('AI Generation Error:', error);
        showToast("Échec de la génération automatique", "error");
    } finally {
        setIsGeneratingAi(false);
    }
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
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-blue-400 font-bold text-sm uppercase flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4"/> État d'Arrivée de l'Appareil
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setDeviceType('pro')}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${deviceType === 'pro' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                  >
                    MacBook Pro
                  </button>
                  <button 
                    onClick={() => setDeviceType('air')}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${deviceType === 'air' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                  >
                    MacBook Air
                  </button>
                </div>
              </div>
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
                                className="col-span-4 bg-transparent border-none focus:ring-0 text-white font-mono text-[10px]" 
                                placeholder="Ligne"
                            />
                            <div className="col-span-3">
                                <input 
                                    value={t.value} 
                                    onChange={e => handleTensionChange(idx, 'value', e.target.value)} 
                                    className="w-full bg-gray-800 border-gray-600 rounded text-center text-xs text-blue-300 font-bold p-1" 
                                    placeholder="ex: 12.6V"
                                />
                                {t.nominalValue && (
                                    <div className="text-[8px] text-gray-500 text-center mt-0.5">Cible: {t.nominalValue}V</div>
                                )}
                            </div>
                            <select 
                                value={t.status} 
                                onChange={e => handleTensionChange(idx, 'status', e.target.value as 'Correct' | 'Anormal' | 'Absent')}
                                className={`col-span-4 bg-transparent border-none text-[10px] font-bold ${
                                    t.status === 'Correct' ? 'text-green-400' : 
                                    t.status === 'Absent' ? 'text-orange-400' : 'text-red-500'
                                }`}
                            >
                                <option value="Correct" className="bg-gray-800 text-green-400">Correct</option>
                                <option value="Anormal" className="bg-gray-800 text-red-400">Anormal</option>
                                <option value="Absent" className="bg-gray-800 text-orange-400">Absent</option>
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
                <div className="flex justify-between items-end mb-1">
                    <label className="text-xs text-gray-400 font-bold">Commentaires visuels et conclusion technique</label>
                    <button 
                        type="button"
                        onClick={generateAiConclusion}
                        disabled={isGeneratingAi}
                        className="flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-[10px] font-black uppercase transition-all disabled:opacity-50"
                    >
                        {isGeneratingAi ? (
                            <ArrowPathIcon className="w-3 h-3 animate-spin" />
                        ) : (
                            <SparklesIcon className="w-3 h-3" />
                        )}
                        Générer via IA
                    </button>
                </div>
                <textarea 
                    name="visualInspection" 
                    value={data.visualInspection} 
                    onChange={handleMainChange} 
                    rows={4} 
                    className={inputStyle + " resize-none"} 
                    placeholder="Détaillez ici toute trace d'oxydation, composants brûlés, ou interventions antérieures visibles..."
                />
          </div>

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
