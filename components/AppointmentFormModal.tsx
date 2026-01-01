import React, { useState, useEffect } from 'react';
import { Appointment, RepairTicket, RepairStatus } from '../types.ts';
import Modal from './Modal.tsx';
import { playTone } from '../utils/audio.ts';

interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'> | Appointment) => Promise<void>;
  appointmentToEdit?: Appointment | null;
  initialDate?: string; // YYYY-MM-DD
  ticket?: RepairTicket | null;
}

const AppointmentFormModal: React.FC<AppointmentFormModalProps> = ({ isOpen, onClose, onSave, appointmentToEdit, initialDate, ticket }) => {
  const [formData, setFormData] = useState({
    date: initialDate || new Date().toISOString().split('T')[0],
    time: '09:00',
    clientName: '',
    clientPhone: '',
    reason: 'Récupération' as Appointment['reason'],
    notes: '',
    ticketId: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (appointmentToEdit) {
        setFormData({
          date: appointmentToEdit.date,
          time: appointmentToEdit.time,
          clientName: appointmentToEdit.clientName,
          clientPhone: appointmentToEdit.clientPhone,
          reason: appointmentToEdit.reason,
          notes: appointmentToEdit.notes || '',
          ticketId: appointmentToEdit.ticketId || '',
        });
      } else {
        setFormData({
          date: initialDate || new Date().toISOString().split('T')[0],
          time: '09:00',
          clientName: ticket?.client.name || '',
          clientPhone: ticket?.client.phone || '',
          reason: (ticket?.status === RepairStatus.TERMINE || ticket?.status === RepairStatus.RENDU) ? 'Récupération' : 'Diagnostic',
          notes: '',
          ticketId: ticket?.id || '',
        });
      }
    }
  }, [isOpen, appointmentToEdit, initialDate, ticket]);

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
        alert("L'enregistrement a échoué. Veuillez vérifier la console pour plus de détails.");
    }
  };

  const timeOptions = Array.from({ length: 20 }, (_, i) => {
      const hour = 8 + Math.floor((i*30)/60);
      const minute = (i*30) % 60;
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2,'0')}`
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-2xl font-bold">{appointmentToEdit ? 'Modifier' : 'Nouveau'} Rendez-vous</h2>
        
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