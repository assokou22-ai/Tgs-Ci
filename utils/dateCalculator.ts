/**
 * Date Calculator Utility for Atelier TGS Côte d'Ivoire
 * Handles calculation of appointment and delivery dates based on specific delay options.
 * 
 * Rules:
 * 1. Repair / Prestation (e.g. Devis validé, Réparation en cours):
 *    - Delays: 30mn, 1h, 2h, 3h, 4h, 6h, 24h, 48h, 72h, 5 jours, 7 jours, 10 jours, 15 jours, 20 jours, 30 jours.
 *    - Excludes: Sundays and Public Holidays.
 * 
 * 2. Orders (Commandes):
 *    - Delays: 15 jours ouvrables, 20 jours ouvrables, 25 jours ouvrables (5 days out of 7).
 *    - Excludes: Saturdays, Sundays, and Public Holidays.
 */

// Meeus/Jones/Butcher algorithm for Easter Sunday
export function getEasterDate(year: number): Date {
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
}

// Get standard French/Ivorian holidays for a given year
export function getHolidays(year: number): string[] {
  const easter = getEasterDate(year);
  
  // Easter Monday (+1 day)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  
  // Ascension Day (+39 days)
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);
  
  // Pentecost Monday (+50 days)
  const pentecostMonday = new Date(easter);
  pentecostMonday.setDate(easter.getDate() + 50);

  const format = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const holidays = [
    `${year}-01-01`, // Jour de l'An
    `${year}-05-01`, // Fête du Travail
    `${year}-08-07`, // Fête nationale de Côte d'Ivoire (Indépendance)
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-15`, // Journée de la Paix (Côte d'Ivoire)
    `${year}-12-25`, // Noël
    format(easterMonday),
    format(ascension),
    format(pentecostMonday)
  ];

  // Approximations for dynamic Muslim holidays (Mouloud, Korité, Tabaski) in Côte d'Ivoire for 2026-2028
  if (year === 2026) {
    holidays.push('2026-03-20'); // Korité (approximé)
    holidays.push('2026-05-27'); // Tabaski (approximé)
    holidays.push('2026-08-26'); // Maouloud (approximé)
  } else if (year === 2027) {
    holidays.push('2027-03-09'); // Korité
    holidays.push('2027-05-16'); // Tabaski
    holidays.push('2027-08-15'); // Maouloud
  } else if (year === 2028) {
    holidays.push('2028-02-26'); // Korité
    holidays.push('2028-05-04'); // Tabaski
    holidays.push('2028-08-03'); // Maouloud
  }

  return holidays;
}

export function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getHolidays(year);
  const dateStr = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return holidays.includes(dateStr);
}

/**
 * Calculates next date ignoring Sundays and Public Holidays.
 * If start falls on a Sunday or Holiday, it is rolled forward to next active day first.
 */
export function addDaysExcludingSundaysAndHolidays(startDate: Date, daysToAdd: number): Date {
  const currentDate = new Date(startDate);
  
  // If starting date is Sunday or Holiday, push to next valid day
  while (currentDate.getDay() === 0 || isHoliday(currentDate)) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  let added = 0;
  while (added < daysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (currentDate.getDay() !== 0 && !isHoliday(currentDate)) {
      added++;
    }
  }
  return currentDate;
}

/**
 * Calculates next date ignoring Saturdays, Sundays, and Public Holidays (5 days out of 7).
 */
export function addWorkingDays(startDate: Date, daysToAdd: number): Date {
  const currentDate = new Date(startDate);
  
  // If starting date is Weekend or Holiday, push to next valid day
  while (currentDate.getDay() === 0 || currentDate.getDay() === 6 || isHoliday(currentDate)) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  let added = 0;
  while (added < daysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6 && !isHoliday(currentDate)) {
      added++;
    }
  }
  return currentDate;
}

/**
 * Parses duration and calculates exact future Date.
 * Supports minutes, hours, days, and working days.
 */
export function calculateFutureDate(startDate: Date, durationOption: string): Date {
  const lowerStr = durationOption.toLowerCase().trim();
  const resultDate = new Date(startDate);

  // 1. Working days for orders (e.g. "15 jours ouvrables", "20 jours ouvrables", "25 jours ouvrables")
  if (lowerStr.includes('ouvrable') || lowerStr.includes('5 jours sur 7')) {
    const match = lowerStr.match(/(\d+)/);
    if (match) {
      const days = parseInt(match[1], 10);
      return addWorkingDays(startDate, days);
    }
  }

  // 2. Standard days (excluding Sunday & Holidays)
  if (lowerStr.includes('jour')) {
    const match = lowerStr.match(/(\d+)/);
    if (match) {
      const days = parseInt(match[1], 10);
      return addDaysExcludingSundaysAndHolidays(startDate, days);
    }
  }

  // 3. Hours (excluding Sunday & Holidays)
  if (lowerStr.includes('h') || lowerStr.includes('heure')) {
    const match = lowerStr.match(/(\d+)/);
    if (match) {
      const hours = parseInt(match[1], 10);
      
      // Add hour-by-hour and adjust if landing on a Sunday or holiday
      resultDate.setHours(resultDate.getHours() + hours);
      while (resultDate.getDay() === 0 || isHoliday(resultDate)) {
        // Roll to next Monday or non-holiday, starting at 09:00
        resultDate.setDate(resultDate.getDate() + 1);
        resultDate.setHours(9, 0, 0, 0);
      }
      return resultDate;
    }
  }

  // 4. Minutes (excluding Sunday & Holidays)
  if (lowerStr.includes('mn') || lowerStr.includes('min') || lowerStr.includes('minute')) {
    const match = lowerStr.match(/(\d+)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      resultDate.setMinutes(resultDate.getMinutes() + minutes);
      while (resultDate.getDay() === 0 || isHoliday(resultDate)) {
        resultDate.setDate(resultDate.getDate() + 1);
        resultDate.setHours(9, 0, 0, 0);
      }
      return resultDate;
    }
  }

  return resultDate;
}
