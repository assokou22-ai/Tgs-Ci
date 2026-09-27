import { useState, useEffect, useMemo, useCallback } from 'react';
import { RepairTicket, Appointment, EngagementSav } from '../types.ts';
import { 
    calculateAllReminders, 
    formatDateKey, 
    getCompletedActionIds, 
    markActionStatusInStorage,
    DailyActionsResult 
} from '../services/reminderService.ts';
import { dbGetEngagementsSav } from '../services/dbService.ts';

export const useDailyActions = (
    tickets: RepairTicket[] = [],
    appointments: Appointment[] = []
) => {
    const [selectedDate, setSelectedDate] = useState<string>(() => formatDateKey(new Date()));
    const [engagements, setEngagements] = useState<EngagementSav[]>([]);
    const [completedIds, setCompletedIds] = useState<Record<string, string>>(() => getCompletedActionIds());
    const [filterCategory, setFilterCategory] = useState<'ALL' | 'TODO' | 'DONE' | 'OVERDUE'>('ALL');

    // Load Engagements SAV for full coverage
    const loadEngagements = useCallback(async () => {
        try {
            const data = await dbGetEngagementsSav();
            setEngagements(data || []);
        } catch (e) {
            console.error("Failed to load engagements in useDailyActions:", e);
        }
    }, []);

    useEffect(() => {
        loadEngagements();
    }, [loadEngagements]);

    // Listen for custom events when action status changes
    useEffect(() => {
        const handleActionChange = () => {
            setCompletedIds(getCompletedActionIds());
        };
        window.addEventListener('dailyactionschanged', handleActionChange);
        window.addEventListener('datachanged', loadEngagements);
        return () => {
            window.removeEventListener('dailyactionschanged', handleActionChange);
            window.removeEventListener('datachanged', loadEngagements);
        };
    }, [loadEngagements]);

    // Recalculate reminders whenever inputs change
    const results: DailyActionsResult = useMemo(() => {
        return calculateAllReminders(tickets, appointments, engagements, selectedDate, completedIds);
    }, [tickets, appointments, engagements, selectedDate, completedIds]);

    const toggleActionStatus = useCallback((actionId: string, currentStatus: string) => {
        const isNowDone = currentStatus !== 'FAIT';
        const updated = markActionStatusInStorage(actionId, isNowDone);
        setCompletedIds({ ...updated });
    }, []);

    const markAllTodayDone = useCallback(() => {
        results.actions.forEach(a => {
            if (a.statut !== 'FAIT') {
                markActionStatusInStorage(a.id, true);
            }
        });
        setCompletedIds(getCompletedActionIds());
    }, [results.actions]);

    const filteredActions = useMemo(() => {
        if (filterCategory === 'TODO') {
            return results.actions.filter(a => a.statut !== 'FAIT');
        }
        if (filterCategory === 'DONE') {
            return results.actions.filter(a => a.statut === 'FAIT');
        }
        if (filterCategory === 'OVERDUE') {
            return results.overdueActions;
        }
        return results.actions;
    }, [results.actions, results.overdueActions, filterCategory]);

    return {
        selectedDate,
        setSelectedDate,
        actions: results.actions,
        overdueActions: results.overdueActions,
        filteredActions,
        stats: results.stats,
        filterCategory,
        setFilterCategory,
        toggleActionStatus,
        markAllTodayDone,
        refresh: () => {
            setCompletedIds(getCompletedActionIds());
            loadEngagements();
        }
    };
};
