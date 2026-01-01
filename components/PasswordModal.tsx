import React, { useState, useEffect } from 'react';
import Modal from './Modal.tsx';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPassword('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="text-white">
        <h2 className="text-2xl font-bold mb-4">Accès Éditeur</h2>
        <p className="text-gray-300 mb-4">Veuillez entrer le mot de passe pour continuer.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 w-full rounded bg-gray-700 text-white border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
        />
        <div className="mt-6 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded">Annuler</button>
          <button type="submit" className="px-4 py-2 bg-blue-600 rounded">Confirmer</button>
        </div>
      </form>
    </Modal>
  );
};

export default PasswordModal;
