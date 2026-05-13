
export const getLocalDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getMonthString = (dateStr: string): string => {
  return dateStr.substring(0, 7); // "2023-11"
};

export const getWeekStartString = (): string => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(now.setDate(diff));
  
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
};

export const superParse = (data: any, fallback: any): any => {
  if (data === null || data === undefined) return fallback;
  if (typeof data === 'object' || typeof data === 'number') return data;
  try {
    let parsed = JSON.parse(data);
    if (typeof parsed === 'string') return superParse(parsed, fallback);
    return parsed === null ? fallback : parsed;
  } catch (e) {
    return fallback;
  }
};

export const parseIndex = (val: any): number => {
  const parsed = superParse(val, 0);
  const num = Number(parsed);
  return isNaN(num) ? 0 : num;
};

export const formatTime = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
