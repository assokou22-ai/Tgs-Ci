import { useState, useEffect, useCallback } from 'react';
import { LogEntry } from '../types.ts';
import { dbGetLogs, dbAddLog } from '../services/dbService.ts';

const useLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const storedLogs = await dbGetLogs();
      // Sort logs by timestamp, newest first
      setLogs(storedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    };
    fetchLogs();
  }, []);

  const addLog = useCallback(async (category: 'Service' | 'Stock', type: 'Ajout' | 'Suppression', message: string) => {
    const newLog: LogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      category,
      type,
      message,
    };
    try {
        await dbAddLog(newLog);
        setLogs(currentLogs => [newLog, ...currentLogs]);
    } catch (error) {
        console.error("Failed to add log entry:", error);
        // This is a background task, no need to alert the user.
    }
  }, []);

  return { logs, addLog };
};

export default useLogs;