import { addDays, differenceInDays, format } from 'date-fns';

export const calculateEndDate = (startDate: string | undefined, duration: number | undefined): string => {
  if (!startDate || !duration || duration <= 0) return '';
  
  try {
    const start = new Date(startDate);
    const end = addDays(start, duration - 1); // 開始日を含むため-1
    return format(end, 'yyyy-MM-dd');
  } catch (error) {
    return '';
  }
};

export const calculateProgress = (startDate: string | undefined, duration: number | undefined): number => {
  if (!startDate || !duration || duration <= 0) return 0;
  
  try {
    const start = new Date(startDate);
    const today = new Date();
    const daysElapsed = differenceInDays(today, start);
    
    if (daysElapsed < 0) return 0; // 開始前
    if (daysElapsed >= duration) return 100; // 完了
    
    return Math.round((daysElapsed / duration) * 100);
  } catch (error) {
    return 0;
  }
};

export const formatDateForDisplay = (date: string | undefined): string => {
  if (!date) return '';
  
  try {
    return format(new Date(date), 'M/d');
  } catch (error) {
    return '';
  }
};