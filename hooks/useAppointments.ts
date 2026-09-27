import { useState, useEffect, useCallback } from 'react';
import { Appointment } from '../types.ts';
import { dbGetAppointments, dbAddAppointment, dbUpdateAppointment, dbDeleteAppointment } from '../services/dbService.ts';
import { useToastContext } from '../context/ToastContext.tsx';
import { sanitizeAppointments } from '../utils/sanitize.ts';

const useAppointments = () => {
  const { showToast } = useToastContext();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    const storedAppointments = await dbGetAppointments();
    const sanitized = sanitizeAppointments(storedAppointments);
    setAppointments(sanitized.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchAppointments();
    };
    init();
    window.addEventListener('datareceived', fetchAppointments);
    return () => {
        window.removeEventListener('datareceived', fetchAppointments);
    };
  }, [fetchAppointments]);

  const addAppointment = useCallback(async (appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newAppointment: Appointment = {
      ...appointmentData,
      id: `appt-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    try {
        await dbAddAppointment(newAppointment);
        setAppointments(current => [...current, newAppointment].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
        console.error("Failed to add appointment:", error);
        showToast("L'ajout a échoué.", "error");
        throw error;
    }
  }, [showToast]);

  const updateAppointment = useCallback(async (appointment: Appointment) => {
    const updatedAppointment = { ...appointment, updatedAt: new Date().toISOString() };
    try {
        await dbUpdateAppointment(updatedAppointment);
        setAppointments(current =>
          current.map(a => (a.id === updatedAppointment.id ? updatedAppointment : a)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
    } catch (error) {
        console.error("Failed to update appointment:", error);
        showToast("La modification a échoué.", "error");
        throw error;
    }
  }, [showToast]);

  const deleteAppointment = useCallback(async (appointmentId: string) => {
    try {
        await dbDeleteAppointment(appointmentId);
        setAppointments(current => current.filter(a => a.id !== appointmentId));
    } catch (error) {
        console.error("Failed to delete appointment:", error);
        showToast("La suppression a échoué.", "error");
        throw error;
    }
  }, [showToast]);

  return { appointments, loading, addAppointment, updateAppointment, deleteAppointment };
};

export default useAppointments;