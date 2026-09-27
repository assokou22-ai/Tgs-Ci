
import React, { useState, useEffect } from 'react';
import { useAppSettings } from '../hooks/useAppSettings.ts';
import { SparklesIcon, WrenchScrewdriverIcon, ArrowPathIcon } from './icons.tsx';
import ErrorBoundaryWrapper from './ErrorBoundaryWrapper.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';

const EditorCore: React.FC = () => {
    const { settings, updateSettings } = useAppSettings();
    const [localCss, setLocalCss] = useState(settings.customCss || '');
    const [isSaved, setIsSaved] = useState(true);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLocalCss(settings.customCss || '');
        }, 0);
        return () => clearTimeout(timer);
    }, [settings.customCss]);

    const handleSave = () => {
        updateSettings('customCss', localCss);
        setIsSaved(true);
    };

    const handleReset = () => {
        setIsResetModalOpen(true);
    };

    const confirmReset = () => {
        setLocalCss('');
        updateSettings('customCss', '');
        setIsResetModalOpen(false);
        setIsSaved(true);
    };

    const selectors = [
        { label: "Boutons Bleus", code: ".btn-apple-primary { background: #ff0000 !important; }" },
        { label: "Cartes", code: ".apple-card { background: #1a1a1a !important; border-color: #333 !important; }" },
        { label: "Texte Principal", code: "body { color: #ffffff !important; }" },
        { label: "Header Fixe", code: ".glass { background: rgba(0,0,0,0.9) !important; }" },
        { label: "Fond d'écran", code: "body { background-color: #050505 !important; }" }
    ];

    return (
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-2xl animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        <WrenchScrewdriverIcon className="w-8 h-8 text-purple-500" />
                        Studio Design CSS Live
                    </h2>
                    <p className="text-sm text-gray-400">Modifiez l'apparence de l'application en injectant du code CSS directement.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleReset}
                        className="px-4 py-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                    >
                        Réinitialiser
                    </button>
                    <button 
                        onClick={handleSave}
                        className={`px-8 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all ${isSaved ? 'bg-gray-700 text-gray-400 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/40'}`}
                    >
                        {isSaved ? "Enregistré" : "Appliquer les modifications"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="relative group">
                        <div className="absolute top-4 left-4 z-10 text-[9px] font-black text-gray-600 uppercase tracking-widest pointer-events-none group-focus-within:text-blue-500 transition-colors">
                            Style.css personnalisé
                        </div>
                        <textarea
                            value={localCss}
                            onChange={(e) => { setLocalCss(e.target.value); setIsSaved(false); }}
                            className="w-full h-[400px] p-10 pt-12 bg-black font-mono text-sm text-green-400 border border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 resize-none custom-scrollbar"
                            placeholder="/* Exemple: changez la couleur du bouton principal */&#10;.btn-apple-primary { background: purple !important; }"
                            spellCheck={false}
                        />
                        <div className="absolute bottom-4 right-4 flex items-center gap-2 text-[9px] font-bold text-gray-500 bg-gray-900/80 px-2 py-1 rounded">
                            <SparklesIcon className="w-3 h-3 text-purple-400" /> Prévisualisation active
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-700">
                        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ArrowPathIcon className="w-4 h-4 text-blue-400" /> 
                            Bibliothèque de sélecteurs
                        </h3>
                        <p className="text-[10px] text-gray-500 mb-4 leading-relaxed">Cliquez sur un exemple pour copier le code, puis collez-le dans l'éditeur à gauche.</p>
                        
                        <div className="space-y-2">
                            {selectors.map((s, i) => (
                                <button 
                                    key={i}
                                    onClick={() => {
                                        const newCss = localCss + (localCss ? '\n\n' : '') + `/* ${s.label} */\n` + s.code;
                                        setLocalCss(newCss);
                                        setIsSaved(false);
                                    }}
                                    className="w-full text-left p-3 bg-gray-800 hover:bg-blue-600/10 border border-gray-700 rounded-xl transition-all group"
                                >
                                    <div className="text-[10px] font-black text-gray-300 group-hover:text-blue-400 uppercase mb-1">{s.label}</div>
                                    <code className="text-[9px] text-gray-500 block truncate font-mono">{s.code}</code>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-5 bg-blue-600/5 border border-blue-500/20 rounded-2xl">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Conseil Pro</h4>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                            Utilisez <strong>!important</strong> pour forcer vos styles par-dessus les thèmes par défaut. 
                            Vous pouvez aussi utiliser des variables comme <code>var(--color-primary)</code>.
                        </p>
                    </div>
                </div>
            </div>
            
            <ConfirmationModal
                isOpen={isResetModalOpen}
                onClose={() => setIsResetModalOpen(false)}
                onConfirm={confirmReset}
                title="Réinitialiser le CSS ?"
                message="Êtes-vous sûr de vouloir effacer tout votre CSS personnalisé ? Cette action est irréversible."
                confirmText="Oui, Réinitialiser"
            />
        </div>
    );
};

const CustomCssEditor: React.FC = () => (
    <ErrorBoundaryWrapper name="Éditeur CSS">
        <EditorCore />
    </ErrorBoundaryWrapper>
);

export default CustomCssEditor;
