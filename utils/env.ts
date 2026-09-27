
export const getEnv = (key: string): string | undefined => {
  try {
    // @ts-expect-error process might not be defined
    if (typeof process !== 'undefined' && process && process.env) {
      // @ts-expect-error process might not be defined
      return process.env[key];
    }
  } catch {
    // Ignore errors in environments where process is restricted
  }
  return undefined;
};
