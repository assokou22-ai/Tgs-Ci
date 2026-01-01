
export const getEnv = (key: string): string | undefined => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process && process.env) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) {
    // Ignore errors in environments where process is restricted
  }
  return undefined;
};
