const PREFIX = 'mac-repair-app-';

export const storageService = {
  get<T>(key: string, defaultValue: T): T {
    const storedValue = localStorage.getItem(PREFIX + key);
    if (storedValue === null) {
      return defaultValue;
    }
    try {
      return JSON.parse(storedValue) as T;
    } catch (error) {
      console.error(`Error parsing JSON from localStorage key "${key}":`, error);
      return defaultValue;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      const valueToStore = JSON.stringify(value);
      localStorage.setItem(PREFIX + key, valueToStore);
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  },
};
