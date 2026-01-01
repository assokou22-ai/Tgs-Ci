import React, { useState } from 'react';
import Modal from './Modal.tsx';
import { ExclamationTriangleIcon } from './icons.tsx';

interface UnrepairableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

const UnrepairableModal: React.FC<UnrepairableModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim()) {
      onSubmit(reason.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 bg-red-500 p-2 rounded-full">
               <ExclamationTriangleIcon className="w-6 h-6 text-white"/>
            </div>
            <h2 className="text-2xl font-bold text-white">Réparation non réalisable</h2>
        </div>
        <p className="text-gray-300 mt-4 mb-4">
          Veuillez expliquer clairement au client pourquoi la réparation n'a pas pu aboutir. Cette note sera incluse dans la notification.
        </p>
        
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={5}
          className="w-full p-2 rounded-md border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-700 text-white"
          placeholder="Ex: La carte mère est trop endommagée et irremplaçable..."
          required
        />
        
        <div className="mt-6 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition">
            Annuler
          </button>
          <button type="submit" disabled={!reason.trim()} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition disabled:bg-gray-500 disabled:cursor-not-allowed">
            Confirmer et Notifier
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default UnrepairableModal;