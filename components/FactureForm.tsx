
import React, { useState } from 'react';
import { Facture, DocumentItem, FactureStatus, DocumentNature } from '../types.ts';
import { PlusIcon, XCircleIcon } from './icons.tsx';
import { playTone } from '../utils/audio.ts';
import WarrantyConfigSection from './WarrantyConfigSection.tsx';
import { WARRANTY_PRESETS } from '../utils/warrantyPresets.ts';

interface FactureFormProps {
  onSave: (factureData: Omit<Facture, 'id' | 'numero' | 'date' | 'updatedAt'> | Facture, action: 'save' | 'print') => Promise<void>;
  onCancel: () => void;
  factureToEdit: Facture | null;
}

import { useToastContext } from '../context/ToastContext.tsx';

// Define a local interface for the window extension
interface FactureWindow extends Window {
  _factureAction?: 'save' | 'print';
}

const FactureForm: React.FC<FactureFormProps> = ({ onSave, onCancel, factureToEdit }) => {
  const { showToast } = useToastContext();
  const [formData, setFormData] = useState<Omit<Facture, 'id' | 'numero' | 'date' | 'updatedAt'>>(
    factureToEdit
      ? { 
          documentNature: factureToEdit.documentNature || (factureToEdit.macModel ? 'macbook' : 'reparation'),
          warranty: factureToEdit.warranty ?? '3 Mois SAV Local',
          warrantyConditions: factureToEdit.warrantyConditions ?? '',
          includeWarrantyBlock: factureToEdit.includeWarrantyBlock ?? true,
          ...factureToEdit 
        }
      : {
          clientName: '',
          clientPhone: '',
          documentNature: 'macbook',
          macModel: '',
          macColor: '',
          macSpecs: '',
          macSerialNumber: '',
          macModelNumber: '',
          macScreenSize: '',
          macCondition: 'Occasion',
          items: [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
          total: 0,
          status: 'Finalisé',
          warranty: '6 Mois SAV Local',
          warrantyConditions: WARRANTY_PRESETS.macbook.conditions,
          includeWarrantyBlock: true,
          advance: 0,
          message: 'Merci de votre confiance.',
        }
  );

  const total = React.useMemo(() => formData.items.reduce((sum, item) => sum + item.totalPrice, 0), [formData.items]);

  const handleMainChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: ['advance'].includes(name) ? Number(value) : value }));
  };
  
  const handleItemChange = (index: number, field: keyof DocumentItem, value: string | number) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index], [field]: value };
    
    if(field === 'quantity' || field === 'unitPrice') {
        item.totalPrice = item.quantity * item.unitPrice;
    }

    newItems[index] = item;
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
    }));
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const action = (window as unknown as FactureWindow)._factureAction || 'save';
        await onSave(factureToEdit ? { ...factureToEdit, ...formData, total } : { ...formData, total }, action);
        showToast(`Facture ${factureToEdit ? 'modifiée' : 'générée'} avec succès`, 'success');
        playTone(660, 150);
    } catch (error) {
        console.error("Failed to save facture:", error);
        showToast("L'enregistrement a échoué.", "error");
    }
  };
  
  const statusOptions: FactureStatus[] = ['Brouillon', 'Finalisé', 'Payé', 'Annulé'];

  const inputStyle = "mt-1 w-full p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700/80 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 outline-none text-xs focus:border-blue-500 transition-colors";
  const labelStyle = "block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-1";
  const currentNature: DocumentNature = formData.documentNature || 'macbook';

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {factureToEdit ? `Modifier Facture N° ${factureToEdit.numero}` : 'Nouvelle Facture'}
        </h2>
        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold">
          Facture Vente & Prestations
        </span>
      </div>
      
      {/* 1. Coordonnées Client */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelStyle}>Nom du Client / Entreprise *</label>
          <input type="text" name="clientName" value={formData.clientName} onChange={handleMainChange} className={inputStyle} placeholder="ex: Cabinet Kouassi / M. Traoré" required />
        </div>
        <div>
          <label className={labelStyle}>Contact Téléphonique *</label>
          <input type="text" name="clientPhone" value={formData.clientPhone} onChange={handleMainChange} className={inputStyle} placeholder="ex: +225 07 00 00 00 00" required />
        </div>
      </div>

      {/* 2. Nature & Garantie 100% Modifiables */}
      <WarrantyConfigSection
        documentNature={currentNature}
        onChangeDocumentNature={(nature) => setFormData(prev => ({ ...prev, documentNature: nature }))}
        warranty={formData.warranty || ''}
        onChangeWarranty={(warranty) => setFormData(prev => ({ ...prev, warranty }))}
        warrantyConditions={formData.warrantyConditions || ''}
        onChangeWarrantyConditions={(warrantyConditions) => setFormData(prev => ({ ...prev, warrantyConditions }))}
        includeWarrantyBlock={formData.includeWarrantyBlock ?? true}
        onChangeIncludeWarrantyBlock={(include) => setFormData(prev => ({ ...prev, includeWarrantyBlock: include }))}
        isProforma={false}
      />

      {/* 3. Détails Équipement & Matériel */}
      <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/60 space-y-3">
        <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">
                {currentNature === 'reparation' ? 'Appareil Pris en Charge / Réparation' : currentNature === 'pieces' ? 'Désignation Pièce ou Machine Compatible' : 'Détails MacBook & Équipement'}
            </span>
            <span className="text-[10px] text-gray-400">Ne sera imprimé que ce qui est renseigné</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className={labelStyle}>
              {currentNature === 'pieces' ? 'Pièce / Machine compatible' : currentNature === 'reparation' ? 'Appareil Pris en Charge' : 'Modèle MacBook'}
            </label>
            <input 
              type="text" 
              name="macModel" 
              value={formData.macModel} 
              onChange={handleMainChange} 
              className={inputStyle} 
              placeholder={currentNature === 'pieces' ? "ex: Écran MacBook Pro 14 A2442 Original" : "ex: MacBook Pro 14 M3 Pro, MacBook Air M2..."} 
            />
          </div>
          <div>
            <label className={labelStyle}>Couleur (Facultatif)</label>
            <input type="text" name="macColor" list="facture-colors-list" value={formData.macColor || ''} onChange={handleMainChange} className={inputStyle} placeholder="ex: Silver, Blush, Citrus, Indigo..." />
            <datalist id="facture-colors-list">
                <option value="Silver" />
                <option value="Blush" />
                <option value="Citrus" />
                <option value="Indigo" />
                <option value="Gris Sidéral" />
                <option value="Argent" />
                <option value="Minuit" />
                <option value="Lumière Stellaire" />
                <option value="Noir Sidéral" />
                <option value="Or" />
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
                <label className={labelStyle}>Numéro de Série (S/N)</label>
                <input type="text" name="macSerialNumber" value={formData.macSerialNumber || ''} onChange={handleMainChange} className={inputStyle} placeholder="ex: C02..." />
            </div>
            <div>
                <label className={labelStyle}>Modèle (Axxxx)</label>
                <input type="text" name="macModelNumber" value={formData.macModelNumber || ''} onChange={handleMainChange} className={inputStyle} placeholder="ex: A2338 / A2442" />
            </div>
            <div>
                <label className={labelStyle}>Taille Écran</label>
                <select name="macScreenSize" value={formData.macScreenSize || ''} onChange={handleMainChange} className={inputStyle}>
                    <option value="">Non spécifié</option>
                    <option value="13 pouces">13 pouces</option>
                    <option value="13.3 pouces">13.3 pouces</option>
                    <option value="13.6 pouces">13.6 pouces</option>
                    <option value="14 pouces">14 pouces</option>
                    <option value="15 pouces">15 pouces</option>
                    <option value="16 pouces">16 pouces</option>
                </select>
            </div>
            <div>
                <label className={labelStyle}>État du Matériel</label>
                <select name="macCondition" value={formData.macCondition || ''} onChange={handleMainChange} className={inputStyle}>
                    <option value="">Non spécifié</option>
                    <option value="Occasion">Occasion</option>
                    <option value="Reconditionné">Reconditionné</option>
                    <option value="Neuf">Neuf</option>
                </select>
            </div>
        </div>

        <div>
          <label className={labelStyle}>Caractéristiques Détaillées (RAM, SSD, Clavier...)</label>
          <input type="text" name="macSpecs" value={formData.macSpecs || ''} onChange={handleMainChange} className={inputStyle} placeholder="ex: 18Go Mémoire Unifiée, 512Go SSD, Batterie 100%" />
        </div>

        <div>
           <label className={labelStyle}>Statut de la Facture</label>
           <select name="status" value={formData.status} onChange={handleMainChange} className={inputStyle}>
               {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
           </select>
        </div>
      </div>

      {/* 4. Détails des Lignes de Facture */}
      <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white uppercase text-xs">Articles / Prestations Facturées</h3>
            <span className="text-[11px] text-gray-400">Sélection ou saisie manuelle libre</span>
        </div>
        <datalist id="facture-prestation-presets">
            <option value="Réparation de la carte mère" />
            <option value="Remplacement de la carte mère" />
            <option value="Réparation de la lumière sur l'écran" />
            <option value="Réparation de la lumière sur la carte mère" />
            <option value="Désoxydation (dégâts liquides)" />
            <option value="Remplacement batterie neuve" />
            <option value="Remplacement clavier" />
            <option value="Remplacement écran" />
            <option value="Installation macOS" />
            <option value="Récupération de données" />
        </datalist>
        {formData.items.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-center p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600/40">
            <input type="text" list="facture-prestation-presets" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} placeholder="Description de la prestation ou de l'article" className="col-span-12 sm:col-span-6 p-2 rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 outline-none" required />
            <div className="col-span-4 sm:col-span-2">
                <input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="w-full p-2 rounded-lg bg-white dark:bg-gray-800 text-xs text-center text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 outline-none" placeholder="Qté" />
            </div>
            <div className="col-span-4 sm:col-span-2">
                <input type="number" min="0" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', Number(e.target.value))} className="w-full p-2 rounded-lg bg-white dark:bg-gray-800 text-xs text-right text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 outline-none" placeholder="P.U." />
            </div>
            <span className="col-span-3 sm:col-span-1 text-right font-mono text-xs font-bold text-gray-900 dark:text-white">{(item.quantity * item.unitPrice).toLocaleString('fr-FR')} F</span>
            <button type="button" onClick={() => removeItem(index)} className="col-span-1 flex justify-center text-red-500 hover:text-red-400 transition-colors" title="Supprimer">
                <XCircleIcon className="w-5 h-5"/>
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={addItem} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
            <PlusIcon className="w-4 h-4" /> Ajouter une ligne
        </button>
        <div className="text-right font-black text-lg text-gray-900 dark:text-white">
            TOTAL TTC : <span className="text-blue-600 dark:text-blue-400 font-mono">{total.toLocaleString('fr-FR')} F CFA</span>
        </div>
      </div>

      {/* 5. Règlement & Acompte */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200 dark:border-gray-700 pt-3">
        <div>
            <label className={labelStyle}>Avance Reçue / Acompte (F CFA)</label>
            <input type="number" min="0" name="advance" value={formData.advance || ''} onChange={handleMainChange} className={inputStyle} placeholder="0 F" />
        </div>
        <div className="text-right self-end">
            <p className="text-gray-400 text-xs font-bold">TOTAL TTC: {total.toLocaleString('fr-FR')} F CFA</p>
            <p className="font-extrabold text-lg text-gray-900 dark:text-white">
              {Number(formData.advance) > 0 ? (
                <span>SOLDE RESTANT : <strong className="text-red-500">{(total - (formData.advance || 0)).toLocaleString('fr-FR')} F</strong></span>
              ) : (
                <span className="text-emerald-500">À RÉGLER : {total.toLocaleString('fr-FR')} F</span>
              )}
            </p>
        </div>
      </div>
      
       <div>
            <label className={labelStyle}>Message / Observations imprimées au pied du document</label>
            <textarea name="message" value={formData.message || ''} onChange={handleMainChange} rows={2} className={inputStyle} placeholder="Ex: Merci de votre confiance." />
       </div>

      <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700 pb-32 md:pb-0">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
          Annuler
        </button>
        <button type="button" onClick={() => { (window as unknown as FactureWindow)._factureAction = 'save'; handleSubmit({ preventDefault: () => {} } as React.FormEvent); }} className="px-5 py-2.5 bg-gray-700 text-white rounded-xl text-xs font-bold hover:bg-gray-600 transition-colors hidden md:block">
          Enregistrer
        </button>
        <button type="button" onClick={() => { (window as unknown as FactureWindow)._factureAction = 'print'; handleSubmit({ preventDefault: () => {} } as React.FormEvent); }} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-900/30 hover:bg-blue-500 transition-all hidden md:block">
          Enr. & Imprimer
        </button>
      </div>

      {/* Floating Action Bar - Fixed for all devices */}
      <div className="fixed bottom-0 left-0 right-0 md:bottom-8 md:right-8 md:left-auto p-4 md:p-0 bg-black/80 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none border-t md:border-none border-white/10 z-[110] flex flex-row md:flex-col gap-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] md:pb-0 justify-center md:justify-end pointer-events-auto">
          <button type="button" onClick={() => { (window as unknown as FactureWindow)._factureAction = 'save'; handleSubmit({ preventDefault: () => {} } as React.FormEvent); }} className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest border border-white/10 min-h-[48px] md:min-w-[180px] active:scale-95">
              Enregistrer
          </button>
          <button type="button" onClick={() => { (window as unknown as FactureWindow)._factureAction = 'print'; handleSubmit({ preventDefault: () => {} } as React.FormEvent); }} className="flex-[2] md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/40 min-h-[48px] md:min-w-[180px] active:scale-95">
              Enr. & Imprimer
          </button>
      </div>
    </form>
  );
};

export default FactureForm;

