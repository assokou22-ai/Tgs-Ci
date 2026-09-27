
import React, { useState, useRef } from 'react';
import { Attachment } from '../types.ts';
import { CloudArrowDownIcon, TrashIcon, MacbookIcon, DocumentMagnifyingGlassIcon } from './icons.tsx';
import { useToastContext } from '../context/ToastContext.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import { compressImageBase64 } from '../utils/imageCompression.ts';

interface MultimediaManagerProps {
    attachments: Attachment[];
    onUpdate: (attachments: Attachment[]) => void;
}

const MultimediaManager: React.FC<MultimediaManagerProps> = ({ attachments = [], onUpdate }) => {
    const { showToast } = useToastContext();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(null);

    const readFileAsBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') resolve(reader.result);
                else reject(new Error("Format de lecture invalide"));
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;

        setIsUploading(true);
        const updatedList = [...attachments];

        try {
            // Fix: Explicitly casting the array from FileList to File[] to avoid 'unknown' type errors during iteration.
            const files = Array.from(fileList) as File[];
            for (const file of files) {
                if (file.size > 10 * 1024 * 1024) {
                    showToast(`Fichier ${file.name} trop lourd.`, "warning");
                    continue;
                }

                let base64 = await readFileAsBase64(file);
                
                let type: Attachment['type'] = 'image';
                if (file.type.startsWith('video/')) type = 'video';
                else if (file.type.startsWith('audio/')) type = 'audio';
                else if (file.type === 'application/pdf') type = 'pdf';

                if (type === 'image') {
                    base64 = await compressImageBase64(base64);
                }

                updatedList.push({
                    id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    name: file.name,
                    type,
                    data: base64,
                    createdAt: new Date().toISOString()
                });
            }
            onUpdate(updatedList);
        } catch (err) {
            console.error("Erreur Multimédia:", err);
            showToast("Erreur lors de l'import des fichiers.", "error");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeAttachment = (id: string) => {
        setAttachmentToDelete(id);
    };

    const confirmDelete = () => {
        if (attachmentToDelete) {
            onUpdate(attachments.filter(a => a.id !== attachmentToDelete));
            setAttachmentToDelete(null);
            showToast("Fichier supprimé", "success");
        }
    };

    return (
        <section className="bg-gray-800 rounded-lg p-5 border border-gray-700 shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <CloudArrowDownIcon className="w-5 h-5 text-green-400"/>
                    Média & Preuves Techniques
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className={`px-4 py-2 rounded font-black text-[10px] uppercase flex items-center gap-2 transition-all ${
                            isUploading ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-500 text-white'
                        }`}
                    >
                        {isUploading ? "En cours..." : "Ajouter Médias"}
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
                    <p className="text-gray-500 text-sm italic">Aucun fichier joint à ce dossier.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                    {attachments.map(att => (
                        <div key={att.id} className="relative group aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-700 transition-all">
                            {att.type === 'image' ? (
                                <img src={att.data} className="w-full h-full object-cover" alt={att.name} />
                            ) : (
                                <div className="flex items-center justify-center h-full flex-col p-4 text-center">
                                    <span className="text-[9px] font-black uppercase text-blue-500 mb-1">{att.type}</span>
                                    <p className="text-[8px] text-gray-500 truncate w-full">{att.name}</p>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                                <button onClick={() => setPreviewUrl(att.data)} className="p-1.5 bg-blue-600 rounded-full text-white">
                                    <DocumentMagnifyingGlassIcon className="w-4 h-4"/>
                                </button>
                                <button onClick={() => removeAttachment(att.id)} className="p-1.5 bg-red-600 rounded-full text-white">
                                    <TrashIcon className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {previewUrl && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
                    <div className="absolute top-6 right-6 text-white font-black text-3xl cursor-pointer">&times;</div>
                    {previewUrl.startsWith('data:image') ? (
                        <img src={previewUrl} className="max-w-full max-h-full object-contain" />
                    ) : (
                        <div className="text-white text-center">
                            <p>Aperçu indisponible. <a href={previewUrl} download className="text-blue-400 underline">Télécharger</a></p>
                        </div>
                    )}
                </div>
            )}

            <ConfirmationModal
                isOpen={!!attachmentToDelete}
                onClose={() => setAttachmentToDelete(null)}
                onConfirm={confirmDelete}
                title="Supprimer le fichier ?"
                message="Voulez-vous vraiment supprimer définitivement ce fichier multimédia du dossier technique ?"
                confirmText="Oui, Supprimer"
            />
        </section>
    );
};

export default MultimediaManager;
