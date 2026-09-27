
import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal.tsx';
import { DiagnosticCheck, RepairTicket, EntryCondition } from '../types.ts';
import { PlusCircleIcon, TrashIcon, CloudArrowDownIcon } from './icons.tsx';
import SmartAutocompleteInput from './SmartAutocompleteInput.tsx';
import { learnFromData } from '../services/suggestionService.ts';
import { compressImageBase64 } from '../utils/imageCompression.ts';

interface DiagnosticFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (report: DiagnosticCheck[], images: string[], selectedScenario: EntryCondition) => void;
  ticket: RepairTicket;
}

const MANDATORY_COMPONENTS = [
  'Écran (Affichage/Rétro)', 'Clavier (Toutes touches)', 'Trackpad (Clic/Force)', 'Batterie (Cycles/Santé)', 
  'Ports USB-C / Thunderbolt', 'Wi-Fi / Bluetooth', 'Haut-parleurs (L/R)', 'Webcam / Micro', 'Touch Bar / ID', 'SSD (Vitesse/Santé)'
];

const DiagnosticFormModal: React.FC<DiagnosticFormModalProps> = ({ isOpen, onClose, onSave, ticket }) => {
  const [selectedScenario, setSelectedScenario] = useState<EntryCondition>(
    ticket.diagnosticSheetB?.entryCondition || EntryCondition.NO_POWER
  );
  const [report, setReport] = useState<DiagnosticCheck[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [newComponentName, setNewComponentName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const activeCond = ticket.diagnosticSheetB?.entryCondition || EntryCondition.NO_POWER;

      let initialReport: DiagnosticCheck[] = [];
      if (ticket.diagnosticReport && ticket.diagnosticReport.length > 0) {
        initialReport = [...ticket.diagnosticReport];
      } else {
        if (activeCond === EntryCondition.BOOT_DISPLAY) {
          initialReport = MANDATORY_COMPONENTS.map(name => ({
            component: name,
            status: 'OK',
            notes: 'Fonctionnel'
          }));
        } else if (activeCond === EntryCondition.BOOT_NO_DISPLAY) {
          initialReport = [
            {
              component: 'Écran (Affichage/Rétro)',
              status: 'Non testable (état machine)',
              notes: 'Ne peut être testé tant que l\'affichage/carte mère ne démarre pas'
            }
          ];
        } else {
          initialReport = MANDATORY_COMPONENTS.map(name => ({
            component: name,
            status: 'Non testable (état machine)',
            notes: 'Ne peut être testé tant que la carte mère ne démarre pas'
          }));
        }
      }

      const timer = setTimeout(() => {
        setSelectedScenario(activeCond);
        setReport(initialReport as DiagnosticCheck[]);
        setImages(ticket.diagnosticImages || []);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, ticket.diagnosticReport, ticket.diagnosticImages, ticket.diagnosticSheetB?.entryCondition]);

  const handleScenarioChange = (newScenario: EntryCondition) => {
    // Check if the current report contains any customized modifications
    const isReportCustomized = report.length > 0 && (
      report.some(item => {
        const isDefaultOK = item.status === 'OK' && (item.notes === 'Fonctionnel' || item.notes === '');
        const isDefaultNonTestable = item.status === 'Non testable (état machine)' && (item.notes === 'Ne peut etre testé tant que la carte mere ne demarre' || item.notes === '');
        return !isDefaultOK && !isDefaultNonTestable;
      })
    );

    if (isReportCustomized) {
      const scenarioName = newScenario === EntryCondition.BOOT_DISPLAY 
        ? "Scénario A (S'affiche)" 
        : newScenario === EntryCondition.BOOT_NO_DISPLAY 
          ? "Scénario B (Pas d'affichage)" 
          : "Scénario C (Ne démarre pas)";
          
      const confirmReset = window.confirm(
        `Vous avez saisi des observations personnalisées dans ce rapport technique. ` +
        `Voulez-vous également charger le modèle de composants par défaut pour le ${scenarioName} ?\n\n` +
        `• Cliquez sur "OK" pour charger le modèle par défaut (effacera vos modifications).\n` +
        `• Cliquez sur "Annuler" pour changer uniquement de scénario et conserver vos modifications.`
      );
      
      if (!confirmReset) {
        // Only update the selected scenario type but do not overwrite report!
        setSelectedScenario(newScenario);
        return;
      }
    }

    setSelectedScenario(newScenario);
    
    let newReport: DiagnosticCheck[] = [];
    if (newScenario === EntryCondition.BOOT_DISPLAY) {
      newReport = MANDATORY_COMPONENTS.map(name => ({
        component: name,
        status: 'OK',
        notes: 'Fonctionnel'
      }));
    } else if (newScenario === EntryCondition.BOOT_NO_DISPLAY) {
      newReport = [
        {
          component: 'Écran (Affichage/Rétro)',
          status: 'Non testable (état machine)',
          notes: 'Ne peut etre testé tant que la carte mere ne demarre'
        }
      ];
    } else {
      newReport = MANDATORY_COMPONENTS.map(name => ({
        component: name,
        status: 'Non testable (état machine)',
        notes: 'Ne peut etre testé tant que la carte mere ne demarre'
      }));
    }
    setReport(newReport);
  };

  const handleRemoveComponent = (index: number) => {
    setReport(prev => prev.filter((_, i) => i !== index));
  };

  const handleResetToDefaultTemplate = (scenario: EntryCondition) => {
    let newReport: DiagnosticCheck[] = [];
    if (scenario === EntryCondition.BOOT_DISPLAY) {
      newReport = MANDATORY_COMPONENTS.map(name => ({
        component: name,
        status: 'OK',
        notes: 'Fonctionnel'
      }));
    } else if (scenario === EntryCondition.BOOT_NO_DISPLAY) {
      newReport = [
        {
          component: 'Écran (Affichage/Rétro)',
          status: 'Non testable (état machine)',
          notes: 'Ne peut être testé tant que l\'affichage/carte mère ne démarre pas'
        }
      ];
    } else {
      newReport = MANDATORY_COMPONENTS.map(name => ({
        component: name,
        status: 'Non testable (état machine)',
        notes: 'Ne peut être testé tant que la carte mère ne démarre pas'
      }));
    }
    setReport(newReport);
  };

  const handleSetAllStatus = (status: string, notes: string) => {
    setReport(prev => prev.map(item => ({
      ...item,
      status,
      notes: notes !== undefined ? notes : item.notes
    })));
  };

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

    Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            const compressed = await compressImageBase64(base64);
            setImages(prev => [...prev, compressed].slice(0, 6));
        };
        reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    for (const item of report) {
        if (item.notes.length > 3) {
            await learnFromData({ notes: item.notes }, { notes: 'diagnostic_notes' });
        }
    }
    onSave(report, images, selectedScenario);
  };
  
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} containerClassName="bg-apple-surface rounded-3xl shadow-2xl w-full max-w-4xl m-4 p-6 border border-white/10">
      <div className="flex flex-col h-[85vh]">
        <div className="flex justify-between items-start mb-6">
            <div className="flex-grow">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Rapport Technique</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {Object.values(EntryCondition).map(cond => {
                    const isSelected = selectedScenario === cond;
                    let label = "";
                    if (cond === EntryCondition.BOOT_DISPLAY) label = "Scénario A (S'affiche)";
                    else if (cond === EntryCondition.BOOT_NO_DISPLAY) label = "Scénario B (Pas d'affichage)";
                    else label = "Scénario C (Ne démarre pas)";

                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => handleScenarioChange(cond)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                          isSelected 
                            ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-950/50' 
                            : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => handleResetToDefaultTemplate(selectedScenario)}
                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-[9px] font-bold uppercase tracking-wider border border-white/10 transition-colors ml-auto"
                    title="Recharger la liste standard des composants pour ce scénario"
                  >
                    Réinitialiser au modèle
                  </button>
                </div>
            </div>
            <button onClick={onClose} className="text-apple-muted hover:text-white transition-colors text-2xl font-bold ml-4">&times;</button>
        </div>

        {/* Quick Batch Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white/[0.03] rounded-xl border border-white/5 mb-3 text-[10px]">
          <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">
            Composants ({report.length})
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSetAllStatus('OK', 'Fonctionnel')}
              className="px-2 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-[9px] font-black uppercase tracking-wider border border-green-500/20 transition-all"
            >
              Tout marquer OK
            </button>
            <button
              type="button"
              onClick={() => handleSetAllStatus('Non testable (état machine)', 'Ne peut être testé tant que la carte mère ne démarre pas')}
              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-wider border border-amber-500/20 transition-all"
            >
              Tout marquer Non Testable
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto pr-2 space-y-6 custom-scrollbar">
          <div className="space-y-2">
            {report.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-white/[0.02] rounded-2xl border border-white/5 hover:border-white/10 transition-colors group items-center">
                    <div className="md:col-span-4 flex items-center gap-2">
                        <input
                            type="text"
                            value={item.component}
                            onChange={(e) => handleItemChange(index, 'component', e.target.value)}
                            className="font-bold text-slate-200 text-xs uppercase tracking-tight bg-transparent border-b border-transparent focus:border-blue-500 outline-none w-full px-1 py-0.5 rounded transition-colors"
                        />
                    </div>
                    <div className="md:col-span-3">
                        <select
                            value={item.status}
                            onChange={(e) => handleItemChange(index, 'status', e.target.value)}
                            className={`block w-full text-[10px] font-black uppercase rounded-lg border-white/10 shadow-sm focus:ring-apple-blue focus:border-apple-blue bg-black/40 text-white p-2 ${
                                item.status === 'OK' ? 'text-green-400' : 
                                item.status === 'Problème' ? 'text-red-400' : 
                                item.status === 'Non testable (état machine)' ? 'text-orange-400' : 'text-slate-500'
                            }`}
                        >
                            <option value="Non testé">Non testé</option>
                            <option value="OK">OK / Fonctionnel</option>
                            <option value="Problème">Défaut / Problème</option>
                            <option value="Non testable (état machine)">Non testable</option>
                        </select>
                    </div>
                    <div className="md:col-span-4">
                        <SmartAutocompleteInput
                            category="diagnostic_notes"
                            value={item.notes}
                            onChange={(v) => handleItemChange(index, 'notes', v)}
                            placeholder="Observations techniques..."
                            className="block w-full text-xs rounded-lg border-white/10 shadow-sm focus:border-apple-blue focus:ring-apple-blue bg-black/40 text-white p-2"
                        />
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                        <button
                            type="button"
                            onClick={() => handleRemoveComponent(index)}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Supprimer ce composant"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
          </div>

          <div className="bg-white/5 p-5 rounded-2xl border border-white/10 shadow-inner">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black text-apple-muted uppercase tracking-[0.2em] flex items-center gap-2">
                      <CloudArrowDownIcon className="w-4 h-4 text-apple-blue"/> Preuves visuelles ({images.length}/6)
                  </h3>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-apple-blue text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-blue-900/20">Ajouter photos</button>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
              </div>

              {images.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      {images.map((img, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-white/10 bg-black shadow-lg">
                              <img src={img} alt="Expertise" className="w-full h-full object-cover" />
                              <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><TrashIcon className="w-3 h-3" /></button>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="py-8 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center opacity-30 text-apple-muted">
                      <CloudArrowDownIcon className="w-8 h-8 mb-2" />
                      <p className="text-[9px] font-black uppercase tracking-widest">Documents visuels requis</p>
                  </div>
              )}
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div>
                <h3 className="text-[9px] font-black text-apple-muted uppercase tracking-widest mb-2 ml-1">Autre composant</h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newComponentName}
                        onChange={(e) => setNewComponentName(e.target.value)}
                        placeholder="Ex: Touch Bar..."
                        className="flex-grow p-2.5 text-xs bg-black/40 border border-white/10 rounded-xl text-white outline-none"
                    />
                    <button type="button" onClick={handleAddNewComponent} className="p-2.5 bg-white/5 text-white rounded-xl hover:bg-white/10 border border-white/10" disabled={!newComponentName.trim()}><PlusCircleIcon className="w-5 h-5" /></button>
                </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-6 py-3 text-apple-muted font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">Annuler</button>
              <button type="button" onClick={handleSubmit} className="px-8 py-3 bg-apple-blue text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/40">Certifier le Diagnostic</button>
            </div>
        </div>
      </div>
    </Modal>
  );
};

export default DiagnosticFormModal;
