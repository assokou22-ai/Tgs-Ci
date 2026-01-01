import React, { useState } from 'react';
import { useAppSettings, AppSettings } from '../hooks/useAppSettings.ts';
import { CustomFieldDef } from '../types.ts';
import { PlusCircleIcon, PencilIcon, TrashIcon } from './icons.tsx';

type FieldCategory = keyof AppSettings['customFields'];

const CustomFieldsManager: React.FC = () => {
    const { settings, updateCustomFields } = useAppSettings();
    const [activeCategory, setActiveCategory] = useState<FieldCategory>('ticket');
    const [draggedItem, setDraggedItem] = useState<CustomFieldDef | null>(null);

    const currentFieldsSource = settings.customFields?.[activeCategory];
    const currentFields = Array.isArray(currentFieldsSource) ? currentFieldsSource : [];

    const addField = () => {
        const label = prompt("Entrez le nom du nouveau champ personnalisé :");
        if (label && label.trim()) {
            const newField: CustomFieldDef = { id: `custom_${Date.now()}`, label: label.trim() };
            updateCustomFields(activeCategory, [...currentFields, newField]);
        }
    };

    const editField = (fieldId: string) => {
        const field = currentFields.find(f => f.id === fieldId);
        if (!field) return;

        const newLabel = prompt("Modifiez le nom du champ :", field.label);
        if (newLabel && newLabel.trim()) {
            const updatedFields = currentFields.map(f =>
                f.id === fieldId ? { ...f, label: newLabel.trim() } : f
            );
            updateCustomFields(activeCategory, updatedFields);
        }
    };

    const deleteField = (fieldId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce champ personnalisé ? Il sera retiré de tous les éléments associés.")) {
            const updatedFields = currentFields.filter(f => f.id !== fieldId);
            updateCustomFields(activeCategory, updatedFields);
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
                            <button onClick={() => editField(field.id)} className="p-1 text-blue-400 hover:text-blue-300" title="Modifier">
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
                onClick={addField}
                className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded-md text-sm hover:bg-blue-500"
            >
                <PlusCircleIcon className="w-5 h-5" />
                Ajouter un champ
            </button>
        </div>
    );
};

export default CustomFieldsManager;