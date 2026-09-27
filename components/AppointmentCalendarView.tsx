import React, { useState, useMemo, useCallback } from 'react';
import { Appointment, RepairTicket, RepairStatus, Commande } from '../types.ts';
import useAppointments from '../hooks/useAppointments.ts';
import useCommandes from '../hooks/useCommandes.ts';
import { ArrowLeftIcon, ArrowRightIcon, TrashIcon, WrenchScrewdriverIcon, ShoppingCartIcon } from './icons.tsx';
import AppointmentFormModal from './AppointmentFormModal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';

interface AppointmentCalendarViewProps {
  tickets: RepairTicket[];
}

const AppointmentCalendarView: React.FC<AppointmentCalendarViewProps> = ({ tickets }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [sidebarTab, setSidebarTab] = useState<'tickets' | 'commandes'>('tickets');
  const [statusFilter, setStatusFilter] = useState<'all' | 'reparation' | 'commande'>('all');

  const [selectedRepairStatuses, setSelectedRepairStatuses] = useState<RepairStatus[]>([
    RepairStatus.REPARATION_EN_COURS,
    RepairStatus.DIAGNOSTIC_EN_COURS,
    RepairStatus.A_DIAGNOSTIQUER,
    RepairStatus.DEVIS_APPROUVE,
    RepairStatus.EN_ATTENTE_DE_PIECES,
    RepairStatus.TESTS_EN_COURS,
    RepairStatus.TERMINE
  ]);
  
  const [selectedCommandeStatuses, setSelectedCommandeStatuses] = useState<string[]>([
    'Commandé', 'Reçu', 'Payé'
  ]);

  const toggleRepairStatus = useCallback((status: RepairStatus) => {
    setSelectedRepairStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  }, []);

  const toggleCommandeStatus = useCallback((status: string) => {
    setSelectedCommandeStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  }, []);

  const selectAllRepairs = useCallback(() => {
    setSelectedRepairStatuses(Object.values(RepairStatus));
  }, []);

  const deselectAllRepairs = useCallback(() => {
    setSelectedRepairStatuses([]);
  }, []);

  const selectAllCommandes = useCallback(() => {
    setSelectedCommandeStatuses(['Brouillon', 'Commandé', 'Reçu', 'Payé', 'Annulé']);
  }, []);

  const deselectAllCommandes = useCallback(() => {
    setSelectedCommandeStatuses([]);
  }, []);
  
  const { appointments, addAppointment, updateAppointment, deleteAppointment, loading: appointmentsLoading } = useAppointments();
  const { commandes, loading: commandesLoading } = useCommandes();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
  const [selectedCommande, setSelectedCommande] = useState<Commande | null>(null);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);

  // Helper to determine appointment source type, status and styles
  const getAppointmentDetails = useCallback((appt: Appointment) => {
    let type: 'reparation' | 'commande' | 'other' = 'other';
    let statusText = '';
    let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700/50';
    let cardGlow = 'border-white/5 bg-white/5 hover:bg-white/10';

    if (appt.ticketId) {
      const ticket = tickets.find(t => t.id === appt.ticketId);
      if (ticket) {
        type = 'reparation';
        statusText = ticket.status;
        if (ticket.status === RepairStatus.REPARATION_EN_COURS) {
          badgeColor = 'bg-blue-950/40 text-blue-400 border-blue-900/30';
          cardGlow = 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.15)]';
        } else {
          badgeColor = 'bg-zinc-800 text-zinc-400 border-zinc-700/50';
          cardGlow = 'border-zinc-500/20 bg-zinc-500/5 hover:bg-zinc-500/10';
        }
      }
    } else {
      const cmdMatch = appt.notes?.match(/Commande de pièces #(\S+)/);
      const cmdNumero = cmdMatch ? cmdMatch[1] : null;
      const cmd = cmdNumero ? commandes.find(c => c.numero === cmdNumero) : null;
      if (cmd || appt.notes?.toLowerCase().includes('commande de pièces')) {
        type = 'commande';
        const finalCmd = cmd || commandes.find(c => c.clientPhone === appt.clientPhone || c.clientName === appt.clientName);
        statusText = finalCmd ? finalCmd.status : 'Commandé';
        if (finalCmd && (finalCmd.status === 'Commandé' || finalCmd.status === 'Payé')) {
          badgeColor = 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30';
          cardGlow = 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]';
        } else {
          badgeColor = 'bg-purple-950/40 text-purple-400 border-purple-900/30';
          cardGlow = 'border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10';
        }
      }
    }

    return { type, statusText, badgeColor, cardGlow };
  }, [tickets, commandes]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(appt => {
      const { type, statusText } = getAppointmentDetails(appt);
      
      if (statusFilter === 'reparation') {
        if (type !== 'reparation') return false;
        return selectedRepairStatuses.includes(statusText as RepairStatus);
      }
      
      if (statusFilter === 'commande') {
        if (type !== 'commande') return false;
        return selectedCommandeStatuses.includes(statusText);
      }
      
      // statusFilter === 'all'
      if (type === 'reparation') {
        return selectedRepairStatuses.includes(statusText as RepairStatus);
      }
      if (type === 'commande') {
        return selectedCommandeStatuses.includes(statusText);
      }
      
      return true; // Keep other/untyped appointments
    });
  }, [appointments, statusFilter, getAppointmentDetails, selectedRepairStatuses, selectedCommandeStatuses]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    filteredAppointments.forEach(appt => {
      const dateKey = appt.date; // YYYY-MM-DD
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
  }, [filteredAppointments]);

  // Fiches à planifier (statut DEVIS_APPROUVE ou TERMINE)
  const ticketsToSchedule = useMemo(() => {
    const scheduledTicketIds = new Set(appointments.map(a => a.ticketId).filter(Boolean));
    return tickets.filter(t => 
      (t.status === RepairStatus.DEVIS_APPROUVE || t.status === RepairStatus.TERMINE) &&
      !scheduledTicketIds.has(t.id)
    );
  }, [tickets, appointments]);

  // Commandes clients à planifier (une fois que l'avance a été payée)
  const commandesToSchedule = useMemo(() => {
    // Only direct client orders (isRevenue is true), with an advance > 0 and status is not cancelled or drafted
    return commandes.filter(cmd => 
      cmd.isRevenue && 
      cmd.advance > 0 && 
      cmd.status !== 'Brouillon' && 
      cmd.status !== 'Annulé'
    );
  }, [commandes]);

  const handleDayClick = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date.toISOString().split('T')[0]);
    setAppointmentToEdit(null);
    setSelectedTicket(null);
    setSelectedCommande(null);
    setIsFormOpen(true);
  };
  
  const handleScheduleTicketClick = (ticket: RepairTicket) => {
      setSelectedTicket(ticket);
      setSelectedCommande(null);
      setAppointmentToEdit(null);
      setSelectedDate(undefined);
      setIsFormOpen(true);
  };

  const handleScheduleCommandeClick = (commande: Commande) => {
      setSelectedCommande(commande);
      setSelectedTicket(null);
      setAppointmentToEdit(null);
      setSelectedDate(undefined);
      setIsFormOpen(true);
  };
  
  const handleEditAppointment = (appointment: Appointment) => {
      setAppointmentToEdit(appointment);
      setSelectedTicket(null);
      setSelectedCommande(null);
      setSelectedDate(undefined);
      setIsFormOpen(true);
  }

  const handleDeleteAppointment = (appointment: Appointment) => {
      setAppointmentToDelete(appointment);
  };

  const confirmDeleteAppointment = async () => {
      if (appointmentToDelete) {
          try {
              await deleteAppointment(appointmentToDelete.id);
          } catch (error) {
              console.error("Failed to delete appointment:", error);
          }
          setAppointmentToDelete(null);
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
  
  // Navigation controls
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(currentDate.getDate() - 7);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(currentDate.getDate() + 7);
      setCurrentDate(d);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const renderCalendar = () => {
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startingDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const calendarDays = [];
    // Adjust start offset for Monday start
    const startOffset = (startingDay === 0) ? 6 : startingDay - 1;
    for (let i = 0; i < startOffset; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="border-r border-b border-white/5 bg-black/10"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateKey = date.toISOString().split('T')[0];
      const isToday = date.getTime() === today.getTime();
      const dayAppointments = appointmentsByDate.get(dateKey) || [];

      calendarDays.push(
        <div 
          key={day} 
          onClick={() => handleDayClick(day)} 
          className="p-2 border-r border-b border-white/5 min-h-[110px] hover:bg-white/5 cursor-pointer transition-colors relative flex flex-col group/day"
        >
          <div className="flex justify-between items-center mb-1">
            <span className={`text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full ${
              isToday ? 'bg-blue-600 text-white font-extrabold shadow-md shadow-blue-900/30' : 'text-slate-400'
            }`}>
              {day}
            </span>
            <span className="text-[8px] font-black text-slate-600 opacity-0 group-hover/day:opacity-100 transition-opacity">
              + RDV
            </span>
          </div>
          <div className="space-y-1 flex-grow overflow-y-auto no-scrollbar max-h-[70px]">
            {dayAppointments.map(appt => {
              const { type, cardGlow } = getAppointmentDetails(appt);
              return (
                <div 
                  key={appt.id} 
                  onClick={(e) => { e.stopPropagation(); handleEditAppointment(appt); }}
                  className={`text-[9px] p-1 border rounded-lg group relative transition-all ${cardGlow}`}
                >
                  <div className="flex justify-between items-center font-black text-slate-300">
                    <div className="flex items-center gap-0.5">
                      {type === 'reparation' && <WrenchScrewdriverIcon className="w-2 h-2 text-blue-400 shrink-0 animate-pulse" />}
                      {type === 'commande' && <ShoppingCartIcon className="w-2 h-2 text-emerald-400 shrink-0 animate-pulse" />}
                      <span className="text-blue-400 font-mono text-[8px]">{appt.time}</span>
                    </div>
                    <span className="truncate max-w-[60px] text-[8px]">{appt.clientName}</span>
                  </div>
                  <p className="text-slate-500 truncate text-[8px] mt-0.5">{appt.reason}</p>
                  <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-white/10 rounded px-1 flex gap-0.5">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteAppointment(appt); }} 
                      className="p-0.5 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <TrashIcon className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return calendarDays;
  };

  const renderWeekCalendar = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Get Monday of the week containing currentDate
    const startOfWeek = new Date(currentDate);
    const dayIndex = startOfWeek.getDay();
    const diffToMonday = startOfWeek.getDate() - dayIndex + (dayIndex === 0 ? -6 : 1);
    startOfWeek.setDate(diffToMonday);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      const isToday = date.getTime() === today.getTime();
      const dayAppointments = appointmentsByDate.get(dateKey) || [];
      const dayNum = date.getDate();
      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short' });

      weekDays.push(
        <div 
          key={i} 
          onClick={() => {
            setSelectedDate(dateKey);
            setAppointmentToEdit(null);
            setSelectedTicket(null);
            setSelectedCommande(null);
            setIsFormOpen(true);
          }} 
          className="p-3 border-r border-b border-white/5 min-h-[320px] hover:bg-white/5 cursor-pointer transition-colors relative flex flex-col group/week"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black uppercase text-slate-500">
              {date.toLocaleDateString('fr-FR', { weekday: 'short' })}
            </span>
            <div className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full ${
              isToday ? 'bg-blue-600 text-white font-extrabold shadow-md' : 'text-slate-300'
            }`}>
              {dayNum}
            </div>
          </div>
          <span className="text-[8px] font-bold text-slate-600 uppercase mb-3 block">{monthLabel}</span>
          
          <div className="space-y-2 flex-grow overflow-y-auto no-scrollbar">
            {dayAppointments.length > 0 ? dayAppointments.map(appt => {
              const { type, cardGlow } = getAppointmentDetails(appt);
              return (
                <div 
                  key={appt.id} 
                  onClick={(e) => { e.stopPropagation(); handleEditAppointment(appt); }}
                  className={`text-xs p-2 border rounded-xl group relative transition-all ${cardGlow}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {type === 'reparation' && <WrenchScrewdriverIcon className="w-3.5 h-3.5 text-blue-400 shrink-0 animate-pulse" />}
                      {type === 'commande' && <ShoppingCartIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />}
                      <p className="font-mono text-[9px] font-black text-blue-400">{appt.time}</p>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold truncate max-w-[80px]">{appt.clientName}</p>
                  </div>
                  <p className="text-[10px] text-slate-300 font-bold truncate mt-1">{appt.reason}</p>
                  {appt.notes && (
                    <p className="text-[8px] text-slate-500 truncate mt-0.5">{appt.notes}</p>
                  )}
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-white/10 rounded-lg p-0.5 flex gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteAppointment(appt); }} 
                      className="p-1 hover:bg-gray-800 rounded text-red-400 hover:text-red-300 transition-colors"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div className="h-full flex items-center justify-center opacity-30">
                <span className="text-[8px] font-black tracking-widest text-slate-600 uppercase">Aucun RDV</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return weekDays;
  };
  
  if (appointmentsLoading || commandesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-160px)] animate-fade-in">
        {/* Main Calendar Space */}
        <div className="flex-grow bg-slate-900 border border-white/5 p-4 rounded-3xl flex flex-col min-w-0">
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2 flex-wrap">
                    <button 
                      onClick={handlePrev} 
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/5"
                    >
                      <ArrowLeftIcon className="w-4 h-4"/>
                    </button>
                    
                    <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-center w-48 text-white">
                        {viewMode === 'month' 
                          ? currentDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
                          : `Semaine du ${(() => {
                              const start = new Date(currentDate);
                              const day = start.getDay();
                              const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                              start.setDate(diff);
                              return start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                            })()}`
                        }
                    </h3>
                    
                    <button 
                      onClick={handleNext} 
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/5"
                    >
                      <ArrowRightIcon className="w-4 h-4"/>
                    </button>
                    
                    <button 
                      onClick={handleToday} 
                      className="ml-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all border border-white/5"
                    >
                      Aujourd'hui
                    </button>
                </div>

                {/* Status Filter buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button 
                      onClick={() => setStatusFilter('all')} 
                      className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border ${
                        statusFilter === 'all' 
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg' 
                          : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      Tous ({appointments.length})
                    </button>
                    <button 
                      onClick={() => setStatusFilter('reparation')} 
                      className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border flex items-center gap-1.5 ${
                        statusFilter === 'reparation' 
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30' 
                          : 'bg-blue-500/5 border-blue-500/10 text-blue-400 hover:text-white hover:bg-blue-500/10'
                      }`}
                    >
                      <WrenchScrewdriverIcon className="w-3.5 h-3.5 text-blue-400" />
                      Réparations
                    </button>
                    <button 
                      onClick={() => setStatusFilter('commande')} 
                      className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border flex items-center gap-1.5 ${
                        statusFilter === 'commande' 
                          ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/30' 
                          : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400 hover:text-white hover:bg-emerald-500/10'
                      }`}
                    >
                      <ShoppingCartIcon className="w-3.5 h-3.5 text-emerald-400" />
                      Commandes de pièces
                    </button>
                </div>

                {/* View Switcher: Month / Week */}
                <div className="flex items-center bg-black/40 border border-white/5 p-1 rounded-2xl">
                    <button 
                      onClick={() => setViewMode('month')} 
                      className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                        viewMode === 'month' 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Mois
                    </button>
                    <button 
                      onClick={() => setViewMode('week')} 
                      className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                        viewMode === 'week' 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Semaine
                    </button>
                </div>
            </div>

            {/* Sub-status Quick Filters Panel */}
            <div className="mb-4 p-3 bg-white/[0.01] border border-white/5 rounded-2xl space-y-3">
              {(statusFilter === 'all' || statusFilter === 'reparation') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <WrenchScrewdriverIcon className="w-3.5 h-3.5 text-blue-400" />
                      Statuts de réparation :
                    </span>
                    <div className="flex gap-2">
                      <button onClick={selectAllRepairs} className="hover:text-blue-400 transition-colors text-[9px] lowercase font-normal">Tout cocher</button>
                      <span className="opacity-30">•</span>
                      <button onClick={deselectAllRepairs} className="hover:text-blue-400 transition-colors text-[9px] lowercase font-normal">Tout décocher</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.values(RepairStatus).map((status) => {
                      const isSelected = selectedRepairStatuses.includes(status);
                      return (
                        <button
                          key={status}
                          onClick={() => toggleRepairStatus(status)}
                          className={`px-2 py-1 text-[9px] font-medium rounded-lg transition-all border ${
                            isSelected
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 font-bold shadow-[0_0_8px_rgba(59,130,246,0.1)]'
                              : 'bg-transparent border-white/5 text-slate-500 hover:text-slate-400 hover:bg-white/[0.02]'
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {statusFilter === 'all' && <div className="border-t border-white/5 my-1"></div>}

              {(statusFilter === 'all' || statusFilter === 'commande') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <ShoppingCartIcon className="w-3.5 h-3.5 text-emerald-400" />
                      Statuts de commandes :
                    </span>
                    <div className="flex gap-2">
                      <button onClick={selectAllCommandes} className="hover:text-emerald-400 transition-colors text-[9px] lowercase font-normal">Tout cocher</button>
                      <span className="opacity-30">•</span>
                      <button onClick={deselectAllCommandes} className="hover:text-emerald-400 transition-colors text-[9px] lowercase font-normal">Tout décocher</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['Brouillon', 'Commandé', 'Reçu', 'Payé', 'Annulé'].map((status) => {
                      const isSelected = selectedCommandeStatuses.includes(status);
                      return (
                        <button
                          key={status}
                          onClick={() => toggleCommandeStatus(status)}
                          className={`px-2 py-1 text-[9px] font-medium rounded-lg transition-all border ${
                            isSelected
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold shadow-[0_0_8px_rgba(16,185,129,0.1)]'
                              : 'bg-transparent border-white/5 text-slate-500 hover:text-slate-400 hover:bg-white/[0.02]'
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Calendar Grid */}
            <div className="flex-grow flex flex-col min-h-0 bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-white/5 bg-black/40">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                        <div key={day} className="text-center font-black text-[9px] text-slate-400 uppercase tracking-widest py-3">
                          {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 flex-grow overflow-y-auto no-scrollbar">
                    {viewMode === 'month' ? renderCalendar() : renderWeekCalendar()}
                </div>
            </div>
        </div>

        {/* Sidebar Space */}
        <aside className="w-full lg:w-80 flex-shrink-0 flex flex-col bg-slate-900 border border-white/5 rounded-3xl p-4">
            {/* Sidebar Tabs */}
            <div className="grid grid-cols-2 bg-black/40 border border-white/5 p-1 rounded-2xl mb-4">
                <button 
                  onClick={() => setSidebarTab('tickets')}
                  className={`py-2 px-1 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    sidebarTab === 'tickets' 
                      ? 'bg-white/5 text-white' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Fiches ({ticketsToSchedule.length})
                </button>
                <button 
                  onClick={() => setSidebarTab('commandes')}
                  className={`py-2 px-1 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    sidebarTab === 'commandes' 
                      ? 'bg-white/5 text-white' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Commandes ({commandesToSchedule.length})
                </button>
            </div>

            <div className="flex-grow overflow-y-auto no-scrollbar space-y-3">
                {sidebarTab === 'tickets' ? (
                  <>
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Fiches Prêtes à Planifier</h4>
                    {ticketsToSchedule.length > 0 ? (
                        <div className="space-y-2">
                           {ticketsToSchedule.map(ticket => (
                               <div 
                                 key={ticket.id} 
                                 onClick={() => handleScheduleTicketClick(ticket)} 
                                 className="p-3 bg-white/5 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/20 rounded-2xl cursor-pointer transition-all"
                               >
                                   <div className="flex justify-between items-start mb-1">
                                       <p className="font-black text-xs text-white truncate max-w-[150px]">{ticket.client?.name}</p>
                                       <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{ticket.id}</span>
                                   </div>
                                   <p className="text-[9px] text-slate-400 font-semibold">{ticket.macModel}</p>
                                   <div className="flex justify-between items-center mt-2 pt-1 border-t border-white/5">
                                       <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-950/40 text-blue-400 font-bold border border-blue-900/30 uppercase tracking-widest">
                                           {ticket.status}
                                       </span>
                                   </div>
                               </div>
                           ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Aucune fiche à planifier</span>
                        </div>
                    )}
                  </>
                ) : (
                  <>
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Commandes Clients avec Avance Payée</h4>
                    {commandesToSchedule.length > 0 ? (
                        <div className="space-y-2">
                           {commandesToSchedule.map(cmd => (
                               <div 
                                 key={cmd.id} 
                                 onClick={() => handleScheduleCommandeClick(cmd)} 
                                 className="p-3 bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/20 rounded-2xl cursor-pointer transition-all"
                               >
                                   <div className="flex justify-between items-start mb-1">
                                       <p className="font-black text-xs text-white truncate max-w-[150px]">{cmd.clientName || 'Client'}</p>
                                       <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">#{cmd.numero}</span>
                                   </div>
                                   <p className="text-[9px] text-slate-400 font-semibold">{cmd.macModel}</p>
                                   <div className="flex justify-between items-center mt-2 pt-1 border-t border-white/5">
                                       <span className="text-[8px] text-slate-500 font-bold">
                                           Avance : <span className="font-mono text-emerald-400 font-bold">{cmd.advance.toLocaleString('fr-FR')} CFA</span>
                                       </span>
                                       <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 font-bold border border-emerald-900/30 uppercase tracking-widest">
                                           {cmd.status}
                                       </span>
                                   </div>
                               </div>
                           ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Aucune commande payée</span>
                        </div>
                    )}
                  </>
                )}
            </div>
        </aside>

        {/* Appointment Form Modal */}
        <AppointmentFormModal 
            key={isFormOpen ? `appt-form-${appointmentToEdit?.id || selectedTicket?.id || selectedCommande?.id || 'new'}-${selectedDate || ''}` : 'closed'}
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSave={handleSaveAppointment}
            appointmentToEdit={appointmentToEdit}
            initialDate={selectedDate}
            ticket={selectedTicket}
            commande={selectedCommande}
        />

        {/* Confirmation Modal */}
        <ConfirmationModal
            isOpen={!!appointmentToDelete}
            onClose={() => setAppointmentToDelete(null)}
            onConfirm={confirmDeleteAppointment}
            title="Supprimer le rendez-vous ?"
            message={`Voulez-vous vraiment supprimer le rendez-vous pour ${appointmentToDelete?.clientName} le ${appointmentToDelete ? new Date(appointmentToDelete.date).toLocaleDateString('fr-FR') : ''} ?`}
            confirmText="Supprimer"
        />
    </div>
  );
};

export default AppointmentCalendarView;
