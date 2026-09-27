
import React, { useState } from 'react';
import Modal from './Modal.tsx';
import { RepairTicket } from '../types.ts';
import { generateWhatsAppMessage, generateSMSMessage, generateEmailLink } from '../services/notificationService.ts';
import { PhoneIcon, ChatBubbleLeftRightIcon, BellIcon } from './icons.tsx';
import { useToastContext } from '../context/ToastContext.tsx';
import { formatDisplayPhone, formatWhatsAppPhone } from '../utils/formatters.ts';
import { Phone } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: RepairTicket;
  onNotified: (type: string) => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose, ticket, onNotified }) => {
  const { showToast } = useToastContext();
  const [selectedType, setSelectedType] = useState<'ready' | 'quote' | 'update'>('ready');
  const [phoneOverride, setPhoneOverride] = useState<string>(ticket?.client?.phone || ticket?.clientPhone || '');

  if (!isOpen) return null;

  const currentPhone = phoneOverride || ticket?.client?.phone || ticket?.clientPhone || '';
  const formattedWA = formatWhatsAppPhone(currentPhone);
  const displayFormatted = formatDisplayPhone(currentPhone);

  const handleSend = (channel: 'whatsapp' | 'sms' | 'email') => {
    // Create a modified ticket with the updated phone if overridden
    const effectiveTicket: RepairTicket = {
      ...ticket,
      client: {
        ...ticket.client,
        phone: currentPhone,
      },
      clientPhone: currentPhone,
    };

    let url = '';
    if (channel === 'whatsapp') {
      if (!formattedWA) {
        showToast("Numéro WhatsApp invalide ou manquant", "error");
        return;
      }
      url = generateWhatsAppMessage(effectiveTicket, selectedType);
    } else if (channel === 'sms') {
      if (!formattedWA) {
        showToast("Numéro SMS invalide ou manquant", "error");
        return;
      }
      url = generateSMSMessage(effectiveTicket, selectedType);
    } else if (channel === 'email') {
      url = generateEmailLink(effectiveTicket);
      if (!effectiveTicket.client.email) {
        showToast("Ce client n'a pas d'adresse email enregistrée.", "error");
        return;
      }
    }
    
    if (url) {
      window.open(url, '_blank');
      showToast(`Notification ${channel.toUpperCase()} ouverte avec succès`, "success");
      onNotified(`${channel}-${selectedType}`);
      onClose();
    }
  };

  const types = [
    { id: 'ready', label: 'Appareil Prêt', desc: 'Informer que la machine est disponible et indiquer le solde à régler.' },
    { id: 'quote', label: 'Devis / Prix', desc: 'Envoyer le montant des réparations pour validation du client.' },
    { id: 'update', label: 'En cours', desc: 'Rassurer le client sur l\'avancement des travaux dans l\'atelier.' },
  ] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} containerClassName="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg m-4 p-0 overflow-hidden border border-gray-700">
      <div className="p-6 bg-gray-900/80 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white uppercase flex items-center gap-2.5">
                <BellIcon className="w-5 h-5 text-yellow-500" />
                Notifier le Client
            </h2>
            <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black rounded-lg uppercase">
              Fiche #{ticket.id}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-wider">
            {ticket.client.name} — {ticket.macModel}
          </p>
      </div>

      {/* Phone recipient review & override */}
      <div className="px-6 py-3.5 bg-emerald-950/20 border-b border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Destinataire WhatsApp / SMS</span>
            <span className="text-xs font-mono font-bold text-emerald-300">
              +{formattedWA || 'Numéro manquant'} {displayFormatted !== 'N/A' && `(${displayFormatted})`}
            </span>
          </div>
        </div>

        <input
          type="text"
          value={phoneOverride}
          onChange={(e) => setPhoneOverride(e.target.value)}
          placeholder="Modifier le numéro..."
          className="px-2.5 py-1 bg-gray-900 border border-emerald-500/30 rounded-lg text-xs font-mono text-white outline-none focus:border-emerald-400 w-full sm:w-40"
        />
      </div>
      
      <div className="p-6 space-y-5">
        {/* Sélecteur de message */}
        <div className="space-y-2.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">1. Objet du message</label>
            <div className="grid grid-cols-1 gap-2">
                {types.map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setSelectedType(t.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                            selectedType === t.id 
                            ? 'border-blue-500 bg-blue-600/15 ring-1 ring-blue-500/30' 
                            : 'border-gray-700 bg-gray-900/40 hover:border-gray-600'
                        }`}
                    >
                        <p className={`font-bold text-xs uppercase tracking-wide ${selectedType === t.id ? 'text-blue-400' : 'text-gray-200'}`}>{t.label}</p>
                        <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{t.desc}</p>
                    </button>
                ))}
            </div>
        </div>

        {/* Canaux d'envoi */}
        <div className="space-y-2.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">2. Envoyer via</label>
            <div className="grid grid-cols-3 gap-3">
                <button
                    onClick={() => handleSend('whatsapp')}
                    className="flex flex-col items-center gap-2 p-3.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 rounded-xl transition-all group"
                >
                    <div className="p-2 bg-emerald-600 rounded-lg group-hover:scale-110 transition-transform">
                        <PhoneIcon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase">WhatsApp</span>
                </button>

                <button
                    onClick={() => handleSend('sms')}
                    className="flex flex-col items-center gap-2 p-3.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 rounded-xl transition-all group"
                >
                    <div className="p-2 bg-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                        <ChatBubbleLeftRightIcon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-blue-400 uppercase">SMS Texte</span>
                </button>

                <button
                    onClick={() => handleSend('email')}
                    className="flex flex-col items-center gap-2 p-3.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 rounded-xl transition-all group"
                >
                    <div className="p-2 bg-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                        <BellIcon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase">Email</span>
                </button>
            </div>
        </div>
      </div>
      
      <div className="p-4 bg-gray-900/80 border-t border-gray-700/50 flex justify-end">
        <button onClick={onClose} className="px-5 py-2 text-xs font-black text-gray-400 uppercase hover:text-white transition-colors">
          Fermer
        </button>
      </div>
    </Modal>
  );
};

export default NotificationModal;

