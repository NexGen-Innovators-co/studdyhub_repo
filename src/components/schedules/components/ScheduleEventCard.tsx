// Reusable schedule event card used in both calendar day panel and list views
import React from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Edit2, Trash2, Repeat, Timer } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { ScheduleItem } from '../../../types/Class';
import { typeColors, typeIcons } from '../constants/scheduleConstants';
import { format, isSameMonth, isSameDay, isToday, isWithinInterval } from 'date-fns';
import { formatTime, formatDate, getTimeUntil } from '../utils/scheduleUtils';
import { cn } from '../../../lib/utils';

interface ScheduleEventCardProps {
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string, title: string) => void;
  showDate?: boolean;
  showCountdown?: boolean;
}

export const ScheduleEventCard: React.FC<ScheduleEventCardProps> = React.memo(({
  item,
  onEdit,
  onDelete,
  showDate = true,
  showCountdown = false
}) => {
  const timeUntil = showCountdown ? getTimeUntil(item.startTime) : null;
  
  const now = new Date();
  const isHappening = isWithinInterval(now, {
    start: new Date(item.startTime),
    end: new Date(item.endTime)
  });

  return (
    <div
      className={cn(
        "group rounded-xl border transition-all duration-300 overflow-hidden relative",
        "bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm",
        "hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700",
        isHappening 
          ? "border-blue-500 shadow-md ring-1 ring-blue-500/20" 
          : "border-slate-200 dark:border-slate-700"
      )}
    >
      {/* Top colour accent bar */}
      <div className={cn("h-1.5 w-full transition-all", isHappening ? "h-2" : "")} style={{ backgroundColor: item.color }} />
      
      {/* Active Indicator */}
      {isHappening && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider rounded-full z-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Now
        </div>
      )}

      <div className="p-3 sm:p-5 space-y-3">
        {/* Row 1 — Title + action buttons */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "p-2 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex-shrink-0 text-xl",
              isHappening && "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
            )}>
               {typeIcons[item.type]}
            </div>
            <div className="min-w-0">
              <h3 className={cn(
                "font-bold text-base sm:text-lg text-slate-800 dark:text-gray-100 truncate leading-snug",
                isHappening && "text-blue-700 dark:text-blue-300"
              )}>
                {item.title}
              </h3>
              {item.subject && (
                 <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                   {item.subject}
                 </p>
              )}
            </div>
          </div>

          <div className="flex gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onEdit(item); }}
              title="Edit"
              className="hover:bg-blue-50 dark:hover:bg-blue-900/20 h-8 w-8 rounded-full"
            >
              <Edit2 className="h-4 w-4 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.title); }}
              title="Delete"
              className="hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 rounded-full"
            >
              <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400" />
            </Button>
          </div>
        </div>

        {/* Row 2 — Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("px-2 py-0.5 text-[10px]", typeColors[item.type])}>{item.type}</Badge>
          {item.isRecurring && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-slate-200 dark:border-slate-700 text-slate-500 gap-1 bg-slate-50 dark:bg-slate-800/50">
              <Repeat className="h-3 w-3" />
              {item.recurrencePattern}
            </Badge>
          )}
          {timeUntil && !isHappening && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border border-amber-200 dark:border-amber-800/30">
              <Timer className="h-3 w-3" />
              {timeUntil}
            </Badge>
          )}
        </div>

        {/* Row 3 — Compact meta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-600 dark:text-gray-400 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className={cn("h-4 w-4 flex-shrink-0", isHappening ? "text-blue-500" : "text-slate-400")} />
            <span className="font-medium">
              {formatTime(new Date(item.startTime))} – {formatTime(new Date(item.endTime))}
            </span>
          </div>
          
          {showDate && (
             <div className="flex items-center gap-2">
               <CalendarIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
               <span>{formatDate(new Date(item.startTime))}</span>
             </div>
          )}

          {item.location && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="truncate">{item.location}</span>
            </div>
          )}
        </div>

        {/* Description (optional) */}
        {item.description && (
          <p className="text-xs text-slate-500 dark:text-gray-500 italic line-clamp-2 px-1">
            "{item.description}"
          </p>
        )}
      </div>
    </div>
  );
});
