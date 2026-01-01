import React, { useState, useMemo } from 'react';
import PreviewModal from './PreviewModal.tsx';
import PrintableSimpleDocument from './PrintableSimpleDocument.tsx';
import { ArrowLeftIcon, PrinterIcon, PlusCircleIcon, TrashIcon, PencilIcon, BookOpenIcon } from './icons.tsx';
import { SimpleDocument } from '../types.ts';
import useSimpleDocuments from '../hooks/useSimpleDocuments.ts';
import { playTone } from '../utils/audio.ts';

interface SimpleDocumentGeneratorProps {
    onBack?: () => void;
}

const TEMPLATES = [
    {
        id: 'attestation',
        name: 'Attestation de Réparation',
        title: 'ATTESTATION DE RÉPARATION',
        content: "Je soussigné, Responsable technique chez TGS-CI / RéparerMonMac, certifie par la présente avoir procédé à la réparation de l'appareil cité en référence.\n\nDescription de l'appareil : [MODÈLE MAC]\nN° de Fiche : [NUMÉRO]\nIntervention réalisée : [DESCRIPTION]\n\nLa présente attestation est délivrée pour valoir ce que de droit."
    },
    {
        id: 'relance',
        name: 'Courrier de Relance (Appareil Prêt)',
        title: 'NOTIFICATION DE MISE À DISPOSITION',
        content: "Madame, Monsieur,\n\nNous vous informons que votre matériel déposé dans nos ateliers est prêt depuis le [DATE]. Malgré nos précédentes relances, nous constatons que l'appareil n'a pas encore été récupéré.\n\nNous vous rappelons que conformément à nos conditions générales, tout appareil non récupéré dans un délai de 3 mois pourra être considéré comme abandonné.\n\nNous restons à votre disposition pour toute information complémentaire."
    },
    {
        id: 'info',
        name: 'Note d\'Information Client',
        title: 'NOTE D\'INFORMATION',
        content: "Chers clients,\n\nNous tenons à vous informer des changements suivants concernant nos services de réparation :\n\n[DÉTAILS DES CHANGEMENTS]\n\nNous vous remercions de votre confiance habituelle."
    }
];

const SimpleDocumentGenerator: React.FC<SimpleDocumentGeneratorProps> = ({ onBack }) => {
    const { documents, addDocument, updateDocument, deleteDocument, loading } = useSimpleDocuments();
    const [editingDoc, setEditingDoc] = useState<Partial<SimpleDocument> | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [filter, setFilter] = useState('');

    const handleCreateNew = () => {
        setEditingDoc({
            title: '',
            content: '',
            date: new Date().toISOString().split('T')[0]
        });
    };

    const handleApplyTemplate = (templateId: string) => {
        const t = TEMPLATES.find(x => x.id === templateId);
        if (t && editingDoc) {
            setEditingDoc({
                ...editingDoc,
                title: t.title,
                content: t.content
            });
        }
    };

    const handleSave = async () => {
        if (!editingDoc?.content || !editingDoc?.title) return;

        try {
            if (editingDoc.id) {
                await updateDocument(editingDoc as SimpleDocument);
            } else {
                await addDocument(editingDoc as Omit<SimpleDocument, 'id' | 'updatedAt'>);
            }
            playTone(660, 150);
            setEditingDoc(null);
        } catch (error) {
            alert("Erreur lors de l'enregistrement.");
        }
    };

    const filteredDocs = useMemo(() => {
        if (!filter) return documents;
        const lowFilter = filter.toLowerCase();
        return documents.filter(d => d.title.toLowerCase().includes(lowFilter) || d.content.toLowerCase().includes(lowFilter));
    }, [documents, filter]);

    if (editingDoc) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center bg-gray-800 p-4 rounded-lg shadow-md sticky top-0 z-10 border border-gray-700">
                    <button onClick={() => setEditingDoc(null)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeftIcon className="w-5 h-5"/> Annuler
                    </button>
                    <div className="flex gap-3">
                         <button 
                            onClick={() => setIsPreviewOpen(true)} 
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-md text-white hover:bg-gray-600"
                        >
                            <PrinterIcon className="w-5 h-5"/> Aperçu/Imprimer
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 rounded-md text-white hover:bg-blue-500 font-bold shadow-lg"
                        >
                            Enregistrer
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Templates Sidebar */}
                    <div className="lg:col-span-1 bg-gray-800 p-4 rounded-lg shadow-lg h-fit border border-gray-700">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Modèles disponibles</h3>
                        <div className="space-y-2">
                            {TEMPLATES.map(t => (
                                <button 
                                    key={t.id}
                                    onClick={() => handleApplyTemplate(t.id)}
                                    className="w-full text-left p-3 text-xs bg-gray-700 hover:bg-blue-900/30 border border-gray-600 rounded transition-colors text-gray-200"
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Editor Main */}
                    <div className="lg:col-span-3 bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date du document</label>
                                <input 
                                    type="date" 
                                    value={editingDoc.date} 
                                    onChange={(e) => setEditingDoc({...editingDoc, date: e.target.value})} 
                                    className="w-full p-2.5 bg-gray-900 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Objet / Titre</label>
                                <input 
                                    type="text" 
                                    value={editingDoc.title} 
                                    onChange={(e) => setEditingDoc({...editingDoc, title: e.target.value})} 
                                    placeholder="Ex: Attestation de réparation"
                                    className="w-full p-2.5 bg-gray-900 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contenu de la lettre</label>
                            <textarea 
                                value={editingDoc.content} 
                                onChange={(e) => setEditingDoc({...editingDoc, content: e.target.value})} 
                                rows={18}
                                placeholder="Saisissez votre texte ici..."
                                className="w-full p-4 bg-gray-900 text-white rounded border border-gray-600 focus:border-blue-500 outline-none font-serif leading-relaxed"
                            />
                        </div>
                    </div>
                </div>

                <PreviewModal
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    fileName={`document_${new Date().toISOString().split('T')[0]}.pdf`}
                >
                    <PrintableSimpleDocument title={editingDoc.title || ''} content={editingDoc.content || ''} date={editingDoc.date} />
                </PreviewModal>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Gestionnaire de Documents</h2>
                    <p className="text-gray-400 text-sm">Créez et archivez vos courriers, attestations et notes internes.</p>
                </div>
                <button 
                    onClick={handleCreateNew} 
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg transition-all"
                >
                    <PlusCircleIcon className="w-6 h-6"/> Nouveau Document
                </button>
            </div>

            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                <div className="p-4 bg-gray-900/50 border-b border-gray-700 flex gap-4">
                    <input 
                        type="text" 
                        placeholder="Rechercher par titre ou contenu..." 
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="flex-grow p-2 bg-gray-800 text-white rounded border border-gray-600 outline-none focus:border-blue-500"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase bg-gray-900/30 text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Titre / Objet</th>
                                <th className="px-6 py-4">Date Document</th>
                                <th className="px-6 py-4">Dernière Modif</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr><td colSpan={4} className="text-center py-8 text-gray-500">Chargement...</td></tr>
                            ) : filteredDocs.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-12">
                                    <BookOpenIcon className="w-12 h-12 text-gray-600 mx-auto mb-3 opacity-20"/>
                                    <p className="text-gray-500">Aucun document trouvé.</p>
                                </td></tr>
                            ) : (
                                filteredDocs.map(doc => (
                                    <tr key={doc.id} className="hover:bg-gray-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-white">{doc.title}</p>
                                            <p className="text-xs text-gray-500 truncate max-w-xs">{doc.content.substring(0, 60)}...</p>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400">
                                            {new Date(doc.date).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 text-xs">
                                            {new Date(doc.updatedAt).toLocaleString('fr-FR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditingDoc(doc)} className="p-2 bg-gray-700 hover:bg-blue-600 rounded text-white" title="Modifier">
                                                    <PencilIcon className="w-4 h-4"/>
                                                </button>
                                                <button onClick={() => { setEditingDoc(doc); setIsPreviewOpen(true); }} className="p-2 bg-gray-700 hover:bg-green-600 rounded text-white" title="Imprimer">
                                                    <PrinterIcon className="w-4 h-4"/>
                                                </button>
                                                <button onClick={() => deleteDocument(doc.id)} className="p-2 bg-gray-700 hover:bg-red-600 rounded text-white" title="Supprimer">
                                                    <TrashIcon className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <PreviewModal
                isOpen={isPreviewOpen && editingDoc !== null && editingDoc.id !== undefined}
                onClose={() => setIsPreviewOpen(false)}
                fileName={`document_${editingDoc?.title?.replace(/\s/g, '_')}.pdf`}
            >
                {editingDoc && <PrintableSimpleDocument title={editingDoc.title || ''} content={editingDoc.content || ''} date={editingDoc.date} />}
            </PreviewModal>
        </div>
    );
};

export default SimpleDocumentGenerator;