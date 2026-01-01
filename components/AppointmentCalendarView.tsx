import React, { useState, useMemo } from 'react';
import { Appointment, RepairTicket, RepairStatus } from '../types.ts';
import useAppointments from '../hooks/useAppointments.ts';
import { ArrowLeftIcon, ArrowRightIcon, TrashIcon, PencilIcon } from './icons.tsx';
import AppointmentFormModal from './AppointmentFormModal.tsx';

interface AppointmentCalendarViewProps {
  tickets: RepairTicket[];
}

const AppointmentCalendarView: React.FC<AppointmentCalendarViewProps> = ({ tickets }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { appointments, addAppointment, updateAppointment, deleteAppointment, loading } = useAppointments();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);


  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach(appt => {
      const dateKey = appt.date; // Assumes YYYY-MM-DD
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(appt);
    });
    // Sort appointments within each day by time
    for (const dayAppointments of map.values()) {
        dayAppointments.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [appointments]);

  const ticketsToSchedule = useMemo(() => {
    const scheduledTicketIds = new Set(appointments.map(a => a.ticketId).filter(Boolean));
    return tickets.filter(t => 
      (t.status === RepairStatus.DEVIS_APPROUVE || t.status === RepairStatus.TERMINE) &&
      !scheduledTicketIds.has(t.id)
    );
  }, [tickets, appointments]);

  const handleDayClick = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date.toISOString().split('T')[0]);
    setAppointmentToEdit(null);
    setSelectedTicket(null);
    setIsFormOpen(true);
  };
  
  const handleScheduleTicketClick = (ticket: RepairTicket) => {
      setSelectedTicket(ticket);
      setAppointmentToEdit(null);
      setSelectedDate(undefined);
      setIsFormOpen(true);
  };
  
  const handleEditAppointment = (appointment: Appointment) => {
      setAppointmentToEdit(appointment);
      setSelectedTicket(null);
      setSelectedDate(undefined);
      setIsFormOpen(true);
  }

  const handleDeleteAppointment = async (appointment: Appointment) => {
      if (window.confirm(`Supprimer le rendez-vous pour ${appointment.clientName} le ${new Date(appointment.date).toLocaleDateString('fr-FR')} ?`)) {
          try {
              await deleteAppointment(appointment.id);
          } catch (error) {
              console.error("Failed to delete appointment:", error);
          }
      }
  };

  const handleSaveAppointment = async (appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'> | Appointment) => {
      try {
          if ('id' in appointmentData) { // Editing an existing appointment
              await updateAppointment(appointmentData);
          } else { // Creating a new appointment
              await addAppointment(appointmentData);
          }
          setIsFormOpen(false);
      } catch (error) {
          console.error("Failed to save appointment:", error);
      }
  };
  
  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const renderCalendar = () => {
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startingDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const calendarDays = [];
    const startOffset = (startingDay === 0) ? 6 : startingDay - 1;
    for (let i = 0; i < startOffset; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="border-r border-b border-gray-700"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateKey = date.toISOString().split('T')[0];
      const isToday = date.getTime() === today.getTime();
      const dayAppointments = appointmentsByDate.get(dateKey) || [];

      calendarDays.push(
        <div key={day} onClick={() => handleDayClick(day)} className="p-2 border-r border-b border-gray-700 min-h-[120px] hover:bg-gray-700/50 cursor-pointer transition-colors relative flex flex-col">
          <div className={`text-sm font-semibold mb-1 ${isToday ? 'bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-white' : ''}`}>
            {day}
          </div>
          <div className="space-y-1 flex-grow overflow-y-auto">
            {dayAppointments.map(appt => (
              <div key={appt.id} className="text-xs p-1.5 bg-gray-700 rounded group relative">
                <div className="flex items-center gap-1">
                    <p className="font-bold truncate">{appt.time} - {appt.clientName}</p>
                </div>
                <p className="text-gray-400 truncate">{appt.reason} {appt.ticketId && `(${appt.ticketId})`}</p>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-600 rounded">
                    <button onClick={(e) => { e.stopPropagation(); handleEditAppointment(appt);}} className="p-0.5 hover:bg-gray-500 rounded"><PencilIcon className="w-3 h-3"/></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteAppointment(appt);}} className="p-0.5 hover:bg-gray-500 rounded"><TrashIcon className="w-3 h-3 text-red-500"/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return calendarDays;
  };
  
  if (loading) return <div>Chargement des rendez-vous...</div>;

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-150px)]">
        <div className="flex-grow bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-700"><ArrowLeftIcon className="w-5 h-5"/></button>
                    <h3 className="text-xl font-bold capitalize text-center w-48">
                        {currentDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-700"><ArrowRightIcon className="w-5 h-5"/></button>
                </div>
            </div>
            <div className="grid grid-cols-7 flex-grow">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                    <div key={day} className="text-center font-bold text-sm text-gray-400 py-2 border-b-2 border-gray-700">{day}</div>
                ))}
                {renderCalendar()}
            </div>
        </div>
        <aside className="w-full md:w-72 flex-shrink-0">
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg h-full">
                <h3 className="text-lg font-bold mb-3">Fiches à planifier</h3>
                {ticketsToSchedule.length > 0 ? (
                    <ul className="space-y-2 h-[calc(100%-40px)] overflow-y-auto">
                       {ticketsToSchedule.map(ticket => (
                           <li key={ticket.id} onClick={() => handleScheduleTicketClick(ticket)} className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 cursor-pointer">
                               <p className="font-semibold text-sm">{ticket.client.name}</p>
                               <p className="text-xs text-gray-400">{ticket.id} - {ticket.status}</p>
                           </li>
                       ))}
                    </ul>
                ) : (
                    <p className="text-sm text-gray-500 text-center py-4">Aucune fiche en attente de planification.</p>
                )}
            </div>
        </aside>

        <AppointmentFormModal 
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSave={handleSaveAppointment}
            appointmentToEdit={appointmentToEdit}
            initialDate={selectedDate}
            ticket={selectedTicket}
        />
    </div>
  );
};

export default AppointmentCalendarView;