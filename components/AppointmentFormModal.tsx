import React, { useState } from 'react';
import { Appointment, RepairTicket, RepairStatus, Commande } from '../types.ts';
import Modal from './Modal.tsx';
import { playTone } from '../utils/audio.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { calculateFutureDate } from '../utils/dateCalculator.ts';

interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'> | Appointment) => Promise<void>;
  appointmentToEdit?: Appointment | null;
  initialDate?: string; // YYYY-MM-DD
  ticket?: RepairTicket | null;
  commande?: Commande | null;
}

const AppointmentFormModal: React.FC<AppointmentFormModalProps> = ({ isOpen, onClose, onSave, appointmentToEdit, initialDate, ticket, commande }) => {
  const { showToast } = useToastContext();
  
  // Use lazy initialization for state
  const [formData, setFormData] = useState(() => {
    if (appointmentToEdit) {
      return {
        date: appointmentToEdit.date,
        time: appointmentToEdit.time,
        clientName: appointmentToEdit.clientName,
        clientPhone: appointmentToEdit.clientPhone,
        reason: appointmentToEdit.reason,
        notes: appointmentToEdit.notes || '',
        ticketId: appointmentToEdit.ticketId || '',
      };
    }
    if (commande) {
      return {
        date: initialDate || new Date().toISOString().split('T')[0],
        time: '10:00',
        clientName: commande.clientName || 'Client',
        clientPhone: commande.clientPhone || '',
        reason: 'Récupération' as Appointment['reason'],
        notes: `Commande de pièces #${commande.numero} - ${commande.macModel}. Pièces commandées suite au paiement de l'avance.`,
        ticketId: '',
      };
    }
    return {
      date: initialDate || new Date().toISOString().split('T')[0],
      time: '09:00',
      clientName: ticket?.client.name || '',
      clientPhone: ticket?.client.phone || '',
      reason: (ticket?.status === RepairStatus.TERMINE || ticket?.status === RepairStatus.RENDU) ? 'Récupération' : 'Diagnostic' as Appointment['reason'],
      notes: '',
      ticketId: ticket?.id || '',
    };
  });

  const [delayOption, setDelayOption] = useState('');

  const timeOptions = Array.from({ length: 20 }, (_, i) => {
      const hour = 8 + Math.floor((i*30)/60);
      const minute = (i*30) % 60;
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2,'0')}`
  });

  const handleCalculateDelay = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = e.target.value;
    setDelayOption(opt);
    if (!opt) return;

    const computedDate = calculateFutureDate(new Date(), opt);
    
    const yyyy = computedDate.getFullYear();
    const mm = String(computedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(computedDate.getDate()).padStart(2, '0');
    const dateString = `${yyyy}-${mm}-${dd}`;
    
    let minutesVal = Math.round(computedDate.getMinutes() / 30) * 30;
    let hrVal = computedDate.getHours();
    if (minutesVal >= 60) {
      minutesVal = 0;
      hrVal += 1;
    }
    const finalHr = String(hrVal).padStart(2, '0');
    const finalMin = String(minutesVal).padStart(2, '0');
    let timeString = `${finalHr}:${finalMin}`;
    
    if (!timeOptions.includes(timeString)) {
      timeString = '10:00'; 
    }

    setFormData(prev => ({
      ...prev,
      date: dateString,
      time: timeString
    }));
    
    showToast(`Rdv calculé : ${computedDate.toLocaleDateString('fr-FR')} à ${timeString}`, 'success');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        if (appointmentToEdit) {
          await onSave({ ...appointmentToEdit, ...formData });
        } else {
          await onSave(formData);
        }
        playTone(660, 150);
    } catch (error) {
        console.error("Failed to save appointment:", error);
        showToast("L'enregistrement a échoué.", "error");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-2xl font-bold">{appointmentToEdit ? 'Modifier' : 'Nouveau'} Rendez-vous</h2>
        
        {/* Calculateur de délai automatique */}
        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
          <label htmlFor="delay_calculator" className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Calculateur de rendez-vous automatique
          </label>
          <select
            id="delay_calculator"
            value={delayOption}
            onChange={handleCalculateDelay}
            className="w-full p-2 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 font-bold"
          >
            <option value="">-- Choisir un délai (Calcul automatique) --</option>
            <optgroup label="Réparation / Prestation (Hors dimanches & jours fériés)">
              <option value="30mn">30 Minutes</option>
              <option value="1h">1 Heure</option>
              <option value="2h">2 Heures</option>
              <option value="3h">3 Heures</option>
              <option value="4h">4 Heures</option>
              <option value="6h">6 Heures</option>
              <option value="24h">24 Heures (1 jour)</option>
              <option value="48h">48 Heures (2 jours)</option>
              <option value="72h">72 Heures (3 jours)</option>
              <option value="5 jours">5 Jours</option>
              <option value="7 jours">7 Jours</option>
              <option value="10 jours">10 Jours</option>
              <option value="15 jours">15 Jours</option>
              <option value="20 jours">20 Jours</option>
              <option value="30 jours">30 Jours</option>
            </optgroup>
            <optgroup label="Commande (5 jours sur 7 - Ouvrables uniquement)">
              <option value="15 jours ouvrables">15 Jours ouvrables</option>
              <option value="20 jours ouvrables">20 Jours ouvrables</option>
              <option value="25 jours ouvrables">25 Jours ouvrables</option>
            </optgroup>
          </select>
          <p className="text-[10px] text-gray-400 italic">
            Calcule automatiquement la date cible en excluant les jours non travaillés et fériés de Côte d'Ivoire.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                <input type="date" id="date" name="date" value={formData.date} onChange={handleChange} className="mt-1 w-full p-2 rounded bg-gray-100 dark:bg-gray-700" required />
            </div>
            <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Heure</label>
                <select id="time" name="time" value={formData.time} onChange={handleChange} className="mt-1 w-full p-2 rounded bg-gray-100 dark:bg-gray-700" required>
                    {timeOptions.map(time => <option key={time} value={time}>{time}</option>)}
                </select>
            </div>
        </div>
        
        <div>
            <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom du Client</label>
            <input type="text" id="clientName" name="clientName" value={formData.clientName} onChange={handleChange} className="mt-1 w-full p-2 rounded bg-gray-100 dark:bg-gray-700" required />
        </div>

        <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Motif</label>
            <select id="reason" name="reason" value={formData.reason} onChange={handleChange} className="mt-1 w-full p-2 rounded bg-gray-100 dark:bg-gray-700">
                <option>Récupération</option>
                <option>Dépôt</option>
                <option>Diagnostic</option>
                <option>Autre</option>
            </select>
        </div>
        
        <div>
            <label htmlFor="ticketId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fiche de réparation (ID)</label>
            <input type="text" id="ticketId" name="ticketId" value={formData.ticketId} onChange={handleChange} placeholder="Optionnel" className="mt-1 w-full p-2 rounded bg-gray-100 dark:bg-gray-700" />
        </div>
        
        <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={3} className="mt-1 w-full p-2 rounded bg-gray-100 dark:bg-gray-700"></textarea>
        </div>

        <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md">Annuler</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
};

export default AppointmentFormModal;