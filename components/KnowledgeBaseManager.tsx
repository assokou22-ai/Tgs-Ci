
import React, { useState, useEffect } from 'react';
import { dbGetStoredDocuments, dbAddStoredDocument, dbDeleteStoredDocument } from '../services/dbService.ts';
import { StoredDocument } from '../types.ts';
import { ArrowDownTrayIcon, TrashIcon, PlusCircleIcon, DocumentArrowDownIcon, GlobeAltIcon, SparklesIcon } from './icons.tsx';
import Modal from './Modal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import { useToastContext } from '../context/ToastContext.tsx';

const CATEGORIES = ['Procédures', 'Manuels', 'Pilotes/Logiciels', 'Administratif', 'Autre'];

const KnowledgeBaseManager: React.FC = () => {
    const { showToast } = useToastContext();
    const [docs, setDocs] = useState<StoredDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filter, setFilter] = useState('');
    
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [description, setDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [docToDelete, setDocToDelete] = useState<StoredDocument | null>(null);

    const loadDocs = async () => {
        setLoading(true);
        try {
            const data = await dbGetStoredDocuments();
            setDocs(data.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
        } catch (error) {
            console.error("Error loading docs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocs();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            if (!name) setName(selectedFile.name);
        }
    };

    const convertBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.readAsDataURL(file);
            fileReader.onload = () => {
                resolve(fileReader.result as string);
            };
            fileReader.onerror = (error) => {
                reject(error);
            };
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !name) return;

        setIsUploading(true);
        try {
            if (file.size > 5 * 1024 * 1024) {
                showToast("Le fichier est trop volumineux (Max 5Mo).", "warning");
                setIsUploading(false);
                return;
            }

            const base64Data = await convertBase64(file);
            
            const newDoc: StoredDocument = {
                id: `doc-${Date.now()}`,
                name: name,
                type: file.type,
                size: file.size,
                category: category,
                description: description,
                uploadDate: new Date().toISOString(),
                data: base64Data
            };

            await dbAddStoredDocument(newDoc);
            await loadDocs();
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error saving document:", error);
            showToast("Erreur lors de l'enregistrement.", "error");
        } finally {
            setIsUploading(false);
        }
    };

    const confirmDelete = async () => {
        if (docToDelete) {
            await dbDeleteStoredDocument(docToDelete.id);
            await loadDocs();
            setDocToDelete(null);
        }
    };

    const handleDownload = (doc: StoredDocument) => {
        const link = document.createElement('a');
        link.href = doc.data;
        link.download = doc.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetForm = () => {
        setFile(null);
        setName('');
        setCategory(CATEGORIES[0]);
        setDescription('');
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const filteredDocs = docs.filter(doc => 
        doc.name.toLowerCase().includes(filter.toLowerCase()) || 
        doc.description.toLowerCase().includes(filter.toLowerCase()) ||
        doc.category.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-full flex flex-col space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white">Base de Connaissance (Fichiers)</h2>
                    <p className="text-gray-400 text-sm">Stockez les manuels, procédures et fichiers utiles.</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)} 
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
                >
                    <PlusCircleIcon className="w-5 h-5"/>
                    Ajouter un fichier
                </button>
            </div>

            {/* SECTION RESSOURCE ANNEXÉE PAR DÉFAUT */}
            <div className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600/20 rounded-xl">
                        <GlobeAltIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                            Documentation de Référence
                            <SparklesIcon className="w-3 h-3 text-yellow-500" />
                        </h3>
                        <p className="text-xs text-slate-400">Liste des MacBook Apple Silicon (M1-M4) & Spécifications</p>
                    </div>
                </div>
                <a 
                    href="https://theapplewiki.com/wiki/List_of_Mac_Laptops_with_Apple_Silicon?utm_source=chatgpt.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20"
                >
                    Ouvrir le Wiki
                </a>
            </div>

            <input 
                type="text" 
                placeholder="Rechercher dans les fichiers locaux..." 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full p-3 bg-gray-700 text-white rounded-xl border border-gray-600 focus:outline-none focus:border-blue-500 transition-all"
            />

            <div className="flex-grow overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-sm text-gray-300">
                    <thead className="text-xs uppercase bg-gray-700/50 text-gray-400 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3">Nom</th>
                            <th className="px-4 py-3">Catégorie</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3 text-right">Taille</th>
                            <th className="px-4 py-3 text-right">Date</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-10 opacity-50 uppercase font-black text-[10px] tracking-widest">Chargement des données...</td></tr>
                        ) : filteredDocs.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-10 text-slate-500 font-bold italic">Aucun fichier local enregistré.</td></tr>
                        ) : (
                            filteredDocs.map(doc => (
                                <tr key={doc.id} className="hover:bg-gray-700/30 transition-colors group">
                                    <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                                        <DocumentArrowDownIcon className="w-4 h-4 text-blue-400"/>
                                        <span className="truncate max-w-[200px]">{doc.name}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 bg-gray-700 text-slate-400 rounded text-[9px] font-black uppercase tracking-tighter">{doc.category}</span>
                                    </td>
                                    <td className="px-4 py-3 max-w-xs truncate text-xs" title={doc.description}>{doc.description}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[10px] text-slate-500">{formatSize(doc.size)}</td>
                                    <td className="px-4 py-3 text-right text-[10px] text-slate-500">{new Date(doc.uploadDate).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => handleDownload(doc)} className="p-1.5 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 rounded-lg transition-all" title="Télécharger">
                                                <ArrowDownTrayIcon className="w-4 h-4"/>
                                            </button>
                                            <button onClick={() => setDocToDelete(doc)} className="p-1.5 hover:bg-red-600/20 text-slate-400 hover:text-red-400 rounded-lg transition-all" title="Supprimer">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSave} className="space-y-4">
                    <h3 className="text-xl font-bold text-white mb-4">Ajouter un fichier</h3>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Fichier</label>
                        <input 
                            type="file" 
                            onChange={handleFileChange} 
                            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Nom</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Catégorie</label>
                        <select 
                            value={category} 
                            onChange={(e) => setCategory(e.target.value)} 
                            className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
                        >
                            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                        <textarea 
                            value={description} 
                            onChange={(e) => setDescription(e.target.value)} 
                            rows={3}
                            className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit" 
                            disabled={isUploading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
                        >
                            {isUploading ? 'Envoi...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={!!docToDelete}
                onClose={() => setDocToDelete(null)}
                onConfirm={confirmDelete}
                title="Supprimer le fichier ?"
                message={`Voulez-vous vraiment effacer définitivement le fichier "${docToDelete?.name}" ?`}
                confirmText="Supprimer définitivement"
            />
        </div>
    );
};

export default KnowledgeBaseManager;
