// Grid/list view for upcoming, today, and past schedule items
import React from 'react';
import { Plus, CalendarDays, CalendarCheck, Clock, History } from 'lucide-react';
import { Button } from '../../ui/button';
import { ScheduleItem } from '../../../types/Class';
import { SubscriptionGuard } from '../../subscription/SubscriptionGuard';
import { ScheduleEventCard } from './ScheduleEventCard';

type TabType = 'upcoming' | 'today' | 'past';

interface EventListViewProps {
  items: ScheduleItem[];
  activeTab: TabType;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string, title: string) => void;
  onShowForm: () => void;
  scheduleCount: number;
}

const tabMeta: Record<TabType, { icon: React.ElementType; emptyTitle: string; emptyDesc: string }> = {
  upcoming: {
    icon: CalendarDays,
    emptyTitle: 'No upcoming events',
    emptyDesc: 'Your upcoming schedule is clear. Add events to stay organised.',
  },
  today: {
    icon: CalendarCheck,
    emptyTitle: "Nothing on today's agenda",
    emptyDesc: 'Enjoy a free day, or add something to your schedule.',
  },
  past: {
    icon: History,
    emptyTitle: 'No past events',
    emptyDesc: 'Past events will appear here once they have elapsed.',
  },
};

export const EventListView: React.FC<EventListViewProps> = React.memo(
  ({ items, activeTab, onEdit, onDelete, onShowForm, scheduleCount }) => {
    const meta = tabMeta[activeTab];
    const Icon = meta.icon;

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 text-slate-400">
          <Icon className="h-12 w-12 opacity-20" />
          <div className="text-center space-y-1">
            <p className="text-lg font-medium text-slate-500 dark:text-slate-400">{meta.emptyTitle}</p>
            <p className="text-sm">{meta.emptyDesc}</p>
          </div>
          {activeTab !== 'past' && (
            <SubscriptionGuard
              feature="Schedule Items"
              limitFeature="maxScheduleItems"
              currentCount={scheduleCount}
            >
              <Button size="sm" onClick={onShowForm} className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </SubscriptionGuard>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((item) => (
          <ScheduleEventCard
            key={item.id}
            item={item}
            onEdit={onEdit}
            onDelete={onDelete}
            showDate
            showCountdown={activeTab === 'upcoming'}
          />
        ))}
      </div>
    );
  }
);

EventListView.displayName = 'EventListView';
