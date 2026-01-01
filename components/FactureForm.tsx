
import React, { useState, useEffect } from 'react';
import { Facture, DocumentItem, FactureStatus } from '../types.ts';
import { PlusIcon, XCircleIcon } from './icons.tsx';
import { playTone } from '../utils/audio.ts';

interface FactureFormProps {
  onSave: (factureData: Omit<Facture, 'id' | 'numero' | 'date' | 'updatedAt'> | Facture) => Promise<void>;
  onCancel: () => void;
  factureToEdit: Facture | null;
}

const FactureForm: React.FC<FactureFormProps> = ({ onSave, onCancel, factureToEdit }) => {
  const [formData, setFormData] = useState<Omit<Facture, 'id' | 'numero' | 'date' | 'updatedAt'>>(
    factureToEdit
      ? { ...factureToEdit }
      : {
          clientName: '',
          clientPhone: '',
          macModel: '',
          macColor: '',
          macSpecs: '',
          items: [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
          total: 0,
          status: 'Brouillon',
          warranty: '3 mois sur la pièce changée',
          advance: 0,
          message: 'Merci de votre confiance.',
        }
  );

  useEffect(() => {
    // Recalculate total whenever items change
    const total = formData.items.reduce((sum, item) => sum + item.totalPrice, 0);
    setFormData(prev => ({ ...prev, total }));
  }, [formData.items]);


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
        await onSave(factureToEdit ? { ...factureToEdit, ...formData } : formData);
        playTone(660, 150);
    } catch (error) {
        console.error("Failed to save facture:", error);
        alert("L'enregistrement a échoué. Veuillez vérifier la console pour plus de détails.");
    }
  };
  
  const statusOptions: FactureStatus[] = ['Brouillon', 'Finalisé', 'Payé', 'Annulé'];

  const inputStyle = "mt-1 w-full p-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 outline-none";
  const labelStyle = "block text-xs font-black uppercase text-gray-500 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
      <h2 className="text-2xl font-bold text-white">{factureToEdit ? 'Modifier la' : 'Nouvelle'} Facture</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelStyle}>Nom du Client</label>
          <input type="text" name="clientName" value={formData.clientName} onChange={handleMainChange} className={inputStyle} required />
        </div>
        <div>
          <label className={labelStyle}>Contacte du Client</label>
          <input type="text" name="clientPhone" value={formData.clientPhone} onChange={handleMainChange} className={inputStyle} required />
        </div>
        <div>
          <label className={labelStyle}>Modèle (Obligatoire)</label>
          <input type="text" name="macModel" value={formData.macModel} onChange={handleMainChange} className={inputStyle} placeholder="ex: MacBook Air M1" required />
        </div>
        <div>
          <label className={labelStyle}>Couleur (Facultatif)</label>
          <input type="text" name="macColor" value={formData.macColor} onChange={handleMainChange} className={inputStyle} placeholder="ex: Gris Sidéral" />
        </div>
        <div className="md:col-span-2">
          <label className={labelStyle}>Caractéristiques (Facultatif)</label>
          <input type="text" name="macSpecs" value={formData.macSpecs} onChange={handleMainChange} className={inputStyle} placeholder="ex: 16GB RAM, 512GB SSD" />
        </div>
        <div className="md:col-span-2">
           <label className={labelStyle}>Statut</label>
           <select name="status" value={formData.status} onChange={handleMainChange} className={inputStyle}>
               {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
           </select>
        </div>
      </div>

      <div className="space-y-2 border-t border-gray-700 pt-4">
        <h3 className="font-bold text-white uppercase text-sm">Détails de la facture</h3>
        {formData.items.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
            <input type="text" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} placeholder="Description" className="col-span-6 p-1 rounded bg-white dark:bg-gray-600" required />
            <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="col-span-2 p-1 rounded bg-white dark:bg-gray-600 text-center" />
            <input type="number" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', Number(e.target.value))} className="col-span-2 p-1 rounded bg-white dark:bg-gray-600 text-right" />
            <span className="col-span-1 text-right font-mono text-sm text-white">{(item.quantity * item.unitPrice).toLocaleString('fr-FR')}</span>
            <button type="button" onClick={() => removeItem(index)} className="col-span-1 flex justify-center"><XCircleIcon className="w-5 h-5 text-red-500"/></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addItem} className="text-sm text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1"><PlusIcon className="w-4 h-4" /> Ajouter une ligne</button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-700 pt-4">
        <div>
            <label className={labelStyle}>Avance Reçue (F CFA)</label>
            <input type="number" name="advance" value={formData.advance} onChange={handleMainChange} className={inputStyle} />
        </div>
        <div className="text-right self-end">
            <p className="text-gray-400 text-sm">Total: {formData.total.toLocaleString('fr-FR')} F</p>
            <p className="font-bold text-xl text-white">Solde: {(formData.total - formData.advance).toLocaleString('fr-FR')} F</p>
        </div>
      </div>
      
       <div>
            <label className={labelStyle}>Garantie</label>
            <input type="text" name="warranty" value={formData.warranty} onChange={handleMainChange} className={inputStyle} />
       </div>
       <div>
            <label className={labelStyle}>Message / Observations</label>
            <textarea name="message" value={formData.message} onChange={handleMainChange} rows={2} className={inputStyle} />
       </div>

      <div className="flex justify-end gap-4 pt-4 border-t border-gray-700">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md">Annuler</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md font-bold">{factureToEdit ? 'Enregistrer les modifications' : 'Générer la facture'}</button>
      </div>
    </form>
  );
};

export default FactureForm;
