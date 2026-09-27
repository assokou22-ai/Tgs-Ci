import React, { useState } from 'react';
import { useAppSettings, AppSettings } from '../hooks/useAppSettings.ts';
import { CustomFieldDef } from '../types.ts';
import { PlusCircleIcon, PencilIcon, TrashIcon } from './icons.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import Modal from './Modal.tsx';

type FieldCategory = keyof AppSettings['customFields'];

const CustomFieldsManager: React.FC = () => {
    const { settings, updateCustomFields } = useAppSettings();
    const [activeCategory, setActiveCategory] = useState<FieldCategory>('ticket');
    const [draggedItem, setDraggedItem] = useState<CustomFieldDef | null>(null);
    const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);
    const [fieldToEdit, setFieldToEdit] = useState<{ id?: string, label: string } | null>(null);

    const currentFieldsSource = settings.customFields?.[activeCategory];
    const currentFields = Array.isArray(currentFieldsSource) ? currentFieldsSource : [];

    const openAddField = () => {
        setFieldToEdit({ label: '' });
    };

    const openEditField = (fieldId: string) => {
        const field = currentFields.find(f => f.id === fieldId);
        if (field) {
            setFieldToEdit({ id: field.id, label: field.label });
        }
    };

    const saveField = () => {
        if (!fieldToEdit || !fieldToEdit.label.trim()) return;

        if (fieldToEdit.id) {
            // Edit
            const updatedFields = currentFields.map(f =>
                f.id === fieldToEdit.id ? { ...f, label: fieldToEdit.label.trim() } : f
            );
            updateCustomFields(activeCategory, updatedFields);
        } else {
            // Add
            const newField: CustomFieldDef = { id: `custom_${Date.now()}`, label: fieldToEdit.label.trim() };
            updateCustomFields(activeCategory, [...currentFields, newField]);
        }
        setFieldToEdit(null);
    };

    const deleteField = (fieldId: string) => {
        setFieldToDelete(fieldId);
    };

    const confirmDelete = () => {
        if (fieldToDelete) {
            const updatedFields = currentFields.filter(f => f.id !== fieldToDelete);
            updateCustomFields(activeCategory, updatedFields);
            setFieldToDelete(null);
        }
    };
    
    const handleDragStart = (field: CustomFieldDef) => {
        setDraggedItem(field);
    };

    const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
        e.preventDefault();
    };

    const handleDrop = (targetField: CustomFieldDef) => {
        if (!draggedItem || draggedItem.id === targetField.id) return;
        
        const items = [...currentFields];
        const draggedIndex = items.findIndex(f => f.id === draggedItem.id);
        const targetIndex = items.findIndex(f => f.id === targetField.id);

        items.splice(draggedIndex, 1);
        items.splice(targetIndex, 0, draggedItem);
        
        updateCustomFields(activeCategory, items);
        setDraggedItem(null);
    };

    const categoryLabels: Record<FieldCategory, string> = {
        ticket: 'Fiches de réparation',
        stock: 'Articles de Stock',
        client: 'Clients'
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-white mb-4">Gestion des Champs Personnalisés</h2>
            <p className="text-sm text-gray-400 mb-4">
                Ajoutez, modifiez ou réorganisez les champs pour chaque catégorie de l'application.
            </p>
            
            <div className="flex border-b border-gray-700 mb-4">
                {(Object.keys(categoryLabels) as FieldCategory[]).map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-2 text-sm font-medium ${activeCategory === cat ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}
                    >
                        {categoryLabels[cat]}
                    </button>
                ))}
            </div>

            <ul className="space-y-2 min-h-[100px]">
                {currentFields.map(field => (
                    <li
                        key={field.id}
                        draggable
                        onDragStart={() => handleDragStart(field)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(field)}
                        className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-move"
                    >
                        <span className="text-white">{field.label}</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => openEditField(field.id)} className="p-1 text-blue-400 hover:text-blue-300" title="Modifier">
                                <PencilIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteField(field.id)} className="p-1 text-red-500 hover:text-red-400" title="Supprimer">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
             <button
                onClick={openAddField}
                className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded-md text-sm hover:bg-blue-500"
            >
                <PlusCircleIcon className="w-5 h-5" />
                Ajouter un champ
            </button>

            <ConfirmationModal
                isOpen={!!fieldToDelete}
                onClose={() => setFieldToDelete(null)}
                onConfirm={confirmDelete}
                title="Supprimer le champ ?"
                message="Êtes-vous sûr de vouloir supprimer ce champ personnalisé ? Il sera retiré de tous les éléments associés (Fiches, Clients ou Stock) et les données saisies dans ce champ seront perdues."
                confirmText="Supprimer"
            />

            <Modal isOpen={!!fieldToEdit} onClose={() => setFieldToEdit(null)}>
                <div className="p-6 text-white">
                    <h3 className="text-lg font-bold mb-4">{fieldToEdit?.id ? 'Modifier le champ' : 'Ajouter un champ personnalisé'}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Nom du champ</label>
                            <input
                                type="text"
                                autoFocus
                                value={fieldToEdit?.label || ''}
                                onChange={(e) => setFieldToEdit(prev => prev ? { ...prev, label: e.target.value } : null)}
                                onKeyDown={(e) => e.key === 'Enter' && saveField()}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                placeholder="Ex: Numéro de série, Couleur, etc."
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button onClick={() => setFieldToEdit(null)} className="px-4 py-2 bg-gray-600 rounded text-sm">Annuler</button>
                            <button onClick={saveField} className="px-6 py-2 bg-blue-600 rounded text-sm font-bold">Enregistrer</button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CustomFieldsManager;