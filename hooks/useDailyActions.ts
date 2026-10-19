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

export type ActionDatePreset = 
    | 'today'
    | 'tomorrow'
    | 'this_week'
    | 'this_month'
    | 'last_month'
    | 'this_year'
    | 'example_jan_feb'
    | 'q1'
    | 'q2'
    | 'q3'
    | 'q4'
    | 'last_7_days'
    | 'last_30_days'
    | 'custom';

export const useDailyActions = (
    tickets: RepairTicket[] = [],
    appointments: Appointment[] = []
) => {
    const todayStr = useMemo(() => formatDateKey(new Date()), []);
    const [startDate, setStartDate] = useState<string>(todayStr);
    const [endDate, setEndDate] = useState<string>(todayStr);
    const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
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
        const targetEnd = dateMode === 'range' ? endDate : undefined;
        return calculateAllReminders(tickets, appointments, engagements, startDate, completedIds, targetEnd);
    }, [tickets, appointments, engagements, startDate, endDate, dateMode, completedIds]);

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

    // Helper to change single date
    const setSelectedDate = useCallback((date: string) => {
        setStartDate(date);
        if (dateMode === 'single') {
            setEndDate(date);
        }
    }, [dateMode]);

    // Helper to set explicit date range
    const setDateRange = useCallback((start: string, end: string) => {
        setDateMode('range');
        setStartDate(start);
        setEndDate(end);
    }, []);

    // Quick presets
    const applyPreset = useCallback((preset: ActionDatePreset, customYear?: number) => {
        const now = new Date();
        const curYear = customYear || now.getFullYear();

        switch (preset) {
            case 'today': {
                const s = formatDateKey(now);
                setDateMode('single');
                setStartDate(s);
                setEndDate(s);
                break;
            }
            case 'tomorrow': {
                const tom = new Date(now);
                tom.setDate(tom.getDate() + 1);
                const s = formatDateKey(tom);
                setDateMode('single');
                setStartDate(s);
                setEndDate(s);
                break;
            }
            case 'this_week': {
                // Lundi de la semaine en cours
                const dayOfWeek = now.getDay();
                const distanceToMonday = (dayOfWeek + 6) % 7;
                const monday = new Date(now);
                monday.setDate(monday.getDate() - distanceToMonday);
                const sunday = new Date(monday);
                sunday.setDate(sunday.getDate() + 6);

                setDateMode('range');
                setStartDate(formatDateKey(monday));
                setEndDate(formatDateKey(sunday));
                break;
            }
            case 'this_month': {
                const firstDay = new Date(curYear, now.getMonth(), 1);
                const lastDay = new Date(curYear, now.getMonth() + 1, 0);
                setDateMode('range');
                setStartDate(formatDateKey(firstDay));
                setEndDate(formatDateKey(lastDay));
                break;
            }
            case 'last_month': {
                const firstDay = new Date(curYear, now.getMonth() - 1, 1);
                const lastDay = new Date(curYear, now.getMonth(), 0);
                setDateMode('range');
                setStartDate(formatDateKey(firstDay));
                setEndDate(formatDateKey(lastDay));
                break;
            }
            case 'this_year': {
                const firstDay = new Date(curYear, 0, 1);
                const lastDay = new Date(curYear, 11, 31);
                setDateMode('range');
                setStartDate(formatDateKey(firstDay));
                setEndDate(formatDateKey(lastDay));
                break;
            }
            case 'example_jan_feb': {
                // Exact example from user: "du 1 janvier 2026 au 15 février 2026"
                setDateMode('range');
                setStartDate(`${curYear}-01-01`);
                setEndDate(`${curYear}-02-15`);
                break;
            }
            case 'q1': {
                setDateMode('range');
                setStartDate(`${curYear}-01-01`);
                setEndDate(`${curYear}-03-31`);
                break;
            }
            case 'q2': {
                setDateMode('range');
                setStartDate(`${curYear}-04-01`);
                setEndDate(`${curYear}-06-30`);
                break;
            }
            case 'q3': {
                setDateMode('range');
                setStartDate(`${curYear}-07-01`);
                setEndDate(`${curYear}-09-30`);
                break;
            }
            case 'q4': {
                setDateMode('range');
                setStartDate(`${curYear}-10-01`);
                setEndDate(`${curYear}-12-31`);
                break;
            }
            case 'last_7_days': {
                const past7 = new Date(now);
                past7.setDate(past7.getDate() - 6);
                setDateMode('range');
                setStartDate(formatDateKey(past7));
                setEndDate(formatDateKey(now));
                break;
            }
            case 'last_30_days': {
                const past30 = new Date(now);
                past30.setDate(past30.getDate() - 29);
                setDateMode('range');
                setStartDate(formatDateKey(past30));
                setEndDate(formatDateKey(now));
                break;
            }
            default:
                break;
        }
    }, []);

    // Change year seamlessly preserving month and day
    const changeYear = useCallback((newYear: number) => {
        const replaceYear = (dStr: string) => {
            const parts = dStr.split('-');
            if (parts.length === 3) {
                return `${newYear}-${parts[1]}-${parts[2]}`;
            }
            return dStr;
        };
        setStartDate(prev => replaceYear(prev));
        setEndDate(prev => replaceYear(prev));
    }, []);

    // Select an entire specific month (0 = Janvier, 11 = Décembre)
    const selectMonth = useCallback((monthIndex: number, year?: number) => {
        const targetYear = year || parseInt(startDate.split('-')[0], 10) || new Date().getFullYear();
        const firstDay = new Date(targetYear, monthIndex, 1);
        const lastDay = new Date(targetYear, monthIndex + 1, 0);
        setDateMode('range');
        setStartDate(formatDateKey(firstDay));
        setEndDate(formatDateKey(lastDay));
    }, [startDate]);

    return {
        selectedDate: startDate,
        setSelectedDate,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        dateMode,
        setDateMode,
        setDateRange,
        applyPreset,
        changeYear,
        selectMonth,
        isRange: results.isRange,
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
