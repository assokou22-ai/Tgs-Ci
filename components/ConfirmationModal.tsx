import React from 'react';
import Modal from './Modal.tsx';
import { ExclamationTriangleIcon } from './icons.tsx';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  confirmButtonClass = 'bg-red-600 hover:bg-red-700',
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="text-white">
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 bg-red-800 p-2 rounded-full">
               <ExclamationTriangleIcon className="w-6 h-6 text-red-300"/>
            </div>
            <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        <div className="mt-4 text-gray-300">
            {message}
        </div>
        <div className="mt-6 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 font-semibold rounded-md hover:bg-gray-700 transition">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} className={`px-4 py-2 font-semibold rounded-md transition ${confirmButtonClass}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
