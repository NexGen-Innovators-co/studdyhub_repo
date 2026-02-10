// Reusable schedule event card used in both calendar day panel and list views
import React from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Edit2, Trash2, Repeat, Timer } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScheduleItem } from '../../types/Class';
import { typeColors, typeIcons } from './scheduleConstants';
import { formatTime, formatDate, getTimeUntil } from './scheduleUtils';

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

  return (
    <div
      className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* Top colour accent bar */}
      <div className="h-1" style={{ backgroundColor: item.color }} />

      <div className="p-3 sm:p-4 space-y-2.5">
        {/* Row 1 — Title + action buttons */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg sm:text-xl flex-shrink-0 leading-none">{typeIcons[item.type]}</span>
            <h3 className="font-semibold text-sm sm:text-base text-slate-800 dark:text-gray-100 truncate leading-snug">
              {item.title}
            </h3>
          </div>

          <div className="flex gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onEdit(item); }}
              title="Edit"
              className="hover:bg-blue-50 dark:hover:bg-blue-900/20 h-7 w-7 p-0"
            >
              <Edit2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.title); }}
              title="Delete"
              className="hover:bg-red-50 dark:hover:bg-red-900/20 h-7 w-7 p-0"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            </Button>
          </div>
        </div>

        {/* Row 2 — Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={typeColors[item.type]}>{item.type}</Badge>
          {item.isRecurring && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-blue-200 text-blue-600 dark:border-blue-700 dark:text-blue-400 gap-1">
              <Repeat className="h-3 w-3" />
              {item.recurrencePattern}
            </Badge>
          )}
          {timeUntil && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Timer className="h-3 w-3" />
              {timeUntil}
            </Badge>
          )}
        </div>

        {/* Row 3 — Compact meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500 dark:text-gray-400">
          {item.subject && (
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-slate-600 dark:text-slate-300">Subject:</span>
              {item.subject}
            </span>
          )}
          {showDate && (
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              {formatDate(new Date(item.startTime))}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
            {formatTime(new Date(item.startTime))} – {formatTime(new Date(item.endTime))}
          </span>
          {item.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
              {item.location}
            </span>
          )}
        </div>

        {/* Description (optional) */}
        {item.description && (
          <p className="text-xs sm:text-sm text-slate-400 dark:text-gray-500 italic line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
});
