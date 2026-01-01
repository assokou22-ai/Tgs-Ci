import { useMemo } from 'react';

// Function to calculate Easter Sunday for a given year (Gregorian calendar)
const getEasterSunday = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

// Returns a Set of date strings (YYYY-MM-DD) for faster lookups
const useHolidays = (year: number) => {
  const holidays = useMemo(() => {
    const holidaySet = new Set<string>();
    
    const addHoliday = (month: number, day: number) => {
        // month is 1-based
        const date = new Date(year, month - 1, day);
        holidaySet.add(date.toISOString().split('T')[0]);
    };

    // Fixed holidays for Côte d'Ivoire
    addHoliday(1, 1);   // New Year's Day
    addHoliday(5, 1);   // Labour Day
    addHoliday(8, 7);   // Independence Day
    addHoliday(8, 15);  // Assumption Day
    addHoliday(11, 1);  // All Saints' Day
    addHoliday(11, 15); // National Peace Day
    addHoliday(12, 25); // Christmas Day

    // Dynamic Christian holidays based on Easter
    const easter = getEasterSunday(year);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    addHoliday(easterMonday.getMonth() + 1, easterMonday.getDate());

    const ascension = new Date(easter);
    ascension.setDate(easter.getDate() + 39);
    addHoliday(ascension.getMonth() + 1, ascension.getDate());

    const whitMonday = new Date(easter);
    whitMonday.setDate(easter.getDate() + 50);
    addHoliday(whitMonday.getMonth() + 1, whitMonday.getDate());

    // Note: Islamic holidays (Eid al-Fitr, Eid al-Adha, Mawlid) are based on the lunar calendar
    // and require a more complex calculation or an external API for accuracy.
    // They are omitted here for simplicity.

    return holidaySet;
  }, [year]);

  return holidays;
};

export default useHolidays;