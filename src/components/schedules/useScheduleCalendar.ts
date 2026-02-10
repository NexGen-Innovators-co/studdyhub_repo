// Custom hook for calendar logic: month nav, day expansion, event filtering
import { useState, useMemo, useCallback } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, addMonths, subMonths,
  isAfter, isBefore, getDay, addDays, isToday
} from 'date-fns';
import { ScheduleItem } from '../../types/Class';

export const useScheduleCalendar = (scheduleItems: ScheduleItem[]) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const handlePrevMonth = useCallback(() => setCurrentMonth(prev => subMonths(prev, 1)), []);
  const handleNextMonth = useCallback(() => setCurrentMonth(prev => addMonths(prev, 1)), []);
  const handleToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  }, []);

  // Generate calendar days for the grid (includes overflow from prev/next month)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Memoize the recurring event matching function
  const getEventsForDay = useCallback((day: Date): ScheduleItem[] => {
    return scheduleItems.filter(item => {
      const itemStart = new Date(item.startTime);

      // Direct match (non-recurring)
      if (isSameDay(day, itemStart) && !item.isRecurring) return true;

      // Recurring match
      if (item.isRecurring) {
        if (item.recurrenceEndDate && isAfter(day, new Date(item.recurrenceEndDate))) return false;

        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const originStart = new Date(itemStart);
        originStart.setHours(0, 0, 0, 0);

        if (isBefore(dayStart, originStart)) return false;

        if (item.recurrencePattern === 'daily') return true;

        if (item.recurrencePattern === 'weekly') {
          const currentDayOfWeek = getDay(day);
          return item.recurrenceDays?.includes(currentDayOfWeek) ?? false;
        }

        if (item.recurrencePattern === 'monthly') {
          return day.getDate() === itemStart.getDate();
        }
      }

      return false;
    });
  }, [scheduleItems]);

  // Categorized items for list tabs
  const { upcomingItems, todayItems, pastItems } = useMemo(() => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const upcoming: ScheduleItem[] = [];
    const todayList: ScheduleItem[] = [];
    const past: ScheduleItem[] = [];

    scheduleItems.forEach(item => {
      const itemStart = new Date(item.startTime);

      if (!item.isRecurring) {
        if (itemStart >= now) {
          upcoming.push(item);
          if (itemStart >= today && itemStart < tomorrow) todayList.push(item);
        } else {
          past.push(item);
        }
      } else {
        // Recurring: check if it occurs today
        if (getEventsForDay(new Date()).find(i => i.id === item.id)) {
          todayList.push(item);
        }
        // Active recurring events go to upcoming
        if (itemStart >= now || (item.isRecurring && (!item.recurrenceEndDate || new Date(item.recurrenceEndDate) >= now))) {
          upcoming.push(item);
        }
      }
    });

    upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    past.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    todayList.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return { upcomingItems: upcoming, todayItems: todayList, pastItems: past };
  }, [scheduleItems, getEventsForDay]);

  return {
    currentMonth,
    selectedDate,
    setSelectedDate,
    calendarDays,
    handlePrevMonth,
    handleNextMonth,
    handleToday,
    getEventsForDay,
    upcomingItems,
    todayItems,
    pastItems
  };
};
