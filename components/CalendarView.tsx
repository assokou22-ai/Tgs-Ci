import React, { useState, useMemo } from 'react';
import { RepairTicket } from '../types.ts';
import useHolidays from '../hooks/useHolidays.ts';
import { ArrowLeftIcon, ArrowRightIcon } from './icons.tsx';

interface CalendarViewProps {
  tickets: RepairTicket[];
  onSelectTicket: (ticket: RepairTicket) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ tickets, onSelectTicket }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const holidays = useHolidays(currentDate.getFullYear());

  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const startingDay = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday...
  const daysInMonth = lastDayOfMonth.getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  const ticketsByDate = useMemo(() => {
    const map = new Map<string, RepairTicket[]>();
    tickets.forEach(ticket => {
      const dateKey = new Date(ticket.createdAt).toISOString().split('T')[0];
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(ticket);
    });
    return map;
  }, [tickets]);

  const renderCalendar = () => {
    const calendarDays = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Add empty cells for days before the first day of the month
    // Adjust for week starting on Monday (getDay() returns 0 for Sunday)
    const startOffset = (startingDay === 0) ? 6 : startingDay - 1;
    for (let i = 0; i < startOffset; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="border-r border-b border-gray-700"></div>);
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateKey = date.toISOString().split('T')[0];
      const isToday = date.getTime() === today.getTime();
      const isHoliday = holidays.has(dateKey);
      
      const dayTickets = ticketsByDate.get(dateKey) || [];

      calendarDays.push(
        <div key={day} className={`p-2 border-r border-b border-gray-700 min-h-[120px] ${isHoliday ? 'bg-gray-700/50' : ''}`}>
          <div className={`text-sm font-semibold ${isToday ? 'bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-white' : ''}`}>
            {day}
          </div>
          <div className="mt-1 space-y-1">
            {dayTickets.map(ticket => (
              <div 
                key={ticket.id} 
                onClick={() => onSelectTicket(ticket)}
                className="text-xs p-1 bg-gray-700 rounded hover:bg-blue-600 cursor-pointer truncate"
                title={`${ticket.client.name} - ${ticket.macModel}`}
              >
                {ticket.client.name}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return calendarDays;
  };
  
  const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-700"><ArrowLeftIcon className="w-5 h-5"/></button>
        <h3 className="text-xl font-bold capitalize">
          {currentDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
        </h3>
        <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-700"><ArrowRightIcon className="w-5 h-5"/></button>
      </div>
      <div className="grid grid-cols-7">
        {weekdays.map(day => (
            <div key={day} className="text-center font-bold text-sm text-gray-400 py-2 border-b-2 border-gray-700">{day}</div>
        ))}
        {renderCalendar()}
      </div>
    </div>
  );
};

export default CalendarView;