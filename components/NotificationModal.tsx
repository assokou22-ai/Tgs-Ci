
import React, { useState } from 'react';
import Modal from './Modal.tsx';
import { RepairTicket } from '../types.ts';
import { generateWhatsAppMessage, generateSMSMessage, generateEmailLink } from '../services/notificationService.ts';
import { PhoneIcon, ChatBubbleLeftRightIcon, BellIcon } from './icons.tsx';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: RepairTicket;
  onNotified: (type: string) => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose, ticket, onNotified }) => {
  const [selectedType, setSelectedType] = useState<'ready' | 'quote' | 'update'>('ready');

  if (!isOpen) return null;

  const handleSend = (channel: 'whatsapp' | 'sms' | 'email') => {
    let url = '';
    if (channel === 'whatsapp') url = generateWhatsAppMessage(ticket, selectedType);
    else if (channel === 'sms') url = generateSMSMessage(ticket, selectedType);
    else if (channel === 'email') {
        url = generateEmailLink(ticket);
        if (!ticket.client.email) {
            alert("Ce client n'a pas d'adresse email enregistrée.");
            return;
        }
    }
    
    if (url) {
        window.open(url, '_blank');
        onNotified(`${channel}-${selectedType}`);
        onClose();
    }
  };

  const types = [
    { id: 'ready', label: 'Appareil Prêt', desc: 'Informer que la machine est disponible et indiquer le solde.' },
    { id: 'quote', label: 'Devis / Prix', desc: 'Envoyer le montant des réparations pour accord.' },
    { id: 'update', label: 'En cours', desc: 'Rassurer le client sur l\'avancement des travaux.' },
  ] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} containerClassName="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg m-4 p-0 overflow-hidden border border-gray-700">
      <div className="p-6 bg-gray-900/50 border-b border-gray-700">
          <h2 className="text-xl font-black text-white uppercase flex items-center gap-3">
              <BellIcon className="w-6 h-6 text-yellow-500" />
              Notifier le Client
          </h2>
          <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-wider">
            Dossier {ticket.id} — {ticket.client.name}
          </p>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Sélecteur de message */}
        <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">1. Choisir l'objet du message</label>
            <div className="grid grid-cols-1 gap-2">
                {types.map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setSelectedType(t.id)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                            selectedType === t.id 
                            ? 'border-blue-500 bg-blue-600/10' 
                            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                        }`}
                    >
                        <p className={`font-bold text-sm ${selectedType === t.id ? 'text-blue-400' : 'text-gray-200'}`}>{t.label}</p>
                        <p className="text-[10px] text-gray-500 italic leading-tight">{t.desc}</p>
                    </button>
                ))}
            </div>
        </div>

        {/* Canaux d'envoi */}
        <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">2. Envoyer via</label>
            <div className="grid grid-cols-3 gap-3">
                <button
                    onClick={() => handleSend('whatsapp')}
                    className="flex flex-col items-center gap-2 p-4 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 rounded-xl transition-all group"
                >
                    <div className="p-2 bg-green-600 rounded-lg group-hover:scale-110 transition-transform">
                        <PhoneIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-green-400 uppercase">WhatsApp</span>
                </button>

                <button
                    onClick={() => handleSend('sms')}
                    className="flex flex-col items-center gap-2 p-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 rounded-xl transition-all group"
                >
                    <div className="p-2 bg-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                        <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-blue-400 uppercase">SMS Texte</span>
                </button>

                <button
                    onClick={() => handleSend('email')}
                    className="flex flex-col items-center gap-2 p-4 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-600/50 rounded-xl transition-all group"
                >
                    <div className="p-2 bg-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                        <BellIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase">Email</span>
                </button>
            </div>
        </div>
      </div>
      
      <div className="p-4 bg-gray-900/50 flex justify-end">
        <button onClick={onClose} className="px-6 py-2 text-xs font-black text-gray-500 uppercase hover:text-white transition-colors">
          Fermer
        </button>
      </div>
    </Modal>
  );
};

export default NotificationModal;
