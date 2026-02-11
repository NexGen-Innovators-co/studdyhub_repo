// Calendar grid view with month navigation and selected-day event panel
import React from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { ScheduleItem } from '../../../types/Class';
import { SubscriptionGuard } from '../../subscription/SubscriptionGuard';
import { cn } from '../../../lib/utils';
import { format, isSameMonth, isSameDay, isToday } from 'date-fns';
import { formatTime } from '../utils/scheduleUtils';
import { ScheduleEventCard } from './ScheduleEventCard';

interface CalendarViewProps {
  currentMonth: Date;
  selectedDate: Date | null;
  calendarDays: Date[];
  scheduleItems: ScheduleItem[];
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  getEventsForDay: (day: Date) => ScheduleItem[];
  onShowForm: (date?: string) => void;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string, title: string) => void;
  scheduleCount: number;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  currentMonth,
  selectedDate,
  calendarDays,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  getEventsForDay,
  onShowForm,
  onEdit,
  onDelete,
  scheduleCount
}) => {
  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-gray-100">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={onPrevMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onNextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onToday} className="ml-1">
              Today
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Calendar Grid */}
        <Card className="w-full border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.charAt(0)}</span>
                </div>
              ))}
            </div>

            {/* Day Cells */}
            <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 dark:bg-slate-700 gap-[1px]">
              {calendarDays.map((day) => {
                const events = getEventsForDay(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => onSelectDate(day)}
                    className={cn(
                      "min-h-[80px] sm:min-h-[120px] p-1 sm:p-2 bg-white dark:bg-slate-800 cursor-pointer transition-colors relative hover:bg-slate-50 dark:hover:bg-slate-800/80",
                      !isCurrentMonth && "bg-slate-50 dark:bg-slate-900/20 text-slate-400",
                      isSelected && "ring-2 ring-inset ring-blue-500 z-10"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn(
                        "text-xs sm:text-sm font-medium h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center rounded-full",
                        isTodayDate
                          ? "bg-blue-600 text-white"
                          : "text-slate-700 dark:text-slate-300"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {events.length > 0 && (
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400">
                          {events.length}
                        </span>
                      )}
                    </div>

                    {/* Event Indicators */}
                    <div className="mt-1 flex flex-wrap gap-0.5 sm:block sm:space-y-1">
                      {/* Mobile: Dots */}
                      <div className="flex flex-wrap gap-0.5 sm:hidden">
                        {events.slice(0, 4).map((event, i) => (
                          <div
                            key={`${event.id}-dot-${i}`}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: event.color }}
                          />
                        ))}
                        {events.length > 4 && (
                          <span className="text-[8px] text-slate-400 font-bold">+</span>
                        )}
                      </div>

                      {/* Desktop: Full Labels */}
                      <div className="hidden sm:block space-y-1">
                        {events.slice(0, 3).map((event, i) => (
                          <div
                            key={`${event.id}-${i}`}
                            className="text-[9px] sm:text-xs truncate px-1 py-0.5 rounded border-l-2 opacity-90 leading-tight"
                            style={{
                              backgroundColor: `${event.color}20`,
                              color: event.color,
                              borderColor: event.color
                            }}
                          >
                            <span className="hidden sm:inline">{formatTime(new Date(event.startTime))} </span>
                            {event.title}
                          </div>
                        ))}
                        {events.length > 3 && (
                          <div className="text-[10px] text-slate-400 pl-1">
                            + {events.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">
              {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a date'}
            </h3>
            {selectedDate && (
              <SubscriptionGuard
                feature="Schedule Items"
                limitFeature="maxScheduleItems"
                currentCount={scheduleCount}
              >
                <Button size="sm" onClick={() => onShowForm(selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Event
                </Button>
              </SubscriptionGuard>
            )}
          </div>

          <Card className="min-h-[300px] overflow-hidden flex flex-col">
            <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
              {selectedDate ? (
                (() => {
                  const dayEvents = getEventsForDay(selectedDate)
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                  if (dayEvents.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-12">
                        <CalendarIcon className="h-10 w-10 opacity-20" />
                        <p className="text-sm">No events scheduled</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onShowForm(format(selectedDate, 'yyyy-MM-dd'))}
                          className="mt-2"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add event for this day
                        </Button>
                      </div>
                    );
                  }

                  return dayEvents.map((item) => (
                    <ScheduleEventCard
                      key={item.id}
                      item={item}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      showDate={false}
                    />
                  ));
                })()
              ) : (
                <div className="text-center text-slate-500 mt-10">Select a date to view events</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
