
import React, { useState, useRef, useEffect } from 'react';
import { Attachment } from '../types.ts';
import { CloudArrowDownIcon, TrashIcon, MacbookIcon, DocumentMagnifyingGlassIcon } from './icons.tsx';

interface MultimediaManagerProps {
    attachments: Attachment[];
    onUpdate: (attachments: Attachment[]) => void;
}

const MultimediaManager: React.FC<MultimediaManagerProps> = ({ attachments = [], onUpdate }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Fonction robuste de lecture avec gestion d'erreurs
    const readFileAsBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else {
                    reject(new Error("Format de lecture invalide"));
                }
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        // On travaille sur une copie fraîche pour éviter les problèmes de référence
        const updatedList = [...attachments];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Sécurité : Limite 10Mo par fichier pour IndexedDB
                if (file.size > 10 * 1024 * 1024) {
                    alert(`Fichier ${file.name} trop lourd. Limite : 10Mo.`);
                    continue;
                }

                const base64 = await readFileAsBase64(file);
                
                let type: Attachment['type'] = 'image';
                if (file.type.startsWith('video/')) type = 'video';
                else if (file.type.startsWith('audio/')) type = 'audio';
                else if (file.type === 'application/pdf') type = 'pdf';

                updatedList.push({
                    id: `att-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
                    name: file.name,
                    type,
                    data: base64,
                    createdAt: new Date().toISOString()
                });
            }
            // Appel direct au parent pour mise à jour immédiate du ticket
            onUpdate(updatedList);
        } catch (err) {
            console.error("Erreur critique Multimédia:", err);
            alert("Erreur lors de l'enregistrement des fichiers.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeAttachment = (id: string) => {
        if (window.confirm("Voulez-vous supprimer ce fichier de preuve ?")) {
            const newList = attachments.filter(a => a.id !== id);
            onUpdate(newList);
        }
    };

    return (
        <section className="bg-gray-800 rounded-lg p-5 border border-gray-700 shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <CloudArrowDownIcon className="w-5 h-5 text-green-400"/>
                    Preuves Multimédias & Fichiers
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className={`px-4 py-2 rounded font-bold text-xs flex items-center gap-2 transition-all shadow-lg ${
                            isUploading ? 'bg-gray-600 cursor-wait' : 'bg-green-600 hover:bg-green-500 text-white'
                        }`}
                    >
                        {isUploading ? "Lecture..." : "Ajouter des Preuves"}
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        multiple 
                        className="hidden" 
                        onChange={handleFileChange}
                        accept="image/*,video/*,audio/*,application/pdf"
                    />
                </div>
            </div>

            {attachments.length === 0 ? (
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-10 text-center bg-gray-900/40">
                    <MacbookIcon className="w-12 h-12 text-gray-700 mx-auto mb-3 opacity-20"/>
                    <p className="text-gray-500 text-sm">Le module multimédia permet de stocker des preuves d'état (oxydation, chocs) ou des fichiers clients.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {attachments.map(att => (
                        <div key={att.id} className="relative group aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-blue-500/50 transition-all">
                            {att.type === 'image' ? (
                                <img src={att.data} className="w-full h-full object-cover" alt={att.name} onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Format+Invalide';
                                }} />
                            ) : (
                                <div className="flex items-center justify-center h-full flex-col p-4 text-center">
                                    <span className="text-[10px] font-black uppercase text-blue-500 mb-1">{att.type}</span>
                                    <p className="text-[9px] text-gray-500 truncate w-full">{att.name}</p>
                                </div>
                            )}
                            {/* Overlay d'actions */}
                            <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                                <button onClick={() => setPreviewUrl(att.data)} className="p-2 bg-blue-600 rounded-full text-white hover:scale-110 transition-transform">
                                    <DocumentMagnifyingGlassIcon className="w-5 h-5"/>
                                </button>
                                <a href={att.data} download={att.name} className="p-2 bg-gray-600 rounded-full text-white hover:scale-110 transition-transform">
                                    <CloudArrowDownIcon className="w-5 h-5"/>
                                </a>
                                <button onClick={() => removeAttachment(att.id)} className="p-2 bg-red-600 rounded-full text-white hover:scale-110 transition-transform">
                                    <TrashIcon className="w-5 h-5"/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Visionneuse plein écran */}
            {previewUrl && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col p-4 backdrop-blur-sm" onClick={() => setPreviewUrl(null)}>
                    <div className="flex justify-end p-4">
                        <button className="text-white font-black text-2xl hover:text-red-500 transition-colors">&times; FERMER</button>
                    </div>
                    <div className="flex-grow flex items-center justify-center">
                        {previewUrl.startsWith('data:image') ? (
                            <img src={previewUrl} className="max-w-full max-h-full object-contain shadow-2xl rounded" />
                        ) : previewUrl.startsWith('data:video') ? (
                            <video src={previewUrl} controls className="max-w-full max-h-full" />
                        ) : (
                             <div className="text-center">
                                <p className="text-white text-lg">Prévisualisation indisponible pour ce format.</p>
                                <a href={previewUrl} download="fichier" className="mt-4 inline-block px-6 py-2 bg-blue-600 text-white rounded">Télécharger le fichier</a>
                             </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};

export default MultimediaManager;
