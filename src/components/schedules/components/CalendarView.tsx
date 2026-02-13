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
import { useMediaQuery } from 'usehooks-ts';

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
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // For mobile, we might want to default to showing just the current week or a simplified view
  // But for now, let's just make the grid more responsive and clean up the header

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Calendar Header */}
      <div className="flex items-center justify-between bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center gap-4">
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
        </div>
        
        <div className="flex gap-2">
           <Button variant="ghost" size="icon" onClick={onPrevMonth} className="h-9 w-9 rounded-full hover:bg-blue-50 dark:hover:bg-slate-700">
              <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onToday} className="font-medium text-blue-600 dark:text-blue-400">
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={onNextMonth} className="h-9 w-9 rounded-full hover:bg-blue-50 dark:hover:bg-slate-700">
              <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </Button>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Calendar Grid */}
        <Card className="w-full border-none shadow-lg overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800">
          <CardContent className="p-0">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {isMobile ? day.charAt(0) : day}
                </div>
              ))}
            </div>

            {/* Day Cells */}
            <div className="grid grid-cols-7 auto-rows-fr bg-slate-100 dark:bg-slate-800 gap-[1px]">
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
                      "min-h-[60px] sm:min-h-[120px] p-1 sm:p-2 bg-white dark:bg-slate-900/80 cursor-pointer transition-all duration-200 relative group",
                      !isCurrentMonth && "bg-slate-50/30 dark:bg-slate-900/40 text-slate-300 dark:text-slate-600",
                      isSelected && "bg-blue-50/50 dark:bg-blue-900/10 z-10",
                      !isSelected && "hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                     {isSelected && (
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 rounded-full mx-2 mb-1" />
                     )}

                    <div className="flex flex-col items-center sm:items-start justify-between h-full">
                      <span className={cn(
                        "text-xs sm:text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full mb-1 transition-all",
                        isTodayDate
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                          : isSelected 
                            ? "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30"
                            : "text-slate-700 dark:text-slate-400 group-hover:bg-slate-100 dark:group-hover:bg-slate-800"
                      )}>
                        {format(day, 'd')}
                      </span>

                      {/* Event Indicators */}
                      <div className="w-full flex-1 flex flex-col justify-end gap-1">
                        {/* Mobile: Dots */}
                        <div className={cn("flex justify-center gap-1 flex-wrap", !isMobile && "hidden")}>
                          {events.slice(0, 3).map((event, i) => (
                            <div
                              key={`${event.id}-dot-${i}`}
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: event.color }}
                            />
                          ))}
                           {events.length > 3 && (
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          )}
                        </div>

                        {/* Desktop: Full Labels */}
                        <div className={cn("space-y-1 w-full", isMobile && "hidden")}>
                          {events.slice(0, 3).map((event, i) => (
                            <div
                              key={`${event.id}-${i}`}
                              className="text-[10px] truncate px-1.5 py-0.5 rounded-md border-l-2 font-medium leading-tight shadow-sm"
                              style={{
                                backgroundColor: `color-mix(in srgb, ${event.color} 10%, transparent)`,
                                color: `color-mix(in srgb, ${event.color} 80%, black)`, // Darken text slightly
                                borderColor: event.color,
                              }}
                            >
                               {event.title}
                            </div>
                          ))}
                          {events.length > 3 && (
                            <div className="text-[10px] text-slate-400 pl-1 font-medium">
                              + {events.length - 3} more
                            </div>
                          )}
                        </div>
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
