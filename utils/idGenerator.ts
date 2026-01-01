// utils/idGenerator.ts
export const generateUniqueId = (prefix: string): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9); // 7 random chars for more uniqueness
  return `${prefix.toUpperCase()}${timestamp}-${randomPart}`;
};
