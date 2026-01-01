import React, { useState } from 'react';
import { useAiSuggestions } from '../hooks/useAiSuggestions.ts';
import Modal from './Modal.tsx';
import { AcademicCapIcon } from './icons.tsx';

interface AiDiagnosisSuggestionProps {
  problemDescription: string;
}

const AiDiagnosisSuggestion: React.FC<AiDiagnosisSuggestionProps> = ({ problemDescription }) => {
    const { suggestion, isLoading, error, getDiagnosisSuggestion } = useAiSuggestions();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSuggest = async () => {
        await getDiagnosisSuggestion(problemDescription);
        setIsModalOpen(true);
    };

    return (
        <>
            <button
                type="button"
                onClick={handleSuggest}
                disabled={isLoading || !problemDescription}
                className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-wait"
                title="Suggérer un diagnostic avec l'IA"
            >
                {isLoading ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Analyse...</span>
                    </>
                ) : (
                    <>
                        <AcademicCapIcon className="w-5 h-5" />
                        Suggestion IA
                    </>
                )}
            </button>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} containerClassName="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4 p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Suggestion de Diagnostic IA</h2>
                {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md">{error}</p>}
                {suggestion && (
                    <div className="prose prose-invert prose-p:text-gray-300 prose-li:text-gray-300 whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                        {suggestion}
                    </div>
                )}
                <div className="mt-6 flex justify-end">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-600 rounded-md">
                        Fermer
                    </button>
                </div>
            </Modal>
        </>
    );
};

export default AiDiagnosisSuggestion;
